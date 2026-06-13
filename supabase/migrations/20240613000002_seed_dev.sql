-- Optional dev seed — run after creating admin user in Supabase Auth
-- Safe to re-run: uses ON CONFLICT DO NOTHING where applicable

INSERT INTO customers (id, kode, nama, diskon_lm, diskon_br, threshold_bonus, telepon, alamat)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'HL-C01', 'Warung Mak Ijah', '[20,20,10]'::jsonb, '[20]'::jsonb, 10000000, '0812-3456-7890', 'Jl. Melati No. 45, Jakarta Selatan'),
  ('11111111-1111-1111-1111-111111111102', 'HL-C02', 'Ahmad Kurnia', '[40]'::jsonb, '[30]'::jsonb, 15000000, '0821-9876-5432', 'Ruko Baru No. 88, Blok C, Tangerang'),
  ('11111111-1111-1111-1111-111111111103', 'HL-C03', 'Bintang Pratama', '[30,15]'::jsonb, '[25]'::jsonb, 20000000, '0813-1111-2222', 'Jl. Sudirman Kav. 21, Jakarta Pusat'),
  ('11111111-1111-1111-1111-111111111104', 'HL-C04', 'Budi Santoso', '[40]'::jsonb, '[30]'::jsonb, 10000000, '0819-3333-4444', 'Jl. Industri Gg. 3 No. 12, Bekasi'),
  ('11111111-1111-1111-1111-111111111105', 'HL-C05', 'Siti Aminah', '[25,10]'::jsonb, '[15]'::jsonb, 12000000, '0852-5555-6666', 'Jl. Pahlawan No. 7, Surabaya')
ON CONFLICT (kode) DO NOTHING;

INSERT INTO products (id, kode, nama, tipe, harga_modal, harga_base)
VALUES
  ('22222222-2222-2222-2222-222222222201', 'LM-001', 'Antam Logam Mulia 10g', 'LM', 9800000, 11500000),
  ('22222222-2222-2222-2222-222222222202', 'BR-001', 'Cincin Berlian Klasik 2g', 'BR', 3200000, 4250000),
  ('22222222-2222-2222-2222-222222222203', 'BR-002', 'Kalung Rantai Hong Kong 5g', 'BR', 5500000, 6800000),
  ('22222222-2222-2222-2222-222222222204', 'LM-002', 'Antam Logam Mulia 25g', 'LM', 24000000, 28500000),
  ('22222222-2222-2222-2222-222222222205', 'LM-003', 'Antam Logam Mulia 50g', 'LM', 47500000, 56000000),
  ('22222222-2222-2222-2222-222222222206', 'BR-003', 'Gelang Emas 18K 5g', 'BR', 4200000, 5500000),
  ('22222222-2222-2222-2222-222222222207', 'BR-004', 'Anting Mutiara Premium', 'BR', 1800000, 2400000),
  ('22222222-2222-2222-2222-222222222208', 'LM-004', 'Antam Logam Mulia 5g', 'LM', 5000000, 5900000),
  ('22222222-2222-2222-2222-222222222209', 'BR-005', 'Cincin Polos Emas 22K', 'BR', 2100000, 2800000),
  ('22222222-2222-2222-2222-222222222210', 'LM-005', 'Antam Logam Mulia 100g', 'LM', 94000000, 110000000)
ON CONFLICT (kode) DO NOTHING;