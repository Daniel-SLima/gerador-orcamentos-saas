/**
 * app/api/cloudinary-delete/route.ts
 *
 * Rota de API segura (servidor) para deletar arquivos do Cloudinary.
 * A API Secret fica APENAS no servidor — nunca é exposta ao navegador.
 * C05 — Exige sessão autenticada antes de executar qualquer deleção.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deletarDoCloudinaryServidor } from "../../lib/cloudinaryServer";

export async function POST(req: NextRequest) {
  try {
    // C05 — Verificar autenticação antes de qualquer operação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const { url } = await req.json();
    const result = await deletarDoCloudinaryServidor(url);
    
    if (result.error) {
      return NextResponse.json({ error: (result.error as any).message || "Erro interno ao deletar arquivo." }, { status: 500 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro na rota de deleção do Cloudinary:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar a deleção." },
      { status: 500 }
    );
  }
}
