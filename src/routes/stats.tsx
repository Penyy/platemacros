import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Plate — Statystyki" },
      {
        name: "description",
        content: "Trendy kalorii i makro z ostatnich 7 dni.",
      },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  return (
    <div>
      <ScreenHeader title="Statystyki" subtitle="Ostatnie 7 dni" />
      <div className="mx-4 mt-8 flex flex-col items-center gap-3 rounded-3xl bg-card p-8 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-foreground/5">
          <BarChart3 size={26} />
        </div>
        <h2 className="text-lg font-semibold">Wkrótce</h2>
        <p className="max-w-[28ch] text-sm text-muted-foreground">
          Wykresy słupkowe dla kalorii, białka, węgli i tłuszczu pojawią się w
          kolejnym etapie.
        </p>
      </div>
    </div>
  );
}
