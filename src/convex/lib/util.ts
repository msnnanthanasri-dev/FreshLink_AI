import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

const DAY_MS = 24 * 60 * 60 * 1000;

/** yyyy-mm-dd for a Date-like timestamp, in local server time. */
export function toDateKey(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Combine a yyyy-mm-dd and HH:mm into a timestamp. */
export function fromDateKeyTime(dateKey: string, time: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0).getTime();
}

/** Label for a date relative to now: Today / Tomorrow / Mon, 12 Oct etc. */
export function friendlyDate(dateKey: string): string {
  const today = toDateKey(Date.now());
  const tomorrow = toDateKey(Date.now() + DAY_MS);
  if (dateKey === today) return "Today";
  if (dateKey === tomorrow) return "Tomorrow";
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

/** Convert 24h "17:30" to "5:30 PM". */
export function friendlyTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}

/** Requirement checklist for safety info completeness. */
export function safetyCompleteness(l: Doc<"foodListings">): {
  status: "complete" | "incomplete" | "not_eligible";
  missing: string[];
} {
  const missing: string[] = [];
  if (!l.photoUrl) missing.push("photo");
  if (l.foodType === "prepared" && !l.preparedAt) missing.push("preparation time");
  if (!l.handlingInstructions) missing.push("handling instructions");
  if (!l.pickupDeadline) missing.push("pickup deadline");
  if (l.storageCondition === "refrigerated" || l.storageCondition === "frozen") {
    if (!l.coldChainRequired) missing.push("cold-chain confirmation");
    if (!l.temperatureNote) missing.push("temperature information");
  }
  if (l.foodType === "packaged" && !l.bestBefore) missing.push("best-before date");
  if (l.safetyStatus === "not_eligible") return { status: "not_eligible", missing };
  return { status: missing.length === 0 ? "complete" : "incomplete", missing };
}

/** Compute urgency from remaining usable time and food type. */
export function computeUrgency(l: Doc<"foodListings">, now: number): "normal" | "attention" | "urgent" | "critical" {
  const msLeft = l.pickupDeadline - now;
  const hours = msLeft / 3_600_000;
  if (msLeft <= 0) return "critical";
  // Prepared food has a shorter operational window than packaged food.
  const scale = l.foodType === "prepared" ? 1 : l.foodType === "packaged" ? 0.25 : 0.6;
  if (hours <= 2 * scale) return "critical";
  if (hours <= 6 * scale) return "urgent";
  if (hours <= 24 * scale) return "attention";
  return "normal";
}

export const URGENCY_LABEL: Record<string, string> = {
  normal: "Normal",
  attention: "Attention",
  urgent: "Urgent",
  critical: "Critical",
};

export const URGENCY_HINT: Record<string, string> = {
  normal: "Plenty of usable time",
  attention: "Pickup recommended soon",
  urgent: "Pickup recommended soon",
  critical: "Pickup window nearly over",
};

/** Create one notification for a user. */
export async function notify(
  ctx: { db: any },
  userId: Id<"users">,
  n: { title: string; body: string; type: string; link?: string; relatedId?: string },
) {
  await ctx.db.insert("notifications", {
    userId,
    title: n.title,
    body: n.body,
    type: n.type,
    link: n.link,
    relatedId: n.relatedId,
    read: false,
    createdAt: Date.now(),
  });
}

/** Notify every user of an organization except an optional excluded user. */
export async function notifyOrg(
  ctx: { db: any },
  orgId: Id<"organizations">,
  n: { title: string; body: string; type: string; link?: string; relatedId?: string },
  excludeUserId?: Id<"users">,
) {
  const users = await ctx.db
    .query("users")
    .withIndex("by_organization", (q: any) => q.eq("organizationId", orgId))
    .collect();
  for (const u of users) {
    if (excludeUserId && u._id === excludeUserId) continue;
    await notify(ctx, u._id, n);
  }
}

export interface Err {
  (message: string): never;
}

export function fail(message: string): never {
  throw new ConvexError(message);
}

/* ---------------- FSSAI compliance helpers ---------------- */

/**
 * Validate an FSSAI License / Registration number.
 * Rules: digits only, exactly 14, first digit 1 (License) or 2 (Registration).
 * Returns { ok, type } or { ok: false, error }.
 */
export function validateFssai(
  raw: string,
): { ok: true; type: "LICENSE" | "REGISTRATION" } | { ok: false; error: string } {
  const value = (raw ?? "").replace(/[\s\-]/g, "");
  if (!/^\d+$/.test(value)) {
    return { ok: false, error: "Enter a valid 14-digit FSSAI License / Registration Number." };
  }
  if (value.length !== 14) {
    return { ok: false, error: "Enter a valid 14-digit FSSAI License / Registration Number." };
  }
  if (value[0] === "1") return { ok: true, type: "LICENSE" };
  if (value[0] === "2") return { ok: true, type: "REGISTRATION" };
  return { ok: false, error: "Enter a valid 14-digit FSSAI License / Registration Number." };
}

/** Normalize an FSSAI number (strip spaces/dashes). */
export function normalizeFssai(raw: string): string {
  return (raw ?? "").replace(/[^\d]/g, "");
}

/** Masked form: "••••••••••4821" — shows only the last 4 digits. */
export function maskFssai(num?: string): string {
  if (!num || num.length < 4) return "—";
  return "••••••••••" + num.slice(-4);
}

/** Short type label for display. */
export function fssaiTypeLabel(t?: string): string {
  if (t === "LICENSE") return "License";
  if (t === "REGISTRATION") return "Registration";
  return "—";
}

/** True only when the org's FreshLink FSSAI verification status is VERIFIED. */
export function isFssaiVerified(org: { fssaiVerificationStatus?: string } | null | undefined): boolean {
  return org?.fssaiVerificationStatus === "VERIFIED";
}
