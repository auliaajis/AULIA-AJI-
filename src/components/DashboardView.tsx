import { useState, useMemo, useEffect } from 'react';
import {
  Student,
  ViolationRecord,
  CounselingService,
  ActivityLog,
  StudentAchievement,
  ClassAttendanceRecord,
  Counselor,
  ProgramEvaluation,
} from '../types';
import { loadSchoolData } from '../utils/firestoreSync';
import { getSchoolConfig, hasConfiguredSchool } from '../utils/schoolConfig';
import { getAllowedClassesList, filterAttendanceHistory } from '../utils/accessControl';
import { isEvaluationDueFor14DayFollowUp } from '../utils/evaluationHelpers';
import { isRealNonDummyService, isRealNonDummyViolation } from '../utils/purgeDummyData';
import { getViolationRestitutionStatus } from './CatatPelanggaranForm';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  HeartHandshake,
  LogOut,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';

interface DashboardViewProps {
  students: Student[];
  violations: ViolationRecord[];
  services: CounselingService[];
  logs: ActivityLog[];
  achievements?: StudentAchievement[];
  serviceEvaluations?: ProgramEvaluation[];
  programEvaluations?: ProgramEvaluation[];
  activeCounselor?: Counselor;
  onNavigateToTab: (
    tab: string,
    searchQuery?: string,
    presetJournal?: {
      className?: string;
      topic?: string;
      subject?: string;
      startTime?: string;
      endTime?: string;
      period?: string;
    }
  ) => void;
  onNavigateToForm: (form: string, selectStudentId?: string) => void;
  onUpdateViolationStatus?: (id: string, status: any, progress: string) => void;
  onUpdateServiceStatus?: (id: string, status: any, followUp?: string) => void;
  onEditService?: (service: CounselingService) => void;
  onEvaluateService?: (service: CounselingService) => void;
  onSaveServiceEvaluation?: (evaluation: ProgramEvaluation) => void;
  onLogout?: () => void;
}

export default function DashboardView({
  students = [],
  violations = [],
  services = [],
  serviceEvaluations = [],
  activeCounselor,
  onNavigateToTab,
  onNavigateToForm,
  onLogout,
}: DashboardViewProps) {
  // Reactive Attendance records state
  const [attendanceHistory, setAttendanceHistory] = useState<ClassAttendanceRecord[]>(() => {
    return loadSchoolData('bk_attendance_history', []);
  });

  const [schoolCfg, setSchoolCfg] = useState(() => getSchoolConfig(activeCounselor?.schoolId));

  useEffect(() => {
    setSchoolCfg(getSchoolConfig(activeCounselor?.schoolId));
  }, [activeCounselor?.schoolId, activeCounselor?.schoolName]);

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

    const handleSchoolConfigUpdate = () => {
      setSchoolCfg(getSchoolConfig(activeCounselor?.schoolId));
    };

    window.addEventListener('bk_attendance_history_changed', handleAttendanceUpdate);
    window.addEventListener('bk_realtime_sync', handleAttendanceUpdate);
    window.addEventListener('storage', handleAttendanceUpdate);
    window.addEventListener('bk_school_changed', handleAttendanceUpdate);
    window.addEventListener('bk_school_config_updated', handleSchoolConfigUpdate);
    window.addEventListener('bk_school_changed', handleSchoolConfigUpdate);

    return () => {
      window.removeEventListener('bk_attendance_history_changed', handleAttendanceUpdate);
      window.removeEventListener('bk_realtime_sync', handleAttendanceUpdate);
      window.removeEventListener('storage', handleAttendanceUpdate);
      window.removeEventListener('bk_school_changed', handleAttendanceUpdate);
      window.removeEventListener('bk_school_config_updated', handleSchoolConfigUpdate);
      window.removeEventListener('bk_school_changed', handleSchoolConfigUpdate);
    };
  }, [activeCounselor?.schoolId]);

  // Filter strictly real (non-dummy) records — never display dummy placeholders like "Siswa 1..4"
  const realViolations = useMemo(
    () => (violations || []).filter(isRealNonDummyViolation),
    [violations]
  );

  const realServices = useMemo(
    () => (services || []).filter(isRealNonDummyService),
    [services]
  );

  // 1. Overdue Restitution (> 7 days) count
  const restitutionOverdueCount = useMemo(() => {
    const now = new Date();
    return realViolations.filter((v) => {
      if (getViolationRestitutionStatus(v) !== 'Proses Restitusi') return false;
      const dateStr = String(v.date || '').slice(0, 10);
      if (!dateStr) return false;
      const recordDate = new Date(dateStr);
      if (isNaN(recordDate.getTime())) return false;
      const diffDays = Math.floor((now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 7;
    }).length;
  }, [realViolations]);

  // 2. Unevaluated Services count
  const unevaluatedCount = useMemo(() => {
    const evaluatedIds = new Set(
      (serviceEvaluations || []).map((ev) => String(ev.serviceId || '')).filter(Boolean)
    );
    return realServices.filter((s) => s && s.id && !evaluatedIds.has(s.id)).length;
  }, [realServices, serviceEvaluations]);

  // 3. Perlu Pantau Hari Ini (14-day follow-up checks + due follow-ups)
  const perluPantauCount = useMemo(() => {
    const realServiceIds = new Set(realServices.map((s) => s.id));
    const due14DayCount = (serviceEvaluations || []).filter((ev) => {
      if (!isEvaluationDueFor14DayFollowUp(ev)) return false;
      if (ev.serviceId && services.some((s) => s.id === ev.serviceId) && !realServiceIds.has(ev.serviceId)) {
        return false;
      }
      return true;
    }).length;

    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const todayLocalDate = new Date(now.getTime() - tzOffset);
    const weekAheadDate = new Date(todayLocalDate);
    weekAheadDate.setDate(weekAheadDate.getDate() + 7);
    const next7Str = weekAheadDate.toISOString().slice(0, 10);

    let completedSet = new Set<string>();
    let snoozedMap: Record<string, string> = {};
    try {
      const cRaw = localStorage.getItem('bk_completed_followups');
      if (cRaw) completedSet = new Set(JSON.parse(cRaw));
      const sRaw = localStorage.getItem('bk_snoozed_followups');
      if (sRaw) snoozedMap = JSON.parse(sRaw);
    } catch {}

    let weeklyCount = 0;
    realServices.forEach((srv) => {
      if (!srv || !srv.id || completedSet.has(srv.id)) return;
      const spec = (srv.specificDetails || {}) as Record<string, any>;
      const plan = spec.tindakLanjutPlan as
        | { tindakLanjutApa?: string; tindakLanjutTanggal?: string; statusTindakLanjut?: string }
        | undefined;
      if (
        plan?.statusTindakLanjut === 'Selesai' ||
        plan?.statusTindakLanjut === 'Sudah Ditindaklanjuti'
      ) {
        return;
      }

      let dueDate = '';
      if (snoozedMap[srv.id] && /^\d{4}-\d{2}-\d{2}$/.test(snoozedMap[srv.id])) {
        dueDate = snoozedMap[srv.id];
      } else if (plan?.tindakLanjutTanggal && /^\d{4}-\d{2}-\d{2}$/.test(plan.tindakLanjutTanggal)) {
        dueDate = plan.tindakLanjutTanggal;
      } else if (spec.jadwalEvaluasi && /^\d{4}-\d{2}-\d{2}$/.test(spec.jadwalEvaluasi)) {
        dueDate = spec.jadwalEvaluasi;
      } else if (spec.jadwalPantau && /^\d{4}-\d{2}-\d{2}$/.test(spec.jadwalPantau)) {
        dueDate = spec.jadwalPantau;
      } else if (spec.homeVisitJadwalPantau && /^\d{4}-\d{2}-\d{2}$/.test(spec.homeVisitJadwalPantau)) {
        dueDate = spec.homeVisitJadwalPantau;
      }

      if (!dueDate || dueDate > next7Str) return;

      const followUpText =
        String(plan?.tindakLanjutApa || '').trim() ||
        String(srv.followUp || '').trim() ||
        (Array.isArray(spec.tindakLanjut)
          ? spec.tindakLanjut.join(', ')
          : String(spec.tindakLanjut || '').trim());

      if (!followUpText || followUpText === '-' || followUpText.toLowerCase() === 'selesai') {
        if (!plan?.tindakLanjutTanggal) return;
      }
      weeklyCount += 1;
    });

    return due14DayCount + weeklyCount;
  }, [realServices, services, serviceEvaluations]);

  // 4. Unrecorded Classes Today count
  const unrecordedClassesCount = useMemo(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const todayLocal = new Date(today.getTime() - tzOffset).toISOString().slice(0, 10);
    const todayUtc = today.toISOString().split('T')[0];

    const normalizeCls = (c: string) => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizeDt = (d: string) => String(d || '').trim().slice(0, 10);

    const relevantAttendance = activeCounselor
      ? filterAttendanceHistory(attendanceHistory || [], activeCounselor)
      : attendanceHistory || [];
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
    const allClasses =
      availableClasses.length > 0
        ? availableClasses
        : allowedFromCounselor.length > 0
        ? allowedFromCounselor
        : ['7A', '7B', '7C', '7D', '8A', '8B', '8C', '8D', '9A', '9B', '9C', '9D'];

    return allClasses.filter((c) => !recordedClassesSet.has(normalizeCls(c))).length;
  }, [students, attendanceHistory, activeCounselor]);

  const totalAlerts = restitutionOverdueCount + unevaluatedCount + perluPantauCount;
  const schoolConfigured = hasConfiguredSchool(activeCounselor);

  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-[96px] max-w-5xl mx-auto">
      {/* 1. HEADER KONSELOR AKTIF */}
      {activeCounselor && (
        <section className="bg-white border border-[#bcc9c6]/40 rounded-2xl p-3.5 sm:px-5 sm:py-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#e6f4f1] border border-[#00685f]/25 text-[#00685f] flex items-center justify-center font-extrabold text-xs shrink-0 overflow-hidden">
              {activeCounselor.avatar ? (
                <img
                  referrerPolicy="no-referrer"
                  src={activeCounselor.avatar}
                  alt={activeCounselor.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span>
                  {activeCounselor.name
                    ? activeCounselor.name
                        .split(' ')
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join('')
                    : 'BK'}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#0b1c30] truncate">{activeCounselor.name}</p>
              <p className="text-[11px] font-medium text-[#3d4947] truncate">
                {activeCounselor.role} &bull; {activeCounselor.schoolName || schoolCfg.schoolName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateToTab('pengaturan')}
              className="px-3 py-2 border border-[#bcc9c6]/60 hover:bg-gray-50 text-[#0b1c30] rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Profil &amp; Pengaturan
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-97"
                title="Keluar dari akun saat ini untuk berganti akun"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar / Ganti Akun</span>
              </button>
            )}
          </div>
        </section>
      )}

      {!schoolConfigured && (
        <section className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-amber-950">
              Sekolah belum diatur. Atur di Profil &gt; Sekolah, agar data tidak hilang lagi.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.setItem('bk_settings_subtab', 'identitas');
              } catch {}
              onNavigateToTab('pengaturan');
            }}
            className="px-3.5 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer shrink-0"
          >
            Atur Sekolah
          </button>
        </section>
      )}

      {/* 2. RINGKASAN HARI INI — 4 KOTAK KECIL SEJAJAR */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#3d4947]">
            Ringkasan Hari Ini
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 tabular-nums">
          <button
            type="button"
            onClick={() => onNavigateToTab('peringatan', 'followup')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer active:scale-98 shadow-2xs flex items-center justify-between gap-2 ${
              perluPantauCount > 0
                ? 'bg-teal-50/70 border-teal-200 hover:border-[#00685f]/50'
                : 'bg-white border-[#bcc9c6]/40 hover:border-[#00685f]/40'
            }`}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#3d4947] truncate">Hari Ini: Perlu Pantau</p>
              <p className="text-lg font-extrabold text-[#0b1c30] mt-0.5 leading-tight">
                {perluPantauCount} <span className="text-xs font-bold text-[#3d4947]">Agenda</span>
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#e6f4f1] text-[#00685f] flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToTab('peringatan', 'restitusi')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer active:scale-98 shadow-2xs flex items-center justify-between gap-2 ${
              restitutionOverdueCount > 0
                ? 'bg-rose-50/70 border-rose-200 hover:border-rose-400'
                : 'bg-white border-[#bcc9c6]/40 hover:border-[#00685f]/40'
            }`}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#3d4947] truncate">Restitusi</p>
              <p
                className={`text-lg font-extrabold mt-0.5 leading-tight ${
                  restitutionOverdueCount > 0 ? 'text-rose-700' : 'text-[#0b1c30]'
                }`}
              >
                {restitutionOverdueCount} <span className="text-xs font-bold">Kasus</span>
              </p>
            </div>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                restitutionOverdueCount > 0
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToTab('peringatan', 'belum-dievaluasi')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer active:scale-98 shadow-2xs flex items-center justify-between gap-2 ${
              unevaluatedCount > 0
                ? 'bg-amber-50/70 border-amber-200 hover:border-amber-400'
                : 'bg-white border-[#bcc9c6]/40 hover:border-[#00685f]/40'
            }`}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#3d4947] truncate">Belum Dievaluasi</p>
              <p
                className={`text-lg font-extrabold mt-0.5 leading-tight ${
                  unevaluatedCount > 0 ? 'text-amber-800' : 'text-[#0b1c30]'
                }`}
              >
                {unevaluatedCount} <span className="text-xs font-bold">Layanan</span>
              </p>
            </div>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                unevaluatedCount > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToTab('absensi')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer active:scale-98 shadow-2xs flex items-center justify-between gap-2 ${
              unrecordedClassesCount > 0
                ? 'bg-amber-50/40 border-amber-200/80 hover:border-amber-400'
                : 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-400'
            }`}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#3d4947] truncate">Belum Absen</p>
              <p
                className={`text-lg font-extrabold mt-0.5 leading-tight ${
                  unrecordedClassesCount > 0 ? 'text-[#0b1c30]' : 'text-emerald-700'
                }`}
              >
                {unrecordedClassesCount} <span className="text-xs font-bold">Kelas</span>
              </p>
            </div>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                unrecordedClassesCount > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <UserCheck className="w-4 h-4" />
            </div>
          </button>
        </div>
      </section>

      {/* 3. AKSI CEPAT — 1 BARIS SAJA */}
      <section className="space-y-2">
        <div className="px-0.5">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#3d4947]">
            Aksi Cepat
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => onNavigateToTab('absensi')}
            className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 sm:gap-3 p-3 sm:p-3.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl shadow-xs transition-all cursor-pointer active:scale-98 text-center sm:text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-extrabold leading-tight">Absen Hari Ini</p>
              <p className="text-[10px] text-teal-100 hidden sm:block truncate">Presensi harian kelas</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToForm('pelanggaran')}
            className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 sm:gap-3 p-3 sm:p-3.5 bg-[#0b1c30] hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all cursor-pointer active:scale-98 text-center sm:text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-300" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-extrabold leading-tight">Catat Kasus Baru</p>
              <p className="text-[10px] text-slate-300 hidden sm:block truncate">Pelanggaran &amp; poin</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToForm('tambah-layanan')}
            className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 sm:gap-3 p-3 sm:p-3.5 bg-white hover:bg-[#e6f4f1]/60 text-[#00685f] border border-[#00685f]/35 rounded-xl shadow-2xs transition-all cursor-pointer active:scale-98 text-center sm:text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-[#e6f4f1] text-[#00685f] flex items-center justify-center shrink-0">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-extrabold leading-tight">Catat Layanan BK</p>
              <p className="text-[10px] text-[#3d4947] hidden sm:block truncate">Konseling &amp; layanan</p>
            </div>
          </button>
        </div>
      </section>

      {/* 4. 1 KARTU PERINGATAN RINGKAS */}
      <section>
        <div
          className={`rounded-2xl border p-4 shadow-2xs transition-all ${
            totalAlerts > 0
              ? 'bg-white border-amber-300/80'
              : 'bg-emerald-50/50 border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  totalAlerts > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {totalAlerts > 0 ? (
                  <BellRing className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </div>

              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-[#0b1c30] truncate tabular-nums">
                  Perlu Perhatian Hari Ini ({totalAlerts})
                </h3>
                {totalAlerts === 0 ? (
                  <p className="text-xs text-emerald-800 font-medium mt-0.5">
                    Tidak ada peringatan hari ini. Semua aman.
                  </p>
                ) : (
                  <p className="text-xs text-[#3d4947] font-medium mt-0.5 tabular-nums truncate">
                    {restitutionOverdueCount} Restitusi &middot; {unevaluatedCount} Belum Dievaluasi &middot; {perluPantauCount} Follow-up
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab('peringatan')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#f8faf9] hover:bg-[#e6f4f1] text-[#00685f] border border-[#bcc9c6]/60 text-xs font-extrabold transition-colors cursor-pointer shrink-0"
            >
              <span>Lihat Semua</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer Ringkas */}
      <footer className="pt-3 border-t border-[#bcc9c6]/20 text-center text-[11px] text-[#3d4947] opacity-75 font-medium">
        <span>
          &copy; {new Date().getFullYear()} Administrasi BK &bull;{' '}
          {activeCounselor?.schoolName || schoolCfg.schoolName}
        </span>
      </footer>
    </div>
  );
}
