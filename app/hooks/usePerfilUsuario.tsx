"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

interface PerfilContextType {
  isAdmin: boolean;
  isVendedor: boolean;
  isOperador: boolean;
  isFinanceiro: boolean;
  isCompras: boolean;
  isDesativado: boolean;
  setorDoOperador: string | null;
  userId: string | null;
  emailUsuario: string | null;
  loadingPerfil: boolean;
}

const PerfilContext = createContext<PerfilContextType | undefined>(undefined);

export function PerfilUsuarioProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVendedor, setIsVendedor] = useState(true);
  const [isOperador, setIsOperador] = useState(false);
  const [isFinanceiro, setIsFinanceiro] = useState(false);
  const [isCompras, setIsCompras] = useState(false);
  const [isDesativado, setIsDesativado] = useState(false);
  const [setorDoOperador, setSetorDoOperador] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [emailUsuario, setEmailUsuario] = useState<string | null>(null);
  const [loadingPerfil, setLoadingPerfil] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function carregarPerfil() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) setLoadingPerfil(false);
          return;
        }

        if (mounted) setUserId(user.id);
        if (mounted) setEmailUsuario(user.email ?? null);

        const { data: perfil, error } = await supabase
          .from("perfis_usuarios")
          .select("funcao, setor")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Erro ao buscar perfil do usuário", error);
        } else if (perfil && mounted) {
          const funcaoAjustada = perfil.funcao?.trim().toLowerCase();
          setIsAdmin(funcaoAjustada === "admin");
          setIsVendedor(funcaoAjustada === "vendedor");
          setIsOperador(funcaoAjustada === "operador");
          setIsFinanceiro(funcaoAjustada === "financeiro");
          setIsCompras(funcaoAjustada === "compras");
          setIsDesativado(funcaoAjustada === "desativado");
          setSetorDoOperador(funcaoAjustada === "operador" ? (perfil.setor || null) : null);
        }
      } catch (err) {
        console.error("Erro inesperado ao buscar perfil:", err);
      } finally {
        if (mounted) setLoadingPerfil(false);
      }
    }

    carregarPerfil();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && mounted) {
        setUserId(null);
        setIsAdmin(false);
        setIsVendedor(true);
        setIsOperador(false);
        setIsFinanceiro(false);
        setIsCompras(false);
        setIsDesativado(false);
        setSetorDoOperador(null);
        setEmailUsuario(null);
        setLoadingPerfil(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <PerfilContext.Provider value={{
      isAdmin, isVendedor, isOperador, isFinanceiro, isCompras, isDesativado,
      setorDoOperador, userId, emailUsuario, loadingPerfil
    }}>
      {children}
    </PerfilContext.Provider>
  );
}

export function usePerfilUsuario() {
  const context = useContext(PerfilContext);
  if (context === undefined) {
    throw new Error("usePerfilUsuario deve ser usado dentro de um PerfilUsuarioProvider");
  }
  return context;
}
