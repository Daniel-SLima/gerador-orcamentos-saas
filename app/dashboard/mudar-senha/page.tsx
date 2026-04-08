"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAlert } from "../../components/AlertModal";
import { AlertModal } from "../../components/AlertModal";

// M10 — Critérios de senha forte
const criterios = [
  { id: "minLen", label: "Mínimo de 8 caracteres", test: (s: string) => s.length >= 8 },
  { id: "upper", label: "Ao menos uma letra maiúscula (A-Z)", test: (s: string) => /[A-Z]/.test(s) },
  { id: "lower", label: "Ao menos uma letra minúscula (a-z)", test: (s: string) => /[a-z]/.test(s) },
  { id: "number", label: "Ao menos um número (0-9)", test: (s: string) => /[0-9]/.test(s) },
  { id: "special", label: "Ao menos um caractere especial (!@#$%...)", test: (s: string) => /[!@#$%^&*()_\-+=\[\]{};':\"\\|,.<>\/?]/.test(s) },
];

export default function MudarSenhaPage() {
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const { showAlert, alertProps } = useAlert();

  const criteriosAtendidos = criterios.filter(c => c.test(senha));
  const senhaValida = criteriosAtendidos.length === criterios.length;
  const forca = criteriosAtendidos.length;

  const corForca = () => {
    if (forca <= 1) return "bg-red-500";
    if (forca <= 2) return "bg-orange-500";
    if (forca <= 3) return "bg-yellow-500";
    if (forca <= 4) return "bg-blue-500";
    return "bg-green-500";
  };

  const labelForca = () => {
    if (!senha) return "";
    if (forca <= 1) return "Muito fraca";
    if (forca <= 2) return "Fraca";
    if (forca <= 3) return "Razoável";
    if (forca <= 4) return "Boa";
    return "Forte";
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!senhaValida) {
      showAlert("A senha não atende todos os requisitos de segurança.", { type: "warning", title: "Senha insuficiente" });
      return;
    }
    if (senha !== confirmarSenha) {
      showAlert("As senhas não coincidem.", { type: "warning", title: "Atenção" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      
      showAlert("Sua senha foi atualizada com sucesso!\nVocê já pode usar essa senha no próximo login.", { 
        type: "success", 
        title: "Senha Atualizada" 
      });
      setSenha("");
      setConfirmarSenha("");
    } catch (error: any) {
      showAlert("Erro ao atualizar senha: " + error.message, { type: "error", title: "Falha" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Segurança e Senha</h1>
        <p className="text-gray-500 text-sm mb-6">
          Defina ou atualize a sua senha de acesso ao sistema.
        </p>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <form onSubmit={handleUpdatePassword} className="space-y-5">
            {/* Campo Nova Senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nova Senha</label>
              <div className="relative">
                <input 
                  type={mostrarSenha ? "text" : "password"}
                  value={senha} 
                  onChange={e => setSenha(e.target.value)}
                  className="w-full px-4 py-2.5 pr-12 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-all shadow-sm" 
                  placeholder="Crie uma senha forte"
                  required 
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {mostrarSenha ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>

              {/* Barra de força da senha */}
              {senha && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${corForca()}`}
                        style={{ width: `${(forca / criterios.length) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${forca <= 2 ? "text-red-500" : forca <= 3 ? "text-yellow-500" : forca <= 4 ? "text-blue-500" : "text-green-500"}`}>
                      {labelForca()}
                    </span>
                  </div>

                  {/* Checklist ao vivo */}
                  <ul className="space-y-1.5 mt-2">
                    {criterios.map(c => {
                      const ok = c.test(senha);
                      return (
                        <li key={c.id} className={`flex items-center gap-2 text-xs transition-colors ${ok ? "text-green-600" : "text-gray-400"}`}>
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all ${ok ? "bg-green-100" : "bg-gray-100"}`}>
                            {ok ? (
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            ) : (
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                            )}
                          </span>
                          {c.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
            
            {/* Campo Confirmar Senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar Nova Senha</label>
              <input 
                type={mostrarSenha ? "text" : "password"}
                value={confirmarSenha} 
                onChange={e => setConfirmarSenha(e.target.value)}
                className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-all shadow-sm ${
                  confirmarSenha && senha !== confirmarSenha ? "border-red-400 focus:ring-red-300" : "border-gray-300"
                }`}
                placeholder="Repita a mesma senha" 
                required 
              />
              {confirmarSenha && senha !== confirmarSenha && (
                <p className="text-xs text-red-500 mt-1 font-medium">As senhas não coincidem.</p>
              )}
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={loading || !senhaValida || senha !== confirmarSenha}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Salvando..." : "Salvar Nova Senha"}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <AlertModal {...alertProps} />
    </div>
  );
}
