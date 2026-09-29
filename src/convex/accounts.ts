import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { fail } from "./lib/util";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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
    storageCapability: v.optional(v.boolean()),
    coldChainCapability: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireViewer(ctx);

    // Already has an organization → nothing to do.
    if (user.organizationId) return { ok: true, created: false };

    const role = args.role === "supplier" ? "supplier" : "recipient";
    const now = Date.now();
    const orgId = await ctx.db.insert("organizations", {
      name: args.organizationName || `${args.name || "New"} Organization`,
      type: role,
      category: role === "supplier" ? "Food Business" : "Community Organization",
      address: args.location || "Location not set",
      lat: 52.4794 + (Math.random() - 0.5) * 0.05,
      lng: -1.8994 + (Math.random() - 0.5) * 0.05,
      contactName: args.name,
      contactPhone: args.phone || undefined,
      storageCapability: args.storageCapability ?? true,
      coldChainCapability: args.coldChainCapability ?? false,
      pickupCapability: "Pickup in person",
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
  },
  handler: async (ctx, args) => {
    const { user } = await requireViewer(ctx);
    if (!user.organizationId) fail("No organization linked to this account.");
    const org = await ctx.db.get(user.organizationId);
    if (!org) fail("Organization not found.");
    const { name, ...rest } = args;
    await ctx.db.patch(org._id, rest);
    if (name) await ctx.db.patch(user._id, { name });
    return org._id;
  },
});

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
    return { ok: true };
  },
});
