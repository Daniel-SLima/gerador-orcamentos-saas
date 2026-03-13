"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

interface Cliente {
  id: string;
  nome_razao_social: string;
  cpf_cnpj: string;
  contato_nome: string;
  telefone: string;
  endereco: string;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clienteEditandoId, setClienteEditandoId] = useState<string | null>(null);

  const [nomeRazaoSocial, setNomeRazaoSocial] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [message, setMessage] = useState("");

  // --- NOVO ESTADO: Controle do Menu de Ações ---
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);

  useEffect(() => {
    carregarClientes();
  }, []);

  const carregarClientes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setClientes(data);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
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

      const dadosParaSalvar = {
        nome_razao_social: nomeRazaoSocial, 
        cpf_cnpj: cpfCnpj, 
        contato_nome: contatoNome, 
        telefone: telefone,
        endereco: endereco,
        user_id: user.id 
      };

      if (clienteEditandoId) {
        const { error } = await supabase
          .from("clientes")
          .update(dadosParaSalvar)
          .eq("id", clienteEditandoId);

        if (error) throw error;
        setMessage("✅ Cliente atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("clientes")
          .insert([dadosParaSalvar]);

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
    setTelefone(cliente.telefone || "");
    setEndereco(cliente.endereco || "");
    setMessage("");
    setMenuAbertoId(null); // Fecha o menu ao clicar
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const limparFormulario = () => {
    setClienteEditandoId(null);
    setNomeRazaoSocial("");
    setCpfCnpj("");
    setContatoNome("");
    setTelefone("");
    setEndereco("");
  };

  const deletarCliente = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este cliente?")) return;

    try {
      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setClientes(clientes.filter(cliente => cliente.id !== id));
      if (clienteEditandoId === id) limparFormulario();
      setMenuAbertoId(null); // Fecha o menu após deletar
    } catch (error) {
      alert("Erro ao excluir cliente: " + (error as Error).message);
    }
  };

  const toggleMenu = (id: string) => {
    if (menuAbertoId === id) setMenuAbertoId(null);
    else setMenuAbertoId(id);
  };

  // onClick na raiz para fechar o menu ao clicar fora
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto" onClick={() => menuAbertoId && setMenuAbertoId(null)}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Meus Clientes</h1>
      
      {/* Formulário Responsivo */}
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
            <input
              type="text"
              required
              value={nomeRazaoSocial}
              onChange={(e) => setNomeRazaoSocial(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
              placeholder="Ex: Posto Sorriso"
            />
          </div>

          <div className="md:col-span-6 lg:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contato</label>
            <input
              type="text"
              value={contatoNome}
              onChange={(e) => setContatoNome(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
              placeholder="Ex: Wellington"
            />
          </div>

          <div className="md:col-span-6 lg:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone</label>
            <input
              type="text"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="md:col-span-6 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">CNPJ / CPF</label>
            <input
              type="text"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div className="md:col-span-6 lg:col-span-6">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Endereço Completo</label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
              placeholder="Rua, Número, Bairro, CEP, Cidade - Estado"
            />
          </div>

          <div className="md:col-span-12 lg:col-span-3 flex items-end">
            <button
              type="submit"
              disabled={saving}
              className={`w-full text-white font-medium py-2.5 rounded-lg transition-colors shadow-sm disabled:opacity-50 ${clienteEditandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {saving ? "Salvando..." : (clienteEditandoId ? "Atualizar Cliente" : "Adicionar Cliente")}
            </button>
          </div>
        </form>
        
        {message && (
          <div className={`mt-5 p-3 rounded-lg text-sm border ${message.includes("Erro") ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-700 border-green-100"}`}>
            {message}
          </div>
        )}
      </div>

      {/* Listagem Responsiva */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando clientes...</div>
        ) : clientes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum cliente cadastrado ainda.</div>
        ) : (
          <div className="pb-16">
            
            {/* Visualização Mobile (Cards) */}
            <div className="block md:hidden divide-y divide-gray-100">
              {clientes.map((cliente) => (
                <div key={cliente.id} className="p-4 hover:bg-gray-50 transition-colors relative">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900 pr-8">{cliente.nome_razao_social}</h3>
                    
                    {/* BOTÃO DE AÇÕES NO MOBILE */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleMenu(cliente.id); }}
                      className="p-1 -mr-2 -mt-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                    </button>

                    {/* DROPDOWN NO MOBILE */}
                    {menuAbertoId === cliente.id && (
                      <div className="absolute right-4 top-10 w-36 bg-white border border-gray-100 rounded-xl shadow-xl z-50 flex flex-col py-1 animate-fade-in">
                        <button 
                          onClick={(e) => { e.stopPropagation(); iniciarEdicao(cliente); }}
                          className="px-4 py-2 text-sm text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                          Editar
                        </button>
                        <div className="h-px bg-gray-100 my-1 mx-2"></div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deletarCliente(cliente.id); }}
                          className="px-4 py-2 text-sm text-left font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          Excluir
                        </button>
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

            {/* Visualização Desktop (Tabela) */}
            <div className="hidden md:block overflow-x-auto">
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
                  {clientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-gray-900 font-medium">{cliente.nome_razao_social}</td>
                      <td className="p-4 text-gray-600">{cliente.contato_nome || "-"}</td>
                      <td className="p-4 text-gray-600">{cliente.telefone || "-"}</td>
                      <td className="p-4 text-gray-600">{cliente.cpf_cnpj || "-"}</td>
                      <td className="p-4 text-gray-600 truncate max-w-[200px]" title={cliente.endereco}>{cliente.endereco || "-"}</td>
                      
                      {/* BOTÃO DE AÇÕES NO DESKTOP */}
                      <td className="p-4 text-center relative">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleMenu(cliente.id); }}
                          className="p-2 mx-auto text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none flex justify-center"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                        </button>

                        {/* DROPDOWN NO DESKTOP */}
                        {menuAbertoId === cliente.id && (
                          <div className="absolute right-8 top-10 w-36 bg-white border border-gray-100 rounded-xl shadow-xl z-50 flex flex-col py-1 animate-fade-in">
                            <button 
                              onClick={(e) => { e.stopPropagation(); iniciarEdicao(cliente); }}
                              className="px-4 py-2 text-sm text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                              Editar
                            </button>
                            <div className="h-px bg-gray-100 my-1 mx-2"></div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deletarCliente(cliente.id); }}
                              className="px-4 py-2 text-sm text-left font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
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