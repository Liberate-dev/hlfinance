# Supabase Setup — HL Finance

## 1. Buat project di [supabase.com](https://supabase.com)

## 2. Jalankan migration

Di Supabase Dashboard → **SQL Editor**:

> **PENTING:** Copy **isi file .sql** saja (bukan path/nama folder).  
> Jangan paste teks seperti `supabase/migrations/...` atau `npx supabase` — itu bukan SQL dan akan error `syntax error at or near "supabase"`.

Jalankan berurutan dari folder **`sql-editor/`** (lebih aman, per step):

1. `01_tables.sql` → Run → harus "Success"
2. `02_triggers.sql` → Run
3. `03_functions_helpers.sql` → Run
4. `04_functions_bon.sql` → Run
5. `05_rls_grants.sql` → Run
6. `../migrations/20240613000002_seed_dev.sql` (opsional, pelanggan + produk)
7. `06_seed_reports.sql` atau `../migrations/20240613000003_seed_reports.sql` (opsional, ~140 transaksi untuk uji laporan)

Cara copy yang benar: buka file di VS Code/Cursor → Ctrl+A → Ctrl+C → paste ke SQL Editor.

Atau pakai Supabase CLI:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## 3. Buat akun admin

Dashboard → **Authentication** → **Users** → **Add user**

- Email: email admin (dipakai di halaman login)
- Password: minimal 8 karakter (huruf besar, kecil, angka, simbol)

## 4. Environment variables

Salin `.env.example` ke `.env.local` di root project:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Nilai ada di Dashboard → **Settings** → **API**.

## 5. Deploy Vercel

Tambahkan env vars yang sama di Vercel project settings.

Di Supabase → **Authentication** → **URL Configuration**, set **Site URL** ke domain Vercel.

Opsional: **API** → restrict origins ke domain Vercel production.