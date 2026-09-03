import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Bell, Calendar as CalendarIcon, Check, Menu, User, Database, Cloud, PlusCircle, ChevronDown, AlertTriangle, HeartHandshake, Home, BookOpen, Sparkles, Moon, Sun, RefreshCw, Wifi, WifiOff, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Counselor, CounselingService, ViolationRecord, Student } from '../types';
import CalendarModal from './CalendarModal';
import { getIsDarkMode, toggleDarkMode } from '../utils/theme';
import { getCloudConnectionInfo, initRealtimeFirestoreSync, forceFullCloudSync, CloudConnectionInfo } from '../utils/firestoreSync';
import { getActiveSchoolId, getSchoolConfig } from '../utils/schoolConfig';
import { isAdministrator } from '../utils/accessControl';

interface HeaderProps {
  activeCounselor: Counselor;
  allCounselors?: Counselor[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNavigateToStudent: () => void;
  onToggleSidebar?: () => void;
  services?: CounselingService[];
  violations?: ViolationRecord[];
  homeVisits?: any[];
  students?: Student[];
  onNavigateToTab?: (tab: string, query?: string) => void;
  onEditService?: (service: CounselingService) => void;
  onAddServiceOnDate?: (dateStr: string) => void;
}

export default function Header({
  activeCounselor,
  allCounselors = [],
  searchQuery,
  onSearchChange,
  onNavigateToStudent,
  onToggleSidebar,
  services = [],
  violations = [],
  homeVisits = [],
  students = [],
  onNavigateToTab,
  onEditService,
  onAddServiceOnDate,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showQuickActionMenu, setShowQuickActionMenu] = useState(false);
  const [showEarlyWarningMenu, setShowEarlyWarningMenu] = useState(false);
  const [hasClearedNotifications, setHasClearedNotifications] = useState(false);

  // High Risk Students for Early Warning Notification
  const highRiskStudents = useMemo(() => {
    return (students || [])
      .filter((s) => (s.violationPoints || 0) >= 30)
      .sort((a, b) => (b.violationPoints || 0) - (a.violationPoints || 0));
  }, [students]);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => getIsDarkMode());

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e?.detail?.isDarkMode !== undefined) {
        setIsDarkMode(e.detail.isDarkMode);
      } else {
        setIsDarkMode(getIsDarkMode());
      }
    };
    window.addEventListener('bk_theme_changed', handleThemeChange);
    window.addEventListener('storage', handleThemeChange);
    return () => {
      window.removeEventListener('bk_theme_changed', handleThemeChange);
      window.removeEventListener('storage', handleThemeChange);
    };
  }, []);

  // Cloud Connection Realtime State
  const [cloudInfo, setCloudInfo] = useState<CloudConnectionInfo>(() => getCloudConnectionInfo());
  const [showCloudPopover, setShowCloudPopover] = useState(false);
  const [isRefreshingCloud, setIsRefreshingCloud] = useState(false);

  useEffect(() => {
    const handleCloudStatus = (e: any) => {
      if (e?.detail) {
        setCloudInfo(e.detail);
      } else {
        setCloudInfo(getCloudConnectionInfo());
      }
    };
    window.addEventListener('bk_cloud_status', handleCloudStatus);
    const interval = setInterval(() => {
      setCloudInfo(getCloudConnectionInfo());
    }, 4000);
    return () => {
      window.removeEventListener('bk_cloud_status', handleCloudStatus);
      clearInterval(interval);
    };
  }, []);

  const handleRefreshConnection = async () => {
    setIsRefreshingCloud(true);
    await forceFullCloudSync();
    await initRealtimeFirestoreSync();
    setTimeout(() => {
      setCloudInfo(getCloudConnectionInfo());
      setIsRefreshingCloud(false);
    }, 600);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Dynamic notification list derived from real application state
  const dynamicNotifications = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      body: string;
      time: string;
      type: 'service' | 'violation' | 'homevisit' | 'account';
      unread: boolean;
      targetTab?: string;
      targetQuery?: string;
    }> = [];

    // 0. Pending Counselor Registrations (For Admin)
    if (isAdministrator(activeCounselor)) {
      const pendingCounselors = (allCounselors || []).filter((c) => c.approvalStatus === 'pending');
      pendingCounselors.forEach((c) => {
        list.push({
          id: `counselor-pending-${c.id}`,
          title: '👤 Permintaan Akun Guru Baru (Menunggu ACC)',
          body: `${c.name} (${c.role || 'Guru BK'}) mendaftarkan akun baru. Klik untuk meninjau dan menyetujui (ACC).`,
          time: c.registeredAt ? new Date(c.registeredAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Menunggu ACC',
          type: 'account',
          unread: true,
          targetTab: 'pengaturan'
        });
      });
    }

    // 1. Scheduled services for today or upcoming
    const scheduledServices = (services || []).filter((s) => s.status === 'Terjadwal');
    scheduledServices.forEach((s) => {
      const isToday = s.date === todayStr;
      const studentNames = s.students.map((st) => st.name).join(', ') || 'Siswa';
      list.push({
        id: `srv-${s.id}`,
        title: isToday ? '📅 Jadwal Konseling Hari Ini' : '📅 Sesi Konseling Terjadwal',
        body: `${s.serviceType}: ${studentNames} (${s.problem}) jam ${s.startTime} - ${s.endTime} WIB.`,
        time: isToday ? `Hari Ini (${s.date})` : s.date,
        type: 'service',
        unread: isToday,
        targetTab: 'layanan-bk',
        targetQuery: studentNames,
      });
    });

    // 2. Unhandled / High point violations
    const recentViolations = (violations || []).slice(0, 5);
    recentViolations.forEach((v) => {
      const isToday = v.date === todayStr;
      const needsHandling = !v.handledBy || v.handledBy === 'Belum Ditangani';
      list.push({
        id: `viol-${v.id}`,
        title: needsHandling ? '⚠️ Pelanggaran Perlu Penanganan' : '📋 Laporan Pelanggaran',
        body: `${v.studentName} (${v.studentClass}) - ${v.category} (+${v.pointsAdded} Bobot).`,
        time: isToday ? `Hari Ini, ${v.time}` : `${v.date} ${v.time}`,
        type: 'violation',
        unread: needsHandling,
        targetTab: 'pelanggaran',
        targetQuery: v.studentName,
      });
    });

    // 3. Home visits
    const hvList = (homeVisits || []).slice(0, 3);
    hvList.forEach((h: any) => {
      const isToday = h.date === todayStr;
      list.push({
        id: `hv-${h.id}`,
        title: '🏠 Agenda Kunjungan Rumah (Home Visit)',
        body: `Kunjungan ke rumah ${h.studentName || 'Wali Murid'} (${h.studentClass}). Tujuan: ${h.purpose || 'Pendampingan'}.`,
        time: isToday ? 'Hari Ini' : h.date || 'Terjadwal',
        type: 'homevisit',
        unread: isToday,
        targetTab: 'home-visit',
        targetQuery: h.studentName,
      });
    });

    return list.sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0)).slice(0, 8);
  }, [services, violations, homeVisits, todayStr]);

  const unreadCount = hasClearedNotifications
    ? 0
    : dynamicNotifications.filter((n) => n.unread).length;

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    setHasClearedNotifications(true);
  };

  return (
    <>
      <header className="fixed top-0 right-0 w-full lg:w-[calc(100%-16rem)] z-40 bg-white/95 backdrop-blur-md border-b border-[#bcc9c6]/30 h-16 px-3 sm:px-6 flex justify-between items-center transition-all duration-300">
        <div className="flex items-center flex-1 mr-2 sm:mr-3 min-w-0">
          {/* Toggle Sidebar Button on Mobile - Always front & non-overlapped */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden p-2 text-[#0b1c30] hover:bg-gray-100 bg-white border border-[#bcc9c6]/50 shadow-2xs rounded-xl transition-colors mr-2 cursor-pointer shrink-0 z-20"
            title="Buka Menu Navigasi"
          >
            <Menu className="w-5 h-5 text-[#00685f]" />
          </button>

          {/* Global Student Search Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onNavigateToStudent();
            }}
            className="flex items-center bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-full px-2.5 sm:px-3.5 py-1 sm:py-1.5 w-full min-w-[100px] max-w-[150px] xs:max-w-[190px] sm:max-w-xs md:max-w-md transition-all focus-within:border-[#00685f] focus-within:ring-2 focus-within:ring-[#00685f]/10 shadow-2xs"
          >
            <Search className="text-[#00685f] w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari Siswa..."
              className="bg-transparent border-none focus:outline-none focus:ring-0 text-xs sm:text-sm w-full placeholder:text-[#3d4947]/50 ml-1.5 sm:ml-2 text-[#0b1c30] font-medium"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="text-xs font-bold text-gray-400 hover:text-gray-600 px-1"
                title="Hapus pencarian"
              >
                ✕
              </button>
            ) : null}
            <button
              type="submit"
              className="hidden sm:inline-block text-[10px] font-extrabold text-white bg-[#00685f] hover:bg-[#005049] px-2.5 py-1 rounded-full transition-all cursor-pointer ml-1"
            >
              Cari
            </button>
          </form>
        </div>

        {/* Action Items - Responsive layout */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Cloud-First Realtime Connection Indicator & Details Popover */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => {
                setShowCloudPopover(!showCloudPopover);
                if (showQuickActionMenu) setShowQuickActionMenu(false);
                if (showNotifications) setShowNotifications(false);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-200 cursor-pointer shadow-2xs border shrink-0 ${
                cloudInfo.status === 'connected'
                  ? 'bg-emerald-50 text-[#00685f] border-emerald-300/80 hover:bg-emerald-100'
                  : cloudInfo.status === 'syncing'
                  ? 'bg-sky-50 text-sky-800 border-sky-300/80 hover:bg-sky-100'
                  : 'bg-amber-50 text-amber-800 border-amber-300/80 hover:bg-amber-100'
              }`}
              title="Status Koneksi Cloud Database Realtime - Klik untuk detail"
            >
              <span className="relative flex h-2 w-2">
                {cloudInfo.status === 'connected' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : cloudInfo.status === 'syncing' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                )}
              </span>
              <Cloud className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {cloudInfo.status === 'connected' ? 'Cloud Terhubung' : cloudInfo.status === 'syncing' ? 'Menyinkronkan...' : 'Cloud Lokal'}
              </span>
            </button>

            {/* Cloud Status Popover Card */}
            <AnimatePresence>
              {showCloudPopover && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-72 sm:w-80 bg-white border border-[#bcc9c6]/40 rounded-2xl shadow-xl z-50 p-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-50 rounded-lg text-[#00685f]">
                        <Cloud className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#0b1c30]">Status Cloud Database</h4>
                        <p className="text-[10px] text-gray-500 font-semibold">Firebase Firestore Realtime</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCloudPopover(false)}
                      className="text-gray-400 hover:text-gray-600 text-xs font-bold p-1"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-2.5 text-xs text-[#3d4947]">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/20">
                      <span className="text-gray-500 text-[11px]">Status Stream:</span>
                      <span className="inline-flex items-center gap-1 font-bold text-[#00685f]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {cloudInfo.status === 'connected' ? 'Aktif (Real-time Push & Pull)' : cloudInfo.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-2 text-[11px]">
                      <span className="text-gray-500">Koleksi Terhubung:</span>
                      <span className="font-bold text-[#0b1c30]">{cloudInfo.activeCollections} Koleksi Firestore</span>
                    </div>

                    <div className="flex items-center justify-between px-2 text-[11px]">
                      <span className="text-gray-500">Database Sekolah:</span>
                      <span className="font-bold text-[#00685f] truncate max-w-[150px]" title={getSchoolConfig().schoolName}>
                        {getSchoolConfig().schoolName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-2 text-[11px]">
                      <span className="text-gray-500">School ID:</span>
                      <span className="font-mono text-[10px] font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                        {getActiveSchoolId()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-2 text-[11px]">
                      <span className="text-gray-500">Koneksi Internet:</span>
                      <span className="font-bold text-emerald-700 flex items-center gap-1">
                        {cloudInfo.isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-600" /> : <WifiOff className="w-3.5 h-3.5 text-rose-600" />}
                        {cloudInfo.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-2 text-[11px]">
                      <span className="text-gray-500">Terakhir Sinkron:</span>
                      <span className="font-bold text-[#0b1c30]">{cloudInfo.lastSyncTime} WIB</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                    <button
                      type="button"
                      onClick={handleRefreshConnection}
                      disabled={isRefreshingCloud}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCloud ? 'animate-spin' : ''}`} />
                      <span>{isRefreshingCloud ? 'Menghubungkan...' : 'Sinkronkan Ulang'}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick AI Assistant Button - Si Becik */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateToTab) onNavigateToTab('dashboard');
            }}
            className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-2xs active:scale-97 shrink-0"
            title="Lihat Pengingat Tugas & Tanya Si Becik 🦉"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-700 animate-pulse shrink-0" />
            <span className="hidden md:inline">Si Becik 🦉</span>
          </button>

          {/* Satu Tombol Utama: Catat Aktivitas BK */}
          <div className="relative">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setShowQuickActionMenu(!showQuickActionMenu);
                if (showNotifications) setShowNotifications(false);
                if (showEarlyWarningMenu) setShowEarlyWarningMenu(false);
              }}
              className="bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl flex items-center gap-1 sm:gap-1.5 shadow-xs cursor-pointer transition-all shrink-0"
              title="Catat Aktivitas BK Baru"
            >
              <PlusCircle className="w-4 h-4 text-emerald-200 shrink-0" />
              <span className="hidden sm:inline">Catat Aktivitas</span>
              <span className="sm:hidden">Catat</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showQuickActionMenu ? 'rotate-180' : ''}`} />
            </motion.button>

            {/* Quick Action Dropdown Menu */}
            <AnimatePresence>
              {showQuickActionMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 8 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                  className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#bcc9c6]/40 rounded-2xl shadow-2xl z-50 p-3"
                >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 px-1">
                  <div>
                    <span className="text-xs font-extrabold text-[#0b1c30] block">Catat Aktivitas BK</span>
                    <span className="text-[10px] text-gray-500 font-semibold">Pilih jenis kegiatan yang dilakukan</span>
                  </div>
                  <span className="text-[9px] font-extrabold bg-[#00685f]/10 text-[#00685f] px-2 py-0.5 rounded-md border border-[#00685f]/20">
                    Auto-Fill Jurnal
                  </span>
                </div>

                {/* 4 Ringkas Options */}
                <div className="space-y-1.5">
                  {/* 1. Pelanggaran Siswa */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickActionMenu(false);
                      if (onNavigateToTab) onNavigateToTab('pelanggaran');
                    }}
                    className="w-full p-2.5 rounded-xl text-left transition-all hover:bg-amber-50/80 border border-transparent hover:border-amber-200/80 group flex items-start gap-3 cursor-pointer"
                  >
                    <div className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#0b1c30] group-hover:text-amber-900">Pelanggaran Siswa</span>
                        <span className="text-[9px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded">Bobot & Restitusi</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Catat kasus pelanggaran disiplin & pembinaan restitusi siswa</p>
                    </div>
                  </button>

                  {/* 2. Layanan Konseling */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickActionMenu(false);
                      if (onNavigateToTab) onNavigateToTab('tambah-layanan');
                    }}
                    className="w-full p-2.5 rounded-xl text-left transition-all hover:bg-teal-50/80 border border-transparent hover:border-teal-200/80 group flex items-start gap-3 cursor-pointer"
                  >
                    <div className="p-2 bg-[#00685f]/10 text-[#00685f] rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                      <HeartHandshake className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#0b1c30] group-hover:text-[#00685f]">Layanan Konseling</span>
                        <span className="text-[9px] text-[#00685f] font-bold bg-[#00685f]/10 px-1.5 py-0.5 rounded">Individu/Kelompok</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Orientasi, Informasi, Penempatan, Penguasaan Konten, Perorangan, Kelompok, Konsultasi & Mediasi</p>
                    </div>
                  </button>

                  {/* 3. Pemanggilan Ortu / Home Visit */}
                  <div className="p-2.5 rounded-xl text-left transition-all bg-gray-50/80 border border-gray-100 hover:border-purple-200 group flex flex-col gap-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 text-purple-700 rounded-lg shrink-0">
                        <Home className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-extrabold text-[#0b1c30]">Pemanggilan Ortu / Home Visit</span>
                        <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Surat panggilan orang tua atau kunjungan rumah</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1 border-t border-gray-200/60 ml-11">
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickActionMenu(false);
                          if (onNavigateToTab) onNavigateToTab('panggilan-ortu');
                        }}
                        className="flex-1 py-1.5 px-2 bg-white hover:bg-purple-100 text-purple-800 text-[10px] font-extrabold rounded-md border border-purple-200 text-center transition-colors cursor-pointer shadow-2xs"
                      >
                        ✉️ Surat Panggilan
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickActionMenu(false);
                          if (onNavigateToTab) onNavigateToTab('home-visit');
                        }}
                        className="flex-1 py-1.5 px-2 bg-white hover:bg-purple-100 text-purple-800 text-[10px] font-extrabold rounded-md border border-purple-200 text-center transition-colors cursor-pointer shadow-2xs"
                      >
                        🏡 Home Visit
                      </button>
                    </div>
                  </div>

                  {/* 4. Jurnal Harian / Kegiatan */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickActionMenu(false);
                      if (onNavigateToTab) onNavigateToTab('jurnal-harian');
                    }}
                    className="w-full p-2.5 rounded-xl text-left transition-all hover:bg-emerald-50/80 border border-transparent hover:border-emerald-200/80 group flex items-start gap-3 cursor-pointer"
                  >
                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#0b1c30] group-hover:text-emerald-900">Jurnal Harian / Kegiatan</span>
                        <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Manajemen Agenda</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Lihat atau catat manual kegiatan harian & tugas Guru BK</p>
                    </div>
                  </button>
                </div>

                {/* Auto-fill notification badge */}
                <div className="mt-2.5 pt-2 border-t border-gray-100 bg-[#f4fffc] p-2 rounded-xl border border-[#00685f]/20 text-[10px] text-[#00685f] leading-snug font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#00685f] shrink-0" />
                  <span>Sistem otomatis mengisi Jurnal Harian di latar belakang tanpa mengetik dua kali!</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          {/* Early Warning High Point Violations Icon & Popup */}
          <div className="relative">
            <button
              onClick={() => {
                setShowEarlyWarningMenu(!showEarlyWarningMenu);
                if (showNotifications) setShowNotifications(false);
                if (showQuickActionMenu) setShowQuickActionMenu(false);
              }}
              className={`relative p-2 rounded-full transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
                highRiskStudents.length > 0
                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  : 'text-[#3d4947] hover:bg-gray-100'
              }`}
              title="Peringatan Dini Bobot Siswa (High Risk)"
            >
              <AlertTriangle className={`w-5 h-5 ${highRiskStudents.length > 0 ? 'text-rose-600' : 'text-gray-400'}`} />
              {highRiskStudents.length > 0 && (
                <span className="absolute -top-1 -right-1 px-1 min-w-[18px] h-4 bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white">
                  {highRiskStudents.length}
                </span>
              )}
            </button>

            {showEarlyWarningMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-rose-200 rounded-2xl shadow-2xl z-50 p-3 text-left animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-rose-100">
                  <div className="flex items-center gap-1.5 text-rose-700">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-black">Peringatan Dini Bobot Siswa</span>
                  </div>
                  <span className="text-[10px] font-extrabold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md">
                    {highRiskStudents.length} Siswa High Risk
                  </span>
                </div>

                <p className="text-[10px] text-gray-500 font-medium mb-2">
                  Siswa berikut telah mencapai akumulasi bobot pelanggaran &ge; 30 bobot dan memerlukan perhatian khusus / panggilan orang tua:
                </p>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5 custom-scrollbar">
                  {highRiskStudents.length === 0 ? (
                    <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-center text-xs font-bold border border-emerald-200">
                      👍 Semua siswa dalam batas aman (Bobot &lt; 30).
                    </div>
                  ) : (
                    highRiskStudents.map((st) => (
                      <div
                        key={st.id}
                        className="p-2.5 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 rounded-xl transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-extrabold text-[#0b1c30]">
                              {localStorage.getItem('bk_privacy_mode') === 'true' && st.name
                                ? (() => {
                                    const parts = st.name.trim().split(/\s+/);
                                    return parts.length === 1 ? `${parts[0].charAt(0)}*** 🔒` : `${parts[0]} ${parts[1].charAt(0)}. *** 🔒`;
                                  })()
                                : st.name}
                            </span>
                            <span className="text-[10px] text-gray-500 ml-1.5 font-bold">({st.class})</span>
                          </div>
                          <span className="text-xs font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-200">
                            {st.violationPoints} Bobot
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-rose-100/80">
                          <button
                            type="button"
                            onClick={() => {
                              setShowEarlyWarningMenu(false);
                              if (onNavigateToTab) onNavigateToTab('panggilan-ortu', st.name);
                            }}
                            className="flex-1 py-1 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-extrabold transition-all cursor-pointer shadow-2xs text-center"
                          >
                            ✉️ Panggil Ortu
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowEarlyWarningMenu(false);
                              if (onNavigateToTab) onNavigateToTab('tambah-layanan');
                            }}
                            className="flex-1 py-1 px-2 bg-white hover:bg-teal-50 text-[#00685f] border border-[#00685f]/30 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer text-center"
                          >
                            🤝 Konseling BK
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowEarlyWarningMenu(false);
                              onSearchChange(st.nis || st.name);
                              onNavigateToStudent();
                            }}
                            className="py-1 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                            title="Lihat Data Siswa"
                          >
                            🔍 Detail
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notifications Icon with Dynamic Popup */}
          <div className="relative">
            <button
              onClick={handleNotificationClick}
              className="relative p-2 text-[#3d4947] hover:bg-[#eff4ff] rounded-full transition-colors cursor-pointer active:scale-95"
              title="Notifikasi Sistem"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 px-1 min-w-[18px] h-4 bg-[#ba1a1a] text-white text-[9px] font-extrabold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-[#bcc9c6]/40 rounded-2xl shadow-xl z-50 p-2 text-left animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#bcc9c6]/20 mb-1.5">
                  <span className="text-xs font-extrabold text-[#0b1c30]">Notifikasi BK Terkini</span>
                  <span className="text-[10px] font-bold text-[#00685f] bg-[#f4fffc] px-2 py-0.5 rounded-lg border border-[#00685f]/20">
                    {dynamicNotifications.length} Pesan
                  </span>
                </div>

                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
                  {dynamicNotifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500 font-semibold">
                      Belum ada notifikasi baru.
                    </div>
                  ) : (
                    dynamicNotifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (n.targetTab && onNavigateToTab) {
                            onNavigateToTab(n.targetTab, n.targetQuery);
                            setShowNotifications(false);
                          }
                        }}
                        className={`p-2.5 rounded-xl text-xs transition-all cursor-pointer hover:bg-[#eff4ff] ${
                          n.unread
                            ? 'bg-[#f4fffc] border-l-3 border-[#00685f] shadow-2xs'
                            : 'bg-gray-50/50'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-extrabold text-[#0b1c30] text-xs">{n.title}</span>
                          {n.unread && <span className="w-2 h-2 bg-[#00685f] rounded-full mt-1 shrink-0"></span>}
                        </div>
                        <p className="text-gray-600 mt-1 leading-relaxed text-[11px] line-clamp-2">
                          {n.body}
                        </p>
                        <div className="flex justify-between items-center mt-1.5 pt-1 border-t border-gray-100">
                          <span className="text-[9px] text-[#00685f] font-bold">
                            {n.time}
                          </span>
                          <span className="text-[9px] text-gray-400 font-bold hover:underline">
                            Lihat Detail &rarr;
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Calendar Button */}
          <button
            onClick={() => setShowCalendarModal(true)}
            className="p-2 text-[#3d4947] hover:bg-[#eff4ff] rounded-full transition-colors cursor-pointer active:scale-95 relative"
            title="Buka Kalender Agenda BK"
          >
            <CalendarIcon className="w-5 h-5 text-[#00685f]" />
            <span className="absolute -bottom-0.5 right-1 text-[8px] bg-[#00685f] text-white px-1 rounded-md font-bold">
              BK
            </span>
          </button>

          {/* Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const newMode = toggleDarkMode();
              setIsDarkMode(newMode);
            }}
            className={`p-2 rounded-full transition-all duration-200 cursor-pointer active:scale-90 flex items-center justify-center ${
              isDarkMode
                ? 'bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 border border-amber-400/30'
                : 'text-[#3d4947] hover:bg-[#eff4ff] hover:text-[#00685f]'
            }`}
            title={isDarkMode ? 'Beralih ke Mode Terang (Siang)' : 'Beralih ke Mode Gelap (Malam)'}
            aria-label="Toggle Mode Gelap"
          >
            <AnimatePresence mode="wait" initial={false}>
              {isDarkMode ? (
                <motion.div
                  key="dark-sun"
                  initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sun className="w-5 h-5 text-amber-400" />
                </motion.div>
              ) : (
                <motion.div
                  key="light-moon"
                  initial={{ rotate: 90, opacity: 0, scale: 0.7 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: -90, opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.2 }}
                >
                  <Moon className="w-5 h-5 text-[#3d4947]" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          <div className="h-8 w-[1px] bg-[#bcc9c6]/30 mx-1"></div>

          {/* User Card */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-xs text-[#0b1c30] leading-tight">
                {activeCounselor.name}
              </p>
              <p className="text-[9px] uppercase tracking-wider text-[#3d4947]/70 font-bold">
                {activeCounselor.role}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#00685f]/10 border-2 border-[#89f5e7] text-[#00685f] flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 font-bold" />
            </div>
          </div>
        </div>
      </header>

      {/* Interactive Calendar Agenda Modal */}
      <CalendarModal
        isOpen={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
        services={services}
        violations={violations}
        homeVisits={homeVisits}
        onEditService={onEditService}
        onAddServiceOnDate={onAddServiceOnDate}
        onNavigateToTab={onNavigateToTab}
      />
    </>
  );
}

