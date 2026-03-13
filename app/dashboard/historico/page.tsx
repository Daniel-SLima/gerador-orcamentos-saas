"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

interface Orcamento {
  id: string;
  numero_orcamento: number;
  data_emissao: string;
  valor_total: number;
  status: string;
  clientes: {
    nome_razao_social: string;
  };
}

export default function HistoricoOrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);

  useEffect(() => {
    carregarOrcamentos();
  }, []);

  const carregarOrcamentos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("orcamentos")
        .select(`
          id,
          numero_orcamento,
          data_emissao,
          valor_total,
          status,
          clientes ( nome_razao_social )
        `)
        .eq("user_id", user.id)
        .order("numero_orcamento", { ascending: false });

      if (error) throw error;
      setOrcamentos(data as unknown as Orcamento[]);
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
    } finally {
      setLoading(false);
    }
  };

  const deletarOrcamento = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este orçamento permanentemente?")) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      await supabase.from("itens_orcamento").delete().eq("orcamento_id", id).eq("user_id", user.id);
      const { error } = await supabase.from("orcamentos").delete().eq("id", id).eq("user_id", user.id);

      if (error) throw error;
      setOrcamentos(orcamentos.filter(orc => orc.id !== id));
      setMenuAbertoId(null);
    } catch (error) {
      alert("Erro ao excluir orçamento: " + (error as Error).message);
    }
  };

  const visualizarPDF = (id: string) => {
    window.open(`/imprimir/${id}?action=view`, "_blank");
    setMenuAbertoId(null);
  };

  const baixarPDF = (id: string) => {
    window.open(`/imprimir/${id}?action=download`, "_blank");
    setMenuAbertoId(null);
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr);
    data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
    return new Intl.DateTimeFormat('pt-BR').format(data);
  };

  const toggleMenu = (id: string) => {
    if (menuAbertoId === id) setMenuAbertoId(null);
    else setMenuAbertoId(id);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto" onClick={() => menuAbertoId && setMenuAbertoId(null)}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Histórico de Orçamentos</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible min-h-[400px]">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando histórico...</div>
        ) : orcamentos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum orçamento gerado ainda.</div>
        ) : (
          <div className="pb-16 md:pb-0">
            
            {/* 📱 VISUALIZAÇÃO MOBILE (CARDS COM 3 PONTINHOS) */}
            <div className="block md:hidden divide-y divide-gray-100">
              {orcamentos.map((orc) => (
                <div key={orc.id} className="p-4 hover:bg-gray-50 transition-colors relative">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">#{String(orc.numero_orcamento).padStart(5, '0')}</h3>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5">
                        {Array.isArray(orc.clientes) ? orc.clientes[0]?.nome_razao_social : orc.clientes?.nome_razao_social}
                      </p>
                    </div>
                    
                    {/* Botão de 3 pontinhos */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleMenu(orc.id); }}
                      className="p-1 -mr-2 text-gray-400 hover:text-blue-600 rounded-lg transition-colors focus:outline-none"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                    </button>

                    {/* Menu Suspenso (Dropdown) */}
                    {menuAbertoId === orc.id && (
                      <div className="absolute right-4 top-10 w-40 bg-white border border-gray-100 rounded-xl shadow-xl z-50 flex flex-col py-2 animate-fade-in">
                        <button onClick={(e) => { e.stopPropagation(); visualizarPDF(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                          Ver PDF
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); baixarPDF(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                          Baixar PDF
                        </button>
                        <div className="h-px bg-gray-100 my-1 mx-2"></div>
                        <button onClick={(e) => { e.stopPropagation(); deletarOrcamento(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-red-600 hover:bg-red-50 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-end mt-4">
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-500 font-medium">Emitido em: {formatarData(orc.data_emissao)}</p>
                      <span className={`inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md ${
                        orc.status === 'Rascunho' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {orc.status}
                      </span>
                    </div>
                    <p className="font-black text-green-600 text-lg">{formatarMoeda(orc.valor_total)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 💻 VISUALIZAÇÃO DESKTOP (TABELA) */}
            <div className="hidden md:block overflow-x-auto pb-24">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-4 text-sm font-semibold text-gray-600">Número</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Data</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Cliente</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Status</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Valor Total</th>
                    <th className="p-4 text-sm font-semibold text-gray-600 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orcamentos.map((orc) => (
                    <tr key={orc.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-gray-900 font-bold">#{String(orc.numero_orcamento).padStart(5, '0')}</td>
                      <td className="p-4 text-gray-600">{formatarData(orc.data_emissao)}</td>
                      <td className="p-4 text-gray-800 font-medium">
                        {Array.isArray(orc.clientes) ? orc.clientes[0]?.nome_razao_social : orc.clientes?.nome_razao_social}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 text-xs font-bold rounded-md ${
                          orc.status === 'Rascunho' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {orc.status}
                        </span>
                      </td>
                      <td className="p-4 text-green-600 font-bold">{formatarMoeda(orc.valor_total)}</td>
                      
                      <td className="p-4 text-center relative">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleMenu(orc.id); }}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center mx-auto gap-2"
                        >
                          Ações
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>

                        {menuAbertoId === orc.id && (
                          <div className="absolute right-12 top-14 w-40 bg-white border border-gray-100 rounded-xl shadow-xl z-50 flex flex-col py-2 animate-fade-in">
                            <button onClick={(e) => { e.stopPropagation(); visualizarPDF(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                              Ver PDF
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); baixarPDF(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                              Baixar PDF
                            </button>
                            <div className="h-px bg-gray-100 my-1 mx-2"></div>
                            <button onClick={(e) => { e.stopPropagation(); deletarOrcamento(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-red-600 hover:bg-red-50 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                              Excluir
                            </button>
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