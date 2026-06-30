import { useState } from "react";
import { BarChart3, Dumbbell, Settings } from "lucide-react";
import { StoreProvider, useStore } from "@/data/store";
import { ToastProvider } from "@/components/toast";
import { SeanceTab } from "@/tabs/Seance";
import { ProgresTab } from "@/tabs/Progres";
import { ReglagesTab } from "@/tabs/Reglages";
import { cn } from "@/lib/cn";

type TabId = "seance" | "progres" | "reglages";

const TABS: { id: TabId; label: string; Icon: typeof Dumbbell }[] = [
  { id: "seance", label: "Séance", Icon: Dumbbell },
  { id: "progres", label: "Progrès", Icon: BarChart3 },
  { id: "reglages", label: "Réglages", Icon: Settings },
];

function Shell() {
  const [tab, setTab] = useState<TabId>("seance");
  const { loading } = useStore();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-28 pt-4 safe-top">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted">
            Chargement…
          </div>
        ) : tab === "seance" ? (
          <SeanceTab />
        ) : tab === "progres" ? (
          <ProgresTab />
        ) : (
          <ReglagesTab />
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur safe-bottom"
        aria-label="Navigation principale"
      >
        <div className="mx-auto flex w-full max-w-md">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-accent" : "text-muted"
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </ToastProvider>
  );
}
