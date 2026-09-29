import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Link, useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { AppLayout, PageLoading } from "@/components/AppLayout";
import { StatusBadge, fmtQty, fmtDate, time24to12, dateKeyToLabel } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Network, Brain, Check, X, Pencil, Truck, Sparkles } from "lucide-react";

export default function Allocations() {
  const allocations = useQuery(api.allocations.list, {});
  const profile = useQuery(api.users.myProfile);
  const navigate = useNavigate();
  const approveAlloc = useMutation(api.allocations.approve);
  const modifyAlloc = useMutation(api.allocations.modify);
  const rejectAlloc = useMutation(api.allocations.reject);

  const [modifyTarget, setModifyTarget] = useState<any | null>(null);
  const [modifyQty, setModifyQty] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const isSupplierSide = (a: any) =>
    profile?.user?.role === "admin" || (profile?.org?._id && a.supplierOrg._id === profile.org._id);

  const grouped = new Map<string, any[]>();
  for (const a of allocations ?? []) {
    const key = a.listing._id;
    const arr = grouped.get(key) ?? [];
    arr.push(a);
    grouped.set(key, arr);
  }

  return (
    <AppLayout title="Allocations" subtitle="One listing, many recipients — the AI proposes, the supplier approves.">
      {!allocations ? (
        <PageLoading />
      ) : allocations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Network className="size-8 text-leaf/50" />
            <p className="font-medium">No allocations yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Generate an AI allocation proposal from your listing's applications to split surplus across recipients.
            </p>
            <Button className="mt-2 bg-forest" asChild>
              <Link to="/surplus">Review surplus</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([listingId, allocs]) => {
            const listing = allocs[0].listing;
            const totalAllocated = allocs
              .filter((a: any) => ["proposed", "approved", "completed"].includes(a.status))
              .reduce((s: number, a: any) => s + a.quantity, 0);
            const remaining = Math.max(0, listing.quantityOriginal - totalAllocated);
            const hasProposals = allocs.some((a: any) => a.status === "proposed");

            return (
              <section key={listingId} className="overflow-hidden rounded-2xl border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-ivory p-4 sm:p-5">
                  <div className="flex items-center gap-3.5">
                    {listing.photoUrl ? (
                      <img src={listing.photoUrl} alt={listing.title} className="size-14 rounded-xl border object-cover" />
                    ) : null}
                    <div>
                      <Link to={`/surplus/${listing._id}`} className="font-display text-lg font-semibold text-forest hover:underline">
                        {listing.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {fmtQty(listing.quantityOriginal, listing.unit)} total · {fmtQty(totalAllocated, listing.unit)} allocated ·{" "}
                        <span className={remaining === 0 ? "font-semibold text-forest" : "font-semibold text-coral"}>
                          {fmtQty(remaining, listing.unit)} remaining
                        </span>
                      </p>
                    </div>
                  </div>
                  {hasProposals && (
                    <span className="flex items-center gap-1.5 rounded-full bg-harvest/15 px-3 py-1 text-xs font-bold text-[#8a6414]">
                      <Sparkles className="size-3.5" /> AI proposal awaiting approval
                    </span>
                  )}
                </div>

                <div className="divide-y">
                  {allocs.map((a: any) => (
                    <div key={a._id} className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{a.recipientOrg.name}</p>
                          <StatusBadge status={a.status} />
                          {a.proposedBy === "ai" && (
                            <span className="flex items-center gap-1 rounded-full bg-leaf/10 px-2 py-0.5 text-[10px] font-bold text-leaf">
                              <Brain className="size-3" /> AI
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {fmtQty(a.quantity, a.unit)} · pickup {dateKeyToLabel(a.pickupDate ?? "")} {a.pickupTime ? time24to12(a.pickupTime) : ""}
                        </p>
                        {a.reason && <p className="mt-1 max-w-xl text-xs italic text-muted-foreground">{a.reason}</p>}
                      </div>

                      {a.pickup && (
                        <Button size="sm" variant="outline" onClick={() => navigate(`/pickups/${a.pickup._id}`)}>
                          <Truck className="mr-1.5 size-3.5" /> Pickup
                        </Button>
                      )}

                      {isSupplierSide(a) && a.status === "proposed" && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="bg-forest hover:bg-forest/90"
                            disabled={busy === a._id}
                            onClick={async () => {
                              setBusy(a._id);
                              try {
                                await approveAlloc({ id: a._id });
                                toast.success("Allocation approved — pickup scheduled and both sides notified");
                              } catch (e: any) {
                                toast.error(e?.message ?? "Could not approve");
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            <Check className="mr-1 size-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setModifyTarget(a);
                              setModifyQty(String(a.quantity));
                            }}
                          >
                            <Pencil className="mr-1 size-3.5" /> Modify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10"
                            disabled={busy === a._id}
                            onClick={async () => {
                              setBusy(a._id);
                              try {
                                await rejectAlloc({ id: a._id });
                                toast.success("Allocation rejected");
                              } catch (e: any) {
                                toast.error(e?.message ?? "Could not reject");
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Modify dialog */}
      <Dialog open={!!modifyTarget} onOpenChange={(v) => !v && setModifyTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Modify allocation</DialogTitle>
            <DialogDescription>
              Adjust the quantity for {modifyTarget?.recipientOrg.name}. Total allocations cannot exceed the original listing quantity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="mqty">Quantity ({modifyTarget?.unit})</Label>
              <Input id="mqty" type="number" min={0.1} value={modifyQty} onChange={(e) => setModifyQty(e.target.value)} />
            </div>
            <Button
              className="w-full bg-forest hover:bg-forest/90"
              onClick={async () => {
                if (!modifyTarget) return;
                try {
                  await modifyAlloc({ id: modifyTarget._id, quantity: Number(modifyQty) });
                  toast.success("Allocation updated — the recipient has been notified");
                  setModifyTarget(null);
                } catch (e: any) {
                  toast.error(e?.message ?? "Could not modify");
                }
              }}
            >
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
