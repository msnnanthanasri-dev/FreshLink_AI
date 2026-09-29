import { motion } from "framer-motion";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HeroFoodFlow } from "@/components/food-flow";
import { Counter } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Sprout,
  Apple,
  Network,
  Truck,
  BarChart3,
  Brain,
  Camera,
  MapPin,
  ShieldCheck,
  ArrowRight,
  Building2,
  HeartHandshake,
  Store,
  UtensilsCrossed,
  Wheat,
  Leaf,
  Sparkles,
} from "lucide-react";

const FLOW_STEPS = [
  { icon: Store, title: "Surplus listed", body: "Supermarkets, hotels, bakeries and farms publish what's left — with photos and safety info." },
  { icon: Brain, title: "AI compatibility analysis", body: "Explainable scoring across quantity, time, distance, storage and intended use." },
  { icon: Network, title: "Smart allocation", body: "One listing is split across multiple recipients. Suppliers approve every share." },
  { icon: Truck, title: "Pickup & handoff", body: "Scheduled pickups, dual confirmation, and a record on each organization's history." },
  { icon: BarChart3, title: "Impact you can see", body: "Every completed handoff updates live redistribution analytics." },
];

const ROLES = [
  {
    icon: Store,
    title: "Suppliers",
    body: "Supermarkets, hotels, restaurants, bakeries, farms, distributors and caterers.",
    points: ["List surplus in minutes with real photos", "Review AI compatibility analysis", "Approve allocations and schedule pickups"],
    cta: "List Surplus Food",
    href: "/auth?mode=register&role=supplier",
  },
  {
    icon: HeartHandshake,
    title: "Recipients",
    body: "NGOs, community kitchens, juice shops, food processors and small food businesses.",
    points: ["Browse live surplus near you", "Apply with quantity, use and pickup window", "Track pickups from approval to handoff"],
    cta: "Find Available Food",
    href: "/auth?mode=register&role=recipient",
  },
];

const FOOD_CHIPS = [
  { icon: Apple, label: "Apples" },
  { icon: Wheat, label: "Bread" },
  { icon: Leaf, label: "Vegetables" },
  { icon: UtensilsCrossed, label: "Biryani" },
  { icon: Sparkles, label: "Dairy" },
];

export default function Landing() {
  const impact = useQuery(api.insights.publicImpact, {});

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-forest ring-1 ring-forest/20">
              <Sprout className="size-5 text-lime" />
            </span>
            <span>
              <span className="block font-display text-lg font-semibold leading-tight text-forest">FreshLink AI</span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.24em] text-leaf">Surplus Redistribution</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild className="bg-forest hover:bg-forest/90">
              <Link to="/auth?mode=register">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="topo-texture relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-2 lg:pb-24 lg:pt-20">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf/30 bg-leaf/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf">
              <Sparkles className="size-3.5" /> AI-Assisted Food Redistribution
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-forest sm:text-5xl lg:text-[56px]">
              Turn Surplus
              <br />
              Into <span className="relative inline-block text-coral">Impact<span className="absolute -bottom-1 left-0 h-[3px] w-full bg-coral/40" /></span>.
            </h1>
            <p className="mt-5 max-w-lg text-[15.5px] leading-relaxed text-charcoal/75">
              FreshLink AI connects surplus food with organizations that can use it — intelligently matching
              quantities, time, distance and pickup requirements before food becomes waste.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="bg-forest text-base hover:bg-forest/90">
                <Link to="/auth?mode=register&role=supplier">
                  List Surplus Food <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-forest/30 bg-card text-base text-forest hover:bg-leaf/10">
                <Link to="/auth?mode=register&role=recipient">Find Available Food</Link>
              </Button>
            </div>
            <div className="mt-7 flex flex-wrap gap-2">
              {FOOD_CHIPS.map((f) => (
                <span key={f.label} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-charcoal/80">
                  <f.icon className="size-3.5 text-leaf" /> {f.label}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative rounded-2xl border bg-ivory p-4 shadow-[0_24px_60px_-30px_rgba(18,40,26,0.4)]"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-leaf" />
                </span>
                Food Flow Network
              </span>
              <span className="text-[11px] text-muted-foreground">live demo</span>
            </div>
            <HeroFoodFlow className="w-full" />
          </motion.div>
        </div>
      </section>

      {/* Live impact */}
      <section className="border-y bg-forest-deep py-12 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {[
              { label: "Food Redistributed", value: impact?.foodRedistributed ?? 0, unit: "kg" },
              { label: "Successful Matches", value: impact?.successfulMatches ?? 0, unit: "" },
              { label: "Organizations Connected", value: impact?.organizations ?? 0, unit: "" },
              { label: "Completed Pickups", value: impact?.pickupsCompleted ?? 0, unit: "" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <p className="font-display text-3xl font-semibold text-lime sm:text-4xl">
                  <Counter value={s.value} />
                  {s.unit && <span className="ml-1 text-lg text-lime/80">{s.unit}</span>}
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-coral">The network</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-forest sm:text-4xl">
            Not a donation bin. A redistribution network.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-charcoal/70">
            The problem is never just “who wants this food?” It's which eligible recipient can use this specific
            food, in what quantity, within the available time — and collect, store and handle it appropriately.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {FLOW_STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="card-hover relative rounded-xl border bg-card p-5"
            >
              <span className="absolute right-4 top-4 font-display text-2xl font-semibold text-leaf/25">0{i + 1}</span>
              <span className="flex size-10 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                <s.icon className="size-5" />
              </span>
              <h3 className="mt-3.5 text-[15px] font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="border-y bg-secondary/50 py-16 lg:py-20">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-2">
          {ROLES.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="card-hover flex flex-col rounded-2xl border bg-card p-7"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-forest text-lime">
                <r.icon className="size-6" />
              </span>
              <h3 className="mt-4 font-display text-2xl font-semibold text-forest">{r.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{r.body}</p>
              <ul className="mt-4 space-y-2 text-sm text-charcoal/80">
                {r.points.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-leaf" /> {p}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-fit bg-forest hover:bg-forest/90">
                <Link to={r.href}>
                  {r.cta} <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Signature features strip */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Camera, title: "Show the surplus", body: "Suppliers photograph the actual food — recipients see what really exists." },
            { icon: Brain, title: "Explainable AI", body: "Every match shows its reasons, warnings and score. No black box." },
            { icon: Network, title: "Smart allocation", body: "200 kg → 80 + 50 + 70. One listing, many recipients, supplier approved." },
            { icon: MapPin, title: "GIS pickup map", body: "Live map of suppliers, recipients, food and scheduled pickup routes." },
          ].map((f) => (
            <div key={f.title} className="card-hover rounded-xl border bg-card p-5">
              <f.icon className="size-5 text-coral" />
              <h3 className="mt-3 text-[15px] font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="topo-texture border-t bg-leaf/10">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight text-forest sm:text-4xl">
            Every kilogram redirected is a meal kept, a cost saved, a waste stream closed.
          </h2>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-forest text-base hover:bg-forest/90">
              <Link to="/auth?mode=register">Join the network</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-forest/30 bg-card text-base text-forest">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t bg-forest-deep py-8 text-white/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm sm:flex-row sm:px-6">
          <p className="flex items-center gap-2">
            <Sprout className="size-4 text-lime" /> FreshLink AI — Turn Surplus Into Impact.
          </p>
          <p className="text-xs text-white/50">Food safety information is supplied by listing organizations. Photos are supporting information only.</p>
        </div>
      </footer>
    </div>
  );
}
