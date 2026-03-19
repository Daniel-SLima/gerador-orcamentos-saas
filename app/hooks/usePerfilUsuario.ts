"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function usePerfilUsuario() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVendedor, setIsVendedor] = useState(true); // Padrão seguro
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingPerfil, setLoadingPerfil] = useState(true);

  useEffect(() => {
    async function carregarPerfil() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoadingPerfil(false);
          return;
        }

        setUserId(user.id);

        const { data: perfil, error } = await supabase
          .from("perfis_usuarios")
          .select("funcao")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Erro ao buscar perfil do usuário", error);
        } else if (perfil) {
          console.log("🕵️ Perfil encontrado para este usuário:", perfil); // DEBUG

          const funcaoAjustada = perfil.funcao?.trim().toLowerCase();
          setIsAdmin(funcaoAjustada === "admin");
          setIsVendedor(funcaoAjustada === "vendedor");
        } else {
          console.log("⚠️ Nenhum perfil encontrado na tabela 'perfis_usuarios' para o RLS deste usuário.");
        }
      } catch (err) {
        console.error("Erro inesperado ao buscar perfil:", err);
      } finally {
        setLoadingPerfil(false);
      }
    }

    carregarPerfil();
  }, []);

  return { isAdmin, isVendedor, userId, loadingPerfil };
}
