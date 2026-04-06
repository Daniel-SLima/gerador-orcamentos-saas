import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deletarDoCloudinaryServidor } from "../../../lib/cloudinaryServer";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { userIdToDelete } = await request.json();
    if (!userIdToDelete) {
      return NextResponse.json({ error: "ID do usuário não fornecido." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ error: "Erro de configuração no servidor." }, { status: 500 });
    }

    // 1. Cliente normal para validar o token de quem está chamando a rota
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    // Valida se o usuário que está pedindo a deleção é admin
    const { data: perfilData } = await authClient
      .from("perfis_usuarios")
      .select("funcao")
      .eq("user_id", authData.user.id)
      .single();

    if (perfilData?.funcao !== "admin") {
      return NextResponse.json({ error: "Apenas administradores podem apagar contas." }, { status: 403 });
    }

    // 2. Cliente com Service Role para poder deletar auth e acessar tudo bypassando RLS
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 3. Buscar os produtos do usuário para deletar do Cloudinary
    const { data: produtos } = await adminClient
      .from("produtos")
      .select("imagem_url")
      .eq("user_id", userIdToDelete);

    if (produtos && produtos.length > 0) {
      const urlsParaDeletar = produtos.map(p => p.imagem_url).filter(url => url && url.includes("cloudinary.com"));
      
      console.log(`Limpando ${urlsParaDeletar.length} imagens do Cloudinary para o usuário ${userIdToDelete}`);
      
      // Deleta em lote ou sequencial
      for (const url of urlsParaDeletar) {
        await deletarDoCloudinaryServidor(url);
      }
    }

    // 4. Deleções de segurança no Banco (Caso ON DELETE CASCADE não esteja ativado)
    // Deleta o perfil explicitamente
    await adminClient.from("perfis_usuarios").delete().eq("user_id", userIdToDelete);
    // Deleta os produtos 
    await adminClient.from("produtos").delete().eq("user_id", userIdToDelete);
    // Deleta orçamentos associados
    await adminClient.from("orcamentos").delete().eq("user_id", userIdToDelete);
    // Deleta os clientes do vendedor (Opcional, mas como é pra varrer tudo...)
    await adminClient.from("clientes").delete().eq("user_id", userIdToDelete);

    // 5. Apaga definitivamente o usuário da base do Supabase Auth
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userIdToDelete);

    if (deleteError) {
      throw new Error(`Erro ao deletar usuário no Auth: ${deleteError.message}`);
    }

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("Erro na API de exclusão (hard delete):", error);
    return NextResponse.json({ error: error.message || "Erro interno do servidor." }, { status: 500 });
  }
}
