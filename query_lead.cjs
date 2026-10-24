const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

// Read env file
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const { data, error } = await supabase.from('leads').select('*').eq('id', '658a2c01-935a-46f5-9b05-c65acb65cb97');
  console.log("LEADS TABLE:", data, error);
  
  const { data: d2, error: e2 } = await supabase.from('company_memory').select('latest_lead_id').eq('latest_lead_id', '658a2c01-935a-46f5-9b05-c65acb65cb97');
  console.log("COMPANY MEMORY TABLE:", d2, e2);
}
run();
