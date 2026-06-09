import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Plus, Trash2, X, Search, ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useMotionValue, animate, type PanInfo } from "framer-motion";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { usePlate, type Product } from "@/lib/store";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Plate — Moje produkty / My products" },
      { name: "description", content: "Twoja biblioteka produktów spożywczych." },
    ],
  }),
  component: ProductsPage,
});

type Draft = {
  name: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
};

const EMPTY: Draft = { name: "", kcal: "", protein: "", carbs: "", fat: "" };

type SortKey = "name" | "kcal" | "protein" | "carbs" | "fat";
type SortDir = "asc" | "desc";

// Fallback rgb values matching macro tokens
const MACRO_RGB = {
  protein: "225,91,76",
  carbs: "239,139,44",
  fat: "92,138,166",
} as const;

function toDraft(p: Product): Draft {
  return {
    name: p.name,
    kcal: String(p.kcal),
    protein: String(p.protein),
    carbs: String(p.carbs),
    fat: String(p.fat),
  };
}

function parseDraft(d: Draft) {
  const n = (v: string) => {
    const x = Number(v.replace(",", "."));
    return Number.isFinite(x) && x >= 0 ? x : 0;
  };
  return {
    name: d.name.trim(),
    kcal: n(d.kcal),
    protein: n(d.protein),
    carbs: n(d.carbs),
    fat: n(d.fat),
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function ProductsPage() {
  const { t, i18n } = useTranslation();
  const products = usePlate((s) => s.products);
  const addProduct = usePlate((s) => s.addProduct);
  const updateProduct = usePlate((s) => s.updateProduct);
  const removeProduct = usePlate((s) => s.removeProduct);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [swipeDeleteId, setSwipeDeleteId] = useState<string | null>(null);

  const locale = i18n.language?.startsWith("en") ? "en" : "pl";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => p.name.toLowerCase().includes(q));
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name, locale) * dir;
      return (a[sortKey] - b[sortKey]) * dir;
    });
    return list;
  }, [products, query, sortKey, sortDir, locale]);

  function handleSortClick(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function openAdd() {
    setEditingId(null);
    setDraft(EMPTY);
    setSheetOpen(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setDraft(toDraft(p));
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setConfirmDelete(false);
  }

  function submitSheet() {
    const parsed = parseDraft(draft);
    if (!parsed.name) return;
    if (editingId) updateProduct(editingId, parsed);
    else addProduct(parsed);
    closeSheet();
  }

  function confirmRemove() {
    if (!editingId) return;
    removeProduct(editingId);
    closeSheet();
  }

  function confirmSwipeRemove() {
    if (!swipeDeleteId) return;
    removeProduct(swipeDeleteId);
    setSwipeDeleteId(null);
    toast(t("products.productDeleted"));
  }

  const editingProduct = editingId
    ? products.find((p) => p.id === editingId)
    : null;

  const swipeDeleteProduct = swipeDeleteId
    ? products.find((p) => p.id === swipeDeleteId)
    : null;

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "name", label: t("products.sort.name") },
    { key: "kcal", label: t("products.sort.kcal") },
    { key: "protein", label: t("products.sort.protein") },
    { key: "carbs", label: t("products.sort.carbs") },
    { key: "fat", label: t("products.sort.fat") },
  ];

  return (
    <div className="pb-4">
      <ScreenHeader title={t("products.title")} subtitle={t("products.subtitle")} />

      <div className="px-[18px] space-y-3">
        {/* Search */}
        <div
          className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5"
          style={{ border: "1px solid var(--hairline)", boxShadow: "var(--shadow-card)" }}
        >
          <Search size={16} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("products.searchPlaceholder")}
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-[color:var(--muted-foreground)]"
            style={{ color: "var(--ink)", fontWeight: 500 }}
          />
        </div>

        {/* Add */}
        <button
          onClick={openAdd}
          className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3.5 text-[14px] active:scale-[0.99]"
          style={{
            background: "var(--hairline)",
            color: "var(--ink)",
            fontWeight: 700,
            border: "1px solid var(--hairline)",
          }}
        >
          <Plus size={18} strokeWidth={2.4} style={{ color: "var(--accent-yellow)" }} />
          {t("products.addProduct")}
        </button>

        {/* Sort chips */}
        <div className="-mx-[18px] overflow-x-auto px-[18px] no-scrollbar">
          <div className="flex gap-2 pb-1">
            {sortOptions.map((opt) => {
              const active = opt.key === sortKey;
              return (
                <button
                  key={opt.key}
                  onClick={() => handleSortClick(opt.key)}
                  className="flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-[12.5px] active:scale-[0.97]"
                  style={
                    active
                      ? {
                          background: "var(--ink)",
                          color: "var(--card)",
                          fontWeight: 700,
                        }
                      : {
                          background: "var(--card)",
                          color: "var(--muted-foreground)",
                          fontWeight: 600,
                          border: "1px solid var(--hairline)",
                        }
                  }
                >
                  {opt.label}
                  {active &&
                    (sortDir === "desc" ? (
                      <ArrowDown size={12} strokeWidth={2.4} />
                    ) : (
                      <ArrowUp size={12} strokeWidth={2.4} />
                    ))}
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="px-1 pt-6 text-center" style={{ color: "var(--muted-foreground)" }}>
            <p className="text-[14px]" style={{ fontWeight: 600 }}>
              {products.length === 0 ? t("products.empty") : t("products.noResults")}
            </p>
            {products.length === 0 && (
              <p className="mt-1 text-[12px]">{t("products.emptyHint")}</p>
            )}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((p, i) => (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: Math.min(i, 12) * 0.04, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  onClick={() => openEdit(p)}
                  aria-label={t("products.editAria", { name: p.name })}
                  className="flex w-full items-center gap-3 rounded-[18px] bg-card p-3.5 text-left active:scale-[0.99]"
                  style={{ border: "1px solid var(--hairline)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className="truncate text-[15px]"
                      style={{ fontWeight: 700, color: "var(--ink)" }}
                    >
                      {p.name}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <MacroPill macro="protein" letter={t("macro.short.protein")} value={round1(p.protein)} />
                      <MacroPill macro="carbs" letter={t("macro.short.carbs")} value={round1(p.carbs)} />
                      <MacroPill macro="fat" letter={t("macro.short.fat")} value={round1(p.fat)} />
                    </div>
                  </div>
                  <div className="shrink-0 pr-1 text-right">
                    <div
                      className="num-tight text-[18px] leading-none"
                      style={{ fontWeight: 800, color: "var(--ink)" }}
                    >
                      {Math.round(p.kcal)}
                      <span
                        className="ml-0.5 text-[10px]"
                        style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
                      >
                        kcal
                      </span>
                    </div>
                    <div
                      className="mt-1 text-[10px]"
                      style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
                    >
                      {t("products.per100")}
                    </div>
                  </div>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <ProductSheet
        open={sheetOpen}
        isEdit={!!editingId}
        draft={draft}
        setDraft={setDraft}
        onClose={closeSheet}
        onSubmit={submitSheet}
        onDeleteRequest={() => setConfirmDelete(true)}
      />

      <DeleteConfirm
        open={confirmDelete}
        name={editingProduct?.name ?? draft.name}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

function MacroPill({
  macro,
  letter,
  value,
}: {
  macro: "protein" | "carbs" | "fat";
  letter: string;
  value: number;
}) {
  const rgb = MACRO_RGB[macro];
  return (
    <span
      className="num-tight inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
      style={{
        background: `rgba(${rgb},0.16)`,
        border: `1px solid rgba(${rgb},0.38)`,
        fontWeight: 700,
      }}
    >
      <span style={{ color: `rgb(${rgb})` }}>{letter}</span>
      <span style={{ color: "var(--ink)" }}>{value}</span>
      <span className="text-[9.5px]" style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>
        g
      </span>
    </span>
  );
}

function ProductSheet({
  open,
  isEdit,
  draft,
  setDraft,
  onClose,
  onSubmit,
  onDeleteRequest,
}: {
  open: boolean;
  isEdit: boolean;
  draft: Draft;
  setDraft: (d: Draft) => void;
  onClose: () => void;
  onSubmit: () => void;
  onDeleteRequest: () => void;
}) {
  const { t } = useTranslation();
  useScrollLock(open);
  const valid = draft.name.trim().length > 0;
  const shortP = t("macro.short.protein");
  const shortC = t("macro.short.carbs");
  const shortF = t("macro.short.fat");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/30"
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 z-50 mx-auto flex w-full max-w-[430px] flex-col"
            style={{
              bottom: "var(--kb-inset, 0px)",
              maxHeight:
                "calc(100dvh - var(--kb-inset, 0px) - env(safe-area-inset-top) - 12px)",
            }}
          >
            <div
              className="mx-2 mb-[max(env(safe-area-inset-bottom),1.25rem)] overflow-y-auto overscroll-contain rounded-t-[30px] rounded-b-[28px] bg-card px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1.5rem)]"
              style={{ boxShadow: "var(--shadow-card)", WebkitOverflowScrolling: "touch" }}
            >
              <div
                className="mx-auto mb-3 h-1.5 w-11 rounded-full"
                style={{ background: "var(--hairline)" }}
              />
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2
                  className="text-[22px] leading-tight"
                  style={{
                    fontFamily: "Manrope, sans-serif",
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    color: "var(--ink)",
                  }}
                >
                  {isEdit ? t("products.editProduct") : t("products.newProduct")}
                </h2>
                <div className="flex items-center gap-1">
                  {isEdit && (
                    <button
                      type="button"
                      onClick={onDeleteRequest}
                      aria-label={t("common.delete")}
                      className="grid h-9 w-9 place-items-center rounded-full active:scale-95"
                      style={{
                        background: `rgba(${MACRO_RGB.protein},0.12)`,
                        color: `rgb(${MACRO_RGB.protein})`,
                      }}
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={t("common.close")}
                    className="grid h-9 w-9 place-items-center rounded-full active:scale-95"
                    style={{ background: "var(--hairline)", color: "var(--ink)" }}
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (valid) onSubmit();
                }}
                className="space-y-3"
              >
                <div>
                  <div
                    className="mb-1 text-[11px]"
                    style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
                  >
                    {t("products.name")}
                  </div>
                  <input
                    autoFocus
                    value={draft.name}
                    maxLength={80}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder={t("products.namePlaceholder")}
                    className="w-full rounded-2xl px-4 py-3 text-[15px] outline-none placeholder:text-[color:var(--muted-foreground)]"
                    style={{
                      background: "var(--hairline)",
                      color: "var(--ink)",
                      fontWeight: 600,
                    }}
                  />
                </div>

                <div
                  className="text-[11px]"
                  style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
                >
                  {t("products.per100")}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <NumIn label="kcal" unit="" value={draft.kcal} onChange={(v) => setDraft({ ...draft, kcal: v })} />
                  <NumIn label={shortP} unit="g" value={draft.protein} onChange={(v) => setDraft({ ...draft, protein: v })} dot="var(--macro-protein)" />
                  <NumIn label={shortC} unit="g" value={draft.carbs} onChange={(v) => setDraft({ ...draft, carbs: v })} dot="var(--macro-carbs)" />
                  <NumIn label={shortF} unit="g" value={draft.fat} onChange={(v) => setDraft({ ...draft, fat: v })} dot="var(--macro-fat)" />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex flex-1 items-center justify-center rounded-full py-3 text-[14px]"
                    style={{ background: "var(--hairline)", color: "var(--ink)", fontWeight: 600 }}
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={!valid}
                    className="flex flex-1 items-center justify-center rounded-full py-3 text-[14px] disabled:opacity-40"
                    style={{
                      background: "var(--accent-yellow)",
                      color: "#1B1B19",
                      fontWeight: 800,
                    }}
                  >
                    {t("common.save")}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DeleteConfirm({
  open,
  name,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  useScrollLock(open);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 z-[60] bg-black/50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-1/2 z-[61] w-[88%] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-5"
            style={{ boxShadow: "var(--shadow-card)", border: "1px solid var(--hairline)" }}
          >
            <h3
              className="text-[18px] leading-tight"
              style={{
                fontFamily: "Manrope, sans-serif",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
              }}
            >
              {t("products.deleteTitle")}
            </h3>
            <p
              className="mt-2 text-[13.5px] leading-snug"
              style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
            >
              {t("products.deleteBody", { name })}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={onCancel}
                className="flex flex-1 items-center justify-center rounded-full py-3 text-[14px]"
                style={{ background: "var(--hairline)", color: "var(--ink)", fontWeight: 600 }}
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={onConfirm}
                className="flex flex-1 items-center justify-center rounded-full py-3 text-[14px]"
                style={{
                  background: `rgb(${MACRO_RGB.protein})`,
                  color: "#FBF4E2",
                  fontWeight: 800,
                }}
              >
                {t("common.delete")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function NumIn({
  label,
  unit,
  value,
  onChange,
  dot,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  dot?: string;
}) {
  return (
    <label className="block rounded-2xl p-2.5" style={{ background: "var(--hairline)" }}>
      <div
        className="mb-0.5 flex items-center gap-1 text-[10px]"
        style={{ color: "var(--muted-foreground)", fontWeight: 600 }}
      >
        {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
        {label}
      </div>
      <div className="flex items-baseline gap-0.5">
        <input
          inputMode="decimal"
          value={value}
          placeholder="0"
          onChange={(e) => onChange(e.target.value.replace(",", "."))}
          className="num-tight w-full bg-transparent text-[15px] outline-none placeholder:text-[color:var(--light-gray)]"
          style={{ color: "var(--ink)", fontWeight: 700 }}
        />
        {unit && (
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            {unit}
          </span>
        )}
      </div>
    </label>
  );
}
