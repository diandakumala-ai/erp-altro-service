import fs from 'fs';
import vm from 'vm';
import { createClient } from '@supabase/supabase-js';

// ─── SCRIPT SEED LEGACY (one-shot, dijalankan manual) ─────────
// Membaca array `_legacyInventory` & `_legacyCustomers` dari source TS,
// lalu upsert ke Supabase. Kredensial WAJIB dari env, tidak boleh hardcoded.
//
// Cara pakai (PowerShell):
//   $env:VITE_SUPABASE_URL="..."; $env:VITE_SUPABASE_ANON_KEY="...";
//   $env:SUPABASE_ADMIN_EMAIL="..."; $env:SUPABASE_ADMIN_PASSWORD="...";
//   node export-to-supabase.js
//
// Lebih disarankan: pakai SUPABASE_SERVICE_ROLE_KEY (bypass RLS) lalu
// tidak perlu signInWithPassword sama sekali.

const content = fs.readFileSync('src/store/useStore.ts', 'utf-8');

function extractArray(arrayName) {
  const startRegex = new RegExp(`const ${arrayName}[^=]*=\\s*\\[`);
  const match = content.match(startRegex);
  if (!match) return [];
  const startIndex = match.index + match[0].length - 1;
  let bracketCount = 0;
  let endIndex = -1;
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '[') bracketCount++;
    if (content[i] === ']') {
      bracketCount--;
      if (bracketCount === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }
  const arrayStr = content.substring(startIndex, endIndex);
  // Pakai vm.runInNewContext: tetap evaluasi literal JS, tapi di sandbox
  // tanpa akses ke require/process/global — lebih aman dari eval().
  return vm.runInNewContext('(' + arrayStr + ')', Object.create(null), {
    timeout: 1000,
  });
}

const inventory = extractArray('_legacyInventory');
const customers = extractArray('_legacyCustomers');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = process.env.SUPABASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SUPABASE_ADMIN_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY (atau SUPABASE_SERVICE_ROLE_KEY) di env.');
  process.exit(1);
}

const usingServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
  const mappedInventory = inventory.map(item => ({
    id: item.id,
    nama: item.nama,
    stok: item.stok,
    satuan: item.satuan,
    batas_minimum: item.batasMinimum,
    harga_beli: item.hargaBeli,
    harga_jual: item.hargaJual
  }));

  const mappedCustomers = customers.map(c => ({
    id: c.id,
    nama: c.nama,
    perusahaan: c.perusahaan,
    telepon: c.telepon,
    alamat: c.alamat,
    total_wo: c.totalWo
  }));

  if (usingServiceRole) {
    console.log('Pakai service-role key — bypass RLS tanpa login.');
  } else {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.error('Pakai anon key tanpa SUPABASE_ADMIN_EMAIL & SUPABASE_ADMIN_PASSWORD di env.');
      console.error('Set keduanya, atau pakai SUPABASE_SERVICE_ROLE_KEY untuk bypass RLS.');
      process.exit(1);
    }
    console.log('Login admin untuk melewati RLS...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (authError) {
      console.error('Gagal login ke Supabase:', authError.message);
      return;
    }
    console.log('Login berhasil! Token:', authData.session?.access_token ? 'OK' : 'FAIL');
  }

  console.log(`Menyiapkan ${mappedInventory.length} data inventory...`);
  if (mappedInventory.length > 0) {
    const { error } = await supabase.from('inventory').upsert(mappedInventory);
    if (error) {
      console.error('Error insert inventory:', error.message);
    } else {
      console.log('✅ Inventory berhasil di-export ke Supabase!');
    }
  }

  console.log(`Menyiapkan ${mappedCustomers.length} data customers...`);
  if (mappedCustomers.length > 0) {
    const { error } = await supabase.from('customers').upsert(mappedCustomers);
    if (error) {
      console.error('Error insert customers:', error.message);
    } else {
      console.log('✅ Customers berhasil di-export ke Supabase!');
    }
  }
}

seed();
