import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api } from "@/convex/_generated/api";
import { AppLayout, PageLoading } from "@/components/AppLayout";
import { StatusBadge, CompatibilityScore, fmtQty, fmtDate, time24to12 } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Brain, FileText, Check, X, ArrowRight, Info } from "lucide-react";

export default function Applications() {
  const applications = useQuery(api.applications.list, {});
  const profile = useQuery(api.users.myProfile);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get("highlight");
  const [detail, setDetail] = useState<any | null>(null);
  const propose = useMutation(api.allocations.propose);
  const rejectApp = useMutation(api.applications.reject);
  const withdrawApp = useMutation(api.applications.withdraw);
  const [proposing, setProposing] = useState<string | null>(null);

  const role = profile?.user?.role;
  const isSupplier = role === "supplier" || role === "admin";

  return (
    <AppLayout title="Applications" subtitle="Every allocation starts with an application — food is never sent automatically.">
      {!applications ? (
        <PageLoading />
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText className="size-8 text-leaf/50" />
            <p className="font-medium">No applications yet</p>
            <p className="text-sm text-muted-foreground">
              {isSupplier ? "When recipients apply for your surplus, requests appear here with AI compatibility analysis." : "Browse the marketplace and apply for surplus you can use."}
            </p>
            <Button className="mt-2 bg-forest" asChild>
              <Link to="/surplus">{isSupplier ? "View your listings" : "Find surplus food"}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((a: any) => (
            <Card key={a._id} className={`card-hover ${highlight === a._id ? "border-coral ring-1 ring-coral/40" : ""}`}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <CompatibilityScore score={a.aiScore ?? 0} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{isSupplier ? a.recipientOrg.name : a.listing.title}</p>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Requested {fmtQty(a.requestedQuantity, a.unit)} ·{" "}
                      {isSupplier ? (
                        <>
                          for <Link className="font-medium text-forest hover:underline" to={`/surplus/${a.listing._id}`}>{a.listing.title}</Link>
                        </>
                      ) : (
                        <>
                          from <span className="font-medium">{a.listing.title}</span>
                        </>
                      )}
                    </p>
                    {a.aiRecommendedQuantity !== undefined && a.aiRecommendedQuantity !== a.requestedQuantity && (
                      <p className="mt-1 text-xs font-medium text-harvest">
                        AI recommended {fmtQty(a.aiRecommendedQuantity, a.unit)} instead.
                      </p>
                    )}
                    {a.note && <p className="mt-2 rounded-md bg-leaf/5 p-2 text-xs italic text-charcoal/70">“{a.note}”</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDetail(a)}>
                      <Brain className="mr-1.5 size-3.5" /> AI analysis
                    </Button>
                    {isSupplier && ["submitted", "under_review", "ai_evaluated"].includes(a.status) && (
                      <>
                        <Button
                          size="sm"
                          className="bg-forest hover:bg-forest/90"
                          disabled={proposing === a._id}
                          onClick={async () => {
                            setProposing(a._id);
                            try {
                              await propose({ listingId: a.listing._id });
                              toast.success("AI allocation proposal generated — review in Allocations");
                              navigate("/allocations");
                            } catch (e: any) {
                              toast.error(e?.message ?? "Could not generate proposal");
                            } finally {
                              setProposing(null);
                            }
                          }}
                        >
                          Allocate <ArrowRight className="ml-1 size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            try {
                              await rejectApp({ id: a._id });
                              toast.success("Application declined");
                            } catch (e: any) {
                              toast.error(e?.message ?? "Could not decline");
                            }
                          }}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </>
                    )}
                    {!isSupplier && ["submitted", "under_review", "ai_evaluated"].includes(a.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await withdrawApp({ id: a._id });
                            toast.success("Application withdrawn");
                          } catch (e: any) {
                            toast.error(e?.message ?? "Could not withdraw");
                          }
                        }}
                      >
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <Brain className="size-5 text-coral" /> AI-Assisted Compatibility Analysis
            </DialogTitle>
            <DialogDescription>
              Transparent, rule-based scoring — no black box. The supplier always makes the final decision.
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <CompatibilityScore score={detail.aiScore ?? 0} size="lg" />
                <div className="flex-1 space-y-1.5">
                  {(detail.aiBreakdown ?? []).map((b: any) => (
                    <div key={b.label}>
                      <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                        <span>{b.label}</span>
                        <span>{b.points}/{b.max}</span>
                      </div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-leaf transition-all"
                          style={{ width: `${Math.round((b.points / b.max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {detail.aiReasons && detail.aiReasons.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-forest">Why this match?</p>
                  <ul className="space-y-1">
                    {detail.aiReasons.map((r: string) => (
                      <li key={r} className="flex items-start gap-1.5 text-sm text-charcoal/80">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-leaf" /> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {detail.aiWarnings && detail.aiWarnings.length > 0 && (
                <div className="rounded-lg border border-harvest/40 bg-harvest/10 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#8a6414]">
                    <Info className="size-3.5" /> Warnings
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {detail.aiWarnings.map((w: string) => (
                      <li key={w} className="text-sm text-[#6b4e0e]">{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Preferred pickup</p>
                  <p className="font-medium">{fmtDate(Date.parse(detail.preferredPickupDate))} · {time24to12(detail.preferredPickupTime)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pickup capability</p>
                  <p className="font-medium">{detail.pickupCapability}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Storage capability</p>
                  <p className="font-medium">{detail.storageCapability ? "Confirmed" : "Not confirmed"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cold-chain capability</p>
                  <p className="font-medium">{detail.coldChainCapability ? "Confirmed" : "Not confirmed"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
