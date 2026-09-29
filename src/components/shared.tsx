import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";

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
