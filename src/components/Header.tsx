import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Bell, Calendar as CalendarIcon, Check, Menu, User, Database, Cloud, PlusCircle, ChevronDown, AlertTriangle, HeartHandshake, Home, BookOpen, Sparkles, Moon, Sun, RefreshCw, Wifi, WifiOff, CheckCircle2, ShieldAlert, Share2, MoreVertical, LogOut } from 'lucide-react';
import { Counselor, CounselingService, ViolationRecord, Student } from '../types';
import CalendarModal from './CalendarModal';
import UserManualModal from './UserManualModal';
import ShareAppModal from './ShareAppModal';
import PanduanBskap2022Modal from './PanduanBskap2022Modal';
import { getIsDarkMode, toggleDarkMode } from '../utils/theme';
import { getCloudConnectionInfo, initRealtimeFirestoreSync, forceFullCloudSync, CloudConnectionInfo, syncPreviewDataToAuliaAccount } from '../utils/firestoreSync';
import { getActiveSchoolId, getSchoolConfig } from '../utils/schoolConfig';
import { isAdministrator } from '../utils/accessControl';
import { showToast } from '../utils/toast';

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
  onNavigateToForm?: (form: string, selectStudentId?: string) => void;
  onEditService?: (service: CounselingService) => void;
  onAddServiceOnDate?: (dateStr: string) => void;
  onLogout?: () => void;
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
  onNavigateToForm,
  onEditService,
  onAddServiceOnDate,
  onLogout,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [isNotifHovered, setIsNotifHovered] = useState(false);
  const [notifKey, setNotifKey] = useState(0);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  // References for Click-Outside & Auto-Hide Dismissal
  const notifRef = useRef<HTMLDivElement>(null);
  const quickActionRef = useRef<HTMLDivElement>(null);
  const earlyWarningRef = useRef<HTMLDivElement>(null);
  const cloudPopoverRef = useRef<HTMLDivElement>(null);
  const mobileMoreRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showBskapModal, setShowBskapModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showQuickActionMenu, setShowQuickActionMenu] = useState(false);
  const [showEarlyWarningMenu, setShowEarlyWarningMenu] = useState(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const [showCloudPopover, setShowCloudPopover] = useState(false);
  const [hasClearedNotifications, setHasClearedNotifications] = useState(false);

  // 1. Efek Fade-Out Otomatis Setelah 3 Detik pada Notifikasi Top Bar
  useEffect(() => {
    if (!showNotifications) {
      setIsNotifHovered(false);
      return;
    }

    // Jika pengguna sedang mengarahkan kursor/hover (sedang membaca), tunda auto fade-out
    if (isNotifHovered) {
      return;
    }

    // Hitung mundur 3 detik (3000ms) untuk auto fade-out otomatis
    const timer = setTimeout(() => {
      setShowNotifications(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [showNotifications, isNotifHovered, notifKey]);

  // 2. Hide & Seek Top Bar Otomatis pada Scroll Halaman
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const delta = currentScrollY - lastScrollYRef.current;

          // Jika di puncak halaman (< 35px), selalu tampilkan top bar
          if (currentScrollY < 35) {
            setIsHeaderVisible(true);
          } else if (delta > 8 && currentScrollY > 70) {
            // Scroll ke bawah: Hide Top Bar & tutup popover aktif
            setIsHeaderVisible(false);
            setShowNotifications(false);
            setShowQuickActionMenu(false);
            setShowEarlyWarningMenu(false);
            setShowCloudPopover(false);
            setShowMobileMoreMenu(false);
          } else if (delta < -8) {
            // Scroll ke atas: Seek / Tampilkan kembali Top Bar
            setIsHeaderVisible(true);
          }

          lastScrollYRef.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Jika kursor diarahkan ke puncak layar (< 25px), tampilkan Top Bar
      if (e.clientY < 25) {
        setIsHeaderVisible(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // 3. Click-Outside & ESC Listener untuk Semua Popover di Top Bar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (showNotifications && notifRef.current && !notifRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (showQuickActionMenu && quickActionRef.current && !quickActionRef.current.contains(target)) {
        setShowQuickActionMenu(false);
      }
      if (showEarlyWarningMenu && earlyWarningRef.current && !earlyWarningRef.current.contains(target)) {
        setShowEarlyWarningMenu(false);
      }
      if (showCloudPopover && cloudPopoverRef.current && !cloudPopoverRef.current.contains(target)) {
        setShowCloudPopover(false);
      }
      if (showMobileMoreMenu && mobileMoreRef.current && !mobileMoreRef.current.contains(target)) {
        setShowMobileMoreMenu(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
        setShowQuickActionMenu(false);
        setShowEarlyWarningMenu(false);
        setShowCloudPopover(false);
        setShowMobileMoreMenu(false);
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotifications, showQuickActionMenu, showEarlyWarningMenu, showCloudPopover, showMobileMoreMenu]);

  const schoolConfig = useMemo(() => {
    return getSchoolConfig(activeCounselor?.schoolId || getActiveSchoolId());
  }, [activeCounselor?.schoolId]);

  const currentSchoolName = activeCounselor?.schoolName || schoolConfig.schoolName || 'BK Sekolah';
  const currentNpsn = schoolConfig.npsn || activeCounselor?.schoolId?.replace(/^sch_/, '') || '';

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

  const [isPushingToAuliaCloud, setIsPushingToAuliaCloud] = useState(false);
  const [cloudSyncResultModal, setCloudSyncResultModal] = useState<{
    open: boolean;
    success: boolean;
    counts?: any;
    message?: string;
  } | null>(null);

  const handleSyncToAuliaAccount = async () => {
    setIsPushingToAuliaCloud(true);
    try {
      const res = await syncPreviewDataToAuliaAccount();
      setIsPushingToAuliaCloud(false);
      setCloudInfo(getCloudConnectionInfo());
      setCloudSyncResultModal({
        open: true,
        success: res.success,
        counts: res.counts,
        message: res.success
          ? `Seluruh data preview berhasil dikirim & disimpan ke Cloud Akun Aulia Aji Sasongko (SMP N 2 Susukan)! Data tersimpan: ${res.counts.students} Data Siswa, ${res.counts.violations} Pelanggaran, ${res.counts.services} Sesi Konseling, ${res.counts.homeVisits} Home Visit, dan ${res.counts.attendance} Absensi. Saat login via web menggunakan akun Aulia, data tidak akan berubah dan langsung sinkron otomatis.`
          : `Gagal mengirim data: ${res.error || 'Terjadi kesalahan sistem.'}`
      });
    } catch (err: any) {
      setIsPushingToAuliaCloud(false);
      setCloudSyncResultModal({
        open: true,
        success: false,
        message: 'Gagal mengirim data ke cloud: ' + (err?.message || String(err))
      });
    }
  };

  const handleRefreshConnection = async () => {
    setIsRefreshingCloud(true);
    try {
      await forceFullCloudSync();
      await initRealtimeFirestoreSync();
      setCloudInfo(getCloudConnectionInfo());
      showToast('Data berhasil disinkronkan dari Cloud! (Laptop ⇄ HP up-to-date)', 'success');
    } catch (err: any) {
      showToast('Gagal sinkronisasi dari Cloud: ' + (err?.message || err), 'error');
    } finally {
      setIsRefreshingCloud(false);
    }
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

  // Instant student search matches across name, NISN, and class
  const matchingStudents = useMemo(() => {
    if (!students || students.length === 0) return [];
    if (!searchQuery || !searchQuery.trim()) {
      return students.slice(0, 5);
    }
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const nisn = String(s.nis || (s as any).nisn || '');
      const cls = (s.class || '').toLowerCase();
      return name.includes(q) || nisn.includes(q) || cls.includes(q);
    }).slice(0, 8);
  }, [students, searchQuery]);

  const unreadCount = hasClearedNotifications
    ? 0
    : dynamicNotifications.filter((n) => n.unread).length;

  const handleNotificationClick = () => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);
    if (nextState) {
      setNotifKey((prev) => prev + 1);
      setIsNotifHovered(false);
      setShowQuickActionMenu(false);
      setShowEarlyWarningMenu(false);
      setShowCloudPopover(false);
      setShowMobileMoreMenu(false);
    }
    setHasClearedNotifications(true);
  };

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 w-full z-40 bg-white/95 backdrop-blur-md border-b border-[#bcc9c6]/30 h-16 px-3 sm:px-6 flex justify-between items-center transition-transform duration-300 ease-in-out app-header ${
          isHeaderVisible ? 'translate-y-0 shadow-xs' : '-translate-y-full shadow-none pointer-events-none'
        }`}
      >
        <div className="flex items-center flex-1 mr-2 sm:mr-3 min-w-0">
          {/* Logo / Menu Quick Jump */}
          <button
            type="button"
            onClick={() => onNavigateToTab ? onNavigateToTab('lainnya') : (onToggleSidebar && onToggleSidebar())}
            className="p-2 text-[#0b1c30] hover:bg-gray-100 bg-white border border-[#bcc9c6]/50 shadow-2xs rounded-xl transition-colors mr-2 cursor-pointer shrink-0 z-20"
            title="Buka Menu Lainnya"
          >
            <Menu className="w-5 h-5 text-[#00685f]" />
          </button>

          {/* School Brand Badge (Visible on medium screens, hidden on ultra-small mobile to prevent overcrowding) */}
          <div className="hidden sm:flex lg:hidden items-center mr-2 shrink-0">
            <span
              className="text-xs font-black text-[#00685f] tracking-tight bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200/60 max-w-[130px] md:max-w-[170px] truncate"
              title={`${currentSchoolName} ${currentNpsn ? `(NPSN: ${currentNpsn})` : ''}`}
            >
              {currentSchoolName}
            </span>
          </div>

          {/* Global Student Search Bar with Instant Direct Actions */}
          <div ref={searchContainerRef} className="relative flex-1 max-w-[210px] xs:max-w-[260px] sm:max-w-sm md:max-w-md">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (matchingStudents.length === 1) {
                  if (onNavigateToTab) onNavigateToTab('data-siswa', matchingStudents[0].name);
                  setIsSearchOpen(false);
                } else {
                  setIsSearchOpen(true);
                }
              }}
              className="flex items-center bg-[#f8f9ff] border border-[#bcc9c6]/50 rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 w-full transition-all focus-within:border-[#00685f] focus-within:ring-2 focus-within:ring-[#00685f]/15 shadow-2xs"
            >
              <Search className="text-[#00685f] w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  setIsSearchOpen(true);
                }}
                placeholder="Cari siswa langsung..."
                className="bg-transparent border-none focus:outline-none focus:ring-0 text-xs sm:text-sm w-full placeholder:text-[#3d4947]/50 ml-1.5 sm:ml-2 text-[#0b1c30] font-medium"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    setIsSearchOpen(false);
                  }}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 px-1 cursor-pointer"
                  title="Hapus pencarian"
                >
                  ✕
                </button>
              ) : null}
              <button
                type="submit"
                onClick={() => setIsSearchOpen(true)}
                className="text-[11px] font-black text-white bg-[#00685f] hover:bg-[#005049] px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer ml-1 shrink-0 shadow-2xs active:scale-95"
              >
                Cari
              </button>
            </form>

            {/* Live Search Instant Dropdown (Bisa cari & tindak lanjut langsung tanpa harus buka menu Data Siswa) */}
            <AnimatePresence>
              {isSearchOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 sm:left-auto sm:right-0 sm:w-[380px] mt-2 bg-white rounded-2xl border border-[#bcc9c6]/60 shadow-2xl z-50 p-3 max-h-[75vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                    <span className="text-xs font-black text-[#0b1c30]">
                      {searchQuery.trim() ? `Hasil Pencarian Siswa (${matchingStudents.length})` : 'Pencarian Cepat Siswa'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSearchOpen(false)}
                      className="text-gray-400 hover:text-gray-600 text-xs font-bold p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {matchingStudents.length > 0 ? (
                    <div className="space-y-2">
                      {matchingStudents.map((st) => (
                        <div
                          key={st.id}
                          className="p-2.5 rounded-xl border border-gray-100 bg-[#f8faf9] hover:bg-white hover:border-[#00685f]/40 transition-all shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-[#00685f]/10 text-[#00685f] flex items-center justify-center font-bold text-xs shrink-0">
                                {st.initials || st.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-[#0b1c30] truncate">{st.name}</p>
                                <p className="text-[10px] text-gray-500 truncate">
                                  Kelas {st.class} {st.nis ? `• NIS: ${st.nis}` : ''}
                                </p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${(st.violationPoints || 0) > 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}`}>
                              {st.violationPoints || 0} Poin
                            </span>
                          </div>

                          {/* 3 Quick Action Buttons: Profil, Catat Kasus, Konseling */}
                          <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-gray-200/60">
                            <button
                              type="button"
                              onClick={() => {
                                setIsSearchOpen(false);
                                if (onNavigateToTab) onNavigateToTab('data-siswa', st.name);
                              }}
                              className="py-1 px-1.5 bg-white hover:bg-teal-50 text-[#00685f] text-[10px] font-bold rounded-lg border border-teal-200 text-center cursor-pointer transition-colors shadow-2xs"
                            >
                              👤 Profil
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsSearchOpen(false);
                                if (onNavigateToForm) {
                                  onNavigateToForm('pelanggaran', st.id);
                                } else if (onNavigateToTab) {
                                  onNavigateToTab('pelanggaran', st.id);
                                }
                              }}
                              className="py-1 px-1.5 bg-white hover:bg-rose-50 text-rose-700 text-[10px] font-bold rounded-lg border border-rose-200 text-center cursor-pointer transition-colors shadow-2xs"
                            >
                              🚨 Catat Kasus
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsSearchOpen(false);
                                if (onNavigateToForm) {
                                  onNavigateToForm('tambah-layanan', st.id);
                                } else if (onNavigateToTab) {
                                  onNavigateToTab('tambah-layanan', st.id);
                                }
                              }}
                              className="py-1 px-1.5 bg-white hover:bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-200 text-center cursor-pointer transition-colors shadow-2xs"
                            >
                              🤝 Konseling
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center space-y-2">
                      <p className="text-xs text-gray-500 font-medium">
                        Tidak ada siswa dengan nama "{searchQuery}"
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSearchOpen(false);
                          if (onNavigateToTab) onNavigateToTab('data-siswa');
                        }}
                        className="text-xs font-bold text-[#00685f] hover:underline cursor-pointer"
                      >
                        Buka Seluruh Data Siswa →
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Action Items - Responsive layout */}
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
          {/* Cloud-First Realtime Connection Indicator & Details Popover */}
          <div ref={cloudPopoverRef} className="relative hidden md:block">
            <button 
              type="button"
              onClick={() => {
                setShowCloudPopover(!showCloudPopover);
                if (showQuickActionMenu) setShowQuickActionMenu(false);
                if (showNotifications) setShowNotifications(false);
                if (showEarlyWarningMenu) setShowEarlyWarningMenu(false);
                if (showMobileMoreMenu) setShowMobileMoreMenu(false);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer shadow-2xs border shrink-0 ${
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
              <span className="hidden xl:inline">
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

                    {Boolean(cloudInfo.conflictsPrevented && cloudInfo.conflictsPrevented > 0) && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px]">
                        <span className="text-amber-800 font-medium">Konflik Tab Dicegah:</span>
                        <span className="font-bold text-amber-900">
                          {cloudInfo.conflictsPrevented}x {cloudInfo.lastConflictTime ? `(${cloudInfo.lastConflictTime})` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleRefreshConnection}
                      disabled={isRefreshingCloud}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-[#00685f] to-[#004e47] hover:bg-[#005049] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                      title="Tarik seluruh data terbaru dari Cloud Firestore agar data di HP dan Laptop sama persis"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCloud ? 'animate-spin text-emerald-200' : 'text-emerald-200'}`} />
                      <span>{isRefreshingCloud ? 'Menarik Data dari Cloud...' : 'Tarik & Sinkronkan Data (Laptop ⇄ HP)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSyncToAuliaAccount}
                      disabled={isPushingToAuliaCloud}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                      title="Kirim dan simpan data lokal saat ini ke database cloud akun Aulia"
                    >
                      <Cloud className={`w-3.5 h-3.5 ${isPushingToAuliaCloud ? 'animate-bounce text-[#00685f]' : 'text-gray-500'}`} />
                      <span>{isPushingToAuliaCloud ? 'Mengunggah ke Cloud...' : 'Cadangkan / Kirim ke Akun Aulia'}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick Sync Button on Header Bar */}
          <button
            type="button"
            onClick={handleRefreshConnection}
            disabled={isRefreshingCloud}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00685f]/10 hover:bg-[#00685f]/20 text-[#00685f] text-xs font-bold rounded-full shadow-2xs transition-all active:scale-97 cursor-pointer shrink-0 border border-[#00685f]/30"
            title="Tarik data terbaru dari Cloud agar sinkron dengan Laptop"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCloud ? 'animate-spin text-[#00685f]' : 'text-[#00685f]'}`} />
            <span className="hidden xl:inline">{isRefreshingCloud ? 'Menyinkronkan...' : 'Sinkron Laptop ⇄ HP'}</span>
            <span className="xl:hidden sm:inline">{isRefreshingCloud ? 'Sinkron...' : 'Sinkron Cloud'}</span>
          </button>

          {/* Satu Tombol Utama: Catat Aktivitas BK */}
          <div ref={quickActionRef} className="relative">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setShowQuickActionMenu(!showQuickActionMenu);
                if (showNotifications) setShowNotifications(false);
                if (showEarlyWarningMenu) setShowEarlyWarningMenu(false);
              }}
              className="bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl flex items-center gap-1 sm:gap-1.5 shadow-xs cursor-pointer transition-all shrink-0"
              title="Catat Aktivitas BK Baru & Panduan PDF"
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
                    <span className="text-xs font-extrabold text-[#0b1c30] block">Aksi Cepat & Aktivitas BK</span>
                    <span className="text-[10px] text-gray-500 font-semibold">Pilih jenis kegiatan atau panduan</span>
                  </div>
                  <span className="text-[9px] font-extrabold bg-[#00685f]/10 text-[#00685f] px-2 py-0.5 rounded-md border border-[#00685f]/20">
                    Auto-Fill Jurnal
                  </span>
                </div>

                {/* 3 Menu Utama Catat Cepat */}
                <div className="space-y-1.5">
                  {/* 1. Absen Kelas */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickActionMenu(false);
                      if (onNavigateToTab) onNavigateToTab('absensi');
                    }}
                    className="w-full p-2.5 rounded-xl text-left transition-all hover:bg-teal-50/80 border border-transparent hover:border-teal-200/80 group flex items-start gap-3 cursor-pointer"
                  >
                    <div className="p-2 bg-teal-100 text-teal-700 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#0b1c30] group-hover:text-[#00685f]">Absen Kelas</span>
                        <span className="text-[9px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded">Harian</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Presensi harian: Hadir, Sakit, Izin, Alpa</p>
                    </div>
                  </button>

                  {/* 2. Catat Kasus */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickActionMenu(false);
                      if (onNavigateToTab) onNavigateToTab('pelanggaran');
                    }}
                    className="w-full p-2.5 rounded-xl text-left transition-all hover:bg-rose-50/80 border border-transparent hover:border-rose-200/80 group flex items-start gap-3 cursor-pointer"
                  >
                    <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#0b1c30] group-hover:text-rose-900">Catat Kasus</span>
                        <span className="text-[9px] text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded">Kasus</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Masalah disiplin & tata tertib</p>
                    </div>
                  </button>

                  {/* 3. Input Layanan */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickActionMenu(false);
                      if (onNavigateToTab) onNavigateToTab('tambah-layanan');
                    }}
                    className="w-full p-2.5 rounded-xl text-left transition-all hover:bg-blue-50/80 border border-transparent hover:border-blue-200/80 group flex items-start gap-3 cursor-pointer"
                  >
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                      <HeartHandshake className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#0b1c30] group-hover:text-blue-900">Input Layanan</span>
                        <span className="text-[9px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded">Wizard BK</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Semua layanan BK: Konseling, Bimbingan, Home Visit, Rapat Kasus, dll</p>
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

                {/* Ringkas: Quick Tools (Panduan PDF, Juknis BSKAP 2022 & AI Assistant) */}
                <div className="mt-2.5 pt-2.5 border-t border-gray-100 grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickActionMenu(false);
                      setShowBskapModal(true);
                    }}
                    className="flex items-center justify-center gap-1 py-2 px-2 bg-gradient-to-r from-teal-600 to-[#00685f] hover:from-teal-700 hover:to-[#005049] text-white rounded-xl text-[10px] font-extrabold transition-all cursor-pointer shadow-2xs"
                    title="Buka Panduan BK Kurikulum Merdeka Terkini & SOP PPKSP (Permendikbudristek No. 46/2023)"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-teal-100 shrink-0" />
                    <span>Panduan BK</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickActionMenu(false);
                      setShowManualModal(true);
                    }}
                    className="flex items-center justify-center gap-1 py-2 px-2 bg-[#e6f4f1] hover:bg-teal-100 text-[#00685f] rounded-xl text-[10px] font-extrabold transition-all cursor-pointer border border-[#00685f]/25 shadow-2xs"
                    title="Buka Buku Panduan & Dokumentasi Fitur (PDF)"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#00685f] shrink-0" />
                    <span>Panduan PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickActionMenu(false);
                      if (onNavigateToTab) onNavigateToTab('dashboard');
                    }}
                    className="flex items-center justify-center gap-1 py-2 px-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer border border-amber-300 shadow-2xs"
                    title="Tanya Si Becik 🦉 di Dashboard"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse shrink-0" />
                    <span>Si Becik 🦉</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          {/* Early Warning High Point Violations Icon & Popup */}
          <div ref={earlyWarningRef} className="relative hidden md:block">
            <button
              onClick={() => {
                setShowEarlyWarningMenu(!showEarlyWarningMenu);
                if (showNotifications) setShowNotifications(false);
                if (showQuickActionMenu) setShowQuickActionMenu(false);
                if (showCloudPopover) setShowCloudPopover(false);
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

          {/* Notifications Icon with Dynamic Popup & 3-Second Auto Fade-Out */}
          <div ref={notifRef} className="relative">
            <button
              onClick={handleNotificationClick}
              className="relative p-2 text-[#3d4947] hover:bg-[#eff4ff] rounded-full transition-colors cursor-pointer active:scale-95"
              title="Notifikasi Sistem (Otomatis Fade-Out 3 Detik)"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 px-1 min-w-[18px] h-4 bg-[#ba1a1a] text-white text-[9px] font-extrabold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    scale: 0.95,
                    y: -6,
                    transition: { duration: 0.35, ease: 'easeOut' }
                  }}
                  transition={{ duration: 0.2 }}
                  onMouseEnter={() => setIsNotifHovered(true)}
                  onMouseLeave={() => {
                    setIsNotifHovered(false);
                    setNotifKey((prev) => prev + 1);
                  }}
                  className="absolute right-0 mt-2 w-80 bg-white border border-[#bcc9c6]/40 rounded-2xl shadow-xl z-50 overflow-hidden text-left"
                >
                  {/* Indikator Animasi Countdown Fade-Out Otomatis (3 Detik) */}
                  <div className="w-full bg-teal-100/50 h-1 overflow-hidden">
                    <motion.div
                      key={notifKey}
                      initial={{ width: '100%' }}
                      animate={{ width: isNotifHovered ? '100%' : '0%' }}
                      transition={{ duration: isNotifHovered ? 0 : 3, ease: 'linear' }}
                      className={`h-full ${isNotifHovered ? 'bg-amber-500' : 'bg-[#00685f]'}`}
                    />
                  </div>

                  <div className="p-2">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[#bcc9c6]/20 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-extrabold text-[#0b1c30]">Notifikasi BK Terkini</span>
                        {isNotifHovered ? (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                            ⏸️ Jeda
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-[#00685f] bg-teal-50 px-1.5 py-0.5 rounded border border-[#00685f]/20 shrink-0">
                            ⏳ 3d
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-bold text-[#00685f] bg-[#f4fffc] px-2 py-0.5 rounded-lg border border-[#00685f]/20">
                          {dynamicNotifications.length} Pesan
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowNotifications(false)}
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg text-xs transition-colors cursor-pointer"
                          title="Tutup Sekarang"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5 custom-scrollbar">
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Desktop Direct Utility Buttons (Share, Calendar, Dark Mode - Hidden on mobile) */}
          <div className="hidden md:flex items-center gap-1">
            {/* Share / Bagikan Link Button */}
            <button
              onClick={() => setShowShareModal(true)}
              className="p-2 text-[#3d4947] hover:bg-[#eff4ff] hover:text-[#00685f] rounded-full transition-colors cursor-pointer active:scale-95"
              title="Bagikan & Salin Link Aplikasi"
            >
              <Share2 className="w-5 h-5 text-[#00685f]" />
            </button>

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
          </div>

          {/* Mobile Consolidated More Menu Button (Shows only on mobile < md) */}
          <div ref={mobileMoreRef} className="relative md:hidden">
            <button
              type="button"
              onClick={() => {
                setShowMobileMoreMenu(!showMobileMoreMenu);
                if (showNotifications) setShowNotifications(false);
                if (showQuickActionMenu) setShowQuickActionMenu(false);
              }}
              className={`p-1.5 rounded-full transition-all cursor-pointer active:scale-95 flex items-center justify-center border relative ${
                highRiskStudents.length > 0
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : 'bg-white hover:bg-gray-100 text-[#0b1c30] border-gray-200 shadow-2xs'
              }`}
              title="Menu Opsi & Alat Cepat"
            >
              <MoreVertical className="w-4 h-4" />
              {/* Status indicator dot */}
              {highRiskStudents.length > 0 ? (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-600 rounded-full border-2 border-white"></span>
              ) : cloudInfo.status === 'connected' ? (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white"></span>
              ) : null}
            </button>

            {/* Mobile Consolidated Menu Popover Card */}
            <AnimatePresence>
              {showMobileMoreMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 8 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                  className="absolute right-0 mt-2 w-72 bg-white border border-[#bcc9c6]/40 rounded-2xl shadow-2xl z-50 p-3 text-left space-y-2"
                >
                  {/* Active Counselor info */}
                  <div className="flex items-center gap-2.5 pb-2.5 border-b border-gray-100">
                    <div className="w-8 h-8 rounded-full bg-[#00685f]/10 border border-[#89f5e7] text-[#00685f] flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-xs text-[#0b1c30] truncate">{activeCounselor.name}</p>
                      <p className="text-[9px] uppercase tracking-wider text-[#3d4947]/70 font-bold truncate">{activeCounselor.role}</p>
                    </div>
                  </div>

                  {/* Cloud Status */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/20 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Cloud className="w-4 h-4 text-[#00685f] shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold leading-tight">Database Cloud:</p>
                        <p className="text-xs font-black text-[#00685f] truncate">{cloudInfo.status === 'connected' ? 'Terhubung (Online)' : 'Lokal Mode'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRefreshConnection}
                      disabled={isRefreshingCloud}
                      className="p-1.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                      title="Sinkronkan Cloud"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCloud ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {/* Action items grid */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Early Warning */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileMoreMenu(false);
                        setShowEarlyWarningMenu(true);
                      }}
                      className={`p-2 rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                        highRiskStudents.length > 0 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <AlertTriangle className={`w-4 h-4 ${highRiskStudents.length > 0 ? 'text-rose-600' : 'text-gray-400'}`} />
                        {highRiskStudents.length > 0 && (
                          <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.2 rounded-full">
                            {highRiskStudents.length}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-extrabold mt-1">Siswa High Risk</span>
                    </button>

                    {/* Kalender BK */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileMoreMenu(false);
                        setShowCalendarModal(true);
                      }}
                      className="p-2 rounded-xl bg-gray-50 hover:bg-teal-50 border border-gray-200 hover:border-teal-200 text-[#0b1c30] text-left flex flex-col justify-between transition-colors cursor-pointer"
                    >
                      <CalendarIcon className="w-4 h-4 text-[#00685f]" />
                      <span className="text-[11px] font-extrabold mt-1">Kalender BK</span>
                    </button>

                    {/* Bagikan Link */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileMoreMenu(false);
                        setShowShareModal(true);
                      }}
                      className="p-2 rounded-xl bg-gray-50 hover:bg-teal-50 border border-gray-200 hover:border-teal-200 text-[#0b1c30] text-left flex flex-col justify-between transition-colors cursor-pointer"
                    >
                      <Share2 className="w-4 h-4 text-[#00685f]" />
                      <span className="text-[11px] font-extrabold mt-1">Bagikan Link</span>
                    </button>

                    {/* Dark Mode */}
                    <button
                      type="button"
                      onClick={() => {
                        const newMode = toggleDarkMode();
                        setIsDarkMode(newMode);
                      }}
                      className="p-2 rounded-xl bg-gray-50 hover:bg-amber-50 border border-gray-200 hover:border-amber-200 text-[#0b1c30] text-left flex flex-col justify-between transition-colors cursor-pointer"
                    >
                      {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-[#3d4947]" />}
                      <span className="text-[11px] font-extrabold mt-1">{isDarkMode ? 'Mode Siang' : 'Mode Malam'}</span>
                    </button>
                  </div>

                  {/* Panduan PDF & Si Becik */}
                  <div className="pt-2 border-t border-gray-100 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileMoreMenu(false);
                        setShowManualModal(true);
                      }}
                      className="flex-1 py-1.5 px-2 bg-[#e6f4f1] hover:bg-teal-100 text-[#00685f] rounded-lg text-[10px] font-extrabold text-center transition-colors cursor-pointer"
                    >
                      📖 Panduan PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileMoreMenu(false);
                        if (onNavigateToTab) onNavigateToTab('dashboard');
                      }}
                      className="flex-1 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-[10px] font-extrabold text-center transition-colors cursor-pointer"
                    >
                      🦉 Si Becik
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden md:block h-7 w-[1px] bg-[#bcc9c6]/30 mx-0.5"></div>

          {/* User Card */}
          {/* User Card (Desktop & Tablet) */}
          <button
            type="button"
            onClick={() => onNavigateToTab && onNavigateToTab('pengaturan')}
            className="hidden md:flex items-center gap-2 p-1 pl-2 hover:bg-gray-100 rounded-2xl transition-all cursor-pointer group text-left"
            title="Buka Profil & Pengaturan Akun Saya"
          >
            <div className="text-right hidden xl:block">
              <p className="font-semibold text-xs text-[#0b1c30] group-hover:text-[#00685f] transition-colors leading-tight truncate max-w-[130px]">
                {activeCounselor.name}
              </p>
              <p className="text-[9px] uppercase tracking-wider text-[#3d4947]/70 font-bold truncate max-w-[130px]">
                {activeCounselor.role}
              </p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#00685f]/10 border-2 border-[#89f5e7] text-[#00685f] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
              {activeCounselor.avatar ? (
                <img 
                  referrerPolicy="no-referrer" 
                  src={activeCounselor.avatar} 
                  alt={activeCounselor.name} 
                  className="w-full h-full object-cover" 
                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                />
              ) : null}
              <span className="font-extrabold text-xs text-[#00685f]">
                {activeCounselor.name ? activeCounselor.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'BK'}
              </span>
            </div>
          </button>

          {/* Quick Logout Button (Desktop & Tablet) */}
          {onLogout && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Keluar dari akun Anda dan kembali ke Halaman Login?')) {
                  onLogout();
                }
              }}
              className="hidden md:inline-flex p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer active:scale-95 shrink-0"
              title="Keluar (Logout) ke Halaman Login"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
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

      {/* User Manual & Features Documentation Modal */}
      <UserManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
      />

      {/* Share & Shortlink App Modal */}
      <ShareAppModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />

      {/* Panduan Juknis BSKAP 2022 Modal */}
      <PanduanBskap2022Modal
        isOpen={showBskapModal}
        onClose={() => setShowBskapModal(false)}
      />

      {/* Modal Konfirmasi Pengiriman Data Preview ke Akun Cloud Aulia */}
      {cloudSyncResultModal && cloudSyncResultModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#bcc9c6]/40 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${cloudSyncResultModal.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {cloudSyncResultModal.success ? <CheckCircle2 className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#0b1c30]">
                    {cloudSyncResultModal.success ? 'Sinkronisasi Cloud Berhasil!' : 'Sinkronisasi Gagal'}
                  </h3>
                  <p className="text-xs text-gray-500 font-semibold">
                    Akun: Aulia Aji Sasongko, S.Pd. (SMP N 2 Susukan)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCloudSyncResultModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-700 leading-relaxed font-medium bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
              {cloudSyncResultModal.message}
            </p>

            {cloudSyncResultModal.counts && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center text-xs">
                <div className="bg-teal-50/70 p-2.5 rounded-xl border border-teal-200">
                  <span className="block font-black text-[#00685f] text-base">{cloudSyncResultModal.counts.students}</span>
                  <span className="text-[10px] text-gray-600 font-bold">Data Siswa</span>
                </div>
                <div className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-200">
                  <span className="block font-black text-rose-700 text-base">{cloudSyncResultModal.counts.violations}</span>
                  <span className="text-[10px] text-gray-600 font-bold">Pelanggaran</span>
                </div>
                <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                  <span className="block font-black text-emerald-700 text-base">{cloudSyncResultModal.counts.services}</span>
                  <span className="text-[10px] text-gray-600 font-bold">Layanan BK</span>
                </div>
                <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
                  <span className="block font-black text-amber-700 text-base">{cloudSyncResultModal.counts.homeVisits}</span>
                  <span className="text-[10px] text-gray-600 font-bold">Home Visit</span>
                </div>
                <div className="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-200">
                  <span className="block font-black text-indigo-700 text-base">{cloudSyncResultModal.counts.attendance}</span>
                  <span className="text-[10px] text-gray-600 font-bold">Absensi</span>
                </div>
                <div className="bg-purple-50/70 p-2.5 rounded-xl border border-purple-200">
                  <span className="block font-black text-purple-700 text-base">{cloudSyncResultModal.counts.counselors}</span>
                  <span className="text-[10px] text-gray-600 font-bold">Guru BK</span>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCloudSyncResultModal(null)}
                className="px-5 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer active:scale-97"
              >
                Tutup & Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

