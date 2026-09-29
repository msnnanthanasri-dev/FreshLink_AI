import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { Link, useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { AppLayout, PageLoading } from "@/components/AppLayout";
import { LiveFoodFlow } from "@/components/food-flow";
import {
  Counter,
  StatusBadge,
  UrgencyBadge,
  CompatibilityScore,
  fmtQty,
  timeLeft,
  time24to12,
  dateKeyToLabel,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Apple,
  FileText,
  Network,
  Truck,
  Scale,
  Sprout,
  AlertTriangle,
  Brain,
  ArrowRight,
  Users,
  Search,
} from "lucide-react";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

function firstName(name?: string) {
  return (name ?? "").split(" ")[0] || "there";
}

function Thumb({ src, alt, className = "size-12" }: { src?: string; alt: string; className?: string }) {
  if (!src) {
    return (
      <span className={`flex ${className} items-center justify-center rounded-lg bg-secondary text-leaf`}>
        <Apple className="size-5" />
      </span>
    );
  }
  return <img src={src} alt={alt} className={`${className} rounded-lg border object-cover`} loading="lazy" />;
}

export default function Dashboard() {
  const profile = useQuery(api.users.myProfile);
  const data = useQuery(api.dashboard.dashboard, {});
  const isSeeded = useQuery(api.accounts.isSeeded, {});
  const ensureSeed = useMutation(api.accounts.ensureSeed);

  // Idempotent first-run seeding of the demo world.
  useEffect(() => {
    if (isSeeded === false) {
      ensureSeed({}).catch(() => {});
    }
  }, [isSeeded, ensureSeed]);

  const navigate = useNavigate();

  if (profile === undefined || data === undefined) {
    return (
      <AppLayout title="Dashboard">
        <PageLoading />
      </AppLayout>
    );
  }

  const role = profile?.user?.role;

  return (
    <AppLayout
      title={`Good ${greeting()}, ${firstName(profile?.user?.name)}`}
      subtitle="Here is what is moving through your food network today."
    >
      {data === null ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Your dashboard is being prepared. If this message persists, refresh the page.
          </CardContent>
        </Card>
      ) : (
        <DashboardBody data={data} role={role ?? "recipient"} navigate={navigate} />
      )}
    </AppLayout>
  );
}

type DashData = NonNullable<typeof import("@/convex/_generated/api").api.dashboard.dashboard._returnType>;

function statCards(d: DashData) {
  if (d.role === "supplier") {
    return [
      { label: "Active Surplus", value: d.stats.activeKg, icon: Apple, href: "/surplus" },
      { label: "Applications", value: d.stats.applicationsReceived, icon: FileText, href: "/applications" },
      { label: "AI Proposals", value: d.stats.aiRecommendations, icon: Brain, href: "/allocations" },
      { label: "Approved", value: d.stats.approvedAllocations, icon: Network, href: "/allocations" },
      { label: "Today's Pickups", value: d.stats.todaysPickups, icon: Truck, href: "/pickups" },
      { label: "Redistributed", value: d.stats.redistributed, icon: Scale, href: "/impact" },
    ];
  }
  if (d.role === "recipient") {
    return [
      { label: "Available Food", value: d.stats.availableKg, icon: Apple, href: "/surplus" },
      { label: "My Applications", value: d.stats.activeApplications, icon: FileText, href: "/applications" },
      { label: "Approved", value: d.stats.approvedAllocations, icon: Network, href: "/allocations" },
      { label: "Upcoming Pickups", value: d.stats.upcomingPickups, icon: Truck, href: "/pickups" },
      { label: "Food Collected", value: d.stats.foodCollected, icon: Scale, href: "/impact" },
      { label: "Network Impact", value: d.impact.totalKg, icon: Sprout, href: "/impact" },
    ];
  }
  return [
    { label: "Total Listed", value: d.stats.totalListed, icon: Apple, href: "/surplus" },
    { label: "Redistributed", value: d.stats.totalRedistributed, icon: Scale, href: "/impact" },
    { label: "Active Listings", value: d.stats.activeListings, icon: Sprout, href: "/surplus" },
    { label: "Pending Apps", value: d.stats.pendingApplications, icon: FileText, href: "/applications" },
    { label: "Active Pickups", value: d.stats.activePickups, icon: Truck, href: "/pickups" },
    { label: "Completed", value: d.stats.completedTransactions, icon: Users, href: "/history" },
  ];
}

function DashboardBody({ data, navigate }: { data: DashData; role: string; navigate: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {statCards(data).map((s) => (
          <Link key={s.label} to={s.href} className="card-hover rounded-xl border bg-card p-4">
            <s.icon className="size-4.5 text-leaf" />
            <p className="mt-2.5 font-display text-2xl font-semibold text-forest">{s.value.toLocaleString()}</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
          </Link>
        ))}
      </div>

      {data.role === "supplier" && <SupplierDashboard data={data} />}
      {data.role === "recipient" && <RecipientDashboard data={data} />}
      {data.role === "admin" && <AdminDashboard data={data} />}
    </div>
  );
}

/* ---------------- SUPPLIER ---------------- */

function SupplierDashboard({ data }: { data: Extract<DashData, { role: "supplier" }> }) {
  const navigate = useNavigate();
  const propose = useMutation(api.allocations.propose);

  return (
    <>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <AlertTriangle className="size-4.5 text-coral" /> Urgent surplus
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/surplus")}>
            All surplus <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>
        {data.urgentListings.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
              <Sprout className="size-5 text-leaf" />
              No urgent items right now — your surplus has healthy time windows.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {data.urgentListings.map((l) => (
              <Card key={l._id} className="card-hover border-coral/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Thumb src={l.photoUrl} alt={l.title} />
                      <div>
                        <p className="text-sm font-semibold">{l.title}</p>
                        <p className="font-display text-xl font-semibold text-forest">{fmtQty(l.quantity, l.unit)}</p>
                      </div>
                    </div>
                    <UrgencyBadge urgency={l.urgency} />
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {l.preparedAt && (
                      <p>
                        Prepared: {new Date(l.preparedAt).toLocaleString("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      </p>
                    )}
                    <p>Pickup deadline: {timeLeft(l.pickupDeadline)}</p>
                    <p>
                      Applications: {l.applications} · AI: {l.compatibleCount} compatible recipients
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate(`/surplus/${l._id}`)}>
                      View
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-forest hover:bg-forest/90"
                      disabled={l.applications === 0}
                      onClick={async () => {
                        try {
                          await propose({ listingId: l._id });
                          toast.success("AI allocation proposal generated");
                          navigate(`/surplus/${l._id}`);
                        } catch (e: any) {
                          toast.error(e?.message ?? "Could not generate proposal");
                        }
                      }}
                    >
                      <Brain className="mr-1 size-3.5" /> Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <FileText className="size-4.5 text-leaf" /> Latest applications
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/applications")}>
              All <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </div>
          <Card>
            <CardContent className="divide-y p-0">
              {data.pendingApps.length === 0 && (
                <p className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
                  <Search className="size-4" /> No applications yet. Listing more surplus increases visibility.
                </p>
              )}
              {data.pendingApps.map((a) => (
                <div key={a._id} className="flex items-center gap-3 p-4">
                  <CompatibilityScore score={a.aiScore ?? 0} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.recipientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtQty(a.quantity, a.unit)} · {a.listingTitle}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/applications?highlight=${a._id}`)}>
                    Review
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Truck className="size-4.5 text-leaf" /> Today's pickups
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/pickups")}>
              All <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </div>
          <Card>
            <CardContent className="divide-y p-0">
              {data.todaysPickupList.length === 0 && (
                <p className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
                  <Truck className="size-4" /> No pickups scheduled for today.
                </p>
              )}
              {data.todaysPickupList.map((p) => (
                <div key={p._id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {p.title} · {fmtQty(p.quantity, p.unit)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.recipientName} · {time24to12(p.time)}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/pickups/${p._id}`)}>
                    View
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>

      {data.todaysPickupList.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <Network className="size-4.5 text-leaf" /> Live in your network
          </h2>
          <LiveFoodFlow
            supplier={data.org?.name ?? "Your organization"}
            food={data.todaysPickupList[0].title}
            quantity={fmtQty(data.todaysPickupList[0].quantity, data.todaysPickupList[0].unit)}
            recipients={data.todaysPickupList.map((p) => ({ name: p.recipientName, share: fmtQty(p.quantity, p.unit) }))}
            caption="scheduled today"
          />
        </section>
      )}
    </>
  );
}

/* ---------------- RECIPIENT ---------------- */

function RecipientDashboard({ data }: { data: Extract<DashData, { role: "recipient" }> }) {
  const navigate = useNavigate();
  return (
    <>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Brain className="size-4.5 text-leaf" /> AI recommended for you
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/surplus")}>
            Browse all <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>
        {data.recommended.length === 0 ? (
          <Card>
            <CardContent className="py-5 text-sm text-muted-foreground">
              No surplus available right now — check back soon.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {data.recommended.map((r) => (
              <Card key={r._id} className="card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <Thumb src={r.photoUrl} alt={r.title} />
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-leaf">Compatibility</span>
                      <CompatibilityScore score={r.compatibility} size="sm" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-semibold">{r.title}</p>
                  <p className="font-display text-xl font-semibold text-forest">{fmtQty(r.quantity, r.unit)}</p>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p>
                      {r.supplierName} · {r.distanceKm !== null ? `${Math.round(r.distanceKm * 10) / 10} km` : "nearby"}
                    </p>
                    <p>Pickup by: {timeLeft(r.pickupDeadline)}</p>
                    {r.urgency !== "normal" && <UrgencyBadge urgency={r.urgency} />}
                  </div>
                  <p className="mt-2 rounded-md bg-leaf/5 p-2 text-[11.5px] italic text-charcoal/70">“{r.reason}”</p>
                  <Button size="sm" className="mt-3 w-full bg-forest hover:bg-forest/90" onClick={() => navigate(`/surplus/${r._id}`)}>
                    View &amp; apply
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <FileText className="size-4.5 text-leaf" /> My applications
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/applications")}>
              All <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </div>
          <Card>
            <CardContent className="divide-y p-0">
              {data.myApplications.length === 0 && (
                <p className="p-5 text-sm text-muted-foreground">
                  You haven't applied for any surplus yet.{" "}
                  <Link className="font-semibold text-forest hover:underline" to="/surplus">
                    Find food →
                  </Link>
                </p>
              )}
              {data.myApplications.map((a) => (
                <div key={a._id} className="flex items-center gap-3 p-4">
                  <CompatibilityScore score={a.aiScore ?? 0} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.listingTitle}</p>
                    <p className="text-xs text-muted-foreground">{fmtQty(a.quantity, a.unit)}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Truck className="size-4.5 text-leaf" /> Upcoming pickups
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/pickups")}>
              All <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </div>
          <Card>
            <CardContent className="divide-y p-0">
              {data.upcomingPickupList.length === 0 && (
                <p className="p-5 text-sm text-muted-foreground">No upcoming pickups. Approved applications appear here automatically.</p>
              )}
              {data.upcomingPickupList.map((p) => (
                <div key={p._id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {p.title} · {fmtQty(p.quantity, p.unit)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      From {p.supplierName} · {dateKeyToLabel(p.date)} {time24to12(p.time)}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/pickups/${p._id}`)}>
                    View
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>

      {data.upcomingPickupList.length > 0 && (
        <LiveFoodFlow
          supplier={data.upcomingPickupList[0].supplierName}
          food={data.upcomingPickupList[0].title}
          quantity={fmtQty(data.upcomingPickupList[0].quantity, data.upcomingPickupList[0].unit)}
          recipients={[{ name: data.org?.name ?? "You", share: fmtQty(data.upcomingPickupList[0].quantity, data.upcomingPickupList[0].unit) }]}
          caption="your incoming food"
        />
      )}
    </>
  );
}

/* ---------------- ADMIN ---------------- */

function AdminDashboard({ data }: { data: Extract<DashData, { role: "admin" }> }) {
  const navigate = useNavigate();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <AlertTriangle className="size-4.5 text-coral" /> Flagged listings
        </h2>
        <Card>
          <CardContent className="divide-y p-0">
            {data.flaggedListings.length === 0 && <p className="p-5 text-sm text-muted-foreground">No flagged listings.</p>}
            {data.flaggedListings.map((l) => (
              <div key={l._id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {l.title} · {fmtQty(l.quantity, l.unit)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.supplierName} — {l.flagReason}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate(`/surplus/${l._id}`)}>
                  Review
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <FileText className="size-4.5 text-leaf" /> Pending applications
        </h2>
        <Card>
          <CardContent className="divide-y p-0">
            {data.pendingApplications.length === 0 && <p className="p-5 text-sm text-muted-foreground">No pending applications.</p>}
            {data.pendingApplications.map((a) => (
              <div key={a._id} className="flex items-center gap-3 p-4">
                <CompatibilityScore score={a.aiScore ?? 0} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{data.listingTitles?.[a.listingId] ?? "Listing"}</p>
                  <p className="text-xs text-muted-foreground">{fmtQty(a.requestedQuantity, a.unit)}</p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="lg:col-span-2">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <Truck className="size-4.5 text-leaf" /> Active pickups
        </h2>
        <Card>
          <CardContent className="divide-y p-0">
            {data.activePickups.length === 0 && <p className="p-5 text-sm text-muted-foreground">No active pickups.</p>}
            {data.activePickups.map((p) => (
              <div key={p._id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{fmtQty(p.quantity, p.unit)}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateKeyToLabel(p.scheduledDate)} · {time24to12(p.scheduledTime)}
                  </p>
                </div>
                <StatusBadge status={p.status} />
                <Button size="sm" variant="ghost" onClick={() => navigate(`/pickups/${p._id}`)}>
                  View
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
