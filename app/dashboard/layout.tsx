"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { usePerfilUsuario } from "../hooks/usePerfilUsuario";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // 🛡️ Lógica de Proteção de Rota
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin } = usePerfilUsuario();

  // =========================================================================
  // 🧹 FAXINA INTELIGENTE DE ANEXOS TEMPORÁRIOS (DECLARADA ANTES DE SER USADA)
  // =========================================================================
  const limparAnexosVencidos = async () => {
    try {
      // 🎯 AQUI VOCÊ DEFINE QUANTOS DIAS O ARQUIVO SOBREVIVE:
      const DIAS_EXPIRACAO = 15; 

      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - DIAS_EXPIRACAO);
      const dataFormatada = dataLimite.toISOString();

      // 1. Busca os anexos criados antes da data limite
      const { data: anexosVelhos } = await supabase
        .from("orcamento_anexos")
        .select("id, file_path")
        .lt("created_at", dataFormatada);

      if (anexosVelhos && anexosVelhos.length > 0) {
        // 2. Apaga o arquivo físico do Storage
        const paths = anexosVelhos.map(a => a.file_path);
        await supabase.storage.from("anexos").remove(paths);

        // 3. Apaga o registro da tabela
        const ids = anexosVelhos.map(a => a.id);
        await supabase.from("orcamento_anexos").delete().in("id", ids);
        console.log(`🧹 Faxina concluída: ${anexosVelhos.length} anexos apagados.`);
      }
    } catch (error) {
      console.error("Erro na faxina de anexos:", error);
    }
  };
  // =========================================================================

  useEffect(() => {
    const verificarSessao = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/"); 
      } else {
        setIsCheckingAuth(false);
        // 🚀 RODA A FAXINA ASSIM QUE ENTRA NO SISTEMA (Agora funciona pois a função já existe)
        limparAnexosVencidos();
      }
    };
    verificarSessao();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // 🚪 Função de Sair
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const menuItems = [
    { href: "/dashboard", label: "Início", icon: "🏠" },
    ...(isAdmin ? [{ href: "/dashboard/perfil", label: "Minha Empresa", icon: "🏢" }] : []),
    { href: "/dashboard/clientes", label: "Clientes", icon: "👥" },
    { href: "/dashboard/produtos", label: "Produtos", icon: "📦" },
    { href: "/dashboard/orcamentos", label: "Orçamentos", icon: "📄" },
    { href: "/dashboard/historico", label: "Histórico", icon: "🕒" },
    ...(isAdmin ? [{ href: "/dashboard/usuarios", label: "Equipe", icon: "🛡️" }] : [])
  ];

  // Tela de transição enquanto verifica o login
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 font-medium animate-pulse">
        VERIFICANDO ACESSO...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      
      {/* 1. BARRA SUPERIOR EXCLUSIVA PARA MOBILE */}
      <header className="md:hidden fixed top-0 left-0 w-full h-16 bg-white border-b border-gray-200 flex items-center justify-between px-5 z-40 shadow-sm">
        
        {/* 🚀 LOGO MOBILE AQUI */}
        <div className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/Logo_Sane_512x512.png" 
            alt="SANE" 
            className="h-8 w-auto object-contain" 
          />
        </div>

        <button 
          onClick={() => setIsMobileMenuOpen(true)} 
          className="text-gray-600 hover:text-blue-600 focus:outline-none p-2 bg-gray-50 rounded-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        </button>
      </header>

      {/* 2. FUNDO ESCURO DO MOBILE */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 3. MENU LATERAL FLUTUANTE */}
      <aside className={`
        fixed top-0 left-0 h-full w-72 bg-white border-r border-gray-200 shadow-2xl z-50 flex flex-col
        transform transition-transform duration-300 ease-in-out
        md:translate-x-0
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        
        <div className="h-16 md:h-24 flex items-center justify-between px-6 border-b border-gray-100">
          {/* 🚀 LOGO DESKTOP AQUI */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/Logo_Sane_512x512.png" 
            alt="SANE" 
            className="h-10 md:h-12 w-auto object-contain" 
          />
          
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden text-gray-400 hover:text-red-500 p-1"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors font-medium text-sm ${
                  isActive 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200" 
                  : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                }`}
              >
                <span className={`text-xl ${isActive ? "opacity-100" : "opacity-80"}`}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 🚀 Botão de Logout */}
        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            Sair da Conta
          </button>
        </div>
      </aside>

      {/* 4. CONTEÚDO PRINCIPAL */}
      <main className="md:pl-72 pt-16 md:pt-0 min-h-screen w-full transition-all duration-300">
        {children}
      </main>
      
    </div>
  );
}