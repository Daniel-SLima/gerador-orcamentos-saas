"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { usePerfilUsuario } from "../../../hooks/usePerfilUsuario";
import { useAlert, useConfirm, AlertModal, ConfirmModal } from "../../../components/AlertModal";
import { STATUS_ITEM_OP, getCorStatus } from "../../../lib/statusProducao";

interface RegistroChecklist {
  id: string;
  setor: string;
  acao: string;
  created_at: string;
  usuario_id: string;
}

interface MaterialOP {
  id: string;
  op_id: string;
  item_op_id: string | null;
  descricao: string;
  quantidade_necessaria: number;
  unidade: string | null;
  tem_no_galpao: boolean;
  quantidade_galpao: number;
  precisa_comprar: boolean;
  quantidade_comprar: number;
  status: "solicitado" | "comprado" | "entregue" | "cancelado";
  previsao_entrega: string | null;
  destino_entrega: string | null;
  observacoes: string | null;
  created_at: string;
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

interface Subitem {
  id: string;
  item_op_id: string;
  nome: string;
  concluido: boolean;
  concluido_por: string | null;
  concluido_em: string | null;
  created_at: string;
  status?: string;
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
  const { showConfirm, confirmProps } = useConfirm();
  const [op, setOp] = useState<OpCompleta | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemExpandido, setItemExpandido] = useState<string | null>(null);
  const [editandoObs, setEditandoObs] = useState(false);
  const [obsTexto, setObsTexto] = useState("");
  const [salvandoObs, setSalvandoObs] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  // 🚀 ESTADOS PARA SUBITENS (somente leitura para admin)
  const [modalSubitensAberto, setModalSubitensAberto] = useState(false);
  const [itemOpSelecionado, setItemOpSelecionado] = useState<ItemOP | null>(null);
  const [subitens, setSubitens] = useState<Subitem[]>([]);
  const [carregandoSubitens, setCarregandoSubitens] = useState(false);

  // 🚀 ESTADOS PARA MATERIAIS
  const [abaAtiva, setAbaAtiva] = useState<"itens" | "materiais">("itens");
  const [materiais, setMateriais] = useState<MaterialOP[]>([]);
  const [loadingMateriais, setLoadingMateriais] = useState(false);
  const [modalMaterialAberto, setModalMaterialAberto] = useState(false);

  // Estados do formulário de material
  const [matDescricao, setMatDescricao] = useState("");
  const [matQuantNecessaria, setMatQuantNecessaria] = useState<number>(1);
  const [matUnidade, setMatUnidade] = useState("");
  const [matTemGalpao, setMatTemGalpao] = useState(false);
  const [matQuantGalpao, setMatQuantGalpao] = useState<number>(0);
  const [matPrecisaComprar, setMatPrecisaComprar] = useState(true);
  const [matQuantComprar, setMatQuantComprar] = useState<number>(1);
  const [matObservacoes, setMatObservacoes] = useState("");
  const [matItemOpId, setMatItemOpId] = useState<string | null>(null);
  const [salvandoMaterial, setSalvandoMaterial] = useState(false);

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

  const cancelarOP = async () => {
    const confirmado = await showConfirm(
      `Tem certeza que deseja CANCELAR a OP #${String(op?.numero_op).padStart(4, "0")}? Esta ação irá remover a Ordem de Produção e todos os itens em andamento. Os operadores pararão de vê-la imediatamente. Esta ação não pode ser desfeita.`,
      { type: "error", title: "Cancelar Ordem de Produção", confirmLabel: "Sim, cancelar OP", cancelLabel: "Voltar" }
    );
    if (!confirmado) return;

    setCancelando(true);
    try {
      // 1. Remove registros de checklist associados aos itens da OP
      const itemIds = op?.itens_op.map(i => i.id) || [];
      if (itemIds.length > 0) {
        await supabase.from("registros_checklist").delete().in("item_op_id", itemIds);
      }

      // 2. Remove os itens da OP
      const { error: erroItens } = await supabase
        .from("itens_op")
        .delete()
        .eq("op_id", id);
      if (erroItens) throw erroItens;

      // 3. Remove a própria OP
      const { error: erroOp } = await supabase
        .from("ordens_producao")
        .delete()
        .eq("id", id);
      if (erroOp) throw erroOp;

      router.push("/dashboard/producao");
    } catch (err) {
      showAlert("Erro ao cancelar OP: " + (err as Error).message, { type: "error", title: "Erro" });
      setCancelando(false);
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

  // 🚀 FUNÇÕES PARA SUBITENS
  const abrirModalSubitens = async (item: ItemOP) => {
    setItemOpSelecionado(item);
    setModalSubitensAberto(true);
    setCarregandoSubitens(true);
    try {
      const { data } = await supabase
        .from("subitens_op")
        .select("*")
        .eq("item_op_id", item.id)
        .order("created_at");
      setSubitens(data || []);
    } catch (err) {
      console.error("Erro ao carregar subitens:", err);
    } finally {
      setCarregandoSubitens(false);
    }
  };

  const toggleSubitem = async (subitem: Subitem) => {
    const novoConcluido = !subitem.concluido;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("subitens_op").update({
      concluido: novoConcluido,
      concluido_por: novoConcluido ? user?.id : null,
      concluido_em: novoConcluido ? new Date().toISOString() : null,
    }).eq("id", subitem.id);

    const atualizados = subitens.map(s => s.id === subitem.id ? { ...s, concluido: novoConcluido } : s);
    setSubitens(atualizados);

    // Se todos foram concluídos, marca o item pai como concluido
    if (itemOpSelecionado && atualizados.every((s: Subitem) => s.concluido) && atualizados.length === itemOpSelecionado.quantidade) {
      await supabase.from("itens_op").update({ status_item: "concluido" }).eq("id", itemOpSelecionado.id);
      setOp(prev => prev ? {
        ...prev,
        itens_op: prev.itens_op.map(i => i.id === itemOpSelecionado.id ? { ...i, status_item: "concluido" } : i)
      } : null);
    }
  };

  // 🚀 FUNÇÕES PARA MATERIAIS
  const carregarMateriais = async () => {
    if (!id) return;
    setLoadingMateriais(true);
    const { data, error } = await supabase
      .from("materiais_op")
      .select("*")
      .eq("op_id", id)
      .order("created_at", { ascending: false });
    
    if (!error && data) setMateriais(data as MaterialOP[]);
    setLoadingMateriais(false);
  };

  const salvarMaterial = async () => {
    if (!matDescricao.trim()) {
      showAlert("Informe a descrição do material.", { type: "error", title: "Erro" });
      return;
    }
    setSalvandoMaterial(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from("materiais_op").insert([{
      op_id: id,
      item_op_id: matItemOpId || null,
      descricao: matDescricao.trim(),
      quantidade_necessaria: matQuantNecessaria,
      unidade: matUnidade || null,
      tem_no_galpao: matTemGalpao,
      quantidade_galpao: matTemGalpao ? matQuantGalpao : 0,
      precisa_comprar: matPrecisaComprar,
      quantidade_comprar: matPrecisaComprar ? matQuantComprar : 0,
      status: "solicitado",
      solicitado_por: user?.id || null,
      observacoes: matObservacoes || null,
    }]);
    
    if (error) {
      showAlert("Erro ao salvar material: " + error.message, { type: "error", title: "Erro" });
    } else {
      showAlert("Material lançado com sucesso!", { type: "success", title: "OK" });
      setModalMaterialAberto(false);
      limparFormMaterial();
      carregarMateriais();
    }
    setSalvandoMaterial(false);
  };

  const limparFormMaterial = () => {
    setMatDescricao(""); setMatQuantNecessaria(1); setMatUnidade("");
    setMatTemGalpao(false); setMatQuantGalpao(0);
    setMatPrecisaComprar(true); setMatQuantComprar(1);
    setMatObservacoes(""); setMatItemOpId(null);
  };

  const confirmarRecebimentoMaterial = async (materialId: string) => {
    const { error } = await supabase
      .from("materiais_op")
      .update({ status: "entregue" })
      .eq("id", materialId);
    
    if (error) showAlert("Erro: " + error.message, { type: "error", title: "Erro" });
    else { showAlert("Material marcado como recebido!", { type: "success", title: "OK" }); carregarMateriais(); }
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
        {/* Botão Cancelar OP — apenas para admin e se OP não concluída */}
        {op.status !== "concluida" && (
          <button
            onClick={cancelarOP}
            disabled={cancelando}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 font-bold text-sm rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {cancelando ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            )}
            {cancelando ? "Cancelando..." : "Cancelar OP"}
          </button>
        )}
      </div>

      {/* OP Sem Itens */}
      {op.itens_op.length === 0 && (
        <div className="p-8 text-center bg-amber-50 rounded-xl border border-amber-100 mb-6">
          <p className="text-amber-700 font-bold">⚠️ Esta OP não possui itens vinculados.</p>
          <p className="text-amber-600 text-sm mt-1">
            Verifique se os itens do orçamento #
            {op.orcamentos?.numero_orcamento} foram sincronizados corretamente.
          </p>
        </div>
      )}

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

      {/* Abas */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setAbaAtiva("itens")}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            abaAtiva === "itens"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📋 Itens da OP
        </button>
        <button
          onClick={() => { setAbaAtiva("materiais"); carregarMateriais(); }}
          className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
            abaAtiva === "materiais"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          🧱 Materiais
          {materiais.filter(m => m.status === "solicitado").length > 0 && (
            <span className="bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {materiais.filter(m => m.status === "solicitado").length}
            </span>
          )}
        </button>
      </div>

      {/* Conteúdo das abas */}
      {abaAtiva === "materiais" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">Requisição de Materiais</h3>
            <button
              onClick={() => setModalMaterialAberto(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Lançar Material
            </button>
          </div>
          
          {loadingMateriais ? (
            <div className="text-center py-8 text-gray-400">Carregando...</div>
          ) : materiais.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              Nenhum material lançado para esta OP.
            </div>
          ) : (
            <div className="space-y-3">
              {materiais.map(mat => (
                <div key={mat.id} className={`p-4 rounded-xl border ${
                  mat.status === "solicitado" ? "border-amber-200 bg-amber-50" :
                  mat.status === "comprado" ? "border-blue-200 bg-blue-50" :
                  mat.status === "entregue" ? "border-green-200 bg-green-50" :
                  "border-gray-200 bg-gray-50"
                }`}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{mat.descricao}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Qtd: {mat.quantidade_necessaria} {mat.unidade || "un"}
                        {mat.tem_no_galpao && ` · No galpão: ${mat.quantidade_galpao}`}
                        {mat.precisa_comprar && ` · Comprar: ${mat.quantidade_comprar}`}
                      </p>
                      {mat.observacoes && (
                        <p className="text-xs text-gray-500 mt-1">{mat.observacoes}</p>
                      )}
                      {mat.previsao_entrega && (
                        <p className="text-xs text-blue-700 mt-1">📅 Previsão: {new Date(mat.previsao_entrega).toLocaleDateString("pt-BR")}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        mat.status === "solicitado" ? "bg-amber-200 text-amber-800" :
                        mat.status === "comprado" ? "bg-blue-200 text-blue-800" :
                        mat.status === "entregue" ? "bg-green-200 text-green-800" :
                        "bg-gray-200 text-gray-700"
                      }`}>
                        {mat.status === "solicitado" ? "Solicitado" :
                         mat.status === "comprado" ? "Comprado" :
                         mat.status === "entregue" ? "Entregue" : "Cancelado"}
                      </span>
                      {mat.status === "comprado" && (
                        <button
                          onClick={() => confirmarRecebimentoMaterial(mat.id)}
                          className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          ✓ Confirmar Recebimento
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {abaAtiva === "itens" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Itens da OP ({totalItens})</h2>
          </div>

          <div className="divide-y divide-gray-50">
          {op.itens_op?.map((item, itemIndex) => {
            const expandido = itemExpandido === item.id;
            // Letra do item: 0 → A, 1 → B, etc.
            const letraItem = String.fromCharCode(65 + itemIndex);
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
                    {/* Letra do item */}
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-blue-700">{letraItem}</span>
                    </div>

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
                      <button
                          onClick={(e) => { e.stopPropagation(); abrirModalSubitens(item); }}
                          className="mt-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          📋 Ver subitens
                        </button>
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
      )}

      {/* 🚀 MODAL DE LANÇAMENTO DE MATERIAL */}
      {modalMaterialAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Lançar Material</h3>
              <button onClick={() => { setModalMaterialAberto(false); limparFormMaterial(); }}
                className="text-gray-400 hover:text-red-500 p-1 rounded">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Vincular a item específico (opcional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vincular ao item (opcional)</label>
                <select value={matItemOpId || ""} onChange={e => setMatItemOpId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white">
                  <option value="">OP Geral</option>
                  {op.itens_op.map(item => (
                    <option key={item.id} value={item.id}>{item.descricao}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Material *</label>
                <input value={matDescricao} onChange={e => setMatDescricao(e.target.value)}
                  placeholder="Ex: Chapa de aço 2mm" required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                  <input type="number" min={0.1} step={0.1} value={matQuantNecessaria}
                    onChange={e => setMatQuantNecessaria(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                  <input value={matUnidade} onChange={e => setMatUnidade(e.target.value)}
                    placeholder="un, kg, m²..." 
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
                </div>
              </div>
              
              {/* Galpão vs Comprar */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={matTemGalpao} onChange={e => setMatTemGalpao(e.target.checked)} className="accent-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Tem no galpão?</span>
                </label>
                {matTemGalpao && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Quantidade no galpão</label>
                    <input type="number" min={0} step={0.1} value={matQuantGalpao} onChange={e => setMatQuantGalpao(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm outline-none" />
                  </div>
                )}
                <div className="border-t border-gray-200 pt-3"></div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={matPrecisaComprar} onChange={e => setMatPrecisaComprar(e.target.checked)} className="accent-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Precisa comprar?</span>
                </label>
                {matPrecisaComprar && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Quantidade a comprar</label>
                    <input type="number" min={0} step={0.1} value={matQuantComprar} onChange={e => setMatQuantComprar(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm outline-none" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea value={matObservacoes} onChange={e => setMatObservacoes(e.target.value)}
                  rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none resize-none"
                  placeholder="Fornecedor sugerido, urgência..." />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button onClick={() => { setModalMaterialAberto(false); limparFormMaterial(); }}
                className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Cancelar
              </button>
              <button onClick={salvarMaterial} disabled={salvandoMaterial}
                className="flex-1 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors">
                {salvandoMaterial ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 MODAL DE SUBITENS — Somente leitura para Admin */}
      {modalSubitensAberto && itemOpSelecionado && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900 truncate max-w-[300px]">
                  {itemOpSelecionado.descricao}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {subitens.filter(s => s.concluido).length}/{subitens.length} subitens concluídos
                </p>
                {/* Barra de progresso dos subitens */}
                {subitens.length > 0 && (
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                    <div
                      className="h-1.5 rounded-full bg-green-500 transition-all"
                      style={{
                        width: `${Math.round((subitens.filter(s => s.concluido).length / subitens.length) * 100)}%`
                      }}
                    />
                  </div>
                )}
              </div>
              <button
                onClick={() => setModalSubitensAberto(false)}
                className="text-gray-400 hover:text-red-500 text-2xl ml-4 shrink-0"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-2 max-h-72 overflow-y-auto">
              {carregandoSubitens ? (
                <p className="text-center text-gray-500 py-4">Carregando...</p>
              ) : subitens.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-400 text-sm">
                    Nenhum subitem cadastrado para este produto.
                  </p>
                  <p className="text-gray-300 text-xs mt-1">
                    Adicione subitens no cadastro do produto para que apareçam aqui.
                  </p>
                </div>
              ) : (
                subitens.map(s => (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      s.concluido
                        ? "bg-green-50 border-green-200"
                        : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    {/* Ícone de status — somente leitura */}
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 ${
                      s.concluido ? "bg-green-500 border-green-500" : "bg-white border-gray-300"
                    }`}>
                      {s.concluido && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${s.concluido ? "line-through text-gray-400" : "text-gray-800 font-medium"}`}>
                          {s.nome}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${getCorStatus(s.status || "pendente")}`}>
                          {STATUS_ITEM_OP.find(st => st.value === (s.status || "pendente"))?.label || "Pendente"}
                        </span>
                      </div>
                      {s.concluido && s.concluido_em && (
                        <p className="text-xs text-green-600 mt-0.5">
                          ✅ {new Date(s.concluido_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <p className="text-xs text-gray-400 text-center">
                Os checks são feitos pelos operadores na tela de Setor.
              </p>
            </div>
          </div>
        </div>
      )}

      <AlertModal {...alertProps} />
      <ConfirmModal {...confirmProps} />
    </div>
  );
}
