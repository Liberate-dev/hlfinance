import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { checkLoginAllowed, resetLoginAttempts } from '../lib/dataService';

interface LoginPageProps {
  onLogin: () => void;
  onForgotPassword: () => void;
}

export default function LoginPage({ onLogin, onForgotPassword }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = username.trim();
    if (!email || !password.trim()) {
      setErrorMsg('Email dan Kata Sandi wajib diisi.');
      return;
    }

    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di .env.local');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const lockCheck = await checkLoginAllowed(email);
    if (!lockCheck.allowed) {
      setErrorMsg(lockCheck.error ?? 'Akun terkunci 30 menit.');
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg('Kredensial salah.');
      setIsSubmitting(false);
      return;
    }

    await resetLoginAttempts(email);
    if (rememberMe) {
      localStorage.setItem('hlfinance_remember', '1');
    } else {
      localStorage.removeItem('hlfinance_remember');
    }

    setIsSubmitting(false);
    onLogin();
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gradient-to-tr from-slate-100 via-blue-50/30 to-slate-100 p-4 font-sans">
      <div className="flex flex-col items-center mb-8 text-center animate-fade-in">
        <div className="w-16 h-16 bg-[#002B8F] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/10 mb-4 transform hover:scale-105 transition-transform duration-300">
          <span className="text-white font-extrabold text-2xl tracking-wider font-mono">HL</span>
        </div>
        <h1 className="text-3xl font-extrabold text-[#002B8F] tracking-tight mb-2">
          HL Finance
        </h1>
        <p className="text-gray-500 text-base font-medium">
          Silakan masuk untuk melanjutkan
        </p>
      </div>

      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-xl shadow-slate-200/80 border border-slate-100/80 p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200/90">
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMsg && (
            <div className="p-4 text-sm font-semibold text-red-600 bg-red-50 rounded-lg border border-red-100/50">
              {errorMsg}
            </div>
          )}
          {infoMsg && (
            <div className="p-4 text-sm font-semibold text-[#002B8F] bg-blue-50 rounded-lg border border-blue-100">
              {infoMsg}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="username" className="block text-base font-semibold text-gray-700 tracking-wide">
              Email
            </label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 group-focus-within:text-[#002B8F] transition-colors">
                <User size={18} />
              </span>
              <input
                id="username"
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin@hlfinance.id"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-gray-200 rounded-xl text-base font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#002B8F]/20 focus:border-[#002B8F] focus:bg-white transition-all min-h-[48px]"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-base font-semibold text-gray-700 tracking-wide">
              Kata Sandi
            </label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 group-focus-within:text-[#002B8F] transition-colors">
                <Lock size={18} />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                className="w-full pl-11 pr-14 py-3.5 bg-slate-50/50 border border-gray-200 rounded-xl text-base font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#002B8F]/20 focus:border-[#002B8F] focus:bg-white transition-all min-h-[48px]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center justify-center w-12 min-h-[48px] text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
              >
                {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-base">
            <label className="flex items-center gap-3 cursor-pointer group min-h-[48px]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-[#002B8F] focus:ring-[#002B8F] focus:ring-offset-0 transition-colors cursor-pointer"
              />
              <span className="text-gray-600 font-medium group-hover:text-gray-800 transition-colors">
                Ingat Saya
              </span>
            </label>
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setInfoMsg('');
                onForgotPassword();
              }}
              className="text-[#002B8F] hover:text-blue-800 font-semibold transition-colors min-h-[48px]"
            >
              Lupa Sandi?
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-[#002B8F] hover:bg-[#001E66] disabled:opacity-60 text-white text-base font-bold rounded-xl shadow-lg shadow-blue-900/10 hover:shadow-xl hover:shadow-blue-900/20 active:transform active:scale-[0.98] transition-all duration-150 min-h-[48px]"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            <span>{isSubmitting ? 'Memproses...' : 'Masuk Sekarang'}</span>
          </button>
        </form>
      </div>

      <div className="mt-8 text-base font-medium text-gray-500">
        Belum punya akun?{' '}
        <a
          href="#contact-admin"
          onClick={(e) => {
            e.preventDefault();
            setErrorMsg('');
            setInfoMsg('Silakan hubungi pemilik HL untuk mendaftarkan akun.');
          }}
          className="text-[#002B8F] hover:text-blue-800 font-bold transition-colors"
        >
          Hubungi Admin
        </a>
      </div>
    </div>
  );
}