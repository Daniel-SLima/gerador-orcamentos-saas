"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import { usePerfilUsuario } from "../hooks/usePerfilUsuario";

interface ResumoDashboard {
  totalOrcamentos: number;
  valorTotal: number;
  valorAbertos: number;      // ← NOVO
  valorAprovados: number;    // ← NOVO
  totalAbertos: number;      // ← NOVO
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
  user_id: string;
  endereco_obra?: string;
  clientes: { nome_razao_social: string } | { nome_razao_social: string }[];
  vendedores?: { nome: string; email?: string } | { nome: string; email?: string }[] | null;
}

export default function DashboardPage() {
  const [resumo, setResumo] = useState<ResumoDashboard>({ totalOrcamentos: 0, valorTotal: 0, valorAbertos: 0, valorAprovados: 0, totalAbertos: 0, totalRascunhos: 0, totalAprovados: 0, totalReprovados: 0 });
  const [ultimosOrcamentos, setUltimosOrcamentos] = useState<UltimoOrcamento[]>([]);
  const [todosOrcamentosBrutos, setTodosOrcamentosBrutos] = useState<UltimoOrcamento[]>([]);
  const [loading, setLoading] = useState(true);

  // Dashboard do Vendedor
  const [resumoVendedor, setResumoVendedor] = useState({
    valorAberto: 0,
    valorAprovado: 0,
    valorRecusado: 0,
    qtdAberto: 0,
    qtdAprovado: 0,
    qtdRascunho: 0,
    qtdRecusado: 0,
  });
  const [orcamentosAguardando, setOrcamentosAguardando] = useState<UltimoOrcamento[]>([]);
  const [orcamentosAprovados, setOrcamentosAprovados] = useState<UltimoOrcamento[]>([]);
  const [orcamentosRecusados, setOrcamentosRecusados] = useState<UltimoOrcamento[]>([]);
  const [orcamentosRascunhos, setOrcamentosRascunhos] = useState<UltimoOrcamento[]>([]);
  const [abaVendedor, setAbaVendedor] = useState<"abertos" | "aprovados" | "recusados" | "rascunhos">("abertos");
  const [opsVendedor, setOpsVendedor] = useState<{
    id: string;
    numero_op: number;
    status: string;
    orcamento_id: string;
    cliente_nome: string;
  }[]>([]);
  const [graficoVendedor, setGraficoVendedor] = useState<{mes: string, aprovados: number, abertos: number}[]>([]);

  // 🚀 ESTADOS RANKINGS (NOVO)
  const [rankingVendedores, setRankingVendedores] = useState<{nome: string, total: number, qtd: number}[]>([]);
  const [rankingClientes, setRankingClientes] = useState<{nome: string, total: number, qtd: number}[]>([]);
  const [graficoMeses, setGraficoMeses] = useState<{mes: string, qtd: number, aprovados: number}[]>([]);

  // 🚀 ESTADOS DOS FILTROS
  const [tipoFiltro, setTipoFiltro] = useState("todos"); // 'todos', 'mes', 'dia'
  const [mesSelecionado, setMesSelecionado] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [diaSelecionado, setDiaSelecionado] = useState(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD

  const { isAdmin, isFinanceiro, emailUsuario, loadingPerfil } = usePerfilUsuario();

  // Extrai o nome de exibição a partir do e-mail (tudo antes do @) — pode ser sobrescrito pelo nome do vendedor
  const [nomeExibicao, setNomeExibicao] = useState<string | null>(emailUsuario ? emailUsuario.split("@")[0] : null);

  useEffect(() => {
    if (!loadingPerfil) {
      if (isAdmin || isFinanceiro) {
        carregarDashboard();
      } else {
        // Vendedor carrega seu próprio dashboard
        carregarDashboardVendedor().finally(() => setLoading(false));
      }
    }
  }, [loadingPerfil, isAdmin, isFinanceiro]);

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

    // 💰 VALORES SEPARADOS
    const orcAbertos = orcamentosFiltrados.filter(orc => orc.status === "Aberto");
    const orcAprovados = orcamentosFiltrados.filter(orc => orc.status === "Aprovado");

    const valorAbertos = orcAbertos.reduce((acc, curr) => acc + Number(curr.valor_total), 0);
    const valorAprovados = orcAprovados.reduce((acc, curr) => acc + Number(curr.valor_total), 0);
    const valor = valorAbertos + valorAprovados; // mantém para compatibilidade

    // 📊 CONTADORES POR STATUS
    const totalAbertos = orcAbertos.length;
    const totalRascunhos = orcamentosFiltrados.filter(o => o.status === "Rascunho").length;
    const totalAprovados = orcAprovados.length;
    const totalReprovados = orcamentosFiltrados.filter(o => o.status === "Recusado").length;

    setResumo(prev => ({
      ...prev,
      valorTotal: valor,
      valorAbertos,        // ← NOVO
      valorAprovados,      // ← NOVO
      totalAbertos,        // ← NOVO
      totalOrcamentos: totalAbertos + totalAprovados,
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
        const nomeVend = (Array.isArray(orc.vendedores) ? orc.vendedores[0]?.nome : orc.vendedores?.nome) || "Administrador";
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

    // 📊 GRÁFICO: Últimos 6 meses (sempre usa todos os dados, sem filtro de período)
    const agora = new Date();
    const mesesData: {mes: string, qtd: number, aprovados: number}[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const orcsMes = todosOrcamentosBrutos.filter(o => (o.data_emissao || o.created_at || '').slice(0, 7) === chave);
      mesesData.push({ mes: label, qtd: orcsMes.length, aprovados: orcsMes.filter(o => o.status === 'Aprovado').length });
    }
    setGraficoMeses(mesesData);

  }, [tipoFiltro, mesSelecionado, diaSelecionado, todosOrcamentosBrutos]);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr);
    data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
    return new Intl.DateTimeFormat('pt-BR').format(data);
  };

  const exportarCSVAgrupado = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("orcamentos")
        .select(`
          numero_orcamento, data_emissao, valor_total, status,
          endereco_obra, user_id,
          clientes ( nome_razao_social ),
          vendedores ( nome )
        `)
        .order("status")
        .order("numero_orcamento", { ascending: false });

      const funcao = ""; // TODO: get from perfil if needed
      // Vendedor: apenas os seus
      // Admin e financeiro: todos

      const { data: orcamentos, error } = await query;

      if (error) throw error;

      // Agrupar por status
      const grupos: Record<string, typeof orcamentos> = {
        Aprovado: [],
        Aberto: [],
        Recusado: [],
        Rascunho: [],
      };

      (orcamentos || []).forEach(orc => {
        const status = orc.status || "Rascunho";
        if (!grupos[status]) grupos[status] = [];
        grupos[status].push(orc);
      });

      // Monta CSV com separação por status
      const bom = "\ufeff";
      const linhaVazia = "\n";
      let csv = bom;

      for (const [status, lista] of Object.entries(grupos)) {
        if (!lista || lista.length === 0) continue;

        csv += `## ${status.toUpperCase()} (${lista.length} orçamento(s));;;;;;;\n`;
        csv += "Nº Orçamento;Data Emissão;Cliente;Valor Total;Status;Endereço Obra;Vendedor\n";

        lista.forEach(orc => {
          const nomeCliente = Array.isArray(orc.clientes)
            ? orc.clientes[0]?.nome_razao_social
            : (orc.clientes as { nome_razao_social: string })?.nome_razao_social || "";
          const nomeVendedor = Array.isArray(orc.vendedores)
            ? orc.vendedores[0]?.nome
            : (orc.vendedores as { nome: string })?.nome || "";
          const data = orc.data_emissao ? formatarData(orc.data_emissao) : "";
          const valor = Number(orc.valor_total).toFixed(2).replace(".", ",");
          csv += `${orc.numero_orcamento};${data};${nomeCliente};${valor};${orc.status};${orc.endereco_obra || ""};${nomeVendedor}\n`;
        });

        csv += linhaVazia;
      }

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio_orcamentos_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Erro ao exportar: " + (err as Error).message);
    }
  };

  const carregarDashboardVendedor = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Busca todos os orçamentos do vendedor com dados de cliente
      const { data: orcs } = await supabase
        .from("orcamentos")
        .select(`
          id, numero_orcamento, data_emissao, created_at, valor_total, status,
          clientes ( nome_razao_social ),
          vendedores ( nome )
        `)
        .eq("user_id", user.id)
        .order("numero_orcamento", { ascending: false });

      const lista = (orcs || []) as unknown as UltimoOrcamento[];

      // Busca o nome do vendedor para exibição
      const { data: meuVendedor } = await supabase
        .from("vendedores")
        .select("nome")
        .eq("user_id", user.id)
        .maybeSingle();

      if (meuVendedor?.nome) {
        setNomeExibicao(meuVendedor.nome);
      }

      // 2. Separa por status
      const abertos = lista.filter(o => o.status === "Aberto");
      const aprovados = lista.filter(o => o.status === "Aprovado");
      const rascunhos = lista.filter(o => o.status === "Rascunho");
      const recusados = lista.filter(o => o.status === "Recusado");

      setResumoVendedor({
        valorAberto: abertos.reduce((s, o) => s + Number(o.valor_total), 0),
        valorAprovado: aprovados.reduce((s, o) => s + Number(o.valor_total), 0),
        valorRecusado: recusados.reduce((s, o) => s + Number(o.valor_total), 0),
        qtdAberto: abertos.length,
        qtdAprovado: aprovados.length,
        qtdRascunho: rascunhos.length,
        qtdRecusado: recusados.length,
      });

      // 3. Orçamentos aguardando aprovação (Aberto) — últimos 5
      setOrcamentosAguardando(abertos.slice(0, 5));

      // 4. Orçamentos aprovados — últimos 5
      setOrcamentosAprovados(aprovados.slice(0, 5));

      // 4b. Orçamentos recusados e rascunhos
      setOrcamentosRecusados(recusados.slice(0, 5));
      setOrcamentosRascunhos(rascunhos.slice(0, 5));

      // 5. Busca OPs vinculadas aos orçamentos aprovados deste vendedor
      const idsAprovados = aprovados.map(o => o.id);
      if (idsAprovados.length > 0) {
        const { data: ops } = await supabase
          .from("ordens_producao")
          .select("id, numero_op, status, orcamento_id")
          .in("orcamento_id", idsAprovados)
          .order("numero_op", { ascending: false });

        if (ops) {
          const opsComCliente = ops.map(op => {
            const orc = aprovados.find(o => o.id === op.orcamento_id);
            const clienteObj = orc?.clientes;
            const nomeCliente = Array.isArray(clienteObj)
              ? clienteObj[0]?.nome_razao_social
              : clienteObj?.nome_razao_social;
            return {
              id: op.id,
              numero_op: op.numero_op,
              status: op.status,
              orcamento_id: op.orcamento_id,
              cliente_nome: nomeCliente || "—",
            };
          });
          setOpsVendedor(opsComCliente);
        }
      }

      // 6. Gráfico dos últimos 6 meses (orçamentos do vendedor)
      const agora = new Date();
      const mesesData: {mes: string, aprovados: number, abertos: number}[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const orcsMes = lista.filter(o => (o.data_emissao || o.created_at || '').slice(0, 7) === chave);
        mesesData.push({
          mes: label,
          aprovados: orcsMes.filter(o => o.status === 'Aprovado').length,
          abertos: orcsMes.filter(o => o.status === 'Aberto').length,
        });
      }
      setGraficoVendedor(mesesData);

    } catch (error) {
      console.error("Erro ao carregar dashboard vendedor:", error);
    }
  };

  const carregarDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let orcamentosQuery = supabase
        .from("orcamentos")
        .select(`id, numero_orcamento, data_emissao, created_at, valor_total, status, clientes ( nome_razao_social ), vendedores ( nome, email )`)
        .order("numero_orcamento", { ascending: false });

      if (!isAdmin && !isFinanceiro) {
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
  if (!isAdmin && !isFinanceiro) {
    const maxGrafico = Math.max(...graficoVendedor.map(m => m.aprovados + m.abertos), 1);

    // Labels de status de OP em português
    const statusOPLabel: Record<string, {label: string, cor: string}> = {
      em_producao:  { label: "Em Produção",  cor: "text-blue-400"  },
      concluida:    { label: "Concluída",    cor: "text-green-400" },
      cancelada:    { label: "Cancelada",    cor: "text-red-400"   },
    };

    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">

        {/* Saudação */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Olá, {nomeExibicao || "vendedor"}! 👋
          </h1>
          <p className="text-gray-500 mt-1">Aqui está um resumo do seu desempenho.</p>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Valor Aberto */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 text-white col-span-2 md:col-span-1">
            <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Em Aberto</p>
            <h3 className="text-2xl font-black">{formatarMoeda(resumoVendedor.valorAberto)}</h3>
            <p className="text-blue-200 text-xs mt-1">{resumoVendedor.qtdAberto} orçamento(s)</p>
          </div>

          {/* Valor Aprovado */}
          <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-5 text-white col-span-2 md:col-span-1">
            <p className="text-green-100 text-xs font-bold uppercase tracking-wider mb-1">Aprovado</p>
            <h3 className="text-2xl font-black">{formatarMoeda(resumoVendedor.valorAprovado)}</h3>
            <p className="text-green-200 text-xs mt-1">{resumoVendedor.qtdAprovado} orçamento(s)</p>
          </div>

          {/* Rascunhos */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-yellow-100">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Rascunhos</p>
            <h3 className="text-2xl font-black text-yellow-600">{resumoVendedor.qtdRascunho}</h3>
          </div>

          {/* Recusados */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-red-100">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Recusados</p>
            <h3 className="text-2xl font-black text-red-400">{resumoVendedor.qtdRecusado}</h3>
            {resumoVendedor.valorRecusado > 0 && (
              <p className="text-xs text-red-300 mt-1 font-medium">
                {formatarMoeda(resumoVendedor.valorRecusado)}
              </p>
            )}
          </div>
        </div>

        {/* Área central: Gráfico + Botão criar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Gráfico de atividade — últimos 6 meses */}
          <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📊</span>
              <div>
                <h2 className="font-bold text-gray-800 text-sm">Meus Orçamentos por Mês</h2>
                <p className="text-xs text-gray-400">Últimos 6 meses</p>
              </div>
            </div>
            <div className="flex items-end gap-2 h-28">
              {graficoVendedor.map((m, i) => {
                const totalMes = m.aprovados + m.abertos;
                const alturaPct = totalMes === 0 ? 0 : Math.round((totalMes / maxGrafico) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-gray-500">{totalMes > 0 ? totalMes : ""}</span>
                    <div className="w-full flex flex-col justify-end rounded-t-lg overflow-hidden bg-gray-100" style={{ height: "80px" }}>
                      <div
                        className="w-full bg-blue-500 rounded-t-lg transition-all duration-500"
                        style={{ height: `${alturaPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 text-center leading-tight">{m.mes}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500 inline-block"></span>Total de orçamentos</span>
            </div>
          </div>

          {/* Atalho rápido */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Novo Orçamento</h3>
              <p className="text-xs text-gray-400 mt-0.5">Crie um orçamento agora</p>
            </div>
            <Link
              href="/dashboard/orcamentos"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm"
            >
              Criar Agora
            </Link>
          </div>
        </div>

        {/* Abas de status do vendedor */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
          {[
            { key: "abertos", label: "Abertos", count: resumoVendedor.qtdAberto, cor: "text-blue-600" },
            { key: "aprovados", label: "Aprovados", count: resumoVendedor.qtdAprovado, cor: "text-green-600" },
            { key: "recusados", label: "Recusados", count: resumoVendedor.qtdRecusado, cor: "text-red-500" },
            { key: "rascunhos", label: "Rascunhos", count: resumoVendedor.qtdRascunho, cor: "text-yellow-600" },
          ].map(aba => (
            <button
              key={aba.key}
              onClick={() => setAbaVendedor(aba.key as typeof abaVendedor)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                abaVendedor === aba.key
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {aba.label}
              <span className={`ml-1.5 font-black ${aba.cor}`}>{aba.count}</span>
            </button>
          ))}
        </div>

        {/* Lista filtrada pela aba ativa */}
        {abaVendedor === "abertos" && orcamentosAguardando.length > 0 && (
          <div className="bg-orange-50/50 border-2 border-orange-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-orange-100 flex justify-between items-center bg-white/50">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 text-orange-600 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Aguardando Aprovação</h2>
                  <p className="text-xs text-gray-500">{orcamentosAguardando.length} orçamento(s) enviado(s)</p>
                </div>
              </div>
              <Link href="/dashboard/historico" className="text-xs font-bold text-orange-600 hover:underline">
                Ver todos →
              </Link>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {orcamentosAguardando.map(orc => {
                const clienteNome = Array.isArray(orc.clientes)
                  ? orc.clientes[0]?.nome_razao_social
                  : orc.clientes?.nome_razao_social;
                return (
                  <div key={orc.id} className="bg-white rounded-xl p-4 border border-orange-100 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-gray-400">#{String(orc.numero_orcamento).padStart(5, "0")}</p>
                        <p className="font-bold text-gray-800 text-sm mt-0.5 truncate max-w-[160px]">{clienteNome || "—"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{orc.data_emissao ? formatarData(orc.data_emissao) : ""}</p>
                      </div>
                      <p className="font-black text-orange-600 text-sm">{formatarMoeda(Number(orc.valor_total))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {abaVendedor === "aprovados" && orcamentosAprovados.length > 0 && (
          <div className="bg-green-50/50 border-2 border-green-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-green-100 flex justify-between items-center bg-white/50">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 text-green-600 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Aprovados</h2>
                  <p className="text-xs text-gray-500">{orcamentosAprovados.length} orçamento(s) aprovado(s)</p>
                </div>
              </div>
              <Link href="/dashboard/historico" className="text-xs font-bold text-green-600 hover:underline">
                Ver todos →
              </Link>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {orcamentosAprovados.map(orc => {
                const clienteNome = Array.isArray(orc.clientes)
                  ? orc.clientes[0]?.nome_razao_social
                  : orc.clientes?.nome_razao_social;
                return (
                  <div key={orc.id} className="bg-white rounded-xl p-4 border border-green-100 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-gray-400">#{String(orc.numero_orcamento).padStart(5, "0")}</p>
                        <p className="font-bold text-gray-800 text-sm mt-0.5 truncate max-w-[160px]">{clienteNome || "—"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{orc.data_emissao ? formatarData(orc.data_emissao) : ""}</p>
                      </div>
                      <p className="font-black text-green-600 text-sm">{formatarMoeda(Number(orc.valor_total))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {abaVendedor === "recusados" && orcamentosRecusados.length > 0 && (
          <div className="bg-red-50/50 border-2 border-red-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-red-100 flex justify-between items-center bg-white/50">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 text-red-600 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Recusados</h2>
                  <p className="text-xs text-gray-500">{orcamentosRecusados.length} orçamento(s) recusado(s)</p>
                </div>
              </div>
              <Link href="/dashboard/historico" className="text-xs font-bold text-red-600 hover:underline">
                Ver todos →
              </Link>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {orcamentosRecusados.map(orc => {
                const clienteNome = Array.isArray(orc.clientes)
                  ? orc.clientes[0]?.nome_razao_social
                  : orc.clientes?.nome_razao_social;
                return (
                  <div key={orc.id} className="bg-white rounded-xl p-4 border border-red-100 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-gray-400">#{String(orc.numero_orcamento).padStart(5, "0")}</p>
                        <p className="font-bold text-gray-800 text-sm mt-0.5 truncate max-w-[160px]">{clienteNome || "—"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{orc.data_emissao ? formatarData(orc.data_emissao) : ""}</p>
                      </div>
                      <p className="font-black text-red-500 text-sm">{formatarMoeda(Number(orc.valor_total))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {abaVendedor === "rascunhos" && orcamentosRascunhos.length > 0 && (
          <div className="bg-yellow-50/50 border-2 border-yellow-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-yellow-100 flex justify-between items-center bg-white/50">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 text-yellow-600 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Rascunhos</h2>
                  <p className="text-xs text-gray-500">{orcamentosRascunhos.length} orçamento(s) em rascunho</p>
                </div>
              </div>
              <Link href="/dashboard/historico" className="text-xs font-bold text-yellow-600 hover:underline">
                Ver todos →
              </Link>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {orcamentosRascunhos.map(orc => {
                const clienteNome = Array.isArray(orc.clientes)
                  ? orc.clientes[0]?.nome_razao_social
                  : orc.clientes?.nome_razao_social;
                return (
                  <div key={orc.id} className="bg-white rounded-xl p-4 border border-yellow-100 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-gray-400">#{String(orc.numero_orcamento).padStart(5, "0")}</p>
                        <p className="font-bold text-gray-800 text-sm mt-0.5 truncate max-w-[160px]">{clienteNome || "—"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{orc.data_emissao ? formatarData(orc.data_emissao) : ""}</p>
                      </div>
                      <p className="font-black text-yellow-600 text-sm">{formatarMoeda(Number(orc.valor_total))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {abaVendedor === "abertos" && orcamentosAguardando.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">Nenhum orçamento aberto</div>
        )}
        {abaVendedor === "aprovados" && orcamentosAprovados.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">Nenhum orçamento aprovado</div>
        )}
        {abaVendedor === "recusados" && orcamentosRecusados.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">Nenhum orçamento recusado</div>
        )}
        {abaVendedor === "rascunhos" && orcamentosRascunhos.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">Nenhum orçamento em rascunho</div>
        )}

        {/* OPs em andamento geradas a partir dos meus orçamentos */}
        {opsVendedor.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 text-purple-600 p-2 rounded-xl">
                  <span className="text-lg">🏭</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Minhas OPs em Produção</h2>
                  <p className="text-xs text-gray-500">Ordens geradas a partir dos seus orçamentos aprovados</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {opsVendedor.slice(0, 8).map(op => {
                const st = statusOPLabel[op.status] || { label: op.status, cor: "text-gray-400" };
                return (
                  <div key={op.id} className="px-5 py-3.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">
                        OP #{String(op.numero_op).padStart(4, "0")}
                        <span className="font-normal text-gray-400 ml-2">— {op.cliente_nome}</span>
                      </p>
                    </div>
                    <span className={`text-xs font-bold ${st.cor}`}>{st.label}</span>
                  </div>
                );
              })}
            </div>
            {opsVendedor.length > 8 && (
              <div className="p-4 text-center text-xs text-gray-400">
                +{opsVendedor.length - 8} OPs não exibidas
              </div>
            )}
          </div>
        )}

        {/* Histórico recente dos aprovados */}
        {orcamentosAprovados.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-lg">✅</span>
                <h2 className="text-base font-bold text-gray-900">Orçamentos Aprovados</h2>
              </div>
              <Link href="/dashboard/historico" className="text-xs font-bold text-blue-600 hover:underline">
                Ver todos →
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {orcamentosAprovados.map(orc => {
                const clienteNome = Array.isArray(orc.clientes)
                  ? orc.clientes[0]?.nome_razao_social
                  : orc.clientes?.nome_razao_social;
                return (
                  <div key={orc.id} className="px-5 py-3.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">#{String(orc.numero_orcamento).padStart(5, "0")} — {clienteNome || "—"}</p>
                      <p className="text-xs text-gray-400">{orc.data_emissao ? formatarData(orc.data_emissao) : ""}</p>
                    </div>
                    <p className="font-black text-green-600 text-sm">{formatarMoeda(Number(orc.valor_total))}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Visão Geral da Empresa</h1>
          <p className="text-gray-500 mt-1">Acompanhe o desempenho de todos os vendedores.</p>
        </div>
        <button
          onClick={exportarCSVAgrupado}
          disabled={loading || ultimosOrcamentos.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait flex items-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          Exportar CSV
        </button>
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
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mt-4">

        {/* Card 1: Em Aberto */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 shadow-md text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-blue-500/30 p-3 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
          </div>
          <div>
            <p className="text-blue-100 text-sm font-medium mb-1">Em Aberto</p>
            <h3 className="text-2xl md:text-3xl font-black">{formatarMoeda(resumo.valorAbertos)}</h3>
            <p className="text-blue-200 text-xs mt-1">{resumo.totalAbertos} orçamento(s)</p>
          </div>
        </div>

        {/* Card 2: Aprovados */}
        <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-6 shadow-md text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-green-500/30 p-3 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
          <div>
            <p className="text-green-100 text-sm font-medium mb-1">Aprovados</p>
            <h3 className="text-2xl md:text-3xl font-black">{formatarMoeda(resumo.valorAprovados)}</h3>
            <p className="text-green-200 text-xs mt-1">{resumo.totalAprovados} orçamento(s)</p>
          </div>
        </div>

        {/* Card 3: Rascunhos */}
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
                      Vend: {Array.isArray(orc.vendedores) ? orc.vendedores[0]?.nome : orc.vendedores?.nome || "Admin"}
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

      {/* 📊 GRÁFICO DE ORÇAMENTOS POR MÊS (CSS puro, sem bibliotecas) */}
      {graficoMeses.length > 0 && graficoMeses.some(m => m.qtd > 0) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-8">
          <div className="p-5 border-b border-gray-50 flex items-center gap-3">
            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">Orçamentos por Mês</h3>
              <p className="text-xs text-gray-500">Últimos 6 meses</p>
            </div>
          </div>
          <div className="p-5">
            {(() => {
              const maxQtd = Math.max(...graficoMeses.map(m => m.qtd), 1);
              return (
                <div className="flex items-end justify-around gap-2 h-40">
                  {graficoMeses.map((m, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <span className="text-xs font-bold text-gray-700">{m.qtd}</span>
                      <div className="w-full flex flex-col-reverse rounded-t-lg overflow-hidden" style={{ height: `${Math.max((m.qtd / maxQtd) * 112, m.qtd > 0 ? 8 : 0)}px` }}>
                        <div className="bg-indigo-500 w-full" style={{ height: `${m.aprovados > 0 ? (m.aprovados / m.qtd) * 100 : 0}%`, minHeight: m.aprovados > 0 ? '4px' : '0' }} title={`${m.aprovados} aprovado(s)`} />
                        <div className="bg-indigo-200 w-full flex-1" title={`${m.qtd - m.aprovados} outro(s)`} />
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium capitalize">{m.mes}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-50 justify-center">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-indigo-500"></div><span className="text-xs text-gray-500">Aprovados</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-indigo-200"></div><span className="text-xs text-gray-500">Outros status</span></div>
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
            {!isFinanceiro && (
              <Link href="/dashboard/orcamentos" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-sm">
                Criar Novo Orçamento
              </Link>
            )}
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