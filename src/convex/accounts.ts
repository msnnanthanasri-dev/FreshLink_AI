import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { fail, validateFssai, normalizeFssai } from "./lib/util";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

async function requireViewer(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) fail("You must be signed in.");
  const user = await ctx.db.get(userId);
  if (!user) fail("You must be signed in.");
  return { userId, user };
}

/**
 * Called right after auth signUp/signIn. On first login for a new account it
 * creates the organization; on demo accounts it refreshes nothing (no-op when
 * an organizationId already exists).
 */
export const registerProfile = mutation({
  args: {
    name: v.string(),
    organizationName: v.string(),
    role: v.string(),
    phone: v.string(),
    location: v.string(),
    category: v.optional(v.string()),
    storageCapability: v.optional(v.boolean()),
    coldChainCapability: v.optional(v.boolean()),
    // FSSAI compliance (submitted at registration)
    fssaiNumber: v.optional(v.string()),
    fssaiCertificateUrl: v.optional(v.string()),
    fssaiCertificateName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireViewer(ctx);

    // Already has an organization → nothing to do.
    if (user.organizationId) return { ok: true, created: false };

    const role = args.role === "supplier" || args.role === "recipient" ? (args.role as "supplier" | "recipient") : "recipient";
    const now = Date.now();

    // FSSAI is required for suppliers; for recipients it applies when the org
    // conducts applicable food-business activities (they opted in at registration).
    let fssaiFields: Record<string, any> = {};
    if (args.fssaiNumber) {
      const v = validateFssai(args.fssaiNumber);
      if (!v.ok) fail(v.error);
      // Unique number across the network
      const dup = await ctx.db
        .query("organizations")
        .withIndex("by_fssai", (q: any) => q.eq("fssaiNumber", normalizeFssai(args.fssaiNumber!)))
        .first();
      if (dup) fail("An organization with this FSSAI License / Registration Number already exists. Please verify the information or contact support.");
      fssaiFields = {
        fssaiNumber: normalizeFssai(args.fssaiNumber),
        fssaiType: v.type,
        fssaiCertificateUrl: args.fssaiCertificateUrl,
        fssaiCertificateName: args.fssaiCertificateName,
        fssaiCertificateUploadedAt: args.fssaiCertificateUrl ? now : undefined,
        fssaiVerificationStatus: "PENDING" as const,
        fssaiSubmittedAt: now,
      };
    } else if (role === "supplier") {
      fail("FSSAI License / Registration Number is required for suppliers.");
    }

    const orgId = await ctx.db.insert("organizations", {
      name: args.organizationName || `${args.name || "New"} Organization`,
      type: role,
      category: args.category || (role === "supplier" ? "Food Business" : "Community Organization"),
      address: args.location || "Location not set",
      lat: 52.4794 + (Math.random() - 0.5) * 0.05,
      lng: -1.8994 + (Math.random() - 0.5) * 0.05,
      contactName: args.name,
      contactPhone: args.phone || undefined,
      storageCapability: args.storageCapability ?? true,
      coldChainCapability: args.coldChainCapability ?? false,
      pickupCapability: "Pickup in person",
      ...fssaiFields,
      createdAt: now,
    });

    await ctx.db.patch(userId, {
      name: args.name || user.name,
      role,
      organizationId: orgId,
      phone: args.phone || user.phone,
      locationName: args.location || user.locationName,
      lat: 52.4794,
      lng: -1.8994,
    });

    return { ok: true, created: true };
  },
});

/** Update the signed-in user's own organization profile. */
export const updateMyOrganization = mutation({
  args: {
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    storageCapability: v.optional(v.boolean()),
    coldChainCapability: v.optional(v.boolean()),
    pickupCapability: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: updateMyOrganizationHandler,
});

async function updateMyOrganizationHandler(ctx: any, args: any) {
  const { user } = await requireViewer(ctx);
  if (!user.organizationId) fail("No organization linked to this account.");
  const org = await ctx.db.get(user.organizationId);
  if (!org) fail("Organization not found.");
  const { name, ...rest } = args;
  const patch: Record<string, any> = { ...rest };
  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k];
  await ctx.db.patch(org._id, patch);
  if (name) await ctx.db.patch(user._id, { name });
  return org._id;
}

/* ---------------- FSSAI compliance mutations ---------------- */

/**
 * Create or update the signed-in org's FSSAI details (Settings → Compliance & Trust).
 * Changing the number (or replacing the certificate) resets VERIFIED → PENDING so
 * the new submission can be re-verified by the admin.
 */
export const updateFssai = mutation({
  args: {
    fssaiNumber: v.string(),
    fssaiCertificateUrl: v.optional(v.string()),
    fssaiCertificateName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireViewer(ctx);
    if (!user.organizationId) fail("No organization linked to this account.");
    if (user.role === "admin") fail("Platform administration organizations do not hold FSSAI compliance records.");
    const org = (await ctx.db.get(user.organizationId)) as Doc<"organizations"> | null;
    if (!org) fail("Organization not found.");

    const v = validateFssai(args.fssaiNumber);
    if (!v.ok) fail(v.error);
    const num = normalizeFssai(args.fssaiNumber);

    const dup = await ctx.db
      .query("organizations")
      .withIndex("by_fssai", (q: any) => q.eq("fssaiNumber", num))
      .first();
    if (dup && dup._id !== org._id) {
      fail("An organization with this FSSAI License / Registration Number already exists. Please verify the information or contact support.");
    }

    const now = Date.now();
    const numberChanged = org.fssaiNumber !== num;
    const certChanged = args.fssaiCertificateUrl !== undefined && args.fssaiCertificateUrl !== org.fssaiCertificateUrl;
    const reset = numberChanged || certChanged;

    await ctx.db.patch(org._id, {
      fssaiNumber: num,
      fssaiType: v.type,
      fssaiCertificateUrl: args.fssaiCertificateUrl ?? org.fssaiCertificateUrl,
      fssaiCertificateName: args.fssaiCertificateName ?? org.fssaiCertificateName,
      fssaiCertificateUploadedAt: certChanged ? now : org.fssaiCertificateUploadedAt,
      fssaiVerificationStatus: reset ? "PENDING" : org.fssaiVerificationStatus ?? "PENDING",
      fssaiVerifiedAt: reset ? undefined : org.fssaiVerifiedAt,
      fssaiSubmittedAt: reset ? now : org.fssaiSubmittedAt ?? now,
      fssaiVerificationReason: reset ? undefined : org.fssaiVerificationReason,
    });

    if (reset && org.fssaiVerificationStatus === "VERIFIED") {
      // Previously verified — let admins know a re-verification is needed.
      const admins = await ctx.db.query("users").collect();
      for (const a of admins) {
        if (a.role === "admin") {
          await ctx.db.insert("notifications", {
            userId: a._id,
            title: "FSSAI re-verification needed",
            body: `${org.name} updated their FSSAI details. FreshLink verification is required again.`,
            type: "system",
            link: "/admin",
            read: false,
            createdAt: now,
          });
  	    }
      }
    }
    return { ok: true, reset };
  },
});

/* ---------------- Admin FSSAI verification ---------------- */

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) fail("You must be signed in.");
  const user = await ctx.db.get(userId);
  if (!user) fail("You must be signed in.");
  if (user.role !== "admin") fail("Only platform administrators can review FSSAI compliance.");
  return { userId, user };
}

/** Admin: verify an organization's FSSAI submission ("FreshLink Compliance Verified"). */
export const verifyFssai = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireAdmin(ctx);
    const org = await ctx.db.get(orgId);
    if (!org) fail("Organization not found.");
    if (!org.fssaiNumber) fail("This organization has not submitted FSSAI information yet.");
    const now = Date.now();
    await ctx.db.patch(orgId, {
      fssaiVerificationStatus: "VERIFIED",
      fssaiVerifiedAt: now,
      fssaiVerificationReason: undefined,
    });
    await notifyOrgUsers(ctx, orgId, {
      title: "FSSAI compliance verified",
      body: `FreshLink has verified the FSSAI ${org.fssaiType === "REGISTRATION" ? "Registration" : "License"} information for ${org.name}.`,
      type: "system",
      link: "/settings",
    });
    return { ok: true };
  },
});

/** Admin: request review (more information / documents needed). */
export const requestReviewFssai = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireAdmin(ctx);
    const org = await ctx.db.get(orgId);
    if (!org) fail("Organization not found.");
    if (!org.fssaiNumber) fail("This organization has not submitted FSSAI information yet.");
    const now = Date.now();
    await ctx.db.patch(orgId, {
      fssaiVerificationStatus: "REQUIRES_REVIEW",
      fssaiVerificationReason: undefined,
    });
    await notifyOrgUsers(ctx, orgId, {
      title: "FSSAI review requested",
      body: `The FreshLink team requested a review of your FSSAI information. Please check your certificate and details, then resubmit if needed.`,
      type: "system",
      link: "/settings",
    });
    return { ok: true };
  },
});

/** Admin: reject with a required reason. */
export const rejectFssai = mutation({
  args: { orgId: v.id("organizations"), reason: v.string() },
  handler: async (ctx, { orgId, reason }) => {
    await requireAdmin(ctx);
    if (!reason || reason.trim().length === 0) fail("A rejection reason is required.");
    const org = await ctx.db.get(orgId);
    if (!org) fail("Organization not found.");
    if (!org.fssaiNumber) fail("This organization has not submitted FSSAI information yet.");
    await ctx.db.patch(orgId, {
      fssaiVerificationStatus: "REJECTED",
      fssaiVerificationReason: reason.trim(),
    });
    await notifyOrgUsers(ctx, orgId, {
      title: "FSSAI verification rejected",
      body: `Your FSSAI verification was rejected: ${reason.trim()} Please update your details or certificate and resubmit.`,
      type: "system",
      link: "/settings",
    });
    return { ok: true };
  },
});

/** Notify all users of an org (local helper to avoid circular import). */
async function notifyOrgUsers(
  ctx: any,
  orgId: Id<"organizations">,
  n: { title: string; body: string; type: string; link?: string },
) {
  const users = await ctx.db
    .query("users")
    .withIndex("by_organization", (q: any) => q.eq("organizationId", orgId))
    .collect();
  for (const u of users) {
    await ctx.db.insert("notifications", {
      userId: u._id,
      title: n.title,
      body: n.body,
      type: n.type,
      link: n.link,
      read: false,
      createdAt: Date.now(),
    });
  }
}

/** Is the current database seeded? Used by the app to trigger seeding. */
export const isSeeded = query({
  args: {},
  handler: async (ctx) => {
    const org = await ctx.db.query("organizations").first();
    return org !== null;
  },
});

/** Idempotently seeds the demo world (called once by the app on first load). */
export const ensureSeed = mutation({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.seed.seedInternal);
    await ctx.runMutation(internal.seedAccounts.seedAccountsInternal);
    await ctx.runMutation(internal.seed.backfillFssai);
    return { ok: true };
  },
});
