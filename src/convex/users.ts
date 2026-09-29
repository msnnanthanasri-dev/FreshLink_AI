import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

/** Full profile: user + organization */
export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const org = user.organizationId ? await ctx.db.get(user.organizationId) : null;
    return { user, org };
  },
});

/** List organizations (for browse/search) — public-safe fields only. */
export const listOrganizations = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("organizations").collect();
  },
});

/** Get one organization by id with aggregate stats. */
export const getOrganization = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, { id }) => {
    const org = await ctx.db.get(id);
    if (!org) return null;
    const listings = await ctx.db
      .query("foodListings")
      .withIndex("by_supplier", (q) => q.eq("supplierOrgId", id))
      .collect();
    const history = await ctx.db
      .query("transactionHistory")
      .withIndex("by_supplier", (q) => q.eq("supplierOrgId", id))
      .collect();
    const recipientHistory = await ctx.db
      .query("transactionHistory")
      .withIndex("by_recipient", (q) => q.eq("recipientOrgId", id))
      .collect();
    const all = [...history, ...recipientHistory];
    const completedCount = all.length;
    const totalKg = all.reduce((s, t) => s + t.quantity, 0);
    return {
      org,
      stats: {
        activeListings: listings.filter((l) => l.status === "available" || l.status === "partially_allocated").length,
        completedCount,
        totalKg,
      },
    };
  },
});
