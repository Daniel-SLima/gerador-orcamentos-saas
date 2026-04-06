"use client";

import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from "react";

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

// ─────────────────────────────────────────────────────────────
// Contexto global
// ─────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────
// Configuração visual por tipo
// ─────────────────────────────────────────────────────────────
const toastConfig: Record<ToastType, { icon: string; bg: string; border: string; text: string; bar: string }> = {
  success: {
    icon: "✅",
    bg: "bg-white",
    border: "border-green-200",
    text: "text-gray-800",
    bar: "bg-green-500",
  },
  error: {
    icon: "❌",
    bg: "bg-white",
    border: "border-red-200",
    text: "text-gray-800",
    bar: "bg-red-500",
  },
  warning: {
    icon: "⚠️",
    bg: "bg-white",
    border: "border-amber-200",
    text: "text-gray-800",
    bar: "bg-amber-500",
  },
  info: {
    icon: "ℹ️",
    bg: "bg-white",
    border: "border-blue-200",
    text: "text-gray-800",
    bar: "bg-blue-500",
  },
};

// ─────────────────────────────────────────────────────────────
// Componente individual de Toast
// ─────────────────────────────────────────────────────────────
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const cfg = toastConfig[toast.type];
  const DURATION = 4000;

  useEffect(() => {
    // Slide-in
    const showTimer = setTimeout(() => setVisible(true), 10);

    // Auto-dismiss
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 400);
    }, DURATION);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [toast.id, onRemove]);

  return (
    <div
      className={`
        relative flex items-start gap-3 w-full max-w-sm px-4 py-3.5 rounded-xl
        border shadow-lg ${cfg.bg} ${cfg.border} ${cfg.text}
        transition-all duration-400 ease-in-out overflow-hidden
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}
    >
      {/* Barra de progresso */}
      <div
        className={`absolute bottom-0 left-0 h-[3px] ${cfg.bar} rounded-b-xl`}
        style={{
          animation: `toast-progress ${DURATION}ms linear forwards`,
        }}
      />

      <span className="text-lg shrink-0 mt-0.5">{cfg.icon}</span>

      <p className="text-sm font-medium leading-snug flex-1 break-words">{toast.message}</p>

      <button
        onClick={() => {
          setVisible(false);
          setTimeout(() => onRemove(toast.id), 400);
        }}
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors -mr-1 -mt-0.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Provider (coloca no layout)
// ─────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Container de toasts — canto inferior direito no desktop, inferior centro no mobile */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-[9999] flex flex-col-reverse gap-3 items-center md:items-end w-[calc(100vw-2rem)] md:w-auto pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto w-full md:w-auto">
            <ToastItem toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>

      {/* Animação da barra de progresso */}
      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook para usar o toast em qualquer página
// ─────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de <ToastProvider>");
  return ctx;
}
