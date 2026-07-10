import { LayoutDashboard, Users, AlertTriangle, HeartHandshake, PlusCircle, UserCircle, LogOut } from 'lucide-react';

interface Counselor {
  id: string;
  name: string;
  role: string;
  nip: string;
  avatar: string;
}

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  activeCounselor: Counselor;
  allCounselors: Counselor[];
  onChangeCounselor: (counselor: Counselor) => void;
}

export default function Sidebar({
  currentView,
  onNavigate,
  activeCounselor,
  allCounselors,
  onChangeCounselor,
}: SidebarProps) {
  return (
    <aside className="w-64 fixed left-0 top-0 h-screen bg-white border-r border-[#bcc9c6]/30 flex flex-col p-4 gap-2 z-50">
      <div className="mb-6 px-4 pt-2">
        <h1 className="text-xl font-bold text-[#00685f] tracking-tight">
          Sistem Informasi BK
        </h1>
        <p className="text-xs text-[#3d4947] opacity-70 font-medium">
          Gridasus
        </p>
      </div>

      {/* Counselor Selection Quick Switcher (Extremely slick feature) */}
      <div className="px-4 mb-4">
        <label className="text-[10px] font-bold text-[#3d4947]/60 uppercase tracking-widest block mb-1.5">
          Ganti Profil Konselor
        </label>
        <select
          value={activeCounselor.id}
          onChange={(e) => {
            const found = allCounselors.find((c) => c.id === e.target.value);
            if (found) onChangeCounselor(found);
          }}
          className="w-full text-xs bg-[#eff4ff] border border-[#bcc9c6]/40 rounded-lg py-1.5 px-2.5 font-medium text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 cursor-pointer"
        >
          {allCounselors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.role})
            </option>
          ))}
        </select>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-2">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            currentView === 'dashboard'
              ? 'bg-[#008378] text-[#f4fffc] shadow-sm'
              : 'text-[#3d4947] hover:bg-[#d3e4fe]/40'
          }`}
        >
          <LayoutDashboard className="w-4.5 h-4.5" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => onNavigate('data-siswa')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            currentView === 'data-siswa'
              ? 'bg-[#008378] text-[#f4fffc] shadow-sm'
              : 'text-[#3d4947] hover:bg-[#d3e4fe]/40'
          }`}
        >
          <Users className="w-4.5 h-4.5" />
          <span>Data Siswa</span>
        </button>

        <button
          onClick={() => onNavigate('pelanggaran')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            currentView === 'pelanggaran'
              ? 'bg-[#008378] text-[#f4fffc] shadow-sm'
              : 'text-[#3d4947] hover:bg-[#d3e4fe]/40'
          }`}
        >
          <AlertTriangle className="w-4.5 h-4.5" />
          <span>Pelanggaran</span>
        </button>

        <button
          onClick={() => onNavigate('layanan-bk')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            currentView === 'layanan-bk'
              ? 'bg-[#008378] text-[#f4fffc] shadow-sm'
              : 'text-[#3d4947] hover:bg-[#d3e4fe]/40'
          }`}
        >
          <HeartHandshake className="w-4.5 h-4.5" />
          <span>Layanan BK</span>
        </button>
      </nav>

      {/* Action Area & Profiles */}
      <div className="border-t border-[#bcc9c6]/20 pt-4 flex flex-col gap-1 px-2 mt-auto">
        <button
          onClick={() => onNavigate('tambah-layanan')}
          className="mb-3 w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#6b38d4] hover:bg-[#6b38d4]/90 text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-md hover:shadow-lg active:scale-97 cursor-pointer"
        >
          <PlusCircle className="w-4.5 h-4.5" />
          <span>Tambah Konseling</span>
        </button>

        {/* Selected Counselor display */}
        <div className="flex items-center gap-3 py-2 px-3 mb-2 bg-[#f8f9ff] rounded-xl border border-[#bcc9c6]/20">
          <img
            src={activeCounselor.avatar}
            alt={activeCounselor.name}
            className="w-10 h-10 rounded-full border border-[#00685f]/30 object-cover flex-shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#0b1c30] truncate">
              {activeCounselor.name}
            </p>
            <p className="text-[10px] text-[#3d4947] truncate uppercase tracking-wider font-semibold opacity-70">
              {activeCounselor.role}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            alert('Fitur Profil Saya sedang disiapkan.');
          }}
          className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-[#3d4947] hover:bg-[#d3e4fe]/40 rounded-xl transition-colors"
        >
          <UserCircle className="w-4.5 h-4.5 text-[#3d4947]" />
          <span>Profil Saya</span>
        </button>

        <button
          onClick={() => {
            if (confirm('Apakah Anda yakin ingin keluar dari aplikasi?')) {
              alert('Keluar berhasil.');
            }
          }}
          className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-[#ba1a1a] hover:bg-[#ffdad6]/40 rounded-xl transition-colors"
        >
          <LogOut className="w-4.5 h-4.5" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}
