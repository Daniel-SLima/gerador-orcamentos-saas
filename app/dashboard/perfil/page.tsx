"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

const NOME_DO_BUCKET = "arquivos"; 

interface Vendedor {
  id: string;
  nome: string;
  telefone: string;
  email: string;
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

export default function PerfilEmpresa() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    nome_fantasia: "",
    cnpj: "",
    telefone: "",
    uf: "",
    cidade: "",
    bairro: "",
    rua_numero: "",
    logo_url: "", 
  });

  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removerLogoAntiga, setRemoverLogoAntiga] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedorForm, setVendedorForm] = useState({ id: "", nome: "", telefone: "", email: "" });
  const [salvandoVendedor, setSalvandoVendedor] = useState(false);
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);

  // 🚀 ESTADOS DA API DO IBGE CORRIGIDOS E ALINHADOS
  const [estados, setEstados] = useState<EstadoIBGE[]>([]);
  const [cidades, setCidades] = useState<CidadeIBGE[]>([]); // Usando 'cidades' corretamente
  const [carregandoCidades, setCarregandoCidades] = useState(false);

  useEffect(() => {
    carregarDados();
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
    if (formData.uf) {
      setCarregandoCidades(true);
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${formData.uf}/municipios?orderBy=nome`)
        .then(res => res.json())
        .then(data => {
          setCidades(data); // Atualizando 'cidades'
          setCarregandoCidades(false);
        })
        .catch(() => setCarregandoCidades(false));
    } else {
      setCidades([]);
    }
  }, [formData.uf]);

  const carregarDados = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: perfil } = await supabase.from("empresa_perfil").select("*").limit(1).maybeSingle();

      if (perfil) {
        setFormData({
          nome_fantasia: perfil.nome_fantasia || "",
          cnpj: perfil.cnpj || "",
          telefone: aplicarMascaraTelefone(perfil.telefone || ""),
          uf: perfil.uf || "",
          cidade: perfil.cidade || "",
          bairro: perfil.bairro || "",
          rua_numero: perfil.rua_numero || "",
          logo_url: perfil.logo_url || "",
        });
        if (perfil.logo_url) setPreviewUrl(perfil.logo_url);
      }

      const { data: listaVendedores } = await supabase.from("vendedores").select("*").eq("user_id", user.id).order("nome", { ascending: true });
      if (listaVendedores) setVendedores(listaVendedores);

    } catch (error) {
      console.log("Erro ou perfil novo.", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setArquivoSelecionado(file);
      setPreviewUrl(URL.createObjectURL(file));
      setRemoverLogoAntiga(false);
    }
  };

  const limparImagem = () => {
    setArquivoSelecionado(null);
    setPreviewUrl(null);
    setRemoverLogoAntiga(true); 
    if (fileInputRef.current) fileInputRef.current.value = ""; 
  };

  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      let urlFinalDaLogo = formData.logo_url;
      let caminhoAntigoParaDeletar = null;
      
      if (formData.logo_url) {
        const partesUrl = formData.logo_url.split(`/${NOME_DO_BUCKET}/`);
        if (partesUrl.length > 1) caminhoAntigoParaDeletar = partesUrl[1];
      }

      if (arquivoSelecionado) {
        setMessage("⬆️ Fazendo upload da nova logo...");
        const extensao = arquivoSelecionado.name.split('.').pop();
        const nomeArquivoUnico = `${user.id}/logo_${Date.now()}.${extensao}`;

        const { error: uploadError } = await supabase.storage.from(NOME_DO_BUCKET).upload(nomeArquivoUnico, arquivoSelecionado, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from(NOME_DO_BUCKET).getPublicUrl(nomeArquivoUnico);
        urlFinalDaLogo = publicUrl;

        if (caminhoAntigoParaDeletar) {
          await supabase.storage.from(NOME_DO_BUCKET).remove([caminhoAntigoParaDeletar]);
        }
      } 
      else if (removerLogoAntiga) {
        urlFinalDaLogo = ""; 
        if (caminhoAntigoParaDeletar) {
          await supabase.storage.from(NOME_DO_BUCKET).remove([caminhoAntigoParaDeletar]);
        }
      }

      const enderecoConcatenado = `${formData.rua_numero}, ${formData.bairro} - ${formData.cidade}/${formData.uf}`;

      const dadosParaSalvar = {
        ...formData,
        endereco_completo: enderecoConcatenado, 
        logo_url: urlFinalDaLogo,
        user_id: user.id // Mantém apenas para registro de quem alterou por último
      };

      const { data: perfilExistente } = await supabase.from("empresa_perfil").select("id").limit(1).maybeSingle();

      if (perfilExistente) {
        setMessage("💾 Atualizando perfil da empresa para todos...");
        const { error: updateError } = await supabase.from("empresa_perfil").update(dadosParaSalvar).eq("id", perfilExistente.id);
        if (updateError) throw updateError;
      } else {
        setMessage("💾 Criando perfil...");
        const { error: insertError } = await supabase.from("empresa_perfil").insert([dadosParaSalvar]);
        if (insertError) throw insertError;
      }

      setMessage("✅ Dados da empresa salvos com sucesso!");
      setFormData(prev => ({ ...prev, logo_url: urlFinalDaLogo }));
      setArquivoSelecionado(null); 
      setRemoverLogoAntiga(false);

    } catch (error) {
      setMessage("❌ Erro ao salvar: " + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "telefone") {
      setFormData({ ...formData, [name]: aplicarMascaraTelefone(value) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const salvarVendedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendedorForm.nome) return alert("O nome é obrigatório.");
    setSalvandoVendedor(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não logado");

      if (vendedorForm.id) {
        const { error } = await supabase.from("vendedores").update({ nome: vendedorForm.nome, telefone: vendedorForm.telefone, email: vendedorForm.email }).eq("id", vendedorForm.id);
        if (error) throw error;
        setVendedores(vendedores.map(v => v.id === vendedorForm.id ? { ...v, nome: vendedorForm.nome, telefone: vendedorForm.telefone, email: vendedorForm.email } : v));
      } else {
        const { data, error } = await supabase.from("vendedores").insert([{ user_id: user.id, nome: vendedorForm.nome, telefone: vendedorForm.telefone, email: vendedorForm.email }]).select().single();
        if (error) throw error;
        setVendedores([...vendedores, data]);
      }
      setVendedorForm({ id: "", nome: "", telefone: "", email: "" }); 
    } catch (error) {
      alert("Erro ao salvar vendedor: " + (error as Error).message);
    } finally {
      setSalvandoVendedor(false);
    }
  };

  const editarVendedor = (vend: Vendedor) => {
    setVendedorForm({ id: vend.id, nome: vend.nome, telefone: aplicarMascaraTelefone(vend.telefone), email: vend.email || "" });
    setMenuAbertoId(null);
  };

  const excluirVendedor = async (id: string, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja apagar o vendedor ${nome}?`)) return;
    try {
      const { error } = await supabase.from("vendedores").delete().eq("id", id);
      if (error) throw error;
      setVendedores(vendedores.filter(v => v.id !== id));
      setMenuAbertoId(null);
    } catch (err) {
      console.error(err); // Resolve o erro de 'variável não usada'
      alert("Erro ao excluir. Verifique se ele não está atrelado a algum orçamento.");
    }
  };

  const toggleMenu = (id: string) => {
    if (menuAbertoId === id) setMenuAbertoId(null);
    else setMenuAbertoId(id);
  };

  if (loading) return <div className="p-8 text-gray-500">Buscando dados no banco...</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8" onClick={() => menuAbertoId && setMenuAbertoId(null)}>
      
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Dados da Minha Empresa</h1>
        <p className="text-gray-500 mb-6 text-sm">Estas informações e a sua logo aparecerão no cabeçalho do PDF dos seus orçamentos.</p>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <form onSubmit={salvarPerfil} className="flex flex-col md:flex-row gap-8">
            
            <div className="w-full md:w-1/3 flex flex-col items-center justify-start p-6 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 text-center">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Logo da Empresa</h3>
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Logo Preview" className="w-40 h-40 object-contain rounded-lg border border-gray-200 mb-4 bg-white p-2 shadow-sm" />
              ) : (
                <div className="w-40 h-40 bg-white rounded-lg border border-gray-200 flex flex-col items-center justify-center text-gray-400 mb-4 shadow-sm p-4">
                  <svg className="w-12 h-12 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 21v-8H7v8M7 3v5h8"></path></svg>
                  <span className="text-xs">Sua logo aqui</span>
                </div>
              )}
              <div className="flex flex-col gap-2 w-full">
                <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 font-medium text-sm px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm w-full text-center">
                  {previewUrl ? "Trocar Logo" : "Escolher Imagem"}
                  <input type="file" ref={fileInputRef} accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleFileChange} className="hidden" />
                </label>
                {previewUrl && (
                  <button type="button" onClick={limparImagem} className="text-sm text-red-500 hover:text-red-700 font-medium py-1.5 transition-colors">
                    Remover logo
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-3">Recomendado: Fundo transparente (PNG)</p>
            </div>

            <div className="w-full md:w-2/3 flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome Fantasia da Empresa *</label>
                <input type="text" name="nome_fantasia" value={formData.nome_fantasia} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all shadow-sm" placeholder="Ex: Minha Agência Digital" required />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">CNPJ (ou CPF)</label>
                  <input type="text" name="cnpj" value={formData.cnpj} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all shadow-sm" placeholder="00.000.000/0001-00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone / WhatsApp</label>
                  <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all shadow-sm" placeholder="(00) 00000-0000" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
                  <select name="uf" value={formData.uf} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none shadow-sm">
                    <option value="">UF</option>
                    {estados.map((est: EstadoIBGE) => <option key={est.sigla} value={est.sigla}>{est.sigla}</option>)}
                  </select>
                </div>
                <div className="md:col-span-9">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Cidade</label>
                  <select name="cidade" value={formData.cidade} onChange={handleChange} disabled={!formData.uf || carregandoCidades} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none shadow-sm disabled:bg-gray-100">
                    <option value="">{carregandoCidades ? "Carregando..." : "Selecione a cidade"}</option>
                    {cidades.map((cid: CidadeIBGE) => <option key={cid.id} value={cid.nome}>{cid.nome}</option>)}
                  </select>
                </div>
                <div className="md:col-span-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bairro</label>
                  <input type="text" name="bairro" value={formData.bairro} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none shadow-sm" placeholder="Centro" />
                </div>
                <div className="md:col-span-7">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Rua e Número</label>
                  <input type="text" name="rua_numero" value={formData.rua_numero} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none shadow-sm" placeholder="Rua das Flores, 123" />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={saving} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors shadow-sm disabled:opacity-50">
                  {saving ? "Salvando Dados..." : "Salvar Dados da Empresa"}
                </button>
              </div>
              
              {message && (
                <div className={`p-4 rounded-lg text-sm font-medium border ${message.includes("Erro") ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                  {message}
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">👥 Equipe de Vendas</h2>
          <p className="text-gray-500 text-sm mt-1">Cadastre os vendedores para selecioná-los nos orçamentos.</p>
        </div>
        <div className="p-6 space-y-8">
          <form onSubmit={salvarVendedor} className={`p-5 rounded-lg border grid lg:grid-cols-4 md:grid-cols-2 gap-4 items-end transition-colors ${vendedorForm.id ? "bg-yellow-50/50 border-yellow-200" : "bg-blue-50/50 border-blue-100"}`}>
            <div className="w-full">
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${vendedorForm.id ? "text-yellow-800" : "text-blue-800"}`}>Nome do Vendedor *</label>
              <input type="text" required value={vendedorForm.nome} onChange={e => setVendedorForm({...vendedorForm, nome: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: João Silva" />
            </div>
            <div className="w-full">
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${vendedorForm.id ? "text-yellow-800" : "text-blue-800"}`}>Telefone (Opcional)</label>
              <input type="text" value={vendedorForm.telefone} onChange={e => setVendedorForm({...vendedorForm, telefone: aplicarMascaraTelefone(e.target.value)})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="(00) 00000-0000" />
            </div>
            <div className="w-full">
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${vendedorForm.id ? "text-yellow-800" : "text-blue-800"}`}>E-mail (Opcional)</label>
              <input type="email" value={vendedorForm.email} onChange={e => setVendedorForm({...vendedorForm, email: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="exemplo@email.com" />
            </div>
            <div className="flex gap-2 w-full mt-2 lg:mt-0">
              {vendedorForm.id && (
                <button type="button" onClick={() => setVendedorForm({id: "", nome: "", telefone: "", email: ""})} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-2.5 px-4 rounded-lg transition-colors h-[46px]">Cancelar</button>
              )}
              <button type="submit" disabled={salvandoVendedor} className={`flex-1 text-white font-bold py-2.5 px-6 rounded-lg transition-colors h-[46px] ${vendedorForm.id ? "bg-yellow-500 hover:bg-yellow-600" : "bg-blue-600 hover:bg-blue-700"}`}>
                {salvandoVendedor ? "Salvando..." : (vendedorForm.id ? "Salvar Edição" : "+ Adicionar")}
              </button>
            </div>
          </form>

          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Vendedores Cadastrados ({vendedores.length})</h3>
            {vendedores.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Nenhum vendedor cadastrado ainda.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                {vendedores.map((vendedor) => (
                  <div key={vendedor.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center bg-white shadow-sm relative">
                    <div>
                      <p className="font-bold text-gray-800">{vendedor.nome}</p>
                      <p className="text-sm text-gray-500 font-medium">{vendedor.telefone || "Sem telefone"}</p>
                      {vendedor.email && (
                        <p className="text-xs text-blue-600 mt-0.5">{vendedor.email}</p>
                      )}
                    </div>
                    <div>
                      <button onClick={(e) => { e.stopPropagation(); toggleMenu(vendedor.id); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                      </button>
                      {menuAbertoId === vendedor.id && (
                        <div className="absolute right-0 top-12 w-36 bg-white border border-gray-100 rounded-xl shadow-xl z-50 flex flex-col py-1 animate-fade-in">
                          <button onClick={(e) => { e.stopPropagation(); editarVendedor(vendedor); }} className="px-4 py-2 text-sm text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Editar</button>
                          <div className="h-px bg-gray-100 my-1 mx-2"></div>
                          <button onClick={(e) => { e.stopPropagation(); excluirVendedor(vendedor.id, vendedor.nome); }} className="px-4 py-2 text-sm text-left font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Excluir</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}