const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve('c:/Projetos/Projeto pra Benicio/gerador-orcamentos/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseSecret = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey; 

const supabase = createClient(supabaseUrl, supabaseSecret);

async function findMainAdmin() {
  console.log("Procurando conta sane@teste.com e dados de empresa...");
  
  // Como Anon não pode ler auth.users, tentaremos ler perfis_usuarios onde a funcao seja admin
  const { data: perfis, error } = await supabase
    .from('perfis_usuarios')
    .select('*')
    .eq('funcao', 'admin');

  if (error) {
    console.error("Erro ao buscar admins", error);
    return;
  }

  console.log("Admins encontrados:", perfis.length);
  
  // Pra cada admin, vamos ver se já tem empresa
  for (const admin of perfis) {
    const { data: empresa } = await supabase
      .from('empresa_perfil')
      .select('id, nome_fantasia, user_id')
      .eq('user_id', admin.user_id)
      .single();
      
    console.log(`Admin UserID [${admin.user_id}]:`, empresa || "Sem empresa cadastrada ainda.");
  }
}

findMainAdmin();
