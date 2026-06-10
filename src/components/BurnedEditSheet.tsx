import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePlate } from "@/lib/store";

export function BurnedEditSheet({
  open,
  date,
  onOpenChange,
}: {
  open: boolean;
  date: string;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const burned = usePlate((s) => s.burned[date] ?? 0);
  const setBurned = usePlate((s) => s.setBurned);
  const [val, setVal] = useState<string>(String(burned || ""));

  useEffect(() => {
    if (open) setVal(burned ? String(burned) : "");
  }, [open, burned]);

  const save = () => {
    const n = Math.max(0, Math.round(Number(val) || 0));
    setBurned(date, n);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="border-0 p-0"
        style={{
          background: "var(--card)",
          color: "var(--ink)",
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingBottom: "max(env(safe-area-inset-bottom),1.5rem)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <SheetHeader className="px-5 pt-5 text-left">
          <SheetTitle
            className="flex items-center gap-2"
            style={{ color: "var(--ink)", fontWeight: 700, fontSize: 20 }}
          >
            <Flame size={18} strokeWidth={1.8} />
            {t("burned.title")}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-5 pb-5 pt-4">
          <div
            className="rounded-[20px] p-4"
            style={{ background: "var(--muted)" }}
          >
            <label
              className="block pb-2 text-[11px] font-semibold"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t("burned.label")}
            </label>
            <div className="flex items-baseline gap-2">
              <input
                inputMode="numeric"
                autoFocus
                value={val}
                placeholder="0"
                onChange={(e) => setVal(e.target.value.replace(/[^\d]/g, ""))}
                className="num-tight flex-1 bg-transparent text-[32px] outline-none placeholder:opacity-30"
                style={{ color: "var(--ink)", fontWeight: 800, letterSpacing: "-0.02em" }}
              />
              <span className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
                {t("burned.unit")}
              </span>
            </div>
          </div>

          <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            {t("burned.hint")}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setBurned(date, 0);
                onOpenChange(false);
              }}
              className="flex-1 rounded-full py-3 text-[14px] font-semibold"
              style={{ background: "var(--muted)", color: "var(--ink)" }}
            >
              {t("burned.clear")}
            </button>
            <button
              onClick={save}
              className="flex-[2] rounded-full py-3 text-[14px] font-semibold"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
