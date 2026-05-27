import { useState, type ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { AddSheet } from "./AddSheet";
import { ymd, type Meal } from "@/lib/store";

interface Props {
  children: ReactNode;
}

export function AppShell({ children }: Props) {
  const [open, setOpen] = useState(false);
  const [meal, setMeal] = useState<Meal | undefined>(undefined);

  return (
    <div className="ambient-bg min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col">
        <main className="flex-1 pb-32">{children}</main>
      </div>
      <BottomNav
        onAdd={() => {
          setMeal(undefined);
          setOpen(true);
        }}
      />
      <AddSheet
        open={open}
        defaultMeal={meal}
        date={ymd(new Date())}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
