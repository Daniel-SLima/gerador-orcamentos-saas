import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// C08 — Geração de senha criptograficamente segura (crypto.randomBytes ao invés de Math.random)
function generateRandomPassword() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  return Array.from(randomBytes(12))
    .map(b => chars[b % chars.length])
    .join("");
}

export async function POST(request: Request) {
  try {
    // C02 — Verificar se quem está chamando é um admin autenticado
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "E-mail é obrigatório." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return NextResponse.json({ error: "Variáveis de ambiente do Supabase não configuradas." }, { status: 500 });
    }

    // Valida o token de quem está chamando
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    // Confirma que quem está chamando é admin
    const { data: perfilData } = await authClient
      .from("perfis_usuarios")
      .select("funcao")
      .eq("user_id", authData.user.id)
      .single();

    if (perfilData?.funcao !== "admin") {
      return NextResponse.json({ error: "Apenas administradores podem convidar novos usuários." }, { status: 403 });
    }

    // Usa a chave de serviço para criar o usuário
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const tempPassword = generateRandomPassword();

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    if (newUser.user) {
      const { error: profileError } = await supabaseAdmin
        .from("perfis_usuarios")
        .insert([
          {
            user_id: newUser.user.id,
            email: email,
            funcao: "vendedor",
            created_at: new Date().toISOString(),
          },
        ]);

      if (profileError) {
        console.error("Erro ao criar perfil automaticamente:", profileError);
      }
    }

    return NextResponse.json({
      success: true,
      email: email,
      temporaryPassword: tempPassword,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
