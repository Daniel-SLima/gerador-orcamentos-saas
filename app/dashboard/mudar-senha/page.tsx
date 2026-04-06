"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAlert } from "../../components/AlertModal";
import { AlertModal } from "../../components/AlertModal";

export default function MudarSenhaPage() {
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const { showAlert, alertProps } = useAlert();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha !== confirmarSenha) {
      showAlert("As senhas não coincidem.", { type: "warning", title: "Atenção" });
      return;
    }
    if (senha.length < 6) {
      showAlert("A senha deve ter no mínimo 6 caracteres.", { type: "warning", title: "Atenção" });
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nova Senha</label>
              <input 
                type="password" 
                value={senha} 
                onChange={e => setSenha(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-all shadow-sm" 
                placeholder="No mínimo 6 caracteres" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar Nova Senha</label>
              <input 
                type="password" 
                value={confirmarSenha} 
                onChange={e => setConfirmarSenha(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-all shadow-sm" 
                placeholder="Repita a senha" 
                required 
              />
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors shadow-sm disabled:opacity-50"
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
