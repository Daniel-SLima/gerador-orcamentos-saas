"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { PerfilUsuarioProvider, usePerfilUsuario } from "../hooks/usePerfilUsuario";
import { ToastProvider } from "../components/Toast";
import NotificationBell from "../components/NotificationBell";
import { deletarDoCloudinary } from "../lib/uploadCloudinary";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PerfilUsuarioProvider>
      <ToastProvider>
        <DashboardContent>{children}</DashboardContent>
      </ToastProvider>
    </PerfilUsuarioProvider>
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // 🛡️ Lógica de Proteção de Rota
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  
  // 🚀 O ganho de performance mágico acontece aqui: isso agora puxa da memória (Cache) instantaneamente!
  const { isAdmin, isOperador, isDesativado, loadingPerfil } = usePerfilUsuario();

  // =========================================================================
  // 🧹 FAXINA INTELIGENTE DE ANEXOS TEMPORÁRIOS
  // =========================================================================
  const limparAnexosVencidos = async () => {
    try {
      const DIAS_EXPIRACAO = 15;

      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - DIAS_EXPIRACAO);
      const dataFormatada = dataLimite.toISOString();

      const { data: anexosVelhos } = await supabase
        .from("orcamento_anexos")
        .select("id, file_path, file_url")
        .lt("created_at", dataFormatada);

      if (anexosVelhos && anexosVelhos.length > 0) {
        const pathsSupabase = anexosVelhos
          .map(a => a.file_path)
          .filter(p => p && p !== "cloudinary" && !p.startsWith("http"));
        if (pathsSupabase.length > 0) {
          await supabase.storage.from("anexos").remove(pathsSupabase);
        }

        const urlsCloudinary = anexosVelhos
          .filter(a => a.file_path === "cloudinary" && a.file_url)
          .map(a => a.file_url);
        if (urlsCloudinary.length > 0) {
          await Promise.allSettled(urlsCloudinary.map(url => deletarDoCloudinary(url)));
        }

        const ids = anexosVelhos.map(a => a.id);
        await supabase.from("orcamento_anexos").delete().in("id", ids);
        console.log(`🧹 Faxina: ${anexosVelhos.length} anexos apagados (${urlsCloudinary.length} Cloudinary, ${pathsSupabase.length} Supabase).`);
      }
    } catch (error) {
      console.error("Erro na faxina de anexos:", error);
    }
  };

  useEffect(() => {
    const verificarSessao = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/"); 
      } else {
        setIsCheckingAuth(false);
        limparAnexosVencidos();
      }
    };
    verificarSessao();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!loadingPerfil && !isCheckingAuth && isOperador) {
      const rotasPermitidas = ["/dashboard/setor", "/dashboard/mudar-senha"];
      const acessoPermitido = rotasPermitidas.some(rota => pathname.startsWith(rota));
      if (!acessoPermitido) {
        router.replace("/dashboard/setor");
      }
    }
  }, [isOperador, pathname, loadingPerfil, isCheckingAuth, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  // Operadores têm menu exclusivo e reduzido
  const menuItemsOperador = [
    { href: "/dashboard/setor", label: "Meu Setor", icon: "⚙️" },
    { href: "/dashboard/mudar-senha", label: "Segurança", icon: "🔒" },
  ];

  // Menu completo para Admin e Vendedor
  const menuItemsCompleto = [
    { href: "/dashboard", label: "Início", icon: "🏠" },
    ...(isAdmin ? [{ href: "/dashboard/perfil", label: "Minha Empresa", icon: "🏢" }] : []),
    { href: "/dashboard/clientes", label: "Clientes", icon: "👥" },
    { href: "/dashboard/produtos", label: "Produtos", icon: "📦" },
    { href: "/dashboard/orcamentos", label: "Orçamentos", icon: "📄" },
    { href: "/dashboard/historico", label: "Histórico", icon: "🕒" },
    ...(isAdmin ? [{ href: "/dashboard/producao", label: "Produção", icon: "🏭" }] : []),
    ...(isAdmin ? [{ href: "/dashboard/usuarios", label: "Equipe", icon: "🛡️" }] : []),
    { href: "/dashboard/mudar-senha", label: "Segurança", icon: "🔒" },
  ];

  const menuItems = isOperador ? menuItemsOperador : menuItemsCompleto;

  // Tela de transição integrada (espera tanto sessão local quanto perfil da nuvem estar pronto)
  if (isCheckingAuth || loadingPerfil) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 font-medium animate-pulse">
        VERIFICANDO ACESSO...
      </div>
    );
  }

  // 🚨 Proteção Ativa: expulsa imediatamente quem foi desativado
  if (isDesativado) {
    supabase.auth.signOut().then(() => router.replace("/"));
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Acesso Revogado</h1>
          <p className="text-gray-500 text-sm">Sua conta foi desativada pelo administrador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      
      {/* 1. BARRA SUPERIOR EXCLUSIVA PARA MOBILE */}
      <header className="md:hidden fixed top-0 left-0 w-full h-16 bg-white border-b border-gray-200 flex items-center justify-between px-5 z-40 shadow-sm">
        <div className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Logo_Sane_512x512.png" alt="SANE" className="h-8 w-auto object-contain" />
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-600 hover:text-blue-600 focus:outline-none p-2 bg-gray-50 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
        </div>
      </header>

      {/* 2. FUNDO ESCURO DO MOBILE */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* 3. MENU LATERAL FLUTUANTE */}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-gray-200 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-16 md:h-24 flex items-center justify-between px-6 border-b border-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Logo_Sane_512x512.png" alt="SANE" className="h-10 md:h-12 w-auto object-contain" />
          <div className="hidden md:flex items-center">
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-400 hover:text-red-500 p-1">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors font-medium text-sm ${isActive ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"}`}>
                <span className={`text-xl ${isActive ? "opacity-100" : "opacity-80"}`}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            Sair da Conta
          </button>
        </div>
      </aside>

      {/* 4. CONTEÚDO PRINCIPAL */}
      <main className="md:pl-72 pt-16 md:pt-0 min-h-screen w-full transition-all duration-300">
        {/* Barra superior desktop com sino */}
        <div className="hidden md:flex items-center justify-end px-6 py-3 bg-white border-b border-gray-100 sticky top-0 z-30">
          <NotificationBell />
        </div>
        {children}
      </main>
      
    </div>
  );
}