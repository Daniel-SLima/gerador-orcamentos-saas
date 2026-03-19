"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { usePerfilUsuario } from "../../hooks/usePerfilUsuario";

interface Orcamento {
  id: string;
  numero_orcamento: number;
  data_emissao: string;
  valor_total: number;
  status: string;
  clientes: {
    nome_razao_social: string;
  };
  vendedores?: {
    nome: string;
  };
}

// 🚀 NOVA INTERFACE PARA ACABAR COM O ERRO DO 'ANY'
interface Anexo {
  id: string;
  file_name: string;
  file_url: string;
}

const aplicarMascaraTelefone = (valor: string) => {
  if (!valor) return "";
  let v = valor.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
  v = v.replace(/(\d)(\d{4})$/, '$1-$2');
  return v;
};

export default function HistoricoOrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const router = useRouter();
  const { isAdmin, loadingPerfil } = usePerfilUsuario();

  const [termoBusca, setTermoBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos"); // 'todos', 'mes', 'dia'
  const [mesSelecionado, setMesSelecionado] = useState(new Date().toISOString().slice(0, 7));
  const [diaSelecionado, setDiaSelecionado] = useState(new Date().toISOString().slice(0, 10));

  // 🚀 ESTADOS DO MODAL DE ANEXOS
  const [modalAnexosAberto, setModalAnexosAberto] = useState(false);
  const [anexosAtuais, setAnexosAtuais] = useState<Anexo[]>([]);
  const [loadingAnexos, setLoadingAnexos] = useState(false);

  // 🚀 ESTADOS DO MODAL DE GERAR OP
  const [modalOpAberto, setModalOpAberto] = useState(false);
  const [orcamentoOpSelecionado, setOrcamentoOpSelecionado] = useState<string | null>(null);
  const [opEnderecoRua, setOpEnderecoRua] = useState("");
  const [opEnderecoNumero, setOpEnderecoNumero] = useState("");
  const [opEnderecoBairro, setOpEnderecoBairro] = useState("");
  const [opEnderecoCidade, setOpEnderecoCidade] = useState("");
  const [opContatoNome, setOpContatoNome] = useState("");
  const [opContatoTelefone, setOpContatoTelefone] = useState("");
  const [salvandoOp, setSalvandoOp] = useState(false);

  useEffect(() => {
    if (!loadingPerfil) {
      carregarOrcamentos();
    }
  }, [loadingPerfil]);

  const carregarOrcamentos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("orcamentos")
        .select(`
          id,
          numero_orcamento,
          data_emissao,
          valor_total,
          status,
          clientes ( nome_razao_social ),
          vendedores ( nome )
        `)
        .order("numero_orcamento", { ascending: false });

      if (!isAdmin) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

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

      let queryItens = supabase.from("itens_orcamento").delete().eq("orcamento_id", id);
      let queryOrc = supabase.from("orcamentos").delete().eq("id", id);

      if (!isAdmin) {
        queryItens = queryItens.eq("user_id", user.id);
        queryOrc = queryOrc.eq("user_id", user.id);
      }

      await queryItens;
      const { error } = await queryOrc;

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

  const editarOrcamento = (id: string) => {
    router.push(`/dashboard/orcamentos?edit=${id}`);
  };

  const clonarOrcamento = (id: string) => {
    router.push(`/dashboard/orcamentos?clone=${id}`);
  };

  const mudarStatus = async (id: string, novoStatus: string) => {
    try {
      const { error } = await supabase.from("orcamentos").update({ status: novoStatus }).eq("id", id);
      if (error) throw error;
      setOrcamentos(orcamentos.map(orc => orc.id === id ? { ...orc, status: novoStatus } : orc));
    } catch (error) {
      alert("Erro ao mudar status: " + (error as Error).message);
    }
  };

  const abrirModalGerarOP = (orc: Orcamento) => {
    setMenuAbertoId(null);
    setOrcamentoOpSelecionado(orc.id);
    setOpEnderecoRua("");
    setOpEnderecoNumero("");
    setOpEnderecoBairro("");
    setOpEnderecoCidade("");
    setOpContatoNome("");
    setOpContatoTelefone("");
    setModalOpAberto(true);
  };

  const confirmarGerarOP = async () => {
    if (!orcamentoOpSelecionado) return;
    setSalvandoOp(true);
    
    let enderecoCombinado = "";
    if (opEnderecoRua || opEnderecoBairro || opEnderecoCidade) {
      const partesEnd = [];
      if (opEnderecoRua) partesEnd.push(opEnderecoRua + (opEnderecoNumero ? `, ${opEnderecoNumero}` : ""));
      if (opEnderecoBairro) partesEnd.push(opEnderecoBairro);
      if (opEnderecoCidade) partesEnd.push(opEnderecoCidade);
      enderecoCombinado = partesEnd.join(" - ");
    }
    
    let contatoCombinado = "";
    if (opContatoNome || opContatoTelefone) {
      const partesCont = [];
      if (opContatoNome) partesCont.push(opContatoNome);
      if (opContatoTelefone) partesCont.push(opContatoTelefone);
      contatoCombinado = partesCont.join(" - ");
    }

    try {
      let queryUpdate = supabase.from("orcamentos").update({
        endereco_obra: enderecoCombinado,
        contato_obra: contatoCombinado
      }).eq("id", orcamentoOpSelecionado);

      if (!isAdmin) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          queryUpdate = queryUpdate.eq("user_id", user.id);
        }
      }

      const { error } = await queryUpdate;
      if (error) throw error;
      
      setModalOpAberto(false);
      window.open(`/imprimir/${orcamentoOpSelecionado}?action=op`, "_blank");
    } catch (error) {
      alert("Erro ao salvar detalhes da OP: " + (error as Error).message);
    } finally {
      setSalvandoOp(false);
    }
  };

  // 🚀 FUNÇÃO PARA ABRIR O MODAL E BUSCAR OS ANEXOS NO BANCO
  const verAnexos = async (orcamentoId: string) => {
    setMenuAbertoId(null);
    setModalAnexosAberto(true);
    setLoadingAnexos(true);
    setAnexosAtuais([]);

    const { data } = await supabase.from("orcamento_anexos").select("*").eq("orcamento_id", orcamentoId);
    if (data) setAnexosAtuais(data);
    setLoadingAnexos(false);
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

  const limparFiltros = () => {
    setTermoBusca("");
    setTipoFiltro("todos");
  };

  const orcamentosFiltrados = orcamentos.filter((orc) => {
    const termo = termoBusca.toLowerCase();
    const nomeCliente = (Array.isArray(orc.clientes) ? orc.clientes[0]?.nome_razao_social : orc.clientes?.nome_razao_social) || "";

    const bateBusca =
      String(orc.numero_orcamento).includes(termo) ||
      nomeCliente.toLowerCase().includes(termo) ||
      orc.status.toLowerCase().includes(termo);

    let bateData = true;
    const dataBase = orc.data_emissao.split('T')[0];

    if (tipoFiltro === "mes" && mesSelecionado) {
      bateData = dataBase.startsWith(mesSelecionado);
    } else if (tipoFiltro === "dia" && diaSelecionado) {
      bateData = dataBase === diaSelecionado;
    }

    return bateBusca && bateData;
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto" onClick={() => menuAbertoId && setMenuAbertoId(null)}>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Histórico de Orçamentos</h1>
        <p className="text-sm font-semibold text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
          Total listado: <span className="text-blue-600">{orcamentosFiltrados.length}</span>
        </p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 md:items-end">
        <div className="w-full md:flex-1">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Buscar</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input type="text" placeholder="Nº, Cliente ou Status..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 transition-all" />
          </div>
        </div>

        <div className="w-full md:w-48">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Período</label>
          <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 font-medium transition-all">
            <option value="todos">Todo o período</option>
            <option value="mes">Filtrar por Mês</option>
            <option value="dia">Filtrar por Dia</option>
          </select>
        </div>

        {tipoFiltro === "mes" && (
          <div className="w-full md:w-40 animate-fade-in">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Selecione o Mês</label>
            <input type="month" value={mesSelecionado} onChange={(e) => setMesSelecionado(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 transition-all" />
          </div>
        )}

        {tipoFiltro === "dia" && (
          <div className="w-full md:w-40 animate-fade-in">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Selecione o Dia</label>
            <input type="date" value={diaSelecionado} onChange={(e) => setDiaSelecionado(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 transition-all" />
          </div>
        )}

        {(termoBusca || tipoFiltro !== "todos") && (
          <button onClick={limparFiltros} className="w-full md:w-auto px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-lg transition-colors border border-red-100 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> Limpar
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible min-h-[400px]">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando histórico...</div>
        ) : orcamentosFiltrados.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <p className="text-gray-500 font-medium">Nenhum orçamento encontrado com estes filtros.</p>
          </div>
        ) : (
          <div className="pb-16 md:pb-0">

            <div className="block md:hidden divide-y divide-gray-100">
              {orcamentosFiltrados.map((orc) => (
                <div key={orc.id} className="p-4 hover:bg-gray-50 transition-colors relative">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">#{String(orc.numero_orcamento).padStart(5, '0')}</h3>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5">
                        {Array.isArray(orc.clientes) ? orc.clientes[0]?.nome_razao_social : orc.clientes?.nome_razao_social}
                      </p>
                      {isAdmin && (
                        <p className="text-[11px] text-gray-500 mt-1 uppercase font-bold tracking-wider">
                          Vendedor: {Array.isArray(orc.vendedores) ? orc.vendedores[0]?.nome : orc.vendedores?.nome || "Indefinido"}
                        </p>
                      )}
                    </div>

                    <button onClick={(e) => { e.stopPropagation(); toggleMenu(orc.id); }} className="p-1 -mr-2 text-gray-400 hover:text-blue-600 rounded-lg transition-colors focus:outline-none">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                    </button>

                    {menuAbertoId === orc.id && (
                      <div className="absolute right-4 top-10 w-44 bg-white border border-gray-100 rounded-xl shadow-xl z-50 flex flex-col py-2 animate-fade-in">
                        {orc.status === 'Aprovado' && (
                          <button onClick={(e) => { e.stopPropagation(); abrirModalGerarOP(orc); }} className="px-4 py-2.5 text-sm text-left font-bold text-green-700 hover:bg-green-50 flex items-center gap-2">
                            📄 Gerar O.P.
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); visualizarPDF(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg> Ver PDF
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); verAnexos(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-blue-600 hover:bg-blue-50 flex items-center gap-2">
                          📎 Ver Anexos
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); baixarPDF(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Baixar PDF
                        </button>
                        <div className="h-px bg-gray-100 my-1 mx-2"></div>
                        <button onClick={(e) => { e.stopPropagation(); editarOrcamento(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-blue-600 hover:bg-blue-50 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Editar
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); clonarOrcamento(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-purple-600 hover:bg-purple-50 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> Duplicar
                        </button>
                        <div className="h-px bg-gray-100 my-1 mx-2"></div>
                        <button onClick={(e) => { e.stopPropagation(); deletarOrcamento(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-red-600 hover:bg-red-50 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Excluir
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-end mt-4">
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-500 font-medium">Emitido em: {formatarData(orc.data_emissao)}</p>
                      <select
                        value={orc.status}
                        onChange={(e) => mudarStatus(orc.id, e.target.value)}
                        className={`inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border appearance-none outline-none cursor-pointer ${orc.status === 'Rascunho' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                            orc.status === 'Aberto' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              orc.status === 'Aprovado' ? 'bg-green-50 text-green-700 border-green-200' :
                                orc.status === 'Recusado' ? 'bg-red-50 text-red-700 border-red-200' :
                                  'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                      >
                        <option value="Rascunho">Rascunho</option>
                        <option value="Aberto">Aberto</option>
                        <option value="Aprovado" disabled={!isAdmin}>Aprovado</option>
                        <option value="Recusado">Recusado</option>
                      </select>
                    </div>
                    <p className="font-black text-green-600 text-lg">{formatarMoeda(orc.valor_total)}</p>
                  </div>
                </div>
              ))}
            </div>

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
                  {orcamentosFiltrados.map((orc) => (
                    <tr key={orc.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-gray-900 font-bold">#{String(orc.numero_orcamento).padStart(5, '0')}</td>
                      <td className="p-4 text-gray-600">{formatarData(orc.data_emissao)}</td>
                      <td className="p-4 text-gray-800 font-medium">
                        {Array.isArray(orc.clientes) ? orc.clientes[0]?.nome_razao_social : orc.clientes?.nome_razao_social}
                        {isAdmin && (
                          <div className="text-xs text-gray-500 font-normal mt-1 border-t border-gray-100 pt-1">
                            Vend: {Array.isArray(orc.vendedores) ? orc.vendedores[0]?.nome : orc.vendedores?.nome || "N/A"}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <select
                          value={orc.status}
                          onChange={(e) => mudarStatus(orc.id, e.target.value)}
                          className={`px-3 py-1 text-xs font-bold rounded-md border appearance-none outline-none cursor-pointer ${orc.status === 'Rascunho' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              orc.status === 'Aberto' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                orc.status === 'Aprovado' ? 'bg-green-50 text-green-700 border-green-200' :
                                  orc.status === 'Recusado' ? 'bg-red-50 text-red-700 border-red-200' :
                                    'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                        >
                          <option value="Rascunho">Rascunho</option>
                          <option value="Aberto">Aberto</option>
                          <option value="Aprovado" disabled={!isAdmin}>Aprovado</option>
                          <option value="Recusado">Recusado</option>
                        </select>
                      </td>
                      <td className="p-4 text-green-600 font-bold">{formatarMoeda(orc.valor_total)}</td>

                      <td className="p-4 text-center relative">
                        <button onClick={(e) => { e.stopPropagation(); toggleMenu(orc.id); }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center mx-auto gap-2">
                          Ações <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>

                        {menuAbertoId === orc.id && (
                          <div className="absolute right-12 top-14 w-44 bg-white border border-gray-100 rounded-xl shadow-xl z-50 flex flex-col py-2 animate-fade-in">
                            {orc.status === 'Aprovado' && (
                              <button onClick={(e) => { e.stopPropagation(); abrirModalGerarOP(orc); }} className="px-4 py-2.5 text-sm text-left font-bold text-green-700 hover:bg-green-50 flex items-center gap-2">
                                📄 Gerar O.P.
                              </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); visualizarPDF(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg> Ver PDF
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); verAnexos(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-blue-600 hover:bg-blue-50 flex items-center gap-2">
                              📎 Ver Anexos
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); baixarPDF(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Baixar PDF
                            </button>
                            <div className="h-px bg-gray-100 my-1 mx-2"></div>
                            <button onClick={(e) => { e.stopPropagation(); editarOrcamento(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-blue-600 hover:bg-blue-50 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Editar
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); clonarOrcamento(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-purple-600 hover:bg-purple-50 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> Duplicar
                            </button>
                            <div className="h-px bg-gray-100 my-1 mx-2"></div>
                            <button onClick={(e) => { e.stopPropagation(); deletarOrcamento(orc.id); }} className="px-4 py-2.5 text-sm text-left font-medium text-red-600 hover:bg-red-50 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Excluir
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

      {/* 🚀 MODAL DE VISUALIZAÇÃO DOS ANEXOS */}
      {modalAnexosAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900">Anexos do Orçamento</h3>
              <button onClick={() => setModalAnexosAberto(false)} className="text-gray-400 hover:text-red-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingAnexos ? (
                <p className="text-center text-gray-500 py-4">Buscando anexos...</p>
              ) : anexosAtuais.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 font-medium">Nenhum anexo encontrado.</p>
                  <p className="text-xs text-gray-400 mt-1">Lembrando que arquivos antigos são apagados automaticamente.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {anexosAtuais.map((anexo) => (
                    <li key={anexo.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <span className="text-sm font-medium text-gray-700 truncate mr-4" title={anexo.file_name}>{anexo.file_name}</span>
                      <a href={anexo.file_url} target="_blank" rel="noreferrer" className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors shadow-sm">
                        Abrir
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🚀 MODAL DE GERAR OP */}
      {modalOpAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900">Detalhes da Ordem de Produção</h3>
              <button disabled={salvandoOp} onClick={() => setModalOpAberto(false)} className="text-gray-400 hover:text-red-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <p className="text-sm text-gray-500 mb-2">Preencha os dados abaixo que aparecerão no PDF da OP. (Opcional)</p>
              
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider border-b border-amber-100 pb-1">Endereço da Obra</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Rua / Logradouro</label>
                    <input type="text" value={opEnderecoRua} onChange={e => setOpEnderecoRua(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm font-medium" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nº</label>
                    <input type="text" value={opEnderecoNumero} onChange={e => setOpEnderecoNumero(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm font-medium" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Bairro</label>
                    <input type="text" value={opEnderecoBairro} onChange={e => setOpEnderecoBairro(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm font-medium" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Cidade / UF</label>
                    <input type="text" value={opEnderecoCidade} onChange={e => setOpEnderecoCidade(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm font-medium" />
                  </div>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-blue-100 pb-1">Contato / Responsável</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nome</label>
                    <input type="text" value={opContatoNome} onChange={e => setOpContatoNome(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Telefone</label>
                    <input type="text" value={opContatoTelefone} onChange={e => setOpContatoTelefone(aplicarMascaraTelefone(e.target.value))} placeholder="(00) 00000-0000" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium" />
                  </div>
                </div>
              </div>

            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button disabled={salvandoOp} onClick={() => setModalOpAberto(false)} className="px-5 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
              <button disabled={salvandoOp} onClick={confirmarGerarOP} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors shadow-md flex items-center gap-2">
                {salvandoOp ? "Gerando..." : "Confirmar e Gerar O.P."}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}