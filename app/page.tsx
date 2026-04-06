"use client";

import { useState } from "react";
import { supabase } from "./lib/supabase";
import { useRouter } from "next/navigation";
import { ToastProvider, useToast } from "./components/Toast";

// Componente interno que usa o hook useToast (precisa estar dentro do Provider)
function LoginForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 🚀 FUNÇÃO PARA TRADUZIR OS ERROS DO SUPABASE
  const traduzirErro = (mensagem: string) => {
    if (mensagem.includes("Invalid login credentials")) {
      return "E-mail ou senha incorretos.";
    }
    if (mensagem.includes("Password should be at least 6 characters")) {
      return "A senha deve ter pelo menos 6 caracteres.";
    }
    if (mensagem.includes("User already registered")) {
      return "Este e-mail já está cadastrado.";
    }
    return "Ocorreu um erro inesperado. Tente novamente.";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showToast(traduzirErro(error.message), "error");
    } else {
      showToast("Login realizado! Redirecionando...", "success");
      router.push("/dashboard");
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      showToast(traduzirErro(error.message), "error");
    } else {
      showToast("Conta criada! Você já pode fazer login.", "success");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-gray-100">

        {/* LOGO */}
        <div className="text-center mb-8 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Logo_Sane_512x512.png"
            alt="SANE Sistemas"
            className="h-16 w-auto object-contain mb-2"
          />
          <p className="text-sm text-gray-500 mt-2">Acesse sua conta para continuar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-gray-900"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-gray-900"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? "Carregando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Ainda não tem uma conta?{" "}
            <button onClick={handleSignUp} type="button" className="text-blue-600 hover:underline font-semibold transition-colors">
              Criar agora
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// Exporta o page com o ToastProvider local (não afeta o layout do dashboard)
export default function Login() {
  return (
    <ToastProvider>
      <LoginForm />
    </ToastProvider>
  );
}