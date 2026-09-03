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
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Phone,
  Lock
} from 'lucide-react';
import SchoolLogo from './SchoolLogo';
import { Counselor } from '../types';
import { getSchoolConfig } from '../utils/schoolConfig';
import { isAdministrator } from '../utils/accessControl';

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
  const [schoolName, setSchoolName] = useState(() => getSchoolConfig().schoolName);

  // Dynamic Counter Calculations
  const totalStudentsCount = students.length;
  const unhandledViolationsCount = violations.filter(v => !v.handledBy || v.handledBy === 'Belum Ditangani').length;
  const highRiskStudentsCount = students.filter(s => (s.violationPoints || 0) >= 30).length;
  const scheduledServicesCount = services.filter(s => s.status === 'Terjadwal').length;
  const pendingAccountsCount = isUserAdmin ? (allCounselors || []).filter(c => c.approvalStatus === 'pending').length : 0;

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
    const handleConfigUpdate = () => {
      setSchoolName(getSchoolConfig().schoolName);
    };
    window.addEventListener('bk_school_config_updated', handleConfigUpdate);
    return () => window.removeEventListener('bk_school_config_updated', handleConfigUpdate);
  }, []);

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
    if (['dashboard', 'jurnal-harian', 'laporan-rekap'].includes(currentView)) {
      setOpenGroups((prev) => ({ ...prev, dashboard: true }));
    } else if (['data-siswa', 'absensi'].includes(currentView)) {
      setOpenGroups((prev) => ({ ...prev, dataUtama: true }));
    } else if (['pelanggaran', 'pembinaan-pendisiplinan', 'apresiasi', 'layanan-bk', 'asesmen-bk'].includes(currentView)) {
      setOpenGroups((prev) => ({ ...prev, layanan: true }));
    } else if (['google-sync', 'pengaturan'].includes(currentView)) {
      setOpenGroups((prev) => ({ ...prev, pengaturan: true }));
    }
  }, [currentView]);

  const handleSaveProfile = () => {
    if (!name.trim()) {
      alert('Nama tidak boleh kosong.');
      return;
    }
    
    // Only admins can change allowed classes from this modal
    const parsedClasses = isUserAdmin
      ? allowedClassesStr
          .split(',')
          .map(c => c.trim().toUpperCase())
          .filter(c => c.length > 0)
      : activeCounselor.allowedClasses;

    if (onUpdateCounselor) {
      onUpdateCounselor({
        ...activeCounselor,
        name: name.trim(),
        nip: nip.trim(),
        role: isUserAdmin ? role.trim() : activeCounselor.role,
        avatar: avatar,
        email: email.trim(),
        phone: phone.trim(),
        password: password.trim() || activeCounselor.password,
        allowedClasses: parsedClasses
      });
      setIsProfileModalOpen(false);
      alert('Profil Anda berhasil diperbarui!');
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
        className={`w-64 fixed left-0 top-0 h-screen overflow-y-auto bg-white border-r border-[#bcc9c6]/30 flex flex-col p-3.5 gap-2 z-50 transition-transform duration-300 custom-scrollbar ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="mb-4 px-2 pt-2 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <SchoolLogo size={40} className="flex-shrink-0" />
            <div>
              <h1 className="text-[11px] font-black text-[#00685f] tracking-wider uppercase leading-tight">
                Bimbingan Konseling
              </h1>
              <p className="text-[11px] text-[#3d4947] font-bold opacity-80 leading-none truncate max-w-[125px]" title={schoolName}>
                {schoolName}
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
        <div className="px-2 mb-3">
          <div className="p-2.5 bg-[#f8faf9] border border-[#bcc9c6]/30 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[9px] font-extrabold text-[#3d4947]/70 uppercase tracking-wider block">
                Hak Akses Bimbingan
              </span>
              <p className="text-[11px] font-extrabold text-[#00685f]">
                {activeCounselor.allowedClasses.length === 0 ? 'Seluruh Kelas (Admin)' : `Kelas: ${activeCounselor.allowedClasses.join(', ')}`}
              </p>
            </div>
            <span className="text-[9px] font-bold bg-[#00685f]/10 text-[#00685f] px-2 py-0.5 rounded-full">
              {activeCounselor.allowedClasses.length === 0 ? 'Full' : `${activeCounselor.allowedClasses.length} Kelas`}
            </span>
          </div>
        </div>

        {/* Collapsible Grouped Navigation */}
        <nav className="flex-1 flex flex-col gap-3 px-1">
          {/* GROUP 1: Dashboard & Laporan */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => toggleGroup('dashboard')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#3d4947]/70 hover:text-[#00685f] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#00685f]" />
                <span>Dashboard & Laporan</span>
              </div>
              {openGroups.dashboard ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>

            {openGroups.dashboard && (
              <div className="pl-1.5 space-y-0.5 border-l-2 border-[#00685f]/15 ml-2.5">
                <button
                  onClick={() => onNavigate('dashboard')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentView === 'dashboard'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <LayoutDashboard className="w-4 h-4 shrink-0" />
                    <span>Dashboard</span>
                  </div>
                </button>

                <button
                  onClick={() => onNavigate('jurnal-harian')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentView === 'jurnal-harian'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ClipboardList className="w-4 h-4 shrink-0" />
                    <span>Jurnal Harian</span>
                  </div>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${currentView === 'jurnal-harian' ? 'bg-white/20 text-white' : 'bg-teal-50 text-[#00685f]'}`}>
                    Hari Ini
                  </span>
                </button>

                <button
                  onClick={() => onNavigate('laporan-rekap')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentView === 'laporan-rekap'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FileBarChart className="w-4 h-4 shrink-0" />
                    <span>Rekap Laporan</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* GROUP 2: Data Utama */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => toggleGroup('dataUtama')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#3d4947]/70 hover:text-[#00685f] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#00685f]" />
                <span>Data Utama</span>
              </div>
              {openGroups.dataUtama ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>

            {openGroups.dataUtama && (
              <div className="pl-1.5 space-y-0.5 border-l-2 border-[#00685f]/15 ml-2.5">
                <button
                  onClick={() => onNavigate('data-siswa')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentView === 'data-siswa'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 shrink-0" />
                    <span>Data Siswa</span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${currentView === 'data-siswa' ? 'bg-white/20 text-white' : 'bg-[#00685f]/10 text-[#00685f]'}`}>
                    {totalStudentsCount}
                  </span>
                </button>

                <button
                  onClick={() => onNavigate('absensi')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentView === 'absensi'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>Absensi Kelas</span>
                  </div>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${currentView === 'absensi' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    Harian
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* GROUP 3: Layanan BK & Kasus */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => toggleGroup('layanan')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#3d4947]/70 hover:text-[#00685f] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <HeartHandshake className="w-3.5 h-3.5 text-[#00685f]" />
                <span>Layanan BK & Kasus</span>
              </div>
              {openGroups.layanan ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>

            {openGroups.layanan && (
              <div className="pl-1.5 space-y-0.5 border-l-2 border-[#00685f]/15 ml-2.5">
                <button
                  onClick={() => onNavigate('pelanggaran')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentView === 'pelanggaran'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Pembinaan & Restitusi</span>
                  </div>
                  {unhandledViolationsCount > 0 ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                      {unhandledViolationsCount} Pending
                    </span>
                  ) : (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${currentView === 'pelanggaran' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      0
                    </span>
                  )}
                </button>

                <button
                  onClick={() => onNavigate('pembinaan-pendisiplinan')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentView === 'pembinaan-pendisiplinan'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Gavel className="w-4 h-4 shrink-0" />
                    <span>Pendisiplinan</span>
                  </div>
                  {highRiskStudentsCount > 0 ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-500 text-white">
                      {highRiskStudentsCount} Risk
                    </span>
                  ) : (
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${currentView === 'pembinaan-pendisiplinan' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                      Aman
                    </span>
                  )}
                </button>

                <button
                  onClick={() => onNavigate('apresiasi')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentView === 'apresiasi'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Award className="w-4 h-4 shrink-0" />
                    <span>Apresiasi & Prestasi</span>
                  </div>
                </button>

                <button
                  onClick={() => onNavigate('layanan-bk')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentView === 'layanan-bk'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-[#d3e4fe]/30 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <HeartHandshake className="w-4 h-4 shrink-0" />
                    <span>Layanan BK</span>
                  </div>
                  {scheduledServicesCount > 0 ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-teal-600 text-white">
                      {scheduledServicesCount} Terjadwal
                    </span>
                  ) : (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${currentView === 'layanan-bk' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {services.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => onNavigate('asesmen-bk')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentView === 'asesmen-bk'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FileCheck className="w-4 h-4 shrink-0" />
                    <span>Asesmen & AKD</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* GROUP 4: Pengaturan */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => toggleGroup('pengaturan')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#3d4947]/70 hover:text-[#00685f] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#00685f]" />
                <span>Pengaturan & Tools</span>
              </div>
              {openGroups.pengaturan ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>

            {openGroups.pengaturan && (
              <div className="pl-1.5 space-y-0.5 border-l-2 border-[#00685f]/15 ml-2.5">
                <button
                  onClick={() => onNavigate('google-sync')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentView === 'google-sync'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <Database className="w-4 h-4 shrink-0" />
                  <span>Integrasi Google</span>
                </button>

                <button
                  onClick={() => onNavigate('pengaturan')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentView === 'pengaturan'
                      ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                      : 'text-[#3d4947] hover:bg-gray-100/80 hover:text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Settings className="w-4 h-4 shrink-0" />
                    <span>{isUserAdmin ? 'System & Hak Akses' : 'Pengaturan Profil'}</span>
                  </div>
                  {pendingAccountsCount > 0 ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                      {pendingAccountsCount} ACC
                    </span>
                  ) : isUserAdmin ? (
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                      currentView === 'pengaturan' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
                    }`}>
                      Admin
                    </span>
                  ) : (
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                      currentView === 'pengaturan' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'
                    }`}>
                      User
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Action Area & Profiles */}
        <div className="border-t border-[#bcc9c6]/20 pt-3.5 flex flex-col gap-1.5 px-1 mt-auto">
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
                <img referrerPolicy="no-referrer" src={avatar} alt={activeCounselor.name} className="w-full h-full object-cover" />
              ) : (
                activeCounselor.name.charAt(0)
              )}
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

                {/* Admin-only Class Configuration */}
                {isUserAdmin && (
                  <div className="pt-3 border-t border-gray-100">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-[#3d4947] mb-1">
                      Kelas Bimbingan (Khusus Admin)
                    </label>
                    <input
                      type="text"
                      value={allowedClassesStr}
                      onChange={(e) => setAllowedClassesStr(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00685f]/30 focus:border-[#00685f] transition-all font-sans"
                      placeholder="Contoh: 8A, 8B, 8C (Kosongkan jika Full Admin)"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Kosongkan untuk memberikan akses penuh (Administrator) ke seluruh kelas.
                    </p>
                  </div>
                )}
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
    </>
  );
}

