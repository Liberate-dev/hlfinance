import { useEffect, useMemo, useState } from 'react';
import {
  Shield,
  Mail,
  Lock,
  KeyRound,
  RotateCcw,
  Users,
  Package,
  Receipt,
  Loader2,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getAdminSettings, isAdminMigrationMissingError, updateRecoverySettings } from '../lib/dataService';
import { useStore } from '../store/useStore';
import ConfirmDialog from './ui/ConfirmDialog';
import { toast } from './ui/AppToast';

type AdminSection = 'account' | 'recovery' | 'restore';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const MENU_ITEMS: {
  id: AdminSection;
  title: string;
  description: string;
  icon: typeof Mail;
  accent: string;
  iconBg: string;
}[] = [
  {
    id: 'account',
    title: 'Akun Login',
    description: 'Ubah email atau kata sandi akun yang sudah ada.',
    icon: Mail,
    accent: 'hover:border-[#002B8F]',
    iconBg: 'bg-[#002B8F]/10 text-[#002B8F]',
  },
  {
    id: 'recovery',
    title: 'Kode Pemulihan',
    description: 'Atur petunjuk dan kode untuk lupa sandi di halaman login.',
    icon: KeyRound,
    accent: 'hover:border-slate-700',
    iconBg: 'bg-slate-100 text-slate-700',
  },
  {
    id: 'restore',
    title: 'Pulihkan Data',
    description: 'Kembalikan pelanggan, produk, atau bon yang pernah dihapus.',
    icon: RotateCcw,
    accent: 'hover:border-emerald-600',
    iconBg: 'bg-emerald-50 text-emerald-700',
  },
];

export default function AdminPage() {
  const { customers, products, transactions, restoreCustomer, restoreProduct, restoreTransaction } = useStore();

  const [activeSection, setActiveSection] = useState<AdminSection | null>(null);

  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [recoveryClue, setRecoveryClue] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [confirmRecoveryCode, setConfirmRecoveryCode] = useState('');
  const [hasRecoveryCode, setHasRecoveryCode] = useState(false);

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingRecovery, setSavingRecovery] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState<{
    type: 'customer' | 'product' | 'transaction';
    id: string;
    name: string;
  } | null>(null);

  const notifyError = (msg: string) => toast(msg, 'error');
  const showSuccess = (msg: string) => toast(msg);

  const deletedCustomers = useMemo(
    () => customers.filter((c) => c.deleted_at).sort((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? '')),
    [customers]
  );
  const deletedProducts = useMemo(
    () => products.filter((p) => p.deleted_at).sort((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? '')),
    [products]
  );
  const deletedTransactions = useMemo(
    () => transactions.filter((t) => t.deleted_at).sort((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? '')),
    [transactions]
  );

  const deletedTotal = deletedCustomers.length + deletedProducts.length + deletedTransactions.length;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setCurrentEmail(user.email);
        setNewEmail(user.email);
      }

      const settings = await getAdminSettings();
      if (settings.data) {
        setRecoveryClue(settings.data.recovery_clue);
        setHasRecoveryCode(settings.data.has_recovery_code);
      } else if (settings.error) {
        if (isAdminMigrationMissingError(settings.error)) {
          setMigrationMissing(true);
        } else {
          notifyError(settings.error);
        }
      }
      setLoadingSettings(false);
    })();
  }, []);

  const handleSaveAccount = async () => {
    const emailChanged = newEmail.trim().toLowerCase() !== currentEmail.toLowerCase();
    const passwordChanged = newPassword.length > 0;

    if (!emailChanged && !passwordChanged) {
      notifyError('Tidak ada perubahan untuk disimpan.');
      return;
    }
    if (!currentPassword.trim()) {
      notifyError('Masukkan kata sandi saat ini untuk konfirmasi.');
      return;
    }
    if (passwordChanged) {
      if (newPassword.length < 8) {
        notifyError('Kata sandi baru minimal 8 karakter.');
        return;
      }
      if (newPassword !== confirmPassword) {
        notifyError('Konfirmasi kata sandi tidak cocok.');
        return;
      }
    }

    setSavingAccount(true);
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword,
    });
    if (verifyError) {
      notifyError('Kata sandi saat ini salah.');
      setSavingAccount(false);
      return;
    }

    if (emailChanged) {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) {
        notifyError(error.message);
        setSavingAccount(false);
        return;
      }
      setCurrentEmail(newEmail.trim());
    }

    if (passwordChanged) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        notifyError(error.message);
        setSavingAccount(false);
        return;
      }
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSavingAccount(false);
    showSuccess('Pengaturan akun berhasil disimpan.');
  };

  const handleSaveRecovery = async () => {
    if (!recoveryClue.trim()) {
      notifyError('Petunjuk kode wajib diisi agar bisa dibaca saat lupa sandi.');
      return;
    }

    const codeFilled = recoveryCode.trim().length > 0;
    if (codeFilled) {
      if (recoveryCode !== confirmRecoveryCode) {
        notifyError('Konfirmasi kode pemulihan tidak cocok.');
        return;
      }
      if (recoveryCode.length < 6) {
        notifyError('Kode pemulihan minimal 6 karakter.');
        return;
      }
    } else if (!hasRecoveryCode) {
      notifyError('Kode pemulihan wajib diisi untuk pertama kali.');
      return;
    }

    setSavingRecovery(true);
    const { error } = await updateRecoverySettings(recoveryClue, codeFilled ? recoveryCode : undefined);
    setSavingRecovery(false);

    if (error) {
      notifyError(error);
      return;
    }

    if (codeFilled) setHasRecoveryCode(true);
    setRecoveryCode('');
    setConfirmRecoveryCode('');
    showSuccess('Pengaturan kode pemulihan berhasil disimpan.');
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    const err = restoreTarget.type === 'customer'
      ? await restoreCustomer(restoreTarget.id)
      : restoreTarget.type === 'product'
        ? await restoreProduct(restoreTarget.id)
        : await restoreTransaction(restoreTarget.id);
    setRestoreTarget(null);
    if (err) {
      notifyError(err);
      return;
    }
    showSuccess(`${restoreTarget.name} berhasil dipulihkan.`);
  };

  const getMenuBadge = (id: AdminSection) => {
    if (id === 'recovery' && hasRecoveryCode) return 'Sudah diatur';
    if (id === 'restore' && deletedTotal > 0) return `${deletedTotal} item`;
    return null;
  };

  const renderAccountForm = () => (
    <section className="bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
      <div className="flex items-center gap-2 text-[#002B8F]">
        <Mail size={22} />
        <h2 className="text-xl font-black text-slate-900">Akun Login</h2>
      </div>
      <p className="text-sm font-semibold text-slate-500">
        Ubah email atau kata sandi akun yang sudah ada. Tidak membuat akun baru.
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-600 uppercase tracking-wide">Email Saat Ini</label>
          <input
            type="email"
            value={currentEmail}
            readOnly
            className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-base font-semibold text-slate-600 min-h-[48px]"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-600 uppercase tracking-wide">Email Baru</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold min-h-[48px] focus:outline-none focus:border-[#002B8F]"
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3 border-t border-slate-100 pt-5">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-600 uppercase tracking-wide">Kata Sandi Saat Ini</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Wajib untuk konfirmasi"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold min-h-[48px] focus:outline-none focus:border-[#002B8F]"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-600 uppercase tracking-wide">Kata Sandi Baru</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Kosongkan jika tidak diubah"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold min-h-[48px] focus:outline-none focus:border-[#002B8F]"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-600 uppercase tracking-wide">Konfirmasi Sandi Baru</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold min-h-[48px] focus:outline-none focus:border-[#002B8F]"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSaveAccount}
        disabled={savingAccount}
        className="flex items-center justify-center gap-2 px-8 py-3.5 bg-[#002B8F] hover:bg-[#001E66] text-white font-bold rounded-xl min-h-[48px] disabled:opacity-60"
      >
        {savingAccount ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
        Simpan Perubahan Akun
      </button>
    </section>
  );

  const renderRecoveryForm = () => (
    <section className="bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
      <div className="flex items-center gap-2 text-[#002B8F]">
        <KeyRound size={22} />
        <h2 className="text-xl font-black text-slate-900">Kode Pemulihan (Lupa Sandi)</h2>
      </div>
      <p className="text-sm font-semibold text-slate-500">
        Petunjuk ditampilkan di halaman lupa sandi. Kode dipakai untuk reset kata sandi langsung dari login.
      </p>

      {loadingSettings ? (
        <p className="text-slate-500 font-semibold">Memuat pengaturan...</p>
      ) : (
        <>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-600 uppercase tracking-wide">Petunjuk / Clue untuk User</label>
            <textarea
              rows={3}
              value={recoveryClue}
              onChange={(e) => setRecoveryClue(e.target.value)}
              placeholder="Contoh: Kode ada di buku catatan halaman 12"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold resize-none focus:outline-none focus:border-[#002B8F]"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-600 uppercase tracking-wide">
                Kode Pemulihan {hasRecoveryCode ? '(kosongkan jika tidak diubah)' : '(wajib)'}
              </label>
              <input
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold min-h-[48px] focus:outline-none focus:border-[#002B8F]"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-600 uppercase tracking-wide">Konfirmasi Kode</label>
              <input
                type="text"
                value={confirmRecoveryCode}
                onChange={(e) => setConfirmRecoveryCode(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold min-h-[48px] focus:outline-none focus:border-[#002B8F]"
              />
            </div>
          </div>

          {hasRecoveryCode && (
            <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              Kode pemulihan sudah diatur. Isi ulang hanya jika ingin mengganti kode.
            </p>
          )}

          <button
            type="button"
            onClick={handleSaveRecovery}
            disabled={savingRecovery || migrationMissing}
            className="flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl min-h-[48px] disabled:opacity-60"
          >
            {savingRecovery ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
            Simpan Kode Pemulihan
          </button>
        </>
      )}
    </section>
  );

  const renderRestoreForm = () => (
    <section className="bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
      <div className="flex items-center gap-2 text-[#002B8F]">
        <RotateCcw size={22} />
        <h2 className="text-xl font-black text-slate-900">Pulihkan Data Terhapus</h2>
      </div>
      <p className="text-sm font-semibold text-slate-500">
        Data terhapus tidak muncul di laporan atau daftar aktif. Memulihkan bon akan mengembalikan dampaknya ke omzet, piutang, dan bonus pelanggan.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-black text-slate-700">
            <Users size={18} />
            Pelanggan ({deletedCustomers.length})
          </div>
          {deletedCustomers.length === 0 ? (
            <p className="text-sm text-slate-400 font-semibold py-4">Tidak ada pelanggan terhapus.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {deletedCustomers.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-4 border border-slate-200 rounded-xl bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{c.nama}</p>
                    <p className="text-xs font-mono text-slate-500">{c.kode}</p>
                    <p className="text-xs text-slate-400 mt-1">Dihapus: {formatDate(c.deleted_at!)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRestoreTarget({ type: 'customer', id: c.id, name: c.nama })}
                    className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg min-h-[40px]"
                  >
                    Pulihkan
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 font-black text-slate-700">
            <Package size={18} />
            Produk ({deletedProducts.length})
          </div>
          {deletedProducts.length === 0 ? (
            <p className="text-sm text-slate-400 font-semibold py-4">Tidak ada produk terhapus.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {deletedProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-4 border border-slate-200 rounded-xl bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{p.nama}</p>
                    <p className="text-xs font-mono text-slate-500">{p.kode} · {p.tipe}</p>
                    <p className="text-xs text-slate-400 mt-1">Dihapus: {formatDate(p.deleted_at!)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRestoreTarget({ type: 'product', id: p.id, name: p.nama })}
                    className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg min-h-[40px]"
                  >
                    Pulihkan
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 font-black text-slate-700">
            <Receipt size={18} />
            Bon ({deletedTransactions.length})
          </div>
          {deletedTransactions.length === 0 ? (
            <p className="text-sm text-slate-400 font-semibold py-4">Tidak ada bon terhapus.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {deletedTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-4 border border-slate-200 rounded-xl bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate font-mono">{t.nomor_bon}</p>
                    <p className="text-xs font-semibold text-slate-600 truncate">{t.customerName}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {t.tanggal} · {t.status}
                      {t.is_bonus ? ' · Bonus' : ''}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Dihapus: {formatDate(t.deleted_at!)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRestoreTarget({ type: 'transaction', id: t.id, name: t.nomor_bon })}
                    className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg min-h-[40px]"
                  >
                    Pulihkan
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  const activeMenu = MENU_ITEMS.find((item) => item.id === activeSection);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b-2 border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#002B8F]/10 text-[#002B8F] rounded-xl">
            <Shield size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin</h1>
            <p className="text-slate-500 text-base font-semibold mt-1">
              {activeSection
                ? activeMenu?.description
                : 'Pilih pengaturan yang ingin dikelola.'}
            </p>
          </div>
        </div>
      </div>

      {migrationMissing && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 text-amber-950">
          <p className="font-bold text-base">Setup database admin belum selesai</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed">
            Buka Supabase Dashboard → SQL Editor, lalu jalankan seluruh isi file{' '}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">supabase/sql-editor/08_admin_settings.sql</code>.
            Setelah berhasil, muat ulang halaman ini.
          </p>
        </div>
      )}

      {activeSection ? (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setActiveSection(null)}
            className="flex items-center gap-2 text-slate-600 hover:text-[#002B8F] font-bold text-base min-h-[48px]"
          >
            <ArrowLeft size={20} />
            Kembali ke Menu Admin
          </button>

          {activeSection === 'account' && renderAccountForm()}
          {activeSection === 'recovery' && renderRecoveryForm()}
          {activeSection === 'restore' && renderRestoreForm()}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const badge = getMenuBadge(item.id);
            const disabled = migrationMissing && item.id !== 'account';

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => !disabled && setActiveSection(item.id)}
                disabled={disabled}
                className={`group flex flex-col items-start text-left p-6 bg-white border-2 border-slate-200/80 rounded-3xl shadow-xs transition-all min-h-[11rem] ${item.accent} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}`}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className={`p-3 rounded-xl ${item.iconBg}`}>
                    <Icon size={24} />
                  </div>
                  <ChevronRight
                    size={22}
                    className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0 mt-1"
                  />
                </div>

                <div className="mt-5 space-y-2 w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-black text-slate-900">{item.title}</h2>
                    {badge && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-500 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!restoreTarget}
        title="Pulihkan Data?"
        description={restoreTarget ? `Pulihkan "${restoreTarget.name}" agar muncul kembali di daftar aktif?` : ''}
        confirmLabel="Pulihkan"
        tone="success"
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  );
}