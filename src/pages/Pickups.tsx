import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "@/convex/_generated/api";
import { AppLayout, PageLoading } from "@/components/AppLayout";
import { FlowChain } from "@/components/food-flow";
import { StatusBadge, fmtQty, dateKeyToLabel, time24to12, fmtDateTime, FssaiBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Truck,
  MapPin,
  Phone,
  Snowflake,
  Thermometer,
  Navigation,
  X,
  ClipboardCheck,
  CalendarClock,
  ArrowLeft,
  Check,
  PackageOpen,
  KeyRound,
  Copy,
  ShieldCheck,
  RotateCw,
} from "lucide-react";

const TIMELINE = ["Application Approved", "Allocation Confirmed", "Pickup Scheduled", "Ready for Pickup", "Picked Up", "Delivered", "Completed"];

function timelineIndex(status: string): number {
  switch (status) {
    case "scheduled": return 2;
    case "ready": return 3;
    case "on_the_way": return 3.5;
    case "picked_up": return 4;
    case "completed": return 6;
    case "cancelled": return -1;
    default: return 0;
  }
}

/** Supplier marks the food ready → recipient issues a 6-digit code → supplier enters it to hand over. */
function HandoverOtpCard({ p }: { p: any }) {
  const generateOtp = useMutation(api.pickups.generateOtp);
  const verifyHandover = useMutation(api.pickups.verifyHandover);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (["completed", "cancelled"].includes(p.status)) {
    return p.otpVerifiedAt ? (
      <Card className="border-forest/30 bg-leaf/5">
        <CardContent className="flex items-center gap-2.5 p-4 text-sm">
          <ShieldCheck className="size-4 text-forest" />
          <span>
            Handover code verified{" "}
            <span className="text-muted-foreground">· {fmtDateTime(p.otpVerifiedAt)}</span>
          </span>
        </CardContent>
      </Card>
    ) : null;
  }

  const recipientSide = p.viewerRole === "recipient";
  const supplierSide = p.viewerRole === "supplier" || p.viewerRole === "admin";
  const open = ["ready", "on_the_way"].includes(p.status);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-harvest/40 bg-harvest/5">
      <CardContent className="space-y-3 p-5">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <KeyRound className="size-3.5" /> Handover security
        </p>

        {!open && recipientSide && (
          <p className="text-sm text-muted-foreground">
            Once <span className="font-semibold text-charcoal">{p.supplierOrg.name}</span> marks the food ready, you can
            generate a one-time code and share it with their staff at collection.
          </p>
        )}

        {!open && supplierSide && (
          <p className="text-sm text-muted-foreground">
            Mark the food as <span className="font-semibold text-charcoal">Ready</span> first. The recipient then shares a
            6-digit code which you enter here to confirm the handoff.
          </p>
        )}

        {open && recipientSide && (
          <>
            <p className="text-sm text-muted-foreground">
              Share this code with the {p.supplierOrg.name} staff at collection. They enter it to confirm the handoff.
            </p>
            {p.handoverOtp ? (
              <>
                <div className="flex items-center justify-center gap-1.5 rounded-xl border bg-card py-4">
                  {p.handoverOtp.split("").map((d: string, i: number) => (
                    <span key={i} className="flex size-9 items-center justify-center rounded-lg bg-ivory font-display text-xl font-bold text-forest">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await navigator.clipboard.writeText(p.handoverOtp);
                        toast.success("Code copied — send it to the supplier");
                      })
                    }
                  >
                    <Copy className="mr-1.5 size-3.5" /> Copy code
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(async () => { await generateOtp({ id: p._id }); toast.success("New code generated"); })}>
                    <RotateCw className="mr-1.5 size-3.5" /> Regenerate
                  </Button>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Valid for 4 hours. The supplier must enter it before handing over the food.
                </p>
              </>
            ) : (
              <Button
                className="w-full bg-forest hover:bg-forest/90"
                disabled={busy}
                onClick={() => run(async () => { await generateOtp({ id: p._id }); toast.success("Handover code generated — share it with the supplier"); })}
              >
                <KeyRound className="mr-2 size-4" /> Generate handover code
              </Button>
            )}
          </>
        )}

        {open && supplierSide && (
          <>
            {p.otpIssued ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Ask {p.recipientOrg.name} for their 6-digit code and enter it below.
                </p>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="• • • • • •"
                  className="h-14 w-full rounded-xl border bg-card text-center font-display text-2xl font-bold tracking-[0.5em] text-forest placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-leaf/50"
                />
                <Button
                  className="w-full bg-coral hover:bg-coral/90"
                  disabled={busy || code.length !== 6}
                  onClick={() =>
                    run(async () => {
                      await verifyHandover({ id: p._id, otp: code });
                      setCode("");
                      toast.success("Handover verified — recipient asked to confirm receipt");
                    })
                  }
                >
                  <ShieldCheck className="mr-2 size-4" /> Verify code &amp; confirm handover
                </Button>
                {p.otpAttempts > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {p.otpAttempts} incorrect attempt{p.otpAttempts === 1 ? "" : "s"} — 5 attempts allowed before a new code is
                    required.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Waiting for <span className="font-semibold text-charcoal">{p.recipientOrg.name}</span> to generate a
                handover code. It appears here as soon as they do.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Pickups() {
  const pickups = useQuery(api.pickups.list, {});
  const navigate = useNavigate();

  const active = (pickups ?? []).filter((p: any) => !["completed", "cancelled"].includes(p.status));
  const completed = (pickups ?? []).filter((p: any) => p.status === "completed");
  const cancelled = (pickups ?? []).filter((p: any) => p.status === "cancelled");

  return (
    <AppLayout title="Pickup & Delivery" subtitle="Scheduled pickups appear for both supplier and recipient — confirm the handoff to complete a redistribution.">
      {!pickups ? (
        <PageLoading />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
              <CalendarClock className="size-4.5 text-leaf" /> Upcoming pickups
            </h2>
            {active.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                  <Truck className="size-8 text-leaf/50" />
                  <p className="font-medium">No active pickups</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    When an allocation is approved, a pickup record is created automatically for both sides. As the
                    collecting organization you will then be able to issue a handover code for the supplier to confirm.
                  </p>
                  <Button className="mt-2 bg-forest" asChild>
                    <Link to="/surplus">Browse surplus</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {active.map((p: any) => (
                  <PickupCard key={p._id} pickup={p} />
                ))}
              </div>
            )}
          </section>

          {completed.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
                <Check className="size-4.5 text-forest" /> Completed
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {completed.map((p: any) => (
                  <PickupCard key={p._id} pickup={p} />
                ))}
              </div>
            </section>
          )}

          {cancelled.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-muted-foreground">
                <X className="size-4.5" /> Cancelled
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {cancelled.map((p: any) => (
                  <PickupCard key={p._id} pickup={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </AppLayout>
  );
}

function PickupCard({ pickup: p }: { pickup: any }) {
  const navigate = useNavigate();
  const setStatus = useMutation(api.pickups.setStatus);
  const [busy, setBusy] = useState(false);
  const supplierSide = p.viewerRole === "supplier";
  const isActive = !["completed", "cancelled"].includes(p.status);

  const act = async (status: string, msg: string) => {
    setBusy(true);
    try {
      await setStatus({ id: p._id, status });
      toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={`card-hover ${p.status === "cancelled" ? "opacity-70" : ""}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          {p.listing.photoUrl ? (
            <img src={p.listing.photoUrl} alt={p.listing.title} className="size-16 rounded-xl border object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{p.listing.title}</p>
              <StatusBadge status={p.status} />
            </div>
            <p className="mt-0.5 font-display text-lg font-semibold text-forest">{fmtQty(p.quantity, p.unit)}</p>
            <p className="text-xs text-muted-foreground">
              {supplierSide ? `Recipient: ${p.recipientOrg.name}` : `From: ${p.supplierOrg.name}`} ·{" "}
              {dateKeyToLabel(p.scheduledDate)} · {time24to12(p.scheduledTime)}
            </p>
          </div>
        </div>

        {isActive && (
          <div className="mt-3.5 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate(`/pickups/${p._id}`)}>
              View details
            </Button>
            {supplierSide ? (
              <>
                {["scheduled"].includes(p.status) && (
                  <Button size="sm" className="bg-forest hover:bg-forest/90" disabled={busy} onClick={() => act("ready", "Marked ready for pickup — recipient notified")}>
                    <PackageOpen className="mr-1.5 size-3.5" /> Mark Ready
                  </Button>
                )}
                {["ready", "on_the_way"].includes(p.status) && (
                  <Button size="sm" className="bg-coral hover:bg-coral/90" onClick={() => navigate(`/pickups/${p._id}`)}>
                    <ShieldCheck className="mr-1.5 size-3.5" /> {p.otpIssued ? "Enter handover code" : "Awaiting code"}
                  </Button>
                )}
              </>
            ) : (
              <>
                {["scheduled", "ready"].includes(p.status) && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => act("on_the_way", "Supplier notified that you're on the way")}>
                    <Navigation className="mr-1.5 size-3.5" /> On the way
                  </Button>
                )}
                {["ready", "on_the_way"].includes(p.status) && (
                  <Button size="sm" variant="outline" onClick={() => navigate(`/pickups/${p._id}`)}>
                    <KeyRound className="mr-1.5 size-3.5" /> {p.handoverOtp ? "Show handover code" : "Generate code"}
                  </Button>
                )}
                {p.status === "picked_up" && (
                  <Button size="sm" className="bg-forest hover:bg-forest/90" disabled={busy} onClick={() => act("completed", "Pickup confirmed — redistribution completed 🎉")}>
                    <ClipboardCheck className="mr-1.5 size-3.5" /> Confirm Pickup Received
                  </Button>
                )}
              </>
            )}
          </div>
        )}
        {p.status === "completed" && (
          <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate(`/pickups/${p._id}`)}>
            View record
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- PICKUP DETAIL ---------------- */

export function PickupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const pickup = useQuery(api.pickups.get, id ? { id: id as any } : "skip");
  const setStatus = useMutation(api.pickups.setStatus);
  const [busy, setBusy] = useState(false);

  if (pickup === undefined) {
    return (
      <AppLayout title="Pickup details">
        <PageLoading />
      </AppLayout>
    );
  }
  if (pickup === null) {
    return (
      <AppLayout title="Pickup details">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">Pickup not found</p>
            <Button className="mt-4 bg-forest" onClick={() => navigate("/pickups")}>Back to pickups</Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const p = pickup as any;
  const supplierSide = p.viewerRole === "supplier";
  const isAdmin = p.viewerRole === "admin";
  const ti = timelineIndex(p.status);

  const act = async (status: string, msg: string) => {
    setBusy(true);
    try {
      await setStatus({ id: p._id, status });
      toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout title={`Pickup · ${p.listing.title}`} subtitle={`${fmtQty(p.quantity, p.unit)} · ${dateKeyToLabel(p.scheduledDate)} at ${time24to12(p.scheduledTime)}`}>
      <button onClick={() => navigate("/pickups")} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-leaf hover:underline">
        <ArrowLeft className="size-4" /> All pickups
      </button>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          {/* Timeline */}
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-3 font-display text-lg font-semibold">Visual timeline</h2>
              <ol className="relative ml-2 space-y-4 border-l-2 border-border pl-5">
                {TIMELINE.map((label, i) => {
                  const state = i < ti ? "done" : i === ti ? "current" : "todo";
                  return (
                    <li key={label} className="relative">
                      <span
                        className={`absolute -left-[27px] flex size-5 items-center justify-center rounded-full border-2 text-[9px] font-bold ${
                          state === "done"
                            ? "border-forest bg-forest text-white"
                            : state === "current"
                              ? "border-coral bg-coral text-white"
                              : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {state === "done" ? "✓" : i + 1}
                      </span>
                      <p className={`text-sm font-medium ${state === "current" ? "text-coral" : state === "done" ? "text-forest" : "text-muted-foreground"}`}>
                        {label}
                        {state === "current" && <span className="ml-2 rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">Current stage</span>}
                      </p>
                      {label === "Picked Up" && p.handedOverAt && (
                        <p className="text-xs text-muted-foreground">{fmtDateTime(p.handedOverAt)}</p>
                      )}
                      {label === "Completed" && p.confirmedAt && (
                        <p className="text-xs text-muted-foreground">{fmtDateTime(p.confirmedAt)}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          {/* Food & handling */}
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-3 font-display text-lg font-semibold">Food &amp; handling</h2>
              <div className="flex gap-4">
                {p.listing.photoUrl && (
                  <img src={p.listing.photoUrl} alt={p.listing.title} className="size-20 rounded-xl border object-cover" />
                )}
                <div className="text-sm">
                  <p className="font-semibold">{p.listing.title} · {fmtQty(p.quantity, p.unit)}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                    {p.listing.storageCondition === "refrigerated" || p.listing.storageCondition === "frozen" ? (
                      <Snowflake className="size-3.5 text-sky-600" />
                    ) : p.listing.storageCondition === "hot" ? (
                      <Thermometer className="size-3.5 text-coral" />
                    ) : null}
                    {p.listing.storageCondition} storage{p.listing.coldChainRequired ? " · cold chain required" : ""}
                  </p>
                </div>
              </div>
              {p.specialInstructions && (
                <p className="mt-3 rounded-lg bg-secondary/60 p-3 text-sm leading-relaxed">{p.specialInstructions}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Parties */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pickup from</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 font-semibold">
                  {p.supplierOrg.name} <FssaiBadge verified={p.supplierOrg.fssaiVerified} />
                </p>
                <p className="text-xs text-muted-foreground">{p.pickupLocation}</p>
                {p.supplierContact && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm"><Phone className="size-3.5 text-leaf" /> {p.supplierContact}</p>
                )}
              </div>
              <div className="border-t pt-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Collecting organization</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 font-semibold">
                  {p.recipientOrg.name} <FssaiBadge verified={p.recipientOrg.fssaiVerified} />
                </p>
                {p.recipientContact && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm"><Phone className="size-3.5 text-leaf" /> {p.recipientContact}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.pickupLocation)}`,
                      "_blank",
                      "noopener",
                    )
                  }
                >
                  <Navigation className="mr-1.5 size-3.5" /> Get Directions
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/map?focus=${p._id}`)}>
                  <MapPin className="mr-1.5 size-3.5" /> View on Map
                </Button>
              </div>
            </CardContent>
          </Card>

          <HandoverOtpCard p={p} />

          {/* Actions */}
          {p.status !== "completed" && p.status !== "cancelled" && (
            <Card>
              <CardContent className="space-y-2.5 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Actions</p>
                {supplierSide && ["scheduled"].includes(p.status) && (
                  <Button className="w-full bg-forest hover:bg-forest/90" disabled={busy} onClick={() => act("ready", "Marked ready for pickup")}>
                    <PackageOpen className="mr-2 size-4" /> Mark as Ready for Collection
                  </Button>
                )}
                {supplierSide && ["ready", "on_the_way"].includes(p.status) && (
                  <p className="rounded-lg bg-secondary/60 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    To hand over, use the code the recipient shared in <span className="font-semibold text-charcoal">Handover security</span> above.
                  </p>
                )}
                {!supplierSide && !isAdmin && ["scheduled", "ready"].includes(p.status) && (
                  <Button variant="outline" className="w-full" disabled={busy} onClick={() => act("on_the_way", "Supplier notified")}>
                    <Navigation className="mr-2 size-4" /> I'm on the way
                  </Button>
                )}
                {!supplierSide && !isAdmin && p.status === "picked_up" && (
                  <Button className="w-full bg-forest hover:bg-forest/90" disabled={busy} onClick={() => act("completed", "Redistribution completed")}>
                    <ClipboardCheck className="mr-2 size-4" /> Confirm Pickup Received
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                  disabled={busy}
                  onClick={async () => {
                    if (window.confirm("Cancel this pickup? The allocated quantity returns to the listing.")) {
                      act("cancelled", "Pickup cancelled");
                    }
                  }}
                >
                  Cancel pickup
                </Button>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Completion requires the supplier to hand over with the recipient&rsquo;s one-time code, and the
                  recipient to confirm receipt. Only then are impact analytics and Trust &amp; History updated.
                </p>
              </CardContent>
            </Card>
          )}

          {p.status === "completed" && (
            <Card className="border-forest/40 bg-leaf/10">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-forest text-white">
                    <Check className="size-6" />
                  </span>
                  <div>
                    <p className="font-display text-lg font-semibold text-forest">Redistribution Complete</p>
                    <p className="text-sm text-charcoal/75">
                      {fmtQty(p.quantity, p.unit)} successfully redirected. +{p.quantity} kg redistributed · +1 completed pickup.
                    </p>
                  </div>
                </div>
                {/* Proof of handover: compliance status of both organizations (no full numbers) */}
                <div className="rounded-lg border bg-card p-3 text-xs">
                  {p.otpVerifiedAt && (
                    <p className="mb-2 flex items-center gap-1.5 font-semibold text-forest">
                      <ShieldCheck className="size-3.5" /> Handover code verified · {fmtDateTime(p.otpVerifiedAt)}
                    </p>
                  )}
                  <p className="mb-1.5 font-bold uppercase tracking-wide text-muted-foreground">Proof of handover · compliance</p>
                  <p className="flex flex-wrap items-center gap-2">
                    Supplier: <span className="font-semibold">{p.supplierOrg.name}</span>
                    <FssaiBadge verified={p.supplierOrg.fssaiVerified} />
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2">
                    Recipient: <span className="font-semibold">{p.recipientOrg.name}</span>
                    <FssaiBadge verified={p.recipientOrg.fssaiVerified} />
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
