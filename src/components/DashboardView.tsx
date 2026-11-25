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
import {
  formatCompactRujukanTime,
  getRujukanCategoryLabel,
  getRujukanItemStatus,
  getRujukanSpecificBehaviors,
  getViolationSortMs,
  isRujukanBaruPiket,
} from '../utils/rujukanHelper';
import { ChevronRight, UserCheck, Users, X } from 'lucide-react';

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
  const [showTipBanner, setShowTipBanner] = useState<boolean>(true);

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

  const todayStr = useMemo(() => toLocalYmd(now), [now]);

  // Pisahkan Rujukan Baru dari Piket vs Data Lama / Absensi Harian
  const newPiketOnlyList = useMemo(
    () => realViolations.filter((v) => isRujukanBaruPiket(v) && !v.archivedFromRujukan),
    [realViolations]
  );

  const rujukanBaruPiketCount = useMemo(
    () => newPiketOnlyList.filter((v) => getRujukanItemStatus(v) === 'Baru').length,
    [newPiketOnlyList]
  );

  const unfinishedPiketCount = useMemo(
    () => newPiketOnlyList.filter((v) => getRujukanItemStatus(v) !== 'Selesai').length,
    [newPiketOnlyList]
  );

  // Beranda: MAKSIMAL 5 item terbaru HARI INI dari Link Piket yang statusnya Baru (tanpa Absensi/Data Lama)
  const todayCompactReferrals = useMemo(() => {
    return newPiketOnlyList
      .filter(
        (v) =>
          getRujukanItemStatus(v) === 'Baru' &&
          String(v.date || '').slice(0, 10) === todayStr
      )
      .sort((a, b) => getViolationSortMs(b) - getViolationSortMs(a))
      .slice(0, 5);
  }, [newPiketOnlyList, todayStr]);

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
            {rujukanBaruPiketCount > 0 ? (
              <>
                Ada{' '}
                <span className="font-bold text-[#0b1c30] tabular-nums">
                  {rujukanBaruPiketCount} rujukan baru dari Piket
                </span>{' '}
                yang perlu ditindaklanjuti
              </>
            ) : unfinishedPiketCount > 0 ? (
              <>
                Ada{' '}
                <span className="font-bold text-[#0b1c30] tabular-nums">
                  {unfinishedPiketCount} rujukan Piket
                </span>{' '}
                yang masih dalam proses pembinaan
              </>
            ) : (
              'Semua rujukan Piket hari ini sudah tertangani'
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

        {/* Rujukan Piket vs Data Lama */}
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
            <p className="text-[12px] sm:text-[13px] font-extrabold text-[#0b1c30] leading-snug">
              Rujukan Baru Piket:{' '}
              <span className="text-lg sm:text-xl font-black text-rose-700 tabular-nums">
                {rujukanBaruPiketCount}
              </span>
            </p>
            <p className="text-[11px] sm:text-[12px] font-medium text-rose-900/75 mt-1 truncate">
              Total + Data Lama: {realViolations.length}
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

      {/* Menu Cepat Kelola Siswa & Kelola Guru Piket */}
      <section className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onNavigateToTab('data-siswa')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#e6f4f1] text-[#0b1c30] hover:text-[#00685f] border border-[#bcc9c6]/50 text-xs font-extrabold transition-colors cursor-pointer shadow-2xs"
        >
          <Users className="w-3.5 h-3.5 text-[#00685f]" />
          <span>Kelola Siswa</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigateToTab('kelola-guru-piket')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#e6f4f1] text-[#0b1c30] hover:text-[#00685f] border border-[#bcc9c6]/50 text-xs font-extrabold transition-colors cursor-pointer shadow-2xs"
        >
          <UserCheck className="w-3.5 h-3.5 text-[#00685f]" />
          <span>Kelola Guru Piket</span>
        </button>
      </section>

      {/* 3. PERLU DIBINA HARI INI (COMPACT MAX 5 ITEM HARI INI DARI LINK PIKET) */}
      <section className="rounded-2xl bg-white border border-[#bcc9c6]/35 shadow-[0_2px_12px_rgba(11,28,48,0.05)] overflow-hidden">
        <div className="px-4 py-3.5 sm:px-5 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold text-[#0b1c30] truncate">
              Perlu Dibina Hari Ini
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-black tabular-nums shrink-0 ${
                todayCompactReferrals.length > 0
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {todayCompactReferrals.length} Baru
            </span>
          </div>
        </div>

        {todayCompactReferrals.length === 0 ? (
          <div className="px-4 py-6 text-center space-y-3 bg-emerald-50/30">
            <p className="text-sm font-semibold text-emerald-950">
              Belum ada rujukan baru dari Link Piket hari ini.
            </p>
            <button
              type="button"
              onClick={() => onNavigateToTab('rujukan-piket')}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-white hover:bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/30 text-xs font-extrabold transition-colors cursor-pointer shadow-2xs"
            >
              <span>Lihat Semua {realViolations.length} Rujukan</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayCompactReferrals.map((v) => {
              const catLabel = getRujukanCategoryLabel(v);
              const firstBehavior = getRujukanSpecificBehaviors(v)[0];
              const categoryDisplay =
                firstBehavior && firstBehavior.toLowerCase() !== catLabel.toLowerCase()
                  ? `${catLabel} - ${firstBehavior}`
                  : catLabel;
              const timeDisplay = formatCompactRujukanTime(v);
              const studentClass = String(v.studentClass || '').trim();

              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleTindakLanjuti(v)}
                  className="w-full px-4 py-3 sm:px-5 flex items-center justify-between gap-2.5 text-left hover:bg-[#f8faf9] active:bg-[#e6f4f1]/40 transition-colors cursor-pointer group"
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2 text-xs sm:text-sm">
                    <span className="font-extrabold text-[#0b1c30] truncate max-w-[42%] shrink-0">
                      {v.studentName || 'Siswa'}
                      {studentClass ? ` - ${studentClass}` : ''}
                    </span>
                    <span className="text-slate-300 shrink-0">|</span>
                    <span className="font-semibold text-[#3d4947] truncate">
                      {categoryDisplay}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-[#00685f] bg-[#e6f4f1] px-2 py-0.5 rounded-lg tabular-nums">
                      {timeDisplay}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#00685f] transition-colors" />
                  </div>
                </button>
              );
            })}

            <div className="p-3 sm:px-5 bg-[#f8faf9] text-center">
              <button
                type="button"
                onClick={() => onNavigateToTab('rujukan-piket')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/30 text-xs font-extrabold cursor-pointer shadow-2xs transition-colors"
              >
                <span>Lihat Semua {realViolations.length} Rujukan</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 4. TIPS BK HARIAN (DI PALING BAWAH & BISA DI-CLOSE) */}
      {showTipBanner && (
        <section className="rounded-2xl bg-[#fefce8] border border-amber-200/80 shadow-[0_2px_8px_rgba(11,28,48,0.03)] px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span aria-hidden="true" className="text-base leading-none mt-0.5 shrink-0">
              💡
            </span>
            <p className="text-xs sm:text-sm text-[#3d4947] leading-snug">
              <strong className="font-bold text-[#0b1c30]">Tips BK Hari Ini:</strong>{' '}
              {todayTip}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowTipBanner(false)}
            aria-label="Tutup Tips BK Hari Ini"
            className="p-1 rounded-lg text-amber-800/70 hover:text-amber-950 hover:bg-amber-200/50 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </section>
      )}
    </div>
  );
}
