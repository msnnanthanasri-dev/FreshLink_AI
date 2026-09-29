import { useQuery } from "convex/react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { api } from "@/convex/_generated/api";
import { AppLayout, PageLoading } from "@/components/AppLayout";
import { Counter } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Scale, Handshake, Network, Building2, Store, HeartHandshake, Sprout } from "lucide-react";

const COLORS = ["#1e4d2b", "#7fb069", "#ff6b4a", "#e9b44c", "#4a7c59"];

export default function Impact() {
  const data = useQuery(api.insights.impact, {});

  if (data === undefined) {
    return (
      <AppLayout title="Impact Analytics">
        <PageLoading />
      </AppLayout>
    );
  }

  const p = data.platform;

  return (
    <AppLayout title="Impact Analytics" subtitle="Live sustainability metrics from every completed redistribution.">
      {/* Hero counters */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-forest-deep p-8 text-white">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-lime">
          <Sprout className="size-4" /> FreshLink Impact
        </p>
        <div className="mt-5 grid grid-cols-2 gap-8 lg:grid-cols-4">
          {[
            { icon: Scale, label: "Food redistributed", value: p.foodRedistributed, unit: "kg" },
            { icon: Network, label: "Successful matches", value: p.successfulMatches, unit: "" },
            { icon: Handshake, label: "Pickups completed", value: p.pickupsCompleted, unit: "" },
            { icon: Building2, label: "Organizations connected", value: p.organizations, unit: "" },
          ].map((s) => (
            <div key={s.label}>
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
                <s.icon className="size-3.5" /> {s.label}
              </p>
              <p className="mt-1.5 font-display text-4xl font-semibold text-lime">
                <Counter value={s.value} />
                {s.unit && <span className="ml-1.5 text-lg text-lime/70">{s.unit}</span>}
              </p>
            </div>
          ))}
        </div>
        {data.mine.kg > 0 && (
          <p className="mt-6 border-t border-white/15 pt-4 text-sm text-white/70">
            Your organization's contribution: <span className="font-bold text-lime">{data.mine.kg.toLocaleString()} kg</span> across{" "}
            {data.mine.transactions} completed transaction{data.mine.transactions === 1 ? "" : "s"}.
          </p>
        )}
      </div>

      {/* Secondary stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Active Suppliers", value: p.activeSuppliers, icon: Store },
          { label: "Active Recipients", value: p.activeRecipients, icon: HeartHandshake },
          { label: "Active Listings", value: p.activeListings, icon: Sprout },
          { label: "Available Now", value: p.availableKg, icon: Scale },
          { label: "Pickup Success Rate", value: p.pickupSuccessRate, icon: Handshake, suffix: "%" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <s.icon className="size-4.5 text-leaf" />
              <p className="mt-2 font-display text-2xl font-semibold text-forest">
                {s.value.toLocaleString()}
                {s.suffix ?? ""}
              </p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="font-display text-lg font-semibold">Food redistributed over time</h2>
            <p className="mb-4 text-xs text-muted-foreground">Kilograms per week, last 8 weeks</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.weeks} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="kgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7fb069" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#7fb069" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2ddcd" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v} kg`, "Redistributed"]} />
                  <Area type="monotone" dataKey="kg" stroke="#1e4d2b" strokeWidth={2.5} fill="url(#kgGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="font-display text-lg font-semibold">Food category distribution</h2>
            <p className="mb-4 text-xs text-muted-foreground">All-time redistributed kg by category</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.categoryData} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2ddcd" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v} kg`, "Redistributed"]} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {data.categoryData.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="font-display text-lg font-semibold">Fresh vs prepared vs packaged</h2>
            <p className="mb-4 text-xs text-muted-foreground">Composition of redistributed food</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.foodTypeData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} strokeWidth={0}>
                    {data.foodTypeData.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [`${v} kg`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="font-display text-lg font-semibold">Top contributors</h2>
            <p className="mb-4 text-xs text-muted-foreground">Suppliers and recipients by redistributed kg</p>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-forest">Suppliers</p>
                {data.topSuppliers.map((s, i) => (
                  <div key={s.name} className="mb-1.5 flex items-center gap-3">
                    <span className="w-40 truncate text-sm font-medium sm:w-56">{s.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-forest" style={{ width: `${(s.kg / data.topSuppliers[0].kg) * 100}%` }} />
                    </div>
                    <span className="w-16 text-right text-xs font-semibold text-muted-foreground">{s.kg} kg</span>
                    <span className="sr-only">rank {i + 1}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-forest">Recipients</p>
                {data.topRecipients.map((s) => (
                  <div key={s.name} className="mb-1.5 flex items-center gap-3">
                    <span className="w-40 truncate text-sm font-medium sm:w-56">{s.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-coral" style={{ width: `${(s.kg / data.topRecipients[0].kg) * 100}%` }} />
                    </div>
                    <span className="w-16 text-right text-xs font-semibold text-muted-foreground">{s.kg} kg</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
