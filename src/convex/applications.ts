import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { analyzeCompatibility, distanceKm } from "./lib/matching";
import { notify, notifyOrg, fail, fromDateKeyTime, isFssaiVerified, maskFssai, fssaiTypeLabel } from "./lib/util";
import type { Doc, Id } from "./_generated/dataModel";

async function requireViewer(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) fail("You must be signed in to view this information.");
  const user = await ctx.db.get(userId);
  if (!user) fail("You must be signed in to view this information.");
  const org = user.organizationId ? await ctx.db.get(user.organizationId) : null;
  return { userId, user, org };
}

function publicApp(a: Doc<"foodApplications">) {
  // Recipients only ever see their own applications; suppliers see apps on their listings.
  return a;
}

/** Applications visible to the current viewer (role-aware). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { user, org } = await requireViewer(ctx);
    const rows = await ctx.db.query("foodApplications").order("desc").collect();

    let visible: Doc<"foodApplications">[];
    if (user.role === "admin") {
      visible = rows;
    } else if (org?.type === "supplier") {
      visible = rows.filter((a) => {
        // Supplier sees applications for their listings only.
        return a.listingId !== undefined; // filtered below with listing lookup
      });
      // Need listing lookup; do it via map
      const listingIds = new Set(
        (
          await ctx.db
            .query("foodListings")
            .withIndex("by_supplier", (q) => q.eq("supplierOrgId", org._id))
            .collect()
        ).map((l) => l._id),
      );
      visible = rows.filter((a) => listingIds.has(a.listingId));
    } else if (org?.type === "recipient") {
      visible = rows.filter((a) => a.recipientOrgId === org._id);
    } else {
      visible = [];
    }

    // enrich with listing + recipient org summary
    const enriched = [];
    for (const a of visible) {
      const listing = await ctx.db.get(a.listingId);
      const recipientOrg = await ctx.db.get(a.recipientOrgId);
      if (!listing || !recipientOrg) continue;
      enriched.push({
        ...a,
        listing: {
          _id: listing._id,
          title: listing.title,
          unit: listing.unit,
          quantityAvailable: listing.quantityAvailable,
          category: listing.category,
          photoUrl: listing.photoUrl,
          pickupDeadline: listing.pickupDeadline,
          supplierOrgId: listing.supplierOrgId,
        },
        recipientOrg: {
          _id: recipientOrg._id,
          name: recipientOrg.name,
          category: recipientOrg.category,
          address: recipientOrg.address,
          lat: recipientOrg.lat,
          lng: recipientOrg.lng,
          storageCapability: recipientOrg.storageCapability,
          coldChainCapability: recipientOrg.coldChainCapability,
          fssaiVerified: isFssaiVerified(recipientOrg),
          fssaiStatus: recipientOrg.fssaiVerificationStatus ?? null,
          fssaiTypeLabel: fssaiTypeLabel(recipientOrg.fssaiType),
          fssaiMasked: maskFssai(recipientOrg.fssaiNumber),
        },
      });
    }
    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** One application with AI analysis (authorized for supplier-of-listing / owner / admin). */
export const get = query({
  args: { id: v.id("foodApplications") },
  handler: async (ctx, { id }) => {
    const { user, org } = await requireViewer(ctx);
    const app = await ctx.db.get(id);
    if (!app) return null;
    const listing = await ctx.db.get(app.listingId);
    if (!listing) return null;
    const isOwnerApplicant = org && app.recipientOrgId === org._id;
    const isSupplier = org && listing.supplierOrgId === org._id;
    if (!isOwnerApplicant && !isSupplier && user.role !== "admin") return null;
    const recipientOrg = await ctx.db.get(app.recipientOrgId);
    const distance = org && recipientOrg ? distanceKm(listing, recipientOrg) : null;
    return { ...app, listing, recipientOrg, distanceKm: distance };
  },
});

/** Submit a new application (recipient only). AI evaluation runs immediately. */
export const submit = mutation({
  args: {
    listingId: v.id("foodListings"),
    requestedQuantity: v.number(),
    unit: v.optional(v.string()),
    intendedUse: v.string(),
    preferredPickupDate: v.string(),
    preferredPickupTime: v.string(),
    pickupCapability: v.string(),
    storageCapability: v.boolean(),
    coldChainCapability: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user, org } = await requireViewer(ctx);
    if (!org || org.type !== "recipient") fail("Only recipient organizations can apply for surplus food.");
    const listing = await ctx.db.get(args.listingId);
    if (!listing) fail("This listing is no longer available.");
    if (listing.status === "cancelled" || listing.status === "flagged") fail("This listing is not currently accepting applications.");
    if (args.requestedQuantity <= 0) fail("Requested quantity must be greater than zero.");
    if (args.requestedQuantity > listing.quantityAvailable) {
      fail(
        `Requested quantity exceeds the ${listing.quantityAvailable} ${listing.unit} currently available.`,
      );
    }
    // No duplicate active application from same org
    const existing = await ctx.db
      .query("foodApplications")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .collect();
    const dup = existing.find(
      (a) =>
        a.recipientOrgId === org._id &&
        !["rejected", "cancelled", "completed"].includes(a.status),
    );
    if (dup) fail("Your organization already has an active application for this listing.");

    const analysis = analyzeCompatibility(
      {
        title: listing.title,
        category: listing.category,
        foodType: listing.foodType,
        quantityAvailable: listing.quantityAvailable,
        unit: listing.unit,
        storageCondition: listing.storageCondition,
        coldChainRequired: listing.coldChainRequired,
        pickupDeadline: listing.pickupDeadline,
        preparedAt: listing.preparedAt,
        useBy: listing.useBy,
        bestBefore: listing.bestBefore,
        lat: listing.lat,
        lng: listing.lng,
      },
      {
        requestedQuantity: args.requestedQuantity,
        unit: args.unit ?? "kg",
        intendedUse: args.intendedUse,
        storageCapability: args.storageCapability,
        coldChainCapability: args.coldChainCapability,
        pickupCapability: args.pickupCapability,
        preferredPickupDate: args.preferredPickupDate,
        preferredPickupTime: args.preferredPickupTime,
      },
      {
        _id: org._id,
        name: org.name,
        type: "recipient",
        category: org.category,
        lat: org.lat,
        lng: org.lng,
        storageCapability: org.storageCapability ?? false,
        coldChainCapability: org.coldChainCapability ?? false,
        fssaiVerified: isFssaiVerified(org),
        fssaiApplicable: true,
      },
    );

    const now = Date.now();
    const id = await ctx.db.insert("foodApplications", {
      listingId: args.listingId,
      recipientOrgId: org._id,
      recipientUserId: userId,
      requestedQuantity: args.requestedQuantity,
      unit: args.unit ?? "kg",
      intendedUse: args.intendedUse,
      preferredPickupDate: args.preferredPickupDate,
      preferredPickupTime: args.preferredPickupTime,
      pickupCapability: args.pickupCapability,
      storageCapability: args.storageCapability,
      coldChainCapability: args.coldChainCapability,
      note: args.note,
      status: "ai_evaluated",
      aiScore: analysis.score,
      aiRecommendedQuantity: analysis.recommendedQuantity,
      aiReasons: analysis.reasons,
      aiWarnings: analysis.warnings,
      aiBreakdown: analysis.breakdown,
      aiEvaluatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Notify supplier org
    await notifyOrg(ctx, listing.supplierOrgId, {
      title: "New application received",
      body: `${org.name} applied for ${args.requestedQuantity} ${args.unit} of your ${listing.title}.`,
      type: "application",
      link: "/applications",
      relatedId: id,
    });

    return { id, analysis };
  },
});

/** Withdraw an application (recipient owner). */
export const withdraw = mutation({
  args: { id: v.id("foodApplications") },
  handler: async (ctx, { id }) => {
    const { user, org } = await requireViewer(ctx);
    const app = await ctx.db.get(id);
    if (!app) fail("Application not found.");
    if (org && app.recipientOrgId !== org._id && user.role !== "admin") fail("You can only withdraw your own applications.");
    if (["completed", "cancelled"].includes(app.status)) fail("This application is already closed.");
    await ctx.db.patch(id, { status: "cancelled", updatedAt: Date.now() });
    const listing = await ctx.db.get(app.listingId);
    if (listing) {
      await notifyOrg(ctx, listing.supplierOrgId, {
        title: "Application withdrawn",
        body: `An application for ${app.requestedQuantity} ${app.unit} of ${listing.title} was withdrawn.`,
        type: "application",
        link: "/applications",
      });
    }
    return id;
  },
});

/** Reject an application (supplier of the listing). */
export const reject = mutation({
  args: { id: v.id("foodApplications") },
  handler: async (ctx, { id }) => {
    const { user, org } = await requireViewer(ctx);
    const app = await ctx.db.get(id);
    if (!app) fail("Application not found.");
    const listing = await ctx.db.get(app.listingId);
    if (!listing) fail("Listing not found.");
    if (org && listing.supplierOrgId !== org._id && user.role !== "admin") fail("Only the supplier can reject applications.");
    await ctx.db.patch(id, { status: "rejected", updatedAt: Date.now() });
    await notify(ctx, app.recipientUserId, {
      title: "Application declined",
      body: `Your application for ${app.requestedQuantity} ${app.unit} ${listing.title} was declined by ${listing.supplierOrgId ? "the supplier" : "the supplier"}.`,
      type: "application",
      link: "/applications",
    });
    return id;
  },
});

/** Run AI analysis preview without submitting (for the apply dialog). */
export const previewAnalysis = query({
  args: {
    listingId: v.id("foodListings"),
    requestedQuantity: v.number(),
    intendedUse: v.string(),
    preferredPickupDate: v.optional(v.string()),
    preferredPickupTime: v.optional(v.string()),
    storageCapability: v.boolean(),
    coldChainCapability: v.boolean(),
    pickupCapability: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org } = await requireViewer(ctx);
    if (!org) fail("Sign in required.");
    const listing = await ctx.db.get(args.listingId);
    if (!listing) return null;
    const analysis = analyzeCompatibility(
      {
        title: listing.title,
        category: listing.category,
        foodType: listing.foodType,
        quantityAvailable: listing.quantityAvailable,
        unit: listing.unit,
        storageCondition: listing.storageCondition,
        coldChainRequired: listing.coldChainRequired,
        pickupDeadline: listing.pickupDeadline,
        preparedAt: listing.preparedAt,
        useBy: listing.useBy,
        bestBefore: listing.bestBefore,
        lat: listing.lat,
        lng: listing.lng,
      },
      {
        requestedQuantity: args.requestedQuantity,
        unit: "kg",
        intendedUse: args.intendedUse || "community distribution",
        storageCapability: args.storageCapability,
        coldChainCapability: args.coldChainCapability,
        pickupCapability: args.pickupCapability || "Pickup in person",
        preferredPickupDate: args.preferredPickupDate,
        preferredPickupTime: args.preferredPickupTime,
      },
      {
        _id: org._id,
        name: org.name,
        type: "recipient",
        category: org.category,
        lat: org.lat,
        lng: org.lng,
        storageCapability: org.storageCapability ?? false,
        coldChainCapability: org.coldChainCapability ?? false,
        fssaiVerified: isFssaiVerified(org),
        fssaiApplicable: true,
      },
    );
    return { analysis, distanceKm: distanceKm(listing, org) };
  },
});
