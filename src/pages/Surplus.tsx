import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "@/convex/_generated/api";
import { AppLayout, PageLoading } from "@/components/AppLayout";
import { StatusBadge, UrgencyBadge, fmtQty, timeLeft, CompatibilityScore, fmtDate, fmtDateTime, FssaiBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  MapPin,
  Clock,
  Thermometer,
  Snowflake,
  ShieldCheck,
  ShieldAlert,
  Brain,
  Apple,
  Flag,
  ArrowLeft,
  PackageCheck,
  Sparkles,
} from "lucide-react";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "fresh", label: "Fresh" },
  { key: "prepared", label: "Prepared" },
  { key: "bakery", label: "Bakery" },
  { key: "packaged", label: "Packaged" },
  { key: "fruits", label: "Fruits" },
  { key: "vegetables", label: "Vegetables" },
  { key: "dairy", label: "Dairy" },
  { key: "other", label: "Other" },
];

const QUICK_FILTERS = [
  { key: "nearby", label: "Nearby" },
  { key: "urgent", label: "Urgent" },
  { key: "today", label: "Available Today" },
  { key: "large", label: "Large Quantity" },
  { key: "cold", label: "Cold Chain Required" },
];

export default function Surplus() {
  const listings = useQuery(api.listings.list, {});
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState<string[]>([]);

  const toggleQuick = (k: string) =>
    setQuick((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const filtered = useMemo(() => {
    if (!listings) return [];
    const needle = q.trim().toLowerCase();
    return listings
      .filter((l) => ["available", "partially_allocated"].includes(l.status))
      .filter((l) => (category === "all" ? true : l.category === category))
      .filter((l) => (needle ? l.title.toLowerCase().includes(needle) || l.description?.toLowerCase().includes(needle) : true))
      .filter((l) => {
        if (quick.includes("urgent")) return l.urgency === "urgent" || l.urgency === "critical";
        if (quick.includes("today")) return l.pickupDeadline < Date.now() + 24 * 3_600_000;
        if (quick.includes("large")) return l.quantityAvailable >= 50;
        if (quick.includes("cold")) return l.coldChainRequired;
        return true;
      })
      .sort((a, b) => a.pickupDeadline - b.pickupDeadline);
  }, [listings, category, q, quick]);

  return (
    <AppLayout title="Surplus Food" subtitle="Live surplus from suppliers across the network.">
      <div className="mb-5 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apples, biryani, bread…" className="pl-9 bg-card" aria-label="Search surplus food" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                category === c.key ? "border-forest bg-forest text-white" : "bg-card hover:border-leaf/50"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => toggleQuick(f.key)}
              aria-pressed={quick.includes(f.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                quick.includes(f.key) ? "border-coral bg-coral/10 text-coral" : "bg-card text-muted-foreground hover:border-coral/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {!listings ? (
        <PageLoading />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Apple className="size-8 text-leaf/50" />
            <p className="font-medium">No surplus matches your filters</p>
            <p className="text-sm text-muted-foreground">Try clearing filters or check back later.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((l) => (
            <Link key={l._id} to={`/surplus/${l._id}`} className="card-hover group overflow-hidden rounded-xl border bg-card">
              <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
                {l.photoUrl ? (
                  <img src={l.photoUrl} alt={`Photo of ${l.title}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center"><Apple className="size-10 text-leaf/40" /></div>
                )}
                <div className="absolute left-2 top-2 flex gap-1.5">
                  <UrgencyBadge urgency={l.urgency} />
                  {l.coldChainRequired && (
                    <span className="flex items-center gap-1 rounded-full bg-sky-100/90 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                      <Snowflake className="size-3" /> Cold chain
                    </span>
                  )}
                </div>
                {l.photoIsUpload && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-forest/85 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Supplier photo
                  </span>
                )}
              </div>
              <div className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold leading-tight">{l.title}</h3>
                    <p className="mt-0.5 font-display text-lg font-semibold text-forest">{fmtQty(l.quantityAvailable, l.unit)}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </div>
                <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><Clock className="size-3.5" /> {timeLeft(l.pickupDeadline)}</p>
                  {l.safetyStatus === "incomplete" && (
                    <p className="flex items-center gap-1.5 text-harvest"><ShieldAlert className="size-3.5" /> Safety info incomplete</p>
                  )}
                  {l.safetyStatus === "complete" && (
                    <p className="flex items-center gap-1.5 text-leaf"><ShieldCheck className="size-3.5" /> Safety info complete</p>
                  )}
                </div>
                <div className="mt-2 border-t pt-2">
                  <FssaiBadge verified={l.supplier?.fssaiVerified} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

/* ---------------- LISTING DETAIL ---------------- */

export function SurplusDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const profile = useQuery(api.users.myProfile);
  const listing = useQuery(api.listings.get, id ? ({ id } as any) : "skip");
  const applications = useQuery(api.applications.list, {});
  const propose = useMutation(api.allocations.propose);
  const submitApplication = useMutation(api.applications.submit);
  const cancelListing = useMutation(api.listings.cancel);

  const [applyOpen, setApplyOpen] = useState(false);
  const [proposing, setProposing] = useState(false);

  if (listing === undefined || profile === undefined) {
    return (
      <AppLayout title="Surplus Food">
        <PageLoading />
      </AppLayout>
    );
  }
  if (listing === null) {
    return (
      <AppLayout title="Surplus Food">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">Listing not found</p>
            <p className="mt-1 text-sm text-muted-foreground">It may have been removed or completed.</p>
            <Button className="mt-4 bg-forest" onClick={() => navigate("/surplus")}>Back to surplus</Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const role = profile?.user?.role ?? "";
  const myOrgId = profile?.org?._id;
  const isOwner = myOrgId && listing.supplierOrgId === myOrgId;
  const isAdmin = role === "admin";
  const isRecipient = role === "recipient";
  const listingApps = (applications ?? []).filter((a: any) => a.listing._id === listing._id);
  const myActiveApp = listingApps.find(
    (a: any) => a.recipientOrg._id === myOrgId && !["rejected", "cancelled", "completed"].includes(a.status),
  );

  const canApply = isRecipient && !isOwner && !myActiveApp && ["available", "partially_allocated"].includes(listing.status);

  return (
    <AppLayout title={listing.title} subtitle={`${listing.supplier?.name ?? ""} · ${listing.category}`}>
      <button onClick={() => navigate("/surplus")} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-leaf hover:underline">
        <ArrowLeft className="size-4" /> All surplus
      </button>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Photo + details */}
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="relative aspect-[16/10] bg-secondary">
              {listing.photoUrl ? (
                <img src={listing.photoUrl} alt={`Photo of ${listing.title} supplied by ${listing.supplier?.name}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center"><Apple className="size-14 text-leaf/40" /></div>
              )}
              <div className="absolute left-3 top-3 flex gap-2">
                <UrgencyBadge urgency={listing.urgency} />
                <StatusBadge status={listing.status} />
              </div>
              {listing.photoIsUpload && (
                <span className="absolute bottom-3 right-3 rounded-full bg-forest/85 px-2.5 py-1 text-[11px] font-semibold text-white">
                  Supplier uploaded this photo
                </span>
              )}
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl font-semibold text-forest">{listing.title}</h2>
                <p className="font-display text-2xl font-semibold text-coral">{fmtQty(listing.quantityAvailable, listing.unit)} available</p>
              </div>
              {listing.description && <p className="mt-2 text-sm leading-relaxed text-charcoal/75">{listing.description}</p>}

              {/* Food condition & safety information */}
              <div className="mt-4 rounded-xl border bg-ivory p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-forest">
                  <ShieldCheck className="size-4 text-leaf" /> Food Condition &amp; Safety Information
                </h3>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  The photo is supporting information only — it does not prove food is safe. Always verify condition on collection.
                </p>
                {listing.safetyStatus === "incomplete" && listing.safetyMissing.length > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 rounded-md bg-harvest/10 px-2.5 py-1.5 text-xs font-semibold text-[#8a6414]">
                    <ShieldAlert className="size-3.5" /> Safety information incomplete: missing {listing.safetyMissing.join(", ")}
                  </p>
                )}
                {listing.safetyStatus === "not_eligible" && (
                  <p className="mt-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive">
                    Not eligible for redistribution under current configured rules.
                  </p>
                )}
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {listing.preparedAt && (
                    <div className="flex justify-between gap-4 sm:block">
                      <dt className="text-xs text-muted-foreground">Prepared</dt>
                      <dd className="font-medium">{fmtDateTime(listing.preparedAt)}</dd>
                    </div>
                  )}
                  {listing.bestBefore && (
                    <div className="flex justify-between gap-4 sm:block">
                      <dt className="text-xs text-muted-foreground">Best before</dt>
                      <dd className="font-medium">{fmtDate(listing.bestBefore)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-xs text-muted-foreground">Storage</dt>
                    <dd className="flex items-center gap-1.5 font-medium capitalize">
                      {listing.storageCondition === "refrigerated" || listing.storageCondition === "frozen" ? (
                        <Snowflake className="size-3.5 text-sky-600" />
                      ) : listing.storageCondition === "hot" ? (
                        <Thermometer className="size-3.5 text-coral" />
                      ) : null}
                      {listing.storageCondition}
                    </dd>
                  </div>
                  {listing.temperatureNote && (
                    <div className="flex justify-between gap-4 sm:block">
                      <dt className="text-xs text-muted-foreground">Temperature</dt>
                      <dd className="font-medium">{listing.temperatureNote}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-xs text-muted-foreground">Pickup deadline</dt>
                    <dd className="font-semibold text-coral">{fmtDateTime(listing.pickupDeadline)} · {timeLeft(listing.pickupDeadline)}</dd>
                  </div>
                  {listing.handlingInstructions && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Handling instructions</dt>
                      <dd className="mt-0.5 font-medium leading-relaxed">{listing.handlingInstructions}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="size-4 text-leaf" />
                <span className="font-medium">{listing.supplier?.name}</span>
                {listing.distanceKm !== null && (
                  <span className="text-muted-foreground">· {Math.round(listing.distanceKm * 10) / 10} km away</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <FssaiBadge verified={listing.supplier?.fssaiVerified} showMasked={listing.supplier?.fssaiMasked} />
              </div>
              <p className="text-xs text-muted-foreground">{listing.supplier?.address}</p>
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground">Allocation status</p>
                <p className="text-sm font-semibold">
                  {fmtQty(listing.remainingQty, listing.unit)} remaining
                  {listing.allocatedQty > 0 && <> · {fmtQty(listing.allocatedQty, listing.unit)} allocated</>}
                </p>
              </div>

              {canApply && (
                <Button className="w-full bg-forest hover:bg-forest/90" onClick={() => setApplyOpen(true)}>
                  Apply for this surplus
                </Button>
              )}
              {isRecipient && myActiveApp && (
                <div className="rounded-lg border bg-secondary/60 p-3 text-sm">
                  <p className="font-semibold">You have an active application</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fmtQty(myActiveApp.requestedQuantity, myActiveApp.unit)} · status: {myActiveApp.status.replace(/_/g, " ")}
                  </p>
                </div>
              )}
              {isRecipient && !myActiveApp && !isOwner && !["available", "partially_allocated"].includes(listing.status) && (
                <p className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">This listing is no longer accepting applications.</p>
              )}

              {(isOwner || isAdmin) && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Supplier actions</p>
                  <Button
                    className="w-full bg-forest hover:bg-forest/90"
                    disabled={proposing || listingApps.filter((a: any) => ["submitted", "under_review", "ai_evaluated"].includes(a.status)).length === 0}
                    onClick={async () => {
                      setProposing(true);
                      try {
                        await propose({ listingId: listing._id });
                        toast.success("AI allocation proposal generated — review it in Allocations");
                        navigate("/allocations");
                      } catch (e: any) {
                        toast.error(e?.message ?? "Could not generate proposal");
                      } finally {
                        setProposing(false);
                      }
                    }}
                  >
                    <Brain className="mr-2 size-4" />
                    {proposing ? "Analyzing…" : "Generate AI Allocation Proposal"}
                  </Button>
                  {listingApps.length > 0 && (
                    <div className="space-y-1.5">
                      {listingApps.slice(0, 4).map((a: any) => (
                        <div key={a._id} className="flex items-center gap-2 rounded-lg border p-2 text-xs">
                          <CompatibilityScore score={a.aiScore ?? 0} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{a.recipientOrg.name}</p>
                            <p className="text-muted-foreground">{fmtQty(a.requestedQuantity, a.unit)} requested</p>
                          </div>
                          <StatusBadge status={a.status} />
                        </div>
                      ))}
                    </div>
                  )}
                  {isAdmin && (
                    <Button
                      variant="outline"
                      className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={async () => {
                        try {
                          await cancelListing({ id: listing._id });
                          toast.success("Listing cancelled");
                          navigate("/surplus");
                        } catch (e: any) {
                          toast.error(e?.message ?? "Could not cancel");
                        }
                      }}
                    >
                      <Flag className="mr-2 size-4" /> Cancel listing
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {listing.safetyStatus !== "complete" && (
            <Card className="border-harvest/40">
              <CardContent className="flex gap-3 p-4 text-sm">
                <ShieldAlert className="size-5 shrink-0 text-[#8a6414]" />
                <div>
                  <p className="font-semibold">Safety information incomplete</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Missing: {listing.safetyMissing.join(", ")}. Review carefully before applying.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {id && <ApplyDialog open={applyOpen} onOpenChange={setApplyOpen} listingId={id} unit={listing.unit} available={listing.quantityAvailable} />}
    </AppLayout>
  );
}

/* ---------------- APPLY DIALOG ---------------- */

function ApplyDialog({
  open,
  onOpenChange,
  listingId,
  unit,
  available,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listingId: string;
  unit: string;
  available: number;
}) {
  const submitApplication = useMutation(api.applications.submit);
  const [quantity, setQuantity] = useState<string>(String(Math.min(10, Math.floor(available))));
  const [intendedUse, setIntendedUse] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date(Date.now() + 24 * 3_600_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [time, setTime] = useState("17:30");
  const [pickupCapability, setPickupCapability] = useState("Pickup in person");
  const [storage, setStorage] = useState(true);
  const [cold, setCold] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleApply = async () => {
    setSubmitting(true);
    try {
      const result = await submitApplication({
        listingId: listingId as any,
        requestedQuantity: Number(quantity),
        unit,
        intendedUse: intendedUse || "Community distribution",
        preferredPickupDate: date,
        preferredPickupTime: time,
        pickupCapability,
        storageCapability: storage,
        coldChainCapability: cold,
        note: note || undefined,
      });
      toast.success(`Application submitted — AI scored it ${result.analysis.score}/100`, {
        description: "The supplier can now review the AI compatibility analysis.",
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not submit application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Sparkles className="size-5 text-coral" /> Apply for this surplus
          </DialogTitle>
          <DialogDescription>
            Applications go to the supplier with an AI compatibility analysis. You are never allocated food automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qty">Requested quantity (max {available} {unit})</Label>
              <Input id="qty" type="number" min={0.1} max={available} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Pickup capability</Label>
              <Select value={pickupCapability} onValueChange={setPickupCapability}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pickup in person">Pickup in person</SelectItem>
                  <SelectItem value="Own van">Own van</SelectItem>
                  <SelectItem value="Refrigerated van">Refrigerated van</SelectItem>
                  <SelectItem value="Bike / walker">Bike / walker</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="use">Intended use</Label>
            <Textarea id="use" value={intendedUse} onChange={(e) => setIntendedUse(e.target.value)} placeholder="I would like 15 kg for our community kitchen serving 120 guests…" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pdate">Preferred pickup date</Label>
              <Input id="pdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ptime">Preferred pickup time</Label>
              <Input id="ptime" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-secondary/50 p-3">
            <label className="flex items-center justify-between text-sm font-medium">
              Storage capability
              <Switch checked={storage} onCheckedChange={setStorage} />
            </label>
            <label className="flex items-center justify-between text-sm font-medium">
              Cold chain capability
              <Switch checked={cold} onCheckedChange={setCold} />
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Additional note (optional)</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the supplier should know…" />
          </div>
          <Button className="w-full bg-forest hover:bg-forest/90" onClick={handleApply} disabled={submitting || !quantity || Number(quantity) <= 0}>
            <PackageCheck className="mr-2 size-4" />
            {submitting ? "Submitting…" : "Submit application"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
