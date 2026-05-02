import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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
  return eval('(' + arrayStr + ')');
}

const inventory = extractArray('_legacyInventory');
const customers = extractArray('_legacyCustomers');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

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

  console.log('Melakukan login admin untuk melewati RLS...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@altroservice.com',
    password: '4dm1n4ltr0',
  });

  if (authError) {
    console.error('Gagal login ke Supabase:', authError.message);
    return;
  }
  console.log('Login berhasil! Token:', authData.session?.access_token ? 'OK' : 'FAIL');

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
