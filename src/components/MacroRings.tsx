import { motion } from "framer-motion";

interface Props {
  protein: number;
  carbs: number;
  fat: number;
  goalP: number;
  goalC: number;
  goalF: number;
  remainingKcal: number;
  goalKcal: number;
  consumedKcal: number;
}

function Ring({
  radius,
  stroke,
  pct,
  gradientId,
  from,
  to,
}: {
  radius: number;
  stroke: number;
  pct: number;
  gradientId: string;
  from: string;
  to: string;
}) {
  const c = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <circle
        cx="110"
        cy="110"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.12"
        strokeWidth={stroke}
      />
      <motion.circle
        cx="110"
        cy="110"
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - clamped) }}
        transition={{ type: "spring", stiffness: 80, damping: 20 }}
        transform="rotate(-90 110 110)"
        style={{ filter: `drop-shadow(0 0 6px ${from}55)` }}
      />
    </>
  );
}

export function MacroRings({
  protein,
  carbs,
  fat,
  goalP,
  goalC,
  goalF,
  remainingKcal,
  goalKcal,
  consumedKcal,
}: Props) {
  const over = remainingKcal < 0;

  return (
    <div className="relative mx-auto" style={{ width: 220, height: 220 }}>
      <svg viewBox="0 0 220 220" width="220" height="220">
        <g className="text-foreground">
          <Ring
            radius={96}
            stroke={14}
            pct={protein / goalP}
            gradientId="g-protein"
            from="#FF375F"
            to="#FF7A99"
          />
          <Ring
            radius={76}
            stroke={14}
            pct={carbs / goalC}
            gradientId="g-carbs"
            from="#FF9F0A"
            to="#FFC76B"
          />
          <Ring
            radius={56}
            stroke={14}
            pct={fat / goalF}
            gradientId="g-fat"
            from="#BF5AF2"
            to="#DDA0FF"
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {over ? "ponad cel" : "pozostało"}
        </div>
        <div
          className={`num-tight text-5xl font-bold ${
            over ? "text-[color:var(--protein)]" : ""
          }`}
        >
          {Math.abs(Math.round(remainingKcal))}
        </div>
        <div className="num-tight text-[11px] text-muted-foreground">
          {Math.round(consumedKcal)} / {goalKcal} kcal
        </div>
      </div>
    </div>
  );
}
