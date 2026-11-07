import React, { useState, useMemo } from 'react';
import { CounselingService, ViolationRecord, StudentAchievement, Student, ClassAttendanceRecord } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  HeartHandshake,
  AlertTriangle,
  Award,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  Layers,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Info,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Compass,
  Users,
  CheckCircle,
  BookOpen,
  PieChart as PieChartIcon,
  School,
  Target,
  Zap,
  AlertCircle
} from 'lucide-react';

export interface DashboardStatsViewProps {
  services: CounselingService[];
  violations: ViolationRecord[];
  achievements?: StudentAchievement[];
  students?: Student[];
  attendanceHistory?: ClassAttendanceRecord[];
  onNavigateToTab?: (tab: string, searchQuery?: string) => void;
  className?: string;
}

type TimeRangeOption = '6months' | 'year' | '3months';
type ActiveChartTab = 'all' | '4bidang' | 'counseling' | 'violations' | 'issues' | 'classes' | 'attendance';
type StatViewMode = 'month' | 'all';

const MONTH_NAMES_IND = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_SHORT_IND = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
];

// Helper to reliably extract YYYY-MM from date string
const extractYearMonth = (dateStr?: string): string => {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  if (/^\d{4}-\d{2}/.test(clean)) {
    return clean.slice(0, 7);
  }
  const parts = clean.split(/[-/]/);
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}`;
  }
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  }
  return '';
};

export default function DashboardStatsView({
  services = [],
  violations = [],
  achievements = [],
  students = [],
  attendanceHistory = [],
  onNavigateToTab,
  className = ''
}: DashboardStatsViewProps) {
  const [viewMode, setViewMode] = useState<StatViewMode>('month');
  const [showChart, setShowChart] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('6months');
  const [activeTab, setActiveTab] = useState<ActiveChartTab>('all');
  const [classViewScope, setClassViewScope] = useState<'grade' | 'class'>('grade');

  // Current and previous month definitions
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const currentMonthLabel = `${MONTH_NAMES_IND[currentMonth]} ${currentYear}`;

  const prevDate = new Date(currentYear, currentMonth - 1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthLabel = `${MONTH_NAMES_IND[prevDate.getMonth()]}`;

  // 1. SERVICES METRICS
  const servicesThisMonth = useMemo(() => {
    return services.filter((s) => extractYearMonth(s.date) === currentMonthKey);
  }, [services, currentMonthKey]);

  const servicesPrevMonth = useMemo(() => {
    return services.filter((s) => extractYearMonth(s.date) === prevMonthKey);
  }, [services, prevMonthKey]);

  const individualThisMonth = useMemo(() => {
    return servicesThisMonth.filter(
      (s) => s.targetType === 'Individu' || s.serviceType?.includes('Individual') || s.serviceType?.includes('Perorangan')
    ).length;
  }, [servicesThisMonth]);

  const groupThisMonth = useMemo(() => {
    return servicesThisMonth.filter(
      (s) => s.targetType === 'Kelompok' || s.serviceType?.includes('Kelompok')
    ).length;
  }, [servicesThisMonth]);

  const classicalThisMonth = useMemo(() => {
    return servicesThisMonth.filter(
      (s) => s.targetType === 'Klasikal' || s.serviceType?.includes('Klasikal') || s.serviceType?.includes('Orientasi') || s.serviceType?.includes('Informasi')
    ).length;
  }, [servicesThisMonth]);

  const completedServicesThisMonth = useMemo(() => {
    return servicesThisMonth.filter((s) => s.status === 'Selesai').length;
  }, [servicesThisMonth]);

  const servicesGrowth = servicesThisMonth.length - servicesPrevMonth.length;

  // 2. VIOLATIONS METRICS
  const violationsThisMonth = useMemo(() => {
    return violations.filter((v) => extractYearMonth(v.date) === currentMonthKey);
  }, [violations, currentMonthKey]);

  const violationsPrevMonth = useMemo(() => {
    return violations.filter((v) => extractYearMonth(v.date) === prevMonthKey);
  }, [violations, prevMonthKey]);

  const violationsWeightThisMonth = useMemo(() => {
    return violationsThisMonth.reduce((acc, curr) => acc + (curr.pointsAdded || 0), 0);
  }, [violationsThisMonth]);

  const violationsResolvedThisMonth = useMemo(() => {
    return violationsThisMonth.filter(
      (v) => v.handledBy && v.handledBy !== 'Belum Ditangani' && v.handlingProgress
    ).length;
  }, [violationsThisMonth]);

  const violationsPendingThisMonth = violationsThisMonth.length - violationsResolvedThisMonth;
  const violationsGrowth = violationsThisMonth.length - violationsPrevMonth.length;

  // Overall restitution & resolution figures
  const totalViolationsAll = violations.length;
  const allResolvedViolations = useMemo(() => {
    return violations.filter(
      (v) => v.handledBy && v.handledBy !== 'Belum Ditangani' && v.handlingProgress
    ).length;
  }, [violations]);

  const allPendingViolations = totalViolationsAll - allResolvedViolations;
  const restitutionRate = totalViolationsAll > 0
    ? Math.round((allResolvedViolations / totalViolationsAll) * 100)
    : 100;

  // 3. ACHIEVEMENTS METRICS
  const achievementsThisMonth = useMemo(() => {
    return achievements.filter((a) => extractYearMonth(a.date) === currentMonthKey);
  }, [achievements, currentMonthKey]);

  const achievementsPrevMonth = useMemo(() => {
    return achievements.filter((a) => extractYearMonth(a.date) === prevMonthKey);
  }, [achievements, prevMonthKey]);

  const achievementsRewardThisMonth = useMemo(() => {
    return achievementsThisMonth.reduce((acc, curr) => acc + (curr.pointsReward || 0), 0);
  }, [achievementsThisMonth]);

  // 4. POP BK 4 BIDANG BIMBINGAN METRICS (Pribadi, Sosial, Belajar, Karir)
  const bidangDistribution = useMemo(() => {
    const scopeServices = viewMode === 'month' ? servicesThisMonth : services;
    let pribadi = 0;
    let sosial = 0;
    let belajar = 0;
    let karir = 0;

    scopeServices.forEach((s) => {
      const b = (s.bidangBimbingan || s.specificDetails?.bidangBimbingan || '').toLowerCase();
      const p = (s.problem || '').toLowerCase();
      if (b.includes('karir') || p.includes('karir') || p.includes('kuliah') || p.includes('smk') || p.includes('cita') || p.includes('jurusan')) {
        karir++;
      } else if (b.includes('sosial') || p.includes('sosial') || p.includes('teman') || p.includes('bully') || p.includes('pergaulan') || p.includes('konflik')) {
        sosial++;
      } else if (b.includes('belajar') || p.includes('belajar') || p.includes('nilai') || p.includes('tugas') || p.includes('ujian') || p.includes('malas')) {
        belajar++;
      } else {
        pribadi++;
      }
    });

    const total = pribadi + sosial + belajar + karir || 1;
    return [
      { name: 'Bidang Pribadi', key: 'pribadi', count: pribadi, percent: Math.round((pribadi / total) * 100), color: '#00685f', desc: 'Pemahaman emosi, regulasi diri & karakter mandiri' },
      { name: 'Bidang Sosial', key: 'sosial', count: sosial, percent: Math.round((sosial / total) * 100), color: '#0284c7', desc: 'Empati, adaptasi pergaulan & resolusi konflik' },
      { name: 'Bidang Belajar', key: 'belajar', count: belajar, percent: Math.round((belajar / total) * 100), color: '#d97706', desc: 'Motivasi belajar, manajemen waktu & hasil akademik' },
      { name: 'Bidang Karir', key: 'karir', count: karir, percent: Math.round((karir / total) * 100), color: '#7c3aed', desc: 'Peminatan bakat, studi lanjut & cita-cita masa depan' }
    ];
  }, [services, servicesThisMonth, viewMode]);

  const dominantBidang = useMemo(() => {
    return [...bidangDistribution].sort((a, b) => b.count - a.count)[0];
  }, [bidangDistribution]);

  // 5. ATTENDANCE METRICS
  const attendanceMetrics = useMemo(() => {
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alpa = 0;

    (attendanceHistory || []).forEach((rec: any) => {
      if (Array.isArray(rec.records)) {
        rec.records.forEach((s: any) => {
          if (s.status === 'Hadir') hadir++;
          else if (s.status === 'Sakit') sakit++;
          else if (s.status === 'Izin') izin++;
          else if (s.status === 'Alpa') alpa++;
        });
      }
    });

    const total = hadir + sakit + izin + alpa || 1;
    const rate = Math.round((hadir / total) * 100);

    return {
      hadir,
      sakit,
      izin,
      alpa,
      total,
      rate
    };
  }, [attendanceHistory]);

  // 6. TOP ISSUES & DISCIPLINE CATEGORY DISTRIBUTION (PARETO / DONUT)
  const issuesDistribution = useMemo(() => {
    const scopeViolations = viewMode === 'month' ? violationsThisMonth : violations;
    const catMap: Record<string, { count: number; points: number; resolved: number; key: string; name: string; color: string; restitutionTip: string }> = {
      kedisiplinan: {
        key: 'kedisiplinan',
        name: 'Kedisiplinan & Waktu',
        count: 0,
        points: 0,
        resolved: 0,
        color: '#e11d48',
        restitutionTip: 'Diskusi manajemen waktu, jadwal tidur, dan komitmen bangun pagi mandiri.'
      },
      seragam: {
        key: 'seragam',
        name: 'Atribut & Seragam',
        count: 0,
        points: 0,
        resolved: 0,
        color: '#f59e0b',
        restitutionTip: 'Menata perlengkapan seragam H-1 malam dan refleksi kesepakatan kerapian.'
      },
      sosial: {
        key: 'sosial',
        name: 'Relasi Sosial & Pertemanan',
        count: 0,
        points: 0,
        resolved: 0,
        color: '#0284c7',
        restitutionTip: 'Mediasi saling memaafkan, latihan empati sudut pandang korban, dan ikrar damai.'
      },
      akademik: {
        key: 'akademik',
        name: 'Akademik & Tugas Kelas',
        count: 0,
        points: 0,
        resolved: 0,
        color: '#d97706',
        restitutionTip: 'Bimbingan teknik belajar efektif, pembuatan jadwal PR, dan bimbingan teman sebaya.'
      },
      gadget: {
        key: 'gadget',
        name: 'Penggunaan Gadget / HP',
        count: 0,
        points: 0,
        resolved: 0,
        color: '#7c3aed',
        restitutionTip: 'Kontrak pembatasan screen time dan kesepakatan penitipan HP di loker kelas.'
      },
      etika: {
        key: 'etika',
        name: 'Etika & Sopan Santun',
        count: 0,
        points: 0,
        resolved: 0,
        color: '#00685f',
        restitutionTip: 'Eksplorasi nilai hormat pada guru/teman, permohonan maaf tulus, dan aksi perbaikan perilaku.'
      },
      lainnya: {
        key: 'lainnya',
        name: 'Kasus Khusus / Lainnya',
        count: 0,
        points: 0,
        resolved: 0,
        color: '#64748b',
        restitutionTip: 'Pendekatan personal, wawancara mendalam, atau konferensi kasus bersama orang tua.'
      }
    };

    scopeViolations.forEach((v) => {
      const type = (v.category || '').toLowerCase();
      const desc = (v.notes || '').toLowerCase();
      const combined = `${type} ${desc}`;
      const isResolved = Boolean(v.handledBy && v.handledBy !== 'Belum Ditangani' && v.handlingProgress);
      const pts = v.pointsAdded || 0;

      let targetKey = 'lainnya';
      if (combined.includes('terlambat') || combined.includes('bolos') || combined.includes('waktu') || combined.includes('upacara') || combined.includes('izin')) {
        targetKey = 'kedisiplinan';
      } else if (combined.includes('seragam') || combined.includes('sepatu') || combined.includes('rambut') || combined.includes('atribut') || combined.includes('kaos kaki')) {
        targetKey = 'seragam';
      } else if (combined.includes('berkelahi') || combined.includes('ejek') || combined.includes('bully') || combined.includes('teman') || combined.includes('konflik')) {
        targetKey = 'sosial';
      } else if (combined.includes('tugas') || combined.includes('buku') || combined.includes('tidur') || combined.includes('malas') || combined.includes('pr')) {
        targetKey = 'akademik';
      } else if (combined.includes('hp') || combined.includes('gadget') || combined.includes('game') || combined.includes('ponsel') || combined.includes('medsos')) {
        targetKey = 'gadget';
      } else if (combined.includes('sopan') || combined.includes('kasar') || combined.includes('etika') || combined.includes('melawan') || combined.includes('bicara')) {
        targetKey = 'etika';
      }

      catMap[targetKey].count++;
      catMap[targetKey].points += pts;
      if (isResolved) catMap[targetKey].resolved++;
    });

    const totalCount = Object.values(catMap).reduce((acc, curr) => acc + curr.count, 0) || 1;
    return Object.values(catMap)
      .map((item) => ({
        ...item,
        percent: Math.round((item.count / totalCount) * 100),
        restitutionRate: item.count > 0 ? Math.round((item.resolved / item.count) * 100) : 100
      }))
      .sort((a, b) => b.count - a.count);
  }, [violations, violationsThisMonth, viewMode]);

  // 7. CLASS & GRADE LOAD ANALYTICS
  const classAnalytics = useMemo(() => {
    const isDisallowed = (c: string) => /^(10|11|12|X|XI|XII)/i.test(String(c).replace(/kelas\s*/i, '').trim());
    const classSet = new Set<string>();
    students.forEach((s) => { if (s.class && !isDisallowed(s.class)) classSet.add(s.class); });
    services.forEach((s) => {
      if (Array.isArray(s.students)) {
        s.students.forEach((st) => { if (st.class && !isDisallowed(st.class)) classSet.add(st.class); });
      }
    });
    violations.forEach((v) => { if (v.studentClass && !isDisallowed(v.studentClass)) classSet.add(v.studentClass); });

    let classList = Array.from(classSet).filter(Boolean).sort();
    if (classList.length === 0) {
      classList = ['8A', '8B', '8C', '8D', '8E', '8F', '8G'];
    }

    const scopeServices = viewMode === 'month' ? servicesThisMonth : services;
    const scopeViolations = viewMode === 'month' ? violationsThisMonth : violations;
    const scopeAchievements = viewMode === 'month' ? achievementsThisMonth : achievements;

    // Per Class item
    const byClass = classList.map((cls) => {
      const clsNormalized = cls.toLowerCase().replace(/[^a-z0-9]/g, '');
      const clsServices = scopeServices.filter((s) =>
        Array.isArray(s.students) && s.students.some((st) => (st.class || '').toLowerCase().replace(/[^a-z0-9]/g, '') === clsNormalized)
      ).length;
      const clsViolations = scopeViolations.filter((v) => (v.studentClass || '').toLowerCase().replace(/[^a-z0-9]/g, '') === clsNormalized).length;
      const clsAchievements = scopeAchievements.filter((a) => (a.studentClass || '').toLowerCase().replace(/[^a-z0-9]/g, '') === clsNormalized).length;
      const studentCount = students.filter((s) => (s.class || '').toLowerCase().replace(/[^a-z0-9]/g, '') === clsNormalized).length;

      return {
        className: cls,
        counseling: clsServices,
        violations: clsViolations,
        achievements: clsAchievements,
        students: studentCount || 32,
        positivityRatio: clsViolations > 0 ? Number((clsAchievements / clsViolations).toFixed(1)) : clsAchievements > 0 ? 3.0 : 1.0
      };
    });

    // Per Grade grouping (Kelas 7, 8, 9)
    const gradeMap: Record<string, { className: string; grade: string; counseling: number; violations: number; achievements: number; students: number; positivityRatio: number }> = {};

    byClass.forEach((c) => {
      let g = '';
      if (c.className.startsWith('7') || c.className.toLowerCase().includes('7')) g = 'Kelas 7';
      else if (c.className.startsWith('8') || c.className.toLowerCase().includes('8')) g = 'Kelas 8';
      else if (c.className.startsWith('9') || c.className.toLowerCase().includes('9')) g = 'Kelas 9';
      if (!g) return;

      if (!gradeMap[g]) {
        gradeMap[g] = { className: g, grade: g, counseling: 0, violations: 0, achievements: 0, students: 0, positivityRatio: 1.0 };
      }
      gradeMap[g].counseling += c.counseling;
      gradeMap[g].violations += c.violations;
      gradeMap[g].achievements += c.achievements;
      gradeMap[g].students += c.students;
    });

    const byGrade = Object.values(gradeMap)
      .filter((gm) => gm.students > 0 || gm.counseling > 0 || gm.violations > 0 || gm.achievements > 0)
      .map((gm) => ({
        ...gm,
        positivityRatio: gm.violations > 0 ? Number((gm.achievements / gm.violations).toFixed(1)) : gm.achievements > 0 ? 3.0 : 1.0
      }));

    // Leaderboards / Highlights
    const mostActiveCounselingClass = [...byClass].sort((a, b) => b.counseling - a.counseling)[0] || byClass[0];
    const mostDisciplinedClass = [...byClass].sort((a, b) => a.violations - b.violations)[0] || byClass[0];
    const highestAchievementClass = [...byClass].sort((a, b) => b.achievements - a.achievements)[0] || byClass[0];

    return {
      byClass,
      byGrade,
      mostActiveCounselingClass,
      mostDisciplinedClass,
      highestAchievementClass
    };
  }, [students, services, violations, achievements, servicesThisMonth, violationsThisMonth, achievementsThisMonth, viewMode]);

  // 8. ATTENDANCE TREND TIME-SERIES & PIE
  const attendancePieData = useMemo(() => {
    return [
      { name: 'Hadir', value: attendanceMetrics.hadir || 1, color: '#10b981' },
      { name: 'Sakit', value: attendanceMetrics.sakit, color: '#f59e0b' },
      { name: 'Izin', value: attendanceMetrics.izin, color: '#3b82f6' },
      { name: 'Alpa', value: attendanceMetrics.alpa, color: '#ef4444' }
    ].filter((item) => item.value > 0);
  }, [attendanceMetrics]);

  const attendanceTrendData = useMemo(() => {
    if (!attendanceHistory || attendanceHistory.length === 0) {
      return [
        { label: 'Senin', hadir: 96, sakit: 2, izin: 1, alpa: 1, rate: 96 },
        { label: 'Selasa', hadir: 98, sakit: 1, izin: 1, alpa: 0, rate: 98 },
        { label: 'Rabu', hadir: 95, sakit: 3, izin: 1, alpa: 1, rate: 95 },
        { label: 'Kamis', hadir: 97, sakit: 2, izin: 1, alpa: 0, rate: 97 },
        { label: 'Jumat', hadir: 99, sakit: 1, izin: 0, alpa: 0, rate: 99 }
      ];
    }

    const dateMap: Record<string, { label: string; hadir: number; sakit: number; izin: number; alpa: number; total: number }> = {};

    attendanceHistory.slice(-10).forEach((rec: any) => {
      const dt = String(rec.date || '').slice(5, 10) || 'Hari';
      if (!dateMap[dt]) {
        dateMap[dt] = { label: dt, hadir: 0, sakit: 0, izin: 0, alpa: 0, total: 0 };
      }
      if (Array.isArray(rec.records)) {
        rec.records.forEach((s: any) => {
          dateMap[dt].total++;
          if (s.status === 'Hadir') dateMap[dt].hadir++;
          else if (s.status === 'Sakit') dateMap[dt].sakit++;
          else if (s.status === 'Izin') dateMap[dt].izin++;
          else if (s.status === 'Alpa') dateMap[dt].alpa++;
        });
      }
    });

    const entries = Object.values(dateMap);
    if (entries.length === 0) return [];
    return entries.map((e) => {
      const rate = e.total > 0 ? Math.round((e.hadir / e.total) * 100) : 100;
      return {
        ...e,
        rate
      };
    });
  }, [attendanceHistory]);

  // 9. INDEKS IKLIM POSITIF & KARAKTER SEKOLAH (HEALTH SCORE)
  const positiveHealthScore = useMemo(() => {
    const restScore = Math.min(100, restitutionRate);
    const totalViol = violations.length || 1;
    const totalAch = achievements.length;
    const ratioScore = Math.min(100, Math.round((totalAch / totalViol) * 60) + 40);
    const attScore = attendanceMetrics.rate || 95;

    const overallScore = Math.round(restScore * 0.4 + ratioScore * 0.3 + attScore * 0.3);

    return {
      overallScore: Math.max(10, Math.min(100, overallScore)),
      level: overallScore >= 85 ? 'Sangat Positif & Kondusif' : overallScore >= 70 ? 'Baik & Bertumbuh' : 'Perlu Pendampingan',
      statusColor: overallScore >= 85 ? 'text-emerald-700 bg-emerald-50 border-emerald-300' : overallScore >= 70 ? 'text-teal-700 bg-teal-50 border-teal-300' : 'text-amber-800 bg-amber-50 border-amber-300'
    };
  }, [restitutionRate, violations.length, achievements.length, attendanceMetrics.rate]);

  // Generate monthly time-series dataset for charts
  const chartData = useMemo(() => {
    let monthCount = 6;
    if (timeRange === '3months') monthCount = 3;
    if (timeRange === 'year') monthCount = 12;

    const monthsList: { year: number; month: number; label: string; key: string }[] = [];

    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      const monthLabel = `${MONTH_SHORT_IND[m]} ${y !== currentYear ? `'${String(y).slice(-2)}` : ''}`;

      monthsList.push({
        year: y,
        month: m,
        label: monthLabel,
        key: monthKey
      });
    }

    return monthsList.map(({ label, key }) => {
      const monthServices = services.filter((s) => extractYearMonth(s.date) === key);
      const counselingCount = monthServices.length;

      const individualCount = monthServices.filter(
        (s) => s.targetType === 'Individu' || s.serviceType?.includes('Individual') || s.serviceType?.includes('Perorangan')
      ).length;
      const groupCount = monthServices.filter(
        (s) => s.targetType === 'Kelompok' || s.serviceType?.includes('Kelompok')
      ).length;
      const classicalCount = monthServices.filter(
        (s) => s.targetType === 'Klasikal' || s.serviceType?.includes('Klasikal') || s.serviceType?.includes('Orientasi') || s.serviceType?.includes('Informasi')
      ).length;

      let monthPribadi = 0;
      let monthSosial = 0;
      let monthBelajar = 0;
      let monthKarir = 0;
      monthServices.forEach((s) => {
        const b = (s.bidangBimbingan || s.specificDetails?.bidangBimbingan || '').toLowerCase();
        const p = (s.problem || '').toLowerCase();
        if (b.includes('karir') || p.includes('karir') || p.includes('kuliah') || p.includes('smk') || p.includes('cita')) {
          monthKarir++;
        } else if (b.includes('sosial') || p.includes('sosial') || p.includes('teman') || p.includes('bully') || p.includes('pergaulan')) {
          monthSosial++;
        } else if (b.includes('belajar') || p.includes('belajar') || p.includes('nilai') || p.includes('tugas') || p.includes('ujian')) {
          monthBelajar++;
        } else {
          monthPribadi++;
        }
      });

      const monthViolations = violations.filter((v) => extractYearMonth(v.date) === key);
      const violationCount = monthViolations.length;
      const violationWeight = monthViolations.reduce((acc, curr) => acc + (curr.pointsAdded || 0), 0);
      const violationResolved = monthViolations.filter((v) => v.handledBy && v.handledBy !== 'Belum Ditangani' && v.handlingProgress).length;

      const monthAchievements = achievements.filter((a) => extractYearMonth(a.date) === key);
      const achievementCount = monthAchievements.length;
      const achievementReward = monthAchievements.reduce((acc, curr) => acc + (curr.pointsReward || 0), 0);

      return {
        key,
        month: label,
        counseling: counselingCount,
        individualCounseling: individualCount,
        groupCounseling: groupCount,
        classicalCounseling: classicalCount,
        pribadi: monthPribadi,
        sosial: monthSosial,
        belajar: monthBelajar,
        karir: monthKarir,
        violations: violationCount,
        violationWeight,
        violationResolved,
        achievements: achievementCount,
        achievementReward,
        balanceNet: achievementCount - violationCount
      };
    });
  }, [services, violations, achievements, timeRange, currentYear, currentMonth]);

  // Custom Recharts Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0b1c30] text-white p-3 rounded-xl shadow-xl border border-white/10 text-xs backdrop-blur-md max-w-xs z-50">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10">
            <span className="font-extrabold text-[#e6f4f1] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#00685f]" />
              {label}
            </span>
          </div>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={`tooltip-item-${index}`} className="flex items-center justify-between gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-gray-300 font-medium">{entry.name}:</span>
                </div>
                <span className="font-black text-white">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Pie / Donut Tooltip Component
  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-[#0b1c30] text-white p-3 rounded-xl shadow-xl border border-white/10 text-xs backdrop-blur-md max-w-xs z-50">
          <div className="flex items-center gap-2 pb-1.5 mb-1.5 border-b border-white/10">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.payload?.color || data.color }} />
            <span className="font-extrabold text-white text-[12px]">{data.name}</span>
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-300">Jumlah:</span>
              <span className="font-black text-emerald-400">{data.value} {data.unit || 'Data'}</span>
            </div>
            {data.payload?.percent !== undefined && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-300">Persentase:</span>
                <span className="font-black text-teal-300">{data.payload.percent}%</span>
              </div>
            )}
            {data.payload?.restitutionRate !== undefined && (
              <div className="flex items-center justify-between gap-3 pt-0.5 border-t border-white/10">
                <span className="text-gray-300">Tuntas Restitusi:</span>
                <span className="font-black text-emerald-300">{data.payload.restitutionRate}%</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 🧭 HEADER: Clean Scope Switcher & Summary Info */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#bcc9c6]/30 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-[#00685f]/10 text-[#00685f] text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <BarChart3 className="w-3 h-3 text-[#00685f]" />
              Ringkasan Kinerja BK
            </span>
            <span className="text-[11px] text-[#3d4947]/70 font-semibold">
              Update Real-Time
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-[#0b1c30] tracking-tight">
            Statistik Utama Bimbingan & Konseling
          </h2>
          <p className="text-xs text-[#3d4947]/80 font-medium mt-0.5">
            Menampilkan ringkasan sesi konseling, kedisiplinan siswa, dan tingkat penanganan restitusi.
          </p>
        </div>

        {/* View Mode Toggle: Bulan Ini vs Semua Data */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <div className="bg-[#f4f7f6] p-1 rounded-xl border border-[#bcc9c6]/30 flex items-center shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'month'
                  ? 'bg-white text-[#00685f] shadow-2xs font-extrabold border border-gray-200/60'
                  : 'text-[#3d4947] hover:text-[#0b1c30]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-[#00685f]" />
              <span>Bulan Ini ({MONTH_SHORT_IND[currentMonth]})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'all'
                  ? 'bg-white text-[#00685f] shadow-2xs font-extrabold border border-gray-200/60'
                  : 'text-[#3d4947] hover:text-[#0b1c30]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#00685f]" />
              <span>Semua Data (Total)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 📊 FOUR CLEAN, INFORMATIVE SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KARTU 1: SESI LAYANAN BK */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => onNavigateToTab?.('layanan-bk')}
          className="bg-white p-5 rounded-2xl border border-[#bcc9c6]/35 shadow-2xs hover:shadow-xs hover:border-[#00685f]/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            {/* Top Row: Icon + Title + Trend */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#e6f4f1] text-[#00685f] flex items-center justify-center border border-[#00685f]/20 shrink-0">
                  <HeartHandshake className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                    Sesi Layanan BK
                  </h3>
                  <span className="text-[11px] text-[#3d4947]/70 font-semibold block leading-none mt-0.5">
                    {viewMode === 'month' ? currentMonthLabel : 'Tahun Ajaran Aktif'}
                  </span>
                </div>
              </div>

              {/* Trend Badge */}
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                  servicesGrowth >= 0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                }`}
                title={`Dibandingkan dengan ${prevMonthLabel}`}
              >
                {servicesGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {servicesGrowth > 0 ? `+${servicesGrowth} vs bln lalu` : servicesGrowth < 0 ? `${servicesGrowth} vs bln lalu` : 'Stabil'}
              </span>
            </div>

            {/* Main Metric Hero */}
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-[#0b1c30] tracking-tight">
                {viewMode === 'month' ? servicesThisMonth.length : services.length}
              </span>
              <span className="text-xs font-bold text-[#3d4947]/80">
                {viewMode === 'month' ? 'Sesi Bulan Ini' : 'Total Sesi Terdata'}
              </span>
            </div>

            {/* Informative Breakdown Chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-teal-50 text-[#00685f] border border-teal-200/50">
                Individu: {viewMode === 'month' ? individualThisMonth : services.filter(s => s.targetType === 'Individu' || s.serviceType?.includes('Individual') || s.serviceType?.includes('Perorangan')).length}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                Kelompok: {viewMode === 'month' ? groupThisMonth : services.filter(s => s.targetType === 'Kelompok' || s.serviceType?.includes('Kelompok')).length}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-[#3d4947] border border-gray-200/60">
                Klasikal: {viewMode === 'month' ? classicalThisMonth : services.filter(s => s.targetType === 'Klasikal' || s.serviceType?.includes('Klasikal') || s.serviceType?.includes('Orientasi')).length}
              </span>
            </div>

            <p className="text-[11px] text-[#3d4947]/70 font-medium mt-2.5">
              {viewMode === 'month'
                ? `Total akumulasi: ${services.length} sesi terdata`
                : `Bulan ini (${MONTH_SHORT_IND[currentMonth]}): ${servicesThisMonth.length} sesi`}
            </p>
          </div>

          {/* Action Footer */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-extrabold text-[#00685f]">
            <span className="group-hover:underline">Buka Rekap Layanan BK</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </motion.div>

        {/* KARTU 2: PELANGGARAN DISIPLIN */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => onNavigateToTab?.('pelanggaran')}
          className="bg-white p-5 rounded-2xl border border-[#bcc9c6]/35 shadow-2xs hover:shadow-xs hover:border-rose-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            {/* Top Row: Icon + Title + Trend */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200/60 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                    Pelanggaran Disiplin
                  </h3>
                  <span className="text-[11px] text-[#3d4947]/70 font-semibold block leading-none mt-0.5">
                    {viewMode === 'month' ? currentMonthLabel : 'Tahun Ajaran Aktif'}
                  </span>
                </div>
              </div>

              {/* Trend Badge */}
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                  violationsGrowth <= 0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                }`}
                title={`Dibandingkan dengan ${prevMonthLabel}`}
              >
                {violationsGrowth > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {violationsGrowth > 0 ? `+${violationsGrowth} vs bln lalu` : violationsGrowth < 0 ? `${violationsGrowth} vs bln lalu` : 'Stabil'}
              </span>
            </div>

            {/* Main Metric Hero */}
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-[#0b1c30] tracking-tight">
                {viewMode === 'month' ? violationsThisMonth.length : violations.length}
              </span>
              <span className="text-xs font-bold text-[#3d4947]/80">
                {viewMode === 'month' ? 'Kasus Bulan Ini' : 'Total Kasus Terdata'}
              </span>
            </div>

            {/* Informative Breakdown Chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/50">
                Bobot: {viewMode === 'month' ? violationsWeightThisMonth : violations.reduce((a,c) => a + (c.pointsAdded || 0), 0)} Poin
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                {viewMode === 'month' ? `${violationsResolvedThisMonth} Direstitusi` : `${allResolvedViolations} Tuntas`}
              </span>
              {(viewMode === 'month' ? violationsPendingThisMonth : allPendingViolations) > 0 ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/50">
                  {viewMode === 'month' ? `${violationsPendingThisMonth} Perlu Penanganan` : `${allPendingViolations} Pending`}
                </span>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                  Nihil Pending
                </span>
              )}
            </div>

            <p className="text-[11px] text-[#3d4947]/70 font-medium mt-2.5">
              {viewMode === 'month'
                ? `Total akumulasi: ${violations.length} kasus terdata`
                : `Bulan ini (${MONTH_SHORT_IND[currentMonth]}): ${violationsThisMonth.length} kasus`}
            </p>
          </div>

          {/* Action Footer */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-extrabold text-rose-700">
            <span className="group-hover:underline">Buka Catatan Pelanggaran</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </motion.div>

        {/* KARTU 3: APRESIASI & PRESTASI */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => onNavigateToTab?.('apresiasi')}
          className="bg-white p-5 rounded-2xl border border-[#bcc9c6]/35 shadow-2xs hover:shadow-xs hover:border-purple-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            {/* Top Row: Icon + Title + Badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200/60 shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                    Apresiasi & Prestasi
                  </h3>
                  <span className="text-[11px] text-[#3d4947]/70 font-semibold block leading-none mt-0.5">
                    {viewMode === 'month' ? currentMonthLabel : 'Tahun Ajaran Aktif'}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center gap-1 shrink-0">
                <Sparkles className="w-3 h-3 text-purple-600" />
                Kredit Karakter
              </span>
            </div>

            {/* Main Metric Hero */}
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-[#0b1c30] tracking-tight">
                {viewMode === 'month' ? achievementsThisMonth.length : achievements.length}
              </span>
              <span className="text-xs font-bold text-[#3d4947]/80">
                {viewMode === 'month' ? 'Prestasi Bulan Ini' : 'Total Catatan Apresiasi'}
              </span>
            </div>

            {/* Informative Breakdown Chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/50">
                Reward: +{viewMode === 'month' ? achievementsRewardThisMonth : achievements.reduce((a,c) => a + (c.pointsReward || 0), 0)} Poin
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                Perilaku Positif
              </span>
            </div>

            <p className="text-[11px] text-[#3d4947]/70 font-medium mt-2.5">
              {viewMode === 'month'
                ? `Total akumulasi: ${achievements.length} prestasi siswa`
                : `Bulan ini (${MONTH_SHORT_IND[currentMonth]}): ${achievementsThisMonth.length} apresiasi`}
            </p>
          </div>

          {/* Action Footer */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-extrabold text-purple-700">
            <span className="group-hover:underline">Lihat Prestasi Siswa</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </motion.div>

        {/* KARTU 4: TINGKAT RESTITUSI & KASUS TUNTAS */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => onNavigateToTab?.('pembinaan-pendisiplinan')}
          className="bg-white p-5 rounded-2xl border border-[#bcc9c6]/35 shadow-2xs hover:shadow-xs hover:border-emerald-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            {/* Top Row: Icon + Title + Status */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                    Tingkat Restitusi
                  </h3>
                  <span className="text-[11px] text-[#3d4947]/70 font-semibold block leading-none mt-0.5">
                    Penyelesaian Kasus
                  </span>
                </div>
              </div>

              {/* Health Indicator Badge */}
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                  restitutionRate >= 80
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : restitutionRate >= 50
                    ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                    : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                }`}
              >
                {restitutionRate >= 80 ? 'Optimal' : restitutionRate >= 50 ? 'Berjalan' : 'Perlu Atensi'}
              </span>
            </div>

            {/* Main Metric Hero */}
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-[#0b1c30] tracking-tight">
                {restitutionRate}%
              </span>
              <span className="text-xs font-bold text-[#3d4947]/80">
                Kasus Tuntas Direstitusi
              </span>
            </div>

            {/* Mini Visual Progress Bar */}
            <div className="mt-2.5 w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200/50">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(restitutionRate, 5))}%` }}
              />
            </div>

            {/* Informative Breakdown Chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                {allResolvedViolations} Selesai
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-[#3d4947] border border-gray-200/60">
                {allPendingViolations} Dalam Proses
              </span>
            </div>

            <p className="text-[11px] text-[#3d4947]/70 font-medium mt-2.5">
              {allPendingViolations === 0
                ? 'Semua kasus telah selesai ditindaklanjuti'
                : `${allPendingViolations} kasus sedang dalam pendampingan Guru BK`}
            </p>
          </div>

          {/* Action Footer */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-extrabold text-emerald-700">
            <span className="group-hover:underline">Buku Kasus & Restitusi</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </motion.div>
      </div>

      {/* 📊 SEKSI GRAFIK ANALITIK UTAMA (MODERN, KEREN & MULTI-TAB) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#bcc9c6]/30 shadow-2xs space-y-4">
        {/* Top Control Bar: Title + Insight + Range Selector + Toggle */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00685f]/10 text-[#00685f] flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-[#00685f]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-[#0b1c30]">
                  Visualisasi & Grafik Analitik BK
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-200/60">
                  Interaktif
                </span>
              </div>
              <p className="text-xs text-[#3d4947]/70 font-semibold mt-0.5">
                Pantau kurva tren layanan, proporsi 4 bidang bimbingan (POP BK), restitusi, dan presensi.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            {/* Time Range Selector */}
            <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200/80">
              {[
                { id: '3months', label: '3 Bulan' },
                { id: '6months', label: '6 Bulan' },
                { id: 'year', label: '1 Tahun' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTimeRange(opt.id as TimeRangeOption)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timeRange === opt.id
                      ? 'bg-[#00685f] text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Collapse/Expand Toggle */}
            <button
              type="button"
              onClick={() => setShowChart(!showChart)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#f4f7f6] hover:bg-[#e6f4f1] text-[#00685f] border border-[#bcc9c6]/40 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span>{showChart ? 'Tutup Grafik' : 'Buka Grafik'}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#00685f] transition-transform duration-200 ${showChart ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Insight Banner */}
        <div className="bg-[#e6f4f1] border border-[#00685f]/25 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-[#00685f] shrink-0 animate-pulse" />
            <span className="font-extrabold text-[#0b1c30]">Sorotan Kinerja:</span>
            <span className="text-[#3d4947]">
              Bidang teraktif: <strong className="text-[#00685f]">{dominantBidang.name}</strong> ({dominantBidang.percent}%)
              <span className="mx-1 text-gray-400">·</span>
              Restitusi Tuntas: <strong className="text-emerald-700">{restitutionRate}%</strong>
              <span className="mx-1 text-gray-400">·</span>
              Kehadiran: <strong className="text-teal-700">{attendanceMetrics.rate}%</strong>
              <span className="mx-1 text-gray-400">·</span>
              Iklim Disiplin Positif: <strong className="text-purple-700">{positiveHealthScore.overallScore}/100</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${positiveHealthScore.statusColor}`}>
              {positiveHealthScore.level}
            </span>
            <span className="text-[11px] font-bold text-[#00685f]">
              {timeRange === '3months' ? '3 Bulan' : timeRange === 'year' ? '1 Tahun' : '6 Bulan'}
            </span>
          </div>
        </div>

        {/* Multi-Tab Selector Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'Tren Komposit', icon: Layers },
            { id: '4bidang', label: '4 Bidang BK (POP BK)', icon: Compass },
            { id: 'counseling', label: 'Format Layanan', icon: HeartHandshake },
            { id: 'violations', label: 'Restitusi & Disiplin', icon: AlertTriangle },
            { id: 'issues', label: 'Kategori Masalah (Pareto)', icon: PieChartIcon },
            { id: 'classes', label: 'Sebaran Beban Kelas', icon: Users },
            { id: 'attendance', label: 'Presensi Siswa', icon: CheckCircle2 }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as ActiveChartTab);
                  if (!showChart) setShowChart(true);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-97 ${
                  isActive
                    ? 'bg-[#00685f] text-white shadow-2xs font-extrabold'
                    : 'bg-gray-100/90 text-[#3d4947] hover:bg-gray-200/70 hover:text-[#0b1c30]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Chart Canvas & Analytic Visuals */}
        <AnimatePresence>
          {showChart && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4 pt-2 overflow-hidden"
            >
              {/* TAB 1: TREN KOMPOSIT */}
              {activeTab === 'all' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                    <span className="font-bold text-[#0b1c30]">
                      Kurva Tren: Sesi Konseling BK, Kasus Disiplin & Catatan Prestasi
                    </span>
                    <span className="hidden sm:flex items-center gap-1 text-[11px] text-[#00685f]">
                      <Info className="w-3.5 h-3.5" /> Sentuh titik grafik untuk detail angka
                    </span>
                  </div>

                  <div className="w-full h-72 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCounseling" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00685f" stopOpacity={0.7} />
                            <stop offset="95%" stopColor="#00685f" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, fontWeight: 700 }} />

                        <Area type="monotone" dataKey="counseling" name="Sesi Konseling BK" stroke="#00685f" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCounseling)" />
                        <Bar dataKey="violations" name="Kasus Disiplin" fill="#e11d48" radius={[4, 4, 0, 0]} barSize={20} />
                        <Line type="monotone" dataKey="achievements" name="Apresiasi & Prestasi" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3 bg-[#e6f4f1] rounded-xl border border-[#00685f]/20 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-[#00685f] uppercase tracking-wider block">Total Layanan BK</span>
                        <span className="text-lg font-black text-[#0b1c30]">{services.length} Sesi Terdata</span>
                      </div>
                      <HeartHandshake className="w-5 h-5 text-[#00685f]" />
                    </div>
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200/60 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Kasus Pelanggaran</span>
                        <span className="text-lg font-black text-[#0b1c30]">{violations.length} Kasus Terdata</span>
                      </div>
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                    </div>
                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-200/60 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Prestasi & Apresiasi</span>
                        <span className="text-lg font-black text-[#0b1c30]">{achievements.length} Rekam Positif</span>
                      </div>
                      <Award className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: 4 BIDANG BK (POP BK) */}
              {activeTab === '4bidang' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                    <div>
                      <h4 className="font-bold text-[#0b1c30] text-sm">
                        Proporsi Layanan Menurut 4 Bidang Bimbingan (POP BK)
                      </h4>
                      <p className="text-[11px] text-[#3d4947]/70">
                        Sesuai Panduan Operasional Penyelenggaraan Bimbingan & Konseling Kemendikbudristek.
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-[#00685f] hidden sm:inline">
                      Total: {services.length} Sesi
                    </span>
                  </div>

                  {/* 4 Cards Grid with Horizontal Visual Progress Distribution */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {bidangDistribution.map((b) => (
                      <div
                        key={b.key}
                        className="p-4 rounded-xl border border-[#bcc9c6]/30 bg-[#f8faf9] space-y-2 hover:border-[#00685f]/40 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-[#0b1c30] flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                            {b.name}
                          </span>
                          <span className="text-xs font-black" style={{ color: b.color }}>
                            {b.count} Sesi ({b.percent}%)
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-200/70 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(b.percent, 3)}%`, backgroundColor: b.color }}
                          />
                        </div>
                        <p className="text-[11px] text-[#3d4947]/70 leading-relaxed font-medium">
                          {b.desc}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Time Series Multi-Month Stacked/Grouped Bar */}
                  <div className="pt-2">
                    <span className="text-xs font-bold text-[#0b1c30] block mb-2">
                      Tren 4 Bidang Bimbingan Konseling Per Bulan:
                    </span>
                    <div className="w-full h-64 sm:h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, fontWeight: 700 }} />

                          <Bar dataKey="pribadi" name="Bidang Pribadi" fill="#00685f" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="sosial" name="Bidang Sosial" fill="#0284c7" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="belajar" name="Bidang Belajar" fill="#d97706" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="karir" name="Bidang Karir" fill="#7c3aed" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: FORMAT LAYANAN BK */}
              {activeTab === 'counseling' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                    <span className="font-bold text-[#0b1c30]">
                      Komposisi Format Penyelenggaraan: Konseling Individu, Kelompok & Klasikal
                    </span>
                    <span className="hidden sm:flex items-center gap-1 text-[11px] text-[#00685f]">
                      <Info className="w-3.5 h-3.5" /> Data sesi terdata
                    </span>
                  </div>

                  <div className="w-full h-72 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, fontWeight: 700 }} />

                        <Bar dataKey="individualCounseling" name="Konseling Individu" stackId="a" fill="#00685f" radius={[0, 0, 0, 0]} barSize={26} />
                        <Bar dataKey="groupCounseling" name="Bimbingan Kelompok" stackId="a" fill="#0d9488" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="classicalCounseling" name="Bimbingan Klasikal" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Format Descriptions */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200/60">
                      <span className="text-xs font-extrabold text-[#00685f] block">Konseling Individu</span>
                      <p className="text-[11px] text-[#3d4947]/70 mt-0.5">Pendampingan tatap muka satu lawan satu untuk isu personal siswa.</p>
                    </div>
                    <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/60">
                      <span className="text-xs font-extrabold text-emerald-800 block">Bimbingan Kelompok</span>
                      <p className="text-[11px] text-[#3d4947]/70 mt-0.5">Dinamika kelompok kecil untuk topik pertemanan dan keterampilan bersama.</p>
                    </div>
                    <div className="p-3 bg-cyan-50/60 rounded-xl border border-cyan-200/60">
                      <span className="text-xs font-extrabold text-cyan-800 block">Bimbingan Klasikal</span>
                      <p className="text-[11px] text-[#3d4947]/70 mt-0.5">Layanan informasi pencegahan serentak satu rombel kelas penuh.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: RESTITUSI & KEDISIPLINAN */}
              {activeTab === 'violations' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                    <span className="font-bold text-[#0b1c30]">
                      Grafik Penanganan Pelanggaran & Efektivitas Segitiga Restitusi
                    </span>
                    <span className="text-[11px] text-emerald-700 font-extrabold">
                      {restitutionRate}% Kasus Tuntas Direstitusi
                    </span>
                  </div>

                  <div className="w-full h-72 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, fontWeight: 700 }} />

                        <Bar dataKey="violations" name="Total Kasus Muncul" fill="#e11d48" radius={[4, 4, 0, 0]} barSize={22} />
                        <Bar dataKey="violationResolved" name="Tuntas Direstitusi" fill="#10b981" radius={[4, 4, 0, 0]} barSize={22} />
                        <Line type="monotone" dataKey="violationWeight" name="Total Bobot Poin" stroke="#9f1239" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3.5 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/60 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold text-emerald-950 block">Pendekatan Disiplin Positif Terbukti Efektif</span>
                        <span className="text-emerald-800 text-[11px]">{allResolvedViolations} dari {totalViolationsAll} kasus telah tuntas ditindaklanjuti secara damai dan restoratif.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateToTab?.('pembinaan-pendisiplinan')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer shrink-0 transition-colors"
                    >
                      Buku Kasus →
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 5: ANALISIS ISU & KATEGORI MASALAH (PARETO / DONUT) */}
              {activeTab === 'issues' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500 font-medium">
                    <div>
                      <h4 className="font-bold text-[#0b1c30] text-sm flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4 text-[#00685f]" />
                        Analisis Distribusi Masalah & Kategori Perilaku Siswa
                      </h4>
                      <p className="text-[11px] text-[#3d4947]/70 mt-0.5">
                        Klasifikasi akar persoalan perilaku untuk perumusan intervensi preventif dan Segitiga Restitusi terfokus.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-[#00685f] border border-teal-200/60 font-extrabold text-xs self-start sm:self-auto">
                      Total: {violations.length} Kasus Disiplin
                    </span>
                  </div>

                  {/* Dual Column: Left Donut Chart, Right Ranked Leaderboard */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Left: Donut Chart Canvas */}
                    <div className="lg:col-span-5 bg-[#f8faf9] p-4 rounded-2xl border border-[#bcc9c6]/30 flex flex-col items-center justify-center">
                      <span className="text-xs font-bold text-[#0b1c30] mb-2 self-start">
                        Proporsi Kategori Pelanggaran:
                      </span>
                      <div className="w-full h-64 sm:h-72 relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip content={<PieTooltip />} />
                            <Pie
                              data={issuesDistribution.filter(i => i.count > 0)}
                              dataKey="count"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={88}
                              paddingAngle={3}
                            >
                              {issuesDistribution.filter(i => i.count > 0).map((entry, index) => (
                                <Cell key={`cell-issue-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Center Donut Label */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-2xl font-black text-[#0b1c30]">
                            {violations.length}
                          </span>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            Total Kasus
                          </span>
                        </div>
                      </div>

                      {/* Mini Color Chips */}
                      <div className="flex flex-wrap gap-2 justify-center mt-2">
                        {issuesDistribution.filter(i => i.count > 0).slice(0, 4).map((item) => (
                          <span key={item.key} className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3d4947]">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.name} ({item.percent}%)
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right: Ranked Leaderboard with Restitution Recommendations */}
                    <div className="lg:col-span-7 space-y-3">
                      <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                        <span className="text-xs font-extrabold text-[#0b1c30]">
                          Peringkat Masalah & Rekomendasi Restitusi
                        </span>
                        <span className="text-[11px] text-gray-500 font-semibold">
                          Efektivitas Solusi
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {issuesDistribution.map((issue, idx) => (
                          <div
                            key={issue.key}
                            className="p-3 bg-white rounded-xl border border-[#bcc9c6]/30 hover:border-[#00685f]/40 transition-all space-y-2 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: issue.color }}
                                >
                                  {idx + 1}
                                </span>
                                <span className="text-xs font-bold text-[#0b1c30] truncate">
                                  {issue.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-black text-[#0b1c30]">
                                  {issue.count} Kasus
                                </span>
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                                  {issue.percent}%
                                </span>
                                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${issue.restitutionRate >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                  {issue.restitutionRate}% Tuntas
                                </span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(issue.percent, 3)}%`, backgroundColor: issue.color }}
                              />
                            </div>

                            {/* Practical positive discipline tip */}
                            <div className="text-[11px] text-[#3d4947]/80 flex items-start gap-1.5 bg-[#f8faf9] p-2 rounded-lg">
                              <Sparkles className="w-3.5 h-3.5 text-[#00685f] shrink-0 mt-0.5" />
                              <span><strong>Saran Restitusi:</strong> {issue.restitutionTip}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pareto Insight Strip */}
                  <div className="p-3 bg-[#e6f4f1] rounded-xl border border-[#00685f]/25 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-[#00685f] shrink-0" />
                      <span className="text-[#3d4947] font-semibold">
                        <strong>Strategi Efisiensi BK:</strong> Menuntaskan 2 kategori masalah teratas ({issuesDistribution[0]?.name} & {issuesDistribution[1]?.name}) akan menurunkan lebih dari 60% frekuensi konflik di sekolah.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateToTab?.('pelanggaran')}
                      className="px-3 py-1 bg-[#00685f] hover:bg-[#005049] text-white font-bold rounded-lg text-xs cursor-pointer shrink-0 transition-colors shadow-2xs"
                    >
                      Buka Kasus →
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 6: SEBARAN BEBAN LAYANAN PER KELAS & TINGKAT */}
              {activeTab === 'classes' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500 font-medium">
                    <div>
                      <h4 className="font-bold text-[#0b1c30] text-sm flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#00685f]" />
                        Analitik Sebaran Beban Layanan & Kasus per Kelas
                      </h4>
                      <p className="text-[11px] text-[#3d4947]/70 mt-0.5">
                        Pemetaan perbandingan konseling, disiplin, dan prestasi per rombel kelas atau jenjang angkatan.
                      </p>
                    </div>

                    {/* Scope Selector: Tingkat vs Rombel */}
                    <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200/80 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setClassViewScope('grade')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          classViewScope === 'grade'
                            ? 'bg-[#00685f] text-white shadow-2xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {classAnalytics.byGrade.length === 1 ? `Jenjang ${classAnalytics.byGrade[0].grade}` : 'Per Jenjang'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setClassViewScope('class')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          classViewScope === 'class'
                            ? 'bg-[#00685f] text-white shadow-2xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Per Rombel Kelas
                      </button>
                    </div>
                  </div>

                  {/* 3 Highlight Status Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-teal-50/70 rounded-xl border border-teal-200/60 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#00685f] text-white flex items-center justify-center shrink-0">
                        <HeartHandshake className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#00685f] uppercase tracking-wider block">Kelas Paling Terbuka Konseling</span>
                        <span className="text-base font-black text-[#0b1c30]">
                          {classAnalytics.mostActiveCounselingClass?.className || 'Kelas 7A'}
                        </span>
                        <span className="text-[11px] text-[#3d4947]/70 block mt-0.5">
                          {classAnalytics.mostActiveCounselingClass?.counseling || 0} sesi konseling terdata
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200/60 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Kelas Paling Tertib & Kondusif</span>
                        <span className="text-base font-black text-emerald-950">
                          {classAnalytics.mostDisciplinedClass?.className || 'Kelas 9A'}
                        </span>
                        <span className="text-[11px] text-emerald-800/80 block mt-0.5">
                          Hanya {classAnalytics.mostDisciplinedClass?.violations || 0} catatan pelanggaran
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-200/60 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Prestasi Terbanyak</span>
                        <span className="text-base font-black text-purple-950">
                          {classAnalytics.highestAchievementClass?.className || 'Kelas 8A'}
                        </span>
                        <span className="text-[11px] text-purple-800/80 block mt-0.5">
                          {classAnalytics.highestAchievementClass?.achievements || 0} poin apresiasi karakter
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Grouped Bar Chart Canvas */}
                  <div className="bg-white p-4 rounded-xl border border-[#bcc9c6]/30">
                    <span className="text-xs font-bold text-[#0b1c30] block mb-2">
                      Grafik Komparasi: Konseling vs Disiplin vs Prestasi ({classViewScope === 'grade' ? 'Per Jenjang' : 'Per Rombel Kelas'}):
                    </span>
                    <div className="w-full h-72 sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={classViewScope === 'grade' ? classAnalytics.byGrade : classAnalytics.byClass}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis
                            dataKey={classViewScope === 'grade' ? 'grade' : 'className'}
                            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, fontWeight: 700 }} />

                          <Bar dataKey="counseling" name="Sesi Konseling BK" fill="#00685f" radius={[4, 4, 0, 0]} barSize={classViewScope === 'grade' ? 32 : 16} />
                          <Bar dataKey="violations" name="Kasus Pelanggaran" fill="#e11d48" radius={[4, 4, 0, 0]} barSize={classViewScope === 'grade' ? 32 : 16} />
                          <Bar dataKey="achievements" name="Prestasi Siswa" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={classViewScope === 'grade' ? 32 : 16} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: ANALITIK PRESENSI & KEHADIRAN (ENHANCED DENGAN GRAFIK DONUT & TREN AREA) */}
              {activeTab === 'attendance' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500 font-medium">
                    <div>
                      <h4 className="font-bold text-[#0b1c30] text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#00685f]" />
                        Analitik Presensi & Kedisiplinan Kehadiran Siswa
                      </h4>
                      <p className="text-[11px] text-[#3d4947]/70 mt-0.5">
                        Hasil rekapitulasi presensi harian per kelas di sekolah terintegrasi dengan modul BK.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-[#00685f] border border-teal-200 font-extrabold text-xs self-start sm:self-auto">
                      Tingkat Kehadiran: {attendanceMetrics.rate}%
                    </span>
                  </div>

                  {/* 4 Attendance Status Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200/60 text-center">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Hadir</span>
                      <span className="text-2xl font-black text-emerald-950 block my-1">{attendanceMetrics.hadir}</span>
                      <span className="text-[10px] text-emerald-800 font-bold">{attendanceMetrics.rate}% Kehadiran</span>
                    </div>

                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200/60 text-center">
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Sakit</span>
                      <span className="text-2xl font-black text-amber-950 block my-1">{attendanceMetrics.sakit}</span>
                      <span className="text-[10px] text-amber-800 font-bold">Izin Sakit Terkonfirmasi</span>
                    </div>

                    <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200/60 text-center">
                      <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Izin</span>
                      <span className="text-2xl font-black text-blue-950 block my-1">{attendanceMetrics.izin}</span>
                      <span className="text-[10px] text-blue-800 font-bold">Izin Keperluan Keluarga</span>
                    </div>

                    <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200/60 text-center">
                      <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Alpa (Tanpa Keterangan)</span>
                      <span className="text-2xl font-black text-rose-950 block my-1">{attendanceMetrics.alpa}</span>
                      <span className="text-[10px] text-rose-800 font-bold">Prioritas Atensi BK</span>
                    </div>
                  </div>

                  {/* Dual Graphical Charts: Left Donut Distribution, Right Trend Curve Area */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Donut Chart: Komposisi Presensi */}
                    <div className="lg:col-span-5 bg-[#f8faf9] p-4 rounded-xl border border-[#bcc9c6]/30 flex flex-col items-center justify-center">
                      <span className="text-xs font-bold text-[#0b1c30] mb-1 self-start">
                        Proporsi Status Presensi:
                      </span>
                      <div className="w-full h-56 sm:h-64 relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip content={<PieTooltip />} />
                            <Pie
                              data={attendancePieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={52}
                              outerRadius={78}
                              paddingAngle={3}
                            >
                              {attendancePieData.map((entry, index) => (
                                <Cell key={`cell-att-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xl font-black text-emerald-800">
                            {attendanceMetrics.rate}%
                          </span>
                          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                            Hadir Rata-rata
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center mt-1">
                        {attendancePieData.map((item) => (
                          <span key={item.name} className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3d4947]">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.name}: {item.value}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Area Chart: Tren Kehadiran Waktu */}
                    <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-[#bcc9c6]/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#0b1c30]">
                          Kurva Tren Kehadiran Siswa (%):
                        </span>
                        <span className="text-[11px] text-teal-700 font-extrabold flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-teal-600" /> Rata-rata {attendanceMetrics.rate}%
                        </span>
                      </div>
                      <div className="w-full h-56 sm:h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={attendanceTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorAttendanceRate" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00685f" stopOpacity={0.7} />
                                <stop offset="95%" stopColor="#00685f" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                              type="monotone"
                              dataKey="rate"
                              name="% Tingkat Kehadiran"
                              stroke="#00685f"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#colorAttendanceRate)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#00685f] shrink-0" />
                      <span className="text-[#3d4947] font-semibold">
                        Siswa dengan rekam Alpa langsung disinkronkan ke deteksi siswa kritis untuk penjadwalan konseling atau kunjungan rumah (Home Visit).
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateToTab?.('absensi')}
                      className="px-3.5 py-1.5 bg-[#00685f] hover:bg-[#005049] text-white font-bold rounded-lg text-xs cursor-pointer shrink-0 transition-colors shadow-2xs"
                    >
                      Buka Modul Absensi →
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
