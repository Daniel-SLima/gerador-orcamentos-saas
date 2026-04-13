"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { usePerfilUsuario } from "../../../hooks/usePerfilUsuario";
import { useAlert, AlertModal } from "../../../components/AlertModal";

interface RegistroChecklist {
  id: string;
  setor: string;
  acao: string;
  created_at: string;
  usuario_id: string;
}

interface ItemOP {
  id: string;
  descricao: string;
  quantidade: number;
  medidas: string | null;
  imagem_url: string | null;
  setor_atual: string;
  status_item: string;
  registros_checklist: RegistroChecklist[];
}

interface OpCompleta {
  id: string;
  numero_op: number;
  status: string;
  created_at: string;
  observacoes: string | null;
  orcamentos: {
    numero_orcamento: number;
    clientes: {
      nome_razao_social: string;
    };
  };
  itens_op: ItemOP[];
}

const SETORES = ["metalurgia", "impressao", "plotagem", "instalacao", "embalagem"];

const SETOR_ICONS: Record<string, string> = {
  aguardando: "⏳",
  metalurgia: "🔩",
  impressao: "🖨️",
  plotagem: "📏",
  instalacao: "🔧",
  embalagem: "📦",
  concluido: "✅",
};

const SETOR_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  aguardando: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-500" },
  metalurgia: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700" },
  impressao: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  plotagem: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  instalacao: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700" },
  embalagem: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  concluido: { bg: "bg-green-100", border: "border-green-300", text: "text-green-800" },
};

export default function ProducaoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin, loadingPerfil } = usePerfilUsuario();
  const { showAlert, alertProps } = useAlert();
  const [op, setOp] = useState<OpCompleta | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemExpandido, setItemExpandido] = useState<string | null>(null);
  const [editandoObs, setEditandoObs] = useState(false);
  const [obsTexto, setObsTexto] = useState("");
  const [salvandoObs, setSalvandoObs] = useState(false);

  const id = params.id as string;

  useEffect(() => {
    if (!loadingPerfil) {
      if (!isAdmin) {
        router.replace("/dashboard");
        return;
      }
      carregarOp();
    }
  }, [loadingPerfil, isAdmin]);

  const carregarOp = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ordens_producao")
        .select(`
          id, numero_op, status, created_at, observacoes,
          orcamentos (
            numero_orcamento,
            clientes ( nome_razao_social )
          ),
          itens_op (
            id, descricao, quantidade, medidas, imagem_url,
            setor_atual, status_item,
            registros_checklist (
              id, setor, acao, created_at,
              usuario_id
            )
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setOp(data as unknown as OpCompleta);
      setObsTexto(data?.observacoes || "");
    } catch (err) {
      console.error("Erro ao carregar OP:", err);
      showAlert("Erro ao carregar dados da OP.", { type: "error", title: "Erro" });
    } finally {
      setLoading(false);
    }
  };

  const salvarObservacoes = async () => {
    setSalvandoObs(true);
    try {
      const { error } = await supabase
        .from("ordens_producao")
        .update({ observacoes: obsTexto, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setOp(prev => prev ? { ...prev, observacoes: obsTexto } : null);
      setEditandoObs(false);
    } catch (err) {
      showAlert("Erro ao salvar observações.", { type: "error", title: "Erro" });
    } finally {
      setSalvandoObs(false);
    }
  };

  const getStatusSetor = (item: ItemOP, setor: string): "vazio" | "pendente" | "andamento" | "concluido" => {
    const posicoes: Record<string, number> = { aguardando: -1, metalurgia: 0, impressao: 1, plotagem: 2, instalacao: 3, embalagem: 4, concluido: 5 };
    const posItem = posicoes[item.setor_atual] ?? -1;
    const posSetor = posicoes[setor] ?? -1;

    if (item.setor_atual === "concluido" && setor !== "concluido") return "concluido";
    if (posItem < posSetor) return "concluido";
    if (posItem === posSetor) {
      if (item.status_item === "concluido") return "concluido";
      if (item.status_item === "em_andamento") return "andamento";
      return "pendente";
    }
    return "vazio";
  };

  const POSICAO_SETOR: Record<string, number> = {
    aguardando: 0, metalurgia: 1, impressao: 2, plotagem: 3,
    instalacao: 4, embalagem: 5, concluido: 6,
  };
  const TOTAL_ETAPAS = 6;

  const getProgresso = () => {
    if (!op?.itens_op || op.itens_op.length === 0) return 0;
    const somaProgresso = op.itens_op.reduce((acc, item) => {
      const pos = POSICAO_SETOR[item.setor_atual] ?? 0;
      return acc + pos;
    }, 0);
    return Math.round((somaProgresso / (op.itens_op.length * TOTAL_ETAPAS)) * 100);
  };

  if (loading || loadingPerfil) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <div className="p-8 text-center text-gray-500">Carregando...</div>
      </div>
    );
  }

  if (!op) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <div className="p-8 text-center text-gray-500">Ordem de Produção não encontrada.</div>
      </div>
    );
  }

  const cliente = Array.isArray(op.orcamentos?.clientes)
    ? op.orcamentos?.clientes[0]?.nome_razao_social
    : op.orcamentos?.clientes?.nome_razao_social;
  const progresso = getProgresso();
  const totalItens = op.itens_op?.length || 0;
  const concluidosItens = op.itens_op?.filter(i => i.status_item === "concluido").length || 0;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">

      {/* Cabeçalho */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push("/dashboard/producao")} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-gray-900">OP #{String(op.numero_op).padStart(4, "0")}</h1>
            <span className={`inline-block px-2 py-1 text-xs font-bold rounded-full border ${op.status === "concluida" ? "bg-green-100 text-green-700 border-green-200" : op.status === "pausada" ? "bg-gray-100 text-gray-600 border-gray-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
              {op.status === "concluida" ? "✅ Concluída" : op.status === "pausada" ? "⏸ Pausada" : "🟡 Em Produção"}
            </span>
          </div>
          <p className="text-gray-500 text-sm">{cliente} — Orçamento #{op.orcamentos?.numero_orcamento}</p>
          <p className="text-gray-400 text-xs mt-0.5">Criada em {new Date(op.created_at).toLocaleDateString("pt-BR")}</p>
        </div>
      </div>

      {/* Barra de progresso geral */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex justify-between text-sm font-bold text-gray-600 mb-2">
          <span>Progresso Geral</span>
          <span>{concluidosItens}/{totalItens} itens — {progresso}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all duration-500"
            style={{
              width: `${progresso}%`,
              backgroundColor: progresso === 100 ? "#22c55e" : progresso > 50 ? "#f59e0b" : "#3b82f6"
            }}
          />
        </div>
      </div>

      {/* Linha do tempo dos setores */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Fluxo de Produção</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {SETORES.map((setor, idx) => {
            const itemsNoSetor = op.itens_op?.filter(i => {
              if (setor === "metalurgia" && i.setor_atual === "aguardando") return true;
              return i.setor_atual === setor;
            }).length || 0;
            const itemsConcluidosNoSetor = op.itens_op?.filter(i => i.setor_atual === setor && i.status_item === "concluido").length || 0;
            const todasConcluidas = itemsNoSetor > 0 && itemsConcluidosNoSetor === itemsNoSetor;
            const emAndamento = itemsNoSetor > 0 && itemsConcluidosNoSetor < itemsNoSetor;

            return (
              <div key={setor} className="flex items-center gap-2">
                <div className={`flex flex-col items-center px-4 py-3 rounded-xl min-w-[90px] border-2 transition-all ${todasConcluidas ? "bg-green-100 border-green-300 text-green-800" : emAndamento ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}>
                  <span className="text-2xl mb-1">{SETOR_ICONS[setor]}</span>
                  <span className="text-xs font-bold capitalize">{setor}</span>
                  <span className="text-xs mt-0.5">{itemsNoSetor > 0 ? `${itemsConcluidosNoSetor}/${itemsNoSetor}` : "—"}</span>
                </div>
                {idx < SETORES.length - 1 && (
                  <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Observações */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Observações</h2>
          {!editandoObs ? (
            <button onClick={() => setEditandoObs(true)} className="text-xs text-blue-600 font-bold hover:text-blue-800">Editar</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditandoObs(false); setObsTexto(op.observacoes || ""); }} className="text-xs text-gray-500 font-bold hover:text-gray-700">Cancelar</button>
              <button onClick={salvarObservacoes} disabled={salvandoObs} className="text-xs text-green-600 font-bold hover:text-green-800 disabled:opacity-50">{salvandoObs ? "Salvando..." : "Salvar"}</button>
            </div>
          )}
        </div>
        {editandoObs ? (
          <textarea
            value={obsTexto}
            onChange={e => setObsTexto(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            placeholder="Adicione observações sobre esta ordem de produção..."
          />
        ) : (
          <p className="text-sm text-gray-600">{op.observacoes || "Nenhuma observação."}</p>
        )}
      </div>

      {/* Lista de itens */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Itens da OP ({totalItens})</h2>
        </div>

        <div className="divide-y divide-gray-50">
          {op.itens_op?.map(item => {
            const expandido = itemExpandido === item.id;
            const registroAnterior = item.setor_atual !== "aguardando" && item.setor_atual !== "concluido"
              ? SETORES[SETORES.indexOf(item.setor_atual) - 1]
              : null;

            return (
              <div key={item.id}>
                <div
                  className="px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setItemExpandido(expandido ? null : item.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Imagem */}
                    {item.imagem_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imagem_url} alt="" className="w-12 h-12 object-cover rounded-lg border border-gray-200 shrink-0" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xl shrink-0">📦</div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{item.descricao}</p>
                      <p className="text-xs text-gray-400">{item.quantidade}x {item.medidas || "sem medidas"}</p>
                    </div>

                    {/* Badge do setor atual */}
                    <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold capitalize ${SETOR_COLORS[item.setor_atual]?.bg} ${SETOR_COLORS[item.setor_atual]?.border} ${SETOR_COLORS[item.setor_atual]?.text}`}>
                      {item.status_item === "concluido" ? "✅" : item.status_item === "em_andamento" ? "⚙️" : "⏳"} {item.setor_atual}
                    </div>

                    {/* Expandir */}
                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandido ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>

                {/* Expandido: histórico de registros */}
                {expandido && (
                  <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Histórico de Setores</p>
                    <div className="space-y-2">
                      {/* Mostra todos os setores como linha do tempo */}
                      {SETORES.map((setor, idx) => {
                        const status = getStatusSetor(item, setor);
                        const registros = item.registros_checklist?.filter(r => r.setor === setor) || [];
                        const cor = status === "concluido" ? "bg-green-400" : status === "andamento" ? "bg-amber-400" : status === "pendente" ? "bg-gray-300" : "bg-gray-200";

                        return (
                          <div key={setor} className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-3 h-3 rounded-full border-2 ${status === "vazio" ? "bg-white border-gray-200" : "bg-white border-transparent"}`} style={{ borderColor: status !== "vazio" ? cor : undefined }} />
                              {idx < SETORES.length - 1 && <div className={`w-0.5 h-6 ${status === "concluido" ? "bg-green-300" : "bg-gray-200"}`} />}
                            </div>
                            <div className="flex-1 pb-2">
                              <p className={`text-sm font-bold capitalize ${status === "vazio" ? "text-gray-300" : "text-gray-700"}`}>{setor}</p>
                              {registros.map(reg => (
                                <p key={reg.id} className="text-xs text-gray-500">
                                  {reg.acao === "recebido" ? "📥" : "📤"} {reg.acao === "recebido" ? "Recebido" : "Finalizado e entregue"} — {new Date(reg.created_at).toLocaleString("pt-BR")}
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AlertModal {...alertProps} />
    </div>
  );
}
