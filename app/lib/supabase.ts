import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://hgysykqfirrszechrqzs.supabase.co"
const supabaseAnonKey = "sb_publishable_FrNEz4ymMwltUBSlKa_SAQ_PdFBI2IY"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

