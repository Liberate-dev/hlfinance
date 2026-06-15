import { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getRecoveryClue, isAdminMigrationMissingError, resetLoginAttempts, resetPasswordWithRecovery } from '../lib/dataService';

interface ForgotPasswordPageProps {
  onBack: () => void;
  onLogin: () => void;
}

export default function ForgotPasswordPage({ onBack, onLogin }: ForgotPasswordPageProps) {
  const [clue, setClue] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingClue, setLoadingClue] = useState(true);

  useEffect(() => {
    getRecoveryClue().then((res) => {
      if (res.clue) setClue(res.clue);
      if (res.error) {
        setErrorMsg(isAdminMigrationMissingError(res.error)
          ? 'Fitur lupa sandi belum aktif. Admin perlu menjalankan migrasi database terlebih dahulu.'
          : res.error);
      }
      setLoadingClue(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!recoveryCode.trim()) {
      setErrorMsg('Kode pemulihan wajib diisi.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsSubmitting(true);
    const result = await resetPasswordWithRecovery(recoveryCode, newPassword);
    if (result.error) {
      setErrorMsg(result.error);
      setIsSubmitting(false);
      return;
    }

    const email = result.email;
    if (!email) {
      setSuccessMsg('Kata sandi berhasil diperbarui. Silakan masuk dengan sandi baru.');
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: newPassword });
    setIsSubmitting(false);
    if (error) {
      setSuccessMsg('Kata sandi berhasil diperbarui. Silakan masuk dengan sandi baru.');
      return;
    }

    await resetLoginAttempts(email);
    onLogin();
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gradient-to-tr from-slate-100 via-blue-50/30 to-slate-100 p-4 font-sans">
      <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-xl shadow-slate-200/80 border border-slate-100/80 p-8">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-[#002B8F] font-bold text-base mb-6 min-h-[48px]"
        >
          <ArrowLeft size={20} />
          Kembali ke Login
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-[#002B8F] tracking-tight">Lupa Kata Sandi</h1>
          <p className="text-slate-500 text-base font-medium mt-1">
            Masukkan kode pemulihan, lalu tentukan kata sandi baru. Anda langsung masuk setelah berhasil.
          </p>
        </div>

        {loadingClue && (
          <p className="mb-6 text-sm font-semibold text-slate-400">Memuat petunjuk...</p>
        )}

        {!loadingClue && clue && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-black text-amber-800 uppercase tracking-wide mb-1">Petunjuk Kode</p>
            <p className="text-base font-semibold text-amber-950">{clue}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMsg && (
            <div className="p-4 text-sm font-semibold text-red-600 bg-red-50 rounded-lg border border-red-100">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-4 text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100">
              {successMsg}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="recovery-code" className="block text-base font-semibold text-gray-700">
              Kode Pemulihan
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                <KeyRound size={18} />
              </span>
              <input
                id="recovery-code"
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="Masukkan kode pemulihan"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl text-base font-medium min-h-[48px] focus:outline-none focus:ring-2 focus:ring-[#002B8F]/20 focus:border-[#002B8F]"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="new-password" className="block text-base font-semibold text-gray-700">
              Kata Sandi Baru
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                <Lock size={18} />
              </span>
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full pl-11 pr-14 py-3.5 bg-slate-50 border border-gray-200 rounded-xl text-base font-medium min-h-[48px] focus:outline-none focus:ring-2 focus:ring-[#002B8F]/20 focus:border-[#002B8F]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-gray-400"
                aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="block text-base font-semibold text-gray-700">
              Konfirmasi Kata Sandi Baru
            </label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi kata sandi baru"
              className="w-full px-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl text-base font-medium min-h-[48px] focus:outline-none focus:ring-2 focus:ring-[#002B8F]/20 focus:border-[#002B8F]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-4 bg-[#002B8F] hover:bg-[#001E66] disabled:opacity-60 text-white font-bold rounded-xl min-h-[48px]"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            <span>{isSubmitting ? 'Memproses...' : 'Reset Kata Sandi'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}