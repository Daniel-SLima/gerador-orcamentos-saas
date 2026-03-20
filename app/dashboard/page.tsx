"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import { usePerfilUsuario } from "../hooks/usePerfilUsuario";

interface ResumoDashboard {
  totalOrcamentos: number;
  valorTotal: number;
  totalRascunhos: number;
  totalAprovados: number;
  totalReprovados: number;
}

interface UltimoOrcamento {
  id: string;
  numero_orcamento: number;
  data_emissao: string;
  created_at: string;
  valor_total: number;
  status: string;
  clientes: {
    nome_razao_social: string;
  };
  vendedores?: {
    nome: string;
    email?: string;
  } | null;
}

export default function DashboardPage() {
  const [resumo, setResumo] = useState<ResumoDashboard>({ totalOrcamentos: 0, valorTotal: 0, totalRascunhos: 0, totalAprovados: 0, totalReprovados: 0 });
  const [ultimosOrcamentos, setUltimosOrcamentos] = useState<UltimoOrcamento[]>([]);
  const [todosOrcamentosBrutos, setTodosOrcamentosBrutos] = useState<UltimoOrcamento[]>([]);
  const [loading, setLoading] = useState(true);

  // 🚀 ESTADOS RANKINGS (NOVO)
  const [rankingVendedores, setRankingVendedores] = useState<{nome: string, total: number, qtd: number}[]>([]);
  const [rankingClientes, setRankingClientes] = useState<{nome: string, total: number, qtd: number}[]>([]);

  // 🚀 ESTADOS DOS FILTROS
  const [tipoFiltro, setTipoFiltro] = useState("todos"); // 'todos', 'mes', 'dia'
  const [mesSelecionado, setMesSelecionado] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [diaSelecionado, setDiaSelecionado] = useState(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD

  const { isAdmin, loadingPerfil } = usePerfilUsuario();

  useEffect(() => {
    if (!loadingPerfil) {
      carregarDashboard();
    }
  }, [loadingPerfil]);

  // 🚀 RECALCULA TUDO AUTOMATICAMENTE QUANDO O FILTRO MUDA
  useEffect(() => {
    if (todosOrcamentosBrutos.length === 0) return;

    const orcamentosFiltrados = todosOrcamentosBrutos.filter(orc => {
      if (tipoFiltro === "todos") return true;

      // Pega a data ignorando o fuso horário complexo
      const dataBase = (orc.data_emissao || orc.created_at).split("T")[0];

      if (tipoFiltro === "mes" && mesSelecionado) {
        return dataBase.startsWith(mesSelecionado); // Ex: "2026-03-15" começa com "2026-03"
      }
      if (tipoFiltro === "dia" && diaSelecionado) {
        return dataBase === diaSelecionado;
      }
      return true;
    });

    // 💰 VALOR TOTAL: apenas Aprovado + Aberto
    const orcAtivos = orcamentosFiltrados.filter(orc => orc.status === "Aprovado" || orc.status === "Aberto");
    const valor = orcAtivos.reduce((acc, curr) => acc + Number(curr.valor_total), 0);

    // 📊 CONTADORES POR STATUS
    const totalRascunhos = orcamentosFiltrados.filter(o => o.status === "Rascunho").length;
    const totalAprovados = orcamentosFiltrados.filter(o => o.status === "Aprovado").length;
    const totalReprovados = orcamentosFiltrados.filter(o => o.status === "Recusado").length;

    setResumo(prev => ({
      ...prev,
      valorTotal: valor,
      totalOrcamentos: orcAtivos.length,
      totalRascunhos,
      totalAprovados,
      totalReprovados
    }));

    // 🏆 CÁLCULO DOS RANKINGS APENAS PARA APROVADOS
    const mapVendedores = new Map<string, { nome: string, total: number, qtd: number }>();
    const mapClientes = new Map<string, { nome: string, total: number, qtd: number }>();

    orcamentosFiltrados.forEach(orc => {
      if (orc.status === "Aprovado") {
        const vTotal = Number(orc.valor_total);
        
        // Ranking Vendedor
        const nomeVend = orc.vendedores?.nome || "Administrador";
        const atualVend = mapVendedores.get(nomeVend) || { nome: nomeVend, total: 0, qtd: 0 };
        atualVend.total += vTotal;
        atualVend.qtd += 1;
        mapVendedores.set(nomeVend, atualVend);

        // Ranking Cliente
        const nomeCli = Array.isArray(orc.clientes) ? orc.clientes[0]?.nome_razao_social : orc.clientes?.nome_razao_social;
        if (nomeCli) {
          const atualCli = mapClientes.get(nomeCli) || { nome: nomeCli, total: 0, qtd: 0 };
          atualCli.total += vTotal;
          atualCli.qtd += 1;
          mapClientes.set(nomeCli, atualCli);
        }
      }
    });

    setRankingVendedores(Array.from(mapVendedores.values()).sort((a, b) => b.total - a.total).slice(0, 5));
    setRankingClientes(Array.from(mapClientes.values()).sort((a, b) => b.total - a.total).slice(0, 5));

    // Atualiza a tabela rápida com os 5 mais recentes do período filtrado
    setUltimosOrcamentos(orcamentosFiltrados.slice(0, 5));

  }, [tipoFiltro, mesSelecionado, diaSelecionado, todosOrcamentosBrutos]);

  const carregarDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let orcamentosQuery = supabase
        .from("orcamentos")
        .select(`id, numero_orcamento, data_emissao, created_at, valor_total, status, clientes ( nome_razao_social ), vendedores ( nome, email )`)
        .order("numero_orcamento", { ascending: false });

      if (!isAdmin) {
        orcamentosQuery = orcamentosQuery.eq("user_id", user.id);
      }

      // Puxa TUDO de uma vez só (Super rápido)
      const [todosOrc] = await Promise.all([
        orcamentosQuery
      ]);

      if (todosOrc.data) {
        setTodosOrcamentosBrutos(todosOrc.data as unknown as UltimoOrcamento[]);
      }




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

  // =========================================================================
  // 👔 VISÃO DO VENDEDOR (Simplificada)
  // =========================================================================
  if (!isAdmin) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[80vh]">
        <div className="bg-white p-10 md:p-16 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center max-w-2xl w-full animate-fade-in">
          
          <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3 tracking-tight">
            Seja Bem-vindo(a)!
          </h1>
          
          <p className="text-gray-500 text-lg mb-10 max-w-md leading-relaxed">
            Aqui você pode gerenciar seus clientes e gerar novos orçamentos de forma rápida e profissional.
          </p>

          <Link 
            href="/dashboard/orcamentos" 
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 font-bold text-white bg-blue-600 rounded-xl overflow-hidden transition-all hover:bg-blue-700 hover:scale-105 hover:shadow-xl hover:shadow-blue-200/50 focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            <svg className="w-6 h-6 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
            <span>Criar Novo Orçamento</span>
          </Link>

        </div>
      </div>
    );
  }

  // =========================================================================
  // 👑 VISÃO DO ADMINISTRADOR (Completa com Aprovações)
  // =========================================================================

  const orcamentosParaAprovar = ultimosOrcamentos.filter(orc => orc.status === "Aberto");

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Visão Geral da Empresa</h1>
        <p className="text-gray-500 mt-1">Acompanhe o desempenho de todos os vendedores.</p>
      </div>

      {/* FILTRO INTELIGENTE */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 md:items-center">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Período:</span>
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 font-medium transition-all"
          >
            <option value="todos">Todo o período</option>
            <option value="mes">Filtrar por Mês</option>
            <option value="dia">Filtrar por Dia</option>
          </select>
        </div>

        {tipoFiltro === "mes" && (
          <div className="animate-fade-in w-full md:w-auto">
            <input
              type="month"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              className="w-full md:w-auto px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 transition-all"
            />
          </div>
        )}

        {tipoFiltro === "dia" && (
          <div className="animate-fade-in w-full md:w-auto">
            <input
              type="date"
              value={diaSelecionado}
              onChange={(e) => setDiaSelecionado(e.target.value)}
              className="w-full md:w-auto px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 transition-all"
            />
          </div>
        )}
      </div>

      {/* BLOCO 1: CARDS DE RESUMO (GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mt-4">
        {/* Card 1: Valor Financeiro */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 shadow-md text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-blue-500/30 p-3 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <span className="text-blue-100 text-xs font-bold uppercase tracking-wider bg-blue-900/30 px-2 py-1 rounded-md">Aberto + Aprovado</span>
          </div>
          <div>
            <p className="text-blue-100 text-sm font-medium mb-1">Valor Ativo</p>
            <h3 className="text-2xl md:text-3xl font-black">{formatarMoeda(resumo.valorTotal)}</h3>
          </div>
        </div>

        {/* Card 2: Rascunhos */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-yellow-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
            </div>
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium mb-1">Rascunhos em Aberto</p>
            <h3 className="text-2xl font-black text-yellow-600">{resumo.totalRascunhos}</h3>
          </div>
        </div>

        {/* Card 3: Aprovados */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-green-50 border border-green-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium mb-1">Aprovados no Período</p>
            <h3 className="text-2xl font-black text-green-600">{resumo.totalAprovados}</h3>
          </div>
        </div>

        {/* Card 4: Reprovados */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-red-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-red-50 border border-red-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium mb-1">Reprovados no Período</p>
            <h3 className="text-2xl font-black text-red-400">{resumo.totalReprovados}</h3>
          </div>
        </div>
      </div>

      {/* 🚨 BLOCO NOVO: AGUARDANDO APROVAÇÃO (SOMENTE SE TIVER) */}
      {orcamentosParaAprovar.length > 0 && (
        <div className="bg-orange-50/50 border-2 border-orange-200 rounded-2xl shadow-sm overflow-hidden mt-8 animate-fade-in relative">
          
          <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>

          <div className="p-6 border-b border-orange-100 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white/50">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 text-orange-600 p-2.5 rounded-xl shadow-inner">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Aguardando Aprovação</h2>
                <p className="text-sm text-gray-500">Foram enviados {orcamentosParaAprovar.length} orçamentos pelos vendedores.</p>
              </div>
            </div>
            
            <Link 
              href="/dashboard/historico" 
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-sm text-sm text-center"
            >
              Analisar no Histórico
            </Link>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orcamentosParaAprovar.slice(0, 3).map((orc) => (
                <div key={orc.id} className="bg-white border border-orange-100 rounded-xl p-4 shadow-sm relative group hover:border-orange-300 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-gray-900 text-base">#{String(orc.numero_orcamento).padStart(5, '0')}</span>
                    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-md tracking-wide">
                      Vend: {orc.vendedores?.nome || "Admin"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate mb-4" title={Array.isArray(orc.clientes) ? orc.clientes[0]?.nome_razao_social : orc.clientes?.nome_razao_social}>
                    {Array.isArray(orc.clientes) ? orc.clientes[0]?.nome_razao_social : orc.clientes?.nome_razao_social}
                  </p>
                  <div className="flex justify-between items-end border-t border-gray-50 pt-3">
                    <p className="text-xs text-gray-500">{formatarData(orc.data_emissao)}</p>
                    <p className="font-black text-orange-600 text-lg">{formatarMoeda(orc.valor_total)}</p>
                  </div>
                  
                  {/* Botão de Ver Documento escondido até o HOVER (só desktop) */}
                  <div className="absolute inset-0 bg-white/95 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                    <button
                      onClick={() => window.open(`/imprimir/${orc.id}?action=view`, "_blank")}
                      className="bg-gray-900 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-transform transform scale-95 group-hover:scale-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                      Visualizar PDF
                    </button>
                  </div>
                </div>
              ))}
              {orcamentosParaAprovar.length > 3 && (
                <Link href="/dashboard/historico" className="bg-orange-50 border border-orange-200 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-orange-700 hover:bg-orange-100 transition-colors">
                  <span className="font-bold text-lg mb-1">+{orcamentosParaAprovar.length - 3}</span>
                  <span className="text-sm font-medium">Ver todos</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🏆 BLOCO DE ANÁLISES: RANKING DE VENDEDORES E CLIENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* RANKING DE VENDEDORES */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-50 flex items-center gap-3">
            <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">Melhores Vendedores</h3>
              <p className="text-xs text-gray-500">Baseado em orçamentos Aprovados</p>
            </div>
          </div>
          <div className="p-5">
            {rankingVendedores.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Nenhuma venda concluída no período.</p>
            ) : (
              <ul className="space-y-4">
                {rankingVendedores.map((vend, index) => (
                  <li key={index} className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-gray-100 text-gray-600 font-semibold' : index === 2 ? 'bg-orange-50 text-orange-800' : 'bg-transparent text-gray-400 font-normal'}`}>
                      {index + 1}º
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-end mb-1">
                        <span className="font-bold text-sm text-gray-800 truncate">{vend.nome}</span>
                        <span className="font-black text-sm text-blue-600">{formatarMoeda(vend.total)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(vend.total / rankingVendedores[0].total) * 100}%` }}></div>
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium">{vend.qtd} {vend.qtd === 1 ? 'venda' : 'vendas'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* RANKING DE CLIENTES */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-50 flex items-center gap-3">
            <div className="bg-green-50 text-green-600 p-2 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">Melhores Clientes</h3>
              <p className="text-xs text-gray-500">Baseado em orçamentos Aprovados</p>
            </div>
          </div>
          <div className="p-5">
            {rankingClientes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Nenhuma compra concluída no período.</p>
            ) : (
              <ul className="space-y-4">
                {rankingClientes.map((cli, index) => (
                  <li key={index} className="flex items-center gap-4">
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-gray-100 text-gray-600 font-semibold' : index === 2 ? 'bg-orange-50 text-orange-800' : 'bg-transparent text-gray-400 font-normal'}`}>
                      {index + 1}º
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-end mb-1">
                        <span className="font-bold text-sm text-gray-800 truncate max-w-[180px]" title={cli.nome}>{cli.nome}</span>
                        <span className="font-black text-sm text-green-600">{formatarMoeda(cli.total)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${(cli.total / rankingClientes[0].total) * 100}%` }}></div>
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium">{cli.qtd} {cli.qtd === 1 ? 'pedido' : 'pedidos'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* BLOCO 2: ACESSO RÁPIDO AOS ÚLTIMOS ORÇAMENTOS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-8">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">
            {tipoFiltro === "todos" ? "Histórico Recente" : "Histórico do Período"}
          </h2>
          <Link href="/dashboard/historico" className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">
            Ver Todos →
          </Link>
        </div>

        {ultimosOrcamentos.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <div className="bg-gray-50 p-4 rounded-full mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <p className="text-gray-500 font-medium mb-4">Nenhum orçamento encontrado neste período.</p>
            <Link href="/dashboard/orcamentos" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-sm">
              Criar Novo Orçamento
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
                      <span className={`inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border ${orc.status === 'Rascunho' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          orc.status === 'Aberto' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            orc.status === 'Aprovado' ? 'bg-green-50 text-green-700 border-green-200' :
                              orc.status === 'Recusado' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-gray-100 text-gray-600 border-gray-200'
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
                      <td className="py-4 px-6 text-gray-800 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={Array.isArray(orc.clientes) ? orc.clientes[0]?.nome_razao_social : orc.clientes?.nome_razao_social}>
                        {Array.isArray(orc.clientes) ? orc.clientes[0]?.nome_razao_social : orc.clientes?.nome_razao_social}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 text-xs font-bold rounded-md border ${orc.status === 'Rascunho' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                            orc.status === 'Aberto' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              orc.status === 'Aprovado' ? 'bg-green-50 text-green-700 border-green-200' :
                                orc.status === 'Recusado' ? 'bg-red-50 text-red-700 border-red-200' :
                                  'bg-gray-100 text-gray-600 border-gray-200'
                          }`}>
                          {orc.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right text-gray-900 font-bold">{formatarMoeda(orc.valor_total)}</td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => window.open(`/imprimir/${orc.id}?action=view`, "_blank")}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors font-medium text-sm flex items-center justify-center mx-auto gap-2"
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