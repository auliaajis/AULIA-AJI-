import { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileBarChart,
  Calendar,
  Printer,
  Copy,
  Check,
  Search,
  AlertTriangle,
  HeartHandshake,
  CheckCircle2,
  Brain,
  Mail,
  Home,
  Sparkles,
  BarChart3,
  FileSpreadsheet,
  BookOpen,
  Layers,
  Target,
  Gavel,
  ExternalLink,
  ChevronDown,
  AlertCircle,
  Eye,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Student,
  ViolationRecord,
  CounselingService,
  Counselor,
  StudentAchievement,
  ProgramEvaluation,
} from '../types';
import {
  downloadPeriodicReportPDF,
  downloadRekapHomeVisitPDF,
  downloadRekapPelanggaranPDF,
  downloadRekapLayananPDF,
  downloadRekapSiswaKritisPDF,
} from '../utils/pdfGenerator';
import { getCloudCollectionData, subscribeCloudCollection } from '../utils/firestoreSync';
import { BK_COMPONENTS_DATA, getBKComponentForService } from '../utils/bkKomprehensif';
import { SERVICE_CATEGORIES } from './GrafikLayananBulananCard';
import BehavioralDiagnosisModal from './BehavioralDiagnosisModal';
import EmailNotificationModal from './EmailNotificationModal';
import { RiwayatLayananView } from './RiwayatLayananView';
import RekapSemesterView from './RekapSemesterView';
import {
  formatTanggalIndonesia,
  formatCardDateTime,
  SHORT_MONTHS_ID,
  FULL_MONTHS_ID,
} from '../utils/dateFormatter';
import { showToast } from '../utils/toast';

interface LaporanRekapViewProps {
  students: Student[];
  services: CounselingService[];
  violations: ViolationRecord[];
  achievements?: StudentAchievement[];
  homeVisits?: any[];
  programEvaluations?: ProgramEvaluation[];
  activeCounselor: Counselor;
  onNavigateToForm?: (form: string, studentId?: string) => void;
  onNavigateToTab?: (tab: string, searchQuery?: string) => void;
  onNavigateToStudioPdf?: () => void;
  onNavigateToEvaluasi?: () => void;
  onUpdateViolationStatus?: (id: string, status: any, progress: string) => void;
  onUpdateServiceStatus?: (id: string, status: any, followUp?: string) => void;
}

type PeriodPreset = 'this_month' | 'last_month' | 'this_semester' | 'this_year' | 'all';
type LaporanTab = 'ringkasan' | 'siswa' | 'layanan' | 'disiplin' | 'rekap-semester';
type ChartTypeMode = 'bar' | 'line';
type ChartRangeMode = '3months' | '6months' | 'year';

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extractYearMonth(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  if (/^\d{4}-\d{2}/.test(clean)) return clean.slice(0, 7);
  const parts = clean.split(/[-/]/);
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}`;
  }
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  }
  return '';
}

function categorizeServiceForChart(service: CounselingService): string {
  const typeStr = (service.serviceType || '').toLowerCase();
  const targetStr = (service.targetType || '').toLowerCase();
  const titleStr = (service.problem || '').toLowerCase();
  const combined = `${typeStr} ${targetStr} ${titleStr}`;

  if (combined.includes('home visit') || combined.includes('kunjungan rumah')) return 'homeVisit';
  if (combined.includes('mediasi') || combined.includes('konsultasi') || combined.includes('advokasi')) return 'konsultasi';
  if (combined.includes('konferensi') || combined.includes('alih tangan') || combined.includes('referral') || combined.includes('rujukan')) return 'referralLainnya';
  if (combined.includes('konseling kelompok')) return 'konselingKelompok';
  if (combined.includes('bimbingan kelompok')) return 'bimbinganKelompok';
  if (combined.includes('klasikal') || combined.includes('orientasi') || combined.includes('informasi') || combined.includes('konten')) return 'klasikal';
  if (combined.includes('individu') || combined.includes('perorangan') || combined.includes('pribadi')) return 'individual';
  if (targetStr === 'klasikal') return 'klasikal';
  if (targetStr === 'kelompok') return 'bimbinganKelompok';
  return 'individual';
}

function compareClassNames(a: string, b: string): number {
  const matchA = a.match(/^(\d+)\s*([A-Za-z]*)$/);
  const matchB = b.match(/^(\d+)\s*([A-Za-z]*)$/);
  if (matchA && matchB) {
    const numDiff = parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
    if (numDiff !== 0) return numDiff;
    return matchA[2].localeCompare(matchB[2], 'id');
  }
  return a.localeCompare(b, 'id');
}

export default function LaporanRekapView({
  students,
  services,
  violations,
  achievements = [],
  homeVisits = [],
  activeCounselor,
  onNavigateToForm,
  onNavigateToTab,
  onNavigateToStudioPdf,
  onNavigateToEvaluasi,
  onUpdateViolationStatus,
  onUpdateServiceStatus,
}: LaporanRekapViewProps) {
  const now = new Date();
  const todayStr = toYMD(now);
  const currentMonthShort = SHORT_MONTHS_ID[now.getMonth()];
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthShort = SHORT_MONTHS_ID[prevMonthDate.getMonth()];

  // Sticky 1-row filter state
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');
  const [selectedClass, setSelectedClass] = useState<string>('semua');
  const [searchTerm, setSearchTerm] = useState('');

  // Navigation & dropdown UI state
  const [activeTab, setActiveTab] = useState<LaporanTab>('ringkasan');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Unified 1-chart controls
  const [chartType, setChartType] = useState<ChartTypeMode>('bar');
  const [chartRange, setChartRange] = useState<ChartRangeMode>('6months');
  const [chartServiceCategory, setChartServiceCategory] = useState<string>('all');

  // Modals
  const [diagnosisStudentData, setDiagnosisStudentData] = useState<{
    name: string;
    class: string;
    nis?: string;
    netPoints: number;
    alpaCount: number;
  } | null>(null);
  const [emailModalData, setEmailModalData] = useState<any | null>(null);

  // Disiplin restitution & case follow-up state
  const [disiplinSection, setDisiplinSection] = useState<'pelanggaran' | 'restitusi' | 'home-visit'>('pelanggaran');
  const [unresolvedTab, setUnresolvedTab] = useState<'violation' | 'service'>('violation');
  const [handlingViolationId, setHandlingViolationId] = useState<string | null>(null);
  const [handlingHandledBy, setHandlingHandledBy] = useState<'Wali Kelas' | 'Guru BK' | 'Wali Kelas & Guru BK'>('Guru BK');
  const [handlingProgress, setHandlingProgress] = useState('');
  const [handlingServiceId, setHandlingServiceId] = useState<string | null>(null);
  const [handlingServiceFollowUp, setHandlingServiceFollowUp] = useState('');

  // Close export dropdown on outside click / Escape
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [exportMenuOpen]);

  const [allAttendanceHistory, setAllAttendanceHistory] = useState<any[]>(() =>
    getCloudCollectionData('bk_attendance_history', activeCounselor?.schoolId)
  );

  useEffect(() => {
    return subscribeCloudCollection(
      'bk_attendance_history',
      (data) => setAllAttendanceHistory(data),
      activeCounselor?.schoolId
    );
  }, [activeCounselor?.schoolId]);

  // Soft-delete guard at component boundary
  const activeStudents = useMemo(
    () => (students || []).filter((s) => !s?.isDeleted),
    [students]
  );
  const activeServices = useMemo(
    () => (services || []).filter((s) => !s?.isDeleted),
    [services]
  );
  const activeViolations = useMemo(
    () => (violations || []).filter((v) => !v?.isDeleted),
    [violations]
  );
  const activeAchievements = useMemo(
    () => (achievements || []).filter((a) => !a?.isDeleted),
    [achievements]
  );
  const activeHomeVisits = useMemo(
    () => (homeVisits || []).filter((h) => !h?.isDeleted),
    [homeVisits]
  );

  // Derived date range from periodPreset
  const { startDate, endDate, formattedDateRange } = useMemo(() => {
    const curr = new Date();
    if (periodPreset === 'this_month') {
      const start = toYMD(new Date(curr.getFullYear(), curr.getMonth(), 1));
      const end = toYMD(new Date(curr.getFullYear(), curr.getMonth() + 1, 0));
      return {
        startDate: start,
        endDate: end,
        formattedDateRange: `${FULL_MONTHS_ID[curr.getMonth()]} ${curr.getFullYear()}`,
      };
    }
    if (periodPreset === 'last_month') {
      const start = toYMD(new Date(curr.getFullYear(), curr.getMonth() - 1, 1));
      const end = toYMD(new Date(curr.getFullYear(), curr.getMonth(), 0));
      const prevD = new Date(curr.getFullYear(), curr.getMonth() - 1, 1);
      return {
        startDate: start,
        endDate: end,
        formattedDateRange: `${FULL_MONTHS_ID[prevD.getMonth()]} ${prevD.getFullYear()}`,
      };
    }
    if (periodPreset === 'this_semester') {
      const m = curr.getMonth();
      const startM = m >= 6 ? 6 : 0;
      const endM = m >= 6 ? 11 : 5;
      const start = toYMD(new Date(curr.getFullYear(), startM, 1));
      const end = toYMD(new Date(curr.getFullYear(), endM + 1, 0));
      return {
        startDate: start,
        endDate: end,
        formattedDateRange: `${formatTanggalIndonesia(start)} s.d. ${formatTanggalIndonesia(end)}`,
      };
    }
    if (periodPreset === 'this_year') {
      const start = `${curr.getFullYear()}-01-01`;
      const end = `${curr.getFullYear()}-12-31`;
      return {
        startDate: start,
        endDate: end,
        formattedDateRange: `Tahun ${curr.getFullYear()}`,
      };
    }
    return {
      startDate: '2020-01-01',
      endDate: todayStr,
      formattedDateRange: 'Semua Periode',
    };
  }, [periodPreset, todayStr]);

  const isDateInPeriod = (dateString?: string) => {
    if (periodPreset === 'all') return true;
    if (!dateString) return false;
    const target = String(dateString).trim().substring(0, 10);
    return target >= startDate && target <= endDate;
  };

  // Class options sorted by grade level then class letter
  const availableClasses = useMemo(() => {
    const classesSet = new Set<string>();
    activeStudents.forEach((s) => {
      if (s.class) classesSet.add(s.class.trim().toUpperCase());
    });
    return Array.from(classesSet).sort(compareClassNames);
  }, [activeStudents]);

  const queryLower = searchTerm.trim().toLowerCase();

  // Filtered Services
  const periodServices = useMemo(() => {
    return activeServices.filter((srv) => {
      if (!isDateInPeriod(srv.date)) return false;
      const matchesClass =
        selectedClass === 'semua' ||
        (srv.students || []).some((st) => (st.class || '').trim().toUpperCase() === selectedClass.toUpperCase());
      if (!matchesClass) return false;
      if (!queryLower) return true;
      return (
        String(srv.problem || '').toLowerCase().includes(queryLower) ||
        String(srv.serviceType || '').toLowerCase().includes(queryLower) ||
        String(srv.description || '').toLowerCase().includes(queryLower) ||
        (srv.students || []).some((st) => st && String(st.name || '').toLowerCase().includes(queryLower))
      );
    });
  }, [activeServices, periodPreset, startDate, endDate, selectedClass, queryLower]);

  // Filtered Violations
  const periodViolations = useMemo(() => {
    return activeViolations.filter((v) => {
      if (!isDateInPeriod(v.date)) return false;
      const matchesClass =
        selectedClass === 'semua' ||
        (v.studentClass || '').trim().toUpperCase() === selectedClass.toUpperCase();
      if (!matchesClass) return false;
      if (!queryLower) return true;
      return (
        String(v.studentName || '').toLowerCase().includes(queryLower) ||
        String(v.category || '').toLowerCase().includes(queryLower) ||
        String(v.notes || '').toLowerCase().includes(queryLower)
      );
    });
  }, [activeViolations, periodPreset, startDate, endDate, selectedClass, queryLower]);

  // Filtered Achievements
  const periodAchievements = useMemo(() => {
    return activeAchievements.filter((a) => {
      if (!isDateInPeriod(a.date)) return false;
      const matchesClass =
        selectedClass === 'semua' ||
        (a.studentClass || '').trim().toUpperCase() === selectedClass.toUpperCase();
      if (!matchesClass) return false;
      if (!queryLower) return true;
      return (
        String(a.studentName || '').toLowerCase().includes(queryLower) ||
        String(a.category || '').toLowerCase().includes(queryLower) ||
        String(a.achievementName || '').toLowerCase().includes(queryLower)
      );
    });
  }, [activeAchievements, periodPreset, startDate, endDate, selectedClass, queryLower]);

  // Filtered Home Visits
  const periodHomeVisits = useMemo(() => {
    return activeHomeVisits.filter((h) => {
      if (!isDateInPeriod(h.date || h.visitDate)) return false;
      const matchesClass =
        selectedClass === 'semua' ||
        (h.studentClass && String(h.studentClass).trim().toUpperCase() === selectedClass.toUpperCase());
      if (!matchesClass) return false;
      if (!queryLower) return true;
      return (
        String(h.studentName || '').toLowerCase().includes(queryLower) ||
        String(h.purpose || h.reason || '').toLowerCase().includes(queryLower) ||
        String(h.parentNameMet || h.parentName || '').toLowerCase().includes(queryLower)
      );
    });
  }, [activeHomeVisits, periodPreset, startDate, endDate, selectedClass, queryLower]);

  // Unresolved cases in Disiplin tab (obeying Class + Search + Period)
  const unresolvedViolations = useMemo(() => {
    return periodViolations.filter(
      (v) => !v.handledBy || v.handledBy === 'Belum Ditangani' || !v.handlingProgress
    );
  }, [periodViolations]);

  const unresolvedServices = useMemo(() => {
    return periodServices.filter((s) => s.status === 'Terjadwal');
  }, [periodServices]);

  // Critical & High Attention Students
  const criticalStudentsList = useMemo(() => {
    return activeStudents
      .filter((st) => {
        const matchesClass =
          selectedClass === 'semua' || (st.class || '').trim().toUpperCase() === selectedClass.toUpperCase();
        if (!matchesClass) return false;

        const netPoints = Math.max(0, (st.violationPoints || 0) - (st.achievementPoints || 0));

        const alfaDates = new Set<string>();
        allAttendanceHistory.forEach((attRec: any) => {
          if (Array.isArray(attRec.records)) {
            attRec.records.forEach((r: any) => {
              const matchId = r.studentId === st.id;
              const matchName =
                r.studentName && st.name && r.studentName.trim().toLowerCase() === st.name.trim().toLowerCase();
              if ((matchId || matchName) && r.status === 'A') {
                alfaDates.add(attRec.date || `att-${attRec.id || Math.random()}`);
              }
            });
          }
        });

        const allTimeStudentViolations = activeViolations.filter(
          (v) => v.studentId === st.id || (v.studentName && v.studentName.trim().toLowerCase() === st.name.trim().toLowerCase())
        );
        allTimeStudentViolations.forEach((v: any) => {
          const cat = (v.category || '').toLowerCase();
          if (cat.includes('alpa') || cat.includes('tanpa keterangan') || cat.includes('mangkir') || cat.includes('bolos') || cat.includes('kehadiran')) {
            alfaDates.add(v.date || `viol-${v.id}`);
          }
        });

        const totalCumulativeAlfa = alfaDates.size;
        const stPeriodViolations = periodViolations.filter((v) => v.studentId === st.id);
        const isHighRisk =
          netPoints >= 20 || totalCumulativeAlfa >= 2 || stPeriodViolations.length >= 1 || (st.violationPoints || 0) >= 20;

        if (!isHighRisk) return false;

        if (queryLower) {
          return (
            String(st.name || '').toLowerCase().includes(queryLower) ||
            String(st.class || '').toLowerCase().includes(queryLower) ||
            String(st.nis ?? '').toLowerCase().includes(queryLower)
          );
        }
        return true;
      })
      .map((st) => {
        const stPeriodViolations = periodViolations.filter((v) => v.studentId === st.id);
        const stPeriodServices = periodServices.filter((s) => (s.students || []).some((pst) => pst.id === st.id));
        const netPoints = Math.max(0, (st.violationPoints || 0) - (st.achievementPoints || 0));

        const alfaDates = new Set<string>();
        allAttendanceHistory.forEach((attRec: any) => {
          if (Array.isArray(attRec.records)) {
            attRec.records.forEach((r: any) => {
              const matchId = r.studentId === st.id;
              const matchName =
                r.studentName && st.name && r.studentName.trim().toLowerCase() === st.name.trim().toLowerCase();
              if ((matchId || matchName) && r.status === 'A') {
                alfaDates.add(attRec.date || `att-${attRec.id || Math.random()}`);
              }
            });
          }
        });

        const allTimeStudentViolations = activeViolations.filter(
          (v) => v.studentId === st.id || (v.studentName && v.studentName.trim().toLowerCase() === st.name.trim().toLowerCase())
        );
        allTimeStudentViolations.forEach((v: any) => {
          const cat = (v.category || '').toLowerCase();
          if (cat.includes('alpa') || cat.includes('tanpa keterangan') || cat.includes('mangkir') || cat.includes('bolos') || cat.includes('kehadiran')) {
            alfaDates.add(v.date || `viol-${v.id}`);
          }
        });

        const totalCumulativeAlfa = alfaDates.size;

        let riskLevel: 'Kritis' | 'Tinggi' | 'Sedang' = 'Sedang';
        if (netPoints >= 50 || totalCumulativeAlfa >= 5) riskLevel = 'Kritis';
        else if (netPoints >= 25 || totalCumulativeAlfa >= 3) riskLevel = 'Tinggi';

        return {
          student: st,
          netPoints,
          alpaCount: totalCumulativeAlfa,
          riskLevel,
          periodViolationsCount: stPeriodViolations.length,
          periodServicesCount: stPeriodServices.length,
          latestViolation: stPeriodViolations[0]?.category || allTimeStudentViolations[0]?.category || '-',
        };
      })
      .sort((a, b) => b.netPoints - a.netPoints);
  }, [activeStudents, periodViolations, periodServices, activeViolations, selectedClass, queryLower, activeCounselor?.schoolId]);

  // Executive KPI & Pillar stats
  const stats = useMemo(() => {
    const totalServices = periodServices.length;
    const completedServices = periodServices.filter((s) => s.status === 'Selesai').length;
    const scheduledServices = periodServices.filter((s) => s.status === 'Terjadwal').length;
    const totalViolationsCount = periodViolations.length;
    const totalViolationPoints = periodViolations.reduce((sum, v) => sum + (v.pointsAdded || 0), 0);
    const totalAchievementsCount = periodAchievements.length;

    const individualCount = periodServices.filter(
      (s) => (s.serviceType || '').toLowerCase().includes('individual') || s.targetType === 'Individu'
    ).length;
    const groupCount = periodServices.filter(
      (s) => (s.serviceType || '').toLowerCase().includes('kelompok') || s.targetType === 'Kelompok'
    ).length;
    const classicalCount = periodServices.filter(
      (s) => (s.serviceType || '').toLowerCase().includes('klasikal') || s.targetType === 'Klasikal'
    ).length;

    const pilarStats = BK_COMPONENTS_DATA.map((comp) => {
      const pilarServices = periodServices.filter(
        (s) => (s.bkComponent || getBKComponentForService(s.serviceType)) === comp.id
      );
      return {
        ...comp,
        count: pilarServices.length,
        percentage: totalServices > 0 ? Math.round((pilarServices.length / totalServices) * 100) : 0,
        completedCount: pilarServices.filter((s) => s.status === 'Selesai').length,
      };
    });

    const uniqueStudentsServed = new Set<string>();
    periodServices.forEach((s) => {
      (s.students || []).forEach((st) => uniqueStudentsServed.add(st.id));
    });

    return {
      totalServices,
      completedServices,
      scheduledServices,
      totalViolationsCount,
      totalViolationPoints,
      totalAchievementsCount,
      individualCount,
      groupCount,
      classicalCount,
      pilarStats,
      totalHomeVisitsCount: periodHomeVisits.length,
      uniqueStudentsCount: uniqueStudentsServed.size,
      criticalStudentsCount: criticalStudentsList.length,
    };
  }, [periodServices, periodViolations, periodAchievements, periodHomeVisits, criticalStudentsList]);

  // Unified chart dataset obeying sticky filters (Periode anchor, Kelas, Cari) + dropdown jenis layanan
  const unifiedChartData = useMemo(() => {
    const classFilterFn = (cls?: string) =>
      selectedClass === 'semua' || (cls || '').trim().toUpperCase() === selectedClass.toUpperCase();

    const filteredServicesForChart = activeServices.filter((srv) => {
      const matchesClass =
        selectedClass === 'semua' ||
        (srv.students || []).some((st) => classFilterFn(st.class));
      if (!matchesClass) return false;
      if (queryLower) {
        const matchQ =
          String(srv.problem || '').toLowerCase().includes(queryLower) ||
          String(srv.serviceType || '').toLowerCase().includes(queryLower) ||
          (srv.students || []).some((st) => String(st.name || '').toLowerCase().includes(queryLower));
        if (!matchQ) return false;
      }
      if (periodPreset === 'this_month' || periodPreset === 'last_month') {
        // Keep full multi-month context up to anchor month while respecting class/search
        return true;
      }
      return isDateInPeriod(srv.date);
    });

    const filteredViolationsForChart = activeViolations.filter((v) => {
      if (!classFilterFn(v.studentClass)) return false;
      if (queryLower) {
        const matchQ =
          String(v.studentName || '').toLowerCase().includes(queryLower) ||
          String(v.category || '').toLowerCase().includes(queryLower);
        if (!matchQ) return false;
      }
      if (periodPreset === 'this_month' || periodPreset === 'last_month') return true;
      return isDateInPeriod(v.date);
    });

    const filteredAchievementsForChart = activeAchievements.filter((a) => {
      if (!classFilterFn(a.studentClass)) return false;
      if (queryLower) {
        const matchQ =
          String(a.studentName || '').toLowerCase().includes(queryLower) ||
          String(a.achievementName || '').toLowerCase().includes(queryLower);
        if (!matchQ) return false;
      }
      if (periodPreset === 'this_month' || periodPreset === 'last_month') return true;
      return isDateInPeriod(a.date);
    });

    const monthCount = chartRange === '3months' ? 3 : chartRange === 'year' ? 12 : 6;
    const anchorDate =
      periodPreset === 'last_month'
        ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
        : new Date(now.getFullYear(), now.getMonth(), 1);
    const anchorYear = anchorDate.getFullYear();
    const anchorMonth = anchorDate.getMonth();

    const rows: Record<string, any>[] = [];

    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(anchorYear, anchorMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      const shortLabel = `${SHORT_MONTHS_ID[m]}${y !== now.getFullYear() ? ` '${String(y).slice(-2)}` : ''}`;
      const fullLabel = `${FULL_MONTHS_ID[m]} ${y}`;

      const monthServices = filteredServicesForChart.filter((s) => extractYearMonth(s.date) === monthKey);
      const counts: Record<string, number> = {
        individual: 0,
        bimbinganKelompok: 0,
        klasikal: 0,
        konselingKelompok: 0,
        konsultasi: 0,
        homeVisit: 0,
        referralLainnya: 0,
      };
      monthServices.forEach((srv) => {
        const cat = categorizeServiceForChart(srv);
        counts[cat] = (counts[cat] || 0) + 1;
      });

      const selectedServiceCount =
        chartServiceCategory === 'all'
          ? monthServices.length
          : counts[chartServiceCategory] || 0;

      const monthViolations = filteredViolationsForChart.filter((v) => extractYearMonth(v.date) === monthKey).length;
      const monthAchievements = filteredAchievementsForChart.filter((a) => extractYearMonth(a.date) === monthKey).length;

      rows.push({
        month: shortLabel,
        fullMonth: fullLabel,
        monthKey,
        layanan: selectedServiceCount,
        pelanggaran: monthViolations,
        apresiasi: monthAchievements,
        ...counts,
      });
    }

    return rows;
  }, [
    activeServices,
    activeViolations,
    activeAchievements,
    selectedClass,
    queryLower,
    periodPreset,
    startDate,
    endDate,
    chartRange,
    chartServiceCategory,
  ]);

  const selectedCategoryMeta = useMemo(
    () => SERVICE_CATEGORIES.find((c) => c.key === chartServiceCategory) || null,
    [chartServiceCategory]
  );

  // PDF Export Trigger
  const handleExportPDF = () => {
    setExportMenuOpen(false);
    if (activeTab === 'disiplin' && disiplinSection === 'home-visit') {
      downloadRekapHomeVisitPDF({
        startDate,
        endDate,
        selectedClass,
        homeVisits: periodHomeVisits,
        activeCounselor,
      });
    } else if (activeTab === 'disiplin') {
      downloadRekapPelanggaranPDF({
        startDate,
        endDate,
        selectedClass,
        violations: periodViolations,
        activeCounselor,
      });
    } else if (activeTab === 'layanan') {
      downloadRekapLayananPDF({
        startDate,
        endDate,
        selectedClass,
        services: periodServices,
        activeCounselor,
      });
    } else if (activeTab === 'siswa') {
      downloadRekapSiswaKritisPDF({
        startDate,
        endDate,
        selectedClass,
        criticalStudentsList,
        activeCounselor,
      });
    } else {
      downloadPeriodicReportPDF({
        startDate,
        endDate,
        selectedClass,
        periodServices,
        periodViolations,
        criticalStudentsList,
        stats,
        activeCounselor,
      });
    }
  };

  // Copy Plain Text Report
  const handleCopyTextReport = () => {
    setExportMenuOpen(false);
    const text = `*LAPORAN REKAPITULASI BIMBINGAN KONSELING (BK)*
Periode: ${formattedDateRange}
Kelas: ${selectedClass === 'semua' ? 'Semua Kelas' : selectedClass}
Guru Pembimbing: ${activeCounselor.name} (${activeCounselor.role})

RINGKASAN STATISTIK:
• Total Sesi Konseling: ${stats.totalServices} Sesi (${stats.completedServices} Selesai, ${stats.scheduledServices} Terjadwal)
• Siswa Terlayani: ${stats.uniqueStudentsCount} Orang
• Sesi Individual: ${stats.individualCount} | Kelompok: ${stats.groupCount} | Klasikal: ${stats.classicalCount}
• Total Catatan Pelanggaran: ${stats.totalViolationsCount} Kasus (Total Bobot: ${stats.totalViolationPoints})
• Kunjungan Rumah (Home Visit): ${stats.totalHomeVisitsCount} Kali
• Apresiasi / Prestasi: ${stats.totalAchievementsCount} Catatan
• Siswa Status Kritis/Perhatian Khusus: ${stats.criticalStudentsCount} Orang

DAFTAR SISWA MEMERLUKAN PERHATIAN KHUSUS/KRITIS:
${
  criticalStudentsList.length === 0
    ? '- Tidak ada siswa yang mencapai ambang batas kritis pada periode ini.'
    : criticalStudentsList
        .slice(0, 10)
        .map(
          (item, idx) =>
            `${idx + 1}. ${item.student.name} (${item.student.class}) - Bobot Net: ${item.netPoints} | Status Risiko: ${item.riskLevel}`
        )
        .join('\n')
}

RINGKASAN SESI KONSELING TERBARU:
${
  periodServices.length === 0
    ? '- Belum ada rekam konseling pada periode ini.'
    : periodServices
        .slice(0, 5)
        .map(
          (srv, idx) =>
            `${idx + 1}. [${formatTanggalIndonesia(srv.date)}] ${srv.students.map((s) => `${s.name} (${s.class})`).join(', ')} - Tipe: ${srv.serviceType} | Topik: ${srv.problem}`
        )
        .join('\n')
}`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    showToast('Ringkasan laporan berhasil disalin ke clipboard.', 'success');
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // CSV Export Trigger
  const handleExportCSV = () => {
    setExportMenuOpen(false);
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `LAPORAN REKAP PERIODE BK (${formattedDateRange})\n\n`;
    csvContent += 'NO,TANGGAL,TIPE LAYANAN,NAMA SISWA,KELAS,TOPIK / PERMASALAHAN,STATUS,DESKRIPSI\n';

    periodServices.forEach((srv, index) => {
      const studentNames = (srv.students || []).map((s) => `${s.name}`).join('; ');
      const studentClasses = (srv.students || []).map((s) => `${s.class}`).join('; ');
      const desc = (srv.description || '').replace(/"/g, '""');
      const prob = (srv.problem || '').replace(/"/g, '""');

      csvContent += `"${index + 1}","${formatTanggalIndonesia(srv.date)}","${srv.serviceType}","${studentNames}","${studentClasses}","${prob}","${srv.status}","${desc}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Rekap_BK_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const rowData = payload[0]?.payload;
    return (
      <div className="bg-[#0b1c30] text-white p-3 rounded-xl shadow-lg border border-white/10 text-xs min-w-[190px] z-50">
        <div className="font-extrabold text-[#e6f4f1] pb-1.5 mb-1.5 border-b border-white/15">
          {rowData?.fullMonth || label}
        </div>
        <div className="space-y-1 tabular-nums">
          {payload.map((entry: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-3 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-gray-300 truncate">{entry.name}</span>
              </div>
              <span className="font-extrabold text-white">{entry.value ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in pb-[100px]">
      {/* HEADER: Clean Title + 1 Primary [Cetak / PDF] Dropdown */}
      <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-2xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/20 flex items-center justify-center shrink-0">
            <FileBarChart className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-[#0b1c30] tracking-tight truncate">
              Laporan &amp; Rekap Konseling
            </h1>
            <p className="text-xs text-[#3d4947] font-medium truncate">
              Periode {formattedDateRange} &bull; {selectedClass === 'semua' ? 'Semua Kelas' : `Kelas ${selectedClass}`}
            </p>
          </div>
        </div>

        {/* Single Primary Action: [Cetak / PDF] + Dropdown */}
        <div className="relative self-start sm:self-center shrink-0" ref={exportMenuRef}>
          <button
            type="button"
            onClick={() => setExportMenuOpen((prev) => !prev)}
            aria-expanded={exportMenuOpen}
            aria-haspopup="menu"
            className="px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-colors shadow-xs flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / PDF</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {exportMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-[#bcc9c6]/50 shadow-lg py-1.5 z-40"
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleExportPDF}
                className="w-full px-3.5 py-2 text-left text-xs font-bold text-[#0b1c30] hover:bg-[#e6f4f1] hover:text-[#00685f] flex items-center gap-2.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#00685f]" />
                <span>PDF Resmi Dinas</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleExportCSV}
                className="w-full px-3.5 py-2 text-left text-xs font-bold text-[#0b1c30] hover:bg-[#e6f4f1] hover:text-[#00685f] flex items-center gap-2.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>CSV</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleCopyTextReport}
                className="w-full px-3.5 py-2 text-left text-xs font-bold text-[#0b1c30] hover:bg-[#e6f4f1] hover:text-[#00685f] flex items-center gap-2.5 cursor-pointer"
              >
                {copiedSummary ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                <span>{copiedSummary ? 'Tersalin ke Clipboard!' : 'Salin Text'}</span>
              </button>

              {onNavigateToStudioPdf && (
                <>
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setExportMenuOpen(false);
                      onNavigateToStudioPdf();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-extrabold text-[#00685f] hover:bg-[#e6f4f1] flex items-center gap-2.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Buka Studio PDF Maker</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* STICKY 1-ROW FILTER BAR: [Periode] [Kelas] [Cari...] */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs rounded-2xl border border-[#bcc9c6]/45 shadow-xs p-2.5 sm:p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
            <select
              aria-label="Filter Periode"
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value as PeriodPreset)}
              className="w-full sm:w-52 bg-[#f8faf9] border border-[#bcc9c6]/50 rounded-xl px-3 py-2 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
            >
              <option value="this_month">Periode: Bulan Ini ({currentMonthShort} {now.getFullYear()})</option>
              <option value="last_month">Periode: Bulan Lalu ({prevMonthShort} {prevMonthDate.getFullYear()})</option>
              <option value="this_semester">Periode: Semester Ini</option>
              <option value="this_year">Periode: Tahun Ini ({now.getFullYear()})</option>
              <option value="all">Periode: Semua Data</option>
            </select>

            <select
              aria-label="Filter Kelas"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full sm:w-40 bg-[#f8faf9] border border-[#bcc9c6]/50 rounded-xl px-3 py-2 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
            >
              <option value="semua">Kelas: Semua Kelas</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Kelas {cls}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Cari nama siswa atau topik"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama siswa, topik, atau kategori..."
              className="w-full pl-8 pr-8 py-2 bg-[#f8faf9] border border-[#bcc9c6]/50 rounded-xl text-xs font-semibold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs font-bold cursor-pointer"
                aria-label="Bersihkan pencarian"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SEGMENTED TAB BAR: [Ringkasan] [Siswa] [Layanan] [Disiplin] + [Rekap Semester] [Evaluasi] */}
      <div className="flex items-center gap-1.5 p-1.5 bg-gray-100 rounded-2xl border border-[#bcc9c6]/35 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('ringkasan')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'ringkasan' ? 'bg-[#00685f] text-white shadow-2xs' : 'text-[#3d4947] hover:text-[#0b1c30]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Ringkasan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('siswa')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'siswa' ? 'bg-[#00685f] text-white shadow-2xs' : 'text-[#3d4947] hover:text-[#0b1c30]'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Siswa</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('layanan')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'layanan' ? 'bg-[#00685f] text-white shadow-2xs' : 'text-[#3d4947] hover:text-[#0b1c30]'
          }`}
        >
          <HeartHandshake className="w-3.5 h-3.5" />
          <span>Layanan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('disiplin')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'disiplin' ? 'bg-[#00685f] text-white shadow-2xs' : 'text-[#3d4947] hover:text-[#0b1c30]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Disiplin</span>
        </button>

        <div className="h-5 w-px bg-[#bcc9c6]/50 mx-0.5 shrink-0" />

        <button
          type="button"
          onClick={() => setActiveTab('rekap-semester')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'rekap-semester' ? 'bg-[#00685f] text-white shadow-2xs' : 'text-[#00685f] hover:bg-white/70'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Rekap Semester</span>
        </button>

        {(onNavigateToEvaluasi || onNavigateToTab) && (
          <button
            type="button"
            onClick={() => (onNavigateToEvaluasi ? onNavigateToEvaluasi() : onNavigateToTab?.('evaluasi-program'))}
            className="px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-[#0b1c30] hover:bg-white/70"
          >
            <Target className="w-3.5 h-3.5 text-[#00685f]" />
            <span>Evaluasi</span>
          </button>
        )}
      </div>

      {/* TAB 1: RINGKASAN (4 KPI Boxes 1x + Small Inline Line + 1 Unified Chart Only) */}
      {activeTab === 'ringkasan' && (
        <div className="space-y-4">
          {/* 4 Summary Boxes Only, Shown 1x Only */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
            <button
              type="button"
              onClick={() => setActiveTab('layanan')}
              className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs text-left hover:border-[#00685f]/50 transition-colors cursor-pointer"
            >
              <span className="text-[11px] font-bold text-[#3d4947] uppercase tracking-wider block">
                Sesi
              </span>
              <p className="text-2xl sm:text-3xl font-black text-[#0b1c30] mt-1">{stats.totalServices}</p>
            </button>

            <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs">
              <span className="text-[11px] font-bold text-[#3d4947] uppercase tracking-wider block">
                Terlayani
              </span>
              <p className="text-2xl sm:text-3xl font-black text-[#00685f] mt-1">{stats.uniqueStudentsCount}</p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('siswa')}
              className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs text-left hover:border-amber-400 transition-colors cursor-pointer"
            >
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                Kritis
              </span>
              <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">{stats.criticalStudentsCount}</p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('disiplin')}
              className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs text-left hover:border-red-300 transition-colors cursor-pointer"
            >
              <span className="text-[11px] font-bold text-[#3d4947] uppercase tracking-wider block">
                Pelanggaran
              </span>
              <p className="text-2xl sm:text-3xl font-black text-[#0b1c30] mt-1">{stats.totalViolationsCount}</p>
            </button>
          </div>

          {/* Compact Inline Secondary Line (no big zero cards, no repeated counts) */}
          <p className="text-xs text-[#3d4947] font-semibold px-1 tabular-nums">
            Home Visit: {stats.totalHomeVisitsCount} &bull; Apresiasi: {stats.totalAchievementsCount} &bull; Selesai: {stats.completedServices}
          </p>

          {/* Single Unified Chart Card */}
          <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-2xs p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#bcc9c6]/25">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#e6f4f1] text-[#00685f] flex items-center justify-center shrink-0">
                  {chartType === 'bar' ? <BarChart3 className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-extrabold text-[#0b1c30] truncate">
                    Grafik Aktivitas Layanan BK
                  </h2>
                  <p className="text-[11px] text-[#3d4947] font-medium truncate">
                    {chartType === 'bar' ? 'Distribusi bulanan jenis layanan' : 'Tren layanan, pelanggaran & apresiasi'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Bar / Line Toggle (Default: Batang) */}
                <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200/80">
                  <button
                    type="button"
                    onClick={() => setChartType('bar')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      chartType === 'bar' ? 'bg-[#00685f] text-white shadow-2xs' : 'text-[#3d4947] hover:text-[#0b1c30]'
                    }`}
                  >
                    Batang
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('line')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      chartType === 'line' ? 'bg-[#00685f] text-white shadow-2xs' : 'text-[#3d4947] hover:text-[#0b1c30]'
                    }`}
                  >
                    Garis
                  </button>
                </div>

                {/* Range Toggle: [3 Bulan / 6 Bulan / 1 Tahun] */}
                <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200/80">
                  <button
                    type="button"
                    onClick={() => setChartRange('3months')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      chartRange === '3months' ? 'bg-[#00685f] text-white shadow-2xs' : 'text-[#3d4947] hover:text-[#0b1c30]'
                    }`}
                  >
                    3 Bulan
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartRange('6months')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      chartRange === '6months' ? 'bg-[#00685f] text-white shadow-2xs' : 'text-[#3d4947] hover:text-[#0b1c30]'
                    }`}
                  >
                    6 Bulan
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartRange('year')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      chartRange === 'year' ? 'bg-[#00685f] text-white shadow-2xs' : 'text-[#3d4947] hover:text-[#0b1c30]'
                    }`}
                  >
                    1 Tahun
                  </button>
                </div>

                {/* Single Dropdown Filter for Service Types */}
                <select
                  aria-label="Filter Jenis Layanan Grafik"
                  value={chartServiceCategory}
                  onChange={(e) => setChartServiceCategory(e.target.value)}
                  className="bg-[#f8faf9] border border-[#bcc9c6]/50 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                >
                  <option value="all">Semua Jenis Layanan</option>
                  {SERVICE_CATEGORIES.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={unifiedChartData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10, fontWeight: 700 }} iconType="circle" />

                    {chartServiceCategory === 'all' ? (
                      SERVICE_CATEGORIES.map((cat, idx) => (
                        <Bar
                          key={cat.key}
                          dataKey={cat.key}
                          name={cat.label}
                          fill={cat.color}
                          stackId="a"
                          barSize={26}
                          radius={idx === SERVICE_CATEGORIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        />
                      ))
                    ) : (
                      <Bar
                        dataKey="layanan"
                        name={selectedCategoryMeta?.label || 'Layanan BK'}
                        fill={selectedCategoryMeta?.color || '#00685f'}
                        barSize={28}
                        radius={[4, 4, 0, 0]}
                      />
                    )}
                  </BarChart>
                ) : (
                  <LineChart data={unifiedChartData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10, fontWeight: 700 }} iconType="circle" />
                    <Line
                      type="monotone"
                      dataKey="layanan"
                      name={selectedCategoryMeta ? selectedCategoryMeta.label : 'Layanan BK'}
                      stroke={selectedCategoryMeta?.color || '#00685f'}
                      strokeWidth={2.5}
                      dot={{ r: 3.5 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="pelanggaran"
                      name="Pelanggaran"
                      stroke="#dc2626"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="apresiasi"
                      name="Apresiasi"
                      stroke="#0284c7"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SISWA (Hanya Daftar Siswa Kritis) */}
      {activeTab === 'siswa' && (
        <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-amber-50/70 border-b border-amber-200/70 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-amber-950 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Daftar Siswa Memerlukan Perhatian Khusus &amp; Kritis</span>
              </h3>
              <p className="text-xs text-amber-900/80 font-medium mt-0.5">
                Siswa dengan akumulasi bobot tinggi, akumulasi alpa dari awal absen, atau catatan pelanggaran pada filter aktif.
              </p>
            </div>
            <span className="text-xs font-extrabold text-amber-900 tabular-nums">
              {criticalStudentsList.length} Siswa
            </span>
          </div>

          {criticalStudentsList.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="font-bold text-sm text-[#0b1c30]">
                Tidak Ada Siswa Status Kritis Pada Filter Terpilih
              </p>
              <p className="text-xs text-[#3d4947]">
                Seluruh siswa berada dalam batas aman pembinaan disiplin.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8faf9] border-b border-[#bcc9c6]/40 text-[#0b1c30] font-extrabold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5 text-center w-12">No</th>
                    <th className="p-3.5">Nama Siswa</th>
                    <th className="p-3.5">Kelas</th>
                    <th className="p-3.5 text-center">Bobot Net</th>
                    <th className="p-3.5 text-center">Total Alpa</th>
                    <th className="p-3.5">Tingkat Risiko</th>
                    <th className="p-3.5">Kasus Terakhir</th>
                    <th className="p-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 tabular-nums">
                  {criticalStudentsList.map((item, idx) => {
                    const { student, netPoints, alpaCount, riskLevel, latestViolation } = item;
                    return (
                      <tr key={student.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="p-3.5 text-center font-bold text-gray-500">{idx + 1}</td>
                        <td className="p-3.5">
                          <p className="font-bold text-[#0b1c30]">{student.name}</p>
                          <p className="text-[10px] text-gray-500 font-medium">NIS: {student.nis || '-'}</p>
                        </td>
                        <td className="p-3.5 font-bold text-gray-700">{student.class}</td>
                        <td className="p-3.5 text-center font-black text-red-600 text-sm">{netPoints}</td>
                        <td className="p-3.5 text-center font-extrabold text-amber-700">
                          {alpaCount > 0 ? `${alpaCount}x` : '-'}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                              riskLevel === 'Kritis'
                                ? 'bg-red-100 text-red-800 border-red-300'
                                : riskLevel === 'Tinggi'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-blue-100 text-blue-800 border-blue-300'
                            }`}
                          >
                            {riskLevel}
                          </span>
                        </td>
                        <td className="p-3.5 font-medium text-gray-700 max-w-xs truncate" title={latestViolation}>
                          {latestViolation}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setDiagnosisStudentData({
                                  name: student.name,
                                  class: student.class,
                                  nis: student.nis,
                                  netPoints,
                                  alpaCount,
                                })
                              }
                              className="px-2.5 py-1.5 bg-[#0b1c30] hover:bg-[#00685f] text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                              title="Diagnosa AI Gemini"
                            >
                              <Brain className="w-3.5 h-3.5 text-teal-300" />
                              <span className="hidden sm:inline">Diagnosa AI</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setEmailModalData({
                                  studentName: student.name,
                                  studentClass: student.class,
                                  studentNis: student.nis,
                                  netPoints,
                                  alpaCount,
                                  riskLevel,
                                })
                              }
                              className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg transition-colors cursor-pointer"
                              title="Kirim Email Notifikasi Orang Tua / Wali Kelas"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LAYANAN (Pilar 1-4 Progress Bar Kecil + Riwayat Layanan) */}
      {activeTab === 'layanan' && (
        <div className="space-y-4">
          {/* Compact 4 Pillars Progress Bars */}
          <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-2xs p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100">
              <h3 className="font-extrabold text-xs sm:text-sm text-[#0b1c30] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#00685f]" />
                <span>Proporsi 4 Pilar BK Komprehensif</span>
              </h3>
              <span className="text-[11px] font-bold text-[#3d4947] tabular-nums">
                {stats.totalServices} sesi pada filter aktif
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 tabular-nums">
              {stats.pilarStats.map((pilar) => (
                <div key={pilar.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#0b1c30] truncate">
                      Pilar {pilar.pilarNumber}: {pilar.name}
                    </span>
                    <span className="font-extrabold text-[#00685f] shrink-0">
                      {pilar.count} sesi ({pilar.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00685f] rounded-full transition-all duration-300"
                      style={{ width: `${pilar.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Embedded Riwayat Layanan obeying Laporan sticky filter */}
          <RiwayatLayananView
            embeddedMode={true}
            services={periodServices}
            students={activeStudents}
            activeCounselor={activeCounselor}
            onNavigateToForm={onNavigateToForm}
          />
        </div>
      )}

      {/* TAB 4: DISIPLIN (Pelanggaran + Bimbingan Kasus & Restitusi + Home Visit) */}
      {activeTab === 'disiplin' && (
        <div className="space-y-4">
          {/* Sub-section selector inside Disiplin */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setDisiplinSection('pelanggaran')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer border ${
                disiplinSection === 'pelanggaran'
                  ? 'bg-[#00685f] text-white border-[#00685f]'
                  : 'bg-white text-[#3d4947] border-[#bcc9c6]/45 hover:text-[#0b1c30]'
              }`}
            >
              Catatan Pelanggaran ({periodViolations.length})
            </button>

            <button
              type="button"
              onClick={() => setDisiplinSection('restitusi')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer border ${
                disiplinSection === 'restitusi'
                  ? 'bg-[#00685f] text-white border-[#00685f]'
                  : 'bg-white text-[#3d4947] border-[#bcc9c6]/45 hover:text-[#0b1c30]'
              }`}
            >
              Restitusi &amp; Tindak Lanjut ({unresolvedViolations.length + unresolvedServices.length})
            </button>

            <button
              type="button"
              onClick={() => setDisiplinSection('home-visit')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer border ${
                disiplinSection === 'home-visit'
                  ? 'bg-[#00685f] text-white border-[#00685f]'
                  : 'bg-white text-[#3d4947] border-[#bcc9c6]/45 hover:text-[#0b1c30]'
              }`}
            >
              Home Visit ({periodHomeVisits.length})
            </button>
          </div>

          {disiplinSection === 'pelanggaran' && (
            <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#0b1c30] flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#00685f]" />
                    <span>Catatan Pelanggaran Periode {formattedDateRange}</span>
                  </h3>
                  <p className="text-xs text-[#3d4947] font-medium mt-0.5">
                    Daftar riwayat kedisiplinan dan bobot pembinaan siswa yang tercatat.
                  </p>
                </div>
                <span className="text-xs font-extrabold text-red-700 tabular-nums">
                  {periodViolations.length} Kasus
                </span>
              </div>

              {periodViolations.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="font-bold text-sm text-[#0b1c30]">Tidak Ada Catatan Pelanggaran Pada Periode Ini</p>
                  <p className="text-xs text-[#3d4947]">Kondisi kedisiplinan siswa kondusif.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f8faf9] border-b border-[#bcc9c6]/40 text-[#0b1c30] font-extrabold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3.5 text-center w-12">No</th>
                        <th className="p-3.5">Tanggal</th>
                        <th className="p-3.5">Nama Siswa &amp; Kelas</th>
                        <th className="p-3.5">Kategori &amp; Detail</th>
                        <th className="p-3.5 text-center">Bobot</th>
                        <th className="p-3.5">Status / Tindak Lanjut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 tabular-nums">
                      {periodViolations.map((v, idx) => (
                        <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3.5 text-center font-bold text-gray-500">{idx + 1}</td>
                          <td className="p-3.5 font-bold text-[#0b1c30] whitespace-nowrap">{formatTanggalIndonesia(v.date)}</td>
                          <td className="p-3.5">
                            <p className="font-bold text-[#0b1c30]">{v.studentName}</p>
                            <p className="text-[10px] text-gray-500 font-medium">Kelas {v.studentClass}</p>
                          </td>
                          <td className="p-3.5">
                            <span className="text-[10px] bg-red-50 text-red-700 font-extrabold px-2 py-0.5 rounded mr-1">
                              {v.category}
                            </span>
                            <p className="font-semibold text-[#0b1c30] mt-0.5">{v.notes || v.category}</p>
                          </td>
                          <td className="p-3.5 text-center font-black text-red-600">{v.pointsAdded}</td>
                          <td className="p-3.5 font-medium text-gray-700">
                            {v.handlingProgress ? `${v.handledBy || 'Ditangani'}: ${v.handlingProgress}` : v.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {disiplinSection === 'restitusi' && (
            <div className="bg-white rounded-2xl shadow-2xs border border-[#bcc9c6]/40 overflow-hidden">
              <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center shrink-0">
                    <Gavel className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-[#0b1c30]">
                      Bimbingan Kasus &amp; Restitusi Perilaku
                    </h3>
                    <p className="text-xs text-[#3d4947] font-medium">
                      {unresolvedViolations.length > 0
                        ? `${unresolvedViolations.length} kasus perilaku menunggu tindak lanjut restoratif`
                        : 'Seluruh kasus perilaku pada periode ini telah ditindaklanjuti.'}
                    </p>
                  </div>
                </div>

                {onNavigateToTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateToTab('pembinaan-pendisiplinan')}
                    className="px-3.5 py-2 bg-[#f8faf9] hover:bg-[#e6f4f1] text-[#00685f] border border-[#bcc9c6]/40 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 self-start md:self-center shrink-0"
                  >
                    <span>Buka Buku Kasus</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="p-4 sm:p-5 space-y-4 bg-[#fcfdfd]">
                <div className="flex bg-[#f4f7f6] p-1 rounded-xl border border-[#bcc9c6]/30 w-fit">
                  <button
                    type="button"
                    onClick={() => {
                      setUnresolvedTab('violation');
                      setHandlingViolationId(null);
                      setHandlingServiceId(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      unresolvedTab === 'violation'
                        ? 'bg-white text-rose-700 shadow-2xs font-extrabold'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Restitusi Perilaku ({unresolvedViolations.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUnresolvedTab('service');
                      setHandlingViolationId(null);
                      setHandlingServiceId(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      unresolvedTab === 'service'
                        ? 'bg-white text-[#00685f] shadow-2xs font-extrabold'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Layanan Terjadwal ({unresolvedServices.length})
                  </button>
                </div>

                {unresolvedTab === 'violation' ? (
                  unresolvedViolations.length === 0 ? (
                    <div className="py-8 text-center bg-emerald-50/20 rounded-xl border border-dashed border-emerald-200">
                      <Check className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                      <p className="text-xs font-extrabold text-emerald-950">Seluruh Kasus Perilaku Telah Direstitusi</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {unresolvedViolations.slice(0, 6).map((v) => {
                        const isExpanding = handlingViolationId === v.id;
                        return (
                          <div
                            key={v.id}
                            className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                              isExpanding ? 'border-rose-400 bg-rose-50/15' : 'border-rose-100 bg-white'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex justify-between items-start gap-3">
                                <span className="text-[10px] font-extrabold bg-rose-100/70 text-rose-700 px-2 py-0.5 rounded-md uppercase">
                                  {v.category}
                                </span>
                                <span className="text-xs font-extrabold text-rose-600 tabular-nums">
                                  Bobot: {v.pointsAdded}
                                </span>
                              </div>
                              <div>
                                <h4
                                  onClick={() => onNavigateToTab?.('data-siswa', v.studentName)}
                                  className="font-extrabold text-xs text-[#0b1c30] hover:underline cursor-pointer"
                                >
                                  {v.studentName} ({v.studentClass || '-'})
                                </h4>
                                <p className="text-[11px] text-[#3d4947]/70 font-semibold mt-0.5">
                                  {formatCardDateTime(v.date, v.time)}
                                </p>
                              </div>
                              <p className="bg-[#f8faf9] p-2.5 rounded-lg border border-gray-100 text-xs text-gray-600 italic">
                                &ldquo;{v.notes || 'Tidak ada catatan detail.'}&rdquo;
                              </p>
                            </div>

                            <div className="mt-3 pt-3 border-t border-gray-100">
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
                                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>Tindak Lanjuti</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToTab?.('data-siswa', v.studentName)}
                                    className="py-2 px-3 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
                                    title="Lihat Profil Siswa"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-2.5">
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {(['Guru BK', 'Wali Kelas', 'Wali Kelas & Guru BK'] as const).map((role) => (
                                      <button
                                        key={role}
                                        type="button"
                                        onClick={() => setHandlingHandledBy(role)}
                                        className={`py-1 px-1.5 rounded-lg text-[10px] font-extrabold border ${
                                          handlingHandledBy === role
                                            ? 'bg-rose-50 border-rose-300 text-rose-700'
                                            : 'bg-white border-gray-200 text-gray-500'
                                        }`}
                                      >
                                        {role}
                                      </button>
                                    ))}
                                  </div>
                                  <textarea
                                    value={handlingProgress}
                                    onChange={(e) => setHandlingProgress(e.target.value)}
                                    placeholder="Tuliskan tindakan pembinaan atau kesepakatan perbaikan..."
                                    className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-400 bg-white"
                                    rows={2}
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!handlingProgress.trim()) {
                                          showToast('Harap isi progres penanganan terlebih dahulu.', 'error');
                                          return;
                                        }
                                        if (onUpdateViolationStatus) {
                                          onUpdateViolationStatus(v.id, handlingHandledBy, handlingProgress);
                                          setHandlingViolationId(null);
                                        }
                                      }}
                                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl cursor-pointer"
                                    >
                                      Simpan &amp; Selesaikan
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setHandlingViolationId(null)}
                                      className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-extrabold rounded-xl cursor-pointer"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : unresolvedServices.length === 0 ? (
                  <div className="py-8 text-center bg-teal-50/20 rounded-xl border border-dashed border-teal-200">
                    <Check className="w-8 h-8 text-teal-600 mx-auto mb-1.5" />
                    <p className="text-xs font-extrabold text-teal-950">Tidak Ada Layanan Terjadwal Pending</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {unresolvedServices.slice(0, 6).map((srv) => {
                      const isExpanding = handlingServiceId === srv.id;
                      return (
                        <div
                          key={srv.id}
                          className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                            isExpanding ? 'border-[#00685f] bg-[#e6f4f1]/30' : 'border-[#bcc9c6]/30 bg-white'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex justify-between items-start gap-3">
                              <span className="text-[10px] font-extrabold bg-[#e6f4f1] text-[#00685f] px-2 py-0.5 rounded-md uppercase">
                                {srv.serviceType}
                              </span>
                              <span className="text-[11px] font-extrabold text-amber-700">Terjadwal</span>
                            </div>
                            <div>
                              <h4
                                onClick={() => srv.students?.[0] && onNavigateToTab?.('data-siswa', srv.students[0].name)}
                                className="font-extrabold text-xs text-[#0b1c30] hover:underline cursor-pointer"
                              >
                                {srv.students?.map((s) => `${s.name} (${s.class})`).join(', ') || '-'}
                              </h4>
                              <p className="text-[11px] text-[#3d4947]/70 font-semibold mt-0.5">
                                {formatCardDateTime(srv.date, srv.startTime)}
                              </p>
                            </div>
                            <p className="bg-[#f8faf9] p-2.5 rounded-lg border border-gray-100 text-xs text-gray-600">
                              <span className="font-bold text-[#0b1c30]">Fokus: </span>
                              {srv.problem || 'Konseling umum'}
                            </p>
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-100">
                            {!isExpanding ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setHandlingServiceId(srv.id);
                                  setHandlingServiceFollowUp('');
                                  setHandlingViolationId(null);
                                }}
                                className="w-full py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <HeartHandshake className="w-3.5 h-3.5" />
                                <span>Selesaikan Sesi</span>
                              </button>
                            ) : (
                              <div className="space-y-2.5">
                                <textarea
                                  value={handlingServiceFollowUp}
                                  onChange={(e) => setHandlingServiceFollowUp(e.target.value)}
                                  placeholder="Tuliskan hasil sesi konseling dan rencana tindak lanjut..."
                                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00685f] bg-white"
                                  rows={2}
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onUpdateServiceStatus) {
                                        onUpdateServiceStatus(srv.id, 'Selesai', handlingServiceFollowUp);
                                        setHandlingServiceId(null);
                                      }
                                    }}
                                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl cursor-pointer"
                                  >
                                    Tandai Selesai
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setHandlingServiceId(null)}
                                    className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-extrabold rounded-xl cursor-pointer"
                                  >
                                    Batal
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {disiplinSection === 'home-visit' && (
            <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#0b1c30] flex items-center gap-2">
                    <Home className="w-4 h-4 text-[#00685f]" />
                    <span>Rekap Kunjungan Rumah (Home Visit) Periode {formattedDateRange}</span>
                  </h3>
                  <p className="text-xs text-[#3d4947] font-medium mt-0.5">
                    Rekapitulasi pelaksanaan kunjungan rumah dan kesepakatan orang tua/wali.
                  </p>
                </div>
                <span className="text-xs font-extrabold text-[#00685f] tabular-nums">
                  {periodHomeVisits.length} Kunjungan
                </span>
              </div>

              {periodHomeVisits.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <Home className="w-10 h-10 text-gray-400 mx-auto" />
                  <p className="font-bold text-sm text-[#0b1c30]">Belum Ada Agenda Kunjungan Rumah Pada Periode Ini</p>
                  <p className="text-xs text-[#3d4947]">Kunjungan rumah yang dicatat akan terangkum otomatis di sini.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f8faf9] border-b border-[#bcc9c6]/40 text-[#0b1c30] font-extrabold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3.5 text-center w-12">No</th>
                        <th className="p-3.5">No. Laporan</th>
                        <th className="p-3.5">Tanggal</th>
                        <th className="p-3.5">Nama Siswa &amp; Kelas</th>
                        <th className="p-3.5">Wali Ditemui</th>
                        <th className="p-3.5">Maksud / Pokok Masalah</th>
                        <th className="p-3.5">Kesepakatan RTL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 tabular-nums">
                      {periodHomeVisits.map((hv, idx) => (
                        <tr key={hv.id || idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3.5 text-center font-bold text-gray-500">{idx + 1}</td>
                          <td className="p-3.5 font-bold text-[#00685f] whitespace-nowrap">{hv.reportNumber || `HV-${idx + 1}`}</td>
                          <td className="p-3.5 font-bold text-[#0b1c30] whitespace-nowrap">
                            {formatTanggalIndonesia(hv.date || hv.visitDate)}
                          </td>
                          <td className="p-3.5">
                            <p className="font-bold text-[#0b1c30]">{hv.studentName}</p>
                            <p className="text-[10px] text-gray-500 font-medium">
                              Kelas {hv.studentClass} &bull; NIS: {hv.studentNis || '-'}
                            </p>
                          </td>
                          <td className="p-3.5 font-bold text-gray-800">{hv.parentNameMet || hv.parentName || 'Orang Tua / Wali'}</td>
                          <td className="p-3.5 max-w-xs">
                            <p className="font-bold text-[#0b1c30] line-clamp-2">{hv.purpose || hv.reason || '-'}</p>
                          </td>
                          <td className="p-3.5 max-w-xs">
                            <p className="font-medium text-gray-700 line-clamp-2">{hv.agreement || hv.result || '-'}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: REKAP SEMESTER */}
      {activeTab === 'rekap-semester' && (
        <RekapSemesterView
          services={activeServices}
          activeCounselor={activeCounselor}
          students={activeStudents}
          onBack={() => setActiveTab('ringkasan')}
        />
      )}

      {/* Modals */}
      {diagnosisStudentData && (
        <BehavioralDiagnosisModal
          studentName={diagnosisStudentData.name}
          studentClass={diagnosisStudentData.class}
          studentNis={diagnosisStudentData.nis}
          netPoints={diagnosisStudentData.netPoints}
          alpaCount={diagnosisStudentData.alpaCount}
          onClose={() => setDiagnosisStudentData(null)}
          onOpenEmailModal={(draftData) => setEmailModalData(draftData)}
        />
      )}

      {emailModalData && (
        <EmailNotificationModal
          studentName={emailModalData.studentName}
          studentClass={emailModalData.studentClass}
          studentNis={emailModalData.studentNis}
          netPoints={emailModalData.netPoints}
          alpaCount={emailModalData.alpaCount || 0}
          followUpPlan={emailModalData.followUpPlan}
          riskLevel={emailModalData.riskLevel}
          onClose={() => setEmailModalData(null)}
        />
      )}
    </div>
  );
}
