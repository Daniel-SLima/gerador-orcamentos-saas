"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "../../lib/supabase";
import { useSearchParams } from "next/navigation";

// --- TIPAGENS ---
interface Cliente { id: string; nome_razao_social: string; }
interface Vendedor { id: string; nome: string; }
interface Produto { id: string; descricao: string; valor_unitario: number; medidas: string; }

interface ItemCarrinho {
  produto_id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  medidas: string;
  desconto: number;
  subtotal: number;
}

interface ItemBanco {
  produto_id: string;
  descricao: string;
  quantidade: number;
  valor_unitario_aplicado: number;
  medidas: string;
  desconto: number;
  subtotal: number;
}

// 🚀 FUNÇÃO PARA PEGAR A DATA ATUAL DO BRASIL NO FORMATO YYYY-MM-DD
const obterDataAtualBrasil = () => {
  const data = new Date();
  const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  const dataFormatada = data.toLocaleDateString('pt-BR', options); // Retorna DD/MM/YYYY
  const [dia, mes, ano] = dataFormatada.split('/');
  return `${ano}-${mes}-${dia}`;
};

function FormularioOrcamento() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const cloneId = searchParams.get("clone");

  const [loadingDados, setLoadingDados] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  // 🚀 NOVO ESTADO: DATA DE EMISSÃO (Já começa com o dia de hoje no Brasil)
  const [dataEmissao, setDataEmissao] = useState(obterDataAtualBrasil());
  
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState<number>(1);
  const [valorUnitario, setValorUnitario] = useState<number>(0);
  const [medidas, setMedidas] = useState("");
  const [desconto, setDesconto] = useState<number>(0);

  const [itens, setItens] = useState<ItemCarrinho[]>([]);

  // ESTADOS DO MODAL DE EDIÇÃO
  const [modalAberto, setModalAberto] = useState(false);
  const [indexEditando, setIndexEditando] = useState<number | null>(null);
  const [itemEditando, setItemEditando] = useState<ItemCarrinho | null>(null);

  useEffect(() => {
    carregarListasEPreencher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarListasEPreencher = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [resClientes, resVendedores, resProdutos] = await Promise.all([
        supabase.from("clientes").select("id, nome_razao_social").eq("user_id", user.id).order("nome_razao_social"),
        supabase.from("vendedores").select("id, nome").eq("user_id", user.id).order("nome"),
        supabase.from("produtos").select("id, descricao, valor_unitario, medidas").eq("user_id", user.id).order("descricao")
      ]);

      if (resClientes.data) setClientes(resClientes.data);
      if (resVendedores.data) setVendedores(resVendedores.data);
      if (resProdutos.data) setProdutos(resProdutos.data as Produto[]);

      const targetId = editId || cloneId;
      if (targetId) {
        const { data: orcData } = await supabase.from("orcamentos").select("*").eq("id", targetId).single();
        const { data: itensData } = await supabase.from("itens_orcamento").select("*").eq("orcamento_id", targetId);

        if (orcData) {
          setClienteId(orcData.cliente_id || "");
          setVendedorId(orcData.vendedor_id || "");
          setObservacoes(orcData.observacoes || "");
          
          // 🚀 SE ESTIVER EDITANDO OU CLONANDO, PUXA A DATA DO BANCO
          if (orcData.data_emissao) {
            setDataEmissao(orcData.data_emissao.split('T')[0]);
          }
        }
        
        if (itensData) {
          const itensMontados: ItemCarrinho[] = itensData.map((i: ItemBanco) => ({
            produto_id: i.produto_id,
            descricao: i.descricao,
            quantidade: i.quantidade,
            valor_unitario: i.valor_unitario_aplicado,
            medidas: i.medidas || "",
            desconto: i.desconto || 0,
            subtotal: i.subtotal
          }));
          setItens(itensMontados);
        }
      }
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoadingDados(false);
    }
  };

  const handleProdutoChange = (id: string) => {
    setProdutoId(id);
    const prod = produtos.find(p => p.id === id);
    if (prod) {
      setValorUnitario(prod.valor_unitario || 0);
      setMedidas(prod.medidas || "");
    } else {
      setValorUnitario(0);
      setMedidas("");
    }
  };

  const adicionarAoCarrinho = () => {
    if (!produtoId) return alert("Selecione um produto.");
    if (quantidade <= 0) return alert("A quantidade deve ser maior que zero.");

    const produtoSelecionado = produtos.find(p => p.id === produtoId);
    if (!produtoSelecionado) return;

    const subtotalBruto = quantidade * valorUnitario;
    let subtotalLiquido = subtotalBruto - desconto;
    if (subtotalLiquido < 0) subtotalLiquido = 0;

    const novoItem: ItemCarrinho = {
      produto_id: produtoSelecionado.id,
      descricao: produtoSelecionado.descricao,
      quantidade,
      valor_unitario: valorUnitario,
      medidas,
      desconto,
      subtotal: subtotalLiquido
    };

    setItens([...itens, novoItem]);
    setProdutoId(""); setQuantidade(1); setValorUnitario(0); setMedidas(""); setDesconto(0);
  };

  const removerDoCarrinho = (indexParaRemover: number) => {
    setItens(itens.filter((_, index) => index !== indexParaRemover));
  };

  const abrirModalEdicao = (index: number) => {
    setIndexEditando(index);
    setItemEditando({ ...itens[index] });
    setModalAberto(true);
  };

  const fecharModalEdicao = () => {
    setModalAberto(false);
    setIndexEditando(null);
    setItemEditando(null);
  };

  const salvarEdicao = () => {
    if (indexEditando === null || !itemEditando) return;
    
    const subtotalBruto = itemEditando.quantidade * itemEditando.valor_unitario;
    let subtotalLiquido = subtotalBruto - itemEditando.desconto;
    if (subtotalLiquido < 0) subtotalLiquido = 0;

    const listaAtualizada = [...itens];
    listaAtualizada[indexEditando] = { ...itemEditando, subtotal: subtotalLiquido };
    
    setItens(listaAtualizada);
    fecharModalEdicao();
  };

  const totalBruto = itens.reduce((acc, item) => acc + (item.quantidade * item.valor_unitario), 0);
  const totalDescontos = itens.reduce((acc, item) => acc + Number(item.desconto), 0);
  const valorTotalOrcamento = itens.reduce((acc, item) => acc + item.subtotal, 0);

  const gerarOuAtualizarOrcamento = async () => {
    if (!dataEmissao) return alert("Por favor, selecione a Data de Emissão.");
    if (!clienteId) return alert("Por favor, selecione um Cliente.");
    if (itens.length === 0) return alert("Adicione pelo menos um produto ao orçamento.");

    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      let idFinal = "";

      // 🚀 SALVANDO A DATA ESCOLHIDA NO BANCO DE DADOS
      if (editId) {
        const { error: erroOrc } = await supabase.from("orcamentos").update({
          cliente_id: clienteId, 
          vendedor_id: vendedorId || null, 
          valor_total: valorTotalOrcamento, 
          observacoes: observacoes,
          data_emissao: dataEmissao 
        }).eq("id", editId).eq("user_id", user.id);
        
        if (erroOrc) throw erroOrc;
        idFinal = editId;
        await supabase.from("itens_orcamento").delete().eq("orcamento_id", editId);
      } else {
        const { data: orcamentoGerado, error: erroOrc } = await supabase.from("orcamentos").insert([{
          user_id: user.id, 
          cliente_id: clienteId, 
          vendedor_id: vendedorId || null, 
          valor_total: valorTotalOrcamento, 
          observacoes: observacoes, 
          status: "Rascunho",
          data_emissao: dataEmissao
        }]).select().single();
        
        if (erroOrc) throw erroOrc;
        idFinal = orcamentoGerado.id;
      }

      const itensParaBanco = itens.map(item => ({
        orcamento_id: idFinal, produto_id: item.produto_id, user_id: user.id, descricao: item.descricao,
        quantidade: item.quantidade, valor_unitario_aplicado: item.valor_unitario, medidas: item.medidas,
        desconto: item.desconto, subtotal: item.subtotal
      }));

      const { error: erroItens } = await supabase.from("itens_orcamento").insert(itensParaBanco);
      if (erroItens) throw erroItens;

      window.open(`/imprimir/${idFinal}?action=view`, "_blank");
      window.location.href = "/dashboard/historico";

    } catch (error) {
      alert("Erro: " + (error as Error).message);
      setSalvando(false);
    }
  };

  const formatarMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

  if (loadingDados) return <div className="p-8 text-gray-500">Preparando gerador...</div>;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      
      <div className="mb-8 mt-2">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {editId ? "✏️ Editando Orçamento" : cloneId ? "📋 Duplicando Orçamento" : "Novo Orçamento"}
        </h1>
        <p className="text-gray-500 text-sm">
          {editId ? "Altere os dados abaixo e clique em salvar para atualizar o PDF." : "Preencha os dados abaixo para gerar um novo documento."}
        </p>
      </div>

      {/* 🚀 NOVO BLOCO 1: GRID RESPONSIVA COM A DATA */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-12 gap-6">
        
        <div className="md:col-span-3">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Data de Emissão *</label>
          <input 
            type="date" 
            required
            value={dataEmissao}
            onChange={(e) => setDataEmissao(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 font-medium cursor-pointer"
          />
        </div>

        <div className="md:col-span-5">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cliente *</label>
          <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 font-medium cursor-pointer">
            <option value="">-- Selecione o Cliente --</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
          </select>
        </div>
        
        <div className="md:col-span-4">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Vendedor Responsável</label>
          <select value={vendedorId} onChange={e => setVendedorId(e.target.value)} className="w-full p-3 bg-blue-50/50 border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-blue-900 font-medium cursor-pointer">
            <option value="">-- Nenhum Vendedor --</option>
            {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Adicionar Produto</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-5 relative">
          <div className="md:col-span-6 lg:col-span-8">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Produto *</label>
            <select value={produtoId} onChange={e => handleProdutoChange(e.target.value)} className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm">
              <option value="">Selecione o produto...</option>
              {produtos.map(p => <option key={p.id} value={p.id}>{p.descricao}</option>)}
            </select>
          </div>

          <div className="md:col-span-6 lg:col-span-4 relative z-10">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Medidas / Especif.</label>
            <textarea rows={2} value={medidas} onChange={e => setMedidas(e.target.value)} placeholder="Ex: 2.50m x 1.20m" className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm resize-y" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Qtd</label>
            <input type="number" min="1" value={quantidade} onChange={e => setQuantidade(Number(e.target.value))} className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center shadow-sm" />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">V. Unitário (R$)</label>
            <input type="number" step="0.01" value={valorUnitario} onChange={e => setValorUnitario(Number(e.target.value))} className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right shadow-sm" />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-red-500 mb-1.5">Desconto (R$)</label>
            <input type="number" step="0.01" min="0" value={desconto} onChange={e => setDesconto(Number(e.target.value))} className="w-full p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-right font-medium shadow-sm" />
          </div>

          <div className="md:col-span-3">
            <button onClick={adicionarAoCarrinho} className="w-full h-[48px] bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
              Incluir
            </button>
          </div>
        </div>
      </div>

      {itens.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="block md:hidden divide-y divide-gray-100">
            {itens.map((item, index) => (
              <div key={index} className="p-4 bg-gray-50/30">
                <div className="flex justify-between items-start mb-3">
                  <div className="pr-4">
                    <h3 className="font-bold text-gray-900">{item.descricao}</h3>
                    {item.medidas && <p className="text-xs text-gray-500 mt-1"><span className="font-semibold text-gray-400">Medidas:</span> {item.medidas}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => abrirModalEdicao(index)} className="text-blue-500 hover:text-blue-700 p-1.5 transition-colors bg-white rounded-md border border-gray-200 shadow-sm" title="Editar">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    <button onClick={() => removerDoCarrinho(index)} className="text-gray-400 hover:text-red-500 p-1.5 transition-colors bg-white rounded-md border border-gray-200 shadow-sm" title="Remover">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div className="bg-white p-2 rounded-md border border-gray-100"><span className="block text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">Qtd</span><span className="font-medium text-gray-700">{item.quantidade}</span></div>
                  <div className="bg-white p-2 rounded-md border border-gray-100 text-right"><span className="block text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">V. Unit</span><span className="font-medium text-gray-700">{formatarMoeda(item.valor_unitario)}</span></div>
                  {item.desconto > 0 && (
                    <div className="col-span-2 bg-red-50 p-2 rounded-md border border-red-100 flex justify-between items-center"><span className="text-[10px] uppercase tracking-wider text-red-400 font-bold">Desconto</span><span className="font-bold text-red-600">- {formatarMoeda(item.desconto)}</span></div>
                  )}
                </div>
                <div className="border-t border-gray-200 mt-2 pt-3 flex justify-between items-center">
                  <span className="font-bold text-gray-500 text-xs uppercase tracking-wider">Subtotal:</span><span className="font-black text-gray-900 text-lg">{formatarMoeda(item.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider">Produto</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-center">Qtd</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-right">V. Unit</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-right text-red-300">Desc</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-right">Subtotal</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {itens.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-gray-800">{item.descricao}</p>
                      {item.medidas && <p className="text-xs text-gray-500 mt-0.5">Medidas: {item.medidas}</p>}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600 font-medium">{item.quantidade}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{formatarMoeda(item.valor_unitario)}</td>
                    <td className="py-3 px-4 text-right text-red-500 font-medium">{item.desconto > 0 ? `- ${formatarMoeda(item.desconto)}` : "-"}</td>
                    <td className="py-3 px-4 text-right text-gray-900 font-bold">{formatarMoeda(item.subtotal)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => abrirModalEdicao(index)} className="text-blue-500 hover:text-blue-700 p-1.5 transition-colors bg-white rounded-md border border-gray-200 shadow-sm" title="Editar">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button onClick={() => removerDoCarrinho(index)} className="text-gray-400 hover:text-red-500 p-1.5 transition-colors bg-white rounded-md border border-gray-200 shadow-sm" title="Remover">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="bg-gray-50 p-6 border-t border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="w-full md:w-1/2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Observações do Orçamento</label>
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} placeholder="Condições de pagamento, prazos de entrega, etc..." className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-y" />
            </div>

            <div className="w-full md:w-auto bg-white p-5 rounded-xl border border-gray-200 shadow-sm min-w-[300px]">
              <div className="flex justify-between items-center mb-2 text-gray-500"><span>Subtotal Bruto:</span><span>{formatarMoeda(totalBruto)}</span></div>
              <div className="flex justify-between items-center mb-3 text-red-500 font-medium"><span>Descontos Aplicados:</span><span>- {formatarMoeda(totalDescontos)}</span></div>
              <div className="border-t border-dashed border-gray-200 pt-3 flex justify-between items-center">
                <span className="text-gray-800 font-bold uppercase tracking-wider text-sm">Valor Final:</span>
                <span className="text-2xl font-black text-blue-600">{formatarMoeda(valorTotalOrcamento)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button 
          onClick={gerarOuAtualizarOrcamento}
          disabled={salvando || itens.length === 0 || !clienteId || !dataEmissao}
          className={`w-full md:w-auto text-white font-black text-lg py-4 px-10 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:bg-gray-400 ${
            editId ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {salvando ? "Processando..." : (
            <>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
              {editId ? "Salvar Alterações e Ver PDF" : "Gerar PDF do Orçamento"}
            </>
          )}
        </button>
      </div>

      {modalAberto && itemEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900">Editar Item</h3>
              <button onClick={fecharModalEdicao} className="text-gray-400 hover:text-red-500 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Descrição do Produto</label>
                <input type="text" value={itemEditando.descricao} onChange={(e) => setItemEditando({...itemEditando, descricao: e.target.value})} className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm font-medium" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Medidas / Especificações</label>
                <textarea rows={2} value={itemEditando.medidas} onChange={(e) => setItemEditando({...itemEditando, medidas: e.target.value})} className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm resize-y" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Quantidade</label>
                  <input type="number" min="1" value={itemEditando.quantidade} onChange={(e) => setItemEditando({...itemEditando, quantidade: Number(e.target.value)})} className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center shadow-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">V. Unit (R$)</label>
                  <input type="number" step="0.01" value={itemEditando.valor_unitario} onChange={(e) => setItemEditando({...itemEditando, valor_unitario: Number(e.target.value)})} className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right shadow-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-red-500 uppercase tracking-wider mb-1.5">Desc (R$)</label>
                  <input type="number" step="0.01" min="0" value={itemEditando.desconto} onChange={(e) => setItemEditando({...itemEditando, desconto: Number(e.target.value)})} className="w-full p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-right font-medium shadow-sm" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button onClick={fecharModalEdicao} className="px-5 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
              <button onClick={salvarEdicao} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-md flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NovoOrcamentoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Carregando gerador...</div>}>
      <FormularioOrcamento />
    </Suspense>
  );
}