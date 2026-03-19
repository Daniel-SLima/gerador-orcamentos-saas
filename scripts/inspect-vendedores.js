const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve('c:/Projetos/Projeto pra Benicio/gerador-orcamentos/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  console.log("Checking how 'vendedores' are related to 'orcamentos'...");

  // Let's just fetch one recent budget and check if it has 'vendedor_id' or 'user_id'
  const { data: orcamentos, error } = await supabase
    .from('orcamentos')
    .select('*, vendedores(*)')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error("Error fetching orcamentos:", error);
    return;
  }

  console.log("Sample Orcamentos Data:");
  console.dir(orcamentos, { depth: null });

  // Let's check the perfis_usuarios table since it holds the Vendedor concept 
  const { data: perfis, error: errorPerfis } = await supabase
    .from('perfis_usuarios')
    .select('*')
    .limit(3);
    
  if (errorPerfis) {
    console.error("Error fetching perfis_usuarios:", errorPerfis);
  } else {
    console.log("\nSample perfis_usuarios Data:");
    console.dir(perfis, { depth: null });
  }
}

inspectSchema();
