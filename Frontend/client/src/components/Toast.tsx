// src/components/Toast.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastType = "success" | "error" | "info";

export type ToastOptions = {
  id?: string;
  type?: ToastType;
  message: string;
  duration?: number; // ms
};

type ToastItem = Required<ToastOptions> & { id: string; createdAt: number };

type ToastCtx = {
  push: (t: ToastOptions) => string;
  remove: (id: string) => void;
};

const ToastContext = createContext<ToastCtx | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider />");
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode; max?: number }> = ({
  children,
  max = 4,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback(
    (opts: ToastOptions) => {
      const id = opts.id ?? Math.random().toString(36).slice(2);
      const t: ToastItem = {
        id,
        message: opts.message,
        type: opts.type ?? "info",
        duration: opts.duration ?? 5000,
        createdAt: Date.now(),
      };
      setToasts((prev) => [...prev.slice(-max + 1), t]);
      return id;
    },
    [max]
  );

  const remove = useCallback(
    (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    []
  );

  return (
    <ToastContext.Provider value={{ push, remove }}>
      {children}
      <ToastViewport toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  );
};

const variantClasses: Record<ToastType,{ card: string; icon: string; barBg: string; barFill: string; close: string }> = {
  success: {
    card: "bg-teal-50 text-teal-900 border border-teal-200 shadow-teal-200/50",
    icon: "text-teal-600",
    barBg: "bg-teal-100",
    barFill: "bg-teal-500",
    close: "text-teal-700 hover:text-teal-900",
  },
  error: {
    card: "bg-red-50 text-red-900 border border-red-200 shadow-red-200/50",
    icon: "text-red-600",
    barBg: "bg-red-100",
    barFill: "bg-red-500",
    close: "text-red-700 hover:text-red-900",
  },
  info: {
    card: "bg-gray-900 text-white border border-gray-800 shadow-black/30",
    icon: "text-white/80",
    barBg: "bg-white/20",
    barFill: "bg-white",
    close: "text-white hover:text-white",
  },
};

const ToastViewport: React.FC<{
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}> = ({ toasts, onRemove }) => {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed right-4 bottom-4 z-[9999] flex flex-col gap-3"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onRemove={() => onRemove(t.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{
  toast: ToastItem;
  onRemove: () => void;
}> = ({ toast, onRemove }) => {
  const { type, message, duration } = toast;
  const styles = variantClasses[type];

  const [remaining, setRemaining] = useState(duration);
  const [hovered, setHovered] = useState(false);
  const last = useRef<number>(Date.now());

  // Stabilny interwał – pewne odmierzanie czasu i zmniejszanie paska
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      if (!hovered) {
        const delta = now - last.current;
        setRemaining((r) => Math.max(0, r - delta));
      }
      last.current = now;
    };

    // krótszy interwał = płynniejszy pasek
    const id = window.setInterval(tick, 60);
    return () => window.clearInterval(id);
  }, [hovered]);

  // Auto-zamknięcie
  useEffect(() => {
    if (remaining <= 0) onRemove();
  }, [remaining, onRemove]);

  const pct = useMemo(
    () => Math.max(0, Math.min(100, (remaining / duration) * 100)),
    [remaining, duration]
  );

  return (
    <div
      role="status"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        last.current = Date.now();
      }}
      className={[
        "w-[min(92vw,360px)]",               // <-- węższy toast
        "rounded-xl shadow-xl overflow-hidden backdrop-blur-[2px]",
        "translate-y-0 animate-in fade-in zoom-in-95",
        styles.card,
      ].join(" ")}
    >
      <div className="p-3 pl-3 pr-2 flex items-start gap-3">
        {/* Ikona */}
        <span className={"mt-[2px] shrink-0 " + styles.icon} aria-hidden>
          {type === "success" ? (
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : type === "error" ? (
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 8v5m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>

        {/* Treść */}
        <div className="flex-1 text-sm font-medium leading-5">{message}</div>

        {/* Close X — lepsze style hover/focus/active */}
        <button
          type="button"
          aria-label="Zamknij powiadomienie"
          onClick={onRemove}
          className={[
            "p-1.5 rounded-md transition hover:rounded-full",
            "opacity-90 hover:opacity-100",
            "hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-current/30",
            "active:scale-[0.97]",
            styles.close,
          ].join(" ")}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Pasek postępu na dole */}
      <div className={"h-1 " + styles.barBg}>
        <div
          className={"h-1 " + styles.barFill}
          style={{ width: `${pct}%`, transition: "width 60ms linear" }}
        />
      </div>
    </div>
  );
};
