import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  HeartHandshake,
  PlusCircle,
  UserCircle,
  LogOut,
  X,
  Settings,
  Calendar,
  Database,
  ClipboardList,
  Mail,
  Check,
  Home,
  UserPlus,
  Trash2,
  Plus,
  User,
  Award,
  FileCheck,
  Gavel,
  FileBarChart,
  ChevronDown,
  ChevronRight,
  BarChart3,
  ShieldAlert,
  Sliders,
  Sparkles,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Phone,
  Lock,
  BookOpen
} from 'lucide-react';
import SchoolLogo from './SchoolLogo';
import UserManualModal from './UserManualModal';
import PanduanBskap2022Modal from './PanduanBskap2022Modal';
import { Counselor } from '../types';
import { getSchoolConfig } from '../utils/schoolConfig';
import { isAdministrator } from '../utils/accessControl';
import { listenToAccountRequests } from '../utils/firestoreSync';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  activeCounselor: Counselor;
  allCounselors: Counselor[];
  onChangeCounselor?: (counselor: Counselor) => void;
  onUpdateCounselor?: (counselor: Counselor) => void;
  onCreateCounselor?: (counselor: Counselor) => void;
  onDeleteCounselor?: (id: string) => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  students?: any[];
  violations?: any[];
  services?: any[];
  homeVisits?: any[];
}

export default function Sidebar({
  currentView,
  onNavigate,
  activeCounselor,
  allCounselors,
  onChangeCounselor,
  onUpdateCounselor,
  onCreateCounselor,
  onDeleteCounselor,
  onLogout,
  isOpen = false,
  onClose,
  students = [],
  violations = [],
  services = [],
  homeVisits = [],
}: SidebarProps) {
  const isUserAdmin = isAdministrator(activeCounselor);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isBskapModalOpen, setIsBskapModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [name, setName] = useState(activeCounselor.name);
  const [nip, setNip] = useState(activeCounselor.nip);
  const [role, setRole] = useState(activeCounselor.role);
  const [avatar, setAvatar] = useState(activeCounselor.avatar);
  const [email, setEmail] = useState(activeCounselor.email || '');
  const [phone, setPhone] = useState(activeCounselor.phone || '');
  const [password, setPassword] = useState(activeCounselor.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [allowedClassesStr, setAllowedClassesStr] = useState(activeCounselor.allowedClasses.join(', '));
  const resolveSchoolName = () => {
    const config = getSchoolConfig(activeCounselor?.schoolId);
    return activeCounselor?.schoolName || config.schoolName || 'SMP N 2 Susukan';
  };

  const [schoolName, setSchoolName] = useState<string>(resolveSchoolName);

  // Dynamic Counter Calculations
  const [cloudPendingRequests, setCloudPendingRequests] = useState<Counselor[]>([]);

  useEffect(() => {
    if (!isUserAdmin) return;
    const unsub = listenToAccountRequests((reqs) => {
      setCloudPendingRequests(reqs.filter((r) => r.approvalStatus === 'pending'));
    });
    return () => unsub();
  }, [isUserAdmin]);

  const totalStudentsCount = students.length;
  const unhandledViolationsCount = violations.filter(v => !v.handledBy || v.handledBy === 'Belum Ditangani').length;
  const highRiskStudentsCount = students.filter(s => (s.violationPoints || 0) >= 30).length;
  const scheduledServicesCount = services.filter(s => s.status === 'Terjadwal').length;
  const pendingAccountsCount = isUserAdmin
    ? Math.max(
        (allCounselors || []).filter((c) => c.approvalStatus === 'pending').length,
        cloudPendingRequests.length
      )
    : 0;

  // Collapsible Groups State
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    dashboard: true,
    dataUtama: true,
    layanan: true,
    pengaturan: true,
  });

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    setSchoolName(resolveSchoolName());
  }, [activeCounselor]);

  useEffect(() => {
    const handleConfigUpdate = () => {
      setSchoolName(resolveSchoolName());
    };
    window.addEventListener('bk_school_config_updated', handleConfigUpdate);
    window.addEventListener('bk_school_changed', handleConfigUpdate);
    window.addEventListener('storage', handleConfigUpdate);
    return () => {
      window.removeEventListener('bk_school_config_updated', handleConfigUpdate);
      window.removeEventListener('bk_school_changed', handleConfigUpdate);
      window.removeEventListener('storage', handleConfigUpdate);
    };
  }, [activeCounselor]);

  useEffect(() => {
    setName(activeCounselor.name);
    setNip(activeCounselor.nip);
    setRole(activeCounselor.role);
    setAvatar(activeCounselor.avatar);
    setEmail(activeCounselor.email || '');
    setPhone(activeCounselor.phone || '');
    setPassword(activeCounselor.password || '');
    setAllowedClassesStr(activeCounselor.allowedClasses.join(', '));
  }, [activeCounselor]);

  // Auto-expand group if active view belongs to it
  useEffect(() => {
    if (['dashboard', 'jurnal-harian'].includes(currentView)) {
      setOpenGroups((prev) => ({ ...prev, dashboard: true }));
    } else if (['data-siswa', 'absensi'].includes(currentView)) {
      setOpenGroups((prev) => ({ ...prev, dataUtama: true }));
    } else if (['pelanggaran', 'pembinaan-pendisiplinan', 'apresiasi', 'layanan-bk', 'tambah-layanan', 'home-visit', 'panggilan-ortu', 'asesmen-bk'].includes(currentView)) {
      setOpenGroups((prev) => ({ ...prev, layanan: true }));
    } else if (['laporan-rekap', 'laporan', 'studio-pdf', 'pdf-maker', 'google-sync', 'pengaturan'].includes(currentView)) {
      setOpenGroups((prev) => ({ ...prev, pengaturan: true }));
    }
  }, [currentView]);

  const handleSaveProfile = () => {
    if (!name.trim()) {
      alert('Nama tidak boleh kosong.');
      return;
    }
    
    // All counselors can freely manage their own class assignments (kelas binaan)
    const parsedClasses = allowedClassesStr
      .split(',')
      .map(c => c.trim().toUpperCase())
      .filter(c => c.length > 0);

    if (onUpdateCounselor) {
      onUpdateCounselor({
        ...activeCounselor,
        name: name.trim(),
        nip: nip.trim(),
        role: role.trim() || activeCounselor.role,
        avatar: avatar,
        email: email.trim(),
        phone: phone.trim(),
        password: password.trim() || activeCounselor.password,
        allowedClasses: parsedClasses
      });
      setIsProfileModalOpen(false);
      alert('Profil dan kelas binaan Anda berhasil diperbarui!');
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
        className={`w-72 sm:w-80 lg:w-64 max-w-[85vw] fixed left-0 top-0 h-screen overflow-y-auto bg-white border-r border-[#bcc9c6]/30 flex flex-col p-3.5 gap-2 z-50 transition-transform duration-300 custom-scrollbar shadow-2xl lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="mb-3 px-1 pt-1 flex justify-between items-center">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <SchoolLogo size={38} className="flex-shrink-0" schoolId={activeCounselor?.schoolId} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-[#00685f] tracking-wider uppercase leading-tight">
                  SIKAP-BK
                </span>
                <span className="text-[8px] font-extrabold bg-[#00685f]/10 text-[#00685f] px-1 py-0.2 rounded shrink-0">
                  v2.6
                </span>
              </div>
              <p className="text-[10px] sm:text-[10.5px] text-[#3d4947] font-bold opacity-90 leading-tight line-clamp-2 break-words" title={schoolName}>
                {schoolName}
              </p>
            </div>
          </div>
          {/* Close button for mobile drawer */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors ml-1 shrink-0 bg-gray-50 border border-gray-200"
            title="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Counselor Class Permissions Display */}
        <div className="px-1 mb-2">
          <div className="p-2.5 bg-gradient-to-r from-[#f8faf9] to-[#e6f4f1]/50 border border-[#bcc9c6]/40 rounded-xl flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-2">
              <span className="text-[9px] font-extrabold text-[#3d4947]/70 uppercase tracking-wider block">
                Hak Akses Bimbingan
              </span>
              <p className="text-[11px] font-extrabold text-[#00685f] truncate" title={activeCounselor.allowedClasses.join(', ')}>
                {activeCounselor.allowedClasses.length === 0 
                  ? 'Seluruh Rombel (Admin)' 
                  : activeCounselor.allowedClasses.length > 5
                  ? `Semua Rombel (${activeCounselor.allowedClasses[0]} - ${activeCounselor.allowedClasses[activeCounselor.allowedClasses.length - 1]})`
                  : `Kelas: ${activeCounselor.allowedClasses.join(', ')}`}
              </p>
            </div>
            <span className="text-[9px] font-extrabold bg-[#00685f]/10 text-[#00685f] px-2 py-0.5 rounded-full shrink-0">
              {activeCounselor.allowedClasses.length === 0 ? 'Full' : `${activeCounselor.allowedClasses.length} Kelas`}
            </span>
          </div>
        </div>

        {/* Collapsible Grouped Navigation - Sederhana, Konsisten & Mudah Dipelajari */}
        <nav className="flex-1 flex flex-col gap-3 px-1">
          
          {/* GROUP 1: Beranda & Jurnal Harian */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => toggleGroup('dashboard')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#3d4947]/80 hover:text-[#00685f] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#00685f]" />
                <span>Beranda & Jurnal</span>
              </div>
              {openGroups.dashboard ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>

            {openGroups.dashboard && (
              <div className="pl-1.5 space-y-1 border-l-2 border-[#00685f]/15 ml-2.5">
                {/* 1.1 Dashboard Utama */}
                <button
                  onClick={() => onNavigate('dashboard')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    currentView === 'dashboard'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <LayoutDashboard className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block leading-tight">Dashboard</span>
                      <span className={`text-[10px] block leading-tight truncate ${currentView === 'dashboard' ? 'text-teal-100 font-medium' : 'text-gray-400'}`}>
                        Ikhtisar & Kasus Perlu Tindakan
                      </span>
                    </div>
                  </div>
                </button>

                {/* 1.2 Jurnal Harian */}
                <button
                  onClick={() => onNavigate('jurnal-harian')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    currentView === 'jurnal-harian'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ClipboardList className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block leading-tight">Jurnal Harian</span>
                      <span className={`text-[10px] block leading-tight truncate ${currentView === 'jurnal-harian' ? 'text-teal-100 font-medium' : 'text-gray-400'}`}>
                        Catatan Aktivitas Hari Ini
                      </span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ml-1 ${currentView === 'jurnal-harian' ? 'bg-white/20 text-white' : 'bg-teal-50 text-[#00685f]'}`}>
                    Hari Ini
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* GROUP 2: Siswa & Presensi */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => toggleGroup('dataUtama')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#3d4947]/80 hover:text-[#00685f] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#00685f]" />
                <span>Siswa & Presensi</span>
              </div>
              {openGroups.dataUtama ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>

            {openGroups.dataUtama && (
              <div className="pl-1.5 space-y-1 border-l-2 border-[#00685f]/15 ml-2.5">
                {/* 2.1 Data Siswa */}
                <button
                  onClick={() => onNavigate('data-siswa')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    currentView === 'data-siswa'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Users className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block leading-tight">Data Siswa</span>
                      <span className={`text-[10px] block leading-tight truncate ${currentView === 'data-siswa' ? 'text-teal-100 font-medium' : 'text-gray-400'}`}>
                        Profil, Poin & Dossier
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ml-1 ${currentView === 'data-siswa' ? 'bg-white/20 text-white' : 'bg-[#00685f]/10 text-[#00685f]'}`}>
                    {totalStudentsCount}
                  </span>
                </button>

                {/* 2.2 Absensi Kelas */}
                <button
                  onClick={() => onNavigate('absensi')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    currentView === 'absensi'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block leading-tight">Absensi Kelas</span>
                      <span className={`text-[10px] block leading-tight truncate ${currentView === 'absensi' ? 'text-teal-100 font-medium' : 'text-gray-400'}`}>
                        Presensi Harian Rombel
                      </span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ml-1 ${currentView === 'absensi' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    Harian
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* GROUP 3: Layanan & Kedisiplinan */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => toggleGroup('layanan')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#3d4947]/80 hover:text-[#00685f] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <HeartHandshake className="w-3.5 h-3.5 text-[#00685f]" />
                <span>Layanan & Bimbingan</span>
              </div>
              {openGroups.layanan ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>

            {openGroups.layanan && (
              <div className="pl-1.5 space-y-1 border-l-2 border-[#00685f]/15 ml-2.5">
                {/* 3.1 Layanan Konseling */}
                <button
                  onClick={() => onNavigate('layanan-bk')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    currentView === 'layanan-bk' || currentView === 'tambah-layanan' || currentView === 'home-visit' || currentView === 'panggilan-ortu'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-[#d3e4fe]/30 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <HeartHandshake className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block leading-tight">Layanan Konseling</span>
                      <span className={`text-[10px] block leading-tight truncate ${currentView === 'layanan-bk' ? 'text-teal-100 font-medium' : 'text-gray-400'}`}>
                        Sesi BK, Home Visit & Ortu
                      </span>
                    </div>
                  </div>
                  {scheduledServicesCount > 0 ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-teal-600 text-white shrink-0 ml-1">
                      {scheduledServicesCount} Jadwal
                    </span>
                  ) : (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-1 ${currentView === 'layanan-bk' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {services.length}
                    </span>
                  )}
                </button>

                {/* 3.2 Kedisiplinan & Restitusi Terpadu */}
                <button
                  onClick={() => onNavigate('pembinaan-pendisiplinan')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    currentView === 'pembinaan-pendisiplinan' || currentView === 'pelanggaran'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Gavel className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block leading-tight">Kedisiplinan & Restitusi</span>
                      <span className={`text-[10px] block leading-tight truncate ${currentView === 'pembinaan-pendisiplinan' ? 'text-teal-100 font-medium' : 'text-gray-400'}`}>
                        Tata Tertib & Kontrak Siswa
                      </span>
                    </div>
                  </div>
                  {highRiskStudentsCount > 0 ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-500 text-white shrink-0 ml-1">
                      {highRiskStudentsCount} Siaga
                    </span>
                  ) : unhandledViolationsCount > 0 ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-white shrink-0 ml-1 animate-pulse">
                      {unhandledViolationsCount} Kasus
                    </span>
                  ) : (
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ml-1 ${currentView === 'pembinaan-pendisiplinan' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                      Tertib
                    </span>
                  )}
                </button>

                {/* 3.3 Apresiasi & Prestasi */}
                <button
                  onClick={() => onNavigate('apresiasi')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    currentView === 'apresiasi'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Award className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block leading-tight">Apresiasi & Prestasi</span>
                      <span className={`text-[10px] block leading-tight truncate ${currentView === 'apresiasi' ? 'text-teal-100 font-medium' : 'text-gray-400'}`}>
                        Penghargaan Karakter Baik
                      </span>
                    </div>
                  </div>
                </button>

                {/* 3.4 Asesmen & AKD */}
                <button
                  onClick={() => onNavigate('asesmen-bk')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    currentView === 'asesmen-bk'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileCheck className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block leading-tight">Asesmen & AKD</span>
                      <span className={`text-[10px] block leading-tight truncate ${currentView === 'asesmen-bk' ? 'text-teal-100 font-medium' : 'text-gray-400'}`}>
                        Kebutuhan Siswa & Gaya Belajar
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* GROUP 4: Laporan & Pengaturan */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => toggleGroup('pengaturan')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#3d4947]/80 hover:text-[#00685f] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#00685f]" />
                <span>Laporan & Pengaturan</span>
              </div>
              {openGroups.pengaturan ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>

            {openGroups.pengaturan && (
              <div className="pl-1.5 space-y-1 border-l-2 border-[#00685f]/15 ml-2.5">
                {/* 4.1 Rekap Laporan & Studio PDF */}
                <button
                  onClick={() => onNavigate('laporan-rekap')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    currentView === 'laporan-rekap' || currentView === 'studio-pdf'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileBarChart className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block leading-tight">Rekap Laporan</span>
                      <span className={`text-[10px] block leading-tight truncate ${currentView === 'laporan-rekap' ? 'text-teal-100 font-medium' : 'text-gray-400'}`}>
                        Laporan Berkala & Studio PDF
                      </span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ml-1 ${currentView === 'laporan-rekap' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                    Dinas
                  </span>
                </button>

                {/* 4.2 Integrasi Google */}
                <button
                  onClick={() => onNavigate('google-sync')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    currentView === 'google-sync'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Database className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block leading-tight">Integrasi Cloud</span>
                      <span className={`text-[10px] block leading-tight truncate ${currentView === 'google-sync' ? 'text-teal-100 font-medium' : 'text-gray-400'}`}>
                        Sinkronisasi Google & Firestore
                      </span>
                    </div>
                  </div>
                </button>

                {/* 4.3 Pengaturan Akun & Profil */}
                <button
                  onClick={() => onNavigate('pengaturan')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    currentView === 'pengaturan'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Settings className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block leading-tight">{isUserAdmin ? 'Sistem & Hak Akses' : 'Pengaturan Profil'}</span>
                      <span className={`text-[10px] block leading-tight truncate ${currentView === 'pengaturan' ? 'text-teal-100 font-medium' : 'text-gray-400'}`}>
                        {isUserAdmin ? 'Kelola Akun & Rombel' : 'Data & Kata Sandi Akun'}
                      </span>
                    </div>
                  </div>
                  {pendingAccountsCount > 0 ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-white animate-pulse shrink-0 ml-1">
                      {pendingAccountsCount} ACC
                    </span>
                  ) : isUserAdmin ? (
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase shrink-0 ml-1 ${
                      currentView === 'pengaturan' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
                    }`}>
                      Admin
                    </span>
                  ) : (
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase shrink-0 ml-1 ${
                      currentView === 'pengaturan' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'
                    }`}>
                      User
                    </span>
                  )}
                </button>

                {/* 4.4 Panduan Buku & Regulasi */}
                <button
                  onClick={() => setIsBskapModalOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-[#00685f] bg-[#00685f]/5 hover:bg-[#00685f]/15 cursor-pointer border border-[#00685f]/20"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BookOpen className="w-4 h-4 shrink-0 text-[#00685f]" />
                    <div className="min-w-0 text-left">
                      <span className="text-xs font-bold block leading-tight">Panduan BK & PPKSP</span>
                      <span className="text-[10px] text-[#00685f]/70 block leading-tight">Regulasi Kemendikbudristek</span>
                    </div>
                  </div>
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-[#00685f] text-white shrink-0 ml-1">
                    Terbaru
                  </span>
                </button>

                <button
                  onClick={() => setIsManualModalOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-[#3d4947] hover:bg-teal-50 hover:text-[#00685f] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BookOpen className="w-4 h-4 shrink-0 text-[#00685f]" />
                    <div className="min-w-0 text-left">
                      <span className="text-xs font-bold block leading-tight">Buku Panduan Aplikasi</span>
                      <span className="text-[10px] text-gray-400 block leading-tight">Petunjuk Langkah Praktis</span>
                    </div>
                  </div>
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-[#00685f]/10 text-[#00685f] shrink-0 ml-1">
                    PDF
                  </span>
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Action Area & Profiles */}
        <div className="border-t border-[#bcc9c6]/20 pt-3.5 flex flex-col gap-1.5 px-1 mt-auto">
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#e6f4f1] hover:bg-[#d0ece6] text-[#00685f] border border-[#00685f]/30 rounded-xl text-xs font-extrabold transition-all cursor-pointer active:scale-98 shadow-2xs"
            title="Buka panduan lengkap dan unduh PDF dokumentasi fitur"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Panduan Aplikasi (PDF)</span>
          </button>

          <button
            onClick={() => onNavigate('tambah-layanan')}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-black transition-all shadow-2xs hover:shadow cursor-pointer active:scale-98"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Tambah Sesi Konseling</span>
          </button>

          {/* Selected Counselor display */}
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2.5 py-2 px-2.5 bg-gray-50 hover:bg-teal-50/50 rounded-xl border border-gray-200/80 cursor-pointer transition-all text-left w-full active:scale-98"
            title="Klik untuk melihat dan mengubah profil akun Anda"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-[#00685f]/10 border border-[#00685f]/30 text-[#00685f] flex items-center justify-center shrink-0 font-extrabold text-xs">
              {avatar ? (
                <img 
                  referrerPolicy="no-referrer" 
                  src={avatar} 
                  alt={activeCounselor.name} 
                  className="w-full h-full object-cover" 
                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                />
              ) : null}
              <span className="font-extrabold text-xs text-[#00685f]">
                {activeCounselor.name ? activeCounselor.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'BK'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] font-bold text-[#0b1c30] truncate">
                  {activeCounselor.name}
                </p>
                {isUserAdmin ? (
                  <span className="text-[8px] bg-purple-100 text-purple-700 font-extrabold px-1 rounded uppercase shrink-0">
                    Admin
                  </span>
                ) : (
                  <span className="text-[8px] bg-teal-100 text-teal-800 font-extrabold px-1 rounded uppercase shrink-0">
                    Guru BK
                  </span>
                )}
              </div>
              <p className="text-[9px] text-[#3d4947] truncate uppercase font-semibold opacity-70">
                {activeCounselor.role}
              </p>
            </div>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer text-left w-full border border-transparent hover:border-rose-200"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* Profil Saya Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[9999] backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200" id="profile-modal-overlay">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]" id="profile-modal-container">
            {/* Modal Header with Accent */}
            <div className="bg-[#00685f] p-6 text-white relative shrink-0">
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white flex items-center justify-center shadow-md overflow-hidden">
                    {avatar ? (
                      <img referrerPolicy="no-referrer" src={avatar} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 font-bold text-white" />
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-teal-500 text-white px-1.5 py-0.5 rounded-full text-[8px] border border-white font-extrabold uppercase">
                    {isUserAdmin ? 'Admin' : 'BK'}
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold tracking-tight truncate max-w-[240px]">{name || 'Nama Belum Diisi'}</h3>
                  <p className="text-xs text-teal-100 font-semibold uppercase tracking-wider truncate max-w-[240px]">{role || 'Guru BK'}</p>
                  <p className="text-[10px] text-teal-200/80 font-mono mt-0.5 truncate">{activeCounselor.email || activeCounselor.username}</p>
                </div>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* STATUS & HAK AKSES BANNER */}
              <div className="p-3.5 bg-slate-50 border border-gray-200/80 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                    Tipe Akun Pengguna
                  </span>
                  {isUserAdmin ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full uppercase border border-purple-200">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Full Administrator</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full uppercase border border-teal-200">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Guru Pembimbing Kelas</span>
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-[#0b1c30]">
                  {isUserAdmin 
                    ? 'Akses Penuh Seluruh Kelas (7, 8, dan 9)' 
                    : activeCounselor.allowedClasses.length > 0 
                      ? `Kelas Bimbingan: ${activeCounselor.allowedClasses.join(', ')}` 
                      : 'Seluruh Kelas'}
                </p>
                {!isUserAdmin && (
                  <p className="text-[10px] text-gray-500 font-medium">
                    Hak akses kelas bimbingan diatur secara aman oleh Administrator Utama.
                  </p>
                )}
              </div>

              {/* Profile Fields */}
              <div className="space-y-3.5">
                {/* Nama Lengkap */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#3d4947] mb-1">
                    Nama Lengkap & Gelar
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
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#3d4947] mb-1">
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

                {/* Email & No. HP */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-[#3d4947] mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00685f]/30 focus:border-[#00685f] transition-all font-sans"
                      placeholder="email@sekolah.sch.id"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-[#3d4947] mb-1">
                      No. WhatsApp
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00685f]/30 focus:border-[#00685f] transition-all font-sans"
                      placeholder="08123456789"
                    />
                  </div>
                </div>

                {/* Password / Kata Sandi */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#3d4947] mb-1">
                    Kata Sandi Akun
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 pr-10 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00685f]/30 focus:border-[#00685f] transition-all font-sans font-mono"
                      placeholder="Ubah kata sandi baru"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Class Configuration (Kelas Bimbingan / Binaan) */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-[#3d4947]">
                      Kelas Bimbingan / Binaan
                    </label>
                    <span className="text-[10px] text-[#00685f] font-bold">Bebas Dikelola</span>
                  </div>
                  <input
                    type="text"
                    value={allowedClassesStr}
                    onChange={(e) => setAllowedClassesStr(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00685f]/30 focus:border-[#00685f] transition-all font-sans"
                    placeholder="Contoh: 7A, 7B, 7C atau 8A, 8B (Kosongkan jika semua kelas)"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setAllowedClassesStr('7A, 7B, 7C, 7D, 7E, 7F')}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-teal-50 hover:text-[#00685f] text-gray-700 rounded text-[10px] font-bold transition-colors cursor-pointer border border-gray-200"
                    >
                      + Kelas 7
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllowedClassesStr('8A, 8B, 8C, 8D, 8E, 8F, 8G')}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-teal-50 hover:text-[#00685f] text-gray-700 rounded text-[10px] font-bold transition-colors cursor-pointer border border-gray-200"
                    >
                      + Kelas 8
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllowedClassesStr('9A, 9B, 9C, 9D, 9E, 9F, 9G')}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-teal-50 hover:text-[#00685f] text-gray-700 rounded text-[10px] font-bold transition-colors cursor-pointer border border-gray-200"
                    >
                      + Kelas 9
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllowedClassesStr('')}
                      className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold transition-colors cursor-pointer border border-emerald-200"
                    >
                      Semua Kelas (Akses Penuh)
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Hanya siswa dari kelas binaan ini yang ditampilkan di layanan bimbingan & rekap Anda. Kosongkan untuk akses semua kelas.
                  </p>
                </div>
              </div>

              {/* Admin Panel Quick Link */}
              {isUserAdmin && (
                <div className="pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      onNavigate('pengaturan');
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    <span>Buka Panel Manajemen Hak Akses Pengguna</span>
                  </button>
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="p-6 border-t border-gray-100 flex items-center gap-2.5 shrink-0 bg-gray-50">
              <button
                onClick={() => setIsProfileModalOpen(false)}
                type="button"
                className="flex-1 py-2 px-4 rounded-xl border border-gray-200 hover:bg-gray-100 text-xs font-bold text-[#3d4947] bg-white transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveProfile}
                type="button"
                className="flex-1 py-2 px-4 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Manual & Features Documentation Modal */}
      <UserManualModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
      />

      {/* Panduan Juknis BSKAP 2022 Modal */}
      <PanduanBskap2022Modal
        isOpen={isBskapModalOpen}
        onClose={() => setIsBskapModalOpen(false)}
      />
    </>
  );
}

