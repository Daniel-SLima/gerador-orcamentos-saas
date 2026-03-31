"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { AlertModal, ConfirmModal, useAlert, useConfirm } from "../../components/AlertModal";

interface Cliente {
  id: string;
  nome_razao_social: string;
  cpf_cnpj: string;
  contato_nome: string;
  telefone: string;
  endereco: string;
  cep?: string; // 🚀 Adicionado CEP
  uf: string;
  cidade: string;
  bairro: string;
  rua_numero: string;
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

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clienteEditandoId, setClienteEditandoId] = useState<string | null>(null);
  const { showAlert, alertProps } = useAlert();
  const { showConfirm, confirmProps } = useConfirm();

  const [nomeRazaoSocial, setNomeRazaoSocial] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [telefone, setTelefone] = useState("");
  
  // 🚀 NOVOS CAMPOS DE ENDEREÇO
  const [cep, setCep] = useState("");
  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [ruaNumero, setRuaNumero] = useState("");
  
  const [message, setMessage] = useState("");
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [termoBusca, setTermoBusca] = useState("");

  // ESTADOS DA API DO IBGE
  const [estados, setEstados] = useState<EstadoIBGE[]>([]);
  const [cidadesList, setCidadesList] = useState<CidadeIBGE[]>([]);
  const [carregandoCidades, setCarregandoCidades] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  useEffect(() => {
    carregarClientes();
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

    if (cepLimpo.length !== 8) return; // Só busca quando tiver 8 números

    setBuscandoCep(true);
    setMessage("");

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (data.erro) {
        setMessage("❌ CEP não encontrado.");
        return;
      }

      setUf(data.uf);
      setBairro(data.bairro);
      
      // A rua já vem com o nome, basta o usuário colocar o número depois
      setRuaNumero(data.logradouro ? `${data.logradouro}, ` : ""); 
      
      // A cidade precisa de um pequeno "delay" porque depende do UF ser carregado pelo IBGE primeiro
      setTimeout(() => {
        setCidade(data.localidade);
      }, 500);

    } catch (error) {
      setMessage("❌ Erro ao buscar CEP.");
    } finally {
      setBuscandoCep(false);
    }
  };

  const carregarClientes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.from("clientes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      if (data) setClientes(data);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  };

  const salvarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      const enderecoConcatenado = `${ruaNumero}, ${bairro} - ${cidade}/${uf}`;

      const dadosParaSalvar = {
        nome_razao_social: nomeRazaoSocial, 
        cpf_cnpj: cpfCnpj, 
        contato_nome: contatoNome, 
        telefone: telefone,
        cep: cep, // Salvando o CEP no banco
        uf: uf,
        cidade: cidade,
        bairro: bairro,
        rua_numero: ruaNumero,
        endereco: enderecoConcatenado, 
        user_id: user.id 
      };

      if (clienteEditandoId) {
        const { error } = await supabase.from("clientes").update(dadosParaSalvar).eq("id", clienteEditandoId);
        if (error) throw error;
        setMessage("✅ Cliente atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("clientes").insert([dadosParaSalvar]);
        if (error) throw error;
        setMessage("✅ Cliente cadastrado com sucesso!");
      }
      
      limparFormulario();
      carregarClientes();
    } catch (error) {
      setMessage("❌ Erro ao salvar: " + (error as Error).message);
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
    setCep(cliente.cep || "");
    setUf(cliente.uf || "");
    setCidade(cliente.cidade || "");
    setBairro(cliente.bairro || "");
    setRuaNumero(cliente.rua_numero || "");
    setMessage("");
    setMenuAbertoId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const limparFormulario = () => {
    setClienteEditandoId(null);
    setNomeRazaoSocial("");
    setCpfCnpj("");
    setContatoNome("");
    setTelefone("");
    setCep("");
    setUf("");
    setCidade("");
    setBairro("");
    setRuaNumero("");
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

  const clientesFiltrados = clientes.filter((cliente) => {
    const busca = termoBusca.toLowerCase();
    return (
      cliente.nome_razao_social?.toLowerCase().includes(busca) ||
      cliente.cpf_cnpj?.toLowerCase().includes(busca) ||
      cliente.contato_nome?.toLowerCase().includes(busca) ||
      cliente.telefone?.toLowerCase().includes(busca)
    );
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto" onClick={() => menuAbertoId && setMenuAbertoId(null)}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Meus Clientes</h1>
      
      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {clienteEditandoId ? "✏️ Editando Cliente" : "Novo Cliente"}
          </h2>
          {clienteEditandoId && (
            <button onClick={limparFormulario} className="text-sm font-medium text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-md transition-colors">
              Cancelar edição
            </button>
          )}
        </div>

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
            <div className="md:col-span-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bairro</label>
              <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" placeholder="Centro" />
            </div>
            <div className="md:col-span-7">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Rua e Número</label>
              <input type="text" value={ruaNumero} onChange={(e) => setRuaNumero(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" placeholder="Rua das Flores, 123" />
            </div>
          </div>

          <div className="md:col-span-12 flex justify-end mt-2">
            <button type="submit" disabled={saving} className={`w-full sm:w-auto px-8 py-3 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 ${clienteEditandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {saving ? "Salvando..." : (clienteEditandoId ? "Atualizar Cliente" : "Adicionar Cliente")}
            </button>
          </div>
        </form>
        
        {message && (
          <div className={`mt-5 p-3 rounded-lg text-sm border ${message.includes("Erro") || message.includes("não encontrado") ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-700 border-green-100"}`}>
            {message}
          </div>
        )}
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
                    <h3 className="font-semibold text-gray-900 pr-8">{cliente.nome_razao_social}</h3>
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
          </div>
        )}
      </div>
      {/* Modais customizados */}
      <AlertModal {...alertProps} />
      <ConfirmModal {...confirmProps} />
    </div>
  );
}