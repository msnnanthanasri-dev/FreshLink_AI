import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { notify, notifyOrg, fail, friendlyDate, friendlyTime } from "./lib/util";
import type { Doc, Id } from "./_generated/dataModel";

async function requireViewer(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) fail("You must be signed in to view this information.");
  const user = await ctx.db.get(userId);
  if (!user) fail("You must be signed in to view this information.");
  const org = user.organizationId ? await ctx.db.get(user.organizationId) : null;
  return { userId, user, org };
}

/** Pickups visible to the viewer (role-aware). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { user, org } = await requireViewer(ctx);
    const rows = await ctx.db.query("pickupSchedules").order("desc").collect();
    let visible: Doc<"pickupSchedules">[];
    if (user.role === "admin") visible = rows;
    else if (org?.type === "supplier") visible = rows.filter((p) => p.supplierOrgId === org._id);
    else if (org?.type === "recipient") visible = rows.filter((p) => p.recipientOrgId === org._id);
    else visible = [];

    const out = [];
    for (const p of visible) {
      const listing = await ctx.db.get(p.listingId);
      const supplierOrg = await ctx.db.get(p.supplierOrgId);
      const recipientOrg = await ctx.db.get(p.recipientOrgId);
      if (!listing || !supplierOrg || !recipientOrg) continue;
      out.push({
        ...p,
        listing: { _id: listing._id, title: listing.title, category: listing.category, photoUrl: listing.photoUrl, storageCondition: listing.storageCondition, coldChainRequired: listing.coldChainRequired, handlingInstructions: listing.handlingInstructions },
        supplierOrg: { _id: supplierOrg._id, name: supplierOrg.name, address: supplierOrg.address, lat: supplierOrg.lat, lng: supplierOrg.lng, contactPhone: supplierOrg.contactPhone },
        recipientOrg: { _id: recipientOrg._id, name: recipientOrg.name, address: recipientOrg.address, lat: recipientOrg.lat, lng: recipientOrg.lng, contactPhone: recipientOrg.contactPhone },
        viewerRole: org?._id === p.supplierOrgId ? "supplier" : "recipient",
      });
    }
    return out.sort((a, b) => (a.scheduledDate + a.scheduledTime).localeCompare(b.scheduledDate + b.scheduledTime));
  },
});

/** One pickup with everything the details view needs. */
export const get = query({
  args: { id: v.id("pickupSchedules") },
  handler: async (ctx, { id }) => {
    const { user, org } = await requireViewer(ctx);
    const p = await ctx.db.get(id);
    if (!p) return null;
    if (org && p.supplierOrgId !== org._id && p.recipientOrgId !== org._id && user.role !== "admin") return null;
    const listing = await ctx.db.get(p.listingId);
    const supplierOrg = await ctx.db.get(p.supplierOrgId);
    const recipientOrg = await ctx.db.get(p.recipientOrgId);
    if (!listing || !supplierOrg || !recipientOrg) return null;
    const allocation = await ctx.db.get(p.allocationId);
    return {
      ...p,
      listing,
      supplierOrg,
      recipientOrg,
      allocation: allocation ?? null,
      viewerRole: org?._id === p.supplierOrgId ? "supplier" : org?._id === p.recipientOrgId ? "recipient" : "admin",
    };
  },
});

/**
 * Update pickup status. Enforces the lifecycle:
 * scheduled → ready → on_the_way → picked_up (handed over by supplier)
 * → completed (confirmed by recipient)  | cancelled at any pre-completion stage.
 *
 * Handoff: supplier "handed over" sets handedOverAt and status picked_up.
 * Completion: recipient confirms receipt → transaction history + impact.
 */
export const setStatus = mutation({
  args: { id: v.id("pickupSchedules"), status: v.string() },
  handler: async (ctx, { id, status }) => {
    const { userId, user, org } = await requireViewer(ctx);
    const p = await ctx.db.get(id);
    if (!p) fail("Pickup not found.");
    const listing = await ctx.db.get(p.listingId);
    if (!listing) fail("Listing not found.");
    const isSupplierSide = org && p.supplierOrgId === org._id;
    const isRecipientSide = org && p.recipientOrgId === org._id;
    const isAdmin = user.role === "admin";
    if (!isSupplierSide && !isRecipientSide && !isAdmin) fail("You are not part of this pickup.");

    const now = Date.now();

    if (status === "ready") {
      if (!isSupplierSide && !isAdmin) fail("Only the supplier can mark a pickup as ready.");
      if (!["scheduled", "on_the_way"].includes(p.status)) fail("This pickup cannot be marked ready right now.");
      await ctx.db.patch(id, { status: "ready", updatedAt: now });
      await notifyOrg(ctx, p.recipientOrgId, {
        title: "Pickup ready",
        body: `${listing.title} is ready for collection at ${p.pickupLocation}.`,
        type: "pickup",
        link: "/pickups",
      });
      return { ok: true };
    }

    if (status === "on_the_way") {
      if (!isRecipientSide && !isAdmin) fail("Only the recipient can mark themselves on the way.");
      if (!["scheduled", "ready"].includes(p.status)) fail("This pickup cannot be started right now.");
      await ctx.db.patch(id, { status: "on_the_way", updatedAt: now });
      await notifyOrg(ctx, p.supplierOrgId, {
        title: "Recipient on the way",
        body: `${recipientName(await ctx.db.get(p.recipientOrgId))} is on the way to collect ${listing.title}.`,
        type: "pickup",
        link: "/pickups",
      });
      return { ok: true };
    }

    if (status === "picked_up") {
      if (!isSupplierSide && !isAdmin) fail("Only the supplier can confirm handover.");
      if (!["scheduled", "ready", "on_the_way"].includes(p.status)) fail("This pickup cannot be handed over right now.");
      await ctx.db.patch(id, { status: "picked_up", handedOverAt: now, updatedAt: now });
      await notifyOrg(ctx, p.recipientOrgId, {
        title: "Handed over — confirm receipt",
        body: `${listing.title} was handed over. Please confirm pickup received to complete this redistribution.`,
        type: "pickup",
        link: "/pickups",
      });
      return { ok: true };
    }

    if (status === "completed") {
      if (!isRecipientSide && !isAdmin) fail("Only the recipient can confirm pickup received.");
      if (p.status !== "picked_up") fail("The supplier must hand over the food before you can confirm receipt.");
      await ctx.db.patch(id, { status: "completed", confirmedAt: now, updatedAt: now });
      await completeRedistribution(ctx, p, listing, now);
      return { ok: true };
    }

    if (status === "cancelled") {
      if (p.status === "completed") fail("This pickup is already completed.");
      await ctx.db.patch(id, { status: "cancelled", updatedAt: now });
      // Release allocation + listing quantity if it was not handed over yet
      const alloc = await ctx.db.get(p.allocationId);
      if (alloc && ["proposed", "approved"].includes(alloc.status)) {
        await ctx.db.patch(alloc._id, { status: "cancelled", updatedAt: now });
        const restored = listing.quantityAvailable + alloc.quantity;
        await ctx.db.patch(listing._id, {
          quantityAvailable: restored,
          status: restored >= listing.quantityOriginal ? "available" : "partially_allocated",
          updatedAt: now,
        });
      }
      const msg = {
        title: "Pickup cancelled",
        body: `The pickup of ${listing.title} on ${friendlyDate(p.scheduledDate)} at ${friendlyTime(p.scheduledTime)} was cancelled.`,
        type: "pickup",
        link: "/pickups",
      };
      await notifyOrg(ctx, p.supplierOrgId, msg);
      await notifyOrg(ctx, p.recipientOrgId, msg);
      return { ok: true };
    }

    fail("Unknown pickup status.");
  },
});

async function recipientName(org: Doc<"organizations"> | null) {
  return org?.name ?? "The recipient";
}

/** Record the completed transaction and fan out impact notifications. */
async function completeRedistribution(
  ctx: any,
  p: Doc<"pickupSchedules">,
  listing: Doc<"foodListings">,
  now: number,
) {
  const recipientOrg = await ctx.db.get(p.recipientOrgId);
  await ctx.db.insert("transactionHistory", {
    listingTitle: listing.title,
    category: listing.category,
    supplierOrgId: p.supplierOrgId,
    recipientOrgId: p.recipientOrgId,
    quantity: p.quantity,
    unit: p.unit,
    allocationId: p.allocationId,
    pickupId: p._id,
    completedAt: now,
  });
  // Allocation + application completed
  const alloc = await ctx.db.get(p.allocationId);
  if (alloc) {
    await ctx.db.patch(alloc._id, { status: "completed", updatedAt: now });
    if (alloc.applicationId) {
      const app = await ctx.db.get(alloc.applicationId);
      if (app) await ctx.db.patch(app._id, { status: "completed", updatedAt: now });
    }
  }
  // Listing completed when nothing remains and no other active allocations
  const remainingAllocs = (await ctx.db.query("allocations").withIndex("by_listing", (q: any) => q.eq("listingId", listing._id)).collect())
    .filter((a: any) => ["proposed", "approved"].includes(a.status));
  const isFullyAllocated = listing.status === "fully_allocated" || listing.quantityAvailable <= 0;
  if (isFullyAllocated && remainingAllocs.length === 0) {
    await ctx.db.patch(listing._id, { status: "completed", updatedAt: now });
  }

  await notifyOrg(ctx, p.recipientOrgId, {
    title: "Redistribution completed",
    body: `${p.quantity} ${p.unit} of ${listing.title} successfully redirected — thank you for confirming.`,
    type: "impact",
    link: "/impact",
  });
  await notifyOrg(ctx, p.supplierOrgId, {
    title: "Redistribution completed",
    body: `${p.quantity} ${p.unit} of ${listing.title} was successfully redistributed to ${recipientOrg?.name ?? "the recipient"}.`,
    type: "impact",
    link: "/impact",
  });
  // Admin visibility
  const admins = await ctx.db.query("users").collect();
  for (const a of admins) {
    if (a.role === "admin") {
      await notify(ctx, a._id, {
        title: "Redistribution completed",
        body: `${p.quantity} ${p.unit} of ${listing.title}: ${p.supplierOrgId === a.organizationId ? "" : ""}${listing.title} handoff confirmed.`,
        type: "impact",
        link: "/impact",
      });
    }
  }
}
