"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

const NOME_DO_BUCKET = "arquivos";

interface Produto {
  id: string;
  codigo_item: string;
  descricao: string;
  medidas: string;
  valor_unitario: number;
  imagem_url: string;
}

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [produtoEditandoId, setProdutoEditandoId] = useState<string | null>(null);

  const [codigoItem, setCodigoItem] = useState("");
  const [descricao, setDescricao] = useState("");
  const [medidas, setMedidas] = useState("");
  const [valorUnitario, setValorUnitario] = useState("");
  const [imagemUrl, setImagemUrl] = useState(""); 
  const [message, setMessage] = useState("");

  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removerFotoAntiga, setRemoverFotoAntiga] = useState(false); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);

  // 🚀 NOVO ESTADO: Termo de Busca
  const [termoBusca, setTermoBusca] = useState("");

  useEffect(() => {
    carregarProdutos();
  }, []);

  const carregarProdutos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setProdutos(data);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    } finally {
      setLoading(false);
    }
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
    setValorUnitario("");
    setImagemUrl("");
    setArquivoSelecionado(null);
    setPreviewUrl(null);
    setRemoverFotoAntiga(false);
    if (fileInputRef.current) fileInputRef.current.value = ""; 
  };

  const extrairCaminhoStorage = (url: string) => {
    if (!url) return null;
    const partes = url.split(`/${NOME_DO_BUCKET}/`);
    return partes.length > 1 ? partes[1] : null;
  };

  const salvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada. Faça login novamente.");

      let urlFinalDaImagem = imagemUrl; 
      const caminhoAntigoParaDeletar = extrairCaminhoStorage(imagemUrl);

      if (arquivoSelecionado) {
        setMessage("⬆️ Fazendo upload da imagem...");
        
        const extensao = arquivoSelecionado.name.split('.').pop();
        const nomeArquivoUnico = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${extensao}`;

        const { error: uploadError } = await supabase.storage
          .from(NOME_DO_BUCKET)
          .upload(nomeArquivoUnico, arquivoSelecionado, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from(NOME_DO_BUCKET)
          .getPublicUrl(nomeArquivoUnico);
        
        urlFinalDaImagem = publicUrl; 

        if (caminhoAntigoParaDeletar) {
          await supabase.storage.from(NOME_DO_BUCKET).remove([caminhoAntigoParaDeletar]);
        }
      } 
      else if (removerFotoAntiga) {
        urlFinalDaImagem = "";
        if (caminhoAntigoParaDeletar) {
          await supabase.storage.from(NOME_DO_BUCKET).remove([caminhoAntigoParaDeletar]);
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
        setMessage("💾 Atualizando produto...");
        const { error } = await supabase
          .from("produtos")
          .update(dadosParaSalvar)
          .eq("id", produtoEditandoId);

        if (error) throw error;
        setMessage("✅ Produto atualizado com sucesso!");
      } else {
        setMessage("💾 Salvando novo produto...");
        const { error } = await supabase
          .from("produtos")
          .insert([dadosParaSalvar]);

        if (error) throw error;
        setMessage("✅ Produto cadastrado com sucesso!");
      }
      
      limparFormulario();
      carregarProdutos();
    } catch (error) {
      console.error(error);
      setMessage("❌ Erro ao salvar: " + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const iniciarEdicao = (produto: Produto) => {
    setProdutoEditandoId(produto.id);
    setCodigoItem(produto.codigo_item || "");
    setDescricao(produto.descricao || "");
    setMedidas(produto.medidas || "");
    setValorUnitario(produto.valor_unitario ? produto.valor_unitario.toString() : "");
    setImagemUrl(produto.imagem_url || "");
    setPreviewUrl(produto.imagem_url || null); 
    setArquivoSelecionado(null); 
    setRemoverFotoAntiga(false);
    setMessage("");
    setMenuAbertoId(null); 
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deletarProduto = async (produtoParaDeletar: Produto) => {
    if (!window.confirm("Tem certeza que deseja excluir este item e sua imagem associada?")) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      const { error } = await supabase
        .from("produtos")
        .delete()
        .eq("id", produtoParaDeletar.id);

      if (error) throw error;

      const caminhoParaDeletar = extrairCaminhoStorage(produtoParaDeletar.imagem_url);
      if (caminhoParaDeletar) {
        await supabase.storage.from(NOME_DO_BUCKET).remove([caminhoParaDeletar]);
      }

      setProdutos(produtos.filter(produto => produto.id !== produtoParaDeletar.id));
      if (produtoEditandoId === produtoParaDeletar.id) limparFormulario();
      setMenuAbertoId(null); 
    } catch (error) {
      alert("Erro ao excluir produto: " + (error as Error).message);
    }
  };

  const toggleMenu = (id: string) => {
    if (menuAbertoId === id) setMenuAbertoId(null);
    else setMenuAbertoId(id);
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  // 🚀 LÓGICA DE FILTRAGEM INTELIGENTE (Descrição ou Código)
  const produtosFiltrados = produtos.filter((produto) => {
    const busca = termoBusca.toLowerCase();
    return (
      produto.descricao?.toLowerCase().includes(busca) ||
      produto.codigo_item?.toLowerCase().includes(busca)
    );
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto" onClick={() => menuAbertoId && setMenuAbertoId(null)}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Meus Produtos</h1>
      
      {/* Formulário */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {produtoEditandoId ? "✏️ Editando Produto" : "Novo Produto"}
          </h2>
          {produtoEditandoId && (
            <button onClick={limparFormulario} className="text-sm font-medium text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-md transition-colors">
              Cancelar edição
            </button>
          )}
        </div>

        <form onSubmit={salvarProduto} className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col items-center justify-start p-4 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 text-center">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Preview" className="w-32 h-32 object-cover rounded-xl border border-gray-200 mb-4 shadow-sm" />
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
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={produto.imagem_url} alt="Produto" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 text-gray-400 text-xs text-center">Sem Foto</div>
                    )}
                  </div>
                  <div className="flex-1 relative">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-gray-900 leading-tight mb-1 pr-6">{produto.descricao}</h3>
                      
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
                    <th className="p-4 text-sm font-semibold text-gray-600 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {produtosFiltrados.map((produto) => (
                    <tr key={produto.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 flex justify-center">
                        {produto.imagem_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={produto.imagem_url} alt="Produto" className="w-12 h-12 object-cover rounded-md border border-gray-200" />
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
    </div>
  );
}