"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

interface PerfilContextType {
  isAdmin: boolean;
  isVendedor: boolean;
  isDesativado: boolean;
  userId: string | null;
  loadingPerfil: boolean;
}

const PerfilContext = createContext<PerfilContextType | undefined>(undefined);

export function PerfilUsuarioProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVendedor, setIsVendedor] = useState(true); // Padrão seguro
  const [isDesativado, setIsDesativado] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingPerfil, setLoadingPerfil] = useState(true);

  useEffect(() => {
    let mounted = true; // Flag to prevent state updates if unmounted

    async function carregarPerfil() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) setLoadingPerfil(false);
          return;
        }

        if (mounted) setUserId(user.id);

        const { data: perfil, error } = await supabase
          .from("perfis_usuarios")
          .select("funcao")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Erro ao buscar perfil do usuário", error);
        } else if (perfil && mounted) {
          const funcaoAjustada = perfil.funcao?.trim().toLowerCase();
          setIsAdmin(funcaoAjustada === "admin");
          setIsVendedor(funcaoAjustada === "vendedor");
          setIsDesativado(funcaoAjustada === "desativado");
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
        setIsVendedor(true); // reset fallback
        setIsDesativado(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <PerfilContext.Provider value={{ isAdmin, isVendedor, isDesativado, userId, loadingPerfil }}>
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
