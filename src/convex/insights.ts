import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { fail, toDateKey, friendlyDate, friendlyTime } from "./lib/util";
import { contextualizeHistory } from "./lib/history";
import type { Doc, Id } from "./_generated/dataModel";

async function requireViewer(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) fail("Sign in required.");
  const user = await ctx.db.get(userId);
  if (!user) fail("Sign in required.");
  const org = user.organizationId ? await ctx.db.get(user.organizationId) : null;
  return { userId, user, org };
}

/** Notifications for the current user with unread count. */
export const listNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { notifications: [], unread: 0 };
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const sorted = rows.sort((a, b) => b.createdAt - a.createdAt);
    return { notifications: sorted.slice(0, 60), unread: rows.filter((n) => !n.read).length };
  },
});

export const markNotificationRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) fail("Sign in required.");
    const n = await ctx.db.get(id);
    if (!n || n.userId !== userId) fail("Notification not found.");
    await ctx.db.patch(id, { read: true });
    return id;
  },
});

export const markAllNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) fail("Sign in required.");
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const n of rows) {
      if (!n.read) await ctx.db.patch(n._id, { read: true });
    }
    return rows.length;
  },
});

/** Public platform impact for the landing page (no auth required). */
export const publicImpact = query({
  args: {},
  handler: async (ctx) => {
    const history = await ctx.db.query("transactionHistory").collect();
    const orgs = await ctx.db.query("organizations").collect();
    const pickups = await ctx.db.query("pickupSchedules").collect();
    const allocs = await ctx.db.query("allocations").collect();
    return {
      foodRedistributed: Math.round(history.reduce((s, t) => s + t.quantity, 0)),
      successfulMatches:
        allocs.filter((a) => ["approved", "completed"].includes(a.status)).length + history.length,
      organizations: orgs.filter((o) => o.category !== "Platform Admin").length,
      pickupsCompleted: pickups.filter((p) => p.status === "completed").length,
    };
  },
});

/** Impact analytics: platform-wide totals plus viewer-specific contribution. */
export const impact = query({
  args: {},
  handler: async (ctx) => {
    const { user, org } = await requireViewer(ctx);
    const history = await ctx.db.query("transactionHistory").collect();
    const orgs = await ctx.db.query("organizations").collect();
    const listings = await ctx.db.query("foodListings").collect();
    const pickups = await ctx.db.query("pickupSchedules").collect();
    const allocs = await ctx.db.query("allocations").collect();

    const orgName = (id: Id<"organizations">) => orgs.find((o) => o._id === id)?.name ?? "Unknown";

    // 8-week time series
    const weeks: Array<{ label: string; kg: number; pickups: number }> = [];
    const DAY = 24 * 3_600_000;
    for (let w = 7; w >= 0; w--) {
      const start = Date.now() - (w + 1) * 7 * DAY;
      const end = Date.now() - w * 7 * DAY;
      const inWeek = history.filter((t) => t.completedAt >= start && t.completedAt < end);
      weeks.push({
        label: w === 0 ? "This wk" : `W-${w}`,
        kg: Math.round(inWeek.reduce((s, t) => s + t.quantity, 0)),
        pickups: inWeek.length,
      });
    }

    // Category distribution
    const byCategory: Record<string, number> = {};
    for (const t of history) {
      byCategory[t.category] = (byCategory[t.category] ?? 0) + t.quantity;
    }
    const categoryData = Object.entries(byCategory)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);

    const byType = { fresh: 0, prepared: 0, packaged: 0 };
    for (const t of history) {
      if (t.category === "prepared") byType.prepared += t.quantity;
      else if (t.category === "packaged") byType.packaged += t.quantity;
      else byType.fresh += t.quantity;
    }

    const topSuppliers = Object.entries(
      history.reduce<Record<string, number>>((acc, t) => {
        acc[t.supplierOrgId] = (acc[t.supplierOrgId] ?? 0) + t.quantity;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, kg]) => ({ name: orgName(id as Id<"organizations">), kg: Math.round(kg) }));

    const topRecipients = Object.entries(
      history.reduce<Record<string, number>>((acc, t) => {
        acc[t.recipientOrgId] = (acc[t.recipientOrgId] ?? 0) + t.quantity;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, kg]) => ({ name: orgName(id as Id<"organizations">), kg: Math.round(kg) }));

    const myHistory = org ? history.filter((t) => t.supplierOrgId === org._id || t.recipientOrgId === org._id) : [];
    const activeListings = listings.filter((l) => ["available", "partially_allocated"].includes(l.status));
    const completedPickups = pickups.filter((p) => p.status === "completed").length;
    const scheduledPickups = pickups.filter((p) => !["completed", "cancelled"].includes(p.status)).length;
    const successRate = scheduledPickups + completedPickups > 0
      ? Math.round((completedPickups / (completedPickups + scheduledPickups)) * 100)
      : 100;

    return {
      platform: {
        foodRedistributed: Math.round(history.reduce((s, t) => s + t.quantity, 0)),
        successfulMatches: allocs.filter((a) => ["approved", "completed"].includes(a.status)).length + history.length,
        pickupsCompleted: completedPickups,
        organizations: orgs.filter((o) => o.category !== "Platform Admin").length,
        activeSuppliers: orgs.filter((o) => o.type === "supplier" && o.category !== "Platform Admin").length,
        activeRecipients: orgs.filter((o) => o.type === "recipient").length,
        activeListings: activeListings.length,
        availableKg: Math.round(activeListings.reduce((s, l) => s + l.quantityAvailable, 0)),
        pickupSuccessRate: successRate,
      },
      mine: {
        kg: Math.round(myHistory.reduce((s, t) => s + t.quantity, 0)),
        transactions: myHistory.length,
        role: user.role,
      },
      weeks,
      categoryData,
      foodTypeData: [
        { name: "Fresh", value: Math.round(byType.fresh) },
        { name: "Prepared", value: Math.round(byType.prepared) },
        { name: "Packaged", value: Math.round(byType.packaged) },
      ].filter((d) => d.value > 0),
      topSuppliers,
      topRecipients,
    };
  },
});

/** Trust & History: completed redistributions from the viewer's perspective. */
export const history = query({
  args: {},
  handler: async (ctx) => {
    const { user, org } = await requireViewer(ctx);
    const rows = await ctx.db.query("transactionHistory").collect();
    const orgs = await ctx.db.query("organizations").collect();
    const orgName = (id: Id<"organizations">) => orgs.find((o) => o._id === id)?.name ?? "Unknown";

    const admin = user.role === "admin";
    const contextual = admin
      ? rows
          .map((t) => ({ ...t, direction: "all" as const, counterpartyOrgId: t.recipientOrgId }))
          .sort((a, b) => b.completedAt - a.completedAt)
      : contextualizeHistory(org?._id, rows);

    const decorated = contextual.map((t) => ({
      _id: t._id,
      listingTitle: t.listingTitle,
      category: t.category,
      quantity: t.quantity,
      unit: t.unit,
      completedAt: t.completedAt,
      direction: t.direction,
      counterparty: orgName(t.counterpartyOrgId),
      // Trust & History compliance badges (status only — never full numbers)
      supplierFssaiVerified: orgs.find((o) => o._id === t.supplierOrgId)?.fssaiVerificationStatus === "VERIFIED",
      recipientFssaiVerified: orgs.find((o) => o._id === t.recipientOrgId)?.fssaiVerificationStatus === "VERIFIED",
      supplierName: orgName(t.supplierOrgId),
      recipientName: orgName(t.recipientOrgId),
    }));

    const cancelled = await ctx.db.query("pickupSchedules").withIndex("by_status", (q) => q.eq("status", "cancelled")).collect();
    const orgFilter = (p: Doc<"pickupSchedules">) =>
      admin || org?._id === p.supplierOrgId || org?._id === p.recipientOrgId;
    const cancellations = cancelled.filter(orgFilter).map((p) => {
      const l = orgs.length > 0 ? undefined : undefined;
      return {
        _id: p._id,
        scheduledDate: p.scheduledDate,
        scheduledTime: p.scheduledTime,
        quantity: p.quantity,
        unit: p.unit,
        pickupLocation: p.pickupLocation,
      };
    });

    const feedbackRows = await ctx.db.query("feedback").collect();
    const orgFeedback = feedbackRows
      .filter((f) => !org || f.toOrgId === org._id || f.fromOrgId === org._id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 6)
      .map((f) => ({
        _id: f._id,
        rating: f.rating,
        comment: f.comment,
        from: orgName(f.fromOrgId),
        to: orgName(f.toOrgId),
        createdAt: f.createdAt,
      }));

    const partners = new Map<string, { name: string; interactions: number; kg: number }>();
    for (const t of contextual) {
      const cur = partners.get(t.counterpartyOrgId) ?? { name: orgName(t.counterpartyOrgId), interactions: 0, kg: 0 };
      cur.interactions += 1;
      cur.kg += t.quantity;
      partners.set(t.counterpartyOrgId, cur);
    }

    return {
      transactions: decorated,
      cancellations,
      feedback: orgFeedback,
      partners: [...partners.values()].sort((a, b) => b.kg - a.kg),
      totals: {
        completed: decorated.length,
        kg: Math.round(decorated.reduce((s, t) => s + t.quantity, 0)),
        avgRating:
          orgFeedback.length > 0
            ? Math.round((orgFeedback.reduce((s, f) => s + f.rating, 0) / orgFeedback.length) * 10) / 10
            : null,
      },
    };
  },
});

/** Map data: orgs + active listings + active pickups (public-safe). */
export const mapData = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx);
    const orgs = await ctx.db.query("organizations").collect();
    const listings = (await ctx.db.query("foodListings").collect()).filter(
      (l) => ["available", "partially_allocated"].includes(l.status),
    );
    const pickups = (await ctx.db.query("pickupSchedules").collect()).filter(
      (p) => !["completed", "cancelled"].includes(p.status),
    );
    return {
      orgs: orgs
        .filter((o) => o.category !== "Platform Admin")
        .map((o) => ({
          _id: o._id,
          name: o.name,
          type: o.type,
          category: o.category,
          lat: o.lat,
          lng: o.lng,
          address: o.address,
        })),
      listings: listings.map((l) => ({
        _id: l._id,
        title: l.title,
        quantity: l.quantityAvailable,
        unit: l.unit,
        category: l.category,
        lat: l.lat,
        lng: l.lng,
        pickupDeadline: l.pickupDeadline,
        supplierName: orgs.find((o) => o._id === l.supplierOrgId)?.name ?? "",
      })),
      pickups: pickups.map((p) => ({
        _id: p._id,
        scheduledDate: p.scheduledDate,
        scheduledTime: p.scheduledTime,
        status: p.status,
        quantity: p.quantity,
        unit: p.unit,
        supplier: { lat: orgs.find((o) => o._id === p.supplierOrgId)?.lat ?? 0, lng: orgs.find((o) => o._id === p.supplierOrgId)?.lng ?? 0, name: orgs.find((o) => o._id === p.supplierOrgId)?.name ?? "", fssaiVerified: orgs.find((o) => o._id === p.supplierOrgId)?.fssaiVerificationStatus === "VERIFIED" },
        recipient: { lat: orgs.find((o) => o._id === p.recipientOrgId)?.lat ?? 0, lng: orgs.find((o) => o._id === p.recipientOrgId)?.lng ?? 0, name: orgs.find((o) => o._id === p.recipientOrgId)?.name ?? "", fssaiVerified: orgs.find((o) => o._id === p.recipientOrgId)?.fssaiVerificationStatus === "VERIFIED" },
      })),
    };
  },
});

/** Global search across food, organizations, applications and pickups. */
export const search = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { food: [], organizations: [], pickups: [] };
    const me = await ctx.db.get(userId);
    const user = me ? { role: me.role ?? "user", organizationId: me.organizationId } : { role: "user" as const, organizationId: undefined };
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return { food: [], organizations: [], pickups: [] };

    const listings = await ctx.db.query("foodListings").collect();
    const orgs = await ctx.db.query("organizations").collect();
    const pickups = await ctx.db.query("pickupSchedules").collect();

    const food = listings
      .filter(
        (l) =>
          !["cancelled", "flagged"].includes(l.status) &&
          (l.title.toLowerCase().includes(needle) || l.category.includes(needle)),
      )
      .slice(0, 5)
      .map((l) => ({
        _id: l._id,
        title: l.title,
        quantity: l.quantityAvailable,
        unit: l.unit,
        supplierName: orgs.find((o) => o._id === l.supplierOrgId)?.name ?? "",
        pickupToday: l.pickupDeadline < Date.now() + 24 * 3_600_000,
      }));

    const organizations = orgs
      .filter((o) => o.category !== "Platform Admin" && o.name.toLowerCase().includes(needle))
      .slice(0, 4)
      .map((o) => ({ _id: o._id, name: o.name, category: o.category, type: o.type }));

    const orgName = (id: Id<"organizations">) => orgs.find((o) => o._id === id)?.name ?? "";
    const pickupResults = pickups
      .filter(
        (p) =>
          (user.role === "admin" ||
            (user.organizationId &&
              (p.supplierOrgId === user.organizationId || p.recipientOrgId === user.organizationId))) &&
          (orgName(p.supplierOrgId).toLowerCase().includes(needle) ||
            orgName(p.recipientOrgId).toLowerCase().includes(needle) ||
            p.pickupLocation.toLowerCase().includes(needle)),
      )
      .slice(0, 4)
      .map((p) => ({
        _id: p._id,
        quantity: p.quantity,
        unit: p.unit,
        status: p.status,
        when: `${friendlyDate(p.scheduledDate)} · ${friendlyTime(p.scheduledTime)}`,
        supplierName: orgName(p.supplierOrgId),
        recipientName: orgName(p.recipientOrgId),
      }));

    return { food, organizations, pickups: pickupResults };
  },
});
