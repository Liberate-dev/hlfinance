# PRD — Aplikasi Manajemen Penjualan & Piutang HL

**Versi:** 2.1  
**Tanggal:** 08 Juni 2026  
**Status:** Final Draft  
**Basis Akuntansi:** Cash Basis  
**Mata Uang:** IDR (Rp) — tanpa PPN  

**Stack Teknologi:**

| Layer | Teknologi |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS + Shadcn UI |
| State Management | Zustand |
| Backend | ElysiaJS |
| Database | PostgreSQL via Supabase |
| Deploy Frontend | Vercel |
| Deploy Backend | Railway / Fly.io |

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Glossary](#2-glossary)
3. [Keputusan Bisnis yang Dikunci](#3-keputusan-bisnis-yang-dikunci)
4. [Fitur & Acceptance Criteria](#4-fitur--acceptance-criteria)
5. [Logika Kalkulasi (Master Reference)](#5-logika-kalkulasi-master-reference)
6. [Skema Database](#6-skema-database)
7. [Alur Pengguna (User Flows)](#7-alur-pengguna-user-flows)
8. [Persyaratan Non-Fungsional](#8-persyaratan-non-fungsional)
9. [Out of Scope](#9-out-of-scope)

---

## 1. Ringkasan Eksekutif

Aplikasi web internal single-user untuk pemilik bisnis HL. Mengelola data pelanggan, katalog produk, pencatatan transaksi (Bon), piutang, akumulasi bonus pelanggan, dan pelaporan keuangan berbasis cash basis.

**Masalah utama yang diselesaikan:**
- Kesalahan perhitungan diskon bertingkat (cascading) yang berbeda per pelanggan
- Ongkir yang tercampur dengan omzet dan laba
- Sulitnya melacak piutang dan omzet lunas secara akurat
- Penghitungan bonus pelanggan yang manual dan rawan kesalahan

**Target pengguna:** Pemilik bisnis (single administrator), operasi harian via tablet.

---

## 2. Glossary

| Istilah | Definisi |
|---|---|
| Bon | Satu transaksi/invoice, diidentifikasi oleh Nomor Bon yang unik |
| LM / BR | Tipe produk. Setiap pelanggan memiliki set diskon terpisah per tipe |
| Harga Modal | Harga beli HL. Digunakan hanya untuk kalkulasi laba, tidak tampil ke pelanggan |
| Harga Base | Harga jual sebelum diskon |
| Diskon Bertingkat | Urutan persentase diskon yang diterapkan satu per satu, **bukan** dijumlahkan |
| Ongkir | Biaya kirim. Pass-through — ditagih ke pelanggan, tidak masuk laba |
| Omzet | Pendapatan = harga diskon × qty, tanpa ongkir. Diakui saat Lunas |
| Laba HL | Profit = (harga diskon − modal) × qty. Diakui saat Lunas |
| Piutang | Bon yang belum dibayar (status Open) |
| Lunas | Bon yang sudah dibayar penuh. Bersifat final, tidak bisa dibalik |
| Cancelled | Bon Open yang dibatalkan. Tersimpan di histori, tidak masuk laporan aktif |

---

## 3. Keputusan Bisnis yang Dikunci

| # | Keputusan | Detail |
|---|---|---|
| D1 | Ongkir & laba | Pass-through. Laba = omzet − modal. Ongkir tidak mempengaruhi laba |
| D2 | Piutang vs omzet | Pelanggan berhutang omzet + ongkir. Omzet tidak termasuk ongkir |
| D3 | Basis pengakuan | Hanya transaksi Lunas yang diakui sebagai omzet, laba, dan akumulasi bonus (cash basis) |
| D4 | Mekanisme bonus | Bonus stackable. Beberapa bonus bisa dimasukkan dalam satu Bon bonus |
| D5 | Biaya bonus | Diabaikan dalam laba — item bonus gratis tidak mengurangi Laba HL |
| D6 | Soft-delete | Pelanggan dan produk yang dihapus disembunyikan dari pilihan baru, histori tetap utuh |
| D7 | Nomor Bon | Wajib unik. Duplikat ditolak di level database |
| D8 | Format ekspor | PDF |
| D9 | Mata uang & pajak | IDR saja, tanpa PPN |
| D10 | Partial payment | **Tidak ada.** Bon langsung berstatus Lunas saat pelunasan penuh |
| D11 | Status Lunas | **Final dan tidak dapat dibalik.** Tidak ada settlement reversal |
| D12 | Status Cancelled | Hanya berlaku untuk bon berstatus Open. Bon Lunas tidak bisa dibatalkan |
| D13 | Kode unik | Customer Code dan Product Code wajib ada, unik, alphanumeric, max 10 karakter |

---

## 4. Fitur & Acceptance Criteria

### 4.1 Autentikasi

**AC-1.1** Aplikasi memerlukan login sebelum fitur apapun dapat diakses.  
**AC-1.2** Hanya ada satu akun user. Tidak ada self-registration.  
**AC-1.3** Login dengan kredensial valid mengarahkan user ke dashboard.  
**AC-1.4** Login dengan kredensial salah ditolak dengan pesan error jelas.  
**AC-1.5** Setelah 5 kali gagal login, akun terkunci selama 30 menit.  
**AC-1.6** Sesi aktif sampai logout atau expired. Opsi logout tersedia.  

---

### 4.2 Manajemen Pelanggan (CRUD)

Data pelanggan: Kode, Nama, Diskon LM, Diskon BR, Threshold Bonus.

**AC-2.1** User dapat membuat pelanggan baru dengan kode (wajib, unik, alphanumeric max 10) dan nama (wajib).  
**AC-2.2** User dapat mengedit semua field pelanggan yang ada.  
**AC-2.3** Menghapus pelanggan melakukan soft-delete: disembunyikan dari pilihan baru, semua histori transaksi tetap utuh dan tampil di laporan.  
**AC-2.4** Setiap pelanggan memiliki dua set diskon independen: satu untuk LM, satu untuk BR.  
**AC-2.5** Set diskon adalah urutan nilai persentase (misal LM = [20, 20, 10]). Urutan penting karena diskon diterapkan secara berurutan. **Maksimal 5 tingkat per set diskon.** Tombol tambah tingkat disembunyikan saat sudah mencapai 5.  
**AC-2.6** User dapat menambah, mengedit, dan menghapus tiap langkah diskon dalam satu set.  
**AC-2.7** Nilai diskon harus numerik dan antara 0–100. Input tidak valid ditolak.  
**AC-2.8** Setiap pelanggan memiliki threshold bonus (nominal Rupiah, misal Rp 10.000.000) yang digunakan oleh logika bonus di §4.5.  
**AC-2.9** Duplikat Customer Code ditolak dengan pesan error yang jelas.

**Aturan diskon bertingkat (berlaku di semua kalkulasi):**

> Diberikan harga base B dan langkah diskon [d1, d2, … dn] (%):  
> `Harga diskon = B × (1 − d1/100) × (1 − d2/100) × … × (1 − dn/100)`

**Contoh verifikasi:** B = 100, LM [20, 20, 10] → `100 × 0.8 × 0.8 × 0.9 = 57.6`. Efektif diskon 42,4%, bukan 50%.

---

### 4.3 Manajemen Produk (CRUD)

Data produk: Kode, Nama, Tipe, Harga Modal, Harga Base.

**AC-3.1** User dapat membuat, mengedit, dan menghapus produk.  
**AC-3.2** Kode produk wajib unik, alphanumeric, max 10 karakter. Duplikat ditolak.  
**AC-3.3** Tipe dibatasi hanya LM atau BR.  
**AC-3.4** Harga Modal dan Harga Base bersifat numerik dan ≥ 0.  
**AC-3.5** Harga Modal hanya digunakan untuk kalkulasi Laba HL dan tidak pernah ditampilkan ke pelanggan.  
**AC-3.6** Menghapus produk melakukan soft-delete: disembunyikan dari pilihan baru, histori tetap utuh.  

---

### 4.4 Manajemen Transaksi / Bon (CRUD)

Data Bon: Tanggal, Nomor Bon, Pelanggan, Item produk, Ongkir, Deskripsi, Status Bonus, Status.

**AC-4.1** Field tanggal default ke hari ini dan dapat diubah.  
**AC-4.2** Nomor Bon wajib diisi dan unik. Menyimpan duplikat ditolak dengan pesan error jelas.  
**AC-4.3** Pelanggan dipilih dari daftar pelanggan aktif (bukan input bebas).  
**AC-4.4** Produk dipilih dari katalog produk aktif (bukan input bebas).  
**AC-4.5** Satu Bon mendukung banyak baris produk, masing-masing dengan qty ≥ 1.  
**AC-4.6** Untuk setiap baris produk, UI menampilkan tipe produk (LM/BR) dan harga yang berlaku (harga diskon berdasarkan set diskon pelanggan untuk tipe tersebut).  
**AC-4.7** Diskon per baris ditentukan otomatis dari pelanggan × tipe produk. User tidak menginput diskon manual di form transaksi.  
**AC-4.8** Ongkir bersifat numerik ≥ 0 dan dicatat per transaksi (bukan per baris).  
**AC-4.9** Status default ke Open saat dibuat. User dapat mengubah ke Lunas atau Cancelled.  
**AC-4.10** User dapat melihat, mengedit, dan menghapus transaksi berstatus Open.  
**AC-4.10.1** Mengedit transaksi Open merecalculate omzet, laba, dan total — **dengan aturan berikut:**
- Baris produk yang sudah ada **wajib mempertahankan `harga_base_snapshot` dan `harga_modal_snapshot` awal**, meskipun harga master produk sudah berubah sejak bon dibuat.
- Harga snapshot hanya diperbarui jika user secara eksplisit **mengganti produk** di baris tersebut (pilih produk berbeda).
- Backend wajib mengabaikan harga dari request body untuk baris existing dan menggunakan nilai snapshot yang tersimpan di database. Frontend menampilkan harga snapshot, bukan harga master terkini.
- Perubahan qty pada baris existing hanya merecalculate `qty × harga_final_unit` — tidak menarik ulang harga dari `products`.
**AC-4.11** Transaksi berstatus Lunas bersifat **read-only sepenuhnya**. Tidak ada edit, tidak ada delete.  
**AC-4.12** Transaksi berstatus Cancelled disembunyikan dari laporan aktif (Piutang, Omzet, Laba) namun tetap tersimpan di histori.  
**AC-4.13** Bon hanya bisa Cancelled jika masih berstatus Open.  
**AC-4.14** UI menampilkan nilai kalkulasi: omzet per baris, omzet transaksi (tanpa ongkir), ongkir, dan total tagihan = omzet + ongkir.

---

### 4.5 Logika Bonus

Bon bonus adalah transaksi khusus untuk memberikan produk gratis kepada pelanggan yang telah memenuhi syarat melalui akumulasi omzet lunas.

**AC-5.1** Setiap pelanggan memiliki threshold bonus (§4.2, AC-2.8).  
**AC-5.2** Sistem memelihara akumulasi omzet lunas per pelanggan, hanya menghitung transaksi berstatus Lunas.  
**AC-5.3** Bonus stackable: jumlah bonus tersedia = `floor(akumulasi omzet lunas / threshold) − bonus yang sudah dicairkan`.  
**AC-5.4** Saat pelanggan memiliki ≥ 1 bonus tersedia, sistem menampilkan notifikasi eligibilitas beserta jumlah bonus yang bisa dicairkan.  
**AC-5.5** Bonus dicatat sebagai transaksi dengan toggle Bonus = ON. User dapat menyertakan beberapa bonus dalam satu Bon.  
**AC-5.6** Setiap bonus yang dicairkan mengkonsumsi satu threshold dari akumulasi omzet. Sisa omzet terbawa ke siklus berikutnya.  
**AC-5.7** Baris produk dalam Bon bonus diberikan gratis: omzet = 0, tidak mengurangi Laba HL.  
**AC-5.8** Bon bonus berstatus **Lunas secara otomatis** saat dibuat (barang gratis tidak bisa dihutangkan). Tidak bisa berstatus Open atau Piutang.  
**AC-5.9** Bon bonus ditampilkan secara berbeda dari transaksi penjualan biasa di semua daftar dan rekap, agar tidak menggelembungkan angka pendapatan.

**Contoh skenario:**

> Pelanggan A, threshold = Rp 10.000.000  
> Akumulasi omzet lunas = Rp 25.000.000, belum ada bonus dicairkan  
> → Tersedia 2 bonus (floor(25/10) = 2)  
> User membuat 1 Bon bonus dengan 2 bonus  
> → Rp 20.000.000 dikonsumsi (2 × threshold)  
> → Rp 5.000.000 terbawa ke siklus berikutnya  
> → Produk bonus gratis → omzet = 0, laba = 0

---

### 4.6 Halaman Detail Pelanggan

**AC-6.1** Halaman ini menampilkan daftar transaksi pelanggan yang dikelompokkan per bulan (dapat dipilih bulan/tahun).  
**AC-6.2** Memilih bulan menampilkan, untuk bulan tersebut:
- Daftar Bon dengan tanggal, Nomor Bon, status, dan jumlah tagihan — **ditampilkan dengan pagination 20 item per halaman**. Ini wajib diterapkan untuk menjaga performa di perangkat tablet (Huawei MatePad 11.5 S atau setara). Render semua baris sekaligus tanpa pagination tidak diperbolehkan.
- Total Piutang (jumlah tagihan Bon Open = omzet + ongkir)
- Total Sudah Dibayar (jumlah tagihan Bon Lunas = omzet + ongkir)
- Total Omzet (Σ omzet Bon Lunas, tanpa ongkir)
- Total Laba HL (Σ laba Bon Lunas)

> Angka summary (Total Piutang, Total Omzet, dll) dihitung dari **semua** Bon di bulan tersebut — bukan hanya dari halaman yang sedang aktif.

**AC-6.3** Omzet ditampilkan dengan kolom LM dan BR terpisah, plus total gabungan.  
**AC-6.4** User dapat melihat dan mengunduh (PDF) daftar Piutang dan daftar transaksi.

**Alur Pelunasan — Lunas per Bulan:**

**AC-6.5** Diberikan user sedang melihat bulan tertentu pada halaman pelanggan, ketika user klik "Sudah Lunas (Bulan Ini)", muncul modal yang meminta Tanggal Pelunasan. Saat dikonfirmasi, semua transaksi Open di bulan tersebut untuk pelanggan tersebut diubah ke status Lunas dengan tanggal yang dimasukkan, sekaligus mengisi `locked_at`.

**Alur Pelunasan — Lunas per Bon:**

**AC-6.6** Diberikan user membuka detail satu Bon, ketika user klik "Lunas", modal yang sama muncul. Saat dikonfirmasi, hanya Bon tersebut yang diubah ke Lunas.

**AC-6.7** Pelunasan memperbarui total secara langsung: Total Piutang ↓, Total Sudah Dibayar ↑, Omzet/Laba diakui ↑, akumulasi bonus ↑.  
**AC-6.8** Bon yang sudah Lunas tidak bisa dilunasi ulang dan tampil secara berbeda secara visual.  
**AC-6.9** Mengklik sebuah Bon membuka detail lengkap (baris, qty, harga, ongkir, omzet, status, tanggal lunas jika ada).

---

### 4.7 Rekap & Pelaporan

**AC-7.1** Rekap tersedia per pelanggan.  
**AC-7.2** Rekap tersedia per tipe produk (LM / BR).  
**AC-7.3** Rekap tersedia keseluruhan (semua pelanggan).  
**AC-7.4** Setiap rekap dapat difilter/dikelompokkan per bulan dan per tahun.  
**AC-7.5** Setiap rekap menampilkan minimal: Total Omzet (Lunas), Total Laba HL (Lunas), Total Piutang (outstanding), Total Sudah Dibayar — dipisah LM vs BR jika relevan.  
**AC-7.6** Rekap keseluruhan menampilkan total Laba HL lintas semua pelanggan.  
**AC-7.7** Bon bonus dikecualikan dari total omzet/pendapatan/laba (sesuai D5), dan dapat dilaporkan terpisah sebagai log bonus.  
**AC-7.8** Rekap dapat diunduh sebagai PDF.  
**AC-7.9** Kolom omzet pada rekap menggunakan `tipe_snapshot` dari `transaction_lines` sebagai acuan GROUP BY — bukan JOIN ke tabel `products` — untuk memastikan akurasi historis meski produk sudah diedit atau soft-deleted.

---

## 5. Logika Kalkulasi (Master Reference)

Ini adalah satu-satunya sumber kebenaran untuk semua kalkulasi. Implementasi tidak boleh menyimpang dari definisi ini.

| Kuantitas | Formula |
|---|---|
| Harga diskon per unit | `Harga Base × Π(1 − dᵢ/100)` atas set diskon pelanggan untuk tipe tersebut |
| Omzet per baris | `harga diskon × qty` |
| Omzet transaksi | `Σ omzet baris` (ongkir dikecualikan) |
| Total tagihan (Piutang) | `omzet transaksi + ongkir` |
| Laba per baris | `(harga diskon − harga modal) × qty` |
| Laba transaksi | `Σ laba baris` (ongkir dikecualikan — pass-through) |
| Omzet diakui (laporan) | `Σ omzet transaksi WHERE status = 'Lunas'` |
| Laba diakui (laporan) | `Σ laba transaksi WHERE status = 'Lunas'` |
| Total sudah dibayar | `Σ (omzet + ongkir) WHERE status = 'Lunas'` |
| Total piutang outstanding | `Σ (omzet + ongkir) WHERE status = 'Open'` |
| Akumulator bonus | `Σ omzet WHERE status = 'Lunas'` (per pelanggan) |
| Bonus tersedia | `floor(akumulator / threshold) − bonus sudah dicairkan` |
| Item bonus | Gratis → omzet = 0, laba = 0 |

**Aturan snapshot (wajib diterapkan saat insert `transaction_lines`):**
- `tipe_snapshot` — diambil dari tipe produk saat bon dibuat
- `harga_modal_snapshot` — diambil dari harga modal saat bon dibuat. Jika `is_bonus = true`, disimpan sebagai **0**
- `harga_base_snapshot` — diambil dari harga base saat bon dibuat
- `diskon_terapan_snapshot` — diskon set pelanggan yang dipakai saat itu (bukti audit)
- `harga_final_unit` — hasil kalkulasi harga diskon. Jika `is_bonus = true`, disimpan sebagai **0**

---

## 6. Skema Database

### 6.1 Tabel `users`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | UUID | Primary Key |
| `username` | Varchar | Unique, Not Null |
| `password_hash` | Varchar | Not Null |
| `failed_attempts` | Integer | Default 0, Not Null |
| `locked_until` | Timestamp | Nullable |

---

### 6.2 Tabel `customers`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID | Primary Key |
| `kode` | Varchar(10) | Unique, Not Null — kode unik alphanumeric |
| `nama` | Varchar | Not Null |
| `diskon_lm` | JSONB | Default '[]' — array diskon bertingkat, misal [20, 10] |
| `diskon_br` | JSONB | Default '[]' |
| `threshold_bonus` | Numeric | Default 0, Not Null |
| `created_at` | Timestamp | |
| `updated_at` | Timestamp | |
| `deleted_at` | Timestamp | Nullable — indikator soft-delete |

---

### 6.3 Tabel `products`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID | Primary Key |
| `kode` | Varchar(10) | Unique, Not Null — kode unik alphanumeric |
| `nama` | Varchar | Not Null |
| `tipe` | Varchar | Not Null — hanya 'LM' atau 'BR' |
| `harga_modal` | Numeric | Not Null, ≥ 0 |
| `harga_base` | Numeric | Not Null, ≥ 0 |
| `created_at` | Timestamp | |
| `updated_at` | Timestamp | |
| `deleted_at` | Timestamp | Nullable — indikator soft-delete |

---

### 6.4 Tabel `transactions`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID | Primary Key |
| `nomor_bon` | Varchar | Unique, Not Null |
| `tanggal` | Date | Not Null |
| `customer_id` | UUID | FK → customers.id, Not Null |
| `ongkir` | Numeric | Default 0, Not Null |
| `is_bonus` | Boolean | Default False, Not Null |
| `bonus_count` | Integer | Default 0, Not Null — jumlah jatah bonus yang dikonsumsi |
| `status` | Varchar | Default 'Open', Not Null — nilai: 'Open', 'Lunas', 'Cancelled' |
| `tanggal_lunas` | Date | Nullable |
| `locked_at` | Timestamp | Nullable — diisi otomatis saat status → Lunas |
| `deskripsi` | Text | Nullable |
| `created_at` | Timestamp | |
| `updated_at` | Timestamp | |

**Database Constraints:**

```sql
-- Bon bonus wajib langsung Lunas
CONSTRAINT chk_bonus_status
  CHECK (is_bonus = false OR (is_bonus = true AND status = 'Lunas'))

-- bonus_count harus konsisten dengan is_bonus
CONSTRAINT chk_bonus_count
  CHECK (
    (is_bonus = false AND bonus_count = 0) OR
    (is_bonus = true AND bonus_count >= 1)
  )

-- Bon Lunas dan Cancelled tidak bisa kembali ke Open
CONSTRAINT chk_status_values
  CHECK (status IN ('Open', 'Lunas', 'Cancelled'))
```

**Database Indexes:**

```sql
INDEX idx_customer_status   ON transactions(customer_id, status)
INDEX idx_tanggal_lunas     ON transactions(tanggal_lunas)
```

---

### 6.5 Tabel `transaction_lines`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID | Primary Key |
| `transaction_id` | UUID | FK → transactions.id, On Delete Cascade |
| `product_id` | UUID | FK → products.id |
| `qty` | Integer | Not Null, ≥ 1 |
| `tipe_snapshot` | Varchar | Not Null — 'LM' atau 'BR', acuan laporan LM/BR |
| `harga_modal_snapshot` | Numeric | Not Null — 0 jika is_bonus = true |
| `harga_base_snapshot` | Numeric | Not Null |
| `diskon_terapan_snapshot` | JSONB | Not Null — bukti audit diskon saat itu |
| `harga_final_unit` | Numeric | Not Null — 0 jika is_bonus = true |

**Database Index:**

```sql
INDEX idx_transaction_id_tipe ON transaction_lines(transaction_id, tipe_snapshot)
```

---

### 6.6 Database Triggers

**`trg_lock_transaction`** — mencegah UPDATE atau DELETE pada `transactions` jika `locked_at IS NOT NULL`.

```sql
CREATE OR REPLACE FUNCTION prevent_locked_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bon sudah Lunas dan tidak dapat diubah.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lock_transaction
BEFORE UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION prevent_locked_update();
```

**`trg_lock_transaction_lines`** — mencegah INSERT, UPDATE, atau DELETE pada `transaction_lines` jika bon induknya sudah `locked_at IS NOT NULL`.

> **Catatan implementasi penting:** Proses pelunasan harus melakukan satu single UPDATE yang mengisi `status = 'Lunas'`, `tanggal_lunas`, dan `locked_at` sekaligus — bukan tiga operasi terpisah.

---

## 7. Alur Pengguna (User Flows)

### 7.1 Membuat Bon Baru

1. User klik "Buat Bon Baru"
2. Pilih pelanggan dari dropdown
3. Tambah satu atau lebih baris produk:
   - Pilih produk → sistem otomatis tampilkan tipe dan harga diskon berlaku
   - Input qty
   - Sistem update subtotal baris secara real-time
4. Input ongkir (opsional, default 0)
5. Input deskripsi (opsional)
6. Review ringkasan: subtotal produk, ongkir, grand total
7. Klik "Simpan" → validasi → Bon tersimpan dengan status Open

**Validasi wajib sebelum simpan:**
- Nomor Bon diisi dan belum digunakan
- Minimal satu baris produk
- Qty ≥ 1 per baris
- Ongkir ≥ 0

---

### 7.2 Pelunasan Bon

**Per Bon:**
1. Buka detail Bon berstatus Open
2. Klik "Lunas"
3. Modal: input Tanggal Pelunasan (default hari ini)
4. Konfirmasi → sistem update status, tanggal_lunas, locked_at dalam satu operasi atomik
5. Total pelanggan diperbarui langsung

**Per Bulan (bulk):**
1. Buka halaman detail pelanggan, pilih bulan
2. Klik "Sudah Lunas (Bulan Ini)"
3. Modal: input Tanggal Pelunasan
4. Konfirmasi → semua Bon Open di bulan tersebut dilunasi dengan tanggal yang sama

---

### 7.3 Pencairan Bon Bonus

1. Sistem mendeteksi pelanggan memiliki bonus tersedia → notifikasi/flag tampil
2. User buat Bon baru, aktifkan toggle "Bonus"
3. Input `bonus_count` (berapa jatah bonus yang dikonsumsi)
4. Tambah baris produk bonus (harga = 0, tidak mengisi omzet)
5. Simpan → Bon otomatis berstatus Lunas, `locked_at` terisi

---

### 7.4 Siklus Hidup Status Bon

```
[Draft/Form] → simpan → [Open]
[Open] → lunas → [Lunas] ← final, read-only
[Open] → batalkan → [Cancelled] ← tersimpan di histori
[Lunas] → tidak ada transisi keluar
[Cancelled] → tidak ada transisi keluar
```

---

## 8. Persyaratan Non-Fungsional

### 8.1 Keamanan

**Autentikasi — JWT Cross-Domain:**
- Token JWT disimpan di **Zustand memory** (bukan localStorage, bukan sessionStorage, bukan cookie) untuk mencegah XSS.
- Setiap request API menyertakan token di header: `Authorization: Bearer <token>`
- Access token short-lived: **15 menit**. Refresh token: **7 hari**.
- Saat access token expired, frontend secara otomatis menggunakan refresh token untuk mendapatkan access token baru tanpa memaksa user login ulang.
- Saat refresh token expired atau tidak valid, user diarahkan ke halaman login.
- **Konsekuensi Zustand memory:** Token hilang saat tab/browser ditutup. User perlu login ulang saat membuka tab baru. Ini adalah trade-off yang diterima untuk keamanan.

**CORS (wajib dikonfigurasi di Elysia):**
- Backend hanya menerima request dari origin frontend yang terdaftar (whitelist eksplisit — bukan wildcard `*`).
- Header yang diizinkan: `Authorization`, `Content-Type`.

**Keamanan umum:**
- Password: minimum 8 karakter, kombinasi huruf besar, kecil, angka, dan karakter spesial. Disimpan dengan bcrypt + salt.
- Lockout: 5 kali gagal login → akun terkunci 30 menit (kolom `failed_attempts` dan `locked_until` di tabel `users`).
- HTTPS (TLS 1.2+) untuk semua komunikasi.
- Input validation ketat di sisi server dan client (mencegah SQL injection, XSS).
- Harga Modal tidak pernah dikirim ke frontend dalam response apapun.

### 8.2 Performa

- Halaman kritis (Dashboard, Daftar Transaksi): load < 2 detik
- API response untuk operasi kritis (login, simpan bon, pelunasan): < 200ms (p90)
- Generasi laporan untuk dataset bulanan tipikal: < 5 detik

### 8.3 Lokalisasi

- Bahasa: Bahasa Indonesia untuk semua teks UI, pesan, dan laporan
- Format mata uang: `Rp {angka}` dengan titik sebagai separator ribuan dan koma sebagai desimal (misal: Rp 10.000.000)
- Format tanggal: DD/MM/YYYY
- Timezone: WIB (GMT+7)

### 8.4 Aksesibilitas & UX

- Desain touch-friendly, optimal untuk tablet
- Ukuran touch target minimum 48×48 px
- Font size body minimum 14px
- Status warna harus memiliki kontras minimum 4.5:1

### 8.5 Backup & Recovery

- Backup database harian (full)
- Recovery Time Objective (RTO): 4 jam
- Recovery Point Objective (RPO): 24 jam

---

## 9. Out of Scope

Fitur-fitur berikut **tidak** dibangun dalam versi ini:

- Multi-user atau role management
- Partial payment (cicilan per bon)
- Settlement reversal (pembalikan status Lunas)
- Integrasi payment gateway
- Integrasi software akuntansi eksternal (SAP, QuickBooks, dll)
- Manajemen inventori lanjutan (multi-gudang, reorder point, FIFO/LIFO)
- Portal self-service pelanggan
- Aplikasi mobile native
- Perhitungan pajak (PPN dan sejenisnya)
- Multi-currency
- Fitur budgeting dan forecasting
- Configurable discount rules via UI (P2 — dikelola via backend/database oleh developer)
