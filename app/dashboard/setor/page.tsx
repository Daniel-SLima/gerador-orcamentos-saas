"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { usePerfilUsuario } from "../../hooks/usePerfilUsuario";
import { useAlert, AlertModal } from "../../components/AlertModal";

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
  const [itens, setItens] = useState<ItemOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);

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
      carregarItens();
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
          () => { carregarItens(); }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [setorAtual]);

  const carregarItens = async () => {
    if (!setorAtual) return;
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
        .in("status_item", ["pendente", "em_andamento"]);

      if (setorAtual === "metalurgia") {
        query = query.or(`setor_atual.eq.metalurgia,setor_atual.eq.aguardando`);
      } else {
        query = query.eq("setor_atual", setorAtual);
      }

      query = query.order("created_at", { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      setItens((data as unknown as ItemOP[]) || []);
    } catch (err) {
      console.error("Erro ao carregar itens:", err);
    } finally {
      setLoading(false);
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
      setItens(prev => prev.map(i => i.id === item.id ? { ...i, status_item: "em_andamento" } : i));
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
      setItens(prev => prev.filter(i => i.id !== item.id));
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
    <div className="min-h-screen bg-gray-900 text-white">

      {/* Cabeçalho */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-black text-white">⚙️ Meu Setor</h1>
              <p className="text-gray-400 text-sm">
                {setorDoOperador || (isAdmin ? "Modo Admin" : "Sem setor definido")}
              </p>
            </div>
            {mostrarSeletor && (
              <select
                value={setorAtual}
                onChange={e => setSetorAtual(e.target.value)}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {SETORES.map(s => (
                  <option key={s} value={s}>{SETORES_LABELS[s]}</option>
                ))}
              </select>
            )}
          </div>
          {setorAtual && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">Filtrando por:</span>
              <span className="px-3 py-1 bg-blue-600 rounded-full font-bold text-white">{SETORES_LABELS[setorAtual]}</span>
            </div>
          )}
        </div>
      </div>

      {/* Lista de itens */}
      <div className="max-w-3xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-xl font-bold animate-pulse">Carregando itens...</p>
          </div>
        ) : itens.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-gray-400 text-xl font-bold">Nenhum item pendente</p>
            <p className="text-gray-500 text-sm mt-1">Itens chegarão aqui automaticamente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {itens.map(item => {
              const cliente = Array.isArray(item.ordens_producao?.orcamentos?.clientes)
                ? item.ordens_producao?.orcamentos?.clientes[0]?.nome_razao_social
                : item.ordens_producao?.orcamentos?.clientes?.nome_razao_social;
              const pendente = item.status_item === "pendente";

              return (
                <div key={item.id} className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
                  {/* OP e Cliente */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">OP</span>
                      <p className="text-xl font-black text-white">#{String(item.ordens_producao?.numero_op || 0).padStart(4, "0")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-300">{cliente || "—"}</p>
                    </div>
                  </div>

                  {/* Descrição do item */}
                  <div className="mb-4">
                    <p className="text-lg font-bold text-white leading-tight">{item.descricao}</p>
                    <p className="text-gray-400 text-sm mt-1">
                      <span className="text-2xl font-black text-blue-400">{item.quantidade}x</span>
                      {" "} {item.medidas || "sem medidas"}
                    </p>
                  </div>

                  {/* Imagem */}
                  {item.imagem_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imagem_url} alt="" className="w-full h-40 object-cover rounded-xl mb-4 border border-gray-600" />
                  )}

                  {/* Botões de ação */}
                  <div className="grid grid-cols-2 gap-3">
                    {pendente ? (
                      <button
                        onClick={() => receberItem(item)}
                        disabled={processando === item.id}
                        className="py-5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-xl font-black text-white transition-colors flex flex-col items-center gap-1"
                      >
                        <span className="text-3xl">📥</span>
                        {processando === item.id ? "Processando..." : "Recebi"}
                      </button>
                    ) : (
                      <button
                        onClick={() => finalizarItem(item)}
                        disabled={processando === item.id}
                        className="py-5 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-xl text-xl font-black text-white transition-colors flex flex-col items-center gap-1"
                      >
                        <span className="text-3xl">🚀</span>
                        {processando === item.id ? "Processando..." : "Finalizei e Entreguei"}
                      </button>
                    )}
                    {/* Botão Ver OP */}
                    <button
                      onClick={() => {
                        const orcamentoId = item.ordens_producao?.orcamento_id;
                        if (orcamentoId) {
                          window.open(`/imprimir/${orcamentoId}?action=op`, "_blank");
                        }
                      }}
                      className="py-5 px-4 bg-gray-700 hover:bg-gray-600 rounded-xl text-xl font-black text-white transition-colors flex flex-col items-center gap-1"
                    >
                      <span className="text-3xl">📄</span>
                      Ver OP
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertModal {...alertProps} />
    </div>
  );
}