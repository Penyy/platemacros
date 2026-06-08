import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, X, Check, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScreenHeader } from "@/components/ScreenHeader";
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

function ProductsPage() {
  const { t, i18n } = useTranslation();
  const products = usePlate((s) => s.products);
  const addProduct = usePlate((s) => s.addProduct);
  const updateProduct = usePlate((s) => s.updateProduct);
  const removeProduct = usePlate((s) => s.removeProduct);

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);

  const locale = i18n.language?.startsWith("en") ? "en" : "pl";
  const filtered = products
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  const shortP = t("macro.short.protein");
  const shortC = t("macro.short.carbs");
  const shortF = t("macro.short.fat");

  function submitNew() {
    const parsed = parseDraft(draft);
    if (!parsed.name) return;
    addProduct(parsed);
    setDraft(EMPTY);
    setAdding(false);
  }

  function saveEdit(id: string) {
    const parsed = parseDraft(editDraft);
    if (!parsed.name) return;
    updateProduct(id, parsed);
    setEditingId(null);
  }

  return (
    <div className="pb-4">
      <ScreenHeader title={t("products.title")} subtitle={t("products.subtitle")} />

      <div className="px-[18px] space-y-3">
        {/* Search */}
        <div
          className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5"
          style={{ boxShadow: "var(--shadow-card)" }}
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

        {!adding ? (
          <button
            onClick={() => {
              setAdding(true);
              setDraft(EMPTY);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3.5 text-[14px] active:scale-[0.99]"
            style={{
              background: "#1B1B19",
              color: "#FBF4E2",
              fontWeight: 700,
              boxShadow: "var(--shadow-card)",
            }}
          >
            <Plus size={16} strokeWidth={2.2} /> {t("common.add")}
          </button>
        ) : (
          <ProductForm
            draft={draft}
            setDraft={setDraft}
            onCancel={() => setAdding(false)}
            onSubmit={submitNew}
            submitLabel={t("products.saveProduct")}
          />
        )}

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
            {filtered.map((p) =>
              editingId === p.id ? (
                <li key={p.id}>
                  <ProductForm
                    draft={editDraft}
                    setDraft={setEditDraft}
                    onCancel={() => setEditingId(null)}
                    onSubmit={() => saveEdit(p.id)}
                    submitLabel={t("common.save")}
                  />
                </li>
              ) : (
                <li key={p.id}>
                  <div
                    className="flex items-stretch rounded-[20px] bg-card"
                    style={{ boxShadow: "var(--shadow-card)" }}
                  >
                    <button
                      onClick={() => {
                        setEditingId(p.id);
                        setEditDraft(toDraft(p));
                      }}
                      className="flex flex-1 items-center gap-3 p-3.5 text-left active:opacity-80"
                      aria-label={t("products.editAria", { name: p.name })}
                    >
                      <div className="flex-1 min-w-0">
                        <div
                          className="truncate text-[15px]"
                          style={{ fontWeight: 700, color: "var(--ink)" }}
                        >
                          {p.name}
                        </div>
                        <div
                          className="num-tight mt-0.5 text-[11.5px]"
                          style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
                        >
                          {shortP} {round1(p.protein)} · {shortC} {round1(p.carbs)} · {shortF} {round1(p.fat)} g / 100 g
                        </div>
                      </div>
                      <div
                        className="num-tight shrink-0 pr-1 text-right text-[15px]"
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
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t("products.deleteConfirm", { name: p.name }))) removeProduct(p.id);
                      }}
                      className="grid w-12 place-items-center rounded-r-[20px]"
                      style={{ color: "var(--muted-foreground)" }}
                      aria-label={t("common.delete")}
                    >
                      <Trash2 size={15} strokeWidth={1.9} />
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function ProductForm({
  draft,
  setDraft,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  const { t } = useTranslation();
  const valid = draft.name.trim().length > 0;
  const shortP = t("macro.short.protein");
  const shortC = t("macro.short.carbs");
  const shortF = t("macro.short.fat");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit();
      }}
      className="space-y-3 rounded-[24px] bg-card p-4"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
        {t("products.per100")}
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
      <div className="grid grid-cols-4 gap-2">
        <NumIn label="kcal" unit="" value={draft.kcal} onChange={(v) => setDraft({ ...draft, kcal: v })} />
        <NumIn label={shortP} unit="g" value={draft.protein} onChange={(v) => setDraft({ ...draft, protein: v })} dot="var(--macro-protein)" />
        <NumIn label={shortC} unit="g" value={draft.carbs} onChange={(v) => setDraft({ ...draft, carbs: v })} dot="var(--macro-carbs)" />
        <NumIn label={shortF} unit="g" value={draft.fat} onChange={(v) => setDraft({ ...draft, fat: v })} dot="var(--macro-fat)" />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex flex-1 items-center justify-center gap-1 rounded-full py-3 text-[13px]"
          style={{ background: "var(--hairline)", color: "var(--ink)", fontWeight: 600 }}
        >
          <X size={14} /> {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={!valid}
          className="flex flex-1 items-center justify-center gap-1 rounded-full py-3 text-[13px] disabled:opacity-40"
          style={{ background: "#1B1B19", color: "#FBF4E2", fontWeight: 700 }}
        >
          <Check size={14} /> {submitLabel}
        </button>
      </div>
    </form>
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
      <div className="mb-0.5 flex items-center gap-1 text-[10px]" style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>
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
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{unit}</span>
        )}
      </div>
    </label>
  );
}
