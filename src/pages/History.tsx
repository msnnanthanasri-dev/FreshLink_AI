import { useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";
import { AppLayout, PageLoading } from "@/components/AppLayout";
import { fmtQty, fmtDateTime } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, History as HistoryIcon, XCircle, Users, Star, ArrowDownLeft, ArrowUpRight } from "lucide-react";

export default function History() {
  const data = useQuery(api.insights.history, {});

  if (data === undefined) {
    return (
      <AppLayout title="Trust & History">
        <PageLoading />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Trust & History" subtitle="Every completed redistribution, cancellation and interaction — your organization's record.">
      {/* Totals */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <HistoryIcon className="size-4.5 text-leaf" />
            <p className="mt-2 font-display text-2xl font-semibold text-forest">{data.totals.completed}</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Completed redistributions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <ShieldCheck className="size-4.5 text-leaf" />
            <p className="mt-2 font-display text-2xl font-semibold text-forest">{data.totals.kg.toLocaleString()} kg</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total redirected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Users className="size-4.5 text-leaf" />
            <p className="mt-2 font-display text-2xl font-semibold text-forest">{data.partners.length}</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Organizations worked with</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Star className="size-4.5 text-harvest" />
            <p className="mt-2 font-display text-2xl font-semibold text-forest">{data.totals.avgRating ?? "—"}</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Average feedback</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Transactions */}
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Transaction history</h2>
          {data.transactions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No completed transactions yet. Complete a pickup to start your record.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {data.transactions.map((t) => (
                <Card key={t._id} className="card-hover">
                  <CardContent className="flex items-center gap-3.5 p-4">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                        t.direction === "received" ? "bg-leaf/15 text-leaf" : t.direction === "sent" ? "bg-forest/10 text-forest" : "bg-secondary text-forest"
                      }`}
                    >
                      {t.direction === "received" ? <ArrowDownLeft className="size-4.5" /> : <ArrowUpRight className="size-4.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {t.listingTitle} · {fmtQty(t.quantity, t.unit)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.direction === "received"
                          ? `Received from ${t.counterparty}`
                          : t.direction === "sent"
                            ? `Sent to ${t.counterparty}`
                            : `Recipient: ${t.counterparty}`}
                        · {fmtDateTime(t.completedAt)}
                      </p>
                    </div>
                    <Badge className="border-forest/30 bg-forest/10 text-forest">Completed</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {data.cancellations.length > 0 && (
            <>
              <h2 className="mb-3 mt-6 font-display text-lg font-semibold">Cancellations</h2>
              <div className="space-y-2">
                {data.cancellations.map((c) => (
                  <Card key={c._id} className="opacity-75">
                    <CardContent className="flex items-center gap-3.5 p-4">
                      <XCircle className="size-5 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {fmtQty(c.quantity, c.unit)} · {c.pickupLocation}
                        </p>
                        <p className="text-xs text-muted-foreground">Pickup cancelled</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Partners + feedback */}
        <section className="space-y-6">
          <div>
            <h2 className="mb-3 font-display text-lg font-semibold">Organizations interacted with</h2>
            {data.partners.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">No partners yet.</CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {data.partners.map((p) => (
                  <Card key={p.name}>
                    <CardContent className="flex items-center justify-between p-3.5">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.interactions} transaction{p.interactions === 1 ? "" : "s"} · {Math.round(p.kg)} kg
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 font-display text-lg font-semibold">Feedback</h2>
            {data.feedback.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">No feedback yet.</CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {data.feedback.map((f) => (
                  <Card key={f._id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="flex gap-0.5" aria-label={`${f.rating} out of 5 stars`}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`size-3.5 ${i < f.rating ? "fill-harvest text-harvest" : "text-border"}`} />
                          ))}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{fmtDateTime(f.createdAt)}</span>
                      </div>
                      {f.comment && <p className="mt-1.5 text-sm italic text-charcoal/75">“{f.comment}”</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {f.from} → {f.to}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Card className="border-leaf/40 bg-leaf/5">
            <CardContent className="p-4 text-xs leading-relaxed text-charcoal/75">
              <ShieldCheck className="mb-1 size-4 text-leaf" />
              Trust is built from real completed handoffs. Feedback and history are <strong>not</strong> used as an AI
              matching factor — matching is based on quantity, time, distance, storage and intended use.
            </CardContent>
          </Card>
        </section>
      </div>
    </AppLayout>
  );
}
