import { memo, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { type LogEntry, type Meal, sumEntries, usePlate } from "@/lib/store";
import { displayEntryName } from "@/lib/utils";

interface Props {
  meal: Meal;
  entries: LogEntry[];
  onAdd: (m: Meal) => void;
  onEdit: (entry: LogEntry) => void;
  date: string;
  prevDayHasEntries?: boolean;
}

function MealCardBase({ meal, entries, onAdd, onEdit, date, prevDayHasEntries }: Props) {
  const { t } = useTranslation();
  const sum = sumEntries(entries);
  const remove = usePlate((s) => s.removeEntry);
  const addEntry = usePlate((s) => s.addEntry);
  const repeatMeal = usePlate((s) => s.repeatMealFromPrevDay);

  const handleRepeat = () => {
    const n = repeatMeal(date, meal);
    if (n === 0) toast.message(t("snackbar.noMealToCopy"));
    else toast.success(t("snackbar.copied", { count: n }));
  };

  const handleDelete = (entry: LogEntry) => {
    remove(entry.id);
    toast(t("snackbar.deletedItem", { name: displayEntryName(entry.name, t) }), {
      duration: 5000,
      action: {
        label: t("common.undo"),
        onClick: () => {
          addEntry({
            date: entry.date,
            meal: entry.meal,
            name: entry.name,
            grams: entry.grams,
            kcal: entry.kcal,
            protein: entry.protein,
            carbs: entry.carbs,
            fat: entry.fat,
            fiber_g: entry.fiber_g,
            sugars_g: entry.sugars_g,
            saturated_fat_g: entry.saturated_fat_g,
            sodium_mg: entry.sodium_mg,
            sub_items: entry.sub_items,
            source: entry.source,
          });
        },
      },
    });
  };

  const isEmpty = entries.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface-card p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[17px] font-bold tracking-tight">{t(`meal.${meal}`)}</div>
        <div className="flex items-center gap-2">
          {!isEmpty && (
            <div className="num-tight text-right">
              <span className="text-[20px] font-extrabold tracking-tight">{Math.round(sum.kcal)}</span>
              <span className="ml-1 text-[11px] font-semibold text-muted-foreground">kcal</span>
            </div>
          )}
          {prevDayHasEntries && (
            <button
              onClick={handleRepeat}
              className="grid h-8 w-8 place-items-center rounded-full text-foreground"
              style={{ background: "var(--muted)" }}
              aria-label={t("a11y.repeatYesterday")}
              title={t("a11y.repeatYesterday")}
            >
              <RotateCcw size={15} strokeWidth={1.8} />
            </button>
          )}
          <button
            onClick={() => onAdd(meal)}
            className="grid h-8 w-8 place-items-center rounded-full text-foreground"
            style={{ background: "var(--muted)" }}
            aria-label={t("a11y.addItem")}
            title={t("a11y.addItem")}
          >
            <Plus size={15} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* Entries list */}
      {!isEmpty ? (
        <>
          <ul
            className="mt-2 divide-y"
            style={{ borderColor: "var(--hairline)" }}
          >
            <AnimatePresence initial={false}>
              {entries.map((e) => (
                <SwipeRow
                  key={e.id}
                  entry={e}
                  onDelete={() => handleDelete(e)}
                  onTap={() => onEdit(e)}
                />
              ))}
            </AnimatePresence>
          </ul>
          {/* Meal macro summary pills */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <MacroPill color="var(--macro-protein)" label={t("macro.short.protein")} value={Math.round(sum.protein)} />
            <MacroPill color="var(--macro-carbs)" label={t("macro.short.carbs")} value={Math.round(sum.carbs)} />
            <MacroPill color="var(--macro-fat)" label={t("macro.short.fat")} value={Math.round(sum.fat)} />
          </div>
        </>
      ) : (
        <button
          onClick={() => onAdd(meal)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl py-3 text-[13px] font-semibold text-muted-foreground"
          style={{ background: "var(--muted)" }}
        >
          <Plus size={16} strokeWidth={2} /> {t("card.addMeal")}
        </button>
      )}
    </motion.div>
  );
}

// Memoized: with stable `entries` (grouped once in index.tsx) and a stable
// `onAdd`, a card only re-renders when its own meal's data actually changes,
// not on every unrelated state change on the Today screen.
export const MealCard = memo(MealCardBase);

function MacroPill({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span
      className="num-tight inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{
        background: `color-mix(in oklab, ${color} 16%, transparent)`,
        border: `1px solid color-mix(in oklab, ${color} 38%, transparent)`,
      }}
    >
      <span style={{ color, fontWeight: 800 }}>{label}</span>
      <span style={{ color: "var(--ink)" }}>{value}</span>
      <span className="font-semibold" style={{ color: "var(--muted-foreground)" }}>g</span>
    </span>
  );
}

const AXIS_LOCK_PX = 8;

function SwipeRow({ entry: e, onDelete, onTap }: { entry: LogEntry; onDelete: () => void; onTap?: () => void }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLLIElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [armed, setArmed] = useState(false);
  const [animating, setAnimating] = useState(true);
  const [rowWidth, setRowWidth] = useState(0);
  const dxRef = useRef(0);

  const g = useRef({
    active: false,
    startX: 0,
    startY: 0,
    width: 0,
    mode: "undecided" as "undecided" | "horizontal" | "vertical",
    armed: false,
    moved: false,
  });
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  const setDxBoth = (v: number) => {
    dxRef.current = v;
    setDx(v);
  };

  const onPointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (ev.pointerType !== "mouse") return;
    if (ev.button !== 0) return;
    g.current = {
      active: true,
      startX: ev.clientX,
      startY: ev.clientY,
      width: rowRef.current?.offsetWidth ?? 0,
      mode: "undecided",
      armed: false,
      moved: false,
    };
    setAnimating(false);
  };
  const onPointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (ev.pointerType !== "mouse" || !g.current.active) return;
    handleMove(ev.clientX, ev.clientY, null);
  };
  const onPointerUp = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (ev.pointerType !== "mouse" || !g.current.active) return;
    if (g.current.mode === "undecided" && !g.current.moved && onTapRef.current) {
      onTapRef.current();
      g.current.active = false;
      return;
    }
    handleEnd();
  };

  const handleMove = (clientX: number, clientY: number, touchEvent: TouchEvent | null) => {
    const s = g.current;
    const deltaX = clientX - s.startX;
    const deltaY = clientY - s.startY;

    if (s.mode === "undecided") {
      const ax = Math.abs(deltaX);
      const ay = Math.abs(deltaY);
      if (ax < AXIS_LOCK_PX && ay < AXIS_LOCK_PX) return;
      if (ax > ay) {
        s.mode = "horizontal";
      } else {
        s.mode = "vertical";
        s.active = false;
        return;
      }
    }

    if (s.mode !== "horizontal") return;
    s.moved = true;
    if (touchEvent && touchEvent.cancelable) touchEvent.preventDefault();

    const max = s.width || 1;
    let next = deltaX;
    if (next > 0) next = next * 0.15;
    if (next < -max) next = -max;
    setDxBoth(next);

    const threshold = max * 0.5;
    const past = -next >= threshold;
    if (past && !s.armed) {
      s.armed = true;
      setArmed(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try { navigator.vibrate(10); } catch { /* noop */ }
      }
    } else if (!past && s.armed) {
      s.armed = false;
      setArmed(false);
    }
  };

  const handleEnd = () => {
    const s = g.current;
    s.active = false;
    setAnimating(true);
    if (s.mode !== "horizontal" || !s.moved) {
      setDxBoth(0);
      setArmed(false);
      s.armed = false;
      return;
    }
    const max = s.width || (rowRef.current?.offsetWidth ?? 0) || 1;
    const past = -dxRef.current >= max * 0.5;
    if (past) {
      setDxBoth(-max);
      window.setTimeout(onDelete, 220);
    } else {
      setDxBoth(0);
      setArmed(false);
      s.armed = false;
    }
  };

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const onTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return;
      const t = ev.touches[0];
      g.current = {
        active: true,
        startX: t.clientX,
        startY: t.clientY,
        width: el.offsetWidth,
        mode: "undecided",
        armed: false,
        moved: false,
      };
      setAnimating(false);
    };
    const onTouchMove = (ev: TouchEvent) => {
      if (!g.current.active) return;
      const t = ev.touches[0];
      if (!t) return;
      handleMove(t.clientX, t.clientY, ev);
    };
    const onTouchEnd = () => {
      if (g.current.mode === "horizontal" && g.current.moved) {
        handleEnd();
      } else {
        if (g.current.mode === "undecided" && !g.current.moved && onTapRef.current) {
          onTapRef.current();
        }
        g.current.active = false;
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Measure the row once after mount so the swipe progress (red panel +
  // trash icon) uses a real width instead of reading offsetWidth during
  // render, which made the first swipe jump from a max of 1px.
  useEffect(() => {
    if (rowRef.current) setRowWidth(rowRef.current.offsetWidth);
  }, []);

  const max = rowWidth || 1;
  const progress = Math.min(1, -dx / Math.max(1, max * 0.5));

  return (
    <motion.li
      ref={containerRef}
      layout
      initial={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.22 }}
      className="relative overflow-hidden rounded-2xl"
    >
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-end pr-5 text-white"
        style={{
          background: armed ? "#D9241B" : "#FF3B30",
          opacity: progress > 0 ? Math.min(1, 0.4 + progress * 0.6) : 0,
        }}
        aria-hidden
      >
        <div className="flex items-center gap-2">
          {armed && <span className="text-sm font-semibold">{t("a11y.releaseToDelete")}</span>}
          <motion.span
            className="inline-flex"
            animate={armed
              ? { scale: [1.1, 1.4, 1.05, 1.22], rotate: [0, -12, 9, 0] }
              : { scale: 0.7 + progress * 0.4, rotate: 0 }}
            transition={armed
              ? { duration: 0.45, ease: "easeOut", times: [0, 0.4, 0.7, 1] }
              : { duration: 0.05 }}
          >
            <Trash2 size={20} />
          </motion.span>
        </div>
      </div>
      <div
        ref={rowRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          transform: `translate3d(${dx}px,0,0)`,
          transition: animating
            ? "transform 320ms cubic-bezier(0.22,1,0.36,1)"
            : "none",
          touchAction: "pan-y",
          background: "var(--card)",
        }}
        className="relative flex items-center gap-3 px-2 py-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[16px] font-bold tracking-tight">{displayEntryName(e.name, t)}</span>
            {e.source === "ai" ? (
              <span
                className="inline-flex shrink-0 items-center justify-center self-center rounded-full"
                style={{ width: 16, height: 16, background: "rgba(244,181,0,.14)", color: "var(--accent-yellow)" }}
                aria-label="PlateAI"
                title="PlateAI"
              >
                <Sparkles size={10} strokeWidth={2} />
              </span>
            ) : null}
            {e.grams ? (
              <span className="num-tight shrink-0 text-[12px] font-semibold text-muted-foreground">
                {Math.round(e.grams)} g
              </span>
            ) : null}
          </div>
          <div className="num-tight mt-1 text-[12px] font-medium text-muted-foreground">
            {t("macro.short.protein")} {Math.round(e.protein)} · {t("macro.short.carbs")} {Math.round(e.carbs)} · {t("macro.short.fat")} {Math.round(e.fat)} g
          </div>
        </div>
        <div className="num-tight text-right">
          <span className="text-[18px] font-extrabold tracking-tight">{Math.round(e.kcal)}</span>
          <span className="ml-1 text-[11px] font-semibold text-muted-foreground">kcal</span>
        </div>
      </div>
    </motion.li>
  );
}


