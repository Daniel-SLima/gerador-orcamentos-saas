"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import Image from "next/image";
import { comprimirImagem } from "../../lib/comprimirImagem";
import { uploadParaCloudinary, deletarDoCloudinary } from "../../lib/uploadCloudinary";
import { AlertModal, ConfirmModal, useAlert, useConfirm } from "../../components/AlertModal";
import { useToast } from "../../components/Toast";

// Bucket legado — ainda usado para deletar imagens antigas do Supabase
const BUCKET_LEGADO = "arquivos";

// Detecta se uma URL de imagem é do Supabase Storage (imagem antiga/legada)
const eImagemDoSupabase = (url: string) => !!url && url.includes("supabase.co");

// Extrai o caminho relativo dentro do bucket para poder deletar do Supabase
const extrairCaminhoStorage = (url: string) => {
  if (!url) return null;
  const partes = url.split(`/${BUCKET_LEGADO}/`);
  return partes.length > 1 ? partes[1] : null;
};

interface Produto {
  id: string;
  codigo_item: string;
  descricao: string;
  medidas: string;
  valor_unitario: number;
  imagem_url: string;
  ultimo_uso: string | null; // ISO timestamp — null = nunca foi usado
}

interface OrcamentoVinculado {
  id: string;
  data_emissao: string;
  status: string;
  cliente_nome: string;
}

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [produtoEditandoId, setProdutoEditandoId] = useState<string | null>(null);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const { showAlert, alertProps } = useAlert();
  const { showConfirm, confirmProps } = useConfirm();
  const { showToast } = useToast();

  // Paginação e Busca Remota
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(true);
  const [buscandoMais, setBuscandoMais] = useState(false);
  const ITENS_POR_PAGINA = 20;

  // Modal de vínculos com orçamentos
  const [modalVinculos, setModalVinculos] = useState<{
    aberto: boolean;
    produto: Produto | null;
    orcamentos: OrcamentoVinculado[];
    confirmando: boolean;
  }>({ aberto: false, produto: null, orcamentos: [], confirmando: false });

  const [excluindoTodos, setExcluindoTodos] = useState(false);

  const [codigoItem, setCodigoItem] = useState("");
  const [descricao, setDescricao] = useState("");
  const [medidas, setMedidas] = useState("");
  const [valorUnitario, setValorUnitario] = useState("0");
  const [imagemUrl, setImagemUrl] = useState("");
  const [message, setMessage] = useState("");
  
  // Estado para armazenar a mensagem (será exibida via Toast em seguida):
  const exibirMensagem = (msg: string) => {
    setMessage(msg); // compat. legado
    if (msg.includes("Erro") || msg.includes("erro")) {
      showToast(msg.replace("\u274c ", "").replace("\u26a0️ ", ""), "error");
    } else if (msg) {
      showToast(msg.replace("\u2705 ", "").replace("\u2b06️ ", ""), "success");
    }
  };

  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removerFotoAntiga, setRemoverFotoAntiga] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);

  // 🚀 NOVO ESTADO: Termo de Busca
  const [termoBusca, setTermoBusca] = useState("");

  // 🕐 CONFIGURAÇÃO DE PRAZO DE INATIVIDADE (a ser definido pelo cliente)
  // null = sem limite ativo. Trocar para ex: 180 quando o cliente definir.
  const PRAZO_ALERTA_DIAS: number | null = null;

  /** Calcula quantos dias se passaram desde o ultimo_uso (ou desde sempre se null) */
  const diasDeInatividade = (ultimoUso: string | null): number | null => {
    if (!ultimoUso) return null; // nunca usado — tratado separadamente
    const diff = Date.now() - new Date(ultimoUso).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  /** Retorna o label compacto de "Último uso" */
  const labelUltimoUso = (ultimoUso: string | null): string => {
    if (!ultimoUso) return "Nunca";
    const dias = diasDeInatividade(ultimoUso)!;
    if (dias === 0) return "Hoje";
    if (dias === 1) return "1 dia";
    if (dias < 30) return `${dias} dias`;
    const meses = Math.floor(dias / 30);
    if (meses === 1) return "1 mês";
    if (meses < 12) return `${meses} meses`;
    const anos = Math.floor(dias / 365);
    return anos === 1 ? "1 ano" : `${anos} anos`;
  };

  /** Retorna classes de cor baseado na inatividade */
  const corInatividade = (ultimoUso: string | null): { badge: string; text: string } => {
    if (!ultimoUso) return { badge: "bg-gray-100 text-gray-500", text: "text-gray-400" };
    const dias = diasDeInatividade(ultimoUso)!;
    if (dias <= 30) return { badge: "bg-green-100 text-green-700", text: "text-green-600" };
    if (dias <= 90) return { badge: "bg-blue-100 text-blue-700", text: "text-blue-600" };
    if (dias <= 180) return { badge: "bg-amber-100 text-amber-700", text: "text-amber-600" };
    return { badge: "bg-red-100 text-red-700", text: "text-red-600" };
  };

  /** Verifica se produto deve ser alertado como inativo */
  const estaInativo = (produto: Produto): boolean => {
    if (!PRAZO_ALERTA_DIAS) return false;
    if (!produto.ultimo_uso) return true; // nunca usado: sempre inativo se houver prazo
    return (diasDeInatividade(produto.ultimo_uso) ?? 0) >= PRAZO_ALERTA_DIAS;
  };

  const produtosInativos = PRAZO_ALERTA_DIAS ? produtos.filter(estaInativo) : [];

  // Debounce: busca no Supabase ao invés de filtrar na memória
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagina(0);
      carregarProdutos(0, termoBusca);
    }, 500);
    return () => clearTimeout(timer);
  }, [termoBusca]);

  const carregarProdutos = async (page = pagina, busca = termoBusca) => {
    if (page === 0) setLoading(true);
    else setBuscandoMais(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase.from("produtos").select("*", { count: 'exact' });

      if (busca.trim()) {
        const t = busca.trim();
        query = query.or(`descricao.ilike.%${t}%,codigo_item.ilike.%${t}%`);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(page * ITENS_POR_PAGINA, (page + 1) * ITENS_POR_PAGINA - 1);

      if (error) throw error;
      if (data) {
        if (page === 0) setProdutos(data);
        else setProdutos(prev => [...prev, ...data]);
        if (count !== null) setTemMais((page + 1) * ITENS_POR_PAGINA < count);
        else setTemMais(data.length === ITENS_POR_PAGINA);
      }
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    } finally {
      setLoading(false);
      setBuscandoMais(false);
    }
  };

  const carregarMais = () => {
    const novaPagina = pagina + 1;
    setPagina(novaPagina);
    carregarProdutos(novaPagina, termoBusca);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setArquivoSelecionado(file);
      setPreviewUrl(URL.createObjectURL(file));
      setRemoverFotoAntiga(false);
    }
  };

  const limparImagem = () => {
    setArquivoSelecionado(null);
    setPreviewUrl(null);
    setRemoverFotoAntiga(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const limparFormulario = () => {
    setProdutoEditandoId(null);
    setCodigoItem("");
    setDescricao("");
    setMedidas("");
    setValorUnitario("0");
    setImagemUrl("");
    setArquivoSelecionado(null);
    setPreviewUrl(null);
    setRemoverFotoAntiga(false);
    setFormularioAberto(false);
    setMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const salvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada. Faça login novamente.");

      let urlFinalDaImagem = imagemUrl;

      if (arquivoSelecionado) {
        setMessage("⬆️ Comprimindo e fazendo upload da imagem...");
        const arquivoComprimido = await comprimirImagem(arquivoSelecionado);
        // 🚀 Sempre envia a nova imagem para o Cloudinary
        urlFinalDaImagem = await uploadParaCloudinary(arquivoComprimido);

        // Se a imagem ANTERIOR era do Supabase (legado), apaga ela de lá
        if (eImagemDoSupabase(imagemUrl)) {
          const caminhoAntigo = extrairCaminhoStorage(imagemUrl);
          if (caminhoAntigo) {
            await supabase.storage.from(BUCKET_LEGADO).remove([caminhoAntigo]);
          }
        } else {
          // Se era do Cloudinary, deleta via rota segura do servidor
          await deletarDoCloudinary(imagemUrl);
        }
      } else if (removerFotoAntiga) {
        urlFinalDaImagem = "";
        // Se a imagem era do Supabase (legado), apaga ela de lá
        if (eImagemDoSupabase(imagemUrl)) {
          const caminhoAntigo = extrairCaminhoStorage(imagemUrl);
          if (caminhoAntigo) {
            await supabase.storage.from(BUCKET_LEGADO).remove([caminhoAntigo]);
          }
        } else {
          // Se era do Cloudinary, deleta via rota segura do servidor
          await deletarDoCloudinary(imagemUrl);
        }
      }

      const dadosParaSalvar = {
        codigo_item: codigoItem,
        descricao: descricao,
        medidas: medidas,
        valor_unitario: parseFloat(valorUnitario.toString().replace(',', '.')),
        imagem_url: urlFinalDaImagem,
        user_id: user.id
      };

      if (produtoEditandoId) {
        const { error } = await supabase
          .from("produtos")
          .update(dadosParaSalvar)
          .eq("id", produtoEditandoId);
        if (error) throw error;
        showToast("Produto atualizado com sucesso!", "success");
      } else {
        const { error } = await supabase
          .from("produtos")
          .insert([dadosParaSalvar]);
        if (error) throw error;
        showToast("Produto cadastrado com sucesso!", "success");
      }

      limparFormulario();
      setPagina(0);
      carregarProdutos(0, termoBusca);
    } catch (error) {
      console.error(error);
      showToast("Erro ao salvar: " + (error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const iniciarEdicao = (produto: Produto) => {
    setProdutoEditandoId(produto.id);
    setCodigoItem(produto.codigo_item || "");
    setDescricao(produto.descricao || "");
    setMedidas(produto.medidas || "");
    setValorUnitario(produto.valor_unitario !== undefined && produto.valor_unitario !== null ? produto.valor_unitario.toString() : "0");
    setImagemUrl(produto.imagem_url || "");
    setPreviewUrl(produto.imagem_url || null);
    setArquivoSelecionado(null);
    setRemoverFotoAntiga(false);
    setMessage("");
    setMenuAbertoId(null);
    setFormularioAberto(true); // abre o formulário ao editar
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deletarProduto = async (produtoParaDeletar: Produto) => {
    // 1️⃣ Busca orçamentos vinculados a este produto
    const { data: vinculos } = await supabase
      .from("itens_orcamento")
      .select(`orcamento_id, orcamentos!inner(id, data_emissao, status, cliente_id, clientes(nome_razao_social))`)
      .eq("produto_id", produtoParaDeletar.id);

    const orcamentosVinculados: OrcamentoVinculado[] = [];
    if (vinculos && vinculos.length > 0) {
      // Deduplicar por orcamento_id
      const vistos = new Set<string>();
      for (const v of vinculos) {
        const orc = v.orcamentos as unknown as { id: string; data_emissao: string; status: string; clientes: { nome_razao_social: string } | null };
        if (orc && !vistos.has(orc.id)) {
          vistos.add(orc.id);
          orcamentosVinculados.push({
            id: orc.id,
            data_emissao: orc.data_emissao,
            status: orc.status,
            cliente_nome: orc.clientes?.nome_razao_social || "Cliente não encontrado",
          });
        }
      }
    }

    if (orcamentosVinculados.length > 0) {
      // Mostra modal específico com lista de orçamentos
      setModalVinculos({ aberto: true, produto: produtoParaDeletar, orcamentos: orcamentosVinculados, confirmando: false });
      return;
    }

    // Sem vínculos: confirmação simples
    const confirmado = await showConfirm("Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.", {
      type: "error",
      title: "Excluir Produto",
      confirmLabel: "Sim, excluir",
      cancelLabel: "Cancelar",
    });
    if (!confirmado) return;
    await executarDelecaoProduto(produtoParaDeletar);
  };

  const executarDelecaoProduto = async (produtoParaDeletar: Produto) => {
    try {
      const { error } = await supabase
        .from("produtos")
        .delete()
        .eq("id", produtoParaDeletar.id);

      if (error) throw error;

      if (eImagemDoSupabase(produtoParaDeletar.imagem_url)) {
        const caminhoParaDeletar = extrairCaminhoStorage(produtoParaDeletar.imagem_url);
        if (caminhoParaDeletar) {
          await supabase.storage.from(BUCKET_LEGADO).remove([caminhoParaDeletar]);
        }
      } else {
        await deletarDoCloudinary(produtoParaDeletar.imagem_url);
      }

      setProdutos(produtos.filter(produto => produto.id !== produtoParaDeletar.id));
      if (produtoEditandoId === produtoParaDeletar.id) limparFormulario();
      setMenuAbertoId(null);
    } catch (error) {
      showAlert("Erro ao excluir produto: " + (error as Error).message, { type: "error", title: "Erro" });
    }
  };

  const excluirTodosInativos = async () => {
    const confirmado = await showConfirm(
      `Tem certeza que deseja excluir todos os ${produtosInativos.length} produtos inativos? Esta ação não pode ser desfeita.`,
      { type: "error", title: "Excluir Todos os Inativos", confirmLabel: "Sim, excluir todos", cancelLabel: "Cancelar" }
    );
    if (!confirmado) return;
    setExcluindoTodos(true);
    for (const produto of produtosInativos) {
      await executarDelecaoProduto(produto);
    }
    setExcluindoTodos(false);
  };

  const toggleMenu = (id: string) => {
    if (menuAbertoId === id) setMenuAbertoId(null);
    else setMenuAbertoId(id);
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  // A busca agora é remota (Supabase) — sem filtro local
  const produtosFiltrados = produtos;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto" onClick={() => menuAbertoId && setMenuAbertoId(null)}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Meus Produtos</h1>

      {/* FORMULÁRIO RECOLHÍVEL */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
        {/* Cabeçalho clicável */}
        <button
          type="button"
          onClick={() => setFormularioAberto(!formularioAberto)}
          className="w-full flex justify-between items-center p-4 md:p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${produtoEditandoId ? 'bg-amber-100' : 'bg-blue-50'}`}>
              <svg className={`w-5 h-5 ${produtoEditandoId ? 'text-amber-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </div>
            <div className="text-left">
              <h2 className="text-base font-semibold text-gray-800 leading-tight">
                {produtoEditandoId ? "✏️ Editando Produto" : "Novo Produto"}
              </h2>
              {!formularioAberto && !produtoEditandoId && (
                <p className="text-xs text-gray-400 mt-0.5">Clique para expandir o formulário</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {produtoEditandoId && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); limparFormulario(); }}
                className="text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors"
              >
                Cancelar edição
              </span>
            )}
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${formularioAberto ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Conteúdo recolhível */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${formularioAberto ? 'max-h-[9999px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-4 md:p-6 pt-0 border-t border-gray-100">

        <form onSubmit={salvarProduto} className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col items-center justify-start p-4 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 text-center">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Preview" className="w-32 h-32 object-contain bg-white rounded-xl border border-gray-200 mb-4 shadow-sm" />
            ) : (
              <div className="w-32 h-32 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 mb-4">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              </div>
            )}

            <div className="flex flex-col gap-2 w-full">
              <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 font-medium text-sm px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm w-full text-center">
                {previewUrl ? "Trocar Foto" : "Escolher Foto"}
                <input type="file" ref={fileInputRef} accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleFileChange} className="hidden" />
              </label>

              {previewUrl && (
                <button type="button" onClick={limparImagem} className="text-sm text-red-500 hover:text-red-700 font-medium py-1.5 transition-colors">
                  Remover Foto
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-3">Máx: 2MB (JPG, PNG)</p>
          </div>

          <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição do Produto/Serviço *</label>
              <textarea required rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all shadow-sm resize-y" placeholder="Ex: Cadeira de Escritório Ergonômica" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Código do Item</label>
                <textarea rows={2} value={codigoItem} onChange={(e) => setCodigoItem(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all shadow-sm resize-y" placeholder="Ex: PROD-01" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Valor Unitário (R$) *</label>
                <input type="number" step="0.01" min="0" required value={valorUnitario} onChange={(e) => setValorUnitario(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all shadow-sm" placeholder="0.00" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Medidas / Especificações</label>
              <textarea rows={3} value={medidas} onChange={(e) => setMedidas(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all shadow-sm resize-y" placeholder="Ex: 50x50x100cm ou 'Pacote com 10 un'" />
            </div>

            <div className="pt-2 flex justify-end">
              <button type="submit" disabled={saving} className={`w-full sm:w-auto px-8 py-3 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 ${produtoEditandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {saving ? "Processando..." : (produtoEditandoId ? "Atualizar Produto" : "Adicionar Produto")}
              </button>
            </div>
          </div>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-lg text-sm border font-medium ${message.includes("Erro") ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
            {message}
          </div>
        )}
          </div>
        </div>
      </div>

      {/* 🚀 BARRA DE BUSCA RÁPIDA */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input
            type="text"
            placeholder="Buscar produto por descrição ou código..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 transition-all"
          />
        </div>
      </div>

      {/* Painel de limpeza automática — aparece quando PRAZO_ALERTA_DIAS estiver ativo */}
      {PRAZO_ALERTA_DIAS !== null && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">Limpeza Automática de Produtos</h3>
                <p className="text-xs text-gray-500">
                  Prazo: <strong>{PRAZO_ALERTA_DIAS} dias</strong> — {produtosInativos.length === 0 ? "Nenhum produto inativo" : `${produtosInativos.length} produto(s) inativos`}
                </p>
              </div>
            </div>
            {produtosInativos.length > 0 && (
              <button
                onClick={excluirTodosInativos}
                disabled={excluindoTodos}
                className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                {excluindoTodos ? "Excluindo..." : `Excluir Todos (${produtosInativos.length})`}
              </button>
            )}
          </div>

          {produtosInativos.length > 0 && (
            <div className="px-6 py-4 space-y-2 max-h-64 overflow-y-auto">
              {produtosInativos.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.descricao}</p>
                    <p className="text-xs text-red-500">Sem uso há {labelUltimoUso(p.ultimo_uso)}</p>
                  </div>
                  <button
                    onClick={() => deletarProduto(p)}
                    className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Excluir
                  </button>
                </div>
              ))}
            </div>
          )}

          {produtosInativos.length === 0 && (
            <div className="px-6 py-4 text-sm text-gray-500 flex items-center gap-2">
              <span className="text-green-500">✅</span> Nenhum produto passou do prazo de inatividade.
            </div>
          )}
        </div>
      )}

      {/* Listagem */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando produtos...</div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum produto encontrado.</div>
        ) : (
          <div className="pb-16 md:pb-0">

            <div className="block md:hidden divide-y divide-gray-100">
              {produtosFiltrados.map((produto) => (
                <div key={produto.id} className="p-4 flex gap-4 hover:bg-gray-50 transition-colors">
                  <div className="shrink-0">
                    {produto.imagem_url ? (
                      <Image src={produto.imagem_url} alt="Produto" width={64} height={64} unoptimized={eImagemDoSupabase(produto.imagem_url)} className="w-16 h-16 object-contain bg-white rounded-lg border border-gray-200" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 text-gray-400 text-xs text-center">Sem Foto</div>
                    )}
                  </div>
                  <div className="flex-1 relative min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-gray-900 leading-tight mb-1 pr-6 flex-1 min-w-0 break-all">{produto.descricao}</h3>

                      <button onClick={(e) => { e.stopPropagation(); toggleMenu(produto.id); }} className="p-1 -mr-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                      </button>

                      {menuAbertoId === produto.id && (
                        <div className="absolute right-0 top-6 w-36 bg-white border border-gray-100 rounded-xl shadow-xl z-50 flex flex-col py-1 animate-fade-in">
                          <button onClick={(e) => { e.stopPropagation(); iniciarEdicao(produto); }} className="px-4 py-2 text-sm text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Editar</button>
                          <div className="h-px bg-gray-100 my-1 mx-2"></div>
                          <button onClick={(e) => { e.stopPropagation(); deletarProduto(produto); }} className="px-4 py-2 text-sm text-left font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Excluir</button>
                        </div>
                      )}
                    </div>

                    <div className="text-sm text-gray-600 space-y-0.5 mt-1">
                      {produto.codigo_item && <p><span className="font-medium text-gray-500">Cód:</span> {produto.codigo_item}</p>}
                      {produto.medidas && <p><span className="font-medium text-gray-500">Medidas:</span> {produto.medidas}</p>}
                      <p className="font-bold text-green-600 pt-1 text-base">{formatarMoeda(produto.valor_unitario)}</p>
                      {/* Badge de último uso */}
                      <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${corInatividade(produto.ultimo_uso).badge}`}>
                        {labelUltimoUso(produto.ultimo_uso)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto pb-24">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-4 text-sm font-semibold text-gray-600 w-20 text-center">Foto</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Código</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Descrição</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Medidas</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Valor Unitário</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Último Uso</th>
                    <th className="p-4 text-sm font-semibold text-gray-600 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {produtosFiltrados.map((produto) => (
                    <tr key={produto.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 flex justify-center">
                        {produto.imagem_url ? (
                          <Image src={produto.imagem_url} alt="Produto" width={48} height={48} unoptimized={eImagemDoSupabase(produto.imagem_url)} className="w-12 h-12 object-contain bg-white rounded-md border border-gray-200" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded-md border border-gray-200 flex items-center justify-center text-gray-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-gray-600 font-medium">{produto.codigo_item || "-"}</td>
                      <td className="p-4 text-gray-900 font-medium">{produto.descricao}</td>
                      <td className="p-4 text-gray-600">{produto.medidas || "-"}</td>
                      <td className="p-4 text-green-600 font-bold">{formatarMoeda(produto.valor_unitario)}</td>
                      <td className="p-4">
                        <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full ${corInatividade(produto.ultimo_uso).badge}`}>
                          {labelUltimoUso(produto.ultimo_uso)}
                        </span>
                      </td>

                      <td className="p-4 text-center relative">
                        <button onClick={(e) => { e.stopPropagation(); toggleMenu(produto.id); }} className="p-2 mx-auto text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none flex justify-center"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg></button>
                        {menuAbertoId === produto.id && (
                          <div className="absolute right-8 top-10 w-36 bg-white border border-gray-100 rounded-xl shadow-xl z-50 flex flex-col py-1 animate-fade-in">
                            <button onClick={(e) => { e.stopPropagation(); iniciarEdicao(produto); }} className="px-4 py-2 text-sm text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Editar</button>
                            <div className="h-px bg-gray-100 my-1 mx-2"></div>
                            <button onClick={(e) => { e.stopPropagation(); deletarProduto(produto); }} className="px-4 py-2 text-sm text-left font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Excluir</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </div>
      {/* Modais customizados */}
      <AlertModal {...alertProps} />
      <ConfirmModal {...confirmProps} />

      {/* Modal de produto vinculado a orçamentos */}
      {modalVinculos.aberto && modalVinculos.produto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Produto vinculado a orçamentos</h3>
                <p className="text-xs text-gray-500 mt-0.5">Este produto está em {modalVinculos.orcamentos.length} orçamento(s)</p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 mb-1 break-words">
                O produto <strong className="text-gray-900 break-words">&ldquo;{modalVinculos.produto.descricao}&rdquo;</strong> está presente nos seguintes orçamentos:
              </p>
              <p className="text-xs text-gray-400 mb-4">Os dados já salvos nesses orçamentos <strong>não serão apagados</strong> — apenas o produto será removido do catálogo.</p>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {modalVinculos.orcamentos.map(orc => {
                  const statusColor: Record<string, string> = {
                    "Aberto": "bg-blue-100 text-blue-700",
                    "Aprovado": "bg-green-100 text-green-700",
                    "Reprovado": "bg-red-100 text-red-700",
                    "Rascunho": "bg-gray-100 text-gray-600",
                  };
                  const cor = statusColor[orc.status] || "bg-gray-100 text-gray-600";
                  const data = orc.data_emissao
                    ? new Date(orc.data_emissao + "T00:00:00").toLocaleDateString("pt-BR")
                    : "Sem data";
                  return (
                    <div key={orc.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-100">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{orc.cliente_nome}</p>
                        <p className="text-xs text-gray-400">{data}</p>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${cor}`}>{orc.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setModalVinculos({ aberto: false, produto: null, orcamentos: [], confirmando: false })}
                className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                disabled={modalVinculos.confirmando}
                onClick={async () => {
                  setModalVinculos(prev => ({ ...prev, confirmando: true }));
                  await executarDelecaoProduto(modalVinculos.produto!);
                  setModalVinculos({ aberto: false, produto: null, orcamentos: [], confirmando: false });
                }}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                {modalVinculos.confirmando ? "Excluindo..." : "Sim, excluir mesmo assim"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}