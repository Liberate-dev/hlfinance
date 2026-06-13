-- STEP 6 (opsional): Seed data laporan — paste SEMUA isi file ini ke SQL Editor, lalu Run
-- Prasyarat: sudah jalankan step 1-5 + seed_dev (20240613000002_seed_dev.sql)

-- Hapus seed lama: trigger lock blokir DELETE baris bon Lunas.
-- session_replication_role = replica menonaktifkan trigger sementara (aman untuk seed ulang).
SET session_replication_role = replica;
DELETE FROM transactions WHERE nomor_bon LIKE 'SEED-%';
SET session_replication_role = DEFAULT;

INSERT INTO customers (id, kode, nama, diskon_lm, diskon_br, threshold_bonus, telepon, alamat)
VALUES
  ('11111111-1111-1111-1111-111111111106', 'HL-C06', 'Toko Emas Mulia', '[35,5]'::jsonb, '[20,10]'::jsonb, 10000000, '0812-1000-0006', 'Jl. Pasar Baru No. 12, Jakarta'),
  ('11111111-1111-1111-1111-111111111107', 'HL-C07', 'CV Berlian Jaya', '[30]'::jsonb, '[25,5]'::jsonb, 15000000, '0812-1000-0007', 'Jl. Gatot Subroto 88, Bandung'),
  ('11111111-1111-1111-1111-111111111108', 'HL-C08', 'UD Sinar Mas', '[20,15]'::jsonb, '[15]'::jsonb, 12000000, '0812-1000-0008', 'Jl. Diponegoro 45, Semarang'),
  ('11111111-1111-1111-1111-111111111109', 'HL-C09', 'Galery Aurora', '[40]'::jsonb, '[35]'::jsonb, 20000000, '0812-1000-0009', 'Mall Grand Indonesia Lt. 3, Jakarta'),
  ('11111111-1111-1111-1111-111111111110', 'HL-C10', 'Hendra Wijaya', '[25]'::jsonb, '[20,10]'::jsonb, 10000000, '0812-1000-0010', 'Perumahan Griya Asri Blok B7, Tangerang'),
  ('11111111-1111-1111-1111-111111111111', 'HL-C11', 'Toko Rezeki', '[30,10]'::jsonb, '[25]'::jsonb, 15000000, '0812-1000-0011', 'Jl. Ahmad Yani 200, Surabaya'),
  ('11111111-1111-1111-1111-111111111112', 'HL-C12', 'Mitra Emas Nusantara', '[20]'::jsonb, '[20,15]'::jsonb, 10000000, '0812-1000-0012', 'Jl. Sudirman 15, Makassar'),
  ('11111111-1111-1111-1111-111111111113', 'HL-C13', 'Rina Gold Shop', '[35]'::jsonb, '[30,5]'::jsonb, 12000000, '0812-1000-0013', 'Jl. Merdeka 8, Medan'),
  ('11111111-1111-1111-1111-111111111114', 'HL-C14', 'PT Cahaya Indah', '[40,10]'::jsonb, '[30]'::jsonb, 25000000, '0812-1000-0014', 'Kawasan Industri MM2100, Bekasi'),
  ('11111111-1111-1111-1111-111111111115', 'HL-C15', 'Warung Emas Pak Joko', '[20,20]'::jsonb, '[15,10]'::jsonb, 8000000, '0812-1000-0015', 'Pasar Senen Blok A No. 5, Jakarta'),
  ('11111111-1111-1111-1111-111111111116', 'HL-C16', 'Dewi Lestari', '[30,15]'::jsonb, '[25]'::jsonb, 10000000, '0812-1000-0016', 'Jl. Pahlawan 22, Yogyakarta'),
  ('11111111-1111-1111-1111-111111111117', 'HL-C17', 'Toko Mas Abadi', '[25,10]'::jsonb, '[20]'::jsonb, 15000000, '0812-1000-0017', 'Jl. Kartini 33, Solo'),
  ('11111111-1111-1111-1111-111111111118', 'HL-C18', 'Golden Star Gallery', '[35,5]'::jsonb, '[30,10]'::jsonb, 20000000, '0812-1000-0018', 'Jl. Asia Afrika 101, Bandung'),
  ('11111111-1111-1111-1111-111111111119', 'HL-C19', 'Agung Prasetyo', '[40]'::jsonb, '[35,5]'::jsonb, 10000000, '0812-1000-0019', 'Jl. Veteran 7, Malang'),
  ('11111111-1111-1111-1111-111111111120', 'HL-C20', 'Toko Mulia Sejahtera', '[20,15,5]'::jsonb, '[20]'::jsonb, 12000000, '0812-1000-0020', 'Jl. Imam Bonjol 55, Denpasar')
ON CONFLICT (kode) DO NOTHING;

DO $$
DECLARE
  v_cust customers%ROWTYPE;
  v_prod products%ROWTYPE;
  v_tx_id UUID;
  v_omzet NUMERIC;
  v_final NUMERIC;
  v_discounts JSONB;
  v_qty INT;
  v_status TEXT;
  v_is_bonus BOOLEAN;
  v_bonus_count INT;
  v_tanggal DATE;
  v_tanggal_lunas DATE;
  v_locked TIMESTAMPTZ;
  v_nomor TEXT;
  v_seq INT := 0;
  v_year INT;
  v_month INT;
  v_tx_per_month INT;
  v_i INT;
  v_lines_count INT;
  v_line_idx INT;
  v_status_roll INT;
  v_ongkir NUMERIC;
  v_cust_ids UUID[] := ARRAY[
    '11111111-1111-1111-1111-111111111101'::UUID,
    '11111111-1111-1111-1111-111111111102'::UUID,
    '11111111-1111-1111-1111-111111111103'::UUID,
    '11111111-1111-1111-1111-111111111104'::UUID,
    '11111111-1111-1111-1111-111111111105'::UUID,
    '11111111-1111-1111-1111-111111111106'::UUID,
    '11111111-1111-1111-1111-111111111107'::UUID,
    '11111111-1111-1111-1111-111111111108'::UUID,
    '11111111-1111-1111-1111-111111111109'::UUID,
    '11111111-1111-1111-1111-111111111110'::UUID,
    '11111111-1111-1111-1111-111111111111'::UUID,
    '11111111-1111-1111-1111-111111111112'::UUID,
    '11111111-1111-1111-1111-111111111113'::UUID,
    '11111111-1111-1111-1111-111111111114'::UUID,
    '11111111-1111-1111-1111-111111111115'::UUID,
    '11111111-1111-1111-1111-111111111116'::UUID,
    '11111111-1111-1111-1111-111111111117'::UUID,
    '11111111-1111-1111-1111-111111111118'::UUID,
    '11111111-1111-1111-1111-111111111119'::UUID,
    '11111111-1111-1111-1111-111111111120'::UUID
  ];
  v_lm_prod_ids UUID[] := ARRAY[
    '22222222-2222-2222-2222-222222222201'::UUID,
    '22222222-2222-2222-2222-222222222204'::UUID,
    '22222222-2222-2222-2222-222222222205'::UUID,
    '22222222-2222-2222-2222-222222222208'::UUID,
    '22222222-2222-2222-2222-222222222210'::UUID
  ];
  v_br_prod_ids UUID[] := ARRAY[
    '22222222-2222-2222-2222-222222222202'::UUID,
    '22222222-2222-2222-2222-222222222203'::UUID,
    '22222222-2222-2222-2222-222222222206'::UUID,
    '22222222-2222-2222-2222-222222222207'::UUID,
    '22222222-2222-2222-2222-222222222209'::UUID
  ];
BEGIN
  FOR v_year IN 2024..2026 LOOP
    FOR v_month IN 1..12 LOOP
      IF v_year = 2026 AND v_month > 6 THEN
        CONTINUE;
      END IF;

      IF v_year = 2024 AND v_month = 11 THEN
        v_tx_per_month := 24;
      ELSIF v_year = 2026 AND v_month = 6 THEN
        v_tx_per_month := 14;
      ELSIF v_month IN (1, 6, 12) THEN
        v_tx_per_month := 7;
      ELSE
        v_tx_per_month := 4;
      END IF;

      FOR v_i IN 1..v_tx_per_month LOOP
        v_seq := v_seq + 1;

        SELECT * INTO v_cust
        FROM customers
        WHERE id = v_cust_ids[1 + ((v_seq - 1) % array_length(v_cust_ids, 1))];

        v_status_roll := v_seq % 20;
        v_is_bonus := false;
        v_bonus_count := 0;

        IF v_status_roll = 0 AND v_year >= 2025 AND v_month >= 3 THEN
          v_status := 'Lunas';
          v_is_bonus := true;
          v_bonus_count := 1 + (v_seq % 2);
        ELSIF v_status_roll IN (1, 2, 3) THEN
          v_status := 'Open';
        ELSIF v_status_roll = 4 THEN
          v_status := 'Cancelled';
        ELSE
          v_status := 'Lunas';
        END IF;

        v_tanggal := make_date(v_year, v_month, LEAST(28, 1 + ((v_i - 1) % 27)));
        v_tanggal_lunas := NULL;
        v_locked := NULL;

        IF v_status = 'Lunas' THEN
          IF v_i % 4 = 0 THEN
            v_tanggal_lunas := (v_tanggal + INTERVAL '5 days')::DATE;
          ELSE
            v_tanggal_lunas := v_tanggal;
          END IF;
          v_locked := v_tanggal_lunas::TIMESTAMP AT TIME ZONE 'Asia/Jakarta';
        END IF;

        v_nomor := 'SEED-' || v_year::TEXT || LPAD(v_month::TEXT, 2, '0') || '-' || LPAD(v_seq::TEXT, 4, '0');
        v_tx_id := gen_random_uuid();
        v_omzet := 0;
        v_ongkir := CASE
          WHEN v_status = 'Open' THEN 75000 + ((v_seq % 6) * 15000)
          ELSE (v_seq % 5) * 20000
        END;

        -- Insert tanpa locked_at dulu (trigger blokir UPDATE/INSERT lines jika sudah locked)
        INSERT INTO transactions (
          id, nomor_bon, tanggal, customer_id, ongkir, omzet,
          is_bonus, bonus_count, status, tanggal_lunas, locked_at, deskripsi
        ) VALUES (
          v_tx_id, v_nomor, v_tanggal, v_cust.id, v_ongkir, 0,
          v_is_bonus, v_bonus_count, v_status,
          NULL, NULL,
          'Seed laporan — transaksi contoh #' || v_seq
        );

        v_lines_count := 1 + (v_seq % 2);

        FOR v_line_idx IN 1..v_lines_count LOOP
          IF v_is_bonus THEN
            SELECT * INTO v_prod
            FROM products
            WHERE id = v_lm_prod_ids[1 + ((v_seq + v_line_idx) % array_length(v_lm_prod_ids, 1))];
            v_discounts := v_cust.diskon_lm;
            v_final := 0;
          ELSIF (v_seq + v_line_idx) % 3 = 0 THEN
            SELECT * INTO v_prod
            FROM products
            WHERE id = v_br_prod_ids[1 + ((v_seq + v_line_idx) % array_length(v_br_prod_ids, 1))];
            v_discounts := v_cust.diskon_br;
            v_final := calculate_final_price(v_prod.harga_base, v_discounts);
          ELSE
            SELECT * INTO v_prod
            FROM products
            WHERE id = v_lm_prod_ids[1 + ((v_seq + v_line_idx) % array_length(v_lm_prod_ids, 1))];
            v_discounts := v_cust.diskon_lm;
            v_final := calculate_final_price(v_prod.harga_base, v_discounts);
          END IF;

          v_qty := 1 + ((v_seq + v_line_idx) % 2);

          INSERT INTO transaction_lines (
            transaction_id, product_id, qty, tipe_snapshot,
            harga_modal_snapshot, harga_base_snapshot,
            diskon_terapan_snapshot, harga_final_unit
          ) VALUES (
            v_tx_id, v_prod.id, v_qty, v_prod.tipe,
            CASE WHEN v_is_bonus THEN 0 ELSE v_prod.harga_modal END,
            v_prod.harga_base, v_discounts, v_final
          );

          IF NOT v_is_bonus THEN
            v_omzet := v_omzet + (v_final * v_qty);
          END IF;
        END LOOP;

        UPDATE transactions SET omzet = v_omzet WHERE id = v_tx_id;

        IF v_status = 'Lunas' THEN
          UPDATE transactions
          SET tanggal_lunas = v_tanggal_lunas, locked_at = v_locked
          WHERE id = v_tx_id;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Seed laporan selesai: % transaksi dibuat (nomor_bon prefix SEED-).', v_seq;
END $$;