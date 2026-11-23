import { useState, useMemo, useEffect } from 'react';
import {
  Student,
  ViolationRecord,
  CounselingService,
  ActivityLog,
  StudentAchievement,
  Counselor,
  ProgramEvaluation,
  BKJournalEntry,
} from '../types';
import { getCloudCollectionData, subscribeCloudCollection } from '../utils/firestoreSync';
import { isRealNonDummyService, isRealNonDummyViolation } from '../utils/purgeDummyData';
import { getViolationRestitutionStatus } from './CatatPelanggaranForm';
import { ChevronRight } from 'lucide-react';

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
  onOpenViolationDetail?: (violation: ViolationRecord) => void;
  onUpdateViolationStatus?: (id: string, status: any, progress: string) => void;
  onUpdateServiceStatus?: (id: string, status: any, followUp?: string) => void;
  onEditService?: (service: CounselingService) => void;
  onEvaluateService?: (service: CounselingService) => void;
  onSaveServiceEvaluation?: (evaluation: ProgramEvaluation) => void;
  onLogout?: () => void;
}

// 7 Tips BK Harian SMP (index = Date.getDay(): 0 Minggu .. 6 Sabtu)
const DAILY_BK_TIPS: string[] = [
  'Luangkan waktu sejenak menandai kasus prioritas minggu depan agar Senin pagi lebih tenang dan terarah.',
  'Siswa yang sering telat biasanya bukan malas, tapi kurang tidur. Coba tanya jam tidurnya dulu.',
  'Sebelum menasihati siswa yang emosional, dengarkan ceritanya 3 menit tanpa menyela agar ia merasa aman.',
  'Anak SMP lebih terbuka diajak bicara sambil duduk sejajar dan santai, bukan berhadapan di meja formal.',
  'Jika dua siswa berkonflik, tanyakan dulu apa kebutuhan mereka yang belum terpenuhi sebelum mencari siapa yang salah.',
  'Catat 1 hal positif kecil dari siswa yang sedang dalam pembinaan, lalu sampaikan ke wali kelas atau orang tuanya.',
  'Siswa yang nilainya tiba-tiba turun atau menjadi pendiam sering menyimpan masalah di rumah—lakukan check-in singkat.',
];

const getInitials = (name: string): string => {
  const parts = String(name || 'S')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'S';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const getAvatarTintClass = (name: string): string => {
  const tints = [
    'bg-rose-100 text-rose-800',
    'bg-amber-100 text-amber-800',
    'bg-sky-100 text-sky-800',
    'bg-teal-100 text-teal-800',
    'bg-indigo-100 text-indigo-800',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % tints.length;
  }
  return tints[Math.abs(hash) % tints.length];
};

const toLocalYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function DashboardView({
  students = [],
  violations = [],
  services = [],
  activeCounselor,
  onNavigateToTab,
  onOpenViolationDetail,
}: DashboardViewProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  // Subscribe ke koleksi cloud daily_journals untuk statistik Agenda ("X hari ini")
  const [dailyJournals, setDailyJournals] = useState<BKJournalEntry[]>(() =>
    getCloudCollectionData<BKJournalEntry>('bk_daily_journals', activeCounselor?.schoolId)
  );

  useEffect(() => {
    setDailyJournals(getCloudCollectionData<BKJournalEntry>('bk_daily_journals', activeCounselor?.schoolId));
    const unsub = subscribeCloudCollection<BKJournalEntry>(
      'bk_daily_journals',
      (list) => setDailyJournals(list),
      activeCounselor?.schoolId
    );
    return () => unsub();
  }, [activeCounselor?.schoolId]);

  // Data asli non-dummy dari koleksi students, violations, services
  const activeStudents = useMemo(
    () => (students || []).filter((s) => s && s.isDeleted !== true),
    [students]
  );

  const activeClassCount = useMemo(
    () => new Set(activeStudents.map((s) => String(s.class || '').trim()).filter(Boolean)).size,
    [activeStudents]
  );

  const realViolations = useMemo(
    () => (violations || []).filter((v) => v && v.isDeleted !== true && isRealNonDummyViolation(v)),
    [violations]
  );

  const realServices = useMemo(
    () => (services || []).filter((s) => s && s.isDeleted !== true && isRealNonDummyService(s)),
    [services]
  );

  const activeJournals = useMemo(
    () => (dailyJournals || []).filter((j) => j && j.isDeleted !== true),
    [dailyJournals]
  );

  // Kasus violations yang statusnya belum selesai, diurutkan dari yang terbaru
  const unfinishedViolations = useMemo(() => {
    return realViolations
      .filter((v) => getViolationRestitutionStatus(v) !== 'Selesai / Dipantau')
      .slice()
      .sort((a, b) => {
        const dateA = String(a.date || '').slice(0, 10);
        const dateB = String(b.date || '').slice(0, 10);
        if (dateB !== dateA) return dateB.localeCompare(dateA);

        const timeA = String(a.time || '');
        const timeB = String(b.time || '');
        if (timeB !== timeA) return timeB.localeCompare(timeA);

        const updA = Number((a as any)._updatedAt || 0);
        const updB = Number((b as any)._updatedAt || 0);
        return updB - updA;
      });
  }, [realViolations]);

  const topThreeAttention = useMemo(
    () => unfinishedViolations.slice(0, 3),
    [unfinishedViolations]
  );

  // Hitung layanan minggu ini (Senin s.d. Minggu minggu berjalan)
  const servicesThisWeekCount = useMemo(() => {
    const startOfWeek = new Date(now);
    const dayOfWeek = startOfWeek.getDay(); // 0=Min, 1=Sen ... 6=Sab
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startStr = toLocalYmd(startOfWeek);
    const endStr = toLocalYmd(endOfWeek);

    return realServices.filter((srv) => {
      const dStr = String(srv.date || '').slice(0, 10);
      return dStr >= startStr && dStr <= endStr;
    }).length;
  }, [realServices, now]);

  // Hitung agenda hari ini (jurnal harian hari ini + sesi terjadwal hari ini jika ada)
  const todayStr = useMemo(() => toLocalYmd(now), [now]);

  const agendaTodayCount = useMemo(() => {
    return activeJournals.filter((j) => String(j.date || '').slice(0, 10) === todayStr).length;
  }, [activeJournals, todayStr]);

  // 1. Sapaan Dinamis sesuai jam
  const greetingText = useMemo(() => {
    const hour = now.getHours();
    if (hour >= 5 && hour < 11) return 'Selamat Pagi, semangat hari ini! 🌤️';
    if (hour >= 11 && hour < 15) return 'Selamat Siang, sudah istirahat belum? ☀️';
    if (hour >= 15 && hour < 18) return 'Selamat Sore, tinggal sedikit lagi! 🌇';
    return 'Selamat Malam, rekap hari ini yuk! 🌙';
  }, [now]);

  // Hari, Tanggal lengkap bahasa Indonesia (misal: Senin, 23 November 2026)
  const formattedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now);
    } catch {
      return todayStr;
    }
  }, [now, todayStr]);

  // 4. Tips BK Harian (rotasi otomatis Senin-Minggu)
  const todayTip = useMemo(() => {
    return DAILY_BK_TIPS[now.getDay()] || DAILY_BK_TIPS[1];
  }, [now]);

  const handleOpenCaseDetail = (v: ViolationRecord) => {
    if (onOpenViolationDetail) {
      onOpenViolationDetail(v);
      return;
    }
    onNavigateToTab('arsip-pelanggaran', v.ticketId || v.studentName);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-6">
      {/* 1. HEADER SAPAAN DINAMIS + TANGGAL + STATUS */}
      <section className="rounded-2xl bg-gradient-to-br from-[#dff4ee] via-[#e5f5f7] to-[#e9f0fd] border border-[#00685f]/15 shadow-[0_2px_10px_rgba(11,28,48,0.04)] p-4 sm:p-5">
        <div className="space-y-1.5">
          <h1 className="text-lg sm:text-xl font-extrabold text-[#0b1c30] leading-snug tracking-tight">
            {greetingText}
          </h1>
          <p className="text-[15px] font-semibold text-[#005049]">
            {formattedDate}
          </p>
          <p className="text-[15px] text-[#3d4947] leading-relaxed">
            {unfinishedViolations.length > 0 ? (
              <>
                Ada{' '}
                <span className="font-bold text-[#0b1c30] tabular-nums">
                  {unfinishedViolations.length} kasus
                </span>{' '}
                yang perlu ditindaklanjuti
              </>
            ) : (
              'Semua kasus sudah tertangani hari ini'
            )}
          </p>
        </div>
      </section>

      {/* 2. 4 KARTU STATISTIK BERWARNA & ADA KONTEKS */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
        {/* Siswa */}
        <button
          type="button"
          onClick={() => onNavigateToTab('data-siswa')}
          className="rounded-2xl bg-[#eef5ff] hover:bg-[#e2eeff] border border-blue-200/80 shadow-[0_2px_8px_rgba(11,28,48,0.04)] p-3.5 sm:p-4 text-left transition-all duration-150 active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[104px]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-bold text-blue-950">Siswa</span>
            <span
              aria-hidden="true"
              className="w-8 h-8 rounded-xl bg-blue-100/90 flex items-center justify-center text-base shrink-0"
            >
              👥
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl sm:text-[26px] font-extrabold text-[#0b1c30] leading-none">
              {activeStudents.length}
            </p>
            <p className="text-[13px] font-medium text-blue-900/80 mt-1.5 truncate">
              {activeClassCount > 0 ? `${activeClassCount} rombel aktif` : 'Data siswa aktif'}
            </p>
          </div>
        </button>

        {/* Pelanggaran */}
        <button
          type="button"
          onClick={() => onNavigateToTab('arsip-pelanggaran')}
          className="rounded-2xl bg-[#fff1f2] hover:bg-[#ffe4e6] border border-rose-200/80 shadow-[0_2px_8px_rgba(11,28,48,0.04)] p-3.5 sm:p-4 text-left transition-all duration-150 active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[104px]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-bold text-rose-950">Pelanggaran</span>
            <span
              aria-hidden="true"
              className="w-8 h-8 rounded-xl bg-rose-100/90 flex items-center justify-center text-base shrink-0"
            >
              ⚠️
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl sm:text-[26px] font-extrabold text-[#0b1c30] leading-none">
              {realViolations.length}
            </p>
            <p className="text-[13px] font-medium text-rose-800 mt-1.5 truncate">
              {unfinishedViolations.length} belum selesai
            </p>
          </div>
        </button>

        {/* Layanan */}
        <button
          type="button"
          onClick={() => onNavigateToTab('layanan-bk')}
          className="rounded-2xl bg-[#ecfdf5] hover:bg-[#d1fae5]/75 border border-emerald-200/80 shadow-[0_2px_8px_rgba(11,28,48,0.04)] p-3.5 sm:p-4 text-left transition-all duration-150 active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[104px]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-bold text-emerald-950">Layanan</span>
            <span
              aria-hidden="true"
              className="w-8 h-8 rounded-xl bg-emerald-100/90 flex items-center justify-center text-base shrink-0"
            >
              💬
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl sm:text-[26px] font-extrabold text-[#0b1c30] leading-none">
              {realServices.length}
            </p>
            <p className="text-[13px] font-medium text-emerald-900/85 mt-1.5 truncate">
              {servicesThisWeekCount} minggu ini
            </p>
          </div>
        </button>

        {/* Agenda */}
        <button
          type="button"
          onClick={() => onNavigateToTab('jurnal-harian')}
          className="rounded-2xl bg-[#f5f3ff] hover:bg-[#ede9fe] border border-purple-200/80 shadow-[0_2px_8px_rgba(11,28,48,0.04)] p-3.5 sm:p-4 text-left transition-all duration-150 active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[104px]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-bold text-purple-950">Agenda</span>
            <span
              aria-hidden="true"
              className="w-8 h-8 rounded-xl bg-purple-100/90 flex items-center justify-center text-base shrink-0"
            >
              📅
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl sm:text-[26px] font-extrabold text-[#0b1c30] leading-none">
              {activeJournals.length}
            </p>
            <p className="text-[13px] font-medium text-purple-900/85 mt-1.5 truncate">
              {agendaTodayCount} hari ini
            </p>
          </div>
        </button>
      </section>

      {/* 3. 1 KARTU TIPS BK HARIAN */}
      <section className="rounded-2xl bg-[#fefce8] border border-amber-200/80 shadow-[0_2px_8px_rgba(11,28,48,0.03)] px-4 py-3.5 flex items-start gap-3">
        <span aria-hidden="true" className="text-lg leading-none mt-0.5 shrink-0">
          💡
        </span>
        <p className="text-[15px] text-[#3d4947] leading-snug">
          <strong className="font-bold text-[#0b1c30]">Tips BK Hari Ini:</strong>{' '}
          {todayTip}
        </p>
      </section>

      {/* 4. 1 KARTU PERLU PERHATIAN HARI INI (ALA NOTIFIKASI CHAT, MAKS 3 ITEM) */}
      <section>
        {topThreeAttention.length === 0 ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200/90 shadow-[0_2px_10px_rgba(11,28,48,0.04)] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] sm:text-base font-semibold text-emerald-950 leading-snug flex-1 min-w-[210px]">
              🎉 Aman! Tidak ada kasus mendesak hari ini. Semua sudah tertangani.
            </p>
            <button
              type="button"
              onClick={() => onNavigateToTab('arsip-pelanggaran')}
              className="inline-flex items-center gap-1 px-3.5 py-2 min-h-[40px] rounded-xl bg-white hover:bg-emerald-100/70 text-emerald-800 border border-emerald-300/80 text-sm font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <span>Lihat Semua Arsip</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-[#bcc9c6]/35 shadow-[0_2px_12px_rgba(11,28,48,0.05)] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-[#0b1c30]">
                Perlu Perhatian Hari Ini
              </h2>
              <button
                type="button"
                onClick={() => onNavigateToTab('arsip-pelanggaran')}
                className="inline-flex items-center gap-0.5 text-sm font-bold text-[#00685f] hover:text-[#005049] whitespace-nowrap shrink-0 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-[#e6f4f1]/60 transition-colors"
              >
                <span>Lihat Arsip</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {topThreeAttention.map((v) => {
                const studentName = v.studentName || 'Siswa';
                const studentClass = v.studentClass || '-';
                const summaryText =
                  v.notes && v.notes.trim() && v.notes.trim() !== '-'
                    ? `${v.category} · ${v.notes.trim()}`
                    : v.category || 'Perlu tindak lanjut';

                return (
                  <div
                    key={v.id}
                    className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm shrink-0 ${getAvatarTintClass(
                          studentName
                        )}`}
                      >
                        {getInitials(studentName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] sm:text-base font-bold text-[#0b1c30] truncate leading-snug">
                          {studentName} - {studentClass}
                        </p>
                        <p className="text-[14px] sm:text-[15px] text-[#3d4947] truncate mt-0.5 leading-snug">
                          {summaryText}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenCaseDetail(v)}
                      className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] rounded-xl bg-[#e6f4f1] hover:bg-[#00685f] text-[#00685f] hover:text-white text-sm font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                      <span>Tangani</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
