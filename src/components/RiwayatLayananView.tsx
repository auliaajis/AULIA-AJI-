import React, { useState, useMemo } from 'react';
import {
  HeartHandshake,
  Search,
  Calendar,
  FileText,
  Download,
  Eye,
  Edit2,
  X,
  CheckCircle2,
  Sparkles,
  UserCheck,
  Tag,
  Plus,
  ClipboardCheck,
  Clock,
  User,
  Users,
} from 'lucide-react';
import {
  BKComponentType,
  Student,
  CounselingService,
  Counselor,
  ProgramEvaluation,
  EvaluationJenisMasalah,
  EvaluationTeknikType,
  EvaluationTujuanType,
} from '../types';
import {
  EVALUATION_JENIS_MASALAH,
  EVALUATION_TEKNIK_OPTIONS,
  EVALUATION_TUJUAN_OPTIONS,
  LEGACY_PROBLEM_LABELS,
  getEffectiveServiceEvalScore,
  inferJenisMasalahFromService,
  inferTeknikFromService,
  inferTujuanFromService,
  isLegacyJenisMasalah,
  mapJenisMasalahToBidang,
  mapLegacyProblemToStandardJenisMasalah,
} from '../utils/evaluationHelpers';
import {
  downloadRekapSemuaLayananPDF,
  downloadRekapLayananPerSiswaPDF,
} from '../utils/pdfGenerator';
import { exportServicesToIcs } from '../utils/calendarSync';
import { showToast } from '../utils/toast';
import { formatCardDate, formatCardTime } from '../utils/dateFormatter';
import LayananDetailModal from './LayananDetailModal';

export type ServiceTimeFilter = 'semua' | 'hari-ini' | 'minggu-ini' | 'bulan-ini';
export type ServiceKindFilter = 'semua' | 'Klasikal' | 'Kelompok' | 'Individu' | 'Konseling';
export type ServiceTeacherFilter = 'semua' | 'saya';

interface RiwayatLayananViewProps {
  services: CounselingService[];
  students: Student[];
  serviceEvaluations?: ProgramEvaluation[];
  activeCounselor?: Counselor;
  onNavigateToTab?: (tab: string, query?: string) => void;
  onNavigateToForm?: (form: string, studentId?: string) => void;
  onEditService?: (service: CounselingService) => void;
  onUpdateService?: (service: CounselingService) => void;
  onUpdateServiceStatus?: (serviceId: string, status: 'Terjadwal' | 'Selesai' | 'Dibatalkan') => void;
  onSaveServiceEvaluation?: (evaluation: ProgramEvaluation) => void;
  onDeleteService?: (serviceId: string, skipConfirm?: boolean) => void;
  onEvaluateService?: (service: CounselingService) => void;
  embeddedMode?: boolean;
}

function getLocalYmd(dateObj: Date): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekBoundsYmd(now: Date): { startYmd: string; endYmd: string } {
  const day = now.getDay(); // 0 = Sun, 1 = Mon...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return {
    startYmd: getLocalYmd(monday),
    endYmd: getLocalYmd(sunday),
  };
}

function matchesKindFilter(srv: CounselingService, filter: ServiceKindFilter): boolean {
  if (filter === 'semua') return true;
  const t = String(srv.serviceType || '').toLowerCase();
  const tgt = String(srv.targetType || '').toLowerCase();
  if (filter === 'Klasikal') return tgt === 'klasikal' || t.includes('klasikal');
  if (filter === 'Kelompok') return tgt === 'kelompok' || t.includes('kelompok');
  if (filter === 'Individu') return tgt === 'individu' || t.includes('individual') || t.includes('perorangan');
  if (filter === 'Konseling') return t.includes('konseling');
  return true;
}

function getServiceCategoryBadge(srv: CounselingService): string {
  if (srv.targetType) return srv.targetType;
  const t = String(srv.serviceType || '').toLowerCase();
  if (t.includes('klasikal')) return 'Klasikal';
  if (t.includes('kelompok')) return 'Kelompok';
  if (t.includes('konseling')) return 'Konseling';
  return 'Layanan BK';
}

function getDisplayStudentOrClass(srv: CounselingService): string {
  const klasikalClass = srv.specificDetails?.klasikal?.kelas || srv.specificDetails?.blokC?.klasikal?.kelas;
  const studentsList = srv.students || [];
  if (klasikalClass) {
    return studentsList.length > 0 ? `Kelas ${klasikalClass} (${studentsList.length} siswa)` : `Kelas ${klasikalClass}`;
  }
  if (studentsList.length === 0) {
    return 'Sasaran Klasikal / Umum';
  }
  if (studentsList.length === 1) {
    const st = studentsList[0];
    return `${st.name}${st.class ? ` (Kelas ${st.class})` : ''}`;
  }
  const uniqueClasses = Array.from(new Set(studentsList.map((s) => s.class).filter(Boolean)));
  if (studentsList.length > 3 && uniqueClasses.length === 1) {
    return `Kelas ${uniqueClasses[0]} (${studentsList.length} siswa)`;
  }
  const previewNames = studentsList.slice(0, 2).map((s) => `${s.name} (${s.class || '-'})`).join(', ');
  return studentsList.length > 2 ? `${previewNames} +${studentsList.length - 2} lainnya` : previewNames;
}

function getSortScore(srv: CounselingService): string {
  const d = String(srv.date || '0000-00-00');
  const t = String(srv.startTime || '00:00');
  const u = String((srv as any).updatedAt || (srv as any).createdAt || '');
  return `${d}T${t}|${u}`;
}

export const RiwayatLayananView: React.FC<RiwayatLayananViewProps> = ({
  services = [],
  students = [],
  serviceEvaluations = [],
  activeCounselor,
  onNavigateToTab,
  onNavigateToForm,
  onEditService,
  onUpdateService,
  onUpdateServiceStatus,
  onSaveServiceEvaluation,
  onDeleteService,
  onEvaluateService,
  embeddedMode = false,
}) => {
  // Search & 3 Quick Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<ServiceTimeFilter>('semua');
  const [kindFilter, setKindFilter] = useState<ServiceKindFilter>('semua');
  const [teacherFilter, setTeacherFilter] = useState<ServiceTeacherFilter>('semua');

  // Detail Modal & PDF Modals
  const [detailService, setDetailService] = useState<CounselingService | null>(null);
  const [showStudentPdfModal, setShowStudentPdfModal] = useState(false);
  const [selectedStudentForPdf, setSelectedStudentForPdf] = useState<Student | null>(null);
  const [studentSearchForPdf, setStudentSearchForPdf] = useState('');
  const [aiStudentSummary, setAiStudentSummary] = useState('');
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);

  // Perbaiki Klasifikasi Modal State
  const [fixClassifyTarget, setFixClassifyTarget] = useState<CounselingService | null>(null);
  const [fixJenisMasalah, setFixJenisMasalah] = useState<EvaluationJenisMasalah>('Terlambat');
  const [fixAlasanLainnya, setFixAlasanLainnya] = useState('');
  const [fixTujuan, setFixTujuan] = useState<EvaluationTujuanType>('Mengubah Perilaku');
  const [fixTeknik, setFixTeknik] = useState<EvaluationTeknikType>('Konseling Kelompok');
  const [fixKeparahan, setFixKeparahan] = useState(3);
  const [fixFrekuensi, setFixFrekuensi] = useState(3);
  const [fixMotivasiAwal, setFixMotivasiAwal] = useState(3);

  // Map evaluated serviceId -> ProgramEvaluation
  const evalByServiceId = useMemo(() => {
    const map = new Map<string, ProgramEvaluation>();
    (serviceEvaluations || []).forEach((ev) => {
      if (ev && ev.serviceId) map.set(ev.serviceId, ev);
    });
    return map;
  }, [serviceEvaluations]);

  const isLegacyServiceRecord = (srv: CounselingService, linkedEval?: ProgramEvaluation): boolean => {
    const blokB = srv.specificDetails?.blokB;
    if (blokB?.jenisMasalah) {
      if (isLegacyJenisMasalah(blokB.jenisMasalah)) return true;
      if (blokB.jenisMasalah === 'Lainnya' && !String(blokB.alasanMasalahLainnya || '').trim()) return true;
      return false;
    }
    const lowerType = String(srv.serviceType || '').toLowerCase();
    const isFourRevisedType =
      lowerType.includes('kelompok') ||
      lowerType.includes('mediasi') ||
      lowerType.includes('klasikal') ||
      lowerType.includes('observasi') ||
      lowerType.includes('wawancara') ||
      lowerType.includes('alih tangan') ||
      lowerType.includes('referral');
    if (isFourRevisedType) return true;
    const probLower = String(srv.problem || '').toLowerCase();
    if (LEGACY_PROBLEM_LABELS.some((lbl) => probLower.includes(lbl.toLowerCase()))) return true;
    if (linkedEval && (isLegacyJenisMasalah(linkedEval.jenisMasalah) || linkedEval.jenisMasalah === 'Lainnya')) {
      return true;
    }
    return false;
  };

  const openFixClassifyModal = (srv: CounselingService) => {
    const linkedEval = evalByServiceId.get(srv.id);
    const blokB = srv.specificDetails?.blokB;
    const rawCandidate = blokB?.jenisMasalah || linkedEval?.jenisMasalah || srv.problem || '';
    const mapped =
      EVALUATION_JENIS_MASALAH.includes(rawCandidate as EvaluationJenisMasalah)
        ? (rawCandidate as EvaluationJenisMasalah)
        : mapLegacyProblemToStandardJenisMasalah(rawCandidate) !== 'Lainnya'
          ? mapLegacyProblemToStandardJenisMasalah(rawCandidate)
          : inferJenisMasalahFromService(srv);

    setFixJenisMasalah(mapped);
    setFixAlasanLainnya(blokB?.alasanMasalahLainnya || linkedEval?.alasanMasalahLainnya || '');
    setFixTujuan(blokB?.tujuanLayanan || linkedEval?.tujuanLayanan || inferTujuanFromService(srv));
    setFixTeknik(blokB?.teknik || linkedEval?.teknikDipakai || inferTeknikFromService(srv));
    setFixKeparahan(blokB?.baseline?.keparahan ?? linkedEval?.baseline?.keparahan ?? 3);
    setFixFrekuensi(blokB?.baseline?.frekuensi ?? linkedEval?.baseline?.frekuensi ?? 3);
    setFixMotivasiAwal(blokB?.baseline?.motivasiAwal ?? linkedEval?.baseline?.motivasiAwal ?? 3);
    setFixClassifyTarget(srv);
  };

  const handleSaveFixClassification = () => {
    if (!fixClassifyTarget || !onUpdateService) return;
    if (fixJenisMasalah === 'Lainnya' && !fixAlasanLainnya.trim()) {
      showToast('⚠️ Jika memilih "Lainnya", wajib mengisi 1 kalimat alasan.', 'warning');
      return;
    }

    const prevDetails = fixClassifyTarget.specificDetails || {};
    const nextBlokB = {
      jenisMasalah: fixJenisMasalah,
      alasanMasalahLainnya: fixJenisMasalah === 'Lainnya' ? fixAlasanLainnya.trim() : undefined,
      tujuanLayanan: fixTujuan,
      teknik: fixTeknik,
      baseline: {
        keparahan: fixKeparahan,
        frekuensi: fixFrekuensi,
        motivasiAwal: fixMotivasiAwal,
        baselineDariIngatan: true as const,
      },
    };
    const nextBidang = mapJenisMasalahToBidang(fixJenisMasalah);
    const mappedBkComp: BKComponentType =
      nextBidang === 'Perencanaan Individual'
        ? 'Peminatan & Perencanaan Individual'
        : nextBidang === 'Dukungan Sistem'
          ? 'Layanan Dukungan Sistem'
          : nextBidang;
    const updatedService: CounselingService = {
      ...fixClassifyTarget,
      bkComponent: fixClassifyTarget.bkComponent || mappedBkComp,
      specificDetails: {
        ...prevDetails,
        blokB: nextBlokB,
      },
    };

    onUpdateService(updatedService);
    if (detailService?.id === updatedService.id) {
      setDetailService(updatedService);
    }

    const linkedEval = evalByServiceId.get(fixClassifyTarget.id);
    if (linkedEval && onSaveServiceEvaluation) {
      onSaveServiceEvaluation({
        ...linkedEval,
        bidang: nextBidang,
        jenisMasalah: fixJenisMasalah,
        alasanMasalahLainnya: fixJenisMasalah === 'Lainnya' ? fixAlasanLainnya.trim() : undefined,
        tujuanLayanan: fixTujuan,
        teknikDipakai: fixTeknik,
        baseline: {
          ...linkedEval.baseline,
          keparahan: fixKeparahan,
          frekuensi: fixFrekuensi,
          motivasiAwal: fixMotivasiAwal,
          baselineDariIngatan: true,
        },
        updatedAt: new Date().toISOString(),
      });
    }

    showToast('✅ Klasifikasi layanan lama berhasil diperbarui tanpa menghapus data.', 'success');
    setFixClassifyTarget(null);
  };

  // Date & Week calculations for filtering and summary
  const { todayYmd, weekStartYmd, weekEndYmd, monthPrefix, thisWeekCount } = useMemo(() => {
    const now = new Date();
    const today = getLocalYmd(now);
    const { startYmd, endYmd } = getWeekBoundsYmd(now);
    const mPrefix = today.slice(0, 7); // YYYY-MM
    const countWeek = services.filter((srv) => {
      const d = String(srv.date || '').slice(0, 10);
      return d >= startYmd && d <= endYmd;
    }).length;
    return {
      todayYmd: today,
      weekStartYmd: startYmd,
      weekEndYmd: endYmd,
      monthPrefix: mPrefix,
      thisWeekCount: countWeek,
    };
  }, [services]);

  // Filtered Services List (Sorted Newest First)
  const filteredServices = useMemo(() => {
    return [...services]
      .filter((srv) => {
        // 1. Search by student name, class, service type, or topic
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchStudent = (srv.students || []).some(
            (st) =>
              String(st.name || '').toLowerCase().includes(q) ||
              String(st.class || '').toLowerCase().includes(q) ||
              String(st.nis || '').toLowerCase().includes(q)
          );
          const klasikalClass = String(
            srv.specificDetails?.klasikal?.kelas || srv.specificDetails?.blokC?.klasikal?.kelas || ''
          ).toLowerCase();
          const matchClass = klasikalClass.includes(q);
          const matchType = String(srv.serviceType || '').toLowerCase().includes(q);
          const matchProblem = String(srv.problem || '').toLowerCase().includes(q);
          const matchCounselor = String(srv.counselorName || '').toLowerCase().includes(q);
          if (!matchStudent && !matchClass && !matchType && !matchProblem && !matchCounselor) {
            return false;
          }
        }

        // 2. Time Filter
        if (timeFilter !== 'semua') {
          const d = String(srv.date || '').slice(0, 10);
          if (timeFilter === 'hari-ini' && d !== todayYmd) return false;
          if (timeFilter === 'minggu-ini' && (d < weekStartYmd || d > weekEndYmd)) return false;
          if (timeFilter === 'bulan-ini' && !d.startsWith(monthPrefix)) return false;
        }

        // 3. Kind Filter
        if (!matchesKindFilter(srv, kindFilter)) {
          return false;
        }

        // 4. Counselor Filter
        if (teacherFilter === 'saya' && activeCounselor) {
          const myId = String(activeCounselor.id || '').trim().toLowerCase();
          const myName = String(activeCounselor.name || '').trim().toLowerCase();
          const sId = String(srv.counselorId || '').trim().toLowerCase();
          const sName = String(srv.counselorName || '').trim().toLowerCase();
          const isMatch = (myId && sId === myId) || (myName && sName === myName);
          if (!isMatch) return false;
        }

        return true;
      })
      .sort((a, b) => getSortScore(b).localeCompare(getSortScore(a)));
  }, [
    services,
    searchTerm,
    timeFilter,
    kindFilter,
    teacherFilter,
    activeCounselor,
    todayYmd,
    weekStartYmd,
    weekEndYmd,
    monthPrefix,
  ]);

  // Helper for Meta AI Student Summary
  const handleGenerateStudentAiSummary = (st: Student) => {
    setIsGeneratingAiSummary(true);
    const stServices = services.filter((srv) =>
      (srv.students || []).some((s) => s.id === st.id || s.name.toLowerCase() === st.name.toLowerCase())
    );

    const total = stServices.length;
    const latestService = stServices[0];
    const topProblems = Array.from(new Set(stServices.map((s) => s.problem).filter(Boolean)))
      .slice(0, 3)
      .join(', ');

    setTimeout(() => {
      let summary = '';
      if (total === 0) {
        summary = `Peserta didik ${st.name} (Kelas ${st.class}) memiliki rekam jejak bimbingan yang bersih tanpa catatan kasus maupun masalah perilaku yang memerlukan penanganan khusus.`;
      } else {
        const monthName = new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' });
        summary = `Berdasarkan rekam jejak bimbingan per ${monthName}, ${st.name} (Kelas ${st.class}) telah menerima ${total} kali layanan bimbingan dan konseling, terutama berfokus pada topik "${topProblems || 'pengembangan disiplin & belajar'}". Siswa menunjukkan respon reflektif positif (${latestService?.followUp || 'pemantauan berkala'}).`;
      }
      setAiStudentSummary(summary);
      setIsGeneratingAiSummary(false);
    }, 300);
  };

  const filteredStudentsForPdf = useMemo(() => {
    const q = studentSearchForPdf.trim().toLowerCase();
    if (!q) return students.slice(0, 10);
    return students
      .filter((s) => s.name.toLowerCase().includes(q) || s.class.toLowerCase().includes(q))
      .slice(0, 10);
  }, [students, studentSearchForPdf]);

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    timeFilter !== 'semua' ||
    kindFilter !== 'semua' ||
    teacherFilter !== 'semua';

  const counselorLabel = activeCounselor?.name
    ? activeCounselor.name.split(',')[0].trim()
    : 'Guru Saya';

  return (
    <div className={embeddedMode ? 'space-y-4' : 'space-y-5 max-w-6xl mx-auto pb-24 animate-in fade-in duration-200'}>
      {/* ========================================================================= */}
      {/* HEADER LAYANAN BK + TOMBOL UTAMA (+ INPUT LAYANAN & EVALUASI PROGRAM)     */}
      {/* ========================================================================= */}
      {!embeddedMode && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#00685f] bg-[#e6f4f1] px-2.5 py-0.5 rounded-md border border-[#00685f]/15">
                Layanan Bimbingan &amp; Konseling
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#0b1c30] tracking-tight mt-1">
                Daftar Layanan BK
              </h1>
              <p className="text-xs sm:text-sm text-[#3d4947] font-medium mt-0.5">
                Semua sesi bimbingan klasikal, kelompok, konseling individu, dan dokumentasi BK tersimpan real-time di Cloud.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onNavigateToForm && (
                <button
                  type="button"
                  onClick={() => onNavigateToForm('tambah-layanan')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs sm:text-sm font-black shadow-sm transition-all cursor-pointer active:scale-97 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Input Layanan</span>
                </button>
              )}

              {onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab('evaluasi-program')}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-[#e6f4f1] hover:bg-[#d5ece7] text-[#00685f] border border-[#00685f]/30 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer active:scale-97 whitespace-nowrap"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  <span>Evaluasi Layanan &amp; Program BK</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (filteredServices.length === 0) {
                    showToast('⚠️ Tidak ada data layanan untuk diekspor ke PDF.', 'warning');
                    return;
                  }
                  downloadRekapSemuaLayananPDF({
                    services: filteredServices,
                    filterInfo: 'Daftar Layanan BK',
                    counselorOverride: activeCounselor,
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-gray-50 text-[#0b1c30] border border-[#bcc9c6]/60 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap"
                title="Unduh rekap semua layanan ke PDF"
              >
                <Download className="w-3.5 h-3.5 text-[#00685f]" />
                <span>PDF Semua</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowStudentPdfModal(true);
                  if (!selectedStudentForPdf && students.length > 0) {
                    setSelectedStudentForPdf(students[0]);
                    handleGenerateStudentAiSummary(students[0]);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-gray-50 text-[#0b1c30] border border-[#bcc9c6]/60 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap"
                title="Unduh PDF rekap layanan per siswa"
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>PDF Siswa</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  exportServicesToIcs(
                    filteredServices,
                    `Jadwal-Layanan-BK-${new Date().toISOString().slice(0, 10)}.ics`,
                    'Jadwal Layanan BK'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-gray-50 text-[#3d4947] border border-[#bcc9c6]/60 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                title="Ekspor jadwal ke Kalender (.ics)"
              >
                <Calendar className="w-3.5 h-3.5 text-[#00685f]" />
                <span>.ics</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan nama siswa, kelas, jenis layanan, atau topik..."
              className="w-full pl-10 pr-9 py-2.5 bg-[#f8faf9] border border-[#bcc9c6]/50 rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] focus:bg-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs font-bold cursor-pointer"
                aria-label="Hapus pencarian"
              >
                ✕
              </button>
            )}
          </div>

          {/* 3 Filter Cepat: Waktu, Jenis, Guru */}
          <div className="space-y-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Waktu */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full">
                {(
                  [
                    { id: 'semua', label: 'Semua Waktu' },
                    { id: 'hari-ini', label: 'Hari Ini' },
                    { id: 'minggu-ini', label: 'Minggu Ini' },
                    { id: 'bulan-ini', label: 'Bulan Ini' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTimeFilter(item.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      timeFilter === item.id
                        ? 'bg-[#00685f] text-white shadow-2xs'
                        : 'text-[#3d4947] hover:text-[#0b1c30]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Filter Jenis */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full">
                {(['semua', 'Klasikal', 'Kelompok', 'Individu', 'Konseling'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKindFilter(k)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      kindFilter === k
                        ? 'bg-[#00685f] text-white shadow-2xs'
                        : 'text-[#3d4947] hover:text-[#0b1c30]'
                    }`}
                  >
                    {k === 'semua' ? 'Semua Jenis' : k}
                  </button>
                ))}
              </div>

              {/* Filter Guru */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTeacherFilter('semua')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    teacherFilter === 'semua'
                      ? 'bg-[#00685f] text-white shadow-2xs'
                      : 'text-[#3d4947] hover:text-[#0b1c30]'
                  }`}
                >
                  Semua Guru
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherFilter('saya')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    teacherFilter === 'saya'
                      ? 'bg-[#00685f] text-white shadow-2xs'
                      : 'text-[#3d4947] hover:text-[#0b1c30]'
                  }`}
                >
                  {counselorLabel}
                </button>
              </div>
            </div>

            {/* Ringkasan Angka di Bawah Filter */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
              <div className="font-extrabold text-[#0b1c30] tabular-nums flex items-center gap-2">
                <span>
                  Total: <span className="text-[#00685f]">{filteredServices.length}</span> layanan
                </span>
                <span className="text-gray-300">&bull;</span>
                <span>
                  Minggu ini: <span className="text-[#00685f]">{thisWeekCount}</span>
                </span>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setTimeFilter('semua');
                    setKindFilter('semua');
                    setTeacherFilter('semua');
                  }}
                  className="text-[11px] font-extrabold text-[#00685f] hover:underline cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DAFTAR KARTU LAYANAN (TERBARU DI ATAS)                                    */}
      {/* ========================================================================= */}
      {filteredServices.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-[#bcc9c6]/40 shadow-2xs space-y-3">
          <div className="w-14 h-14 rounded-full bg-[#e6f4f1] text-[#00685f] flex items-center justify-center mx-auto">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-[#0b1c30]">
            {services.length === 0 ? 'Belum Ada Layanan Tercatat' : 'Tidak Ada Layanan Sesuai Filter'}
          </h3>
          <p className="text-xs text-[#3d4947] max-w-md mx-auto">
            {services.length === 0
              ? 'Klik "+ Input Layanan" di atas untuk mulai mencatat bimbingan klasikal, kelompok, atau konseling.'
              : 'Coba ubah kata kunci pencarian atau pilih "Semua Waktu / Semua Jenis / Semua Guru".'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setTimeFilter('semua');
                  setKindFilter('semua');
                  setTeacherFilter('semua');
                }}
                className="px-4 py-2 bg-[#e6f4f1] hover:bg-[#d5ece7] text-[#00685f] text-xs font-black rounded-xl cursor-pointer"
              >
                Reset Semua Filter
              </button>
            )}
            {onNavigateToForm && (
              <button
                type="button"
                onClick={() => onNavigateToForm('tambah-layanan')}
                className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-black rounded-xl cursor-pointer"
              >
                + Input Layanan Baru
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredServices.map((srv) => {
            const targetDisplay = getDisplayStudentOrClass(srv);
            const categoryLabel = getServiceCategoryBadge(srv);
            const counselorNameDisplay = srv.counselorName || activeCounselor?.name || 'Guru BK';
            const statusLabel =
              srv.status === 'Terjadwal'
                ? 'Dijadwalkan'
                : srv.status === 'Dibatalkan'
                ? 'Dibatalkan'
                : 'Selesai';
            const statusBadgeClass =
              statusLabel === 'Selesai'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : statusLabel === 'Dibatalkan'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-amber-50 text-amber-800 border-amber-200';
            const linkedEval = evalByServiceId.get(srv.id);

            return (
              <div
                key={srv.id}
                onClick={() => setDetailService(srv)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDetailService(srv);
                  }
                }}
                className="bg-white rounded-2xl border border-[#bcc9c6]/40 hover:border-[#00685f]/60 p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all cursor-pointer group space-y-3"
              >
                {/* Baris Atas: Tanggal + Status */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-extrabold text-[#00685f] bg-[#e6f4f1] px-2.5 py-1 rounded-lg">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatCardDate(srv.date)}</span>
                    </span>
                    {srv.startTime && (
                      <span className="inline-flex items-center gap-1 text-[#3d4947] font-semibold">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{formatCardTime(srv.startTime)}</span>
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[#3d4947] text-[10px] font-extrabold">
                      {categoryLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {linkedEval ? (
                      <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md tabular-nums">
                        Skor {getEffectiveServiceEvalScore(linkedEval).toFixed(1)}/5
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        Belum Dievaluasi
                      </span>
                    )}
                    <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${statusBadgeClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                </div>

                {/* Baris Tengah: Jenis Layanan, Nama Siswa/Kelas, Topik */}
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-black text-[#0b1c30] group-hover:text-[#00685f] transition-colors">
                    {srv.serviceType}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#3d4947]">
                    <span className="inline-flex items-center gap-1.5 font-bold text-[#0b1c30]">
                      <Users className="w-3.5 h-3.5 text-[#00685f]" />
                      <span>{targetDisplay}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#3d4947]">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span>{counselorNameDisplay}</span>
                    </span>
                  </div>
                  {srv.problem && (
                    <p className="text-xs text-[#3d4947] line-clamp-1 pt-0.5">
                      <span className="font-bold text-[#0b1c30]">Topik:</span> {srv.problem}
                    </p>
                  )}
                </div>

                {/* Baris Bawah: Tombol Cepat & [Lihat Detail] */}
                <div
                  className="pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!linkedEval && onEvaluateService && (
                      <button
                        type="button"
                        onClick={() => onEvaluateService(srv)}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Nilai</span>
                      </button>
                    )}

                    {onUpdateService && isLegacyServiceRecord(srv, linkedEval) && (
                      <button
                        type="button"
                        onClick={() => openFixClassifyModal(srv)}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                      >
                        <Tag className="w-3 h-3" />
                        <span>Klasifikasi</span>
                      </button>
                    )}

                    {onEditService && (
                      <button
                        type="button"
                        onClick={() => onEditService(srv)}
                        className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-[#0b1c30] border border-gray-200 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-[#00685f]" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setDetailService(srv)}
                    className="px-3.5 py-1.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Detail</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DETAIL LAYANAN LENGKAP (Tanggal, Tujuan, Materi, Hasil, RTL, Aksi)  */}
      {/* ========================================================================= */}
      <LayananDetailModal
        service={detailService}
        isOpen={Boolean(detailService)}
        onClose={() => setDetailService(null)}
        onEdit={(srv) => {
          if (onEditService) onEditService(srv);
        }}
        onDelete={(id) => {
          if (onDeleteService) {
            onDeleteService(id, true);
          }
          setDetailService(null);
        }}
        onUpdateStatus={
          onUpdateServiceStatus
            ? (serviceId, nextStatus) => {
                onUpdateServiceStatus(serviceId, nextStatus);
                setDetailService((prev) => (prev ? { ...prev, status: nextStatus } : null));
              }
            : undefined
        }
      />

      {/* ========================================================================= */}
      {/* MODAL DOWNLOAD PDF PER SISWA                                              */}
      {/* ========================================================================= */}
      {showStudentPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 border border-[#bcc9c6]/40 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-700">Export Laporan Terpadu</span>
                  <h3 className="text-lg font-black text-[#0b1c30]">Download PDF Layanan Per Siswa</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStudentPdfModal(false)}
                className="p-2 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">1. Pilih Nama Siswa:</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={studentSearchForPdf}
                    onChange={(e) => setStudentSearchForPdf(e.target.value)}
                    placeholder="Ketik nama siswa..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:bg-white"
                  />
                </div>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                  {filteredStudentsForPdf.map((st) => {
                    const isSelected = selectedStudentForPdf?.id === st.id;
                    const stServicesCount = services.filter((srv) =>
                      (srv.students || []).some((s) => s.id === st.id || s.name.toLowerCase() === st.name.toLowerCase())
                    ).length;

                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudentForPdf(st);
                          handleGenerateStudentAiSummary(st);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500 shadow-xs ring-2 ring-blue-300'
                            : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-black text-[#0b1c30] truncate">{st.name}</p>
                          <p className="text-[10px] text-gray-500 truncate">
                            Kelas {st.class} • {stServicesCount} Sesi Layanan
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'
                          }`}
                        >
                          {isSelected ? '✓ Terpilih' : 'Pilih'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedStudentForPdf && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-[#0b1c30] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Ringkasan Perkembangan:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleGenerateStudentAiSummary(selectedStudentForPdf)}
                      disabled={isGeneratingAiSummary}
                      className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      {isGeneratingAiSummary ? 'Memproses...' : 'Perbarui Ringkasan'}
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={aiStudentSummary}
                    onChange={(e) => setAiStudentSummary(e.target.value)}
                    placeholder="Ringkasan perkembangan siswa..."
                    className="w-full p-3 bg-gray-50 border border-gray-200 focus:border-[#00685f] rounded-xl text-xs font-medium text-[#0b1c30] focus:bg-white focus:outline-none leading-relaxed"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-3">
              <button
                type="button"
                onClick={() => setShowStudentPdfModal(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!selectedStudentForPdf) {
                    showToast('⚠️ Silakan pilih nama siswa terlebih dahulu.', 'warning');
                    return;
                  }
                  const stServices = services.filter((srv) =>
                    (srv.students || []).some(
                      (s) => s.id === selectedStudentForPdf.id || s.name.toLowerCase() === selectedStudentForPdf.name.toLowerCase()
                    )
                  );

                  downloadRekapLayananPerSiswaPDF({
                    student: selectedStudentForPdf,
                    services: stServices,
                    aiSummary: aiStudentSummary,
                    counselorOverride: activeCounselor,
                  });
                  setShowStudentPdfModal(false);
                }}
                className="px-5 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Unduh PDF Siswa Ini</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL PERBAIKI KLASIFIKASI DATA LAMA (TANPA MENGHAPUS DATA)               */}
      {/* ========================================================================= */}
      {fixClassifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 border border-[#bcc9c6]/40 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                  Migrasi Klasifikasi Terstandar
                </span>
                <h3 className="text-base sm:text-lg font-black text-[#0b1c30] mt-1">Perbaiki Klasifikasi Layanan</h3>
                <p className="text-xs text-gray-500">{fixClassifyTarget.serviceType} · Data lama tetap tersimpan utuh.</p>
              </div>
              <button
                type="button"
                onClick={() => setFixClassifyTarget(null)}
                className="p-2 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">
              <span className="font-bold text-gray-500">Catatan Topik Lama: </span>
              <span className="font-black text-[#0b1c30]">{fixClassifyTarget.problem || '-'}</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-[#0b1c30] block mb-1">
                  Jenis Masalah (Daftar Standar 9 Kategori)
                </label>
                <select
                  value={fixJenisMasalah}
                  onChange={(e) => setFixJenisMasalah(e.target.value as EvaluationJenisMasalah)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold text-[#0b1c30]"
                >
                  {EVALUATION_JENIS_MASALAH.map((jm) => (
                    <option key={jm} value={jm}>
                      {jm}
                    </option>
                  ))}
                </select>
              </div>

              {fixJenisMasalah === 'Lainnya' && (
                <div>
                  <label className="font-extrabold text-amber-900 block mb-1">
                    Alasan Memilih &quot;Lainnya&quot; (Wajib 1 Kalimat)
                  </label>
                  <input
                    type="text"
                    value={fixAlasanLainnya}
                    onChange={(e) => setFixAlasanLainnya(e.target.value)}
                    placeholder="Contoh: Kesulitan penyesuaian siswa pindahan dari luar kota."
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-amber-50/40 font-semibold text-[#0b1c30]"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-[#0b1c30] block mb-1">Tujuan Layanan</label>
                  <select
                    value={fixTujuan}
                    onChange={(e) => setFixTujuan(e.target.value as EvaluationTujuanType)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold text-[#0b1c30]"
                  >
                    {EVALUATION_TUJUAN_OPTIONS.map((tj) => (
                      <option key={tj} value={tj}>
                        {tj}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-extrabold text-[#0b1c30] block mb-1">Teknik Dipakai</label>
                  <select
                    value={fixTeknik}
                    onChange={(e) => setFixTeknik(e.target.value as EvaluationTeknikType)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold text-[#0b1c30]"
                  >
                    {EVALUATION_TEKNIK_OPTIONS.map((tk) => (
                      <option key={tk} value={tk}>
                        {tk}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#00685f]/20 space-y-2">
                <p className="font-extrabold text-[#00685f]">Baseline Retrospektif (Skala 1–5)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">Keparahan</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={fixKeparahan}
                      onChange={(e) => setFixKeparahan(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white font-black text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">Frekuensi</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={fixFrekuensi}
                      onChange={(e) => setFixFrekuensi(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white font-black text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">Motivasi Awal</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={fixMotivasiAwal}
                      onChange={(e) => setFixMotivasiAwal(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white font-black text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setFixClassifyTarget(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveFixClassification}
                className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan Klasifikasi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
