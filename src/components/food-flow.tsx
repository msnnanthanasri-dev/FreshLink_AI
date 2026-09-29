import { motion } from "framer-motion";

/**
 * FreshLink "Food Flow Network" — the signature visual. Animated curved
 * connection lines with moving particles show food moving from a supplier
 * through AI matching to recipients.
 */

const FOREST = "#1e4d2b";
const LEAF = "#4a7c59";
const LIME = "#9bc53d";
const CORAL = "#ff6b4a";

function FlowParticle({ delay, dur = 2.8 }: { delay: number; dur?: number }) {
  return (
    <circle r="3" fill={LIME} className="flow-particle">
      <animateMotion
        dur={`${dur}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
        path="M0,0"
        rotate="auto"
      />
    </circle>
  );
}

interface HeroFlowProps {
  className?: string;
}

/** Hero: supermarket → AI matching → three recipients, animated. */
export function HeroFoodFlow({ className }: HeroFlowProps) {
  return (
    <svg
      viewBox="0 0 640 440"
      className={className}
      role="img"
      aria-label="Animated diagram: food flowing from a supermarket through AI matching to a juice shop, an NGO and a community kitchen"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={LEAF} />
        </marker>
      </defs>

      {/* connective curves */}
      <motion.path
        d="M 320 118 C 320 150, 320 160, 320 178"
        stroke={LEAF}
        strokeWidth="2"
        fill="none"
        markerEnd="url(#arrow)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, delay: 0.4 }}
      />
      <motion.path
        d="M 320 262 C 320 300, 140 290, 128 322"
        stroke={LIME}
        strokeWidth="2"
        fill="none"
        className="flow-dash"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 0.9 }}
      />
      <motion.path
        d="M 320 262 C 320 300, 320 300, 320 322"
        stroke={LIME}
        strokeWidth="2"
        fill="none"
        className="flow-dash"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 1.05 }}
      />
      <motion.path
        d="M 320 262 C 320 300, 500 290, 512 322"
        stroke={LIME}
        strokeWidth="2"
        fill="none"
        className="flow-dash"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
      />

      {/* moving particles along the main corridors */}
      <circle r="4" fill={CORAL}>
        <animateMotion dur="2.6s" repeatCount="indefinite" path="M 320 118 C 320 150, 320 160, 320 178" />
      </circle>
      <circle r="3.5" fill={LIME}>
        <animateMotion dur="3.2s" repeatCount="indefinite" path="M 320 262 C 320 300, 140 290, 128 322" />
      </circle>
      <circle r="3.5" fill={LIME}>
        <animateMotion dur="3.2s" begin="0.9s" repeatCount="indefinite" path="M 320 262 C 320 300, 320 300, 320 322" />
      </circle>
      <circle r="3.5" fill={LIME}>
        <animateMotion dur="3.2s" begin="1.7s" repeatCount="indefinite" path="M 320 262 C 320 300, 500 290, 512 322" />
      </circle>

      {/* supplier node */}
      <g>
        <rect x="240" y="52" width="160" height="66" rx="14" fill="#ffffff" stroke={FOREST} strokeWidth="1.6" />
        <text x="320" y="80" textAnchor="middle" fontSize="15" fontWeight="700" fill={FOREST}>GreenLeaf Supermarket</text>
        <text x="320" y="100" textAnchor="middle" fontSize="11.5" fill="#66715f">200 kg Apples · Bread · Milk</text>
      </g>

      {/* AI node */}
      <g className="node-glow">
        <rect x="252" y="178" width="136" height="84" rx="18" fill={FOREST} />
        <text x="320" y="212" textAnchor="middle" fontSize="12" fill="#cfe8c5" letterSpacing="1.5">AI MATCHING</text>
        <text x="320" y="232" textAnchor="middle" fontSize="11" fill="#9bc53d">compatibility · quantity</text>
        <text x="320" y="248" textAnchor="middle" fontSize="11" fill="#9bc53d">time · distance</text>
      </g>

      {/* recipient nodes */}
      {[
        { x: 128, label: "Juice Corner", sub: "80 kg" },
        { x: 320, label: "Community Kitchen", sub: "50 kg" },
        { x: 512, label: "Food Processor", sub: "70 kg" },
      ].map((n, i) => (
        <motion.g
          key={n.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 + i * 0.15 }}
        >
          <rect x={n.x - 92} y="322" width="184" height="58" rx="13" fill="#ffffff" stroke={LEAF} strokeWidth="1.4" />
          <text x={n.x} y="346" textAnchor="middle" fontSize="12.5" fontWeight="600" fill={FOREST}>{n.label}</text>
          <text x={n.x} y="364" textAnchor="middle" fontSize="11" fill={CORAL}>{n.sub}</text>
        </motion.g>
      ))}

      <text x="320" y="424" textAnchor="middle" fontSize="12" fill="#4a7c59" fontWeight="600">
        ✓ 200 kg allocated across 3 recipients — nothing wasted
      </text>
    </svg>
  );
}

interface LiveFlowProps {
  supplier: string;
  food: string;
  quantity: string;
  recipients: Array<{ name: string; share: string }>;
  caption?: string;
  compact?: boolean;
}

/**
 * LIVE FOOD FLOW card used in dashboards: one live transaction visualized.
 */
export function LiveFoodFlow({ supplier, food, quantity, recipients, caption, compact }: LiveFlowProps) {
  const h = compact ? 200 : 236;
  const rowY = 150;
  return (
    <div className="overflow-hidden rounded-xl border bg-ivory">
      <div className="flex items-center justify-between border-b bg-secondary/60 px-4 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-leaf" />
          </span>
          Live Food Flow
        </span>
        {caption && <span className="text-[11px] text-muted-foreground">{caption}</span>}
      </div>
      <svg viewBox={`0 0 620 ${h}`} className="w-full" role="img" aria-label={`Food flow from ${supplier} to recipients`}>
        <text x="40" y="34" fontSize="13" fontWeight="700" fill={FOREST}>{supplier}</text>
        <text x="40" y="52" fontSize="11.5" fill="#66715f">{food}</text>

        <path d={`M 300 46 C 300 70, 300 78, 300 92`} stroke={LEAF} strokeWidth="1.8" fill="none" markerEnd="url(#arrow2)" />
        <defs>
          <marker id="arrow2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={LEAF} />
          </marker>
        </defs>
        <circle r="3.5" fill={CORAL}>
          <animateMotion dur="2.4s" repeatCount="indefinite" path="M 300 46 C 300 70, 300 78, 300 92" />
        </circle>

        <rect x="234" y="92" width="132" height="34" rx="10" fill={FOREST} />
        <text x="300" y="113" textAnchor="middle" fontSize="11" fill="#cfe8c5" letterSpacing="1.4">AI MATCHING</text>

        {recipients.slice(0, 3).map((r, i) => {
          const y = rowY - 24 + i * (compact ? 24 : 28);
          const d = `M 300 126 C 300 ${y - 26}, 320 ${y - 8}, 372 ${y}`;
          return (
            <g key={r.name}>
              <path d={d} stroke={LIME} strokeWidth="1.6" fill="none" className="flow-dash" />
              <circle r="3" fill={LIME}>
                <animateMotion dur="3s" begin={`${i * 0.8}s`} repeatCount="indefinite" path={d} />
              </circle>
              <text x="380" y={y + 4} fontSize="12" fontWeight="600" fill={FOREST}>{r.name}</text>
              <text x="560" y={y + 4} fontSize="11" fill={CORAL} textAnchor="end">{r.share}</text>
            </g>
          );
        })}
        {quantity && (
          <text x="40" y={h - 14} fontSize="11.5" fontWeight="600" fill={LEAF}>
            {quantity} in motion through the network
          </text>
        )}
      </svg>
    </div>
  );
}

/** Small inline animated "chain" used inside detail pages (approval → pickup → impact). */
export function FlowChain({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center">
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              i < activeIndex
                ? "border-leaf/50 bg-leaf/10 text-leaf"
                : i === activeIndex
                  ? "border-coral/60 bg-coral/10 text-coral"
                  : "border-border bg-background text-muted-foreground"
            }`}
          >
            {i < activeIndex ? "✓" : i === activeIndex ? "●" : "○"} {s}
          </span>
          {i < steps.length - 1 && (
            <span className={`mx-1.5 h-px w-4 sm:w-6 ${i < activeIndex ? "bg-leaf" : "bg-border"}`} />
          )}
        </li>
      ))}
    </ol>
  );
}
