"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { usePerfilUsuario } from "../hooks/usePerfilUsuario";
import { useRouter } from "next/navigation";

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
}

const ICONES_TIPO: Record<string, string> = {
  novo_orcamento: "📄",
  orcamento_atualizado: "✏️",
  orcamento_aprovado: "✅",
  orcamento_recusado: "❌",
  nova_op: "🏭",
};

function tempoRelativo(dataStr: string): string {
  const data = new Date(dataStr);
  const agora = new Date();
  const diffMs = agora.getTime() - data.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffH < 24) return `há ${diffH}h`;
  if (diffD === 1) return "ontem";
  if (diffD < 7) return `há ${diffD} dias`;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function NotificationBell() {
  const { userId, loadingPerfil, isAdmin } = usePerfilUsuario();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Carrega estado de bloqueio do localStorage ao montar
  useEffect(() => {
    const salvo = localStorage.getItem("notif_bloqueado");
    if (salvo === "1") setBloqueado(true);
  }, []);

  // Admin pode reativar as notificações (limpa o localStorage)
  const reativarNotificacoes = () => {
    setBloqueado(false);
    localStorage.removeItem("notif_bloqueado");
  };

  const carregarNotificacoes = async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) {
        setNotificacoes(data as Notificacao[]);
        setNaoLidas(data.filter((n: Notificacao) => !n.lida).length);
      }
    } catch (err) {
      console.error("Erro ao carregar notificações:", err);
    }
  };

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    carregarNotificacoes();

    const channel = supabase
      .channel(`notif_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          carregarNotificacoes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    if (aberto) {
      document.addEventListener("mousedown", handleClickFora);
    }
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, [aberto]);

  const marcarComoLida = async (notif: Notificacao) => {
    try {
      await supabase
        .from("notifications")
        .update({ lida: true })
        .eq("id", notif.id);
      setNotificacoes(prev =>
        prev.map(n => n.id === notif.id ? { ...n, lida: true } : n)
      );
      setNaoLidas(prev => Math.max(0, prev - 1));
      if (notif.link) {
        setAberto(false);
        router.push(notif.link);
      }
    } catch (err) {
      console.error("Erro ao marcar notificação como lida:", err);
    }
  };

  const marcarTodasLidas = async () => {
    if (!userId) return;
    try {
      await supabase
        .from("notifications")
        .update({ lida: true })
        .eq("user_id", userId)
        .eq("lida", false);
      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
      setNaoLidas(0);
    } catch (err) {
      console.error("Erro ao marcar todas como lidas:", err);
    }
  };

  if (loadingPerfil || !userId) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do sino */}
      <button
        onClick={() => setAberto(!aberto)}
        className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100"
        title="Notificações"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse shadow-sm">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {aberto && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-800 text-sm">Notificações</h3>
            {naoLidas > 0 && (
              <button
                onClick={marcarTodasLidas}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Banner de limite excedido */}
          {bloqueado && (
            <div className="mx-3 mt-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <span className="text-amber-500 text-sm flex-shrink-0 mt-0.5">⚠️</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-700">Modo informativo</p>
                <p className="text-[11px] text-amber-600 mt-0.5 leading-snug">
                  Limite do plano gratuito atingido. Novas notificações podem não chegar até o próximo mês.
                </p>
                {isAdmin && (
                  <button
                    onClick={reativarNotificacoes}
                    className="text-[11px] text-amber-700 font-bold underline mt-1 hover:text-amber-900"
                  >
                    Resetar modo normal
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto">
            {notificacoes.length === 0 ? (
              <div className="py-10 text-center">
                <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                <p className="text-gray-400 text-sm font-medium">Tudo limpo por aqui!</p>
                <p className="text-gray-300 text-xs mt-1">Nenhuma notificação no momento.</p>
              </div>
            ) : (
              notificacoes.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => marcarComoLida(notif)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-3 ${
                    !notif.lida ? "bg-blue-50/50" : ""
                  }`}
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">
                    {ICONES_TIPO[notif.tipo] || "🔔"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${!notif.lida ? "text-gray-900" : "text-gray-600"}`}>
                      {notif.titulo}
                    </p>
                    {notif.mensagem && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.mensagem}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">{tempoRelativo(notif.created_at)}</p>
                  </div>
                  {!notif.lida && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
