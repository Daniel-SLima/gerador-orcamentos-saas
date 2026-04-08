import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic'; // Prevent static generation caching

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Variáveis de ambiente do Supabase não configuradas." },
        { status: 500 }
      );
    }

    // Instancia o cliente com a chave master para ignorar as RLS (Row Level Security)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: vendedores, error } = await supabaseAdmin
      .from("vendedores")
      .select("id, nome")
      .order("nome", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(vendedores);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
