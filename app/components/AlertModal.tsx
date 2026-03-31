"use client";

/**
 * AlertModal.tsx
 *
 * Substitui os alert() e confirm() nativos do navegador por modais
 * estilizados que seguem o padrão visual do sistema.
 *
 * Exporta:
 *  - <AlertModal>    → substitui alert()   (apenas "OK")
 *  - <ConfirmModal>  → substitui confirm() (Cancelar + Confirmar)
 *  - useAlert()      → hook para disparar AlertModal programaticamente
 *  - useConfirm()    → hook para disparar ConfirmModal programaticamente
 */

import { useState, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

type AlertType = "info" | "success" | "error" | "warning";

interface AlertModalProps {
  open: boolean;
  type?: AlertType;
  title?: string;
  message: string;
  onClose: () => void;
}

interface ConfirmModalProps {
  open: boolean;
  type?: AlertType;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// ─────────────────────────────────────────────────────────────
// Helpers visuais
// ─────────────────────────────────────────────────────────────

const typeConfig: Record<AlertType, { icon: string; iconBg: string; iconColor: string; confirmBtn: string; title: string }> = {
  info: {
    icon: "ℹ️",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    confirmBtn: "bg-blue-600 hover:bg-blue-700",
    title: "Informação",
  },
  success: {
    icon: "✅",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    confirmBtn: "bg-green-600 hover:bg-green-700",
    title: "Sucesso",
  },
  error: {
    icon: "❌",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    confirmBtn: "bg-red-600 hover:bg-red-700",
    title: "Erro",
  },
  warning: {
    icon: "⚠️",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    confirmBtn: "bg-amber-500 hover:bg-amber-600",
    title: "Atenção",
  },
};

// ─────────────────────────────────────────────────────────────
// AlertModal  (substitui alert())
// ─────────────────────────────────────────────────────────────

export function AlertModal({ open, type = "info", title, message, onClose }: AlertModalProps) {
  if (!open) return null;
  const cfg = typeConfig[type];

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6 flex flex-col items-center text-center">
          <div className={`w-14 h-14 rounded-full ${cfg.iconBg} flex items-center justify-center text-2xl mb-4 shadow-sm`}>
            {cfg.icon}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{title ?? cfg.title}</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{message}</p>
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className={`w-full py-3 text-white font-bold rounded-xl transition-colors shadow-md ${cfg.confirmBtn}`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ConfirmModal  (substitui window.confirm())
// ─────────────────────────────────────────────────────────────

export function ConfirmModal({
  open,
  type = "warning",
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;
  const cfg = typeConfig[type];

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6 flex flex-col items-center text-center">
          <div className={`w-14 h-14 rounded-full ${cfg.iconBg} flex items-center justify-center text-2xl mb-4 shadow-sm`}>
            {cfg.icon}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{title ?? cfg.title}</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{message}</p>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 text-gray-700 font-semibold bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 text-white font-bold rounded-xl transition-colors shadow-md ${cfg.confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// useAlert hook
// ─────────────────────────────────────────────────────────────

interface AlertOptions {
  type?: AlertType;
  title?: string;
}

interface AlertState {
  open: boolean;
  message: string;
  type: AlertType;
  title?: string;
}

export function useAlert() {
  const [state, setState] = useState<AlertState>({ open: false, message: "", type: "info" });

  const showAlert = useCallback((message: string, options?: AlertOptions) => {
    setState({ open: true, message, type: options?.type ?? "info", title: options?.title });
  }, []);

  const closeAlert = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const alertProps: AlertModalProps = {
    open: state.open,
    message: state.message,
    type: state.type,
    title: state.title,
    onClose: closeAlert,
  };

  return { showAlert, alertProps };
}

// ─────────────────────────────────────────────────────────────
// useConfirm hook
// ─────────────────────────────────────────────────────────────

interface ConfirmOptions {
  type?: AlertType;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmState {
  open: boolean;
  message: string;
  type: AlertType;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve?: (value: boolean) => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({ open: false, message: "", type: "warning" });

  /** Abre o modal e retorna uma Promise que resolve com true (confirmado) ou false (cancelado) */
  const showConfirm = useCallback((message: string, options?: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        message,
        type: options?.type ?? "warning",
        title: options?.title,
        confirmLabel: options?.confirmLabel,
        cancelLabel: options?.cancelLabel,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false }));
  }, [state]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false }));
  }, [state]);

  const confirmProps: ConfirmModalProps = {
    open: state.open,
    message: state.message,
    type: state.type,
    title: state.title,
    confirmLabel: state.confirmLabel,
    cancelLabel: state.cancelLabel,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  };

  return { showConfirm, confirmProps };
}
