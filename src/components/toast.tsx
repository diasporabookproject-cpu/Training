import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Toast } from "./ui";

type Tone = "info" | "error" | "success";
type ToastState = { id: number; message: string; tone: Tone };

const ToastCtx = createContext<(message: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: Tone = "info") => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, message, tone });
    timer.current = setTimeout(
      () => setToast((t) => (t?.id === id ? null : t)),
      tone === "error" ? 4500 : 2500
    );
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && <Toast key={toast.id} message={toast.message} tone={toast.tone} />}
    </ToastCtx.Provider>
  );
}
