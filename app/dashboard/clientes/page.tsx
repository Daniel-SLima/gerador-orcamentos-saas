"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { AlertModal, ConfirmModal, useAlert, useConfirm } from "../../components/AlertModal";
import { useToast } from "../../components/Toast";

interface Cliente {
  id: string;
  nome_razao_social: string;
  cpf_cnpj: string;
  contato_nome: string;
  telefone: string;
  email?: string;
  endereco: string;
  cep?: string;
  uf: string;
  cidade: string;
  bairro: string;
  rua_numero: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
}

interface EstadoIBGE {
  sigla: string;
  nome: string;
}

interface CidadeIBGE {
  id: number;
  nome: string;
}

const aplicarMascaraTelefone = (valor: string) => {
  if (!valor) return "";
  let v = valor.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
  v = v.replace(/(\d)(\d{4})$/, '$1-$2');
  return v;
};

// ─── Validadores de CPF e CNPJ ──────────────────────────────────────────────

const validarCPF = (cpf: string): boolean => {
  const cpfLimpo = cpf.replace(/\D/g, '');
  if (cpfLimpo.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpfLimpo)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpfLimpo[i]) * (10 - i);
  let resto = soma % 11;
  if (resto < 2) resto = 0;
  else resto = 11 - resto;
  if (parseInt(cpfLimpo[9]) !== resto) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpfLimpo[i]) * (11 - i);
  resto = soma % 11;
  if (resto < 2) resto = 0;
  else resto = 11 - resto;
  if (parseInt(cpfLimpo[10]) !== resto) return false;

  return true;
};

const validarCNPJ = (cnpj: string): boolean => {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  if (cnpjLimpo.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpjLimpo)) return false;

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let soma = 0;
  for (let i = 0; i < 12; i++) soma += parseInt(cnpjLimpo[i]) * pesos1[i];
  let resto = soma % 11;
  resto = resto < 2 ? 0 : 11 - resto;
  if (parseInt(cnpjLimpo[12]) !== resto) return false;

  soma = 0;
  for (let i = 0; i < 13; i++) soma += parseInt(cnpjLimpo[i]) * pesos2[i];
  resto = soma % 11;
  resto = resto < 2 ? 0 : 11 - resto;
  if (parseInt(cnpjLimpo[13]) !== resto) return false;

  return true;
};

const validarDocumento = (doc: string): { valido: boolean; tipo: string } => {
  const limpo = doc.replace(/\D/g, '');
  if (!limpo) return { valido: false, tipo: "" };
  if (limpo.length === 11) return { valido: validarCPF(doc), tipo: "CPF" };
  if (limpo.length === 14) return { valido: validarCNPJ(doc), tipo: "CNPJ" };
  return { valido: false, tipo: limpo.length < 11 ? "CPF" : "CNPJ" };
};

const validarTelefone = (telefone: string): boolean => {
  const telLimpo = telefone.replace(/\D/g, '');
  return telLimpo.length >= 10 && telLimpo.length <= 11;
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clienteEditandoId, setClienteEditandoId] = useState<string | null>(null);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const { showAlert, alertProps } = useAlert();
  const { showConfirm, confirmProps } = useConfirm();
  const { showToast } = useToast();

  const [nomeRazaoSocial, setNomeRazaoSocial] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [emailCliente, setEmailCliente] = useState("");
  
  // 🚀 NOVOS CAMPOS DE ENDEREÇO
  const [cep, setCep] = useState("");
  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");

  // 🚀 NOVOS CAMPOS IE/IM
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");

  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [termoBusca, setTermoBusca] = useState("");
  
  // PAGINAÇÃO E BUSCA REMOTA
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(true);
  const ITENS_POR_PAGINA = 20;
  const [buscando, setBuscando] = useState(false);

  // ESTADOS DA API DO IBGE
  const [estados, setEstados] = useState<EstadoIBGE[]>([]);
  const [cidadesList, setCidadesList] = useState<CidadeIBGE[]>([]);
  const [carregandoCidades, setCarregandoCidades] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Debounce para busca remota (busca no Supabase ao invés de filtrar na memória)
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagina(0); // Sempre que busca mudar, reseta a paginação
      carregarClientes(0, termoBusca);
    }, 500); // aguarda meio segundo após parar de digitar
    
    return () => clearTimeout(timer);
  }, [termoBusca]);

  useEffect(() => {
    carregarEstados();
  }, []);

  const carregarEstados = async () => {
    try {
      const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome");
      const data = await res.json();
      setEstados(data);
    } catch (error) {
      console.error("Erro ao carregar estados:", error);
    }
  };

  useEffect(() => {
    if (uf) {
      setCarregandoCidades(true);
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
        .then(res => res.json())
        .then(data => {
          setCidadesList(data);
          setCarregandoCidades(false);
        })
        .catch(() => setCarregandoCidades(false));
    } else {
      setCidadesList([]);
    }
  }, [uf]);

  // 🚀 FUNÇÃO PARA BUSCAR O CEP E PREENCHER OS DADOS AUTOMATICAMENTE
  const buscarCep = async (cepDigitado: string) => {
    const cepLimpo = cepDigitado.replace(/\D/g, '');
    setCep(cepLimpo);

    if (cepLimpo.length !== 8) return;

    setBuscandoCep(true);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (data.erro) {
        showToast("CEP não encontrado.", "error");
        return;
      }

      setUf(data.uf);
      setBairro(data.bairro);
      setRua(data.logradouro || ""); 
      setNumero("");
      
      setTimeout(() => {
        setCidade(data.localidade);
      }, 500);

    } catch (error) {
      showToast("Erro ao buscar CEP.", "error");
    } finally {
      setBuscandoCep(false);
    }
  };

  const carregarClientes = async (page = pagina, busca = termoBusca) => {
    if (page === 0) setLoading(true);
    else setBuscando(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase.from("clientes").select("*", { count: 'exact' });

      if (busca.trim()) {
        const t = busca.trim();
        query = query.or(`nome_razao_social.ilike.%${t}%,cpf_cnpj.ilike.%${t}%,contato_nome.ilike.%${t}%,telefone.ilike.%${t}%`);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(page * ITENS_POR_PAGINA, (page + 1) * ITENS_POR_PAGINA - 1);

      if (error) throw error;
      
      if (data) {
        if (page === 0) {
          setClientes(data);
        } else {
          setClientes(prev => [...prev, ...data]);
        }
        
        // Verifica se ainda tem mais itens para carregar
        if (count !== null) {
          setTemMais((page + 1) * ITENS_POR_PAGINA < count);
        } else {
          setTemMais(data.length === ITENS_POR_PAGINA);
        }
      }
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
      setBuscando(false);
    }
  };

  const carregarMais = () => {
    const novaPagina = pagina + 1;
    setPagina(novaPagina);
    carregarClientes(novaPagina, termoBusca);
  };

  const salvarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // ─── Validações antes de salvar ───
    const docValidacao = validarDocumento(cpfCnpj);
    if (cpfCnpj && cpfCnpj.replace(/\D/g, '').length > 0 && !docValidacao.valido) {
      showToast(`${docValidacao.tipo} inválido. Verifique os dígitos verificadores.`, "error");
      setSaving(false);
      return;
    }
    if (telefone && !validarTelefone(telefone)) {
      showToast("Telefone inválido. Digite pelo menos 10 dígitos (com DDD).", "error");
      setSaving(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      const ruaNumeroCombinado = numero.trim() ? `${rua.trim()}, ${numero.trim()}` : rua.trim();
      const enderecoConcatenado = `${ruaNumeroCombinado}, ${bairro} - ${cidade}/${uf}`;

      const dadosParaSalvar = {
        nome_razao_social: nomeRazaoSocial,
        cpf_cnpj: cpfCnpj,
        contato_nome: contatoNome,
        telefone: telefone,
        email: emailCliente.trim() || null,
        cep: cep,
        uf: uf,
        cidade: cidade,
        bairro: bairro,
        rua_numero: ruaNumeroCombinado,
        endereco: enderecoConcatenado,
        user_id: user.id,
        // 🚀 NOVOS CAMPOS IE/IM
        inscricao_estadual: inscricaoEstadual.trim() || null,
        inscricao_municipal: inscricaoMunicipal.trim() || null,
      };

      if (clienteEditandoId) {
        const { error } = await supabase.from("clientes").update(dadosParaSalvar).eq("id", clienteEditandoId);
        if (error) throw error;
        showToast("Cliente atualizado com sucesso!", "success");
      } else {
        const { error } = await supabase.from("clientes").insert([dadosParaSalvar]);
        if (error) throw error;
        showToast("Cliente cadastrado com sucesso!", "success");
      }
      
      limparFormulario();
      setPagina(0);
      carregarClientes(0, termoBusca);
    } catch (error) {
      showToast("Erro ao salvar: " + (error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const iniciarEdicao = (cliente: Cliente) => {
    setClienteEditandoId(cliente.id);
    setNomeRazaoSocial(cliente.nome_razao_social || "");
    setCpfCnpj(cliente.cpf_cnpj || "");
    setContatoNome(cliente.contato_nome || "");
    setTelefone(aplicarMascaraTelefone(cliente.telefone || ""));
    setEmailCliente(cliente.email || "");
    setCep(cliente.cep || "");
    setUf(cliente.uf || "");
    setCidade(cliente.cidade || "");
    setBairro(cliente.bairro || "");
    
    // Divide "Rua, Número" nos campos visuais da interface
    const rNum = cliente.rua_numero || "";
    const pRua = rNum.split(",");
    setRua(pRua[0]?.trim() || "");
    setNumero(pRua.slice(1).join(",").trim() || "");

    // 🚀 NOVOS CAMPOS IE/IM
    setInscricaoEstadual(cliente.inscricao_estadual || "");
    setInscricaoMunicipal(cliente.inscricao_municipal || "");

    setMenuAbertoId(null);
    setFormularioAberto(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const limparFormulario = () => {
    setClienteEditandoId(null);
    setNomeRazaoSocial("");
    setCpfCnpj("");
    setContatoNome("");
    setTelefone("");
    setEmailCliente("");
    setCep("");
    setUf("");
    setCidade("");
    setBairro("");
    setRua("");
    setNumero("");
    // 🚀 NOVOS CAMPOS IE/IM
    setInscricaoEstadual("");
    setInscricaoMunicipal("");
    setFormularioAberto(false); // fecha ao cancelar
  };

  const deletarCliente = async (id: string) => {
    const confirmado = await showConfirm("Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.", {
      type: "error",
      title: "Excluir Cliente",
      confirmLabel: "Sim, excluir",
      cancelLabel: "Cancelar",
    });
    if (!confirmado) return;
    try {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
      setClientes(clientes.filter(cliente => cliente.id !== id));
      if (clienteEditandoId === id) limparFormulario();
      setMenuAbertoId(null);
    } catch (error) {
      showAlert("Erro ao excluir cliente: " + (error as Error).message, { type: "error", title: "Erro" });
    }
  };

  const toggleMenu = (id: string) => {
    if (menuAbertoId === id) setMenuAbertoId(null);
    else setMenuAbertoId(id);
  };

  // Removido o filtro local pois agora é do lado do servidor (Supabase)
  const clientesFiltrados = clientes;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto" onClick={() => menuAbertoId && setMenuAbertoId(null)}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Meus Clientes</h1>

      {/* FORMULÁRIO RECOLHÍVEL */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
        {/* Cabeçalho clicável */}
        <button
          type="button"
          onClick={() => setFormularioAberto(!formularioAberto)}
          className="w-full flex justify-between items-center p-4 md:p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${clienteEditandoId ? 'bg-amber-100' : 'bg-blue-50'}`}>
              <svg className={`w-5 h-5 ${clienteEditandoId ? 'text-amber-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </div>
            <div className="text-left">
              <h2 className="text-base font-semibold text-gray-800 leading-tight">
                {clienteEditandoId ? "✏️ Editando Cliente" : "Novo Cliente"}
              </h2>
              {!formularioAberto && !clienteEditandoId && (
                <p className="text-xs text-gray-400 mt-0.5">Clique para expandir o formulário</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {clienteEditandoId && (
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

        <form onSubmit={salvarCliente} className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-12 lg:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente (Nome / Razão Social) *</label>
            <input type="text" required value={nomeRazaoSocial} onChange={(e) => setNomeRazaoSocial(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" placeholder="Ex: Posto Sorriso" />
          </div>
          <div className="md:col-span-6 lg:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contato</label>
            <input type="text" value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" placeholder="Ex: Wellington" />
          </div>
          <div className="md:col-span-6 lg:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone</label>
            <input type="text" value={telefone} onChange={(e) => setTelefone(aplicarMascaraTelefone(e.target.value))} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" placeholder="(00) 00000-0000" />
          </div>
          
          <div className="md:col-span-6 lg:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
            <input type="email" value={emailCliente} onChange={(e) => setEmailCliente(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" placeholder="contato@empresa.com.br" />
          </div>
          <div className="md:col-span-12 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">CNPJ / CPF</label>
            <input type="text" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" placeholder="00.000.000/0000-00" />
          </div>

          {/* 🚀 CAIXA DE CEP (ACIONAL) */}
          <div className="md:col-span-12 lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              CEP {buscandoCep && <span className="text-blue-500 text-xs ml-1">(Buscando...)</span>}
            </label>
            <input 
              type="text" 
              maxLength={9}
              value={cep} 
              onChange={(e) => buscarCep(e.target.value)} 
              className="w-full px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all text-blue-900 font-medium" 
              placeholder="00000-000"
            />
          </div>

          {/* 🚀 NOVOS CAMPOS: Inscrição Estadual e Municipal */}
          <div className="md:col-span-12 lg:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Inscrição Estadual (IE)
              <span className="ml-1.5 text-xs font-normal text-gray-400">— opcional</span>
            </label>
            <input
              type="text"
              value={inscricaoEstadual}
              onChange={(e) => setInscricaoEstadual(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
              placeholder="Ex: 123.456.789.000"
            />
          </div>

          <div className="md:col-span-12 lg:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Inscrição Municipal (IM)
              <span className="ml-1.5 text-xs font-normal text-gray-400">— opcional</span>
            </label>
            <input
              type="text"
              value={inscricaoMunicipal}
              onChange={(e) => setInscricaoMunicipal(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
              placeholder="Ex: 00123456/001-45"
            />
          </div>

          <div className="md:col-span-12 lg:col-span-7 grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
              <select value={uf} onChange={(e) => setUf(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all">
                <option value="">UF</option>
                {estados.map((est: EstadoIBGE) => <option key={est.sigla} value={est.sigla}>{est.sigla}</option>)}
              </select>
            </div>
            <div className="md:col-span-9">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cidade</label>
              <select value={cidade} onChange={(e) => setCidade(e.target.value)} disabled={!uf || carregandoCidades} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all disabled:bg-gray-100">
                <option value="">{carregandoCidades ? "Carregando..." : "Selecione a cidade"}</option>
                {cidadesList.map((cid: CidadeIBGE) => <option key={cid.id} value={cid.nome}>{cid.nome}</option>)}
              </select>
            </div>
          </div>
          
          <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-5 mt-[-10px]">
            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bairro</label>
              <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" placeholder="Centro" />
            </div>
            <div className="md:col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Logradouro / Rua</label>
              <input type="text" value={rua} onChange={(e) => setRua(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" placeholder="Ex: Rua das Flores" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Número</label>
              <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" placeholder="Ex: 123" />
            </div>
          </div>

          <div className="md:col-span-12 flex justify-end mt-2">
            <button type="submit" disabled={saving} className={`w-full sm:w-auto px-8 py-3 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 ${clienteEditandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {saving ? "Salvando..." : (clienteEditandoId ? "Atualizar Cliente" : "Adicionar Cliente")}
            </button>
          </div>
        </form>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input type="text" placeholder="Buscar por nome, contato, CPF/CNPJ ou telefone..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 transition-all" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando clientes...</div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum cliente encontrado.</div>
        ) : (
          <div className="pb-16 md:pb-0">
            <div className="block md:hidden divide-y divide-gray-100">
              {clientesFiltrados.map((cliente) => (
                <div key={cliente.id} className="p-4 hover:bg-gray-50 transition-colors relative">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900 pr-8 break-all min-w-0 flex-1">{cliente.nome_razao_social}</h3>
                    <button onClick={(e) => { e.stopPropagation(); toggleMenu(cliente.id); }} className="p-1 -mr-2 -mt-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                    </button>
                    {menuAbertoId === cliente.id && (
                      <div className="absolute right-4 top-10 w-36 bg-white border border-gray-100 rounded-xl shadow-xl z-50 flex flex-col py-1 animate-fade-in">
                        <button onClick={(e) => { e.stopPropagation(); iniciarEdicao(cliente); }} className="px-4 py-2 text-sm text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Editar</button>
                        <div className="h-px bg-gray-100 my-1 mx-2"></div>
                        <button onClick={(e) => { e.stopPropagation(); deletarCliente(cliente.id); }} className="px-4 py-2 text-sm text-left font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Excluir</button>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    {cliente.contato_nome && <p><span className="font-medium text-gray-500">Contato:</span> {cliente.contato_nome}</p>}
                    {cliente.telefone && <p><span className="font-medium text-gray-500">Tel:</span> {cliente.telefone}</p>}
                    {cliente.email && <p><span className="font-medium text-gray-500">E-mail:</span> {cliente.email}</p>}
                    {cliente.cpf_cnpj && <p><span className="font-medium text-gray-500">Doc:</span> {cliente.cpf_cnpj}</p>}
                    {cliente.endereco && <p className="truncate"><span className="font-medium text-gray-500">End:</span> {cliente.endereco}</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto pb-24">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-4 text-sm font-semibold text-gray-600">Cliente</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Contato</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Telefone</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">E-mail</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">CNPJ/CPF</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Endereço</th>
                    <th className="p-4 text-sm font-semibold text-gray-600 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {clientesFiltrados.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-gray-900 font-medium">{cliente.nome_razao_social}</td>
                      <td className="p-4 text-gray-600">{cliente.contato_nome || "-"}</td>
                      <td className="p-4 text-gray-600">{cliente.telefone || "-"}</td>
                      <td className="p-4 text-gray-600">{cliente.email || "-"}</td>
                      <td className="p-4 text-gray-600">{cliente.cpf_cnpj || "-"}</td>
                      <td className="p-4 text-gray-600 truncate max-w-[250px]" title={cliente.endereco}>{cliente.endereco || "-"}</td>
                      <td className="p-4 text-center relative">
                        <button onClick={(e) => { e.stopPropagation(); toggleMenu(cliente.id); }} className="p-2 mx-auto text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none flex justify-center"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg></button>
                        {menuAbertoId === cliente.id && (
                          <div className="absolute right-8 top-10 w-36 bg-white border border-gray-100 rounded-xl shadow-xl z-50 flex flex-col py-1 animate-fade-in">
                            <button onClick={(e) => { e.stopPropagation(); iniciarEdicao(cliente); }} className="px-4 py-2 text-sm text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Editar</button>
                            <div className="h-px bg-gray-100 my-1 mx-2"></div>
                            <button onClick={(e) => { e.stopPropagation(); deletarCliente(cliente.id); }} className="px-4 py-2 text-sm text-left font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Excluir</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* BOTÃO CARREGAR MAIS (Abaixo de ambas as visualizações) */}
            {temMais && (
              <div className="p-6 flex justify-center border-t border-gray-100">
                <button 
                  onClick={carregarMais} 
                  disabled={buscando}
                  className="px-6 py-2.5 bg-white border border-gray-200 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
                >
                  {buscando ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Carregando...
                    </>
                  ) : "Carregar Mais Clientes"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Modais customizados */}
      <AlertModal {...alertProps} />
      <ConfirmModal {...confirmProps} />
    </div>
  );
}