"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { usePerfilUsuario } from "../../hooks/usePerfilUsuario";
import { useAlert, AlertModal } from "../../components/AlertModal";
import { STATUS_ITEM_OP, getCorStatus } from "../../lib/statusProducao";

interface ItemOP {
  id: string;
  descricao: string;
  quantidade: number;
  medidas: string | null;
  imagem_url: string | null;
  setor_atual: string;
  status_item: string;
  op_id: string;
  ordens_producao: {
    numero_op: number;
    orcamento_id: string;
    orcamentos: {
      clientes: {
        nome_razao_social: string;
      };
    };
  };
}

interface OPResumida {
  op_id: string;
  numero_op: number;
  nome_cliente: string;
  orcamento_id: string;
  total_itens: number;
}

interface SubitemOP {
  id: string;
  item_op_id: string;
  nome: string;
  concluido: boolean;
  concluido_por: string | null;
  concluido_em: string | null;
  status?: string;
}

const SETORES = ["metalurgia", "impressao", "plotagem", "instalacao", "embalagem"];
const SETORES_LABELS: Record<string, string> = {
  metalurgia: "Metalurgia",
  impressao: "Impressão",
  plotagem: "Plotagem",
  instalacao: "Instalação",
  embalagem: "Embalagem",
};

const ORDEM_SETORES = SETORES;

export default function SetorPage() {
  const { isAdmin, isOperador, setorDoOperador, userId, loadingPerfil } = usePerfilUsuario();
  const { showAlert, alertProps } = useAlert();

  const [setorAtual, setSetorAtual] = useState<string>("");
  const [ops, setOps] = useState<OPResumida[]>([]);
  const [opSelecionada, setOpSelecionada] = useState<OPResumida | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [itemSelecionadoParaStatus, setItemSelecionadoParaStatus] = useState<ItemOP | null>(null);
  const [itensDaOp, setItensDaOp] = useState<ItemOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // ── SUBITENS ──
  const [subitensMap, setSubitensMap] = useState<Record<string, SubitemOP[]>>({});
  const [expandedSubitens, setExpandedSubitens] = useState<Record<string, boolean>>({});
  const [togglingSubitem, setTogglingSubitem] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setScrolled(prev => {
        if (prev && y < 70) return false;   // volta ao expandido só abaixo de 70px
        if (!prev && y > 130) return true;  // colapsa só acima de 130px
        return prev;                         // zona morta 70-130px: sem mudança
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!loadingPerfil) {
      if (isAdmin) {
        // Admin pode selecionar setor manualmente para testar
        setSetorAtual("metalurgia");
      } else if (isOperador && setorDoOperador) {
        setSetorAtual(setorDoOperador);
      } else if (isOperador && !setorDoOperador) {
        showAlert("Seu perfil de operador não tem setor definido. Solicite ao admin.", { type: "warning", title: "Aviso" });
      }
    }
  }, [loadingPerfil, isAdmin, isOperador, setorDoOperador]);

  useEffect(() => {
    if (setorAtual) {
      carregarOPs();
      const channel = supabase
        .channel(`setor_${setorAtual}_${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "itens_op",
            filter: `setor_atual=eq.${setorAtual}`,
          },
          () => {
            carregarOPs();
            if (opSelecionada) {
              carregarItensDaOP(opSelecionada);
            }
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [setorAtual, opSelecionada]);

  const carregarOPs = async () => {
    if (!setorAtual) return;
    setLoading(true);
    try {
      let query = supabase
        .from("itens_op")
        .select(`
          op_id,
          ordens_producao (
            id,
            numero_op,
            orcamento_id,
            orcamentos ( clientes ( nome_razao_social ) )
          )
        `)
        .in("status_item", ["pendente", "em_andamento"]);

      if (setorAtual === "metalurgia") {
        query = query.or(`setor_atual.eq.metalurgia,setor_atual.eq.aguardando`);
      } else {
        query = query.eq("setor_atual", setorAtual);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapOPs = new Map<string, OPResumida>();
      (data || []).forEach((item: any) => {
        const op = Array.isArray(item.ordens_producao)
          ? item.ordens_producao[0]
          : item.ordens_producao;
        if (!op) return;
        const cliente = Array.isArray(op.orcamentos?.clientes)
          ? op.orcamentos.clientes[0]?.nome_razao_social
          : op.orcamentos?.clientes?.nome_razao_social;
        const chave = item.op_id;
        if (mapOPs.has(chave)) {
          mapOPs.get(chave)!.total_itens += 1;
        } else {
          mapOPs.set(chave, {
            op_id: item.op_id,
            numero_op: op.numero_op,
            nome_cliente: cliente || "Cliente não informado",
            orcamento_id: op.orcamento_id,
            total_itens: 1,
          });
        }
      });

      const listaOPs = Array.from(mapOPs.values()).sort((a, b) => a.numero_op - b.numero_op);
      setOps(listaOPs);

      if (opSelecionada) {
        const opAtualizada = listaOPs.find(o => o.op_id === opSelecionada.op_id);
        if (!opAtualizada) {
          setOpSelecionada(null);
          setItensDaOp([]);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar OPs:", err);
    } finally {
      setLoading(false);
    }
  };

  const carregarItensDaOP = async (op: OPResumida) => {
    setLoading(true);
    try {
      let query = supabase
        .from("itens_op")
        .select(`
          id, descricao, quantidade, medidas, imagem_url, setor_atual, status_item, op_id,
          ordens_producao (
            numero_op,
            orcamento_id,
            orcamentos ( clientes ( nome_razao_social ) )
          )
        `)
        .eq("op_id", op.op_id);
      
      // Remover filtro in("status_item") e filtros de setor
      // Todos os itens da OP devem aparecer

      const { data, error } = await query.order("created_at", { ascending: true });
      if (error) throw error;
      const itens = (data as unknown as ItemOP[]) || [];
      setItensDaOp(itens);
      setOpSelecionada(op);
      setModalAberto(false);
      // Carrega subitens de todos os itens desta OP
      await carregarSubitensDaOP(op.op_id, itens);
    } catch (err) {
      console.error("Erro ao carregar itens da OP:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── FUNÇÕES DE SUBITENS ──
  const carregarSubitensDaOP = async (opId: string, itens: ItemOP[]) => {
    if (itens.length === 0) return;
    const itemIds = itens.map(i => i.id);
    const { data } = await supabase
      .from("subitens_op")
      .select("*")
      .in("item_op_id", itemIds);

    if (data) {
      const mapa: Record<string, SubitemOP[]> = {};
      itemIds.forEach(id => { mapa[id] = []; });
      data.forEach((s: SubitemOP) => {
        if (mapa[s.item_op_id]) mapa[s.item_op_id].push(s);
      });
      setSubitensMap(mapa);
    }
  };

  const toggleSubitemSetor = async (subitem: SubitemOP) => {
    if (!userId) return;
    setTogglingSubitem(subitem.id);
    const novoConcluido = !subitem.concluido;
    await supabase.from("subitens_op").update({
      concluido: novoConcluido,
      concluido_por: novoConcluido ? userId : null,
      concluido_em: novoConcluido ? new Date().toISOString() : null,
    }).eq("id", subitem.id);

    setSubitensMap(prev => ({
      ...prev,
      [subitem.item_op_id]: prev[subitem.item_op_id].map(s =>
        s.id === subitem.id ? { ...s, concluido: novoConcluido } : s
      ),
    }));
    setTogglingSubitem(null);
  };

  const atualizarStatusSubitem = async (subitemId: string, novoStatus: string) => {
    try {
      const { error } = await supabase
        .from("subitens_op")
        .update({ status: novoStatus })
        .eq("id", subitemId);
      
      if (error) throw error;

      setSubitensMap(prev => {
        const next = { ...prev };
        for (const [key, subitens] of Object.entries(next)) {
          next[key] = subitens.map(s => s.id === subitemId ? { ...s, status: novoStatus } : s);
        }
        return next;
      });
      showAlert("Status do subitem atualizado!", { type: "success", title: "OK" });
    } catch (error) {
      showAlert("Erro ao atualizar status: " + (error as Error).message, { type: "error", title: "Erro" });
    }
  };

  const atualizarStatusItem = async (itemId: string, novoStatus: string) => {
    const itemAtual = itensDaOp.find(i => i.id === itemId);
    if (!itemAtual) return;

    if (novoStatus === "finalizado_entregue" || novoStatus === "concluido") {
      setItemSelecionadoParaStatus(null);
      await finalizarItem(itemAtual);
      return;
    }

    if (!userId || !setorAtual) return;
    setProcessando(itemId);

    try {
      const { error: errUpd } = await supabase.from("itens_op").update({ status_item: novoStatus }).eq("id", itemId);
      if (errUpd) throw errUpd;

      await supabase.from("registros_checklist").insert({
        item_op_id: itemId,
        setor: itemAtual.setor_atual,
        acao: novoStatus,
        usuario_id: userId,
      });

      setItensDaOp(prev => prev.map(i => i.id === itemId ? { ...i, status_item: novoStatus } : i));
      setItemSelecionadoParaStatus(null);
      showAlert(`Status atualizado com sucesso`, { type: "success", title: "OK" });
    } catch (err) {
      showAlert("Erro ao atualizar status: " + (err as Error).message, { type: "error", title: "Erro" });
    } finally {
      setProcessando(null);
    }
  };

  const receberItem = async (item: ItemOP) => {
    if (!userId || !setorAtual) return;
    setProcessando(item.id);

    try {
      // 1. Inserir registro de recebimento
      const { error: errReg } = await supabase.from("registros_checklist").insert({
        item_op_id: item.id,
        setor: setorAtual,
        acao: "recebido",
        usuario_id: userId,
      });
      if (errReg) throw errReg;

      // 2. Atualizar item para em_andamento
      const { error: errUpd } = await supabase
        .from("itens_op")
        .update({ status_item: "em_andamento" })
        .eq("id", item.id);
      if (errUpd) throw errUpd;

      // Atualiza estado local
      setItensDaOp(prev => prev.map(i => i.id === item.id ? { ...i, status_item: "em_andamento" } : i));
      showAlert("Item recebido com sucesso!", { type: "success", title: "OK" });
    } catch (err) {
      showAlert("Erro ao registrar: " + (err as Error).message, { type: "error", title: "Erro" });
    } finally {
      setProcessando(null);
    }
  };

  const finalizarItem = async (item: ItemOP) => {
    if (!userId || !setorAtual) return;
    setProcessando(item.id);

    try {
      const idxAtual = ORDEM_SETORES.indexOf(setorAtual);
      const proximoSetor = ORDEM_SETORES[idxAtual + 1] || "concluido";

      // 1. Inserir registro de finalização
      const { error: errReg } = await supabase.from("registros_checklist").insert({
        item_op_id: item.id,
        setor: setorAtual,
        acao: "finalizado_entregue",
        usuario_id: userId,
      });
      if (errReg) throw errReg;

      // 2. Atualizar item para próximo setor
      const { error: errUpd } = await supabase
        .from("itens_op")
        .update({
          setor_atual: proximoSetor,
          status_item: proximoSetor === "concluido" ? "concluido" : "pendente",
        })
        .eq("id", item.id);
      if (errUpd) throw errUpd;

      // 3. Buscar dados da OP para notificação
      const { data: opData } = await supabase
        .from("ordens_producao")
        .select("numero_op, orcamento_id")
        .eq("id", item.op_id)
        .single();

      // 4. Notificar admins sobre avanço de setor
      try {
        const { data: admins } = await supabase
          .from("perfis_usuarios")
          .select("user_id")
          .eq("funcao", "admin");

        if (admins && admins.length > 0 && opData) {
          const numeroOp = String(opData.numero_op).padStart(4, "0");
          const setorLabel = SETORES_LABELS[proximoSetor] || proximoSetor;

          if (proximoSetor === "concluido") {
            // Notifica que item foi concluído
            const notificacoes = admins.map(a => ({
              user_id: a.user_id,
              tipo: "nova_op",
              titulo: `Item concluído na OP #${numeroOp} ✅`,
              mensagem: `"${item.descricao.slice(0, 40)}..." avançou para CONCLUSÃO.`,
              link: `/dashboard/producao/${item.op_id}`,
            }));
            await supabase.from("notifications").insert(notificacoes);
          } else {
            // Notifica admins sobre o avanço
            const notificacoesAdmins = admins.map(a => ({
              user_id: a.user_id,
              tipo: "nova_op",
              titulo: `OP #${numeroOp} avançou para ${setorLabel}`,
              mensagem: `"${item.descricao.slice(0, 40)}..." saiu de ${SETORES_LABELS[setorAtual]} e entrou em ${setorLabel}.`,
              link: `/dashboard/producao/${item.op_id}`,
            }));
            await supabase.from("notifications").insert(notificacoesAdmins);

            // Notifica operadores do próximo setor — aviso antecipado
            try {
              const { data: operadoresProximo } = await supabase
                .from("perfis_usuarios")
                .select("user_id")
                .eq("funcao", "operador")
                .eq("setor", proximoSetor);

              if (operadoresProximo && operadoresProximo.length > 0) {
                const notificacoesOperadores = operadoresProximo.map(op => ({
                  user_id: op.user_id,
                  tipo: "nova_op",
                  titulo: `⏰ Sua vez está chegando, prepare-se!`,
                  mensagem: `Um item de "${item.descricao.slice(0, 35)}..." vai chegar em ${setorLabel} em breve. Acompanhe em /dashboard/setor.`,
                  link: "/dashboard/setor",
                }));
                await supabase.from("notifications").insert(notificacoesOperadores);
              }
            } catch (err) {
              console.error("Erro ao notificar próximo setor:", err);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao notificar admins:", err);
      }

      // 5. Verificar se todos os itens da OP estão concluídos
      if (proximoSetor === "concluido") {
        const { data: itemAtualizado } = await supabase
          .from("itens_op")
          .select("op_id")
          .eq("id", item.id)
          .single();

        if (itemAtualizado) {
          const { data: todosItens } = await supabase
            .from("itens_op")
            .select("status_item")
            .eq("op_id", itemAtualizado.op_id);

          const todosConcluidos = todosItens?.every(i => i.status_item === "concluido");
          if (todosConcluidos) {
            await supabase
              .from("ordens_producao")
              .update({ status: "concluida", updated_at: new Date().toISOString() })
              .eq("id", itemAtualizado.op_id);
          }
        }
      }

      // Remove item da lista local (já saiu do setor)
      setItensDaOp(prev => prev.filter(i => i.id !== item.id));
      showAlert(`Item avançado para ${proximoSetor === "concluido" ? "conclusão" : proximoSetor}!`, { type: "success", title: "OK" });
    } catch (err) {
      showAlert("Erro ao finalizar: " + (err as Error).message, { type: "error", title: "Erro" });
    } finally {
      setProcessando(null);
    }
  };

  if (loadingPerfil) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-xl font-bold animate-pulse">Carregando...</p>
      </div>
    );
  }

  // Admin sem setor definido - seletor manual
  const mostrarSeletor = isAdmin && !setorDoOperador;

  return (
    <div className="min-h-screen bg-gray-900 text-white relative">
      <div id="scroll-sentinel" className="absolute top-0 left-0 w-full h-1" />

      {/* ===================== CABEÇALHO ===================== */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-20">

        {/* MODO EXPANDIDO — visível no topo */}
        {!scrolled && (
          <div className="p-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-2xl font-black text-white">⚙️ Meu Setor</h1>
                {/* Seletor de setor para Admin */}
                {isAdmin && (
                  <select
                    value={setorAtual}
                    onChange={e => {
                      setSetorAtual(e.target.value);
                      setOpSelecionada(null);
                      setItensDaOp([]);
                    }}
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {SETORES.map(s => (
                      <option key={s} value={s}>{SETORES_LABELS[s]}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Linha de filtro + botão de seleção de OP */}
              <div className="flex items-center gap-3 flex-wrap">
                {setorAtual && (
                  <span className="px-3 py-1 bg-blue-600 rounded-full font-bold text-white text-sm">
                    {SETORES_LABELS[setorAtual]}
                  </span>
                )}

                {/* Botão de seleção de OP — mostra a OP atual ou convida a escolher */}
                <button
                  onClick={() => setModalAberto(true)}
                  className="flex items-center gap-2 px-4 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded-full text-sm font-bold text-white transition-colors"
                >
                  <span>📋</span>
                  {opSelecionada
                    ? `OP ${String(opSelecionada.numero_op).padStart(4, "0")} — ${opSelecionada.nome_cliente}`
                    : "Selecionar OP"}
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Botão Ver OP — aparece ao lado quando uma OP está selecionada */}
                {opSelecionada && (
                  <button
                    onClick={() => window.open(`/imprimir/${opSelecionada.orcamento_id}?action=op`, "_blank")}
                    className="flex items-center gap-2 px-4 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded-full text-sm font-bold text-gray-200 transition-colors"
                  >
                    <span>📄</span>
                    Ver OP
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODO COMPACTO — visível ao rolar */}
        {scrolled && (
          <div className="px-4 py-2.5">
            <div className="max-w-3xl mx-auto flex items-center gap-2">
              {setorAtual && (
                <span className="px-2.5 py-1 bg-blue-600 rounded-full font-bold text-white text-xs shrink-0">
                  {SETORES_LABELS[setorAtual]}
                </span>
              )}
              {/* Nome da OP — clicar rola para o topo */}
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex-1 flex items-center gap-1.5 text-sm font-bold text-white min-w-0 text-left"
              >
                <span className="truncate">
                  {opSelecionada
                    ? `OP ${String(opSelecionada.numero_op).padStart(4, "0")} — ${opSelecionada.nome_cliente}`
                    : "Selecionar OP"}
                </span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ===================== MODAL DE SELEÇÃO DE OP ===================== */}
      {modalAberto && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setModalAberto(false)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-black text-white">Selecionar Ordem de Produção</h2>
              <button
                onClick={() => setModalAberto(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto space-y-2">
              {loading ? (
                <p className="text-gray-400 text-center py-8 animate-pulse">Carregando OPs...</p>
              ) : ops.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-300 font-bold">Nenhuma OP aguardando neste setor.</p>
                  <p className="text-gray-500 text-sm mt-1">Tudo em dia! ✅</p>
                </div>
              ) : (
                ops.map(op => (
                  <button
                    key={op.op_id}
                    onClick={() => carregarItensDaOP(op)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      opSelecionada?.op_id === op.op_id
                        ? "bg-blue-700 border-blue-500 text-white"
                        : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">OP</p>
                        <p className="text-xl font-black">
                          #{String(op.numero_op).padStart(4, "0")}
                        </p>
                        <p className="text-sm font-semibold text-gray-300 mt-0.5">{op.nome_cliente}</p>
                      </div>
                      <span className="bg-blue-600/30 text-blue-300 font-black text-sm px-3 py-1 rounded-full">
                        {op.total_itens} {op.total_itens === 1 ? "item" : "itens"}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== CONTEÚDO PRINCIPAL ===================== */}
      <div className="max-w-3xl mx-auto p-4">

        {/* Estado: nenhuma OP selecionada */}
        {!opSelecionada && !loading && (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">📋</span>
            </div>
            <h3 className="text-lg font-bold text-gray-200">Selecione uma OP para começar</h3>
            <p className="text-gray-400 text-sm mt-1 mb-5">
              Toque no botão acima para ver as ordens de produção aguardando no seu setor.
            </p>
            <button
              onClick={() => setModalAberto(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-white transition-colors"
            >
              Ver OPs disponíveis ({ops.length})
            </button>
          </div>
        )}

        {/* Estado: carregando itens da OP */}
        {loading && opSelecionada && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-xl font-bold animate-pulse">Carregando itens...</p>
          </div>
        )}

        {/* Estado: OP selecionada sem itens */}
        {opSelecionada && !loading && itensDaOp.length === 0 && (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-200">Tudo em dia nesta OP!</h3>
            <p className="text-gray-400 text-sm mt-1">Nenhum item pendente neste setor para esta OP.</p>
          </div>
        )}

        {/* ===================== GRADE DE CARDS (2 por linha) ===================== */}
        {opSelecionada && !loading && itensDaOp.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {itensDaOp.map(item => {
              const pendente = item.status_item === "pendente";

              return (
                <div
                  key={item.id}
                  className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden flex flex-col relative"
                >
                  <div className="absolute top-2 left-2 z-10">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shadow-sm ${
                      item.setor_atual === setorAtual 
                        ? "bg-blue-100 text-blue-700" 
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {SETORES_LABELS[item.setor_atual] || item.setor_atual || "aguardando"}
                    </span>
                  </div>
                  {/* Imagem do produto — ocupa área generosa no topo do card */}
                  {item.imagem_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imagem_url}
                      alt={item.descricao}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gray-700 flex items-center justify-center">
                      <span className="text-4xl">📦</span>
                    </div>
                  )}

                  {/* Informações do item */}
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <p className="text-sm font-bold text-white leading-tight line-clamp-2">
                      {item.descricao}
                    </p>
                    <p className="text-xs text-gray-400">
                      <span className="text-blue-400 font-black text-base">{item.quantidade}x</span>
                      {" "} {item.medidas ? ` ${item.medidas}` : ""}
                    </p>

                    {/* ── SUBITENS DO ITEM ── */}
                    {subitensMap[item.id] && subitensMap[item.id].length > 0 && (
                      <div className="mt-2">
                        {/* Toggle para expandir/colapsar subitens */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSubitens(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                          }}
                          className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-200 transition-colors py-1"
                        >
                          <span className="font-semibold">
                            ✅ {subitensMap[item.id].filter(s => s.concluido).length}/{subitensMap[item.id].length} subitens
                          </span>
                          <svg
                            className={`w-3 h-3 transition-transform ${expandedSubitens[item.id] ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Mini barra de progresso dos subitens */}
                        <div className="w-full bg-gray-700 rounded-full h-1 mb-1">
                          <div
                            className="h-1 rounded-full bg-green-500 transition-all"
                            style={{
                              width: `${Math.round(
                                (subitensMap[item.id].filter(s => s.concluido).length / subitensMap[item.id].length) * 100
                              )}%`
                            }}
                          />
                        </div>

                        {/* Lista de subitens (expandível) */}
                        {expandedSubitens[item.id] && (
                          <div className="space-y-2 mt-2">
                            {subitensMap[item.id].map(subitem => {
                              const podeInteragir = isAdmin || item.setor_atual === setorAtual;
                              return (
                                <div
                                  key={subitem.id}
                                  className={`flex items-center justify-between p-2 rounded-lg transition-colors border ${
                                    subitem.concluido ? "bg-green-900/20 border-green-900/50" : "bg-gray-700/30 border-gray-600"
                                  }`}
                                  onClick={e => e.stopPropagation()}
                                >
                                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                                    <input
                                      type="checkbox"
                                      checked={subitem.concluido}
                                      disabled={togglingSubitem === subitem.id || !podeInteragir}
                                      onChange={() => toggleSubitemSetor(subitem)}
                                      className="w-4 h-4 accent-green-500 shrink-0"
                                    />
                                    <span className={`text-xs leading-tight ${subitem.concluido ? "line-through text-gray-500" : "text-gray-200"}`}>
                                      {subitem.nome}
                                    </span>
                                  </label>
                                  
                                  <select
                                    value={subitem.status || "pendente"}
                                    onChange={e => atualizarStatusSubitem(subitem.id, e.target.value)}
                                    disabled={!podeInteragir}
                                    className={`text-[10px] md:text-xs border border-gray-600 rounded px-1 py-1 outline-none font-medium ml-2 ${
                                      !podeInteragir ? "opacity-50 cursor-not-allowed" : ""
                                    } ${
                                      getCorStatus(subitem.status || "pendente").split(" ")[0].replace("100", "800")
                                    } text-white`}
                                  >
                                    {STATUS_ITEM_OP.map(s => (
                                      <option key={s.value} value={s.value} className="bg-gray-800">{s.label}</option>
                                    ))}
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Botões de Interação travados por setor */}
                    {(() => {
                      const podeInteragir = isAdmin || item.setor_atual === setorAtual;
                      const opacityClass = !podeInteragir ? "opacity-40 cursor-not-allowed" : "";

                      if (item.status_item === "concluido") {
                        return (
                          <div className="mt-auto w-full py-3 bg-emerald-900/40 border border-emerald-800/50 rounded-xl flex flex-col items-center gap-0.5">
                            <span className="text-xl">✅</span>
                            <span className="text-emerald-500 font-bold text-sm">Concluído</span>
                          </div>
                        );
                      }

                      return (
                        <div className={`mt-auto ${opacityClass}`}>
                          <button
                            disabled={!podeInteragir || processando === item.id}
                            onClick={() => podeInteragir ? setItemSelecionadoParaStatus(item) : null}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl font-black text-white text-sm transition-colors flex flex-col items-center gap-0.5"
                          >
                            <span className="text-xl">🛠️</span>
                            {processando === item.id ? "..." : (podeInteragir ? "Alterar Status" : "Outro Setor")}
                          </button>
                        </div>
                      );
                    })()}

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================== MODAL DE STATUS ===================== */}
      {itemSelecionadoParaStatus && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setItemSelecionadoParaStatus(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Alterar Status</h2>
              <button
                onClick={() => setItemSelecionadoParaStatus(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 grid grid-cols-1 gap-2">
              {STATUS_ITEM_OP.map(s => (
                <button
                  key={s.value}
                  onClick={() => atualizarStatusItem(itemSelecionadoParaStatus.id, s.value)}
                  className={`w-full px-4 py-3 rounded-lg text-sm font-medium text-left transition-colors flex justify-between items-center ${
                    itemSelecionadoParaStatus.status_item === s.value
                      ? "ring-2 ring-blue-500 " + getCorStatus(s.value)
                      : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                  }`}
                >
                  {s.label}
                  {itemSelecionadoParaStatus.status_item === s.value && <span>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <AlertModal {...alertProps} />
    </div>
  );
}