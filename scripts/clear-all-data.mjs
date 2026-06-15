/**
 * Hapus semua data bisnis di Supabase.
 * Butuh: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_PASSWORD di .env.local
 *
 * Usage: node scripts/clear-all-data.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envPath = resolve(root, '.env.local');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}
if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local to run this script.');
  process.exit(1);
}

const supabase = createClient(url, key);
const ZERO = '00000000-0000-0000-0000-000000000000';

const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
if (signInError) {
  console.error('Login failed:', signInError.message);
  process.exit(1);
}

const { data: rpcData, error: rpcError } = await supabase.rpc('clear_all_business_data');
if (!rpcError) {
  console.log('Berhasil via RPC:', JSON.stringify(rpcData, null, 2));
  process.exit(0);
}

console.warn('RPC tidak tersedia, fallback delete langsung:', rpcError.message);

for (const table of ['transaction_lines', 'transactions', 'customers', 'products']) {
  const { error } = await supabase.from(table).delete().neq('id', ZERO);
  if (error) {
    console.error(`Gagal hapus ${table}:`, error.message);
    process.exit(1);
  }
  console.log(`OK: ${table} dikosongkan`);
}

console.log('Semua data bisnis berhasil dibersihkan.');