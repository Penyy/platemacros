import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, RefreshCw, Scale, Plus } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { usePlate, ymd } from "@/lib/store";
import { buildCoachFacts, fallbackCoachText } from "@/lib/coach";
import { coachReview } from "@/lib/ai-assistant.functions";
import {
  loadWeightLog,
  upsertWeight,
  type WeightEntry,
} from "@/lib/weight";

export const Route = createFileRoute("/coach")({
  head: () => ({
    meta: [
      { title: "Plate — Trener" },
      {
        name: "description",
        content: "Twój proaktywny trener: tydzień w liczbach i konkretna rada.",
      },
    ],
  }),
  component: CoachPage,
});

const REVIEW_KEY = "plate_coach_review_v1";

const CARD: React.CSSProperties = {
  boxShadow: "var(--shadow-card)",
  border: "1px solid var(--hairline)",
  background: "var(--card)",
  borderRadius: 22,
};

interface StoredReview {
  text: string;
  ts: number;
  fallback?: boolean;
}

function CoachPage() {
  const { t, i18n } = useTranslation();
  const lang: "pl" | "en" = (i18n.language || "pl").toLowerCase().startsWith("en")
    ? "en"
    : "pl";
  const entries = usePlate((s) => s.entries);
  const profile = usePlate((s) => s.profile);
  const dayOffs = usePlate((s) => s.dayOffs);
  const runReview = useServerFn(coachReview);

  const today = ymd(new Date());
  const [weightLog, setWeightLog] = useState<WeightEntry[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [review, setReview] = useState<StoredReview | null>(null);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);
  const autoRef = useRef(false);

  const facts = useMemo(
    () => buildCoachFacts(entries, profile, dayOffs, weightLog, today),
    [entries, profile, dayOffs, weightLog, today]
  );

  // Client-only load (avoids SSR hydration mismatch for localStorage data).
  useEffect(() => {
    setWeightLog(loadWeightLog());
    try {
      const raw = localStorage.getItem(REVIEW_KEY);
      if (raw) {
        const r = JSON.parse(raw) as StoredReview;
        if (r && typeof r.text === "string")
          setReview({ text: r.text, ts: r.ts ?? Date.now(), fallback: !!r.fallback });
      }
    } catch {
      /* ignore */
    }
    loadedRef.current = true;
  }, []);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await runReview({ data: { facts, lang } });
      const r: StoredReview = { text: res.text, ts: Date.now(), fallback: false };
      setReview(r);
      try {
        localStorage.setItem(REVIEW_KEY, JSON.stringify(r));
      } catch {
        /* ignore */
      }
    } catch {
      setReview({ text: fallbackCoachText(facts, lang), ts: Date.now(), fallback: true });
    } finally {
      setLoading(false);
    }
  }, [facts, lang, runReview]);

  // Proactive: auto-generate once if nothing is cached yet and there's data.
  useEffect(() => {
    if (!loadedRef.current || autoRef.current) return;
    if (!review && !loading && facts.hasEnoughForReview) {
      autoRef.current = true;
      void generate();
    }
  }, [review, loading, facts.hasEnoughForReview, generate]);

  const addWeight = () => {
    const v = parseFloat(weightInput.replace(",", "."));
    if (!Number.isFinite(v) || v < 20 || v > 400) {
      toast.error(t("coach.weightInvalid"));
      return;
    }
    setWeightLog(upsertWeight(today, v));
    setWeightInput("");
    toast.success(t("coach.weightSaved"));
  };

  const diff = facts.avgIntake - facts.avgGoal;
  const recent = weightLog.slice(-12);

  return (
    <div className="pb-10">
      <ScreenHeader title={t("coach.title")} />
      <div className="px-[18px] space-y-3">
        <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          {t("coach.subtitle")}
        </p>

        {/* Weekly review */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="p-4"
          style={CARD}
        >
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Sparkles size={14} strokeWidth={2} style={{ color: "var(--accent-yellow)" }} />
              {t("coach.reviewTitle")}
            </div>
            {facts.hasEnoughForReview && (
              <button
                onClick={generate}
                disabled={loading}
                aria-label={t("coach.refresh")}
                className="grid h-8 w-8 place-items-center rounded-full active:scale-95 disabled:opacity-50"
                style={{ background: "var(--muted)" }}
              >
                <RefreshCw
                  size={15}
                  strokeWidth={2}
                  style={{ color: "var(--ink)" }}
                  className={loading ? "animate-spin" : ""}
                />
              </button>
            )}
          </div>

          {!facts.hasEnoughForReview ? (
            <p className="mt-3 text-[14px]" style={{ lineHeight: 1.5, color: "var(--ink)" }}>
              {t("coach.needMore")}
            </p>
          ) : loading && !review ? (
            <p className="mt-3 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              {t("coach.analyzing")}
            </p>
          ) : review ? (
            <>
              <p
                className="mt-3 text-[14px]"
                style={{ lineHeight: 1.55, color: "var(--ink)", whiteSpace: "pre-wrap" }}
              >
                {review.text}
              </p>
              <div
                className="mt-2.5 text-[11px] font-semibold"
                style={{ color: "var(--muted-foreground)" }}
              >
                {review.fallback ? t("coach.fallbackNote") : t("coach.aiNote")}
              </div>
            </>
          ) : (
            <button
              onClick={generate}
              className="mt-3 w-full rounded-[14px] py-3 text-[14px] font-bold active:scale-[0.99]"
              style={{ background: "var(--accent-yellow)", color: "#1A1A18" }}
            >
              {t("coach.generate")}
            </button>
          )}
        </motion.div>

        {/* Insights */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-4 space-y-3"
          style={CARD}
        >
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            {t("coach.insightsTitle")}
          </div>

          <InsightRow
            label={t("coach.avgIntake")}
            value={`${facts.avgIntake} kcal`}
            sub={`${t("coach.goalShort")} ${facts.avgGoal} · ${diff >= 0 ? "+" : ""}${diff}`}
            tone={facts.daysLogged === 0 ? "muted" : diff > 0 ? "over" : "ok"}
          />
          <InsightRow
            label={t("coach.weekBalanceLabel")}
            value={`${facts.weekBalance >= 0 ? "+" : ""}${facts.weekBalance} kcal`}
            tone={facts.weekBalance > 0 ? "over" : "ok"}
          />
          <InsightRow
            label={t("coach.proteinLabel")}
            value={`${Math.round(facts.proteinHitRate * 100)}%`}
            sub={`${facts.proteinAvg} / ${facts.proteinGoal} g`}
            tone={facts.proteinHitRate >= 0.6 ? "ok" : "warn"}
          />
          {facts.weekendDelta != null && (
            <InsightRow
              label={t("coach.weekendLabel")}
              value={`${facts.weekendDelta >= 0 ? "+" : ""}${facts.weekendDelta} kcal`}
              tone={facts.weekendDelta > 300 ? "warn" : "muted"}
            />
          )}
          {facts.realTDEE != null && (
            <InsightRow
              label={t("coach.realTdeeLabel")}
              value={`${facts.realTDEE} kcal`}
              sub={`${t("coach.planGoalShort")} ${facts.planGoalKcal}`}
              tone="accent"
            />
          )}
          <InsightRow
            label={t("coach.daysLoggedLabel")}
            value={`${facts.daysLogged} / ${facts.windowDays}`}
            tone="muted"
          />
        </motion.div>

        {/* Weight */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="p-4 space-y-3"
          style={CARD}
        >
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Scale size={14} strokeWidth={2} />
              {t("coach.weightTitle")}
            </div>
            {facts.weightLatest != null && (
              <div className="text-[15px]" style={{ fontWeight: 800, color: "var(--ink)" }}>
                {facts.weightLatest}{" "}
                <span className="text-[12px]" style={{ color: "var(--muted-foreground)", fontWeight: 700 }}>
                  kg
                </span>
                {facts.weightPerWeek != null && (
                  <span
                    className="ml-2 text-[12px]"
                    style={{
                      fontWeight: 700,
                      color:
                        facts.weightPerWeek === 0
                          ? "var(--muted-foreground)"
                          : facts.weightPerWeek > 0
                            ? "#D9521E"
                            : "var(--ink)",
                    }}
                  >
                    {facts.weightPerWeek >= 0 ? "+" : ""}
                    {facts.weightPerWeek} {t("coach.kgPerWeek")}
                  </span>
                )}
              </div>
            )}
          </div>

          {recent.length >= 2 ? (
            <Sparkline points={recent.map((w) => w.kg)} />
          ) : (
            <p className="text-[13px]" style={{ lineHeight: 1.5, color: "var(--muted-foreground)" }}>
              {t("coach.noWeight")}
            </p>
          )}

          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder={t("coach.weightPlaceholder")}
              className="min-w-0 flex-1 rounded-[14px] px-3.5 py-3 text-[15px] outline-none"
              style={{
                background: "var(--muted)",
                color: "var(--ink)",
                fontWeight: 700,
              }}
            />
            <button
              onClick={addWeight}
              className="flex items-center gap-1.5 rounded-[14px] px-4 py-3 text-[14px] font-bold active:scale-[0.98]"
              style={{ background: "var(--accent-yellow)", color: "#1A1A18" }}
            >
              <Plus size={16} strokeWidth={2.5} />
              {t("coach.saveWeight")}
            </button>
          </div>
        </motion.div>

        <p className="px-1 text-[11px]" style={{ lineHeight: 1.5, color: "var(--muted-foreground)" }}>
          {t("coach.disclaimer")}
        </p>
      </div>
    </div>
  );
}

function InsightRow({
  label,
  value,
  sub,
  tone = "ok",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "over" | "warn" | "accent" | "muted";
}) {
  const color =
    tone === "over" || tone === "warn"
      ? "#D9521E"
      : tone === "accent"
        ? "#B8860B"
        : tone === "muted"
          ? "var(--muted-foreground)"
          : "var(--ink)";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[14px]" style={{ color: "var(--ink)" }}>
        {label}
      </span>
      <span className="text-right">
        <span className="text-[15px]" style={{ fontWeight: 800, color }}>
          {value}
        </span>
        {sub && (
          <span className="ml-2 text-[12px]" style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const w = 280;
  const h = 48;
  const pad = 4;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const n = points.length;
  const coords = points.map((p, i) => {
    const x = pad + (i / (n - 1)) * (w - pad * 2);
    const y = pad + (1 - (p - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = coords[coords.length - 1].split(",");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="var(--accent-yellow)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill="var(--accent-yellow)" />
    </svg>
  );
}
