import { useState, useMemo, useEffect } from 'react';
import { Student, ViolationRecord, CounselingService, ActivityLog, StudentAchievement, ClassAttendanceRecord, Counselor } from '../types';
import { loadSchoolData } from '../utils/firestoreSync';
import { getSchoolConfig } from '../utils/schoolConfig';
import { getAllowedClassesList, filterAttendanceHistory } from '../utils/accessControl';
import { motion, AnimatePresence } from 'motion/react';
import StickyNotesWidget from './StickyNotesWidget';
import JadwalMengajarWidget from './JadwalMengajarWidget';
import AiAssistantWidget from './AiAssistantWidget';
import DashboardStatsView from './DashboardStatsView';
import GrafikLayananBulananCard from './GrafikLayananBulananCard';
import PengingatTindakLanjutWidget from './PengingatTindakLanjutWidget';
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  AlertTriangle,
  Award,
  HeartHandshake,
  Activity,
  History,
  Inbox,
  Check,
  Clock,
  CheckCircle2,
  SlidersHorizontal,
  Home,
  CheckCircle,
  Gavel,
  ExternalLink,
  Sparkles
} from 'lucide-react';

interface DashboardViewProps {
  students: Student[];
  violations: ViolationRecord[];
  services: CounselingService[];
  logs: ActivityLog[];
  achievements?: StudentAchievement[];
  activeCounselor?: Counselor;
  onNavigateToTab: (tab: string, searchQuery?: string, presetJournal?: { className?: string; topic?: string; subject?: string; startTime?: string; endTime?: string; period?: string }) => void;
  onNavigateToForm: (form: string, selectStudentId?: string) => void;
  onUpdateViolationStatus?: (id: string, status: any, progress: string) => void;
  onUpdateServiceStatus?: (id: string, status: any, followUp?: string) => void;
  onEditService?: (service: CounselingService) => void;
}

export default function DashboardView({
  students = [],
  violations = [],
  services = [],
  logs = [],
  achievements = [],
  activeCounselor,
  onNavigateToTab,
  onNavigateToForm,
  onUpdateViolationStatus,
  onUpdateServiceStatus,
}: DashboardViewProps) {
  // 🔒 Privacy Mode State (Mask student names when active)
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bk_privacy_mode') === 'true';
    } catch {
      return false;
    }
  });

  const togglePrivacyMode = () => {
    setIsPrivacyMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('bk_privacy_mode', String(next));
      } catch {}
      return next;
    });
  };

  // Helper to mask student names on Beranda preview cards (strictly avoid Melia A. ***)
  const maskStudentName = (name: string, isPrivate: boolean, aliasLabel: string = 'Siswa') => {
    if (!name) return aliasLabel;
    return aliasLabel;
  };

  // Filter state for timeline logs
  const [aktivitasFilter, setAktivitasFilter] = useState<'all' | 'violation' | 'counseling' | 'other'>('all');
  const [showAllLogs, setShowAllLogs] = useState(false);

  // Collapsible state for pending cases section (default FALSE to keep dashboard clean & uncluttered)
  const [isCasesSectionOpen, setIsCasesSectionOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bk_dashboard_cases_expanded') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCasesSection = () => {
    setIsCasesSectionOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('bk_dashboard_cases_expanded', String(next));
      } catch {}
      return next;
    });
  };

  // Filter & Handling state for pending cases (Restitusi & Layanan Terjadwal)
  const [unresolvedTab, setUnresolvedTab] = useState<'violation' | 'service'>('violation');
  const [handlingViolationId, setHandlingViolationId] = useState<string | null>(null);
  const [handlingHandledBy, setHandlingHandledBy] = useState<'Wali Kelas' | 'Guru BK' | 'Wali Kelas & Guru BK'>('Guru BK');
  const [handlingProgress, setHandlingProgress] = useState('');
  const [handlingServiceId, setHandlingServiceId] = useState<string | null>(null);
  const [handlingServiceFollowUp, setHandlingServiceFollowUp] = useState('');

  // Unresolved cases
  const unresolvedViolations = useMemo(() => {
    return violations.filter(
      (v) => !v.handledBy || v.handledBy === 'Belum Ditangani' || !v.handlingProgress
    );
  }, [violations]);

  const unresolvedServices = useMemo(() => {
    return services.filter((s) => s.status === 'Terjadwal');
  }, [services]);

  // Reactive Attendance records state
  const [attendanceHistory, setAttendanceHistory] = useState<ClassAttendanceRecord[]>(() => {
    return loadSchoolData('bk_attendance_history', []);
  });

  useEffect(() => {
    const handleAttendanceUpdate = (e?: any) => {
      if (Array.isArray(e?.detail)) {
        setAttendanceHistory(e.detail);
      } else if (e?.detail?.key === 'bk_attendance_history' && Array.isArray(e.detail.data)) {
        setAttendanceHistory(e.detail.data);
      } else {
        setAttendanceHistory(loadSchoolData('bk_attendance_history', []));
      }
    };

    window.addEventListener('bk_attendance_history_changed', handleAttendanceUpdate);
    window.addEventListener('bk_realtime_sync', handleAttendanceUpdate);
    window.addEventListener('storage', handleAttendanceUpdate);
    window.addEventListener('bk_school_changed', handleAttendanceUpdate);

    return () => {
      window.removeEventListener('bk_attendance_history_changed', handleAttendanceUpdate);
      window.removeEventListener('bk_realtime_sync', handleAttendanceUpdate);
      window.removeEventListener('storage', handleAttendanceUpdate);
      window.removeEventListener('bk_school_changed', handleAttendanceUpdate);
    };
  }, []);

  // Attendance reminder calculations (Class-normalized and timezone-safe)
  const attendanceReminderData = useMemo(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const todayLocal = new Date(today.getTime() - tzOffset).toISOString().slice(0, 10);
    const todayUtc = today.toISOString().split('T')[0];

    const normalizeCls = (c: string) => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizeDt = (d: string) => String(d || '').trim().slice(0, 10);

    const relevantAttendance = activeCounselor ? filterAttendanceHistory(attendanceHistory || [], activeCounselor) : (attendanceHistory || []);
    const recordedClassesSet = new Set<string>();

    relevantAttendance.forEach((r: any) => {
      if (!r) return;
      const rDate = normalizeDt(r.date);
      const isToday = rDate === todayLocal || rDate === todayUtc;
      const hasRecords = Array.isArray(r.records) && r.records.length > 0;
      if (isToday && hasRecords) {
        const clsName = r.class || r.className || r.kelas || '';
        if (clsName) {
          recordedClassesSet.add(normalizeCls(clsName));
        }
      }
    });

    const availableClasses = Array.from(new Set(students.map((s) => s.class))).filter(Boolean).sort();
    const allowedFromCounselor = getAllowedClassesList(activeCounselor);
    const allClasses = availableClasses.length > 0
      ? availableClasses
      : allowedFromCounselor.length > 0
      ? allowedFromCounselor
      : ['7A', '7B', '7C', '7D', '8A', '8B', '8C', '8D', '9A', '9B', '9C', '9D'];

    const unrecorded = allClasses.filter((c) => !recordedClassesSet.has(normalizeCls(c)));
    const recordedCount = allClasses.length - unrecorded.length;

    return {
      totalClasses: allClasses.length,
      recordedCount,
      unrecorded,
    };
  }, [students, attendanceHistory, activeCounselor]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-[100px]">
      {/* 🔔 PENGINGAT TINDAK LANJUT (PALING ATAS BERANDA) */}
      <PengingatTindakLanjutWidget
        services={services}
        students={students}
        activeCounselor={activeCounselor}
        isPrivacyMode={isPrivacyMode}
        onNavigateToTab={onNavigateToTab}
      />

      {/* 🚀 3 TOMBOL BESAR UTAMA GURU BK DI ATAS BERANDA */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-[#00685f]/10 px-2.5 py-0.5 rounded-md border border-[#00685f]/15">
              Aksi Cepat Beranda
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#0b1c30] mt-1 tracking-tight">
              Pintasan Utama Guru BK
            </h2>
          </div>

          <button
            type="button"
            onClick={togglePrivacyMode}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer active:scale-97 ${
              isPrivacyMode
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400 shadow-2xs'
                : 'bg-white hover:bg-gray-100 text-[#00685f] border-[#bcc9c6]/50 shadow-2xs'
            }`}
            title={isPrivacyMode ? 'Tampilkan Nama Lengkap Siswa' : 'Sembunyikan Nama Siswa (Privacy)'}
          >
            {isPrivacyMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isPrivacyMode ? 'Mode Privasi (Aktif)' : 'Mode Privasi'}</span>
          </button>
        </div>

        {/* 3 Tombol Besar: [Absen Hari Ini] [Catat Kasus Baru] [Chat Si Becik] */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* 1. Absen Hari Ini */}
          <button
            type="button"
            onClick={() => onNavigateToTab('absensi')}
            className="flex items-center gap-4 p-4 sm:p-5 bg-gradient-to-br from-teal-600 to-[#00685f] hover:from-teal-700 hover:to-[#005049] text-white rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer text-left active:scale-98 group"
          >
            <div className="w-13 h-13 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20 group-hover:scale-105 transition-transform shadow-inner">
              <CheckCircle2 className="w-7 h-7 text-white stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black tracking-wider uppercase text-teal-200">Presensi Harian</span>
              <p className="text-base sm:text-lg font-black tracking-tight leading-tight">Absen Hari Ini</p>
              <p className="text-xs text-teal-100 font-medium mt-0.5 opacity-90 truncate">Cek & input kehadiran kelas</p>
            </div>
            <ChevronRight className="w-5 h-5 text-teal-200 group-hover:translate-x-1 transition-transform shrink-0" />
          </button>

          {/* 2. Catat Kasus Baru */}
          <button
            type="button"
            onClick={() => onNavigateToForm('pelanggaran')}
            className="flex items-center gap-4 p-4 sm:p-5 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer text-left active:scale-98 group"
          >
            <div className="w-13 h-13 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20 group-hover:scale-105 transition-transform shadow-inner">
              <AlertTriangle className="w-7 h-7 text-white stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black tracking-wider uppercase text-blue-200">Disiplin & Kasus</span>
              <p className="text-base sm:text-lg font-black tracking-tight leading-tight">Catat Kasus Baru</p>
              <p className="text-xs text-blue-100 font-medium mt-0.5 opacity-90 truncate">Input masalah siswa & bobot poin</p>
            </div>
            <ChevronRight className="w-5 h-5 text-blue-200 group-hover:translate-x-1 transition-transform shrink-0" />
          </button>

          {/* 3. Chat Si Becik */}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('chat-si-becik-section');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-4 p-4 sm:p-5 bg-gradient-to-br from-purple-600 to-violet-700 hover:from-purple-700 hover:to-violet-800 text-white rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer text-left active:scale-98 group"
          >
            <div className="w-13 h-13 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20 group-hover:scale-105 transition-transform shadow-inner">
              <Sparkles className="w-7 h-7 text-white stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black tracking-wider uppercase text-purple-200">Kecerdasan Buatan</span>
              <p className="text-base sm:text-lg font-black tracking-tight leading-tight">Chat Si Becik</p>
              <p className="text-xs text-purple-100 font-medium mt-0.5 opacity-90 truncate">Konsultasi solusi bimbingan BK</p>
            </div>
            <ChevronRight className="w-5 h-5 text-purple-200 group-hover:translate-x-1 transition-transform shrink-0" />
          </button>
        </div>

        {/* 📋 KELAS BELUM DIABSEN (TAMPIL TEPAT DI BAWAH 3 TOMBOL BESAR) */}
        {attendanceReminderData.unrecorded.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 sm:p-5 shadow-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 border border-amber-400/40 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-amber-700 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[#0b1c30]">
                    Kelas Belum Diabsen ({attendanceReminderData.unrecorded.length} Kelas)
                  </h4>
                  <p className="text-xs text-[#3d4947]">
                    {attendanceReminderData.recordedCount} dari {attendanceReminderData.totalClasses} kelas telah lengkap diabsen hari ini
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateToTab('absensi')}
                className="text-xs font-black text-amber-900 hover:text-amber-950 underline self-start sm:self-auto cursor-pointer"
              >
                Buka Modul Absensi Lengkap →
              </button>
            </div>

            {/* Quick buttons per unrecorded class */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {attendanceReminderData.unrecorded.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => onNavigateToTab('absensi', cls)}
                  className="px-3 py-1.5 bg-white hover:bg-amber-100/70 text-amber-950 border border-amber-300 rounded-xl text-xs font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <span className="text-[#00685f] font-black">+</span> Absen Kelas {cls}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-sm shrink-0">
                ✓
              </div>
              <div>
                <p className="text-xs sm:text-sm font-black text-emerald-950">
                  Kelas Belum Diabsen: Nihil (Semua Kelas Sudah Diabsen Hari Ini!)
                </p>
                <p className="text-[11px] text-emerald-800">
                  Presensi {attendanceReminderData.totalClasses} kelas telah lengkap tercatat dalam sistem.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab('absensi')}
              className="text-xs font-extrabold text-[#00685f] hover:underline self-start sm:self-auto cursor-pointer"
            >
              Lihat Rekap Absensi →
            </button>
          </div>
        )}
      </div>

      {/* 🤖 REKAN AI BK - CHAT SI BECIK (TARGET SCROLL DARI TOMBOL ATAS) */}
      <div id="chat-si-becik-section">
        <AiAssistantWidget
          counselor={activeCounselor || { id: 'c1', name: 'Guru BK', nip: '-', role: 'Bimbingan Konseling', avatar: '', allowedClasses: [] }}
          students={students}
          services={services}
          violations={violations}
          onNavigateToTab={onNavigateToTab}
          onNavigateToForm={onNavigateToForm}
        />
      </div>

      {/* 📊 SEKSI 1: IKHTISAR & ANALITIK LAYANAN BK */}
      <div className="space-y-4">
        <DashboardStatsView
          services={services}
          violations={violations}
          achievements={achievements}
          students={students}
          attendanceHistory={activeCounselor ? filterAttendanceHistory(attendanceHistory || [], activeCounselor) : attendanceHistory}
          onNavigateToTab={onNavigateToTab}
        />
      </div>

      {/* 📊 SEKSI 1B: GRAFIK BATANG BULANAN JENIS LAYANAN BK (RECHARTS VISUALIZER) */}
      <div>
        <GrafikLayananBulananCard
          services={services}
          onNavigateToForm={onNavigateToForm}
          onNavigateToTab={onNavigateToTab}
        />
      </div>

      {/* 🔄 SEKSI 2: MONITORING KASUS & RESTITUSI (FLEKSIBEL / COLLAPSIBLE) */}
      <div className="bg-white rounded-2xl shadow-2xs border border-[#bcc9c6]/30 overflow-hidden transition-all duration-200">
        {/* Compact Summary Header (Always visible, clean, non-intrusive) */}
        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center shrink-0">
              <Gavel className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-extrabold text-[#0b1c30]">
                  Bimbingan Kasus & Restitusi Perilaku
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {unresolvedViolations.length > 0 ? (
                    <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 font-extrabold px-2 py-0.5 rounded-md">
                      {unresolvedViolations.length} Restitusi Pending
                    </span>
                  ) : (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold px-2 py-0.5 rounded-md">
                      ✓ Restitusi Nihil
                    </span>
                  )}
                  {unresolvedServices.length > 0 && (
                    <span className="text-[10px] bg-teal-50 text-[#00685f] border border-teal-200 font-extrabold px-2 py-0.5 rounded-md">
                      {unresolvedServices.length} Konseling Terjadwal
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-[#3d4947]/70 font-semibold mt-0.5">
                {unresolvedViolations.length > 0
                  ? `${unresolvedViolations.length} pembinaan perilaku siswa memerlukan pendampingan restoratif`
                  : 'Seluruh rekam bimbingan perilaku siswa telah selesai ditindaklanjuti.'}
              </p>
            </div>
          </div>

          {/* Action & Toggle Controls */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-center flex-wrap">
            <button
              type="button"
              onClick={() => onNavigateToTab('pembinaan-pendisiplinan')}
              className="px-3.5 py-2 bg-[#f8faf9] hover:bg-[#e6f4f1] text-[#00685f] hover:text-[#005049] border border-[#bcc9c6]/40 hover:border-[#00685f]/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-97 flex items-center gap-1.5"
              title="Buka Buku Kasus & Pembinaan Lengkap"
            >
              <span>Buka Buku Kasus</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={toggleCasesSection}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-97 flex items-center gap-1.5 border ${
                isCasesSectionOpen
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-white hover:bg-gray-50 text-[#0b1c30] border-[#bcc9c6]/50'
              }`}
              title={isCasesSectionOpen ? 'Sembunyikan detail kasus dari dashboard' : 'Tampilkan daftar kasus di dashboard'}
            >
              <span>{isCasesSectionOpen ? 'Sembunyikan Panel' : 'Lihat di Dashboard'}</span>
              {isCasesSectionOpen ? (
                <ChevronUp className="w-4 h-4 text-amber-700" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Expanded Panel */}
        <AnimatePresence>
          {isCasesSectionOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="border-t border-[#bcc9c6]/25 p-5 sm:p-6 bg-[#fcfdfd] space-y-5 overflow-hidden"
            >
              {/* Tab Selector Inside Panel */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#bcc9c6]/20">
                <div className="flex bg-[#f4f7f6] p-1.5 rounded-xl border border-[#bcc9c6]/30 self-start">
                  <button
                    type="button"
                    onClick={() => {
                      setUnresolvedTab('violation');
                      setHandlingViolationId(null);
                      setHandlingServiceId(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      unresolvedTab === 'violation'
                        ? 'bg-white text-rose-700 shadow-2xs font-extrabold'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <span>Restitusi Perilaku</span>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-black ${
                      unresolvedTab === 'violation' ? 'bg-rose-100 text-rose-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {unresolvedViolations.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUnresolvedTab('service');
                      setHandlingViolationId(null);
                      setHandlingServiceId(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      unresolvedTab === 'service'
                        ? 'bg-white text-[#00685f] shadow-2xs font-extrabold'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <span>Layanan BK Terjadwal</span>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-black ${
                      unresolvedTab === 'service' ? 'bg-teal-100 text-[#00685f]' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {unresolvedServices.length}
                    </span>
                  </button>
                </div>

                <span className="text-xs text-[#3d4947]/70 font-semibold">
                  Menampilkan maksimal 6 data terbaru yang butuh tindak lanjut
                </span>
              </div>

              {/* Content Area */}
              <div className="space-y-4">
                <AnimatePresence mode="wait">
                  {unresolvedTab === 'violation' ? (
                    <motion.div
                      key="unresolved-violations"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {unresolvedViolations.length === 0 ? (
                        <div className="py-10 text-center bg-emerald-50/20 rounded-2xl border border-dashed border-emerald-200">
                          <Check className="w-9 h-9 text-emerald-500 mx-auto mb-2 bg-emerald-50 p-2 rounded-full" />
                          <h4 className="text-xs font-extrabold text-emerald-950">Seluruh Kasus Perilaku Telah Direstitusi</h4>
                          <p className="text-[11px] text-emerald-800/80 mt-0.5 max-w-sm mx-auto leading-relaxed font-medium">
                            Hebat! Seluruh rekam bimbingan perilaku siswa telah selesai ditindaklanjuti secara restoratif.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {unresolvedViolations.slice(0, 6).map((v, idx) => {
                            const isExpanding = handlingViolationId === v.id;

                            return (
                              <div
                                key={v.id}
                                className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                                  isExpanding
                                    ? 'border-rose-400 bg-rose-50/15 ring-1 ring-rose-400/20 shadow-xs'
                                    : 'border-rose-100 bg-white hover:bg-rose-50/10 hover:border-rose-200 shadow-2xs'
                                }`}
                              >
                                <div className="space-y-2">
                                  <div className="flex justify-between items-start gap-4">
                                    <span className="text-[10px] font-extrabold bg-rose-100/70 text-rose-700 px-2 py-0.5 rounded-lg uppercase tracking-wide border border-rose-200/50">
                                      {v.category}
                                    </span>
                                    <span className="text-xs font-extrabold text-rose-600 font-mono">
                                      Bobot: {v.pointsAdded}
                                    </span>
                                  </div>

                                  <div>
                                    <h4
                                      onClick={() => onNavigateToTab('data-siswa', v.studentName)}
                                      className="font-extrabold text-xs text-[#0b1c30] hover:underline cursor-pointer inline-flex items-center gap-1.5"
                                      title="Klik untuk melihat profil lengkap siswa di halaman Data Siswa"
                                    >
                                      <span>Siswa {idx + 1} ({v.studentClass || '-'})</span>
                                    </h4>
                                    <p className="text-[11px] text-[#3d4947]/70 font-semibold mt-0.5">
                                      Tanggal: {v.date} &bull; {v.time} WIB
                                    </p>
                                  </div>

                                  <div className="bg-[#f8faf9] p-2.5 rounded-xl border border-gray-100 text-xs text-gray-600 italic leading-relaxed">
                                    "{v.notes || 'Tidak ada catatan detail.'}"
                                  </div>
                                  
                                  <p className="text-[10px] text-gray-400 font-semibold">
                                    Dilaporkan oleh: <span className="font-bold text-gray-500">{v.reportedBy}</span>
                                  </p>
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-100/60 flex flex-col gap-2.5">
                                  {!isExpanding ? (
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setHandlingViolationId(v.id);
                                          setHandlingHandledBy('Guru BK');
                                          setHandlingProgress('');
                                          setHandlingServiceId(null);
                                        }}
                                        className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-98"
                                      >
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        <span>Tindak Lanjuti & Selesaikan</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onNavigateToTab('data-siswa', v.studentName)}
                                        className="py-2 px-3 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-extrabold rounded-xl transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                                        title="Lihat Profil Detail"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      className="space-y-3 text-left"
                                    >
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-extrabold text-gray-600 uppercase tracking-wider block">
                                          Pihak Penanggung Jawab:
                                        </label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                          {(['Guru BK', 'Wali Kelas', 'Wali Kelas & Guru BK'] as const).map((role) => (
                                            <button
                                              key={role}
                                              type="button"
                                              onClick={() => setHandlingHandledBy(role)}
                                              className={`py-1 px-1.5 rounded-lg text-[10px] font-extrabold border transition-all ${
                                                handlingHandledBy === role
                                                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                                                  : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700'
                                              }`}
                                            >
                                              {role}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[10px] font-extrabold text-gray-600 uppercase tracking-wider block">
                                          Catatan / Progres Tindakan Restitusi:
                                        </label>
                                        <textarea
                                          value={handlingProgress}
                                          onChange={(e) => setHandlingProgress(e.target.value)}
                                          placeholder="Tuliskan tindakan pembinaan atau kesepakatan perbaikan yang disepakati..."
                                          className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-400 bg-white"
                                          rows={2}
                                          required
                                        />
                                      </div>

                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!handlingProgress.trim()) {
                                              alert('Harap isi progres penanganan terlebih dahulu!');
                                              return;
                                            }
                                            if (onUpdateViolationStatus) {
                                              onUpdateViolationStatus(v.id, handlingHandledBy, handlingProgress);
                                              setHandlingViolationId(null);
                                            }
                                          }}
                                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
                                        >
                                          Simpan & Selesaikan
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setHandlingViolationId(null)}
                                          className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
                                        >
                                          Batal
                                        </button>
                                      </div>
                                    </motion.div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="unresolved-services"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {unresolvedServices.length === 0 ? (
                        <div className="py-10 text-center bg-teal-50/20 rounded-2xl border border-dashed border-teal-200">
                          <Check className="w-9 h-9 text-teal-600 mx-auto mb-2 bg-teal-50 p-2 rounded-full" />
                          <h4 className="text-xs font-extrabold text-teal-950">Tidak Ada Layanan Terjadwal Pending</h4>
                          <p className="text-[11px] text-teal-800/80 mt-0.5 max-w-sm mx-auto leading-relaxed font-medium">
                            Semua agenda layanan konseling siswa telah terselesaikan sesuai jadwal.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {unresolvedServices.slice(0, 6).map((srv, idx) => {
                            const isExpanding = handlingServiceId === srv.id;

                            return (
                              <div
                                key={srv.id}
                                className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                                  isExpanding
                                    ? 'border-[#00685f] bg-[#e6f4f1]/30 ring-1 ring-[#00685f]/20 shadow-xs'
                                    : 'border-[#bcc9c6]/30 bg-white hover:bg-[#e6f4f1]/20 shadow-2xs'
                                }`}
                              >
                                <div className="space-y-2">
                                  <div className="flex justify-between items-start gap-4">
                                    <span className="text-[10px] font-extrabold bg-[#e6f4f1] text-[#00685f] px-2 py-0.5 rounded-lg uppercase tracking-wide border border-[#00685f]/20">
                                      {srv.serviceType}
                                    </span>
                                    <span className="text-xs font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                      Terjadwal
                                    </span>
                                  </div>

                                  <div>
                                    <h4 
                                      onClick={() => srv.students?.[0] && onNavigateToTab('data-siswa', srv.students[0].name)}
                                      className="font-extrabold text-xs text-[#0b1c30] hover:underline cursor-pointer inline-flex items-center gap-1.5"
                                      title="Klik untuk melihat profil lengkap siswa di halaman Data Siswa"
                                    >
                                      <span>Siswa {idx + 1} ({srv.students?.map((s) => s.class).join(', ') || '-'}) - {srv.serviceType}</span>
                                    </h4>
                                    <p className="text-[11px] text-[#3d4947]/70 font-semibold mt-0.5">
                                      Jadwal: {srv.date} &bull; {srv.startTime} - {srv.endTime} WIB
                                    </p>
                                  </div>

                                  <div className="bg-[#f8faf9] p-2.5 rounded-xl border border-gray-100 text-xs text-gray-600 leading-relaxed">
                                    <span className="font-bold text-[#0b1c30]">Fokus Masalah: </span>
                                    {srv.problem || 'Konseling umum'}
                                  </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-100/60 flex flex-col gap-2.5">
                                  {!isExpanding ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setHandlingServiceId(srv.id);
                                        setHandlingServiceFollowUp('');
                                        setHandlingViolationId(null);
                                      }}
                                      className="w-full py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-extrabold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-98"
                                    >
                                      <HeartHandshake className="w-3.5 h-3.5" />
                                      <span>Selesaikan Sesi Konseling</span>
                                    </button>
                                  ) : (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      className="space-y-3 text-left"
                                    >
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-extrabold text-gray-600 uppercase tracking-wider block">
                                          Catatan Hasil Layanan & Tindak Lanjut:
                                        </label>
                                        <textarea
                                          value={handlingServiceFollowUp}
                                          onChange={(e) => setHandlingServiceFollowUp(e.target.value)}
                                          placeholder="Tuliskan hasil sesi konseling dan rencana tindak lanjut..."
                                          className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00685f] bg-white"
                                          rows={2}
                                          required
                                        />
                                      </div>

                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (onUpdateServiceStatus) {
                                              onUpdateServiceStatus(srv.id, 'Selesai', handlingServiceFollowUp);
                                              setHandlingServiceId(null);
                                            }
                                          }}
                                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
                                        >
                                          Tandai Selesai
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setHandlingServiceId(null)}
                                          className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
                                        >
                                          Batal
                                        </button>
                                      </div>
                                    </motion.div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 📌 SEKSI 3: JADWAL MENGAJAR & CATATAN MEMO CEPAT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <JadwalMengajarWidget
            activeCounselor={activeCounselor}
            onFillJournalForClass={(className, lastTopic, subject, startTime, endTime, period) => {
              onNavigateToTab('jurnal-harian', undefined, {
                className,
                topic: lastTopic,
                subject: subject || `Bimbingan Klasikal - ${className}`,
                startTime,
                endTime,
                period
              });
            }}
          />
        </div>
        <div className="lg:col-span-5">
          <StickyNotesWidget activeCounselor={activeCounselor} />
        </div>
      </div>

      {/* ⏱️ SEKSI 4: AKTIVITAS TERBARU & JURNAL LINIMASA */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xs border border-[#bcc9c6]/30 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#bcc9c6]/20">
          <div>
            <h3 className="text-base font-extrabold text-[#0b1c30] flex items-center gap-2">
              <History className="w-5 h-5 text-[#00685f] shrink-0" />
              <span>Aktivitas Terbaru & Jurnal Linimasa</span>
            </h3>
            <p className="text-xs text-[#3d4947]/70 font-semibold mt-0.5">
              Jurnal kronologis layanan BK, pembinaan perilaku, dan perkembangan karakter siswa
            </p>
          </div>
          
          {/* Activity Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-[#f4f7f6] p-1 rounded-xl border border-[#bcc9c6]/20">
            <button
              type="button"
              onClick={() => setAktivitasFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                aktivitasFilter === 'all'
                  ? 'bg-white text-[#00685f] shadow-2xs font-extrabold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setAktivitasFilter('violation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                aktivitasFilter === 'violation'
                  ? 'bg-white text-[#ba1a1a] shadow-2xs font-extrabold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pembinaan
            </button>
            <button
              type="button"
              onClick={() => setAktivitasFilter('counseling')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                aktivitasFilter === 'counseling'
                  ? 'bg-white text-[#00685f] shadow-2xs font-extrabold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Layanan BK
            </button>
            <button
              type="button"
              onClick={() => setAktivitasFilter('other')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                aktivitasFilter === 'other'
                  ? 'bg-white text-gray-700 shadow-2xs font-extrabold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Absensi & Lainnya
            </button>
          </div>
        </div>

        {/* Timeline List */}
        <div className="space-y-4">
          {(() => {
            const filteredLogs = logs.filter((log) => {
              if (aktivitasFilter === 'all') return true;
              if (aktivitasFilter === 'violation') return log.type === 'violation';
              if (aktivitasFilter === 'counseling') return log.type === 'counseling' || log.type === 'homevisit';
              if (aktivitasFilter === 'other') return log.type === 'attendance';
              return true;
            });

            if (filteredLogs.length === 0) {
              return (
                <div className="py-8 flex flex-col items-center justify-center text-center bg-[#f8fafa] rounded-2xl border border-dashed border-gray-200">
                  <Activity className="w-8 h-8 text-gray-300 mb-2" />
                  <h4 className="font-extrabold text-xs text-[#0b1c30]">Belum Ada Aktivitas</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5 max-w-xs leading-relaxed font-medium">
                    Belum ada riwayat aktivitas yang tercatat untuk kategori bimbingan atau pembinaan perilaku ini.
                  </p>
                </div>
              );
            }

            const visibleLogs = showAllLogs ? filteredLogs : filteredLogs.slice(0, 6);

            return (
              <div className="space-y-4">
                <div className="relative pl-4 sm:pl-6 border-l-2 border-[#00685f]/15 space-y-3.5 ml-2">
                  {visibleLogs.map((log, idx) => {
                    let cardStyle = 'bg-[#e6f4f1]/30 border-[#00685f]/20 hover:bg-[#e6f4f1]/60';
                    let iconBg = 'bg-[#00685f]';
                    let iconSymbol = <HeartHandshake className="w-3.5 h-3.5 text-white" />;
                    let categoryLabel = 'Layanan BK';
                    let badgeStyle = 'bg-[#00685f]/10 text-[#00685f] border-[#00685f]/30';

                    if (log.type === 'violation') {
                      cardStyle = 'bg-amber-50/40 border-amber-200/70 hover:bg-amber-50/80';
                      iconBg = 'bg-amber-600';
                      iconSymbol = <AlertTriangle className="w-3.5 h-3.5 text-white" />;
                      categoryLabel = 'Pelanggaran / Pembinaan';
                      badgeStyle = 'bg-amber-100 text-amber-900 border-amber-300';
                    } else if (log.type === 'homevisit') {
                      cardStyle = 'bg-purple-50/40 border-purple-200/70 hover:bg-purple-50/80';
                      iconBg = 'bg-purple-600';
                      iconSymbol = <Home className="w-3.5 h-3.5 text-white" />;
                      categoryLabel = 'Kunjungan Rumah';
                      badgeStyle = 'bg-purple-100 text-purple-900 border-purple-300';
                    } else if (log.type === 'attendance') {
                      cardStyle = 'bg-emerald-50/40 border-emerald-200/70 hover:bg-emerald-50/80';
                      iconBg = 'bg-emerald-600';
                      iconSymbol = <CheckCircle className="w-3.5 h-3.5 text-white" />;
                      categoryLabel = 'Absensi & Presensi';
                      badgeStyle = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                    } else if (log.type === 'counseling') {
                      cardStyle = 'bg-teal-50/40 border-teal-200/70 hover:bg-teal-50/80';
                      iconBg = 'bg-[#00685f]';
                      iconSymbol = <HeartHandshake className="w-3.5 h-3.5 text-white" />;
                      categoryLabel = 'Sesi Konseling BK';
                      badgeStyle = 'bg-teal-100 text-[#00685f] border-teal-300';
                    }

                    return (
                      <div
                        key={log.id}
                        className="relative group transition-all"
                      >
                        {/* Left Dot Tracker */}
                        <span className={`absolute -left-[25px] sm:-left-[33px] top-2 w-5 h-5 rounded-full ${iconBg} flex items-center justify-center shadow-2xs ring-4 ring-white group-hover:scale-110 transition-transform z-10`}>
                          {iconSymbol}
                        </span>

                        {/* Timeline Card */}
                        <div className={`p-3.5 rounded-2xl border ${cardStyle} transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:shadow-xs`}>
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-extrabold text-[#3d4947]">
                                {log.timeLabel}
                              </span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border tracking-wider ${badgeStyle}`}>
                                {categoryLabel}
                              </span>
                            </div>
                            <h4 className="font-black text-xs text-[#0b1c30] truncate">
                              {log.studentName
                                ? log.title.replace(new RegExp(log.studentName, 'gi'), `Siswa ${idx + 1}`)
                                : log.title}
                            </h4>
                            <p className="text-[11px] text-[#3d4947] font-medium leading-snug line-clamp-2">
                              {log.studentName
                                ? log.description.replace(new RegExp(log.studentName, 'gi'), `Siswa ${idx + 1}`)
                                : log.description}
                            </p>
                          </div>
                          
                          <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                            <button
                              type="button"
                              onClick={() => onNavigateToTab('data-siswa', log.studentName)}
                              className="text-[10px] font-black text-[#00685f] hover:underline bg-white border border-[#00685f]/30 px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-2xs hover:bg-[#00685f] hover:text-white"
                            >
                              <span>Lihat Siswa</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredLogs.length > 6 && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllLogs(!showAllLogs)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#f4f7f6] hover:bg-[#e6f4f1] text-[#00685f] font-extrabold text-xs rounded-xl transition-all cursor-pointer border border-[#bcc9c6]/30 shadow-2xs"
                    >
                      <span>
                        {showAllLogs
                          ? 'Tampilkan Lebih Ringkas'
                          : `Lihat Selengkapnya (${filteredLogs.length - 6} aktivitas lagi)`}
                      </span>
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${showAllLogs ? '-rotate-90' : 'rotate-90'}`} />
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Footer Hak Cipta & Pembuat Aplikasi */}
      <footer className="pt-6 mt-8 border-t border-[#bcc9c6]/20 text-center text-xs text-[#3d4947] opacity-80 font-semibold space-y-1">
        <p>
          Dibuat oleh: <span className="text-[#00685f] font-extrabold">Aulia Aji Sasongko, S.Pd.</span> | HP: <span className="text-[#00685f] font-extrabold">089681287339</span>
        </p>
        <p className="text-[10px] text-gray-400 font-medium">
          Hak Cipta Dilindungi &copy; {new Date().getFullYear()} Sistem Administrasi BK {activeCounselor?.schoolName || getSchoolConfig(activeCounselor?.schoolId).schoolName}
        </p>
      </footer>
    </div>
  );
}
