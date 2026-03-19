"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { usePerfilUsuario } from "../../hooks/usePerfilUsuario";
import { useRouter } from "next/navigation";

interface PerfilUsuario {
  id: string;
  user_id: string;
  email: string;
  funcao: string;
  created_at: string;
}

export default function UsuariosPage() {
  const { isAdmin, loadingPerfil } = usePerfilUsuario();
  const router = useRouter();

  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loadingPerfil) {
      if (!isAdmin) {
        // Redireciona se não for Admin
        router.push("/dashboard");
      } else {
        carregarUsuarios();
      }
    }
  }, [loadingPerfil, isAdmin, router]);

  const carregarUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from("perfis_usuarios")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setUsuarios(data as PerfilUsuario[]);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      setMessage("❌ Erro ao buscar lista de usuários da equipe.");
    } finally {
      setLoading(false);
    }
  };

  const alterarFuncao = async (perfilId: string, novaFuncao: string) => {
    setSaving(perfilId);
    setMessage("");

    try {
      const { error } = await supabase
        .from("perfis_usuarios")
        .update({ funcao: novaFuncao })
        .eq("id", perfilId);

      if (error) throw error;

      setUsuarios(usuarios.map(u => u.id === perfilId ? { ...u, funcao: novaFuncao } : u));
      setMessage("✅ Permissão atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar função:", error);
      setMessage("❌ Erro ao atualizar a permissão do usuário.");
    } finally {
      setSaving(null);
    }
  };

  if (loadingPerfil || loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 font-medium animate-pulse">Carregando membros da equipe...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestão da Equipe</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie os usuários do sistema e defina o nível de acesso (Admin ou Vendedor).
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-medium border ${message.includes("Erro") ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Membro (E-mail)</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Acesso Atual</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Data de Cadastro</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Alterar Permissão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 text-gray-900 font-medium">
                    {usuario.email || <span className="text-gray-400 italic">Sem e-mail registrado</span>}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        usuario.funcao === "admin" 
                        ? "bg-purple-50 text-purple-700 border-purple-200" 
                        : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {usuario.funcao === "admin" ? "🛡️ Admin" : "👤 Vendedor"}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-500">
                    {new Intl.DateTimeFormat('pt-BR').format(new Date(usuario.created_at))}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <select
                      value={usuario.funcao}
                      disabled={saving === usuario.id}
                      onChange={(e) => alterarFuncao(usuario.id, e.target.value)}
                      className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 font-medium transition-all disabled:opacity-50"
                    >
                      <option value="vendedor">Vendedor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* VISUALIZAÇÃO MOBILE */}
        <div className="block md:hidden divide-y divide-gray-100">
          {usuarios.map((usuario) => (
            <div key={usuario.id} className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="break-all font-medium text-gray-900 pr-4">
                  {usuario.email || <span className="text-gray-400 italic">Sem e-mail registrado</span>}
                </div>
                <span className={`shrink-0 inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                    usuario.funcao === "admin" 
                    ? "bg-purple-50 text-purple-700 border-purple-200" 
                    : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}
                >
                  {usuario.funcao === "admin" ? "Admin" : "Vendedor"}
                </span>
              </div>
              <div className="flex justify-between items-center mt-4">
                <p className="text-xs text-gray-500 font-medium">
                  Cadastrado em {new Intl.DateTimeFormat('pt-BR').format(new Date(usuario.created_at))}
                </p>
                <select
                  value={usuario.funcao}
                  disabled={saving === usuario.id}
                  onChange={(e) => alterarFuncao(usuario.id, e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none text-gray-800 font-bold transition-all disabled:opacity-50"
                >
                  <option value="vendedor">Tornar Vendedor</option>
                  <option value="admin">Tornar Admin</option>
                </select>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
