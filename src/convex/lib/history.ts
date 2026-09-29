import type { Doc, Id } from "../_generated/dataModel";

/** A completed transaction (with optional allocation) from the current user's org perspective. */
export interface ContextualTransaction {
  _id: Id<"transactionHistory">;
  listingTitle: string;
  category: string;
  supplierOrgId: Id<"organizations">;
  recipientOrgId: Id<"organizations">;
  quantity: number;
  unit: string;
  completedAt: number;
  direction: "sent" | "received";
  counterpartyOrgId: Id<"organizations">;
}

/**
 * Given the viewer's org id, decorate raw transaction rows with direction
 * ("sent" for suppliers, "received" for recipients) and the counterparty.
 */
export function contextualizeHistory(
  myOrgId: Id<"organizations"> | undefined,
  rows: Doc<"transactionHistory">[],
): ContextualTransaction[] {
  const result: ContextualTransaction[] = [];
  for (const t of rows) {
    if (!myOrgId) continue;
    if (t.supplierOrgId === myOrgId) {
      result.push({ ...t, direction: "sent", counterpartyOrgId: t.recipientOrgId });
    } else if (t.recipientOrgId === myOrgId) {
      result.push({ ...t, direction: "received", counterpartyOrgId: t.supplierOrgId });
    }
  }
  return result.sort((a, b) => b.completedAt - a.completedAt);
}
