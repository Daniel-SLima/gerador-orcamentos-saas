"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase"; // Corrigido o caminho do import
import Link from "next/link";

interface ResumoDashboard {
  totalOrcamentos: number;
  valorTotal: number;
  totalClientes: number;
  totalProdutos: number;
}

interface UltimoOrcamento {
  id: string;
  numero_orcamento: number;
  data_emissao: string;
  valor_total: number;
  status: string;
  clientes: {
    nome_razao_social: string;
  };
}

export default function DashboardPage() {
  const [resumo, setResumo] = useState<ResumoDashboard>({ totalOrcamentos: 0, valorTotal: 0, totalClientes: 0, totalProdutos: 0 });
  const [ultimosOrcamentos, setUltimosOrcamentos] = useState<UltimoOrcamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDashboard();
  }, []);

  const carregarDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Busca os últimos 5 orçamentos para a tabela rápida
      const { data: orcamentosData } = await supabase
        .from("orcamentos")
        .select(`id, numero_orcamento, data_emissao, valor_total, status, clientes ( nome_razao_social )`)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (orcamentosData) {
        setUltimosOrcamentos(orcamentosData as unknown as UltimoOrcamento[]);
      }

      // 2. Busca totais para os Cards
      const [contagemClientes, contagemProdutos, todosOrcamentos] = await Promise.all([
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("produtos").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("orcamentos").select("valor_total").eq("user_id", user.id)
      ]);

      const totalDinheiro = todosOrcamentos.data?.reduce((acc: number, curr: { valor_total: number }) => acc + Number(curr.valor_total), 0) || 0;
      const totalOrcamentosFeitos = todosOrcamentos.data?.length || 0;

      setResumo({
        totalOrcamentos: totalOrcamentosFeitos,
        valorTotal: totalDinheiro,
        totalClientes: contagemClientes.count || 0,
        totalProdutos: contagemProdutos.count || 0
      });

    } catch (error) {
      console.error("Erro ao carregar painel:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr);
    data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
    return new Intl.DateTimeFormat('pt-BR').format(data);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 font-medium animate-pulse">Carregando painel...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Cabeçalho de Boas-Vindas */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Visão Geral</h1>
        <p className="text-gray-500 mt-1">Acompanhe o desempenho do seu negócio em tempo real.</p>
      </div>

      {/* BLOCO 1: CARDS DE RESUMO (GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        
        {/* Card 1: Valor Financeiro */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 shadow-md text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-blue-500/30 p-3 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <span className="text-blue-100 text-xs font-bold uppercase tracking-wider bg-blue-900/30 px-2 py-1 rounded-md">Total</span>
          </div>
          <div>
            <p className="text-blue-100 text-sm font-medium mb-1">Valor em Orçamentos</p>
            <h3 className="text-2xl md:text-3xl font-black">{formatarMoeda(resumo.valorTotal)}</h3>
          </div>
        </div>

        {/* Card 2: Qtd Orçamentos */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium mb-1">Orçamentos Gerados</p>
            <h3 className="text-2xl font-black text-gray-900">{resumo.totalOrcamentos}</h3>
          </div>
        </div>

        {/* Card 3: Clientes */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            </div>
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium mb-1">Clientes na Base</p>
            <h3 className="text-2xl font-black text-gray-900">{resumo.totalClientes}</h3>
          </div>
        </div>

        {/* Card 4: Produtos */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
            </div>
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium mb-1">Produtos Cadastrados</p>
            <h3 className="text-2xl font-black text-gray-900">{resumo.totalProdutos}</h3>
          </div>
        </div>

      </div>

      {/* BLOCO 2: ACESSO RÁPIDO AOS ÚLTIMOS ORÇAMENTOS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-8">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">Últimos Orçamentos</h2>
          <Link href="/dashboard/historico" className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">
            Ver Todos →
          </Link>
        </div>
        
        {ultimosOrcamentos.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <div className="bg-gray-50 p-4 rounded-full mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <p className="text-gray-500 font-medium mb-4">Você ainda não gerou nenhum orçamento.</p>
            <Link href="/dashboard/orcamentos" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-sm">
              Criar Meu Primeiro Orçamento
            </Link>
          </div>
        ) : (
          <div>
            {/* 📱 VISUALIZAÇÃO MOBILE (CARDS) */}
            <div className="block md:hidden divide-y divide-gray-100">
              {ultimosOrcamentos.map((orc) => (
                <div key={orc.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">#{String(orc.numero_orcamento).padStart(5, '0')}</h3>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5">
                        {Array.isArray(orc.clientes) ? orc.clientes[0]?.nome_razao_social : orc.clientes?.nome_razao_social}
                      </p>
                    </div>
                    <button 
                      onClick={() => window.open(`/imprimir/${orc.id}?action=view`, "_blank")}
                      className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors focus:outline-none"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-end mt-4">
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-500 font-medium">{formatarData(orc.data_emissao)}</p>
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
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-100">
                    <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Nº</th>
                    <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Cliente</th>
                    <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Valor Total</th>
                    <th className="py-4 px-6 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ultimosOrcamentos.map((orc) => (
                    <tr key={orc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6 text-gray-900 font-bold">#{String(orc.numero_orcamento).padStart(5, '0')}</td>
                      <td className="py-4 px-6 text-gray-800 font-medium">
                        {Array.isArray(orc.clientes) ? orc.clientes[0]?.nome_razao_social : orc.clientes?.nome_razao_social}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 text-xs font-bold rounded-md ${
                          orc.status === 'Rascunho' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {orc.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right text-gray-900 font-bold">{formatarMoeda(orc.valor_total)}</td>
                      <td className="py-4 px-6 text-center">
                        <button 
                          onClick={() => window.open(`/imprimir/${orc.id}?action=view`, "_blank")}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors font-medium text-sm flex items-center justify-center mx-auto gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                          Ver PDF
                        </button>
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