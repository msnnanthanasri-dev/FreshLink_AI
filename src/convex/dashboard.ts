import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { computeUrgency, safetyCompleteness, fail } from "./lib/util";
import { distanceKm } from "./lib/matching";
import type { Doc, Id } from "./_generated/dataModel";

async function requireViewer(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) fail("Sign in required.");
  const user = await ctx.db.get(userId);
  if (!user) fail("Sign in required.");
  const org = user.organizationId ? await ctx.db.get(user.organizationId) : null;
  return { userId, user, org };
}

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const { user, org } = await requireViewer(ctx);
    const now = Date.now();
    const myOrgId = org?._id;

    const listings = (await ctx.db.query("foodListings").order("desc").collect()).filter(
      (l) => l.status !== "cancelled",
    );
    const apps = await ctx.db.query("foodApplications").collect();
    const allocs = await ctx.db.query("allocations").collect();
    const pickups = await ctx.db.query("pickupSchedules").collect();
    const history = await ctx.db.query("transactionHistory").collect();
    const orgs = await ctx.db.query("organizations").collect();

    const supplierName = (id: Id<"organizations">) => orgs.find((o) => o._id === id)?.name ?? "";

    // ---- platform impact (used everywhere) ----
    const impact = {
      totalKg: Math.round(history.reduce((s, t) => s + t.quantity, 0)),
      transactions: history.length,
      matches: allocs.filter((a) => a.status !== "proposed" && a.status !== "rejected" && a.status !== "cancelled").length,
      pickupsCompleted: pickups.filter((p) => p.status === "completed").length,
      organizations: orgs.filter((o) => o.category !== "Platform Admin").length,
      suppliers: orgs.filter((o) => o.type === "supplier" && o.category !== "Platform Admin").length,
      recipients: orgs.filter((o) => o.type === "recipient").length,
    };

    if (user.role === "admin") {
      const pendingApps = apps.filter((a) => ["submitted", "under_review", "ai_evaluated"].includes(a.status));
      const activeListings = listings.filter((l) => ["available", "partially_allocated"].includes(l.status));
      const flagged = listings.filter((l) => l.flagged);
      const activePickups = pickups.filter((p) => !["completed", "cancelled"].includes(p.status));
      return {
        role: "admin" as const,
        impact,
        stats: {
          totalListed: listings.reduce((s, l) => s + l.quantityOriginal, 0),
          totalRedistributed: impact.totalKg,
          activeListings: activeListings.length,
          pendingApplications: pendingApps.length,
          activePickups: activePickups.length,
          completedTransactions: history.length,
          flaggedListings: flagged.length,
          users: orgs.length,
        },
        flaggedListings: flagged.slice(0, 5).map((l) => ({
          _id: l._id,
          title: l.title,
          quantity: l.quantityAvailable,
          unit: l.unit,
          flagReason: l.flagReason,
          supplierName: supplierName(l.supplierOrgId),
        })),
        pendingApplications: pendingApps.slice(0, 5).map((a) => ({
          _id: a._id,
          listingId: a.listingId,
          requestedQuantity: a.requestedQuantity,
          unit: a.unit,
          status: a.status,
          aiScore: a.aiScore,
        })),
        activePickups: activePickups.slice(0, 5).map((p) => ({
          _id: p._id,
          quantity: p.quantity,
          unit: p.unit,
          status: p.status,
          scheduledDate: p.scheduledDate,
          scheduledTime: p.scheduledTime,
        })),
        listingTitles: Object.fromEntries(listings.map((l) => [l._id, l.title])),
      };
    }

    if (org?.type === "supplier") {
      const myListings = listings.filter((l) => l.supplierOrgId === myOrgId);
      const myListingsIds = new Set(myListings.map((l) => l._id));
      const appsForMine = apps.filter((a) => myListingsIds.has(a.listingId));
      const pendingApps = appsForMine.filter((a) => ["submitted", "under_review", "ai_evaluated"].includes(a.status));
      const approvedAllocs = allocs.filter((a) => a.supplierOrgId === myOrgId && a.status === "approved");
      const proposedAllocs = allocs.filter((a) => a.supplierOrgId === myOrgId && a.status === "proposed");
      const myPickups = pickups.filter((p) => p.supplierOrgId === myOrgId && !["completed", "cancelled"].includes(p.status));
      const myHistory = history.filter((t) => t.supplierOrgId === myOrgId);

      const urgentListings = myListings
        .filter((l) => ["available", "partially_allocated"].includes(l.status))
        .map((l) => ({ ...l, urgency: computeUrgency(l, now) }))
        .filter((l) => l.urgency === "urgent" || l.urgency === "critical")
        .sort((a, b) => a.pickupDeadline - b.pickupDeadline);

      const appsByListing = new Map<string, Doc<"foodApplications">[]>();
      for (const a of appsForMine) {
        const arr = appsByListing.get(a.listingId) ?? [];
        arr.push(a);
        appsByListing.set(a.listingId, arr);
      }

      return {
        role: "supplier" as const,
        impact,
        org,
        stats: {
          activeSurplus: myListings.filter((l) => ["available", "partially_allocated"].includes(l.status)).length,
          activeKg: Math.round(myListings.filter((l) => ["available", "partially_allocated"].includes(l.status)).reduce((s, l) => s + l.quantityAvailable, 0)),
          applicationsReceived: appsForMine.length,
          pendingApplications: pendingApps.length,
          aiRecommendations: proposedAllocs.length,
          approvedAllocations: approvedAllocs.length,
          todaysPickups: myPickups.filter((p) => p.scheduledDate <= todayKey()).length,
          upcomingPickups: myPickups.length,
          redistributed: Math.round(myHistory.reduce((s, t) => s + t.quantity, 0)),
          completedTransactions: myHistory.length,
        },
        urgentListings: urgentListings.slice(0, 3).map((l) => ({
          _id: l._id,
          title: l.title,
          quantity: l.quantityAvailable,
          unit: l.unit,
          urgency: l.urgency,
          pickupDeadline: l.pickupDeadline,
          preparedAt: l.preparedAt,
          photoUrl: l.photoUrl,
          category: l.category,
          applications: (appsByListing.get(l._id) ?? []).length,
          compatibleCount: (appsByListing.get(l._id) ?? []).filter((a) => (a.aiScore ?? 0) >= 60).length,
        })),
        pendingApps: pendingApps.slice(0, 4).map((a) => {
          const l = listings.find((x) => x._id === a.listingId);
          return {
            _id: a._id,
            listingTitle: l?.title ?? "",
            quantity: a.requestedQuantity,
            unit: a.unit,
            aiScore: a.aiScore,
            status: a.status,
            recipientName: orgs.find((o) => o._id === a.recipientOrgId)?.name ?? "",
            createdAt: a.createdAt,
          };
        }),
        todaysPickupList: myPickups
          .filter((p) => p.scheduledDate <= todayKey())
          .slice(0, 4)
          .map((p) => ({
            _id: p._id,
            title: listings.find((l) => l._id === p.listingId)?.title ?? "",
            quantity: p.quantity,
            unit: p.unit,
            time: p.scheduledTime,
            recipientName: orgs.find((o) => o._id === p.recipientOrgId)?.name ?? "",
            status: p.status,
          })),
        proposedAllocations: proposedAllocs.slice(0, 4).map((a) => ({
          _id: a._id,
          listingTitle: listings.find((l) => l._id === a.listingId)?.title ?? "",
          quantity: a.quantity,
          unit: a.unit,
          recipientName: orgs.find((o) => o._id === a.recipientOrgId)?.name ?? "",
        })),
      };
    }

    // ---- recipient ----
    const myApps = apps.filter((a) => a.recipientOrgId === myOrgId);
    const myActiveApps = myApps.filter((a) => !["rejected", "cancelled", "completed"].includes(a.status));
    const myAllocs = allocs.filter((a) => a.recipientOrgId === myOrgId && a.status === "approved");
    const myPickups = pickups.filter((p) => p.recipientOrgId === myOrgId && !["completed", "cancelled"].includes(p.status));
    const myHistory = history.filter((t) => t.recipientOrgId === myOrgId);

    const recommended = listings
      .filter((l) => ["available", "partially_allocated"].includes(l.status) && l.supplierOrgId !== myOrgId)
      .map((l) => {
        const supplier = orgs.find((o) => o._id === l.supplierOrgId);
        const km = supplier ? distanceKm(l, supplier) : null;
        const urgency = computeUrgency(l, now);
        // Lightweight demand-fit signal, deterministic and transparent
        const safety = safetyCompleteness(l);
        const compatibility =
          (l.foodType === "prepared" ? 82 : 76) +
          (urgency === "critical" ? -18 : urgency === "urgent" ? -6 : 0) +
          (l.coldChainRequired && !org.coldChainCapability ? -22 : 0) +
          (safety.status === "complete" ? 4 : -8);
        return {
          _id: l._id,
          title: l.title,
          category: l.category,
          quantity: l.quantityAvailable,
          unit: l.unit,
          photoUrl: l.photoUrl,
          pickupDeadline: l.pickupDeadline,
          urgency,
          distanceKm: km,
          supplierName: supplier?.name ?? "",
          compatibility: Math.max(35, Math.min(96, compatibility)),
          reason:
            `Quantity fits your request patterns and the pickup window is feasible${l.coldChainRequired ? " — cold-chain capability required" : ""}.`,
        };
      })
      .sort((a, b) => b.compatibility - a.compatibility)
      .slice(0, 3);

    return {
      role: "recipient" as const,
      impact,
      org,
      stats: {
        availableListings: listings.filter((l) => ["available", "partially_allocated"].includes(l.status)).length,
        availableKg: Math.round(listings.filter((l) => ["available", "partially_allocated"].includes(l.status)).reduce((s, l) => s + l.quantityAvailable, 0)),
        myApplications: myApps.length,
        activeApplications: myActiveApps.length,
        approvedAllocations: myAllocs.length,
        upcomingPickups: myPickups.length,
        foodCollected: Math.round(myHistory.reduce((s, t) => s + t.quantity, 0)),
        completedTransactions: myHistory.length,
      },
      myApplications: myApps.slice(0, 4).map((a) => {
        const l = listings.find((x) => x._id === a.listingId);
        return {
          _id: a._id,
          listingTitle: l?.title ?? "",
          quantity: a.requestedQuantity,
          unit: a.unit,
          status: a.status,
          aiScore: a.aiScore,
          createdAt: a.createdAt,
        };
      }),
      upcomingPickupList: myPickups
        .slice(0, 4)
        .map((p) => ({
          _id: p._id,
          title: listings.find((l) => l._id === p.listingId)?.title ?? "",
          quantity: p.quantity,
          unit: p.unit,
          date: p.scheduledDate,
          time: p.scheduledTime,
          supplierName: orgs.find((o) => o._id === p.supplierOrgId)?.name ?? "",
          status: p.status,
        })),
      recommended,
    };
  },
});

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
