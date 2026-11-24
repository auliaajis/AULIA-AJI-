import React from 'react';
import {
  Home,
  Users,
  HeartHandshake,
  Inbox,
  Archive,
  Grid,
} from 'lucide-react';

interface BottomNavBarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  studentCount?: number;
  rujukanBaruCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentView,
  onNavigate,
  studentCount = 0,
  rujukanBaruCount = 0,
}) => {
  const isNavActive = (key: string) => {
    if (key === 'dashboard') return currentView === 'dashboard';
    if (key === 'data-siswa') return currentView === 'data-siswa';
    if (key === 'layanan') {
      return [
        'layanan-bk',
        'layanan',
        'tambah-layanan',
        'input-konseling',
        'layanan-konseling',
        'konseling',
        'form-layanan',
        'riwayat-layanan',
        'riwayat',
        'riwayat-konseling',
        'evaluasi-program',
        'evaluasi',
      ].includes(currentView);
    }
    if (key === 'rujukan-piket') {
      return ['rujukan-piket', 'rujukan', 'catat', 'catat-pelanggaran'].includes(currentView);
    }
    if (key === 'arsip-pembinaan') {
      return ['arsip-pembinaan', 'arsip-pelanggaran', 'arsip-restitusi', 'pelanggaran'].includes(currentView);
    }
    if (key === 'lainnya') {
      return [
        'lainnya',
        'menu-lainnya',
        'pengaturan',
        'google-sync',
        'backup-restore',
        'laporan-rekap',
        'laporan',
        'jurnal-harian',
        'jurnal',
        'studio-pdf',
        'pilar-bk',
        'asesmen-bk',
        'rpl',
        'prota',
        'apresiasi',
        'si-becik',
        'panggilan-ortu',
        'surat-panggilan',
      ].includes(currentView);
    }
    return false;
  };

  const navItems = [
    {
      key: 'dashboard',
      target: 'dashboard',
      label: 'Beranda',
      icon: Home,
      badge: 0,
      badgeColor: '',
    },
    {
      key: 'data-siswa',
      target: 'data-siswa',
      label: 'Siswa',
      icon: Users,
      badge: studentCount,
      badgeColor: 'bg-[#00685f]',
    },
    {
      key: 'layanan',
      target: 'layanan-bk',
      label: 'Layanan',
      icon: HeartHandshake,
      badge: 0,
      badgeColor: '',
    },
    {
      key: 'rujukan-piket',
      target: 'rujukan-piket',
      label: 'Rujukan',
      icon: Inbox,
      badge: rujukanBaruCount,
      badgeColor: 'bg-rose-600',
    },
    {
      key: 'arsip-pembinaan',
      target: 'arsip-pembinaan',
      label: 'Arsip',
      icon: Archive,
      badge: 0,
      badgeColor: '',
    },
    {
      key: 'lainnya',
      target: 'lainnya',
      label: 'Lainnya',
      icon: Grid,
      badge: 0,
      badgeColor: '',
    },
  ];

  return (
    <nav
      aria-label="Navigasi Utama BK"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#bcc9c6]/40 shadow-xl"
    >
      <div className="max-w-3xl mx-auto grid grid-cols-6 items-center h-16 sm:h-18 px-1 sm:px-3">
        {navItems.map((item) => {
          const active = isNavActive(item.key);
          const IconComponent = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.target)}
              className={`flex flex-col items-center justify-center py-1.5 transition-all cursor-pointer select-none active:scale-95 min-w-0 ${
                active ? 'text-[#00685f]' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-colors relative ${
                  active ? 'bg-[#00685f]/10 text-[#00685f]' : ''
                }`}
              >
                <IconComponent className={`w-5 h-5 sm:w-5.5 sm:h-5.5 ${active ? 'stroke-[2.5]' : ''}`} />
                {item.badge > 0 && (
                  <span
                    className={`absolute -top-1 -right-2 px-1 text-[9px] font-black ${item.badgeColor} text-white rounded-full min-w-[16px] h-4 flex items-center justify-center border-2 border-white shadow-2xs tabular-nums`}
                  >
                    {item.badge > 999 ? '999+' : item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] sm:text-xs mt-0.5 truncate max-w-full px-0.5 ${
                  active ? 'font-extrabold text-[#00685f]' : 'font-semibold'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavBar;
