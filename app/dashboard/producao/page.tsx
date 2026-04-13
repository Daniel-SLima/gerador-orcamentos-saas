"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { usePerfilUsuario } from "../../hooks/usePerfilUsuario";

interface ItemOP {
  id: string;
  status_item: string;
  setor_atual: string;
}

interface OpCompleta {
  id: string;
  numero_op: number;
  status: string;
  created_at: string;
  orcamentos: {
    numero_orcamento: number;
    clientes: {
      nome_razao_social: string;
    };
  };
  itens_op: ItemOP[];
}

const STATUS_LABELS: Record<string, { label: string; badge: string }> = {
  em_producao: { label: "Em Produção", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  concluida: { label: "Concluída", badge: "bg-green-100 text-green-700 border-green-200" },
  pausada: { label: "Pausada", badge: "bg-gray-100 text-gray-600 border-gray-200" },
};

const SETORES = ["metalurgia", "impressao", "plotagem", "instalacao", "embalagem"];

export default function ProducaoPage() {
  const router = useRouter();
  const { isAdmin, loadingPerfil } = usePerfilUsuario();
  const [ops, setOps] = useState<OpCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);
  const [filtroSetor, setFiltroSetor] = useState<string>("todos");

  useEffect(() => {
    if (!loadingPerfil) {
      if (!isAdmin) {
        router.replace("/dashboard");
        return;
      }
      carregarOps();
    }
  }, [loadingPerfil, isAdmin]);

  const carregarOps = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ordens_producao")
        .select(`
          id, numero_op, status, created_at,
          orcamentos (
            numero_orcamento,
            clientes ( nome_razao_social )
          ),
          itens_op ( id, status_item, setor_atual )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOps((data as unknown as OpCompleta[]) || []);
    } catch (err) {
      console.error("Erro ao carregar OPs:", err);
    } finally {
      setLoading(false);
    }
  };

  const POSICAO_SETOR: Record<string, number> = {
    aguardando: 0, metalurgia: 1, impressao: 2, plotagem: 3,
    instalacao: 4, embalagem: 5, concluido: 6,
  };
  const TOTAL_ETAPAS = 6;

  const getProgresso = (op: OpCompleta) => {
    if (!op.itens_op || op.itens_op.length === 0) return 0;
    const somaProgresso = op.itens_op.reduce((acc, item) => {
      const pos = POSICAO_SETOR[item.setor_atual] ?? 0;
      return acc + pos;
    }, 0);
    return Math.round((somaProgresso / (op.itens_op.length * TOTAL_ETAPAS)) * 100);
  };

  const getSetorAtualDominante = (op: OpCompleta): string => {
    if (!op.itens_op || op.itens_op.length === 0) return "aguardando";
    const contagem: Record<string, number> = {};
    op.itens_op.forEach(i => {
      contagem[i.setor_atual] = (contagem[i.setor_atual] || 0) + 1;
    });
    return Object.entries(contagem).sort((a, b) => b[1] - a[1])[0]?.[0] || "aguardando";
  };

  const opsFiltradas = ops.filter(op => {
    if (!mostrarConcluidas && op.status === "concluida") return false;
    if (filtroSetor !== "todos") {
      const setor = getSetorAtualDominante(op);
      if (filtroSetor === "aguardando") return setor === "aguardando" || setor === "metalurgia";
      if (setor !== filtroSetor) return false;
    }
    return true;
  });

  if (loadingPerfil || loading) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <div className="p-8 text-center text-gray-500">Carregando Centro de Produção...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏭 Central de Produção</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie todas as Ordens de Produção</p>
        </div>
        <div className="flex gap-3">
          <select
            value={filtroSetor}
            onChange={e => setFiltroSetor(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="todos">Todos os Setores</option>
            <option value="aguardando">Aguardando Início</option>
            {SETORES.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={mostrarConcluidas}
              onChange={e => setMostrarConcluidas(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            Ver concluídas
          </label>
        </div>
      </div>

      {/* Cards de OPs */}
      {opsFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">🏭</div>
          <p className="text-gray-500 font-medium">Nenhuma ordem de produção encontrada.</p>
          <p className="text-gray-400 text-sm mt-1">Gere uma OP a partir de um orçamento aprovado no Histórico.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {opsFiltradas.map(op => {
            const progresso = getProgresso(op);
            const cliente = Array.isArray(op.orcamentos?.clientes)
              ? op.orcamentos?.clientes[0]?.nome_razao_social
              : op.orcamentos?.clientes?.nome_razao_social;
            const statusInfo = STATUS_LABELS[op.status] || STATUS_LABELS.em_producao;
            const totalItens = op.itens_op?.length || 0;
            const concluidosItens = op.itens_op?.filter(i => i.status_item === "concluido").length || 0;
            const dataFormatada = new Date(op.created_at).toLocaleDateString("pt-BR");

            return (
              <Link key={op.id} href={`/dashboard/producao/${op.id}`}>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-full">
                  {/* Cabeçalho do card */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">OP</span>
                      <h3 className="text-xl font-black text-gray-900">#{String(op.numero_op).padStart(4, "0")}</h3>
                    </div>
                    <span className={`inline-block px-2 py-1 text-xs font-bold rounded-full border ${statusInfo.badge}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Cliente e Orçamento */}
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-700 truncate">{cliente || "Cliente não informado"}</p>
                    <p className="text-xs text-gray-400">Orçamento #{op.orcamentos?.numero_orcamento}</p>
                  </div>

                  {/* Data */}
                  <p className="text-xs text-gray-400 mb-3">Criada em {dataFormatada}</p>

                  {/* Barra de progresso */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progresso</span>
                      <span>{concluidosItens}/{totalItens} itens</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${progresso}%`,
                          backgroundColor: progresso === 100 ? "#22c55e" : progresso > 50 ? "#f59e0b" : "#3b82f6"
                        }}
                      />
                    </div>
                    <p className="text-right text-xs font-bold text-gray-600 mt-1">{progresso}%</p>
                  </div>

                  {/* Setor atual dominante */}
                  <div className="flex flex-wrap gap-1">
                    {SETORES.map(setor => {
                      const count = op.itens_op?.filter(i => {
                        if (setor === "metalurgia" && i.setor_atual === "aguardando") return true;
                        return i.setor_atual === setor;
                      }).length || 0;
                      if (count === 0) return null;
                      return (
                        <span key={setor} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                          {count} {setor.charAt(0).toUpperCase() + setor.slice(1)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
