import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  Users, 
  Plus, 
  FileBarChart, 
  Grid, 
  CheckCircle2, 
  AlertTriangle, 
  HeartHandshake, 
  MapPin, 
  Users2, 
  X,
  ChevronRight
} from 'lucide-react';

interface BottomNavBarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  studentCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentView,
  onNavigate,
  studentCount = 0,
}) => {
  const [showQuickModal, setShowQuickModal] = useState(false);

  // 3 Quick Actions as strictly requested:
  // 1. Absen Kelas: "Presensi harian: Hadir, Sakit, Izin, Alpa"
  // 2. Catat Kasus: "Masalah disiplin & tata tertib"
  // 3. Input Layanan: "Semua layanan BK: Konseling, Bimbingan, Home Visit, Rapat Kasus, dll"
  const quickActions = [
    {
      id: 'absensi',
      title: 'Absen Kelas',
      subtitle: 'Presensi harian: Hadir, Sakit, Izin, Alpa',
      icon: <CheckCircle2 className="w-5 h-5 text-teal-600" />,
      bg: 'bg-teal-50 border-teal-200 hover:bg-teal-100 text-teal-950',
      badge: 'Harian'
    },
    {
      id: 'pelanggaran',
      title: 'Catat Kasus',
      subtitle: 'Masalah disiplin & tata tertib',
      icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
      bg: 'bg-rose-50 border-rose-200 hover:bg-rose-100 text-rose-950',
      badge: 'Kasus'
    },
    {
      id: 'tambah-layanan',
      title: 'Input Layanan',
      subtitle: 'Semua layanan BK: Konseling, Bimbingan, Home Visit, Rapat Kasus, dll',
      icon: <HeartHandshake className="w-5 h-5 text-blue-600" />,
      bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-950',
      badge: 'Layanan BK'
    },
  ];

  const handleActionClick = (id: string) => {
    setShowQuickModal(false);
    onNavigate(id);
  };

  const isNavActive = (key: string) => {
    if (key === 'dashboard') return currentView === 'dashboard';
    if (key === 'data-siswa') return currentView === 'data-siswa';
    if (key === 'laporan') {
      return ['laporan-rekap', 'laporan', 'jurnal-harian', 'jurnal', 'studio-pdf'].includes(currentView);
    }
    if (key === 'lainnya') {
      return ['lainnya', 'pengaturan', 'google-sync', 'pilar-bk', 'asesmen-bk', 'rpl', 'prota', 'apresiasi'].includes(currentView);
    }
    return false;
  };

  return (
    <>
      {/* Pop-up Pilihan Cepat Modal (+ Catat) */}
      <AnimatePresence>
        {showQuickModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-[#bcc9c6]/40 shadow-2xl p-5 pb-8 sm:p-6 z-10 max-h-[90vh] overflow-y-auto"
            >
              {/* Drag bar for mobile */}
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4 sm:hidden" />

              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                    <Plus className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#0b1c30]">Mau Catat Apa Hari Ini?</h3>
                    <p className="text-xs text-gray-500 font-medium">Pilih 1 saja</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full cursor-pointer transition-colors"
                  title="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Actions List */}
              <div className="space-y-2.5">
                {quickActions.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => handleActionClick(act.id)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left cursor-pointer active:scale-98 ${act.bg}`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="p-2.5 rounded-xl bg-white shadow-2xs shrink-0 border border-black/5">
                        {act.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-[#0b1c30] leading-snug">{act.title}</p>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white/80 border border-current text-gray-600">
                            {act.badge}
                          </span>
                        </div>
                        <p className="text-xs opacity-75 mt-0.5 line-clamp-1">{act.subtitle}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
                  </button>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>💡 Data tersimpan otomatis & tersinkronisasi</span>
                <button
                  type="button"
                  onClick={() => setShowQuickModal(false)}
                  className="font-bold text-gray-600 hover:text-gray-900 cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 
        Bottom Navigation Bar - ALWAYS VISIBLE on BOTH Mobile and Laptop
        Contains exactly 4 menu items + center [+ Catat] button:
        [Beranda] [Siswa] [+ Catat] [Laporan] [Lainnya]
      */}
      <nav 
        aria-label="Navigasi Utama"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#bcc9c6]/40 shadow-xl"
      >
        <div className="max-w-2xl mx-auto flex items-center justify-around h-16 sm:h-18 px-3 relative">
          
          {/* 1. [Beranda] */}
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-all cursor-pointer select-none active:scale-95 ${
              isNavActive('dashboard') ? 'text-[#00685f]' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${isNavActive('dashboard') ? 'bg-[#00685f]/10 text-[#00685f]' : ''}`}>
              <Home className={`w-5 h-5 sm:w-6 sm:h-6 ${isNavActive('dashboard') ? 'stroke-[2.5]' : ''}`} />
            </div>
            <span className={`text-[11px] sm:text-xs mt-0.5 ${isNavActive('dashboard') ? 'font-extrabold text-[#00685f]' : 'font-semibold'}`}>
              Beranda
            </span>
          </button>

          {/* 2. [Siswa] */}
          <button
            type="button"
            onClick={() => onNavigate('data-siswa')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-all cursor-pointer select-none active:scale-95 relative ${
              isNavActive('data-siswa') ? 'text-[#00685f]' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-colors relative ${isNavActive('data-siswa') ? 'bg-[#00685f]/10 text-[#00685f]' : ''}`}>
              <Users className={`w-5 h-5 sm:w-6 sm:h-6 ${isNavActive('data-siswa') ? 'stroke-[2.5]' : ''}`} />
              {studentCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1 text-[9px] font-black bg-[#00685f] text-white rounded-full min-w-[16px] h-4 flex items-center justify-center border-2 border-white shadow-2xs">
                  {studentCount > 999 ? '999+' : studentCount}
                </span>
              )}
            </div>
            <span className={`text-[11px] sm:text-xs mt-0.5 ${isNavActive('data-siswa') ? 'font-extrabold text-[#00685f]' : 'font-semibold'}`}>
              Siswa
            </span>
          </button>

          {/* 
            3. [+ Catat]
            "Tombol [+ Catat] dibuat paling besar, warna biru, di tengah.
            Saat diklik, muncul pop-up pilihan cepat: Absen Kelas, Catat Kasus, Konseling Individual, Home Visit, Konferensi Kasus."
          */}
          <div className="flex-1 flex flex-col items-center justify-center -mt-6 sm:-mt-8">
            <button
              type="button"
              onClick={() => setShowQuickModal(!showQuickModal)}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/40 ring-4 ring-white flex items-center justify-center cursor-pointer transition-all active:scale-90 hover:scale-105 group"
              title="Tambah Catatan & Aktivitas Baru"
              aria-label="Catat Baru"
            >
              <Plus className={`w-8 h-8 sm:w-9 sm:h-9 stroke-[2.75] transition-transform duration-200 ${showQuickModal ? 'rotate-45' : 'group-hover:rotate-90'}`} />
            </button>
            <span className="text-[11px] sm:text-xs font-black text-blue-700 mt-1">
              + Catat
            </span>
          </div>

          {/* 4. [Laporan] */}
          <button
            type="button"
            onClick={() => onNavigate('laporan-rekap')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-all cursor-pointer select-none active:scale-95 ${
              isNavActive('laporan') ? 'text-[#00685f]' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${isNavActive('laporan') ? 'bg-[#00685f]/10 text-[#00685f]' : ''}`}>
              <FileBarChart className={`w-5 h-5 sm:w-6 sm:h-6 ${isNavActive('laporan') ? 'stroke-[2.5]' : ''}`} />
            </div>
            <span className={`text-[11px] sm:text-xs mt-0.5 ${isNavActive('laporan') ? 'font-extrabold text-[#00685f]' : 'font-semibold'}`}>
              Laporan
            </span>
          </button>

          {/* 5. [Lainnya] */}
          <button
            type="button"
            onClick={() => onNavigate('lainnya')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-all cursor-pointer select-none active:scale-95 ${
              isNavActive('lainnya') ? 'text-[#00685f]' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${isNavActive('lainnya') ? 'bg-[#00685f]/10 text-[#00685f]' : ''}`}>
              <Grid className={`w-5 h-5 sm:w-6 sm:h-6 ${isNavActive('lainnya') ? 'stroke-[2.5]' : ''}`} />
            </div>
            <span className={`text-[11px] sm:text-xs mt-0.5 ${isNavActive('lainnya') ? 'font-extrabold text-[#00685f]' : 'font-semibold'}`}>
              Lainnya
            </span>
          </button>

        </div>
      </nav>
    </>
  );
};

export default BottomNavBar;
