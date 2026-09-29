import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { safetyCompleteness, computeUrgency, notify, notifyOrg, fail } from "./lib/util";
import { distanceKm } from "./lib/matching";
import type { Id } from "./_generated/dataModel";

async function requireViewer(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) fail("You must be signed in to view this information.");
  const user = await ctx.db.get(userId);
  if (!user) fail("You must be signed in to view this information.");
  const org = user.organizationId ? await ctx.db.get(user.organizationId) : null;
  return { userId, user, org };
}

/** Distance from an arbitrary point — used by "nearby" sorting on the client. */
export const nearby = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireViewer(ctx);
    return { lat: user.lat ?? 52.48, lng: user.lng ?? -1.9 };
  },
});

function enrichListing(l: any, myOrgId?: Id<"organizations">) {
  const now = Date.now();
  const safety = safetyCompleteness(l);
  return {
    ...l,
    urgency: computeUrgency(l, now),
    safetyStatus: l.safetyStatus ?? safety.status,
    safetyMissing: safety.missing,
    isMine: myOrgId ? l.supplierOrgId === myOrgId : false,
  };
}

/** All visible listings (available + partially allocated) with derived fields. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { org } = await requireViewer(ctx);
    const rows = await ctx.db.query("foodListings").order("desc").collect();
    const visible = rows.filter((l) => l.status !== "cancelled");
    return visible.map((l) => enrichListing(l, org?._id));
  },
});

/** One listing with supplier info and allocation totals. */
export const get = query({
  args: { id: v.id("foodListings") },
  handler: async (ctx, { id }) => {
    const { org } = await requireViewer(ctx);
    const listing = await ctx.db.get(id);
    if (!listing) return null;
    const supplier = await ctx.db.get(listing.supplierOrgId);
    const allocations = await ctx.db
      .query("allocations")
      .withIndex("by_listing", (q) => q.eq("listingId", id))
      .collect();
    const active = allocations.filter((a) => a.status === "proposed" || a.status === "approved" || a.status === "completed");
    const allocatedQty = active.reduce((s, a) => s + a.quantity, 0);
    const safety = safetyCompleteness(listing);
    return {
      ...enrichListing(listing, org?._id),
      supplier: supplier
        ? {
            _id: supplier._id,
            name: supplier.name,
            category: supplier.category,
            address: supplier.address,
            lat: supplier.lat,
            lng: supplier.lng,
            contactPhone: supplier.contactPhone,
          }
        : null,
      allocatedQty,
      remainingQty: Math.max(0, listing.quantityAvailable),
      distanceKm: org && supplier ? distanceKm(org, supplier) : null,
    };
  },
});

/** Create a listing (supplier only). */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    foodType: v.string(),
    quantity: v.number(),
    unit: v.string(),
    photoUrl: v.optional(v.string()),
    photoIsUpload: v.boolean(),
    preparedAt: v.optional(v.number()),
    bestBefore: v.optional(v.number()),
    useBy: v.optional(v.number()),
    storageCondition: v.string(),
    temperatureNote: v.optional(v.string()),
    coldChainRequired: v.boolean(),
    pickupDeadline: v.number(),
    handlingInstructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user, org } = await requireViewer(ctx);
    if (!org || org.type !== "supplier") fail("Only supplier organizations can list surplus food.");
    if (args.quantity <= 0) fail("Quantity must be greater than zero.");
    const now = Date.now();
    if (args.pickupDeadline <= now) fail("The pickup deadline must be in the future.");

    const id = await ctx.db.insert("foodListings", {
      supplierOrgId: org._id,
      supplierUserId: userId,
      title: args.title,
      description: args.description,
      category: args.category as any,
      foodType: args.foodType as any,
      quantityAvailable: args.quantity,
      quantityOriginal: args.quantity,
      unit: args.unit,
      photoUrl: args.photoUrl,
      photoIsUpload: args.photoIsUpload,
      preparedAt: args.preparedAt,
      bestBefore: args.bestBefore,
      useBy: args.useBy,
      storageCondition: args.storageCondition as any,
      temperatureNote: args.temperatureNote,
      coldChainRequired: args.coldChainRequired,
      pickupDeadline: args.pickupDeadline,
      handlingInstructions: args.handlingInstructions,
      address: org.address,
      lat: org.lat,
      lng: org.lng,
      status: "available",
      safetyStatus: "complete",
      flagged: false,
      createdAt: now,
      updatedAt: now,
    });

    // Notify recipient orgs about the new listing
    const recipients = await ctx.db.query("organizations").withIndex("by_type", (q) => q.eq("type", "recipient")).collect();
    for (const r of recipients) {
      await notifyOrg(ctx, r._id, {
        title: "New surplus near you",
        body: `${org.name} just listed ${args.quantity} ${args.unit} of ${args.title}.`,
        type: "listing",
        link: "/surplus",
        relatedId: id,
      }, userId);
    }

    return id;
  },
});

/** Update a listing (owner or admin). */
export const update = mutation({
  args: {
    id: v.id("foodListings"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    quantity: v.optional(v.number()),
    photoUrl: v.optional(v.string()),
    handlingInstructions: v.optional(v.string()),
    pickupDeadline: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const { user, org } = await requireViewer(ctx);
    const listing = await ctx.db.get(id);
    if (!listing) fail("Listing not found.");
    const isOwner = org && listing.supplierOrgId === org._id;
    const isAdmin = user.role === "admin";
    if (!isOwner && !isAdmin) fail("You can only edit your own listings.");
    const now = Date.now();
    await ctx.db.patch(id, { ...patch, updatedAt: now });
    return id;
  },
});

/** Cancel a listing (owner or admin). */
export const cancel = mutation({
  args: { id: v.id("foodListings") },
  handler: async (ctx, { id }) => {
    const { user, org } = await requireViewer(ctx);
    const listing = await ctx.db.get(id);
    if (!listing) fail("Listing not found.");
    const isOwner = org && listing.supplierOrgId === org._id;
    if (!isOwner && user.role !== "admin") fail("You can only cancel your own listings.");
    await ctx.db.patch(id, { status: "cancelled", updatedAt: Date.now() });
    // cancel pending applications + allocations
    const apps = await ctx.db.query("foodApplications").withIndex("by_listing", (q) => q.eq("listingId", id)).collect();
    for (const a of apps) {
      if (a.status !== "completed" && a.status !== "rejected") {
        await ctx.db.patch(a._id, { status: "cancelled", updatedAt: Date.now() });
        await notify(ctx, a.recipientUserId, {
          title: "Listing cancelled",
          body: `${listing.title} was cancelled by the supplier. Your application is no longer active.`,
          type: "listing",
          link: "/surplus",
        });
      }
    }
    const allocs = await ctx.db.query("allocations").withIndex("by_listing", (q) => q.eq("listingId", id)).collect();
    for (const a of allocs) {
      if (a.status === "proposed" || a.status === "approved") {
        await ctx.db.patch(a._id, { status: "cancelled", updatedAt: Date.now() });
      }
    }
    const pickups = await ctx.db.query("pickupSchedules").withIndex("by_supplier", (q: any) => q.eq("supplierOrgId", listing.supplierOrgId)).collect();
    for (const p of pickups.filter((x: any) => x.listingId === id)) {
      if (p.status !== "completed" && p.status !== "cancelled") {
        await ctx.db.patch(p._id, { status: "cancelled", updatedAt: Date.now() });
        await notifyOrg(ctx, p.recipientOrgId, {
          title: "Pickup cancelled",
          body: `The pickup of ${listing.title} was cancelled because the listing was withdrawn.`,
          type: "pickup",
          link: "/pickups",
        });
        await notifyOrg(ctx, p.supplierOrgId, {
          title: "Pickup cancelled",
          body: `The pickup of ${listing.title} was cancelled because the listing was withdrawn.`,
          type: "pickup",
          link: "/pickups",
        });
      }
    }
    return id;
  },
});

/** Flag a listing (admin only). */
export const flag = mutation({
  args: { id: v.id("foodListings"), reason: v.string() },
  handler: async (ctx, { id, reason }) => {
    const { user } = await requireViewer(ctx);
    if (user.role !== "admin") fail("Only admins can flag listings.");
    const listing = await ctx.db.get(id);
    if (!listing) fail("Listing not found.");
    await ctx.db.patch(id, { flagged: true, flagReason: reason, status: "flagged", updatedAt: Date.now() });
    await notifyOrg(ctx, listing.supplierOrgId, {
      title: "Listing flagged for review",
      body: `Your listing "${listing.title}" was flagged by administration: ${reason}`,
      type: "system",
      link: "/surplus",
    });
    return id;
  },
});

/** Unflag / restore a listing (admin only). */
export const unflag = mutation({
  args: { id: v.id("foodListings") },
  handler: async (ctx, { id }) => {
    const { user } = await requireViewer(ctx);
    if (user.role !== "admin") fail("Only admins can restore listings.");
    await ctx.db.patch(id, { flagged: false, flagReason: undefined, status: "available", updatedAt: Date.now() });
    return id;
  },
});

/** Upload/replace the photo (owner supplier or admin). */
export const setPhoto = mutation({
  args: { id: v.id("foodListings"), photoUrl: v.string(), photoIsUpload: v.boolean() },
  handler: async (ctx, { id, photoUrl, photoIsUpload }) => {
    const { user, org } = await requireViewer(ctx);
    const listing = await ctx.db.get(id);
    if (!listing) fail("Listing not found.");
    const isOwner = org && listing.supplierOrgId === org._id;
    if (!isOwner && user.role !== "admin") fail("You can only update your own listings.");
    await ctx.db.patch(id, { photoUrl, photoIsUpload, updatedAt: Date.now() });
    return id;
  },
});
