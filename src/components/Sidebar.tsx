import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, AlertTriangle, HeartHandshake, PlusCircle, UserCircle, LogOut, X, Settings, Calendar, Database, ClipboardList, Mail, Check, Home } from 'lucide-react';
import SchoolLogo from './SchoolLogo';
import { Counselor } from '../types';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  activeCounselor: Counselor;
  allCounselors: Counselor[];
  onChangeCounselor?: (counselor: Counselor) => void;
  onUpdateCounselor?: (counselor: Counselor) => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  currentView,
  onNavigate,
  activeCounselor,
  allCounselors,
  onChangeCounselor,
  onUpdateCounselor,
  onLogout,
  isOpen = false,
  onClose,
}: SidebarProps) {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [name, setName] = useState(activeCounselor.name);
  const [nip, setNip] = useState(activeCounselor.nip);
  const [role, setRole] = useState(activeCounselor.role);
  const [avatar, setAvatar] = useState(activeCounselor.avatar);

  useEffect(() => {
    setName(activeCounselor.name);
    setNip(activeCounselor.nip);
    setRole(activeCounselor.role);
    setAvatar(activeCounselor.avatar);
  }, [activeCounselor]);

  const avatarPresets = [
    { name: 'Default', url: activeCounselor.avatar },
    { name: 'Pria Jas Biru', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120' },
    { name: 'Wanita Kacamata', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120' },
    { name: 'Wanita Senyum', url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=120' },
    { name: 'Pria Kemeja', url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=120' },
    { name: 'Wanita Blazer', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=120' },
    { name: 'Pria Senyum', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120' }
  ];

  const uniqueAvatars = Array.from(new Set(avatarPresets.map(a => a.url)))
    .map(url => avatarPresets.find(a => a.url === url)!)
    .filter(Boolean);

  const handleSaveProfile = () => {
    if (!name.trim()) {
      alert('Nama tidak boleh kosong.');
      return;
    }
    if (onUpdateCounselor) {
      onUpdateCounselor({
        ...activeCounselor,
        name: name.trim(),
        nip: nip.trim(),
        role: role.trim(),
        avatar: avatar
      });
      setIsProfileModalOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-xs transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside
        className={`w-64 fixed left-0 top-0 h-screen overflow-y-auto bg-white border-r border-[#bcc9c6]/30 flex flex-col p-4 gap-2 z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="mb-6 px-4 pt-2 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <SchoolLogo size={44} className="flex-shrink-0" />
            <div>
              <h1 className="text-xs font-black text-[#00685f] tracking-wider uppercase leading-none">
                Bimbingan & Konseling
              </h1>
              <p className="text-[11px] text-[#3d4947] font-bold mt-1 opacity-90 leading-none">
                SMP N 2 Susukan
              </p>
            </div>
          </div>
          {/* Close button for mobile drawer */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-[#3d4947] hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
            title="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      {/* Counselor Class Permissions Display */}
      <div className="px-4 mb-4">
        <label className="text-[10px] font-extrabold text-[#3d4947]/60 uppercase tracking-widest block mb-1.5">
          Hak Akses Bimbingan
        </label>
        <div className="p-3 bg-teal-50/50 border border-[#00685f]/15 rounded-xl">
          <p className="text-[10px] font-bold text-[#00685f] mb-1">
            {activeCounselor.allowedClasses.length === 0 ? 'Seluruh Kelas (Administrator)' : 'Kelas Bimbingan:'}
          </p>
          <div className="flex flex-wrap gap-1">
            {activeCounselor.allowedClasses.length === 0 ? (
              <span className="text-[10px] font-bold bg-[#00685f]/10 text-[#00685f] px-2 py-0.5 rounded-full">
                Akses Penuh
              </span>
            ) : (
              activeCounselor.allowedClasses.map((cls) => (
                <span key={cls} className="text-[10px] font-extrabold bg-[#00685f]/10 text-[#00685f] px-2 py-0.5 rounded">
                  {cls}
                </span>
              ))
            )}
          </div>
        </div>
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
          onClick={() => onNavigate('absensi')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            currentView === 'absensi'
              ? 'bg-[#008378] text-[#f4fffc] shadow-sm'
              : 'text-[#3d4947] hover:bg-[#d3e4fe]/40'
          }`}
        >
          <Calendar className="w-4.5 h-4.5" />
          <span>Absensi Kelas</span>
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

        <button
          onClick={() => onNavigate('jurnal-harian')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            currentView === 'jurnal-harian'
              ? 'bg-[#008378] text-[#f4fffc] shadow-sm'
              : 'text-[#3d4947] hover:bg-[#d3e4fe]/40'
          }`}
        >
          <ClipboardList className="w-4.5 h-4.5" />
          <span>Jurnal Harian</span>
        </button>

        <button
          onClick={() => onNavigate('panggilan-orang-tua')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            currentView === 'panggilan-orang-tua'
              ? 'bg-[#008378] text-[#f4fffc] shadow-sm'
              : 'text-[#3d4947] hover:bg-[#d3e4fe]/40'
          }`}
        >
          <Mail className="w-4.5 h-4.5" />
          <span>Panggilan Orang Tua</span>
        </button>

        <button
          onClick={() => onNavigate('home-visit')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            currentView === 'home-visit'
              ? 'bg-[#008378] text-[#f4fffc] shadow-sm'
              : 'text-[#3d4947] hover:bg-[#d3e4fe]/40'
          }`}
        >
          <Home className="w-4.5 h-4.5" />
          <span>Home Visit</span>
        </button>

        <button
          onClick={() => onNavigate('google-sync')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            currentView === 'google-sync'
              ? 'bg-[#008378] text-[#f4fffc] shadow-sm'
              : 'text-[#3d4947] hover:bg-[#d3e4fe]/40'
          }`}
        >
          <Database className="w-4.5 h-4.5" />
          <span>Integrasi Google</span>
        </button>

        <button
          onClick={() => onNavigate('pengaturan')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            currentView === 'pengaturan'
              ? 'bg-[#008378] text-[#f4fffc] shadow-sm'
              : 'text-[#3d4947] hover:bg-[#d3e4fe]/40'
          }`}
        >
          <Settings className="w-4.5 h-4.5" />
          <span>Pengaturan</span>
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
            setIsProfileModalOpen(true);
          }}
          className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-[#3d4947] hover:bg-[#d3e4fe]/40 rounded-xl transition-colors cursor-pointer text-left w-full"
        >
          <UserCircle className="w-4.5 h-4.5 text-[#3d4947]" />
          <span>Profil Saya</span>
        </button>

        <button
          onClick={() => {
            if (confirm('Apakah Anda yakin ingin keluar dari aplikasi?')) {
              onLogout();
            }
          }}
          className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-[#ba1a1a] hover:bg-[#ffdad6]/40 rounded-xl transition-colors cursor-pointer text-left w-full"
        >
          <LogOut className="w-4.5 h-4.5" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>

    {/* Profil Saya Modal */}
    {isProfileModalOpen && (
      <div className="fixed inset-0 bg-black/60 z-[9999] backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200" id="profile-modal-overlay">
        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200" id="profile-modal-container">
          {/* Modal Header with Accent */}
          <div className="bg-[#00685f] p-6 text-white relative">
            <button 
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-4">
              <div className="relative">
                <img 
                  src={avatar} 
                  alt={name} 
                  className="w-16 h-16 rounded-full border-2 border-white object-cover shadow-md"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute -bottom-1 -right-1 bg-teal-500 text-white p-1 rounded-full text-[9px] border border-white font-bold">
                  BK
                </div>
              </div>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight">{name || 'Nama Belum Diisi'}</h3>
                <p className="text-xs text-teal-100 font-semibold uppercase tracking-wider">{role || 'Guru BK'}</p>
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5">
            {/* Profile Fields */}
            <div className="space-y-4">
              {/* Nama Lengkap */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#3d4947] mb-1.5">
                  Nama Lengkap &amp; Gelar
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00685f]/30 focus:border-[#00685f] transition-all font-sans"
                  placeholder="Masukkan nama lengkap"
                />
              </div>

              {/* NIP */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#3d4947] mb-1.5">
                  Nomor Induk Pegawai (NIP)
                </label>
                <input
                  type="text"
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00685f]/30 focus:border-[#00685f] transition-all font-sans"
                  placeholder="Contoh: NIP. 1993..."
                />
              </div>

              {/* Jabatan/Role */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#3d4947] mb-1.5">
                  Jabatan / Peran BK
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00685f]/30 focus:border-[#00685f] transition-all font-sans"
                  placeholder="Contoh: Guru Pembimbing Kelas 8"
                />
              </div>

              {/* Predefined Avatars Selector */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#3d4947] mb-2">
                  Pilih Avatar Profil
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {uniqueAvatars.map((preset, index) => {
                    const isSelected = avatar === preset.url;
                    return (
                      <button
                        key={index}
                        onClick={() => setAvatar(preset.url)}
                        type="button"
                        className={`relative w-11 h-11 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-[#00685f] scale-105 ring-2 ring-[#00685f]/20 shadow-md' 
                            : 'border-transparent hover:border-gray-300'
                        }`}
                        title={preset.name}
                      >
                        <img 
                          src={preset.url} 
                          alt={preset.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-[#00685f]/40 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white font-black stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Kelas Bimbingan (Allowed Classes Display Only) */}
              <div className="pt-2 border-t border-gray-100">
                <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                  Kelas Bimbingan (Akses Kontrol)
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {activeCounselor.allowedClasses.length === 0 ? (
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-100">
                      Seluruh Kelas (Administrator)
                    </span>
                  ) : (
                    activeCounselor.allowedClasses.map((cls) => (
                      <span key={cls} className="text-[9px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                        Kelas {cls}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-4 border-t border-gray-100">
              <button
                onClick={() => setIsProfileModalOpen(false)}
                type="button"
                className="flex-1 py-2 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-[#3d4947] transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveProfile}
                type="button"
                className="flex-1 py-2 px-4 rounded-xl bg-[#00685f] hover:bg-[#00685f]/90 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
