import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2, X, Check } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { usePlate, type Product } from "@/lib/store";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Plate — Moje produkty" },
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
  const products = usePlate((s) => s.products);
  const addProduct = usePlate((s) => s.addProduct);
  const updateProduct = usePlate((s) => s.updateProduct);
  const removeProduct = usePlate((s) => s.removeProduct);

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);

  const filtered = products
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));

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
    <div>
      <ScreenHeader title="Moje produkty" />

      <div className="px-4 space-y-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj…"
          className="w-full rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-base outline-none focus:border-primary"
        />

        {!adding ? (
          <button
            onClick={() => {
              setAdding(true);
              setDraft(EMPTY);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground active:opacity-90"
          >
            <Plus size={16} /> Dodaj produkt
          </button>
        ) : (
          <ProductForm
            draft={draft}
            setDraft={setDraft}
            onCancel={() => setAdding(false)}
            onSubmit={submitNew}
            submitLabel="Zapisz produkt"
          />
        )}

        {filtered.length === 0 ? (
          <p className="px-1 pt-4 text-center text-sm text-muted-foreground">
            {products.length === 0
              ? "Nie masz jeszcze żadnych produktów."
              : "Brak wyników."}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((p) =>
              editingId === p.id ? (
                <li key={p.id}>
                  <ProductForm
                    draft={editDraft}
                    setDraft={setEditDraft}
                    onCancel={() => setEditingId(null)}
                    onSubmit={() => saveEdit(p.id)}
                    submitLabel="Zapisz"
                  />
                </li>
              ) : (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-2xl bg-card p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {p.name}
                    </div>
                    <div className="num-tight mt-0.5 text-[11px] text-muted-foreground">
                      {Math.round(p.kcal)} kcal · B {round1(p.protein)} · W{" "}
                      {round1(p.carbs)} · T {round1(p.fat)} / 100 g
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditingId(p.id);
                      setEditDraft(toDraft(p));
                    }}
                    className="grid h-9 w-9 place-items-center rounded-full bg-foreground/5 active:bg-foreground/10"
                    aria-label="Edytuj"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Usunąć „${p.name}”?`)) removeProduct(p.id);
                    }}
                    className="grid h-9 w-9 place-items-center rounded-full bg-foreground/5 text-destructive active:bg-foreground/10"
                    aria-label="Usuń"
                  >
                    <Trash2 size={16} />
                  </button>
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
  const valid = draft.name.trim().length > 0;
  const inputCls =
    "w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-base outline-none focus:border-primary num-tight";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit();
      }}
      className="space-y-2 rounded-2xl bg-card p-3"
    >
      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        Wartości na 100 g
      </div>
      <input
        autoFocus
        value={draft.name}
        maxLength={80}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="Nazwa produktu"
        className={inputCls}
      />
      <div className="grid grid-cols-4 gap-2">
        <NumIn
          label="kcal"
          value={draft.kcal}
          onChange={(v) => setDraft({ ...draft, kcal: v })}
        />
        <NumIn
          label="B (g)"
          value={draft.protein}
          onChange={(v) => setDraft({ ...draft, protein: v })}
        />
        <NumIn
          label="W (g)"
          value={draft.carbs}
          onChange={(v) => setDraft({ ...draft, carbs: v })}
        />
        <NumIn
          label="T (g)"
          value={draft.fat}
          onChange={(v) => setDraft({ ...draft, fat: v })}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-foreground/5 py-2.5 text-sm font-medium"
        >
          <X size={14} /> Anuluj
        </button>
        <button
          type="submit"
          disabled={!valid}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          <Check size={14} /> {submitLabel}
        </button>
      </div>
    </form>
  );
}

function NumIn({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(",", "."))}
        className="num-tight w-full rounded-xl border border-border/60 bg-background px-2 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
