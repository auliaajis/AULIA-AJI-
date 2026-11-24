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
import RujukanCard from './RujukanCard';
import {
  getRujukanItemStatus,
  RujukanStatusTab,
  sortRujukanList,
} from '../utils/rujukanHelper';
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
  onTindakLanjuti?: (violation: ViolationRecord) => void;
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
  onTindakLanjuti,
}: DashboardViewProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [rujukanFilter, setRujukanFilter] = useState<RujukanStatusTab>('Semua');

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

  const sortedReferrals = useMemo(
    () => sortRujukanList(realViolations),
    [realViolations]
  );

  const rujukanCounts = useMemo(() => {
    let baru = 0;
    let ditindak = 0;
    let selesai = 0;
    sortedReferrals.forEach((v) => {
      const st = getRujukanItemStatus(v);
      if (st === 'Baru') baru++;
      else if (st === 'Sudah Ditindaklanjuti') ditindak++;
      else selesai++;
    });
    return {
      Semua: sortedReferrals.length,
      Baru: baru,
      'Sudah Ditindaklanjuti': ditindak,
      Selesai: selesai,
    };
  }, [sortedReferrals]);

  const unfinishedViolationsCount = useMemo(
    () => realViolations.filter((v) => getViolationRestitutionStatus(v) !== 'Selesai / Dipantau').length,
    [realViolations]
  );

  const filteredReferrals = useMemo(() => {
    if (rujukanFilter === 'Semua') return sortedReferrals;
    return sortedReferrals.filter((v) => getRujukanItemStatus(v) === rujukanFilter);
  }, [sortedReferrals, rujukanFilter]);

  const displayedReferrals = useMemo(
    () => filteredReferrals.slice(0, 6),
    [filteredReferrals]
  );

  // Hitung layanan minggu ini (Senin s.d. Minggu minggu berjalan)
  const servicesThisWeekCount = useMemo(() => {
    const startOfWeek = new Date(now);
    const dayOfWeek = startOfWeek.getDay();
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

  const todayTip = useMemo(() => {
    return DAILY_BK_TIPS[now.getDay()] || DAILY_BK_TIPS[1];
  }, [now]);

  const handleTindakLanjuti = (v: ViolationRecord) => {
    if (onTindakLanjuti) {
      onTindakLanjuti(v);
      return;
    }
    if (onOpenViolationDetail) {
      onOpenViolationDetail(v);
      return;
    }
    onNavigateToTab('rujukan-piket', v.studentName);
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
            {unfinishedViolationsCount > 0 ? (
              <>
                Ada{' '}
                <span className="font-bold text-[#0b1c30] tabular-nums">
                  {unfinishedViolationsCount} rujukan
                </span>{' '}
                yang perlu ditindaklanjuti
              </>
            ) : (
              'Semua rujukan sudah tertangani hari ini'
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

        {/* Rujukan Piket */}
        <button
          type="button"
          onClick={() => onNavigateToTab('rujukan-piket')}
          className="rounded-2xl bg-[#fff1f2] hover:bg-[#ffe4e6] border border-rose-200/80 shadow-[0_2px_8px_rgba(11,28,48,0.04)] p-3.5 sm:p-4 text-left transition-all duration-150 active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[104px]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-bold text-rose-950">Rujukan</span>
            <span
              aria-hidden="true"
              className="w-8 h-8 rounded-xl bg-rose-100/90 flex items-center justify-center text-base shrink-0"
            >
              📩
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl sm:text-[26px] font-extrabold text-[#0b1c30] leading-none">
              {realViolations.length}
            </p>
            <p className="text-[13px] font-medium text-rose-800 mt-1.5 truncate">
              {rujukanCounts.Baru} baru belum dibina
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

      {/* 4. RUJUKAN BARU DARI PIKET YANG PERLU DIBINA */}
      <section className="rounded-2xl bg-white border border-[#bcc9c6]/35 shadow-[0_2px_12px_rgba(11,28,48,0.05)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-[#0b1c30]">
                Rujukan Baru dari Piket yang Perlu Dibina
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-black tabular-nums ${
                  rujukanCounts.Baru > 0
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {rujukanCounts.Baru} Baru
              </span>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab('rujukan-piket')}
              className="inline-flex items-center gap-0.5 text-sm font-bold text-[#00685f] hover:text-[#005049] whitespace-nowrap shrink-0 cursor-pointer py-1 px-2 rounded-lg hover:bg-[#e6f4f1]/60 transition-colors"
            >
              <span>Semua Rujukan</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Filter: [Semua] [Baru] [Sudah Ditindaklanjuti] [Selesai] */}
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl border border-[#bcc9c6]/30 w-fit max-w-full">
            {(['Semua', 'Baru', 'Sudah Ditindaklanjuti', 'Selesai'] as RujukanStatusTab[]).map((tab) => {
              const active = rujukanFilter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRujukanFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#00685f] text-white shadow-xs'
                      : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-gray-200/50'
                  }`}
                >
                  <span>{tab}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-white text-[#3d4947]'
                    }`}
                  >
                    {rujukanCounts[tab]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {displayedReferrals.length === 0 ? (
          <div className="p-6 text-center space-y-2.5 bg-emerald-50/40">
            <p className="text-[15px] font-semibold text-emerald-950">
              {rujukanFilter === 'Baru'
                ? '🎉 Aman! Tidak ada rujukan baru yang belum ditindaklanjuti.'
                : 'Belum ada rujukan pada filter ini.'}
            </p>
            <button
              type="button"
              onClick={() => onNavigateToTab('arsip-pembinaan')}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 text-[#00685f] border border-[#00685f]/25 text-xs font-extrabold transition-colors cursor-pointer"
            >
              <span>Buka Arsip Pembinaan</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3 bg-[#f8faf9]">
            {displayedReferrals.map((v) => (
              <RujukanCard
                key={v.id}
                violation={v}
                compact
                onTindakLanjuti={handleTindakLanjuti}
                onOpenProfile={(sId) => onNavigateToTab('profil-siswa', sId)}
              />
            ))}
            {filteredReferrals.length > displayedReferrals.length && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => onNavigateToTab('rujukan-piket')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/30 text-xs font-extrabold cursor-pointer shadow-2xs transition-colors"
                >
                  <span>Lihat {filteredReferrals.length - displayedReferrals.length} Rujukan Lainnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
