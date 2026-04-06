import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Função utilitária para gerar senha aleatória segura
function generateRandomPassword() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "E-mail é obrigatório." }, { status: 400 });
    }

    // Usando a Service Role Key para contornar limitações e não deslogar o admin
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Variaveis de ambiente do Supabase não configuradas." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const tempPassword = generateRandomPassword();

    // Cria o usuário já com e-mail confirmado silenciosamente
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // Cadastra o perfil no banco com a regra hardcoded de "vendedor"
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
        // Não apaga a auth, pois o perfil pode ser criado depois, mas registra o log
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
