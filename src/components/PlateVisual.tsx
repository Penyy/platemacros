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

const SIZE = 240;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 112; // outer ring radius
const R_PLATE = 92; // plate edge
const R_INNER = 78; // food area

// Segmented macro ring (3 arcs around plate)
function MacroArc({
  pct,
  color,
  startAngle,
  endAngle,
}: {
  pct: number;
  color: string;
  startAngle: number; // degrees, 0 = top
  endAngle: number;
}) {
  const clamp = Math.max(0, Math.min(1, pct));
  const total = endAngle - startAngle;
  const sweep = total * clamp;
  const a0 = (startAngle - 90) * (Math.PI / 180);
  const a1 = (startAngle + sweep - 90) * (Math.PI / 180);
  const aFull = (endAngle - 90) * (Math.PI / 180);

  const p = (ang: number) => ({
    x: CX + R_OUTER * Math.cos(ang),
    y: CY + R_OUTER * Math.sin(ang),
  });

  const bgStart = p(a0);
  const bgEnd = p(aFull);
  const bgLarge = total > 180 ? 1 : 0;

  const fgStart = p(a0);
  const fgEnd = p(a1);
  const fgLarge = sweep > 180 ? 1 : 0;

  return (
    <>
      <path
        d={`M ${bgStart.x} ${bgStart.y} A ${R_OUTER} ${R_OUTER} 0 ${bgLarge} 1 ${bgEnd.x} ${bgEnd.y}`}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeWidth={6}
        strokeLinecap="round"
      />
      {clamp > 0 && (
        <motion.path
          d={`M ${fgStart.x} ${fgStart.y} A ${R_OUTER} ${R_OUTER} 0 ${fgLarge} 1 ${fgEnd.x} ${fgEnd.y}`}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
          style={{ filter: `drop-shadow(0 0 4px ${color}66)` }}
        />
      )}
    </>
  );
}

export function PlateVisual({
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
  const fillPct = Math.max(0, Math.min(1, consumedKcal / goalKcal));
  // Height of food layer rising from bottom of inner circle
  const foodHeight = fillPct * (R_INNER * 2);
  const foodY = CY + R_INNER - foodHeight; // top edge of food

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE}>
        <defs>
          {/* Plate gradient */}
          <radialGradient id="plate-grad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="oklch(1 0 0)" stopOpacity="1" />
            <stop offset="100%" stopColor="oklch(0.92 0.005 260)" stopOpacity="1" />
          </radialGradient>
          {/* Food gradient (warm) */}
          <linearGradient id="food-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.82 0.16 60)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="oklch(0.66 0.22 25)" stopOpacity="0.95" />
          </linearGradient>
          <clipPath id="plate-clip">
            <circle cx={CX} cy={CY} r={R_INNER} />
          </clipPath>
        </defs>

        {/* Macro ring around plate */}
        <g className="text-foreground">
          {/* protein: top third (-60 to 60) */}
          <MacroArc
            pct={protein / goalP}
            color="var(--protein)"
            startAngle={-110}
            endAngle={-10}
          />
          <MacroArc
            pct={carbs / goalC}
            color="var(--carbs)"
            startAngle={10}
            endAngle={110}
          />
          <MacroArc
            pct={fat / goalF}
            color="var(--fat)"
            startAngle={130}
            endAngle={230}
          />
        </g>

        {/* Plate outer rim */}
        <circle
          cx={CX}
          cy={CY}
          r={R_PLATE}
          fill="url(#plate-grad)"
          stroke="oklch(0.85 0.005 260)"
          strokeWidth={1}
          style={{ filter: "drop-shadow(0 6px 14px oklch(0 0 0 / 0.10))" }}
        />
        {/* Plate inner well */}
        <circle
          cx={CX}
          cy={CY}
          r={R_INNER}
          fill="oklch(0.97 0.003 260)"
          stroke="oklch(0.88 0.005 260)"
          strokeWidth={1}
        />

        {/* Food fill rising from bottom */}
        <g clipPath="url(#plate-clip)">
          <motion.rect
            x={CX - R_INNER}
            width={R_INNER * 2}
            fill="url(#food-grad)"
            initial={false}
            animate={{ y: foodY, height: foodHeight }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
          />
          {/* subtle wavy highlight at top of food */}
          <motion.ellipse
            cx={CX}
            rx={R_INNER * 0.9}
            ry={3}
            fill="oklch(1 0 0 / 0.35)"
            initial={false}
            animate={{ cy: foodY + 1, opacity: fillPct > 0.02 ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
          />
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {over ? "ponad cel" : "pozostało"}
        </div>
        <div
          className={`num-tight text-5xl font-bold ${
            over ? "text-[color:var(--protein)]" : ""
          }`}
          style={{ textShadow: "0 1px 2px oklch(1 0 0 / 0.6)" }}
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
