import { useState, useMemo, useEffect } from 'react';
import { Student, ViolationRecord, CounselingService, ActivityLog, StudentAchievement, ClassAttendanceRecord, Counselor } from '../types';
import { loadSchoolData } from '../utils/firestoreSync';
import { motion, AnimatePresence } from 'motion/react';
import StickyNotesWidget from './StickyNotesWidget';
import JadwalMengajarWidget from './JadwalMengajarWidget';
import AiAssistantWidget from './AiAssistantWidget';
import DashboardStatsView from './DashboardStatsView';
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
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
  CheckCircle
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

  // Helper to mask student names when Privacy Mode is ON
  const maskStudentName = (name: string, isPrivate: boolean) => {
    if (!isPrivate || !name) return name;
    const trimmed = name.trim();
    if (!trimmed) return name;
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return `${parts[0].charAt(0)}*** 🔒`;
    }
    return `${parts[0]} ${parts[1].charAt(0)}. *** 🔒`;
  };

  // Filter state for timeline logs
  const [aktivitasFilter, setAktivitasFilter] = useState<'all' | 'violation' | 'counseling' | 'other'>('all');
  const [showAllLogs, setShowAllLogs] = useState(false);

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
      if (e?.detail?.key === 'bk_attendance_history' && Array.isArray(e.detail.data)) {
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

    const recordedClassesSet = new Set<string>();

    (attendanceHistory || []).forEach((r: any) => {
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
    const allClasses = availableClasses.length > 0
      ? availableClasses
      : ['7A', '7B', '7C', '7D', '8A', '8B', '8C', '8D', '9A', '9B', '9C', '9D'];

    const unrecorded = allClasses.filter((c) => !recordedClassesSet.has(normalizeCls(c)));
    const recordedCount = allClasses.length - unrecorded.length;

    return {
      totalClasses: allClasses.length,
      recordedCount,
      unrecorded,
    };
  }, [students, attendanceHistory]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-8">
      {/* 🤖 REKAN AI BK - DAILY ASSISTANT & STEP-BY-STEP WORKFLOW WIDGET */}
      <AiAssistantWidget
        counselor={activeCounselor || { id: 'c1', name: 'Guru BK', nip: '-', role: 'Bimbingan Konseling', avatar: '', allowedClasses: [] }}
        students={students}
        services={services}
        violations={violations}
        onNavigateToTab={onNavigateToTab}
        onNavigateToForm={onNavigateToForm}
      />

      {/* 🚀 QUICK ACTION BAR (AKSI CEPAT HARIAN) */}
      <div className="space-y-3">
        <div className="bg-white p-5 rounded-2xl border border-[#bcc9c6]/30 shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-4 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00685f]"></span>
              <h3 className="text-sm font-extrabold text-[#0b1c30]">
                Aksi Cepat Harian
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#3d4947]/70 font-semibold hidden sm:inline">
                Pintasan alur kerja harian Guru BK
              </span>
              <button
                type="button"
                onClick={togglePrivacyMode}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer active:scale-97 ${
                  isPrivacyMode
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400 shadow-2xs'
                    : 'bg-[#e6f4f1] hover:bg-[#d8ece7] text-[#00685f] border-[#00685f]/30'
                }`}
                title={isPrivacyMode ? 'Tampilkan Nama Lengkap Siswa' : 'Sembunyikan Nama Siswa (Privacy)'}
              >
                {isPrivacyMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{isPrivacyMode ? 'Mode Privasi (Aktif)' : 'Mode Privasi'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <button
              type="button"
              onClick={() => onNavigateToTab('jurnal-harian')}
              className="flex items-center gap-3 p-3.5 bg-[#f8faf9] hover:bg-[#e6f4f1] border border-[#bcc9c6]/30 hover:border-[#00685f]/40 rounded-xl text-left transition-all cursor-pointer group active:scale-98 shadow-2xs"
            >
              <div className="w-9 h-9 rounded-xl bg-[#00685f]/10 text-[#00685f] flex items-center justify-center shrink-0 group-hover:bg-[#00685f] group-hover:text-white transition-colors">
                <BookOpen className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#0b1c30] group-hover:text-[#00685f] truncate">Jurnal Harian</p>
                <p className="text-[11px] text-[#3d4947]/70 truncate">Agenda harian</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToTab('absensi')}
              className="flex items-center gap-3 p-3.5 bg-[#f8faf9] hover:bg-[#e6f4f1] border border-[#bcc9c6]/30 hover:border-[#00685f]/40 rounded-xl text-left transition-all cursor-pointer group active:scale-98 shadow-2xs"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center shrink-0 group-hover:bg-[#00685f] group-hover:text-white transition-colors">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#0b1c30] group-hover:text-[#00685f] truncate">Absensi Kelas</p>
                <p className="text-[11px] text-[#3d4947]/70 truncate">Presensi harian</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToForm('tambah-layanan')}
              className="flex items-center gap-3 p-3.5 bg-[#f8faf9] hover:bg-[#e6f4f1] border border-[#bcc9c6]/30 hover:border-[#00685f]/40 rounded-xl text-left transition-all cursor-pointer group active:scale-98 shadow-2xs"
            >
              <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-100 flex items-center justify-center shrink-0 group-hover:bg-[#00685f] group-hover:text-white transition-colors">
                <HeartHandshake className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#0b1c30] group-hover:text-[#00685f] truncate">Layanan BK</p>
                <p className="text-[11px] text-[#3d4947]/70 truncate">Konseling siswa</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToForm('pelanggaran')}
              className="flex items-center gap-3 p-3.5 bg-[#f8faf9] hover:bg-amber-50/70 border border-[#bcc9c6]/30 hover:border-amber-400/50 rounded-xl text-left transition-all cursor-pointer group active:scale-98 shadow-2xs"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#0b1c30] group-hover:text-amber-800 truncate">Pembinaan</p>
                <p className="text-[11px] text-[#3d4947]/70 truncate">Restitusi perilaku</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToTab('home-visit')}
              className="flex items-center gap-3 p-3.5 bg-[#f8faf9] hover:bg-indigo-50/70 border border-[#bcc9c6]/30 hover:border-indigo-400/50 rounded-xl text-left transition-all cursor-pointer group active:scale-98 shadow-2xs"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Home className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#0b1c30] group-hover:text-indigo-800 truncate">Home Visit</p>
                <p className="text-[11px] text-[#3d4947]/70 truncate">Kunjungan rumah</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToForm('apresiasi')}
              className="flex items-center gap-3 p-3.5 bg-[#f8faf9] hover:bg-emerald-50/70 border border-[#bcc9c6]/30 hover:border-emerald-400/50 rounded-xl text-left transition-all cursor-pointer group active:scale-98 shadow-2xs"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Award className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#0b1c30] group-hover:text-emerald-800 truncate">Apresiasi</p>
                <p className="text-[11px] text-[#3d4947]/70 truncate">Prestasi siswa</p>
              </div>
            </button>
          </div>
        </div>

        {/* Pengingat Presensi Harian Per Kelas */}
        {attendanceReminderData.unrecorded.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50/80 border border-amber-300/70 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-800 border border-amber-400/40 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
              </div>
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-xs font-extrabold text-[#0b1c30]">Pengingat Absensi:</span>
                <span className="text-[11px] font-extrabold px-2 py-0.5 bg-amber-200/80 text-amber-950 rounded-md border border-amber-300/70 shrink-0">
                  {attendanceReminderData.unrecorded.length} Kelas Belum Diabsen
                </span>
                <span className="text-[11px] text-[#3d4947]/70 hidden md:inline font-semibold">
                  ({attendanceReminderData.recordedCount}/{attendanceReminderData.totalClasses} kelas selesai hari ini)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap shrink-0 self-stretch sm:self-auto justify-start sm:justify-end">
              {attendanceReminderData.unrecorded.slice(0, 4).map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => onNavigateToTab('absensi', cls)}
                  className="px-2 py-1 text-[11px] font-extrabold bg-white hover:bg-[#e6f4f1] text-[#00685f] hover:text-[#005049] border border-amber-300/80 hover:border-[#00685f]/50 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1"
                >
                  <span className="text-[#00685f]">+</span> {cls}
                </button>
              ))}
              {attendanceReminderData.unrecorded.length > 4 && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab('absensi')}
                  className="px-2 py-1 text-[11px] font-bold bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  +{attendanceReminderData.unrecorded.length - 4} Lainnya
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigateToTab('absensi')}
                className="text-[11px] font-bold text-[#00685f] hover:text-[#005049] hover:underline px-1.5 py-1 cursor-pointer ml-1"
              >
                Modul Absensi →
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-emerald-900 truncate">
                Presensi Lengkap: Seluruh {attendanceReminderData.totalClasses} kelas telah diabsen hari ini.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab('absensi')}
              className="text-[11px] font-extrabold text-[#00685f] hover:text-[#005049] hover:underline cursor-pointer shrink-0"
            >
              Rekap Presensi →
            </button>
          </div>
        )}
      </div>

      {/* 📊 SEKSI 1: IKHTISAR & ANALITIK LAYANAN BK */}
      <div className="space-y-4">
        <DashboardStatsView
          services={services}
          violations={violations}
          achievements={achievements}
          onNavigateToTab={onNavigateToTab}
        />
      </div>

      {/* 🔄 SEKSI 2: KASUS & RESTITUSI PERILAKU DALAM PROSES */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xs border border-[#bcc9c6]/30 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#bcc9c6]/20">
          <div>
            <h3 className="text-base font-extrabold text-[#0b1c30] flex items-center gap-2">
              <Inbox className="w-5 h-5 text-[#00685f] shrink-0" />
              <span>Kasus & Rekonstruksi Perilaku Dalam Proses</span>
            </h3>
            <p className="text-xs text-[#3d4947]/70 font-semibold mt-0.5">
              Daftar bimbingan perilaku yang dalam proses restitusi atau layanan konseling terjadwal yang memerlukan pendampingan.
            </p>
          </div>

          {/* Tab Toggles with Counts */}
          <div className="flex bg-[#f4f7f6] p-1.5 rounded-xl border border-[#bcc9c6]/30 self-start md:self-center">
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
                  <div className="py-12 text-center bg-emerald-50/20 rounded-2xl border border-dashed border-emerald-200">
                    <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2.5 bg-emerald-50 p-2 rounded-full" />
                    <h4 className="text-xs font-extrabold text-emerald-950">Seluruh Kasus Perilaku Telah Direstitusi</h4>
                    <p className="text-[11px] text-emerald-800/80 mt-0.5 max-w-sm mx-auto leading-relaxed font-medium">
                      Hebat! Seluruh rekam bimbingan perilaku siswa telah selesai ditindaklanjuti secara restoratif.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {unresolvedViolations.slice(0, 6).map((v) => {
                      const isExpanding = handlingViolationId === v.id;

                      return (
                        <div
                          key={v.id}
                          className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                            isExpanding
                              ? 'border-rose-400 bg-rose-50/15 ring-1 ring-rose-400/20 shadow-xs'
                              : 'border-rose-100 bg-rose-50/5 hover:bg-rose-50/10 hover:border-rose-200 shadow-2xs'
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
                              >
                                {maskStudentName(v.studentName, isPrivacyMode)}
                                <span className="text-xs text-gray-400 font-semibold font-mono">({v.studentClass})</span>
                              </h4>
                              <p className="text-[11px] text-[#3d4947]/70 font-semibold mt-0.5">
                                Tanggal: {v.date} &bull; {v.time} WIB
                              </p>
                            </div>

                            <div className="bg-white p-2.5 rounded-xl border border-gray-100 text-xs text-gray-600 italic leading-relaxed">
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
                  <div className="py-12 text-center bg-teal-50/20 rounded-2xl border border-dashed border-teal-200">
                    <Check className="w-10 h-10 text-teal-600 mx-auto mb-2.5 bg-teal-50 p-2 rounded-full" />
                    <h4 className="text-xs font-extrabold text-teal-950">Tidak Ada Layanan Terjadwal Pending</h4>
                    <p className="text-[11px] text-teal-800/80 mt-0.5 max-w-sm mx-auto leading-relaxed font-medium">
                      Semua agenda layanan konseling siswa telah terselesaikan sesuai jadwal.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {unresolvedServices.slice(0, 6).map((srv) => {
                      const isExpanding = handlingServiceId === srv.id;

                      return (
                        <div
                          key={srv.id}
                          className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                            isExpanding
                              ? 'border-[#00685f] bg-[#e6f4f1]/30 ring-1 ring-[#00685f]/20 shadow-xs'
                              : 'border-[#bcc9c6]/30 bg-[#f8faf9] hover:bg-[#e6f4f1]/20 shadow-2xs'
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
                              <h4 className="font-extrabold text-xs text-[#0b1c30]">
                                {srv.students?.map((s) => maskStudentName(s.name, isPrivacyMode)).join(', ')}
                                <span className="text-xs text-gray-400 font-semibold font-mono ml-1">
                                  ({srv.students?.map((s) => s.class).join(', ')})
                                </span>
                              </h4>
                              <p className="text-[11px] text-[#3d4947]/70 font-semibold mt-0.5">
                                Jadwal: {srv.date} &bull; {srv.startTime} - {srv.endTime} WIB
                              </p>
                            </div>

                            <div className="bg-white p-2.5 rounded-xl border border-gray-100 text-xs text-gray-600 leading-relaxed">
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
      </div>

      {/* 📌 SEKSI 3: JADWAL MENGAJAR & CATATAN MEMO CEPAT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <JadwalMengajarWidget
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
          <StickyNotesWidget />
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
                  {visibleLogs.map((log) => {
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
                              {isPrivacyMode && log.studentName
                                ? log.title.replace(new RegExp(log.studentName, 'gi'), maskStudentName(log.studentName, true))
                                : log.title}
                            </h4>
                            <p className="text-[11px] text-[#3d4947] font-medium leading-snug line-clamp-2">
                              {isPrivacyMode && log.studentName
                                ? log.description.replace(new RegExp(log.studentName, 'gi'), maskStudentName(log.studentName, true))
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
          Hak Cipta Dilindungi &copy; {new Date().getFullYear()} Sistem Administrasi BK SMP N 2 Susukan
        </p>
      </footer>
    </div>
  );
}
