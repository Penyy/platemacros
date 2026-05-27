import { type ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { AddSheet } from "./AddSheet";
import { ymd, usePlate } from "@/lib/store";

interface Props {
  children: ReactNode;
}

export function AppShell({ children }: Props) {
  const sheet = usePlate((s) => s.addSheet);
  const openAdd = usePlate((s) => s.openAdd);
  const closeAdd = usePlate((s) => s.closeAdd);

  return (
    <div className="ambient-bg min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col">
        <main className="flex-1 pb-32">{children}</main>
      </div>
      <BottomNav onAdd={() => openAdd(undefined)} />
      <AddSheet
        open={sheet.open}
        defaultMeal={sheet.meal}
        date={ymd(new Date())}
        onClose={closeAdd}
      />
    </div>
  );
}
