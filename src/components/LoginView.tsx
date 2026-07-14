import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, CheckCircle2, ShieldAlert, GraduationCap, ArrowRight } from 'lucide-react';
import { Counselor } from '../types';
import SchoolLogo from './SchoolLogo';
import KabupatenLogo from './KabupatenLogo';

interface LoginViewProps {
  allCounselors: (Counselor & { username?: string; password?: string })[];
  onLoginSuccess: (counselor: Counselor) => void;
}

export default function LoginView({ allCounselors, onLoginSuccess }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Username dan password wajib diisi.');
      return;
    }

    setLoading(true);

    // Simulate database lookup delay for extra polish
    setTimeout(() => {
      const matched = allCounselors.find(
        (c) => 
          c.username?.toLowerCase() === username.trim().toLowerCase() && 
          c.password === password.trim()
      );

      setLoading(false);

      if (matched) {
        onLoginSuccess(matched);
      } else {
        setError('Username atau password salah. Silakan periksa kembali atau gunakan bantuan akun simulasi di bawah.');
      }
    }, 600);
  };

  const handleAutoFill = (c: Counselor & { username?: string; password?: string }) => {
    setUsername(c.username || '');
    setPassword(c.password || '');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans" id="login-view-container">
      {/* Logos and Welcome */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center items-center gap-4 mb-4">
          <KabupatenLogo size={56} className="shadow-md border border-amber-600/10 bg-white" />
          <SchoolLogo size={56} className="shadow-md border border-teal-600/10" />
        </div>
        
        <h2 className="text-2xl font-extrabold text-[#0b1c30] tracking-tight">
          Sistem Informasi BK &amp; E-Rapor
        </h2>
        <p className="mt-1 text-sm text-[#3d4947]/80 font-semibold">
          SMP Negeri 2 Susukan
        </p>
      </div>

      {/* Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100 sm:px-10">
          <h3 className="text-lg font-bold text-[#0b1c30] mb-6 border-b pb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#00685f]" />
            <span>Masuk ke Akun Anda</span>
          </h3>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold flex gap-2 animate-shake">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-xs font-bold text-[#3d4947] uppercase tracking-wider mb-1.5">
                Username / Nama Pengguna
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-[#3d4947]/40" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-[#bcc9c6]/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] transition-all bg-slate-50/50"
                  placeholder="Masukkan username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-[#3d4947] uppercase tracking-wider mb-1.5">
                Kata Sandi (Password)
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-[#3d4947]/40" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-[#bcc9c6]/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] transition-all bg-slate-50/50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-[#00685f] hover:bg-[#005049] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00685f] transition-all cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Masuk Aplikasi</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Demo Accounts Helper Card */}
        <div className="mt-6 bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <CheckCircle2 className="w-4.5 h-4.5 text-[#00685f]" />
            <h4 className="font-extrabold text-xs text-[#0b1c30] uppercase tracking-wider">
              Akun Simulasi (Klik untuk Auto-Fill)
            </h4>
          </div>
          <p className="text-[11px] text-[#3d4947]/70 font-semibold leading-relaxed">
            Pilih salah satu akun di bawah ini untuk menguji hak akses kelas yang menjadi bimbingan masing-masing konselor:
          </p>

          <div className="grid grid-cols-1 gap-2.5">
            {allCounselors.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleAutoFill(c)}
                className="w-full text-left p-2.5 bg-slate-50 hover:bg-[#00685f]/5 border border-gray-200 hover:border-[#00685f]/30 rounded-xl transition-all flex items-center gap-3 active:scale-98"
              >
                <img
                  src={c.avatar}
                  alt={c.name}
                  className="w-8 h-8 rounded-full border object-cover flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-800 truncate">{c.name}</p>
                    <span className="text-[9px] font-semibold text-gray-400">
                      U: <strong className="text-[#00685f]">{c.username}</strong>
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <p className="text-[10px] text-gray-500 font-medium truncate">{c.role}</p>
                    <p className="text-[9px] text-gray-500 font-semibold bg-gray-100 px-1.5 py-0.2 rounded">
                      Kelas: {c.allowedClasses.length > 0 ? c.allowedClasses.join(', ') : 'Semua (Akses Penuh)'}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
