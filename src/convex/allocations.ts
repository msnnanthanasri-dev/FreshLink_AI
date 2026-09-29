import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { analyzeCompatibility, proposeAllocation } from "./lib/matching";
import { notify, notifyOrg, fail, toDateKey, friendlyDate, friendlyTime, isFssaiVerified, maskFssai } from "./lib/util";
import type { Doc, Id } from "./_generated/dataModel";

async function requireViewer(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) fail("You must be signed in to view this information.");
  const user = await ctx.db.get(userId);
  if (!user) fail("You must be signed in to view this information.");
  const org = user.organizationId ? await ctx.db.get(user.organizationId) : null;
  return { userId, user, org };
}

/** Allocations visible to the viewer (role-aware) with listing + org summaries. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { user, org } = await requireViewer(ctx);
    const rows = await ctx.db.query("allocations").order("desc").collect();
    let visible: Doc<"allocations">[];
    if (user.role === "admin") visible = rows;
    else if (org?.type === "supplier") visible = rows.filter((a) => a.supplierOrgId === org._id);
    else if (org?.type === "recipient") visible = rows.filter((a) => a.recipientOrgId === org._id);
    else visible = [];

    const out = [];
    for (const a of visible) {
      const listing = await ctx.db.get(a.listingId);
      const supplierOrg = await ctx.db.get(a.supplierOrgId);
      const recipientOrg = await ctx.db.get(a.recipientOrgId);
      if (!listing || !supplierOrg || !recipientOrg) continue;
      const pickup = await ctx.db
        .query("pickupSchedules")
        .withIndex("by_allocation", (q) => q.eq("allocationId", a._id))
        .first();
      out.push({
        ...a,
        listing: {
          _id: listing._id,
          title: listing.title,
          unit: listing.unit,
          category: listing.category,
          photoUrl: listing.photoUrl,
          quantityOriginal: listing.quantityOriginal,
        },
        supplierOrg: { _id: supplierOrg._id, name: supplierOrg.name, address: supplierOrg.address, lat: supplierOrg.lat, lng: supplierOrg.lng, fssaiVerified: isFssaiVerified(supplierOrg), fssaiMasked: maskFssai(supplierOrg.fssaiNumber) },
        recipientOrg: { _id: recipientOrg._id, name: recipientOrg.name, address: recipientOrg.address, lat: recipientOrg.lat, lng: recipientOrg.lng, fssaiVerified: isFssaiVerified(recipientOrg), fssaiMasked: maskFssai(recipientOrg.fssaiNumber) },
        pickup: pickup ? { _id: pickup._id, status: pickup.status, scheduledDate: pickup.scheduledDate, scheduledTime: pickup.scheduledTime } : null,
      });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Full detail for one allocation including applications and pickup. */
export const get = query({
  args: { id: v.id("allocations") },
  handler: async (ctx, { id }) => {
    const { user, org } = await requireViewer(ctx);
    const a = await ctx.db.get(id);
    if (!a) return null;
    if (org && a.supplierOrgId !== org._id && a.recipientOrgId !== org._id && user.role !== "admin") return null;
    const listing = await ctx.db.get(a.listingId);
    const supplierOrg = await ctx.db.get(a.supplierOrgId);
    const recipientOrg = await ctx.db.get(a.recipientOrgId);
    if (!listing || !supplierOrg || !recipientOrg) return null;
    const pickup = await ctx.db
      .query("pickupSchedules")
      .withIndex("by_allocation", (q) => q.eq("allocationId", id))
      .first();
    return {
      ...a,
      listing,
      supplierOrg,
      recipientOrg,
      pickup: pickup ?? null,
    };
  },
});

/**
 * Generate the AI allocation proposal for one listing from its evaluated
 * applications (supplier or admin action). Creates 'proposed' allocations.
 */
export const propose = mutation({
  args: { listingId: v.id("foodListings") },
  handler: async (ctx, { listingId }) => {
    const { user, org } = await requireViewer(ctx);
    const listing = await ctx.db.get(listingId);
    if (!listing) fail("Listing not found.");
    if (org && listing.supplierOrgId !== org._id && user.role !== "admin")
      fail("Only the supplier can generate an allocation proposal for their listing.");

    const apps = await ctx.db
      .query("foodApplications")
      .withIndex("by_listing", (q) => q.eq("listingId", listingId))
      .collect();
    const eligible = apps.filter((a) =>
      ["submitted", "under_review", "ai_evaluated"].includes(a.status),
    );
    if (eligible.length === 0) fail("There are no pending applications to allocate for this listing.");

    const analyzed = [];
    for (const a of eligible) {
      const recipientOrg = await ctx.db.get(a.recipientOrgId);
      if (!recipientOrg) continue;
      analyzed.push({
        applicationId: a._id,
        recipientName: recipientOrg.name,
        requestedQuantity: a.requestedQuantity,
        score: a.aiScore ?? 50,
        recommendedQuantity: a.aiRecommendedQuantity ?? Math.min(a.requestedQuantity, listing.quantityAvailable),
      });
    }

    // Remove stale proposals for the same applications
    for (const a of analyzed) {
      const stale = await ctx.db
        .query("allocations")
        .withIndex("by_application", (q) => q.eq("applicationId", a.applicationId))
        .collect();
      for (const s of stale) {
        if (s.status === "proposed") await ctx.db.delete(s._id);
      }
    }

    const proposal = proposeAllocation(analyzed, listing.quantityAvailable);
    if (proposal.length === 0) fail("No allocation could be proposed from the pending applications.");

    const created = [];
    for (const p of proposal) {
      const app = await ctx.db.get(p.applicationId as Id<"foodApplications">);
      if (!app) continue;
      const id = await ctx.db.insert("allocations", {
        listingId,
        applicationId: app._id,
        supplierOrgId: listing.supplierOrgId,
        recipientOrgId: app.recipientOrgId,
        quantity: p.quantity,
        unit: listing.unit,
        status: "proposed",
        pickupDate: app.preferredPickupDate ?? toDateKey(Date.now() + 24 * 3_600_000),
        pickupTime: app.preferredPickupTime ?? "12:00",
        reason: p.shareReason,
        proposedBy: "ai",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      created.push(id);
    }

    await notifyOrg(ctx, listing.supplierOrgId, {
      title: "AI allocation proposal ready",
      body: `Review the proposed allocation for your ${listing.title} listing.`,
      type: "allocation",
      link: "/allocations",
    });

    return created;
  },
});

/**
 * Supplier approves one allocation (with optional quantity modification).
 * Creates the pickup schedule and notifies both sides.
 */
export const approve = mutation({
  args: { id: v.id("allocations"), quantity: v.optional(v.number()) },
  handler: async (ctx, { id, quantity }) => {
    const { user, org } = await requireViewer(ctx);
    const a = await ctx.db.get(id);
    if (!a) fail("Allocation not found.");
    const listing = await ctx.db.get(a.listingId);
    if (!listing) fail("Listing not found.");
    if (org && a.supplierOrgId !== org._id && user.role !== "admin")
      fail("Only the supplier can approve allocations.");
    if (a.status !== "proposed") fail("Only proposed allocations can be approved.");

    const now = Date.now();
    const finalQty = quantity !== undefined && quantity > 0 ? quantity : a.quantity;
    if (finalQty > listing.quantityAvailable) {
      fail(`Only ${listing.quantityAvailable} ${listing.unit} remain available on this listing.`);
    }

    await ctx.db.patch(id, {
      quantity: finalQty,
      status: "approved",
      pickupDate: a.pickupDate ?? toDateKey(now + 24 * 3_600_000),
      pickupTime: a.pickupTime ?? "12:00",
      updatedAt: now,
    });

    // Update listing availability
    const newAvail = Math.max(0, listing.quantityAvailable - finalQty);
    await ctx.db.patch(listing._id, {
      quantityAvailable: newAvail,
      status: newAvail <= 0 ? "fully_allocated" : "partially_allocated",
      updatedAt: now,
    });

    // Update application status
    if (a.applicationId) {
      const app = await ctx.db.get(a.applicationId);
      if (app) {
        await ctx.db.patch(app._id, {
          status: finalQty < app.requestedQuantity ? "partially_approved" : "approved",
          updatedAt: now,
        });
      }
    }

    // Create pickup schedule
    const supplierOrg = await ctx.db.get(a.supplierOrgId);
    const recipientOrg = await ctx.db.get(a.recipientOrgId);
    const pickupId = await ctx.db.insert("pickupSchedules", {
      allocationId: id,
      listingId: a.listingId,
      supplierOrgId: a.supplierOrgId,
      recipientOrgId: a.recipientOrgId,
      scheduledDate: a.pickupDate ?? toDateKey(now + 24 * 3_600_000),
      scheduledTime: a.pickupTime ?? "12:00",
      pickupLocation: supplierOrg ? `${supplierOrg.name} — ${supplierOrg.address}` : "Supplier location",
      quantity: finalQty,
      unit: a.unit,
      status: "scheduled",
      supplierContact: supplierOrg?.contactPhone ?? undefined,
      recipientContact: recipientOrg?.contactPhone ?? undefined,
      specialInstructions: listing.handlingInstructions ?? undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Notifications to both sides
    const when = `${friendlyDate(a.pickupDate ?? toDateKey(now + 24 * 3_600_000))} at ${friendlyTime(a.pickupTime ?? "12:00")}`;
    await notifyOrg(ctx, a.recipientOrgId, {
      title: "Application approved",
      body: `Your application for ${finalQty} ${a.unit} of ${listing.title} has been approved. Pickup is scheduled for ${when}.`,
      type: "allocation",
      link: "/pickups",
      relatedId: id,
    });
    await notifyOrg(ctx, a.supplierOrgId, {
      title: "Pickup scheduled",
      body: `${recipientOrg?.name ?? "The recipient"} will collect ${finalQty} ${a.unit} of ${listing.title} ${when}.`,
      type: "pickup",
      link: "/pickups",
      relatedId: id,
    }, user._id);

    return { allocationId: id, pickupId };
  },
});

/** Supplier modifies a proposed allocation quantity before approving. */
export const modify = mutation({
  args: { id: v.id("allocations"), quantity: v.number() },
  handler: async (ctx, { id, quantity }) => {
    const { user, org } = await requireViewer(ctx);
    const a = await ctx.db.get(id);
    if (!a) fail("Allocation not found.");
    const listing = await ctx.db.get(a.listingId);
    if (!listing) fail("Listing not found.");
    if (org && a.supplierOrgId !== org._id && user.role !== "admin") fail("Only the supplier can modify allocations.");
    if (a.status !== "proposed") fail("Only proposed allocations can be modified.");
    if (quantity <= 0) fail("Quantity must be greater than zero.");
    const active = await ctx.db.query("allocations").withIndex("by_listing", (q) => q.eq("listingId", a.listingId)).collect();
    const others = active.filter((x) => x._id !== id && ["proposed", "approved"].includes(x.status));
    const othersQty = others.reduce((s, x) => s + x.quantity, 0);
    if (othersQty + quantity > listing.quantityOriginal) {
      fail(`Total allocations (${othersQty + quantity} ${a.unit}) would exceed the original ${listing.quantityOriginal} ${listing.unit}.`);
    }
    await ctx.db.patch(id, { quantity, reason: (a.reason ? a.reason + " " : "") + "[Modified by supplier]", proposedBy: "supplier", updatedAt: Date.now() });
    if (a.applicationId) {
      const app = await ctx.db.get(a.applicationId);
      if (app && app.recipientUserId) {
        await notify(ctx, app.recipientUserId, {
          title: "Your allocation has been updated",
          body: `The proposed quantity for ${listing.title} was adjusted to ${quantity} ${a.unit} by the supplier.`,
          type: "allocation",
          link: "/allocations",
        });
      }
    }
    return id;
  },
});

/** Supplier rejects a proposed allocation. */
export const reject = mutation({
  args: { id: v.id("allocations") },
  handler: async (ctx, { id }) => {
    const { user, org } = await requireViewer(ctx);
    const a = await ctx.db.get(id);
    if (!a) fail("Allocation not found.");
    if (org && a.supplierOrgId !== org._id && user.role !== "admin") fail("Only the supplier can reject allocations.");
    if (a.status !== "proposed") fail("Only proposed allocations can be rejected.");
    await ctx.db.patch(id, { status: "rejected", updatedAt: Date.now() });
    if (a.applicationId) {
      const app = await ctx.db.get(a.applicationId);
      if (app) {
        await ctx.db.patch(app._id, { status: "rejected", updatedAt: Date.now() });
        await notify(ctx, app.recipientUserId, {
          title: "Application declined",
          body: `The proposed allocation for ${a.quantity} ${a.unit} was not approved by the supplier.`,
          type: "allocation",
          link: "/applications",
        });
      }
    }
    return id;
  },
});
