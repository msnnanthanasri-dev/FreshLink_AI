import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { BadgeCheck, Clock, AlertTriangle, XCircle, Info, ShieldCheck } from "lucide-react";

/** Animated counter that eases to its target when scrolled into view. */
export function Counter({
  value,
  duration = 1400,
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const { ref, inView } = useInView({ threshold: 0.4 });
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  // listings
  available: "bg-leaf/10 text-leaf border-leaf/30",
  partially_allocated: "bg-harvest/15 text-[#8a6414] border-harvest/40",
  fully_allocated: "bg-forest/10 text-forest border-forest/30",
  completed: "bg-forest/10 text-forest border-forest/30",
  expired: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
  flagged: "bg-destructive/10 text-destructive border-destructive/30",
  // applications
  submitted: "bg-secondary text-secondary-foreground border-border",
  under_review: "bg-harvest/15 text-[#8a6414] border-harvest/40",
  ai_evaluated: "bg-leaf/10 text-leaf border-leaf/30",
  approved: "bg-forest/10 text-forest border-forest/30",
  partially_approved: "bg-harvest/15 text-[#8a6414] border-harvest/40",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  pickup_scheduled: "bg-forest/10 text-forest border-forest/30",
  picked_up: "bg-leaf/10 text-leaf border-leaf/30",
  // allocations
  proposed: "bg-harvest/15 text-[#8a6414] border-harvest/40",
  // pickups
  scheduled: "bg-forest/10 text-forest border-forest/30",
  ready: "bg-leaf/10 text-leaf border-leaf/30",
  on_the_way: "bg-coral/10 text-coral border-coral/30",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  partially_allocated: "Partially allocated",
  fully_allocated: "Fully allocated",
  completed: "Completed",
  expired: "Expired",
  cancelled: "Cancelled",
  flagged: "Flagged",
  submitted: "Submitted",
  under_review: "Under review",
  ai_evaluated: "AI evaluated",
  approved: "Approved",
  partially_approved: "Partially approved",
  rejected: "Rejected",
  pickup_scheduled: "Pickup scheduled",
  picked_up: "Picked up",
  proposed: "AI proposed",
  scheduled: "Scheduled",
  ready: "Pickup ready",
  on_the_way: "On the way",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border"} ${className ?? ""}`}
    >
      {STATUS_LABELS[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  if (urgency === "normal") return null;
  const styles: Record<string, string> = {
    attention: "bg-harvest/15 text-[#8a6414] border-harvest/40",
    urgent: "bg-coral/10 text-coral border-coral/40",
    critical: "bg-destructive/10 text-destructive border-destructive/40",
  };
  const labels: Record<string, string> = {
    attention: "Attention",
    urgent: "Urgent",
    critical: "Critical",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles[urgency]}`}>
      {labels[urgency]}
    </span>
  );
}

export function CompatibilityScore({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color = score >= 80 ? "text-forest" : score >= 60 ? "text-leaf" : "text-harvest";
  const ring = score >= 80 ? "border-forest/40 bg-forest/10" : score >= 60 ? "border-leaf/40 bg-leaf/10" : "border-harvest/40 bg-harvest/10";
  const sizes = { sm: "size-9 text-sm", md: "size-12 text-base", lg: "size-16 text-xl" };
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border-2 font-bold ${ring} ${color} ${sizes[size]}`}
      title={`Compatibility score ${score}/100`}
    >
      {score}
    </div>
  );
}

export function fmtQty(q: number, unit: string): string {
  const rounded = Math.round(q * 10) / 10;
  return `${rounded.toLocaleString()} ${unit}`;
}

export function timeLeft(deadline: number): string {
  const ms = deadline - Date.now();
  if (ms <= 0) return "Deadline passed";
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))} min left`;
  if (h < 24) return `${Math.round(h)} h left`;
  return `${Math.round(h / 24)} days left`;
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function dateKeyToLabel(key: string): string {
  const today = new Date();
  const k = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(today.getTime() + 24 * 3_600_000);
  if (key === k(today)) return "Today";
  if (key === k(tomorrow)) return "Tomorrow";
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

export function time24to12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}

/* ---------------- FSSAI compliance UI ---------------- */

/** Masked FSSAI number for public display: "••••••••••4821". */
export function maskFssai(num?: string | null): string {
  if (!num || num.length < 4) return "—";
  return "••••••••••" + num.slice(-4);
}

export type FssaiStatus = "PENDING" | "VERIFIED" | "REQUIRES_REVIEW" | "REJECTED" | null | undefined;

/**
 * Badge shown next to organizations across the platform.
 * Only renders "✓ FSSAI Verified" when the status is genuinely VERIFIED
 * (by FreshLink admin review — never a government claim).
 */
export function FssaiBadge({
  verified,
  status,
  className = "",
  showMasked,
}: {
  verified?: boolean;
  status?: FssaiStatus;
  className?: string;
  showMasked?: string;
}) {
  if (verified) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-forest/30 bg-forest/10 px-2 py-0.5 text-[11px] font-semibold text-forest whitespace-nowrap ${className}`}
        title="FreshLink Compliance Verified — reviewed by the FreshLink team (not a government verification)"
      >
        <BadgeCheck className="size-3" /> FSSAI Verified
      </span>
    );
  }
  if (showMasked) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground whitespace-nowrap ${className}`}>
        FSSAI {showMasked}
      </span>
    );
  }
  return null;
}

/** Full status pill for compliance views (Settings, Admin, dashboards). */
export function FssaiStatusPill({ status, className = "" }: { status: FssaiStatus; className?: string }) {
  const styles: Record<string, string> = {
    VERIFIED: "bg-forest/10 text-forest border-forest/30",
    PENDING: "bg-harvest/15 text-[#8a6414] border-harvest/40",
    REQUIRES_REVIEW: "bg-coral/10 text-coral border-coral/30",
    REJECTED: "bg-destructive/10 text-destructive border-destructive/30",
  };
  const labels: Record<string, { icon: typeof Clock; text: string }> = {
    VERIFIED: { icon: BadgeCheck, text: "FreshLink Compliance Verified" },
    PENDING: { icon: Clock, text: "FSSAI Verification Pending" },
    REQUIRES_REVIEW: { icon: AlertTriangle, text: "FSSAI Review Required" },
    REJECTED: { icon: XCircle, text: "FSSAI Verification Required" },
  };
  if (!status) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground ${className}`}>
        <Info className="size-3.5" /> Not submitted
      </span>
    );
  }
  const s = styles[status] ?? styles.PENDING;
  const l = labels[status] ?? labels.PENDING;
  const Icon = l.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap ${s} ${className}`}>
      <Icon className="size-3.5" /> {l.text}
    </span>
  );
}

/** Compact multi-factor checklist used in the dashboard compliance widget. */
export function FssaiChecklist({
  submitted,
  certificate,
  verified,
}: {
  submitted: boolean;
  certificate: boolean;
  verified: boolean;
}) {
  const rows = [
    { ok: submitted, label: "FSSAI information submitted" },
    { ok: certificate, label: "Certificate uploaded" },
    { ok: verified, label: "FreshLink verification completed" },
  ];
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2 text-sm">
          {r.ok ? (
            <BadgeCheck className="size-4 shrink-0 text-forest" />
          ) : (
            <Clock className="size-4 shrink-0 text-harvest" />
          )}
          <span className={r.ok ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Dashboard "Compliance status" widget for supplier & recipient dashboards.
 * Reads the viewer's own org (from myProfile) so both roles get the same card.
 */
export function ComplianceWidget() {
  const profile = useQuery(api.users.myProfile);
  if (profile === undefined || profile === null) return null;
  const org = (profile as any).org;
  if (!org || (profile as any).user?.role === "admin") return null;
  const status = org.fssaiVerificationStatus as FssaiStatus;
  const submitted = Boolean(org.fssaiNumber);
  const certificate = Boolean(org.fssaiCertificateUrl);
  const verified = status === "VERIFIED";
  return (
    <Card className="border-forest/25">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-display text-base font-semibold">
            <ShieldCheck className="size-4.5 text-forest" /> Compliance status
          </p>
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Demo data</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <FssaiChecklist submitted={submitted} certificate={certificate} verified={verified} />
          <div className="text-right">
            <FssaiStatusPill status={status} />
            {!verified && (
              <a href="/settings" className="mt-1.5 block text-xs font-semibold text-forest hover:underline">
                Complete your compliance profile →
              </a>
            )}
          </div>
        </div>
        {!submitted && (
          <p className="mt-2 text-xs text-muted-foreground">
            Complete your compliance profile to continue with applicable food activities.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
