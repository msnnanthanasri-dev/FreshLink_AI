import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { notify, notifyOrg, fail, friendlyDate, friendlyTime, isFssaiVerified } from "./lib/util";
import type { Doc, Id } from "./_generated/dataModel";

const OTP_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours
const MAX_OTP_ATTEMPTS = 5;

function makeOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

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
      const { handoverOtp, otpCreatedAt, otpVerifiedAt, otpAttempts, ...safe } = p;
      out.push({
        ...safe,
        otpIssued: !!handoverOtp,
        otpIssuedAt: otpCreatedAt ?? null,
        otpVerifiedAt: otpVerifiedAt ?? null,
        otpAttempts: otpAttempts ?? 0,
        // The code itself is only ever returned to the recipient side (see `get`).
        handoverOtp: org?._id === p.recipientOrgId ? (handoverOtp ?? null) : null,
        listing: { _id: listing._id, title: listing.title, category: listing.category, photoUrl: listing.photoUrl, storageCondition: listing.storageCondition, coldChainRequired: listing.coldChainRequired, handlingInstructions: listing.handlingInstructions },
        supplierOrg: { _id: supplierOrg._id, name: supplierOrg.name, address: supplierOrg.address, lat: supplierOrg.lat, lng: supplierOrg.lng, contactPhone: supplierOrg.contactPhone, fssaiVerified: isFssaiVerified(supplierOrg), fssaiStatus: supplierOrg.fssaiVerificationStatus ?? null },
        recipientOrg: { _id: recipientOrg._id, name: recipientOrg.name, address: recipientOrg.address, lat: recipientOrg.lat, lng: recipientOrg.lng, contactPhone: recipientOrg.contactPhone, fssaiVerified: isFssaiVerified(recipientOrg), fssaiStatus: recipientOrg.fssaiVerificationStatus ?? null },
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
    const { handoverOtp, otpCreatedAt, otpAttempts, ...safe } = p;
    return {
      ...safe,
      otpIssued: !!handoverOtp,
      otpIssuedAt: otpCreatedAt ?? null,
      otpAttempts: otpAttempts ?? 0,
      // Only the collecting organization can read the code — the supplier must be told it in person.
      handoverOtp: org?._id === p.recipientOrgId ? (handoverOtp ?? null) : null,
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
      await ctx.db.patch(id, { status: "ready", readyAt: p.readyAt ?? now, updatedAt: now });
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
      fail("Handover must be confirmed with the one-time code the recipient shared with you.");
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

/**
 * Recipient issues the 6-digit handover code once the supplier has marked the food ready.
 * The supplier reads it out at collection and enters it to confirm the handoff.
 */
export const generateOtp = mutation({
  args: { id: v.id("pickupSchedules") },
  handler: async (ctx, { id }) => {
    const { user, org } = await requireViewer(ctx);
    const p = await ctx.db.get(id);
    if (!p) fail("Pickup not found.");
    const isRecipientSide = !!org && p.recipientOrgId === org._id;
    const isAdmin = user.role === "admin";
    if (!isRecipientSide && !isAdmin) fail("Only the collecting organization can generate the handover code.");
    if (["completed", "cancelled"].includes(p.status)) fail("This pickup is already closed.");
    if (p.status === "scheduled") {
      fail("Wait for the supplier to mark the food ready before issuing the handover code.");
    }
    const listing = await ctx.db.get(p.listingId);
    const supplierOrg = await ctx.db.get(p.supplierOrgId);
    if (!listing || !supplierOrg) fail("Pickup details are incomplete.");

    const now = Date.now();
    const code = makeOtp();
    await ctx.db.patch(id, { handoverOtp: code, otpCreatedAt: now, otpAttempts: 0, updatedAt: now });
    await notifyOrg(ctx, p.supplierOrgId, {
      title: "Handover code ready",
      body: `A handover code was issued for ${listing.title}. Ask the recipient for the 6-digit code and enter it at collection to confirm the handoff.`,
      type: "pickup",
      link: "/pickups",
    });
    return { ok: true, otp: code };
  },
});

/** Supplier enters the code the recipient shared → handoff confirmed (picked_up). */
export const verifyHandover = mutation({
  args: { id: v.id("pickupSchedules"), otp: v.string() },
  handler: async (ctx, { id, otp }) => {
    const { user, org } = await requireViewer(ctx);
    const p = await ctx.db.get(id);
    if (!p) fail("Pickup not found.");
    const listing = await ctx.db.get(p.listingId);
    if (!listing) fail("Listing not found.");
    const isSupplierSide = !!org && p.supplierOrgId === org._id;
    const isAdmin = user.role === "admin";
    if (!isSupplierSide && !isAdmin) fail("Only the supplier can confirm the handover.");
    if (p.status === "picked_up" || p.status === "completed") fail("This pickup has already been handed over.");
    if (!["ready", "on_the_way"].includes(p.status)) {
      fail("The food must be marked ready before the handover can be confirmed.");
    }
    const now = Date.now();
    if (!p.handoverOtp) {
      fail("No handover code has been issued yet. Ask the recipient to generate one on the pickup page.");
    }
    if (p.otpCreatedAt && now - p.otpCreatedAt > OTP_TTL_MS) {
      fail("This code has expired. Ask the recipient to generate a new one.");
    }
    const attempts = (p.otpAttempts ?? 0) + 1;
    const entered = otp.replace(/\D/g, "");
    if (entered.length !== 6) {
      await ctx.db.patch(id, { otpAttempts: attempts, updatedAt: now });
      fail("Enter the 6-digit code exactly as shown by the recipient.");
    }
    if (entered !== p.handoverOtp) {
      await ctx.db.patch(id, { otpAttempts: attempts, updatedAt: now });
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await ctx.db.patch(id, { handoverOtp: undefined, otpCreatedAt: undefined, otpAttempts: 0, updatedAt: now });
        await notifyOrg(ctx, p.recipientOrgId, {
          title: "New pickup code needed",
          body: `Too many incorrect entries for ${listing.title}. Generate a fresh handover code.`,
          type: "pickup",
          link: "/pickups",
        });
        fail("Too many incorrect entries. The code has been cleared — ask the recipient for a new one.");
      }
      fail(`Incorrect code. ${MAX_OTP_ATTEMPTS - attempts} attempt${MAX_OTP_ATTEMPTS - attempts === 1 ? "" : "s"} remaining.`);
    }

    await ctx.db.patch(id, {
      status: "picked_up",
      handedOverAt: now,
      otpVerifiedAt: now,
      otpAttempts: attempts,
      handoverOtp: undefined,
      otpCreatedAt: undefined,
      updatedAt: now,
    });
    await notifyOrg(ctx, p.recipientOrgId, {
      title: "Handover verified",
      body: `${listing.title} was collected and the handover code matched. Please confirm pickup received to complete this redistribution.`,
      type: "pickup",
      link: "/pickups",
    });
    return { ok: true };
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
