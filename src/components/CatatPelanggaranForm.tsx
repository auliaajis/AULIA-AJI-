import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, ViolationRecord, Counselor, BKServiceType, BKComponentType, RestitutionStatusType } from '../types';
import {
  ChevronRight,
  Gavel,
  Search,
  AlertTriangle,
  Save,
  Lightbulb,
  ShieldAlert,
  Info,
  Download,
  Filter,
  Mail,
  Send,
  CheckCircle,
  Camera,
  ImageIcon,
  AlertCircle,
  X,
  ExternalLink,
  FileText,
  Edit3,
  Trash2,
  Users,
  User,
  ChevronDown,
  SlidersHorizontal as Sliders,
  HeartHandshake,
  Sparkles,
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle2,
  Check
} from 'lucide-react';
import { downloadViolationPDF, generateAndUploadCasePdf } from '../utils/pdfGenerator';
import { formatCardDateTime, formatCardDate, formatCardTime } from '../utils/dateFormatter';
import { sendAutomatedEmail, createGmailDraft, triggerBackgroundAutoSync } from '../utils/googleSync';
import { getNormalizedClassKey, defaultWaliKelasList } from '../utils/classNormalizer';
import StudentCombobox from './StudentCombobox';
import { showToast } from '../utils/toast';
import { isValidDeleteId } from '../utils/safeDelete';
import {
  ViolationCategory,
  ViolationOption,
  getSchoolViolationCategories
} from '../utils/violationRulesConfig';
import { subscribeTeachers, TeacherDirectoryEntry } from '../utils/firestoreSync';

export const ARCHIVE_CATEGORY_CHIPS = [
  'Perundungan',
  'Kekerasan Fisik',
  'Kekerasan Seksual',
  'Diskriminasi',
  'Kedisiplinan',
  'Integritas Akademik',
] as const;

export type ArchiveStatusFilterKey = 'Baru' | 'Sudah Ditindaklanjuti' | 'Selesai';
export type ArchiveTimeFilterKey = 'all' | 'today' | 'week' | 'month';

export function isPiketReferralViolation(v: ViolationRecord | any): boolean {
  if (!v) return false;
  const via = String(v.reportedVia || '').toLowerCase().trim();
  const src = String(v.source || '').toLowerCase().trim();
  const rep = String(v.reportedBy || '').toLowerCase().trim();
  return (
    via.includes('piket') ||
    src === 'link_piket' ||
    src === 'piket' ||
    rep.includes('piket')
  );
}

export function getViolationOriginDisplay(v: ViolationRecord | any): {
  isPiket: boolean;
  reporterLabel: string;
  reportedViaLabel: string;
} {
  const isPiket = isPiketReferralViolation(v);
  const rawRep = String(v?.reportedBy || '').trim();
  const rawVia = String(v?.reportedVia || '').trim();

  if (isPiket) {
    return {
      isPiket: true,
      reporterLabel: rawRep || 'Guru Piket',
      reportedViaLabel: rawVia || 'Link Piket',
    };
  }
  return {
    isPiket: false,
    reporterLabel: rawRep ? `${rawRep} (BK - Data Lama)` : 'BK - Data Lama',
    reportedViaLabel: rawVia || 'Input BK Lama',
  };
}

function normalizeShortClassName(cls: string): string {
  return String(cls || '')
    .replace(/^kelas\s+/i, '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase();
}

function matchesArchiveCategoryChip(v: ViolationRecord, chip: string): boolean {
  const hay = `${v.category || ''} ${v.notes || ''} ${v.handlingProgress || ''}`.toLowerCase();
  switch (chip) {
    case 'Perundungan':
      return /perundung|bully|bullying|ejek|intimid|olok|ancam|malak/.test(hay);
    case 'Kekerasan Fisik':
      return /fisik|kelahi|berkelahi|pukul|tampar|tendang|tawur|dorong|serang|senjata|benda tajam|keras/.test(hay);
    case 'Kekerasan Seksual':
      return /seksual|asusila|peleceh|cabu|mesum|pornografi/.test(hay);
    case 'Diskriminasi':
      return /diskrimin|sara|rasis|intoleran|kucil|beda-beda/.test(hay);
    case 'Integritas Akademik':
      return /akademik|contek|nyontek|mencontek|plagiat|ujian|ulangan|tugas|bohong|jujur|titip absen/.test(hay);
    case 'Kedisiplinan':
      return /disiplin|tata tertib|terlambat|telat|alpa|alpha|bolos|membolos|tidak masuk|seragam|atribut|rapi|rambut|rokok|hp|ponsel|keluar kelas|upacara|piket|kantin|absensi/.test(hay) ||
        (!/perundung|bully|fisik|kelahi|seksual|asusila|diskrimin|contek|plagiat/.test(hay));
    default:
      return hay.includes(chip.toLowerCase());
  }
}

function getViolationSortTimestamp(v: ViolationRecord | any): number {
  const datePart = String(v?.date || '').slice(0, 10);
  const timePart = String(v?.time || '00:00').replace('.', ':').slice(0, 5);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const parsed = new Date(`${datePart}T${/^\d{2}:\d{2}$/.test(timePart) ? timePart : '00:00'}:00`).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  const ca = v?.createdAt || v?.updatedAt || v?._updatedAt;
  if (typeof ca === 'number') return ca;
  if (typeof ca === 'string') {
    const t = new Date(ca).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

export const RESTITUTION_STATUS_CONFIG: Record<
  RestitutionStatusType,
  {
    label: RestitutionStatusType;
    colorBadge: string;
    colorDot: string;
    description: string;
    subLabel: string;
  }
> = {
  'Baru Dicatat': {
    label: 'Baru Dicatat',
    colorBadge: 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200',
    colorDot: 'bg-gray-400',
    description: 'Baru masuk, belum dipanggil',
    subLabel: 'Belum dipanggil',
  },
  'Sudah Konseling': {
    label: 'Sudah Konseling',
    colorBadge: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200',
    colorDot: 'bg-blue-500',
    description: 'Sudah bicara dengan siswa',
    subLabel: 'Sudah bicara dengan siswa',
  },
  'Proses Restitusi': {
    label: 'Proses Restitusi',
    colorBadge: 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200',
    colorDot: 'bg-amber-500',
    description: 'Sedang menjalankan kesepakatan perbaikan',
    subLabel: 'Jalankan perbaikan',
  },
  'Selesai / Dipantau': {
    label: 'Selesai / Dipantau',
    colorBadge: 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200',
    colorDot: 'bg-emerald-500',
    description: 'Sudah selesai, tinggal pantau 2 minggu',
    subLabel: 'Selesai, pantau 2 minggu',
  },
};

export const getViolationRestitutionStatus = (v: ViolationRecord): RestitutionStatusType => {
  if (v.restitutionStatus) {
    if (
      v.restitutionStatus === 'Baru Dicatat' ||
      v.restitutionStatus === 'Sudah Konseling' ||
      v.restitutionStatus === 'Proses Restitusi' ||
      v.restitutionStatus === 'Selesai / Dipantau'
    ) {
      return v.restitutionStatus;
    }
    if ((v.restitutionStatus as string) === 'Selesai') return 'Selesai / Dipantau';
  }
  const progress = (v.handlingProgress || '').toLowerCase();
  const handled = (v.handledBy || '').toLowerCase();

  if (
    progress.includes('selesai') ||
    progress.includes('tuntas') ||
    progress.includes('pantau 2 minggu') ||
    progress.includes('dipantau')
  ) {
    return 'Selesai / Dipantau';
  }
  if (
    progress.includes('restitusi') ||
    progress.includes('kesepakatan') ||
    progress.includes('perbaikan') ||
    handled.includes('wali kelas & guru bk')
  ) {
    return 'Proses Restitusi';
  }
  if (handled.includes('guru bk') || progress.includes('konseling') || progress.includes('bicara')) {
    return 'Sudah Konseling';
  }
  return 'Baru Dicatat';
};

export const isAttendanceViolation = (v: ViolationRecord): boolean => {
  if (!v) return false;
  const cat = (v.category || '').toLowerCase();
  const loc = (v.location || '').toLowerCase();
  const rep = (v.reportedBy || '').toLowerCase();
  const notes = (v.notes || '').toLowerCase();
  const prog = (v.handlingProgress || '').toLowerCase();

  return (
    cat.includes('alpa') ||
    cat.includes('alpha') ||
    cat.includes('terlambat') ||
    cat.includes('tidak masuk') ||
    cat.includes('membolos') ||
    loc.includes('absensi') ||
    rep.includes('absensi') ||
    notes.includes('absensi') ||
    prog.includes('absensi')
  );
};

interface CatatPelanggaranFormProps {
  students: Student[];
  violations: ViolationRecord[];
  activeCounselor: Counselor;
  preSelectedStudentId?: string;
  initialTab?: 'input' | 'arsip';
  initialArchiveSearch?: string;
  initialOpenViolationId?: string;
  onClearInitialOpenViolation?: () => void;
  onNavigateToProfile?: (studentIdOrName: string) => void;
  onSaveViolation: (record: Omit<ViolationRecord, 'id' | 'ticketId'>) => void;
  onUpdateViolation?: (record: ViolationRecord) => void;
  onDeleteViolation?: (id: string) => void;
  onUpdateStudent?: (student: Student) => void;
  onDeleteStudent?: (id: string) => void;
  onCreateFollowUpCounseling?: (data: {
    students: Student[];
    problem: string;
    description: string;
    bkComponent?: BKComponentType;
    serviceType?: BKServiceType;
    targetType?: 'Individu' | 'Kelompok' | 'Klasikal';
    status?: 'Terjadwal' | 'Selesai' | 'Dibatalkan';
    violationContext?: {
      category: string;
      pointsAdded: number;
      date: string;
      notes?: string;
      ticketId?: string;
      violationId?: string;
    };
  }) => void;
  onCancel: () => void;
}

export default function CatatPelanggaranForm({
  students,
  violations,
  activeCounselor,
  preSelectedStudentId,
  initialTab,
  initialArchiveSearch,
  initialOpenViolationId,
  onClearInitialOpenViolation,
  onNavigateToProfile,
  onSaveViolation,
  onUpdateViolation,
  onDeleteViolation,
  onUpdateStudent,
  onDeleteStudent,
  onCreateFollowUpCounseling,
  onCancel,
}: CatatPelanggaranFormProps) {
  // Tab switcher & search states (Default ke Arsip; Form Catat Pelanggaran Guru BK disembunyikan)
  const [activeTab, setActiveTab] = useState<'input' | 'arsip'>('arsip');
  const [archiveSearch, setArchiveSearch] = useState(initialArchiveSearch || '');
  const [archiveOriginTab, setArchiveOriginTab] = useState<'rujukan' | 'lama'>('rujukan');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedCategoryChips, setSelectedCategoryChips] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState<ArchiveTimeFilterKey>('all');
  const [selectedStatusChips, setSelectedStatusChips] = useState<ArchiveStatusFilterKey[]>([]);
  const [selectedPelapor, setSelectedPelapor] = useState<string>('Semua');
  const [teachersList, setTeachersList] = useState<TeacherDirectoryEntry[]>([]);
  const [isPrivacyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bk_privacy_mode') === 'true';
    } catch {
      return false;
    }
  });

  // Subscribe to realtime Firestore `teachers` collection for Pelapor dropdown
  useEffect(() => {
    const unsub = subscribeTeachers((list) => {
      setTeachersList(list);
    }, activeCounselor?.schoolId);
    return () => unsub();
  }, [activeCounselor?.schoolId]);

  useEffect(() => {
    // Tetap di arsip (tombol Catat Pelanggaran di UI Guru BK disembunyikan)
    setActiveTab('arsip');
  }, [initialTab]);

  useEffect(() => {
    if (initialArchiveSearch !== undefined) {
      setArchiveSearch(initialArchiveSearch);
    }
  }, [initialArchiveSearch]);

  // Auto-select tab Rujukan vs Riwayat Lama when initial data loads and Rujukan is empty while Legacy has items (only once on initial mount)
  const hasAutoPickedOriginRef = useRef(false);
  useEffect(() => {
    if (hasAutoPickedOriginRef.current || !Array.isArray(violations) || violations.length === 0) return;
    const hasPiket = violations.some((v) => isPiketReferralViolation(v));
    if (!hasPiket) {
      setArchiveOriginTab('lama');
    }
    hasAutoPickedOriginRef.current = true;
  }, [violations]);

  // Sesi Layanan Konseling Tindak Lanjut Otomatis State
  const [autoCreateCounseling, setAutoCreateCounseling] = useState(false);
  const [showFollowUpPromptModal, setShowFollowUpPromptModal] = useState(false);
  const [followUpPromptData, setFollowUpPromptData] = useState<{
    students: Student[];
    category: string;
    pointsAdded: number;
    date: string;
    time: string;
    location: string;
    notes: string;
    handledBy: string;
  } | null>(null);
  const [selectedFollowUpServiceType, setSelectedFollowUpServiceType] = useState<BKServiceType>(
    'Layanan Konseling Perorangan (Individual)'
  );
  const [selectedFollowUpStatus, setSelectedFollowUpStatus] = useState<'Terjadwal' | 'Selesai'>('Terjadwal');

  // Editing Violation Modal state
  const [editingViolation, setEditingViolation] = useState<ViolationRecord | null>(null);

  // Detail Kasus Modal state
  const [detailViolation, setDetailViolation] = useState<ViolationRecord | null>(null);
  const [isProcessingDrivePdf, setIsProcessingDrivePdf] = useState(false);
  const [caseDriveFailed, setCaseDriveFailed] = useState(false);

  useEffect(() => {
    if (!initialOpenViolationId) return;
    const target = (violations || []).find(
      (v) => v && (v.id === initialOpenViolationId || v.ticketId === initialOpenViolationId)
    );
    if (target) {
      setActiveTab('arsip');
      setArchiveOriginTab(isPiketReferralViolation(target) ? 'rujukan' : 'lama');
      setDetailViolation(target);
      setCaseDriveFailed(false);
      onClearInitialOpenViolation?.();
    }
  }, [initialOpenViolationId, violations, onClearInitialOpenViolation]);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{
    type: 'violation' | 'student';
    id: string;
    title?: string;
    message: string;
    step: 1 | 2;
  } | null>(null);

  const handleProcessCaseDrivePdf = async (v: ViolationRecord) => {
    setIsProcessingDrivePdf(true);
    setCaseDriveFailed(false);
    try {
      const res = await generateAndUploadCasePdf(v);
      if (res.success && res.pdfUrl) {
        setDetailViolation((prev) => (prev && prev.id === v.id ? { ...prev, pdfUrl: res.pdfUrl } : prev));
        setCaseDriveFailed(false);
      } else if (res.isDriveFailed) {
        setCaseDriveFailed(true);
      }
    } catch {
      setCaseDriveFailed(true);
    } finally {
      setIsProcessingDrivePdf(false);
    }
  };

  // Student Quick Detail / Edit Modal state
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentClass, setEditStudentClass] = useState('');
  const [editStudentNis, setEditStudentNis] = useState('');

  // Date range filter states (kept compatible) & legacy sub-filter
  const [archiveStartDate, setArchiveStartDate] = useState('');
  const [archiveEndDate, setArchiveEndDate] = useState('');
  const [archiveSubTab, setArchiveSubTab] = useState<'perilaku' | 'absensi'>('perilaku');

  // Counts for Rujukan Baru dari Piket vs Riwayat Lama
  const { rujukanCount, riwayatLamaCount } = useMemo(() => {
    if (!Array.isArray(violations)) return { rujukanCount: 0, riwayatLamaCount: 0 };
    let rujukan = 0;
    let lama = 0;
    violations.forEach((v) => {
      if (!v) return;
      if (isPiketReferralViolation(v)) rujukan++;
      else lama++;
    });
    return { rujukanCount: rujukan, riwayatLamaCount: lama };
  }, [violations]);

  const studentNisMap = useMemo(() => {
    const map = new Map<string, string>();
    (students || []).forEach((s) => {
      if (s.id && s.nis) map.set(String(s.id), String(s.nis));
      if (s.name && s.nis) map.set(s.name.trim().toLowerCase(), String(s.nis));
    });
    return map;
  }, [students]);

  const classFilterChips = useMemo(() => {
    const base = ['7A', '7B', '7C', '8A', '8B', '8C', '9A', '9B', '9C'];
    const set = new Set<string>(base);
    (students || []).forEach((s) => {
      const c = normalizeShortClassName(s.class);
      if (c) set.add(c);
    });
    (violations || []).forEach((v) => {
      const c = normalizeShortClassName(v.studentClass);
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [students, violations]);

  const pelaporOptions = useMemo(() => {
    const map = new Map<string, string>();
    (teachersList || []).forEach((t) => {
      const clean = String(t.name || '').trim();
      if (clean) map.set(clean.toLowerCase(), t.role ? `${clean} (${t.role})` : clean);
    });
    (violations || []).forEach((v) => {
      const clean = String(v.reportedBy || '').trim();
      if (clean && !map.has(clean.toLowerCase())) {
        map.set(clean.toLowerCase(), clean);
      }
    });
    return Array.from(map.entries())
      .map(([key, label]) => ({ value: key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'id'));
  }, [teachersList, violations]);

  const [restitutionStatusFilter, setRestitutionStatusFilter] = useState<'Semua' | RestitutionStatusType>('Semua');

  // Active month calculation for Dashboard Pemulihan
  const activeMonthKey = useMemo(() => {
    const currentRealMonth = new Date().toISOString().slice(0, 7);
    if (Array.isArray(violations) && violations.some((v) => String(v.date || '').slice(0, 7) === currentRealMonth)) {
      return currentRealMonth;
    }
    if (Array.isArray(violations)) {
      const months = violations
        .map((v) => String(v.date || '').slice(0, 7))
        .filter((m) => /^\d{4}-\d{2}$/.test(m));
      if (months.length > 0) {
        months.sort();
        return months[months.length - 1];
      }
    }
    return currentRealMonth;
  }, [violations]);

  const activeMonthLabel = useMemo(() => {
    const INDO_MONTH_NAMES = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    if (!activeMonthKey) return 'Bulan Ini';
    const [y, m] = activeMonthKey.split('-');
    const idx = parseInt(m, 10) - 1;
    return `${INDO_MONTH_NAMES[idx] || m} ${y}`;
  }, [activeMonthKey]);

  const monthViolations = useMemo(() => {
    if (!Array.isArray(violations) || !activeMonthKey) return [];
    return violations.filter((v) => String(v.date || '').startsWith(activeMonthKey));
  }, [violations, activeMonthKey]);

  const monthStats = useMemo(() => {
    let selesai = 0;
    let proses = 0;
    let baruDicatat = 0;

    monthViolations.forEach((v) => {
      const st = getViolationRestitutionStatus(v);
      if (st === 'Selesai / Dipantau') {
        selesai++;
      } else if (st === 'Proses Restitusi' || st === 'Sudah Konseling') {
        proses++;
      } else {
        baruDicatat++;
      }
    });

    return {
      total: monthViolations.length,
      selesai,
      proses,
      baruDicatat,
    };
  }, [monthViolations]);

  const topCategoriesMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    monthViolations.forEach((v) => {
      const cat = (v.category || 'Lainnya').trim();
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, count]) => ({ category, count }));
  }, [monthViolations]);

  const topClassesMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    monthViolations.forEach((v) => {
      const cls = (v.studentClass || 'Tidak Diketahui').trim();
      counts[cls] = (counts[cls] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([className, count]) => ({ className, count }));
  }, [monthViolations]);

  // Restitution Status Modal state for quick update
  const [statusModalViolation, setStatusModalViolation] = useState<ViolationRecord | null>(null);
  const [modalTargetStatus, setModalTargetStatus] = useState<RestitutionStatusType>('Baru Dicatat');
  const [modalAgreement, setModalAgreement] = useState('');
  const [modalDeadline, setModalDeadline] = useState('');
  const [modalSupervisor, setModalSupervisor] = useState('');
  const [modalCompletedDate, setModalCompletedDate] = useState('');

  const handleOpenStatusModal = (v: ViolationRecord) => {
    const curStatus = getViolationRestitutionStatus(v);
    setStatusModalViolation(v);
    setModalTargetStatus(curStatus);
    setModalAgreement(v.restitutionAgreement || (v.handlingProgress && !v.handlingProgress.includes('Disinkronkan otomatis') ? v.handlingProgress : ''));
    const defaultDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setModalDeadline(v.restitutionDeadline || defaultDeadline);
    setModalSupervisor(v.restitutionSupervisor || `${activeCounselor?.name || 'Guru BK'} & Wali Kelas ${v.studentClass}`);
    const todayStr = new Date().toISOString().slice(0, 10);
    setModalCompletedDate(v.restitutionCompletedDate || todayStr);
  };

  const handleSelectStatusInModal = (st: RestitutionStatusType) => {
    setModalTargetStatus(st);
    if (st === 'Selesai / Dipantau' && !modalCompletedDate) {
      setModalCompletedDate(new Date().toISOString().slice(0, 10));
    }
  };

  const handleSaveStatusModal = () => {
    if (!statusModalViolation) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const completedDate = modalCompletedDate || todayStr;

    let newProgress = '';
    let newHandledBy: 'Belum Ditangani' | 'Wali Kelas' | 'Guru BK' | 'Wali Kelas & Guru BK' = 'Belum Ditangani';

    if (modalTargetStatus === 'Proses Restitusi') {
      newHandledBy = 'Wali Kelas & Guru BK';
      newProgress = `Proses Restitusi: ${modalAgreement.trim() || 'Menjalankan perbaikan'} (Deadline: ${formatCardDate(modalDeadline)}, Pemantau: ${modalSupervisor.trim() || 'Wali Kelas & BK'})`;
    } else if (modalTargetStatus === 'Selesai / Dipantau') {
      newHandledBy = 'Guru BK';
      newProgress = `Selesai / Dipantau per ${formatCardDate(completedDate)} (Masa pemantauan 2 minggu)`;
    } else if (modalTargetStatus === 'Sudah Konseling') {
      newHandledBy = 'Guru BK';
      newProgress = 'Sudah Konseling: Pembicaraan awal & penelusuran akar masalah telah dilakukan bersama siswa.';
    } else {
      newHandledBy = 'Belum Ditangani';
      newProgress = 'Baru Dicatat: Menunggu proses pemanggilan siswa.';
    }

    const updated: ViolationRecord = {
      ...statusModalViolation,
      restitutionStatus: modalTargetStatus,
      restitutionAgreement: modalTargetStatus === 'Proses Restitusi' ? modalAgreement.trim() : statusModalViolation.restitutionAgreement,
      restitutionDeadline: modalTargetStatus === 'Proses Restitusi' ? modalDeadline : statusModalViolation.restitutionDeadline,
      restitutionSupervisor: modalTargetStatus === 'Proses Restitusi' ? modalSupervisor.trim() : statusModalViolation.restitutionSupervisor,
      restitutionCompletedDate: modalTargetStatus === 'Selesai / Dipantau' ? completedDate : statusModalViolation.restitutionCompletedDate,
      handledBy: newHandledBy,
      handlingProgress: newProgress,
    };

    if (onUpdateViolation) {
      onUpdateViolation(updated);
    }
    setStatusModalViolation(null);
    showToast(`Status penanganan berhasil diubah ke "${modalTargetStatus}"`, 'success');
  };

  const handleResetArchiveFilters = () => {
    setArchiveSearch('');
    setSelectedClasses([]);
    setSelectedCategoryChips([]);
    setTimeFilter('all');
    setSelectedStatusChips([]);
    setSelectedPelapor('Semua');
    setArchiveStartDate('');
    setArchiveEndDate('');
    setRestitutionStatusFilter('Semua');
  };

  // Filtered violation records for Rujukan Baru dari Piket & Riwayat Lama (sorted newest first)
  const filteredViolations = useMemo(() => {
    if (!Array.isArray(violations)) return [];
    const rawQ = archiveSearch.trim();
    const q = rawQ.length >= 2 ? rawQ.toLowerCase() : '';
    const todayStr = new Date().toISOString().slice(0, 10);
    const nowDate = new Date();
    const weekAgo = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - 7)
      .toISOString()
      .slice(0, 10);
    const monthPrefix = todayStr.slice(0, 7);

    const list = violations.filter((v) => {
      if (!v) return false;

      // 1. Partition by origin tab: Rujukan Baru dari Piket vs Riwayat Lama
      const isPiket = isPiketReferralViolation(v);
      if (archiveOriginTab === 'rujukan' && !isPiket) return false;
      if (archiveOriginTab === 'lama' && isPiket) return false;

      // 2. Instant search query filter (>= 2 huruf langsung filter Nama Siswa / NIS)
      if (q) {
        const resolvedNis =
          String(v.nis || '').trim() ||
          studentNisMap.get(String(v.studentId || '')) ||
          studentNisMap.get(String(v.studentName || '').trim().toLowerCase()) ||
          '';
        const matchesQuery =
          String(v.studentName || '').toLowerCase().includes(q) ||
          resolvedNis.toLowerCase().includes(q) ||
          String(v.studentClass || '').toLowerCase().includes(q) ||
          String(v.category || '').toLowerCase().includes(q) ||
          String(v.ticketId || '').toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      // 3. Multi-select Kelas filter
      if (selectedClasses.length > 0) {
        const normCls = normalizeShortClassName(v.studentClass);
        if (!selectedClasses.some((c) => normalizeShortClassName(c) === normCls)) {
          return false;
        }
      }

      // 4. Multi-select Kategori filter
      if (selectedCategoryChips.length > 0) {
        if (!selectedCategoryChips.some((chip) => matchesArchiveCategoryChip(v, chip))) {
          return false;
        }
      }

      // 5. Waktu filter (Hari Ini | Minggu Ini | Bulan Ini | Semua)
      const vDate = String(v.date || '').slice(0, 10);
      if (timeFilter === 'today' && vDate !== todayStr) return false;
      if (timeFilter === 'week' && (!vDate || vDate < weekAgo)) return false;
      if (timeFilter === 'month' && (!vDate || !vDate.startsWith(monthPrefix))) return false;

      // Custom date bounds if any
      if (archiveStartDate && vDate && vDate < archiveStartDate) return false;
      if (archiveEndDate && vDate && vDate > archiveEndDate) return false;

      // 6. Status filter (Baru | Sudah Ditindaklanjuti | Selesai)
      if (selectedStatusChips.length > 0) {
        const restStatus = getViolationRestitutionStatus(v);
        const mappedKey: ArchiveStatusFilterKey =
          restStatus === 'Selesai / Dipantau'
            ? 'Selesai'
            : restStatus === 'Sudah Konseling' || restStatus === 'Proses Restitusi'
            ? 'Sudah Ditindaklanjuti'
            : 'Baru';
        if (!selectedStatusChips.includes(mappedKey)) return false;
      }

      // 7. Pelapor dropdown filter
      if (selectedPelapor && selectedPelapor !== 'Semua') {
        const rep = String(v.reportedBy || '').trim().toLowerCase();
        if (!rep.includes(selectedPelapor.toLowerCase())) return false;
      }

      return true;
    });

    // Urutkan terbaru ke terlama
    return [...list].sort((a, b) => getViolationSortTimestamp(b) - getViolationSortTimestamp(a));
  }, [
    violations,
    archiveOriginTab,
    archiveSearch,
    studentNisMap,
    selectedClasses,
    selectedCategoryChips,
    timeFilter,
    archiveStartDate,
    archiveEndDate,
    selectedStatusChips,
    selectedPelapor,
  ]);

  const activeFilterSummaryParts = useMemo(() => {
    const parts: string[] = [];
    if (archiveSearch.trim().length >= 2) parts.push(`"${archiveSearch.trim()}"`);
    if (selectedClasses.length > 0) parts.push(`Kelas ${selectedClasses.join(', ')}`);
    if (selectedCategoryChips.length > 0) parts.push(selectedCategoryChips.join(', '));
    if (timeFilter === 'today') parts.push('Hari Ini');
    else if (timeFilter === 'week') parts.push('Minggu Ini');
    else if (timeFilter === 'month') parts.push('Bulan Ini');
    if (selectedStatusChips.length > 0) parts.push(`Status: ${selectedStatusChips.join(', ')}`);
    if (selectedPelapor !== 'Semua') {
      const foundOpt = pelaporOptions.find((o) => o.value === selectedPelapor);
      parts.push(`Pelapor: ${foundOpt ? foundOpt.label : selectedPelapor}`);
    }
    return parts;
  }, [
    archiveSearch,
    selectedClasses,
    selectedCategoryChips,
    timeFilter,
    selectedStatusChips,
    selectedPelapor,
    pelaporOptions,
  ]);

  // Autocomplete student query & class filter state
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedSearchClass, setSelectedSearchClass] = useState('Semua Kelas');
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const selectedStudent = selectedStudents[0] || null;
  const [showDropdown, setShowDropdown] = useState(false);

  // Available classes list from students
  const availableClassesList = useMemo(() => {
    if (!students || students.length === 0) return [];
    return Array.from(new Set(students.map((s) => s.class))).sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true })
    );
  }, [students]);

  const [currentCategories, setCurrentCategories] = useState<ViolationCategory[]>(() => {
    return getSchoolViolationCategories();
  });

  useEffect(() => {
    const handleRulesChanged = () => {
      setCurrentCategories(getSchoolViolationCategories());
    };
    window.addEventListener('bk_violation_rules_changed', handleRulesChanged);
    window.addEventListener('bk_school_changed', handleRulesChanged);
    window.addEventListener('storage', handleRulesChanged);
    return () => {
      window.removeEventListener('bk_violation_rules_changed', handleRulesChanged);
      window.removeEventListener('bk_school_changed', handleRulesChanged);
      window.removeEventListener('storage', handleRulesChanged);
    };
  }, []);

  // Bulk student selector state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFilterClass, setBulkFilterClass] = useState('Semua Kelas');
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);

  const bulkFilteredStudents = useMemo(() => {
    let list = students || [];
    if (bulkFilterClass !== 'Semua Kelas') {
      list = list.filter((s) => s.class === bulkFilterClass);
    }
    const q = bulkSearchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (s) =>
          String(s.name || '').toLowerCase().includes(q) ||
          String(s.nis || '').toLowerCase().includes(q) ||
          String(s.class || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, bulkFilterClass, bulkSearchQuery]);

  const toggleBulkSelectStudent = (id: string) => {
    setBulkSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllBulk = () => {
    const visibleIds = bulkFilteredStudents.map((s) => s.id);
    const newSet = new Set([...bulkSelectedIds, ...visibleIds]);
    setBulkSelectedIds(Array.from(newSet));
  };

  const handleDeselectAllBulk = () => {
    const visibleIds = new Set(bulkFilteredStudents.map((s) => s.id));
    setBulkSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
  };

  const handleApplyBulkSelection = () => {
    const selectedObjects = students.filter((s) => bulkSelectedIds.includes(s.id));
    setSelectedStudents(selectedObjects);
    setShowBulkModal(false);
    showToast(`${selectedObjects.length} siswa berhasil dipilih`, 'success');
  };

  // Form states
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [customViolationLabel, setCustomViolationLabel] = useState<string>('');
  const [pointsAdded, setPointsAdded] = useState(0);
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [handledBy, setHandledBy] = useState<'Belum Ditangani' | 'Wali Kelas' | 'Guru BK' | 'Wali Kelas & Guru BK'>('Belum Ditangani');
  const [handlingProgress, setHandlingProgress] = useState('');
  const [notifyWaliOption, setNotifyWaliOption] = useState<'send' | 'save_only'>('send');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [emailData, setEmailData] = useState<{
    to: string;
    subject: string;
    body: string;
    triggerPoints: number;
    severity: 'TAHAP I' | 'TAHAP II (SIAGA)' | 'TAHAP III (KRITIS)';
  } | null>(null);

  // Verification Proof Photo states & camera setup
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string | undefined>(undefined);
  const [proofPhotoName, setProofPhotoName] = useState<string | undefined>(undefined);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Auto clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async () => {
    setShowCamera(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Gagal mengakses kamera. Pastikan izin kamera diberikan.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setProofPhotoUrl(dataUrl);
        setProofPhotoName(`Kamera_${new Date().toISOString().slice(0,10)}_${Math.floor(Math.random() * 1000)}.jpg`);
        stopCamera();
      }
    } catch (err) {
      console.error('Capture error:', err);
      setCameraError('Gagal mengambil gambar dari kamera.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setProofPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setProofPhotoUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Derived violation category string matching existing fields
  const violationCategory = useMemo(() => {
    const categoryObj = currentCategories.find(c => c.id === selectedCategory);
    const optionObj = categoryObj?.options.find(o => o.id === selectedOptionId);
    
    if (categoryObj) {
      if (selectedOptionId === 'other') {
        return `${categoryObj.name}: ${customViolationLabel.trim() || 'Pelanggaran Lainnya'}`;
      } else if (optionObj) {
        return `${categoryObj.name}: ${optionObj.label}`;
      } else {
        return categoryObj.name;
      }
    }
    return '';
  }, [selectedCategory, selectedOptionId, customViolationLabel, currentCategories]);

  // Auto Ticket ID generation
  const ticketId = useMemo(() => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    const year = new Date().getFullYear();
    return `PLG-${year}-${randomNum}`;
  }, []);

  // Load wali kelas config from localStorage
  const waliKelasConfig = useMemo(() => {
    const saved = localStorage.getItem('bk_walikelas_config');
    if (saved) {
      try {
        return JSON.parse(saved) as { class: string; name: string; email: string; phone?: string }[];
      } catch (e) {
        return defaultWaliKelasList;
      }
    }
    return defaultWaliKelasList;
  }, []);

  const currentWaliKelas = useMemo(() => {
    if (!selectedStudent) return null;
    
    const studentClassKey = getNormalizedClassKey(selectedStudent.class);
    
    // Find matching wali kelas using robust normalizer
    const found = waliKelasConfig.find(item => 
      getNormalizedClassKey(item.class) === studentClassKey
    );
    
    if (found) return found;

    // Default presets matching our predefined ones if not configured
    const cleanClass = selectedStudent.class.trim().replace(/kelas\s*/i, '').trim();
    const classCode = cleanClass.toLowerCase().replace(/\s+/g, '');
    const defaultPhones: Record<string, string> = {
      '7a': '081234567801', '7b': '081234567802', '7c': '081234567803', '7d': '081234567804', '7e': '081234567805', '7f': '081234567806',
      '8a': '081234567807', '8b': '081234567808', '8c': '081234567809', '8d': '081234567810', '8e': '081234567811', '8f': '081234567812', '8g': '081234567813',
      '9a': '081234567814', '9b': '081234567815', '9c': '081234567816', '9d': '081234567817', '9e': '081234567818', '9f': '081234567819', '9g': '081234567820'
    };
    return {
      class: selectedStudent.class,
      name: 'Wali Kelas ' + cleanClass,
      email: `wali.kelas.${classCode}@smpn2susukan.sch.id`,
      phone: defaultPhones[classCode] || '081234567800'
    };
  }, [selectedStudent, waliKelasConfig]);

  const emailThreshold = useMemo(() => {
    const saved = localStorage.getItem('bk_email_threshold');
    if (saved) {
      const parsed = parseInt(saved);
      if (!isNaN(parsed)) return parsed;
    }
    return 20; // default to 20
  }, []);

  // Pre-fill student if preSelectedStudentId matches
  useEffect(() => {
    if (preSelectedStudentId) {
      const found = students.find((s) => s.id === preSelectedStudentId);
      if (found) {
        if (!selectedStudents.some((item) => item.id === found.id)) {
          setSelectedStudents([found]);
        }
        setStudentQuery(found.name);
      }
    }
  }, [preSelectedStudentId, students]);

  // Handle selected violation/appreciation category points dynamically based on detailed selections
  useEffect(() => {
    if (!selectedCategory) {
      setPointsAdded(0);
      setSelectedOptionId('');
      setCustomViolationLabel('');
      return;
    }
    
    const categoryObj = currentCategories.find(c => c.id === selectedCategory);
    if (!categoryObj) return;

    if (selectedOptionId === 'other') {
      // Set a default pointsAdded value if currently 0
      if (pointsAdded <= 0) {
        setPointsAdded(5);
      }
    } else {
      const optionObj = categoryObj.options.find(o => o.id === selectedOptionId);
      if (optionObj) {
        setPointsAdded(optionObj.points);
      } else {
        setPointsAdded(0);
      }
    }
  }, [selectedCategory, selectedOptionId, currentCategories]);

  // Set default current date and time
  useEffect(() => {
    const today = new Date();
    const formattedDate = today.toISOString().substring(0, 10);
    const minutes = today.getMinutes();
    const formattedTime = `${String(today.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    setIncidentDate(formattedDate);
    setIncidentTime(formattedTime);
  }, []);

  // Autocomplete matching students
  const filteredSuggestions = useMemo(() => {
    let list = students || [];

    // Filter by class if selected
    if (selectedSearchClass && selectedSearchClass !== 'Semua Kelas') {
      list = list.filter((s) => s.class === selectedSearchClass);
    }

    // Filter by search query if typed
    const q = studentQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s &&
          (String(s.name || '').toLowerCase().includes(q) ||
            String(s.nis || '').toLowerCase().includes(q) ||
            String(s.class || '').toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [studentQuery, selectedSearchClass, students]);

  const handleSelectSuggestion = (student: Student) => {
    if (selectedStudents.some((item) => item.id === student.id)) {
      alert('Siswa ini sudah terpilih!');
    } else {
      setSelectedStudents([...selectedStudents, student]);
    }
    setStudentQuery('');
    setShowDropdown(false);
  };

  // Compute points threshold escalation details
  const currentPoints = selectedStudent ? selectedStudent.violationPoints : 0;
  const projectedPoints = currentPoints + pointsAdded;
  const isEscalating = projectedPoints >= 75;

  // Central Post-Save Handler (automatically offers follow-up counseling session)
  const proceedPostSave = (data: {
    students: Student[];
    category: string;
    pointsAdded: number;
    date: string;
    time: string;
    location: string;
    notes: string;
    handledBy: string;
  }) => {
    triggerBackgroundAutoSync();

    if (autoCreateCounseling && onCreateFollowUpCounseling) {
      showToast('Laporan pelanggaran tersimpan! Membuka formulir Layanan Konseling...', 'success');
      onCreateFollowUpCounseling({
        students: data.students,
        problem: `Tindak Lanjut Pembinaan Disiplin: ${data.category}`,
        description: `Sesi tindak lanjut layanan konseling dan restitusi disiplin positif atas pelanggaran "${data.category}" (${data.date}). Catatan kejadian: ${data.notes || '-'}`,
        bkComponent: 'Layanan Responsif',
        serviceType:
          data.students.length > 1
            ? 'Layanan Konseling Kelompok'
            : 'Layanan Konseling Perorangan (Individual)',
        targetType: data.students.length > 1 ? 'Kelompok' : 'Individu',
        status: 'Terjadwal',
        violationContext: {
          category: data.category,
          pointsAdded: data.pointsAdded,
          date: data.date,
          notes: data.notes,
        },
      });
    } else {
      // Open interactive Follow-Up Counseling Offer Modal
      showToast('✅ Catatan pelanggaran siswa berhasil disimpan ke database!', 'success');
      setFollowUpPromptData(data);
      setSelectedFollowUpServiceType(
        data.students.length > 1
          ? 'Layanan Konseling Kelompok'
          : 'Layanan Konseling Perorangan (Individual)'
      );
      setSelectedFollowUpStatus('Terjadwal');
      setShowFollowUpPromptModal(true);
    }
  };

  const handleSaveWithoutSending = () => {
    if (selectedStudents.length === 0) return;
    const student = selectedStudents[0];
    showToast(`✅ Catatan pelanggaran ${student.name} berhasil disimpan!`, 'success');
    onSaveViolation({
      studentId: student.id,
      studentName: student.name,
      studentClass: student.class,
      category: violationCategory,
      pointsAdded,
      date: incidentDate,
      time: incidentTime,
      location: incidentLocation || 'Lokal Sekolah',
      reportedBy: activeCounselor.name,
      notes,
      handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy,
      handlingProgress: handlingProgress || (handledBy === 'Belum Ditangani' ? 'Teguran persuasif & pembinaan tingkat kelas oleh Wali Kelas.' : handlingProgress),
      proofPhotoUrl,
      proofPhotoName,
    });
    setShowEmailModal(false);
    proceedPostSave({
      students: [student],
      category: violationCategory,
      pointsAdded,
      date: incidentDate,
      time: incidentTime,
      location: incidentLocation || 'Lokal Sekolah',
      notes,
      handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy,
    });
  };

  const handleCreateDraft = async () => {
    if (!selectedStudent || !emailData) return;
    setIsCreatingDraft(true);
    try {
      const draftRes = await createGmailDraft(emailData.to, emailData.subject, emailData.body);
      alert(draftRes.message);
    } catch (err: any) {
      console.error('Email drafting exception:', err);
      alert('Terjadi kesalahan sistem saat mencoba menyimpan draf email otomatis.');
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const handleConfirmEmailAndSave = async () => {
    if (!selectedStudent || !emailData) return;
    setIsSendingEmail(true);
    
    try {
      const emailRes = await sendAutomatedEmail(emailData.to, emailData.subject, emailData.body);
      if (emailRes.success) {
        showToast(emailRes.message, 'success');
      } else {
        alert(emailRes.message);
      }
    } catch (err: any) {
      console.error('Email sending exception:', err);
      alert('Terjadi kesalahan sistem saat mencoba mengirimkan email otomatis.');
    } finally {
      setIsSendingEmail(false);
    }

    onSaveViolation({
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      studentClass: selectedStudent.class,
      category: violationCategory,
      pointsAdded,
      date: incidentDate,
      time: incidentTime,
      location: incidentLocation || 'Lokal Sekolah',
      reportedBy: activeCounselor.name,
      notes,
      handledBy,
      handlingProgress: handledBy !== 'Belum Ditangani' ? handlingProgress : '',
      proofPhotoUrl,
      proofPhotoName,
    });
    setShowEmailModal(false);
    proceedPostSave({
      students: [selectedStudent],
      category: violationCategory,
      pointsAdded,
      date: incidentDate,
      time: incidentTime,
      location: incidentLocation || 'Lokal Sekolah',
      notes,
      handledBy,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudents.length === 0) {
      alert('Pilih minimal satu siswa terlebih dahulu!');
      return;
    }
    if (!violationCategory) {
      alert('Pilih jenis kategori pelanggaran!');
      return;
    }
    if (selectedStudents.length === 1) {
      const student = selectedStudents[0];
      const classCode = student.class.toLowerCase().replace(/kelas\s*/g, '').replace(/\s+/g, '');
      const waliEmail = currentWaliKelas?.email || `wali.kelas.${classCode}@smpn2susukan.sch.id`;
      const waliName = currentWaliKelas?.name || `Bapak/Ibu Wali Kelas ${student.class}`;

      if (projectedPoints >= emailThreshold) {
        if (notifyWaliOption === 'save_only') {
          // Save directly without opening email/WA modal
          onSaveViolation({
            studentId: student.id,
            studentName: student.name,
            studentClass: student.class,
            category: violationCategory,
            pointsAdded,
            date: incidentDate,
            time: incidentTime,
            location: incidentLocation || 'Lokal Sekolah',
            reportedBy: activeCounselor.name,
            notes,
            handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy,
            handlingProgress: handlingProgress || (handledBy === 'Belum Ditangani' ? 'Teguran persuasif & pembinaan tingkat kelas oleh Wali Kelas.' : handlingProgress),
            proofPhotoUrl,
            proofPhotoName,
          });
          proceedPostSave({
            students: [student],
            category: violationCategory,
            pointsAdded,
            date: incidentDate,
            time: incidentTime,
            location: incidentLocation || 'Lokal Sekolah',
            notes,
            handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy,
          });
          return;
        }

        // Trigger automatic email notice to Homeroom Teacher (Wali Kelas)
        let severityLevel: 'TAHAP I' | 'TAHAP II (SIAGA)' | 'TAHAP III (KRITIS)' = 'TAHAP I';
        let actionRecommendation = '';
        
        if (projectedPoints >= 75) {
          severityLevel = 'TAHAP III (KRITIS)';
          actionRecommendation = 'Sesuai prinsip disiplin positif Permendikbudristek 46/2023, siswa ini memerlukan penanganan khusus terpadu. Kasus beralih dari layanan dasar BK ke Sidang Pemulihan Karakter bersama Wali Kelas, Dewan Guru, serta koordinasi langsung dengan Kepala Sekolah untuk tindakan restoratif kolaboratif.';
        } else if (projectedPoints >= 50) {
          severityLevel = 'TAHAP II (SIAGA)';
          actionRecommendation = 'Siswa menyentuh tingkat eskalasi siaga (Bobot >= 50). Guru BK dan Wali Kelas wajib segera mengagendakan Dialog Pemulihan bersama Orang Tua guna menyusun rencana pendampingan karakter kolaboratif.';
        } else {
          severityLevel = 'TAHAP I';
          actionRecommendation = `Siswa menyentuh tingkat eskalasi awal (Bobot >= ${emailThreshold}). Sebagai Wali Kelas, mohon fasilitasi bimbingan persuasif di kelas dan diskusi reflektif bersama siswa.`;
        }

        const existingStudentViolations = violations.filter(v => v.studentId === student.id);
        let violationsListText = '';
        if (existingStudentViolations.length > 0) {
          violationsListText = existingStudentViolations.map((v, i) => `${i + 1}. Tanggal: ${v.date} - ${v.category} (Bobot: ${v.pointsAdded})`).join('\n');
        } else {
          violationsListText = '(Belum ada riwayat pembinaan sebelumnya)';
        }
        const newViolationIndex = existingStudentViolations.length + 1;
        const newViolationText = `${newViolationIndex}. Tanggal: ${incidentDate} (Baru) - ${violationCategory} (Bobot: ${pointsAdded})`;

        setEmailData({
          to: waliEmail,
          subject: `[KONSULTASI BK] Eskalasi Dukungan Karakter Siswa: ${student.name} (${student.class})`,
          body: `Yth. ${waliName},

Melalui surat elektronik otomatis ini, kami mengirimkan laporan eskalasi pendampingan terkait anak asuh Anda di kelas:

- Nama: ${student.name}
- NISN: ${student.nis}
- Kelas: ${student.class}

Rincian Catatan Perilaku Siswa:
${violationsListText}
${newViolationText}

Dengan penambahan catatan terbaru ini, indeks akumulasi eskalasi pembinaan siswa kini berada pada tingkat: ${projectedPoints} (Bobot).

Terkait tindak lanjut dialog pemulihan karakter siswa tersebut, silakan koordinasi lebih lanjut dengan Guru BK.

Hormat kami,
Layanan Konseling & Pembinaan Karakter Siswa
SMP Negeri 2 Susukan`,
          triggerPoints: projectedPoints,
          severity: severityLevel,
        });

        setShowEmailModal(true);
      } else {
        // Small accumulation: solved inside class by Wali Kelas, no automatic email dialog required
        onSaveViolation({
          studentId: student.id,
          studentName: student.name,
          studentClass: student.class,
          category: violationCategory,
          pointsAdded,
          date: incidentDate,
          time: incidentTime,
          location: incidentLocation || 'Lokal Sekolah',
          reportedBy: activeCounselor.name,
          notes,
          handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy, // Auto mark as resolved by Homeroom Teacher as points are low
          handlingProgress: handledBy === 'Belum Ditangani' ? 'Teguran persuasif & pembinaan tingkat kelas oleh Wali Kelas.' : handlingProgress,
          proofPhotoUrl,
          proofPhotoName,
        });
        proceedPostSave({
          students: [student],
          category: violationCategory,
          pointsAdded,
          date: incidentDate,
          time: incidentTime,
          location: incidentLocation || 'Lokal Sekolah',
          notes,
          handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy,
        });
      }
    } else {
      // Multiple students selected: save directly for each in a loop
      selectedStudents.forEach((student) => {
        onSaveViolation({
          studentId: student.id,
          studentName: student.name,
          studentClass: student.class,
          category: violationCategory,
          pointsAdded,
          date: incidentDate,
          time: incidentTime,
          location: incidentLocation || 'Lokal Sekolah',
          reportedBy: activeCounselor.name,
          notes,
          handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy,
          handlingProgress: handlingProgress || (handledBy === 'Belum Ditangani' ? 'Teguran persuasif & pembinaan tingkat kelas oleh Wali Kelas.' : 'Tercatat dalam penanganan kelompok.'),
          proofPhotoUrl,
          proofPhotoName,
        });
      });

      proceedPostSave({
        students: selectedStudents,
        category: violationCategory,
        pointsAdded,
        date: incidentDate,
        time: incidentTime,
        location: incidentLocation || 'Lokal Sekolah',
        notes,
        handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy,
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-[#3d4947] opacity-80">
        <button onClick={onCancel} className="hover:text-[#00685f] cursor-pointer">
          Dashboard
        </button>
        <ChevronRight className="w-3 h-3 text-[#bcc9c6]" />
        <button onClick={onCancel} className="hover:text-[#00685f] cursor-pointer">
          Disiplin Positif &amp; Restitusi
        </button>
        <ChevronRight className="w-3 h-3 text-[#bcc9c6]" />
        <span className="text-[#00685f] font-bold">
          Arsip Pembinaan &amp; Riwayat Pelanggaran
        </span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#00685f] tracking-tight">
            Arsip Pembinaan &amp; Riwayat Pelanggaran
          </h2>
          <p className="text-sm text-[#3d4947]/70 font-semibold mt-1">
            Pantau rujukan baru dari Link Piket dan seluruh riwayat data lama sebelum sistem baru. Semua data lama tetap terjaga utuh dan dapat ditindaklanjuti.
          </p>
        </div>
      </div>

      {/* 2 Tabs Utama di Arsip: Rujukan Baru dari Piket | Riwayat Lama (Tanpa tombol Catat Pelanggaran Guru BK) */}
      <div className="flex flex-wrap border-b border-gray-200 gap-2">
        <button
          type="button"
          onClick={() => setArchiveOriginTab('rujukan')}
          className={`pb-3 px-5 text-sm font-extrabold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            archiveOriginTab === 'rujukan'
              ? 'border-[#00685f] text-[#00685f]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span>Rujukan Baru dari Piket</span>
          <span
            className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
              archiveOriginTab === 'rujukan'
                ? 'bg-[#00685f] text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {rujukanCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setArchiveOriginTab('lama')}
          className={`pb-3 px-5 text-sm font-extrabold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            archiveOriginTab === 'lama'
              ? 'border-[#00685f] text-[#00685f]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span>Riwayat Lama</span>
          <span
            className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
              archiveOriginTab === 'lama'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            {riwayatLamaCount}
          </span>
        </button>
      </div>

      {activeTab === 'arsip' ? (
        <div className="space-y-5">
          {/* 🌟 DASHBOARD PEMULIHAN (DI ATAS TABEL ARSIP) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#bcc9c6]/30 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#bcc9c6]/20 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-[#00685f]/10 px-2.5 py-0.5 rounded-md border border-[#00685f]/15">
                    Dashboard Pemulihan
                  </span>
                  <span className="text-xs font-bold text-gray-500">
                    Periode: {activeMonthLabel}
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#0b1c30] mt-0.5">
                  Ringkasan Pemulihan & Restitusi Siswa
                </h3>
              </div>
              <div className="text-xs text-gray-500 font-semibold self-start sm:self-auto bg-gray-50 px-3 py-1 rounded-xl border border-gray-200">
                Total Arsip: <strong className="text-[#00685f]">{violations?.length || 0}</strong> catatan
              </div>
            </div>

            {/* 4 Kartu Kecil di Atas Tabel */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* 1. Total Kasus Bulan Ini */}
              <div className="bg-[#f8faf9] border border-[#bcc9c6]/40 rounded-xl p-3.5 sm:p-4 shadow-2xs hover:border-[#00685f]/40 transition-all">
                <div className="flex items-center justify-between text-xs font-bold text-gray-600 mb-1">
                  <span>Total Kasus Bulan Ini</span>
                  <FileText className="w-4 h-4 text-[#00685f]" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[#0b1c30]">
                  {monthStats.total}
                </div>
                <div className="text-[11px] text-gray-500 font-medium mt-1">
                  Total kejadian di {activeMonthLabel}
                </div>
              </div>

              {/* 2. Sudah Selesai Restitusi: [angka] hijau */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 sm:p-4 shadow-2xs hover:border-emerald-300 transition-all">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-800 mb-1">
                  <span>Sudah Selesai Restitusi</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600">
                  {monthStats.selesai}
                </div>
                <div className="text-[11px] text-emerald-700 font-medium mt-1">
                  Pemulihan tuntas / dipantau
                </div>
              </div>

              {/* 3. Masih Proses Restitusi: [angka] kuning */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 sm:p-4 shadow-2xs hover:border-amber-300 transition-all">
                <div className="flex items-center justify-between text-xs font-bold text-amber-900 mb-1">
                  <span>Masih Proses Restitusi</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-600">
                  {monthStats.proses}
                </div>
                <div className="text-[11px] text-amber-800 font-medium mt-1">
                  Sedang jalankan kesepakatan
                </div>
              </div>

              {/* 4. Baru Dicatat Belum Ditangani: [angka] merah */}
              <div className="bg-red-50/70 border border-red-200 rounded-xl p-3.5 sm:p-4 shadow-2xs hover:border-red-300 transition-all">
                <div className="flex items-center justify-between text-xs font-bold text-red-900 mb-1">
                  <span>Baru Dicatat Belum Ditangani</span>
                  <AlertCircle className="w-4 h-4 text-red-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-red-600">
                  {monthStats.baruDicatat}
                </div>
                <div className="text-[11px] text-red-700 font-medium mt-1">
                  Belum dipanggil konseling
                </div>
              </div>
            </div>

            {/* Di bawah 4 kartu, 2 kotak */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 pt-1">
              {/* Kotak Kiri: Kasus Terbanyak Bulan Ini */}
              <div className="bg-[#f8faf9] border border-[#bcc9c6]/30 rounded-xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-3 border-b border-[#bcc9c6]/20 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00685f]"></span>
                    <h4 className="text-xs sm:text-sm font-extrabold text-[#0b1c30]">
                      Kasus Terbanyak Bulan Ini
                    </h4>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">Top 3</span>
                </div>
                {topCategoriesMonth.length > 0 ? (
                  <div className="space-y-2">
                    {topCategoriesMonth.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs p-2.5 bg-white border border-[#bcc9c6]/30 rounded-lg hover:border-[#00685f]/30 transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                              idx === 0
                                ? 'bg-[#00685f] text-white'
                                : idx === 1
                                ? 'bg-teal-100 text-[#00685f]'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-bold text-[#0b1c30] line-clamp-1">
                            {item.category}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 bg-gray-100 text-[#00685f] font-black text-xs rounded-md shrink-0">
                          {item.count} kasus
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 py-4 text-center font-medium">
                    Belum ada data kasus di bulan ini.
                  </div>
                )}
              </div>

              {/* Kotak Kanan: Kelas Terbanyak */}
              <div className="bg-[#f8faf9] border border-[#bcc9c6]/30 rounded-xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-3 border-b border-[#bcc9c6]/20 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <h4 className="text-xs sm:text-sm font-extrabold text-[#0b1c30]">
                      Kelas Terbanyak
                    </h4>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">Top 3</span>
                </div>
                {topClassesMonth.length > 0 ? (
                  <div className="space-y-2">
                    {topClassesMonth.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs p-2.5 bg-white border border-[#bcc9c6]/30 rounded-lg hover:border-amber-400/40 transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                              idx === 0
                                ? 'bg-amber-500 text-white'
                                : idx === 1
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-bold text-[#0b1c30]">
                            Kelas {item.className}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 bg-amber-100/70 text-amber-900 font-black text-xs rounded-md shrink-0">
                          {item.count} kasus
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 py-4 text-center font-medium">
                    Belum ada data kelas di bulan ini.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Archive Container: Always-Visible Search + Multi-Chip Filter + Cards/Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#bcc9c6]/30 overflow-hidden">
            {/* Header & Always-Visible Main Search Bar */}
            <div className="p-5 sm:p-6 border-b border-[#bcc9c6]/30 bg-[#f8f9ff] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00685f]/10 text-[#00685f] flex items-center justify-center shadow-2xs shrink-0">
                    <Gavel className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#0b1c30]">
                      {archiveOriginTab === 'rujukan'
                        ? 'Rujukan Baru dari Piket'
                        : 'Riwayat Lama (Data Pelanggaran Sebelum Sistem Baru)'}
                    </h3>
                    <p className="text-xs text-[#3d4947]/80 font-medium">
                      {archiveOriginTab === 'rujukan'
                        ? 'Laporan masuk dari Link Piket yang belum maupun sudah ditindaklanjuti.'
                        : 'Seluruh data pelanggaran lama tetap aman, diberi label Data Lama, dan tetap dapat dibuka atau ditindaklanjuti.'}
                    </p>
                  </div>
                </div>
                <div className="text-xs font-extrabold text-[#00685f] bg-white px-3.5 py-2 rounded-xl border border-[#00685f]/25 shadow-2xs self-start sm:self-auto shrink-0">
                  Ditemukan {filteredViolations.length} laporan
                </div>
              </div>

              {/* 1 Baris Pencarian Utama yang Selalu Terlihat */}
              <div className="relative">
                <Search className="w-4.5 h-4.5 text-[#00685f] absolute left-4 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="🔍 Cari Nama Siswa / NIS..."
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  className="w-full bg-white border-2 border-[#bcc9c6]/60 focus:border-[#00685f] rounded-xl pl-11 pr-24 py-3 text-sm font-bold text-[#0b1c30] focus:outline-none shadow-xs transition-colors"
                />
                {archiveSearch && (
                  <button
                    type="button"
                    onClick={() => setArchiveSearch('')}
                    className="absolute right-3 top-2.5 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-[11px] font-bold text-gray-600 cursor-pointer"
                  >
                    Bersihkan
                  </button>
                )}
                {archiveSearch.trim().length === 1 && (
                  <p className="text-[11px] text-amber-700 font-semibold mt-1 pl-1">
                    Ketik minimal 2 huruf untuk langsung memfilter nama siswa atau NIS...
                  </p>
                )}
              </div>

              {/* Quick Filter Chips & Dropdowns */}
              <div className="space-y-3 pt-1">
                {/* Baris 1: Dropdown Kelas, Kategori, & Pelapor + Waktu */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {/* Dropdown Kelas */}
                  <div className="bg-white border border-[#bcc9c6]/50 rounded-xl px-3 py-2 flex items-center gap-2 shadow-2xs">
                    <span className="text-[11px] font-extrabold text-[#3d4947] shrink-0">Kelas:</span>
                    <select
                      value={selectedClasses.length === 1 ? selectedClasses[0] : 'Semua'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Semua') setSelectedClasses([]);
                        else setSelectedClasses([val]);
                      }}
                      className="w-full bg-transparent text-xs font-extrabold text-[#0b1c30] focus:outline-none cursor-pointer"
                    >
                      <option value="Semua">Semua ({classFilterChips.length} Kelas)</option>
                      {classFilterChips.map((cls) => (
                        <option key={cls} value={cls}>
                          Kelas {cls}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dropdown Kategori */}
                  <div className="bg-white border border-[#bcc9c6]/50 rounded-xl px-3 py-2 flex items-center gap-2 shadow-2xs">
                    <span className="text-[11px] font-extrabold text-[#3d4947] shrink-0">Kategori:</span>
                    <select
                      value={selectedCategoryChips.length === 1 ? selectedCategoryChips[0] : 'Semua'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Semua') setSelectedCategoryChips([]);
                        else setSelectedCategoryChips([val]);
                      }}
                      className="w-full bg-transparent text-xs font-extrabold text-[#0b1c30] focus:outline-none cursor-pointer"
                    >
                      <option value="Semua">Semua Kategori</option>
                      {ARCHIVE_CATEGORY_CHIPS.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dropdown Pelapor (realtime Firestore `teachers` + pelapor laporan) */}
                  <div className="bg-white border border-[#bcc9c6]/50 rounded-xl px-3 py-2 flex items-center gap-2 shadow-2xs">
                    <span className="text-[11px] font-extrabold text-[#3d4947] shrink-0">Pelapor:</span>
                    <select
                      value={selectedPelapor}
                      onChange={(e) => setSelectedPelapor(e.target.value)}
                      className="w-full bg-transparent text-xs font-extrabold text-[#0b1c30] focus:outline-none cursor-pointer"
                    >
                      <option value="Semua">Semua Pelapor</option>
                      {pelaporOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Multi-select Chips: Kelas */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-extrabold text-[#3d4947] mr-1">Kelas:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedClasses([])}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                      selectedClasses.length === 0
                        ? 'bg-[#00685f] text-white border-[#00685f]'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Semua
                  </button>
                  {classFilterChips.map((cls) => {
                    const active = selectedClasses.includes(cls);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() =>
                          setSelectedClasses((prev) =>
                            prev.includes(cls) ? prev.filter((item) => item !== cls) : [...prev, cls]
                          )
                        }
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          active
                            ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-[#00685f]/50 hover:bg-teal-50/40'
                        }`}
                      >
                        {cls}
                      </button>
                    );
                  })}
                </div>

                {/* Multi-select Chips: Kategori */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-extrabold text-[#3d4947] mr-1">Kategori:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryChips([])}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                      selectedCategoryChips.length === 0
                        ? 'bg-[#00685f] text-white border-[#00685f]'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Semua
                  </button>
                  {ARCHIVE_CATEGORY_CHIPS.map((cat) => {
                    const active = selectedCategoryChips.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setSelectedCategoryChips((prev) =>
                            prev.includes(cat) ? prev.filter((item) => item !== cat) : [...prev, cat]
                          )
                        }
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          active
                            ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-[#00685f]/50 hover:bg-teal-50/40'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {/* Chips: Waktu & Status */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  {/* Waktu */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-extrabold text-[#3d4947] mr-1">Waktu:</span>
                    {(
                      [
                        { id: 'today', label: 'Hari Ini' },
                        { id: 'week', label: 'Minggu Ini' },
                        { id: 'month', label: 'Bulan Ini' },
                        { id: 'all', label: 'Semua' },
                      ] as { id: ArchiveTimeFilterKey; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTimeFilter(opt.id)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          timeFilter === opt.id
                            ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Status Multi-Select */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-extrabold text-[#3d4947] mr-1">Status:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedStatusChips([])}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        selectedStatusChips.length === 0
                          ? 'bg-[#00685f] text-white border-[#00685f]'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      Semua
                    </button>
                    {(['Baru', 'Sudah Ditindaklanjuti', 'Selesai'] as ArchiveStatusFilterKey[]).map((st) => {
                      const active = selectedStatusChips.includes(st);
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() =>
                            setSelectedStatusChips((prev) =>
                              prev.includes(st) ? prev.filter((item) => item !== st) : [...prev, st]
                            )
                          }
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Active Filter Summary Banner */}
              {activeFilterSummaryParts.length > 0 && (
                <div className="bg-teal-50/80 border border-teal-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#0b1c30]">
                    Menampilkan <strong className="text-[#00685f]">{filteredViolations.length}</strong> hasil untuk:{' '}
                    <span className="text-[#00685f] font-extrabold">{activeFilterSummaryParts.join(' - ')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleResetArchiveFilters}
                    className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-extrabold cursor-pointer transition-colors"
                  >
                    Reset Filter
                  </button>
                </div>
              )}
            </div>

            {/* List Laporan (Urut Terbaru ke Terlama) */}
            <div className="p-4 sm:p-6 space-y-3 bg-[#f8faf9]">
              {filteredViolations.length > 0 ? (
                filteredViolations.map((v, index) => {
                  const curStatus = getViolationRestitutionStatus(v);
                  const cfg = RESTITUTION_STATUS_CONFIG[curStatus];
                  const origin = getViolationOriginDisplay(v);
                  const resolvedNis =
                    String(v.nis || '').trim() ||
                    studentNisMap.get(String(v.studentId || '')) ||
                    studentNisMap.get(String(v.studentName || '').trim().toLowerCase()) ||
                    '';

                  return (
                    <div
                      key={v.id}
                      className="bg-white border border-[#bcc9c6]/40 hover:border-[#00685f]/40 rounded-2xl p-4 sm:p-5 shadow-2xs transition-all space-y-3"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                        {/* Kiri: Identitas Siswa, Asal Data & Kategori */}
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold text-gray-400">#{index + 1}</span>
                            {v.ticketId && (
                              <span className="text-[11px] font-extrabold text-[#ba1a1a] bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg">
                                {v.ticketId}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-lg bg-[#00685f]/10 text-[#00685f] font-extrabold text-[11px]">
                              Kelas {v.studentClass}
                            </span>
                            {!origin.isPiket ? (
                              <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-extrabold">
                                Data Lama
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold">
                                Link Piket
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-lg bg-red-50 text-red-700 font-black text-[11px]">
                              +{v.pointsAdded} Poin
                            </span>
                          </div>

                          <div className="flex flex-wrap items-baseline gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (onNavigateToProfile) {
                                  onNavigateToProfile(v.studentId || v.studentName);
                                } else {
                                  const st = students.find(
                                    (s) => s.id === v.studentId || s.name === v.studentName
                                  );
                                  if (st) {
                                    setSelectedStudentForEdit(st);
                                    setEditStudentName(st.name);
                                    setEditStudentClass(st.class);
                                    setEditStudentNis(st.nis);
                                  }
                                }
                              }}
                              className="text-base font-extrabold text-[#0b1c30] hover:text-[#00685f] hover:underline cursor-pointer text-left"
                              title="Klik untuk membuka Profil Siswa (Riwayat Lengkap)"
                            >
                              {isPrivacyMode ? `Siswa ${index + 1} (${v.studentClass})` : v.studentName}
                            </button>
                            {resolvedNis && !isPrivacyMode && (
                              <span className="text-xs font-mono text-gray-500">NIS: {resolvedNis}</span>
                            )}
                          </div>

                          <p className="text-xs font-bold text-[#0b1c30]">
                            Kategori: <span className="text-[#ba1a1a]">{v.category}</span>
                          </p>

                          {v.notes && (
                            <p className="text-xs text-[#3d4947] bg-[#f8faf9] border border-gray-200/70 rounded-xl px-3 py-2 line-clamp-2">
                              {v.notes}
                            </p>
                          )}

                          {/* Asal Data Wajib Jelas */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600 pt-1">
                            <span className="flex items-center gap-1 font-semibold text-gray-700">
                              <Clock className="w-3.5 h-3.5 text-[#00685f]" />
                              {formatCardDateTime(v.date, v.time)}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span>
                              Dilaporkan oleh: <strong className="text-[#0b1c30]">{origin.reporterLabel}</strong>
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200">
                              reportedVia: {origin.reportedViaLabel}
                            </span>
                          </div>
                        </div>

                        {/* Kanan: Status Restitusi & Tombol Aksi */}
                        <div className="flex flex-col items-start lg:items-end justify-between gap-3 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenStatusModal(v)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border shadow-2xs transition-all cursor-pointer active:scale-95 ${cfg.colorBadge}`}
                            title="Klik untuk mengubah status penanganan & restitusi"
                          >
                            <span className={`w-2 h-2 rounded-full ${cfg.colorDot}`} />
                            <span>{curStatus}</span>
                            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                          </button>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {onCreateFollowUpCounseling && (
                              <button
                                type="button"
                                onClick={() => {
                                  const st = students.find(
                                    (s) => s.id === v.studentId || s.name === v.studentName
                                  );
                                  const studentObj: Student = st || {
                                    id: v.studentId,
                                    name: v.studentName,
                                    class: v.studentClass,
                                    nis: resolvedNis || '-',
                                    gender: 'L',
                                    violationPoints: v.pointsAdded,
                                    bkServicesCount: 0,
                                    initials: (v.studentName || 'S').slice(0, 2).toUpperCase(),
                                  };
                                  onCreateFollowUpCounseling({
                                    students: [studentObj],
                                    problem: `Tindak Lanjut Pembinaan Disiplin: ${v.category}`,
                                    description: `Sesi tindak lanjut layanan konseling dan restitusi disiplin positif atas pelanggaran "${v.category}" (${v.date}). Tiket: #${v.ticketId || v.id}. Catatan kejadian: ${v.notes || '-'}`,
                                    serviceType: 'Layanan Konseling Perorangan (Individual)',
                                    targetType: 'Individu',
                                    status: 'Terjadwal',
                                    violationContext: {
                                      category: v.category,
                                      pointsAdded: v.pointsAdded,
                                      date: v.date,
                                      notes: v.notes,
                                      ticketId: v.ticketId,
                                      violationId: v.id,
                                    },
                                  });
                                }}
                                className="px-2.5 py-1.5 bg-emerald-50 text-[#00685f] hover:bg-[#00685f] hover:text-white rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-2xs border border-emerald-300 flex items-center gap-1"
                                title="Tindak lanjuti melalui Sesi Layanan Konseling BK"
                              >
                                <HeartHandshake className="w-3.5 h-3.5" />
                                <span>Tindak Lanjut</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setDetailViolation(v);
                                setCaseDriveFailed(false);
                              }}
                              className="px-2.5 py-1.5 bg-[#00685f]/10 text-[#00685f] hover:bg-[#00685f] hover:text-white rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-2xs border border-[#00685f]/30 flex items-center gap-1"
                              title="Buka Detail Laporan"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Detail</span>
                            </button>

                            {v.pdfUrl && (
                              <a
                                href={v.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white rounded-xl font-bold transition-all cursor-pointer shadow-2xs border border-emerald-300"
                                title="Lihat PDF di Google Drive"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => downloadViolationPDF(v)}
                              className="p-1.5 bg-[#ba1a1a]/10 text-[#ba1a1a] hover:bg-[#ba1a1a] hover:text-white rounded-xl font-bold transition-all cursor-pointer shadow-2xs"
                              title={v.pdfUrl ? 'Download Ulang PDF' : 'Unduh Bukti Pelanggaran PDF'}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditingViolation(v)}
                              className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl font-bold transition-all cursor-pointer shadow-2xs border border-blue-200"
                              title="Edit Catatan Ini"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {onDeleteViolation && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDeleteTarget({
                                    type: 'violation',
                                    id: v.id,
                                    title: `Hapus Laporan ${v.studentName}`,
                                    message: `Hapus laporan "${v.category}" milik ${v.studentName} (${v.studentClass})?`,
                                    step: 1,
                                  })
                                }
                                className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl font-bold transition-all cursor-pointer shadow-2xs border border-red-200"
                                title="Hapus 1 Laporan Ini (Pindah ke Sampah)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 p-10 text-center space-y-3">
                  <p className="text-sm font-bold text-gray-600">
                    Tidak ada laporan untuk pencarian ini.
                  </p>
                  <button
                    type="button"
                    onClick={handleResetArchiveFilters}
                    className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
                  >
                    Reset Filter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Main Card Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#bcc9c6]/30 overflow-hidden">
            {/* Detail Header banner */}
            <div className="p-6 border-b border-[#bcc9c6]/30 bg-[#f8f9ff] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 bg-[#ffdad6] text-[#ba1a1a]">
                  <Gavel className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0b1c30]">
                    Detail Pembinaan & Restitusi Karakter
                  </h3>
                  <p className="text-xs text-[#3d4947]/70 font-semibold">
                    Mohon lengkapi seluruh kolom yang tersedia di bawah sesuai pedoman disiplin positif.
                  </p>
                </div>
              </div>
              <div className="bg-[#eff4ff] border border-[#bcc9c6]/30 rounded-full px-4 py-1.5 self-start sm:self-center">
                <p className="text-xs text-[#0b1c30] font-semibold">
                  ID Tiket: <span className="font-extrabold text-[#00685f]">#{ticketId}</span>
                </p>
              </div>
            </div>

            {/* Input Form Body */}
            <form onSubmit={handleSubmit} className="p-8 space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Student Combobox & Autocomplete Selector with Bulk Mode */}
                <div className="space-y-3 relative md:col-span-2 bg-[#f8faf9] p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                    <div>
                      <label className="text-xs font-black text-[#0b1c30] flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#00685f]" />
                        <span>Pilih Siswa Terlibat (Bisa Pilih Banyak Siswa Sekaligus)</span>
                      </label>
                      <p className="text-[11px] text-gray-500 font-semibold mt-0.5">
                        Ketik nama untuk menambah satu-satu, atau klik tombol di sebelah kanan untuk memilih kelompok/kelas sekaligus.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setBulkSelectedIds(selectedStudents.map((s) => s.id));
                        setShowBulkModal(true);
                      }}
                      className="px-3.5 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs shrink-0 active:scale-97"
                    >
                      <Users className="w-4 h-4" />
                      <span>⚡ Pilih Banyak Siswa Sekaligus</span>
                    </button>
                  </div>

                  <StudentCombobox
                    students={students}
                    selectedStudentId={selectedStudents[selectedStudents.length - 1]?.id}
                    onSelectStudent={(st) => {
                      if (st) {
                        if (!selectedStudents.some((s) => s.id === st.id)) {
                          setSelectedStudents((prev) => [...prev, st]);
                          showToast(`+ ${st.name} (${st.class}) ditambahkan`, 'success');
                        } else {
                          showToast(`${st.name} sudah ada di daftar terpilih`, 'info');
                        }
                      }
                    }}
                    placeholder="Ketik Nama, NIS, NISN, atau Kelas untuk menambah siswa..."
                    required={selectedStudents.length === 0}
                  />

                  {/* Selected students display */}
                  {selectedStudents.length > 0 && (
                    <div className="pt-2 space-y-2 border-t border-[#bcc9c6]/30">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-[#0b1c30] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#00685f]"></span>
                          Daftar Siswa Terlibat ({selectedStudents.length} Orang):
                        </span>
                        {selectedStudents.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setSelectedStudents([])}
                            className="text-[10px] font-black text-red-600 hover:underline cursor-pointer"
                          >
                            Batal Pilih Semua ({selectedStudents.length})
                          </button>
                        )}
                      </div>

                      {selectedStudents.length > 1 && (
                        <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-[#00685f]">
                          <span className="flex items-center gap-2">
                            <Users className="w-4 h-4 shrink-0" />
                            <span>
                              <strong>Mode Kolektif Aktif:</strong> Pelanggaran & bobot pembinaan (+{pointsAdded}) ini akan langsung dicatat secara individual untuk seluruh <strong>{selectedStudents.length} siswa</strong> di atas sekaligus dalam satu kali klik.
                            </span>
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                        {selectedStudents.map((student) => (
                          <div
                            key={student.id}
                            className="px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold shadow-2xs bg-white border-[#00685f]/30 text-[#0b1c30]"
                          >
                            <span className="w-2 h-2 rounded-full bg-[#00685f] shrink-0"></span>
                            <span>
                              {student.name} <span className="text-[#00685f] font-mono">({student.class})</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudents(selectedStudents.filter((s) => s.id !== student.id));
                              }}
                              className="p-0.5 rounded-full hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors cursor-pointer ml-1"
                              title="Hapus siswa ini dari daftar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 1. Kategori Pelanggaran (Main Category Selection) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
                    <span>Kategori Bimbingan Perilaku (Keyakinan Sekolah)</span>
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setSelectedOptionId('');
                      setCustomViolationLabel('');
                    }}
                    required
                    className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
                  >
                    <option value="">Pilih Kategori Perilaku...</option>
                    {currentCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Pilihan Pelanggaran Spesifik (Specific Violation Options) */}
                {selectedCategory && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200 md:col-span-2">
                    <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                      <ChevronRight className="w-4.5 h-4.5 text-[#00685f]" />
                      <span>Bentuk Rekonstruksi & Refleksi Perilaku</span>
                    </label>
                    <select
                      value={selectedOptionId}
                      onChange={(e) => setSelectedOptionId(e.target.value)}
                      required
                      className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
                    >
                      <option value="">Pilih Bentuk Perilaku Indisipliner...</option>
                      {currentCategories.find(c => c.id === selectedCategory)?.options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} (Bobot: {opt.points})
                        </option>
                      ))}
                      <option value="other">Lainnya (Refleksi Kustom & Tentukan Bobot)</option>
                    </select>
                  </div>
                )}

                {/* 3. Custom / Manual inputs for Custom Violation and Points */}
                {selectedCategory && selectedOptionId === 'other' && (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-orange-50/50 rounded-2xl border border-orange-200/60 animate-in slide-in-from-top-2 duration-300">
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-orange-800">
                        Deskripsi Perilaku Khusus
                      </label>
                      <input
                        type="text"
                        value={customViolationLabel}
                        onChange={(e) => setCustomViolationLabel(e.target.value)}
                        placeholder="Contoh: Perilaku yang butuh pendampingan khusus..."
                        required
                        className="w-full bg-white border border-orange-300/65 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-orange-800">
                        Bobot Pembinaan (Dukungan)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={pointsAdded}
                        onChange={(e) => setPointsAdded(Math.max(1, parseInt(e.target.value) || 0))}
                        required
                        className="w-full bg-white border border-orange-300/65 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Real-time reactive projected points display block */}
              {selectedStudent && violationCategory && (
                <div className="p-4 bg-[#f8f9ff] rounded-xl border border-[#bcc9c6]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-[#3d4947] uppercase tracking-wider opacity-80">
                      Bobot Pendampingan Perilaku Baru:
                    </p>
                    <h4 className="text-sm font-extrabold mt-1 text-[#ba1a1a]">
                      Bobot +{pointsAdded}
                    </h4>
                  </div>
                  <div className="hidden sm:block h-10 w-[1px] bg-[#bcc9c6]/40"></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-[#3d4947] uppercase tracking-wider opacity-80">
                      Akumulasi Bobot Pendampingan:
                    </p>
                    <h4 className="text-sm font-extrabold text-[#0b1c30] mt-1">
                      {currentPoints} <span className="text-[#ba1a1a] font-black">→ {projectedPoints}</span>
                    </h4>
                  </div>
                </div>
              )}

              {/* Conditional Escalation threshold Warning Alert banner */}
              {selectedStudent && violationCategory && isEscalating && (
                <div className="bg-[#ffdad6] border-2 border-[#ba1a1a] p-4.5 rounded-xl flex gap-3.5 items-start shadow-sm animate-in zoom-in-95 duration-300">
                  <ShieldAlert className="w-8 h-8 text-[#ba1a1a] flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-extrabold text-[#ba1a1a] text-sm leading-snug">
                      Eskalasi Pendampingan Terdeteksi!
                    </h5>
                    <p className="text-xs text-[#93000a] opacity-90 mt-1 leading-relaxed font-semibold">
                      Akumulasi bobot pembinaan siswa mencapai batas peringatan otomatis ({projectedPoints}). Sesuai Permendikbudristek 46/2023, Guru BK direkomendasikan menjadwalkan ruang dialog pemulihan karakter (restorative justice) bersama orang tua/wali murid.
                    </p>
                  </div>
                </div>
              )}

              {/* Date, Time & Location Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0b1c30]">Tanggal Kejadian</label>
                  <input
                    type="date"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    required
                    className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0b1c30]">Waktu</label>
                  <input
                    type="time"
                    value={incidentTime}
                    onChange={(e) => setIncidentTime(e.target.value)}
                    required
                    className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0b1c30]">Lokasi</label>
                  <input
                    type="text"
                    value={incidentLocation}
                    onChange={(e) => setIncidentLocation(e.target.value)}
                    placeholder="Misal: Kantin, Lab Fisika, Kelas 8A"
                    required
                    className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
                  />
                </div>
              </div>

              {/* PPKSP Permendikbudristek 46/2023 Advisory Notice */}
              {selectedCategory && (selectedCategory.includes('ppksp') || selectedCategory.includes('berat') || selectedCategory.includes('kriminal')) && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 animate-in fade-in duration-200">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="text-xs font-black text-rose-950">
                      Isu Perlindungan Anak & Ranah TPPK (Permendikbudristek No. 46/2023)
                    </h5>
                    <p className="text-[11px] text-rose-800 leading-relaxed font-medium">
                      Kasus ini tergolong ke dalam indikasi tindak kekerasan satuan pendidikan. Utamakan pemulihan fisik & psikis korban, jaga kerahasiaan identitas, libatkan Tim TPPK sekolah, dan berlakukan sanksi edukatif-rehabilitatif bagi pelaku anak sesuai Sistem Peradilan Pidana Anak (SPPA).
                    </p>
                  </div>
                </div>
              )}

              {/* Catatan Kejadian & Bantuan Segitiga Restitusi (Kurikulum Merdeka) */}
              <div className="space-y-2.5 p-4.5 bg-[#f8faf9] rounded-2xl border border-[#bcc9c6]/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-extrabold text-[#0b1c30] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#00685f]" />
                    <span>Catatan Kronologi & Pendekatan Segitiga Restitusi</span>
                  </label>
                  <span className="text-[10px] text-gray-500 font-bold bg-white px-2 py-0.5 rounded-full border border-gray-200">
                    Format Panduan BK Kurikulum Merdeka
                  </span>
                </div>

                {/* Quick-fill Restitusi buttons */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="font-bold text-gray-400 uppercase">Bantuan Tuturan Restitusi:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = 'Siswa diajak berdialog tenang untuk menstabilkan identitas: menyadari setiap manusia pernah khilaf dan fokus pada perbaikan diri.';
                      setNotes(prev => prev ? `${prev}\n- ${snippet}` : `- ${snippet}`);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-teal-50 text-[#00685f] border border-teal-200 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    1. Stabilkan Identitas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = 'Validasi tindakan: menelusuri alasan di balik perilaku siswa guna memahami kebutuhan dasar (kasih sayang/kebebasan/pengakuan) yang ingin ia penuhi.';
                      setNotes(prev => prev ? `${prev}\n- ${snippet}` : `- ${snippet}`);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-teal-50 text-[#00685f] border border-teal-200 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    2. Validasi Kebutuhan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = 'Menanyakan keyakinan: siswa menghubungkan tindakannya dengan keyakinan kelas yang disepakati dan menyusun komitmen restitusi mandiri.';
                      setNotes(prev => prev ? `${prev}\n- ${snippet}` : `- ${snippet}`);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-teal-50 text-[#00685f] border border-teal-200 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    3. Keyakinan & Solusi Restitusi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = 'Pemetaan Sebab-Akibat (Lampiran 1 BSKAP): Peristiwa diidentifikasi secara objektif, siswa memetakan dampak terhadap diri & lingkungan, serta menyepakati perjanjian solusi konsekuensi.';
                      setNotes(prev => prev ? `${prev}\n- ${snippet}` : `- ${snippet}`);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    4. Sebab-Akibat (Lamp 1)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = 'Refleksi Glasser 1965 (Lampiran 3 BSKAP): Konselor membantu siswa mengevaluasi diri ("Apakah perilaku ini membantumu?"), merumuskan strategi konkrit, dan menyepakati komitmen tindak lanjut.';
                      setNotes(prev => prev ? `${prev}\n- ${snippet}` : `- ${snippet}`);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    5. Refleksi Glasser (Lamp 3)
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tuliskan catatan kejadian kronologis, respon siswa, dan komitmen restitusi perbaikan perilaku..."
                  className="w-full bg-white border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-xs text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-2xs font-medium"
                />
              </div>

              {/* Progressive Disclosure: Collapsible Section for Optional Monitoring & Photo Evidence */}
              <div className="border border-[#bcc9c6]/30 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => setShowOptionalFields(!showOptionalFields)}
                  className="w-full px-5 py-3.5 flex items-center justify-between bg-[#f8faf9] hover:bg-gray-100/70 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Sliders className="w-4 h-4 text-[#00685f]" />
                    <div>
                      <h4 className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                        Monitoring Lanjutan & Bukti Foto (Opsional)
                      </h4>
                      <p className="text-[11px] text-gray-500 font-semibold mt-0.5">
                        {showOptionalFields
                          ? 'Klik untuk menyembunyikan kolom pendukung'
                          : 'Status penanganan wali kelas/guru BK dan lampiran foto bukti fisik kejadian'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(handledBy !== 'Belum Ditangani' || proofPhotoUrl) && (
                      <span className="text-[10px] bg-[#00685f]/10 text-[#00685f] font-bold px-2 py-0.5 rounded-full">
                        Terisi
                      </span>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                        showOptionalFields ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {showOptionalFields && (
                  <div className="p-6 space-y-6 border-t border-[#bcc9c6]/20 bg-white animate-in slide-in-from-top-2 duration-200">
                    {/* Monitoring Penanganan Wali Kelas / Guru BK */}
                    <div className="p-4 bg-[#eff4ff]/50 rounded-xl border border-blue-100 space-y-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0b1c30] flex items-center gap-2">
                        <span className="w-1.5 h-3.5 bg-blue-600 rounded-full"></span>
                        Monitoring Penanganan Kasus
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[#0b1c30]">
                            Status Penanganan
                          </label>
                          <select
                            value={handledBy}
                            onChange={(e) => setHandledBy(e.target.value as any)}
                            className="w-full bg-white border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-2xs"
                          >
                            <option value="Belum Ditangani">Belum Ditangani / Dalam Proses</option>
                            <option value="Wali Kelas">Sudah Ditangani Wali Kelas</option>
                            <option value="Guru BK">Sudah Ditangani Guru BK</option>
                            <option value="Wali Kelas & Guru BK">Sudah Ditangani Wali Kelas & Guru BK</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[#0b1c30]">
                            Penanganan Sejauh Apa
                          </label>
                          <input
                            type="text"
                            value={handlingProgress}
                            onChange={(e) => setHandlingProgress(e.target.value)}
                            disabled={handledBy === 'Belum Ditangani'}
                            placeholder={
                              handledBy === 'Belum Ditangani'
                                ? 'Pilih penangan terlebih dahulu...'
                                : 'Contoh: Pemberian surat peringatan, pembinaan...'
                            }
                            required={handledBy !== 'Belum Ditangani'}
                            className={`w-full border rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-2xs ${
                              handledBy === 'Belum Ditangani'
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                : 'bg-white text-[#0b1c30] border-[#bcc9c6]/40'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Foto Bukti Pelanggaran (Kamera HP / Upload File) */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-[#00685f]" />
                        <span>Bukti Foto Kejadian / Fisik (Opsional)</span>
                      </label>
                      <p className="text-[11px] text-gray-500 font-semibold">
                        Ambil foto langsung melalui kamera HP/laptop Anda atau unggah file foto dari penyimpanan.
                      </p>

                      {proofPhotoUrl ? (
                        <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 p-3 max-w-sm text-center">
                          <img
                            src={proofPhotoUrl}
                            alt="Bukti Foto Pelanggaran"
                            className="max-h-48 mx-auto object-contain rounded-lg"
                            referrerPolicy="no-referrer"
                          />
                          <p className="text-[10px] text-gray-500 truncate mt-2 font-bold">
                            {proofPhotoName}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setProofPhotoUrl(undefined);
                              setProofPhotoName(undefined);
                            }}
                            className="absolute top-2.5 right-2.5 bg-red-600 text-white hover:bg-red-700 p-1.5 rounded-full shadow-md cursor-pointer transition-colors"
                            title="Hapus Foto"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="max-w-md">
                          {showCamera ? (
                            <div className="relative bg-black rounded-xl overflow-hidden border border-gray-300">
                              {cameraError ? (
                                <div className="p-4 text-center text-xs text-red-600 font-semibold">
                                  <AlertCircle className="w-6 h-6 mx-auto text-red-600 mb-1" />
                                  <p>{cameraError}</p>
                                  <button
                                    type="button"
                                    onClick={stopCamera}
                                    className="mt-2 px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-[10px] cursor-pointer"
                                  >
                                    Tutup Kamera
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <video
                                    ref={videoRef}
                                    playsInline
                                    className="w-full h-56 object-cover"
                                  />
                                  <div className="absolute bottom-3 inset-x-0 flex justify-center gap-2 px-4">
                                    <button
                                      type="button"
                                      onClick={capturePhoto}
                                      className="bg-[#00685f] hover:bg-[#005049] text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                                    >
                                      <Camera className="w-4 h-4" /> Ambil Foto
                                    </button>
                                    <button
                                      type="button"
                                      onClick={stopCamera}
                                      className="bg-gray-800/80 hover:bg-gray-900 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-md cursor-pointer"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={startCamera}
                                className="flex flex-col items-center justify-center p-4 border border-dashed border-[#bcc9c6]/60 bg-[#f8f9ff] rounded-xl hover:bg-gray-50 hover:border-[#00685f]/80 transition-all cursor-pointer text-center"
                              >
                                <Camera className="w-5 h-5 text-[#00685f] mb-1" />
                                <span className="text-[11px] font-bold text-[#0b1c30]">Gunakan Kamera</span>
                              </button>

                              <label className="flex flex-col items-center justify-center p-4 border border-dashed border-[#bcc9c6]/60 bg-[#f8f9ff] rounded-xl hover:bg-gray-50 hover:border-[#00685f]/80 transition-all cursor-pointer text-center">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleProofFileChange}
                                  className="sr-only"
                                />
                                <ImageIcon className="w-5 h-5 text-[#6b38d4] mb-1" />
                                <span className="text-[11px] font-bold text-[#0b1c30]">Unggah Foto</span>
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Pilihan Notifikasi Wali Kelas / Orang Tua bila bobot melebihi ketentuan */}
              {projectedPoints >= emailThreshold && (
                <div className="p-4 bg-amber-50/90 border border-amber-200/80 rounded-2xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4.5 h-4.5 text-amber-700" />
                    <span className="text-xs font-extrabold text-amber-950 uppercase tracking-wide">
                      Opsi Pengiriman Notifikasi (Bobot: {projectedPoints} &ge; Ketentuan {emailThreshold})
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900/90 font-medium leading-relaxed">
                    Karena bobot pembinaan siswa telah melebihi ketentuan ({emailThreshold} bobot), Anda dapat memilih apakah ingin mengirim notifikasi Email & WA ke Wali Kelas/Orang Tua atau <strong>tetap mencatat di sistem saja tanpa kirim pesan</strong>.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      notifyWaliOption === 'send'
                        ? 'bg-white border-[#00685f] ring-1 ring-[#00685f] shadow-xs text-[#00685f]'
                        : 'bg-amber-100/50 border-amber-200 text-gray-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="notifyWaliOption"
                        value="send"
                        checked={notifyWaliOption === 'send'}
                        onChange={() => setNotifyWaliOption('send')}
                        className="mt-0.5 text-[#00685f] focus:ring-[#00685f]"
                      />
                      <div>
                        <span className="text-xs font-extrabold block text-gray-900">
                          Kirim Notifikasi (Email & WhatsApp)
                        </span>
                        <span className="text-[10px] text-gray-600 font-semibold leading-tight block mt-0.5">
                          Tampilkan pratinjau draf & kirim pesan ke Wali Kelas untuk koordinasi.
                        </span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      notifyWaliOption === 'save_only'
                        ? 'bg-white border-purple-600 ring-1 ring-purple-600 shadow-xs text-purple-900'
                        : 'bg-amber-100/50 border-amber-200 text-gray-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="notifyWaliOption"
                        value="save_only"
                        checked={notifyWaliOption === 'save_only'}
                        onChange={() => setNotifyWaliOption('save_only')}
                        className="mt-0.5 text-purple-600 focus:ring-purple-600"
                      />
                      <div>
                        <span className="text-xs font-extrabold block text-purple-950">
                          Tetap Catat di Sistem Saja (Tanpa Kirim Email / WA)
                        </span>
                        <span className="text-[10px] text-gray-600 font-semibold leading-tight block mt-0.5">
                          Laporan tersimpan resmi di rekam jejak BK tanpa pengiriman notifikasi.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Opsi Otomatis Tindak Lanjut Layanan Konseling */}
              <div className="p-4 bg-gradient-to-r from-teal-50/80 to-emerald-50/80 border border-teal-200/80 rounded-2xl flex items-start gap-3.5 transition-all">
                <input
                  type="checkbox"
                  id="autoCreateCounselingCheckbox"
                  checked={autoCreateCounseling}
                  onChange={(e) => setAutoCreateCounseling(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[#00685f] rounded border-gray-300 focus:ring-[#00685f] cursor-pointer"
                />
                <label htmlFor="autoCreateCounselingCheckbox" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-[#00685f]" />
                    <span className="text-xs font-extrabold text-[#0b1c30]">
                      Langsung Jadwalkan Sesi Layanan Konseling Setelah Disimpan
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00685f] text-white">
                      Rekomendasi Restitusi
                    </span>
                  </div>
                  <p className="text-[11px] text-[#3d4947] font-medium leading-relaxed mt-1">
                    Jika dicentang, sistem akan langsung membuka formulir <strong>Tambah Layanan Konseling</strong> dengan data siswa, deskripsi pelanggaran, dan topik pembinaan yang sudah terisi otomatis untuk mempermudah tindak lanjut bimbingan.
                  </p>
                </label>
              </div>

              {/* Footer Action buttons */}
              <div className="pt-6 flex flex-col sm:flex-row gap-4 border-t border-[#bcc9c6]/20">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 py-3 border border-[#bcc9c6] text-[#3d4947] hover:bg-[#eff4ff]/30 rounded-xl text-sm font-bold transition-all"
                >
                  Batalkan
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-97 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4.5 h-4.5" />
                  <span>Simpan Laporan Restitusi & Pembinaan</span>
                </button>
              </div>
            </form>
          </div>

          {/* Auxiliary Help Tips cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-[#825100]/5 border border-[#825100]/25 rounded-2xl flex gap-3">
              <Lightbulb className="w-5 h-5 text-[#825100] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#3d4947] font-semibold leading-relaxed">
                Penerapan Segitiga Restitusi sesuai Permendikbudristek 46/2023 berfokus pada pemulihan karakter siswa agar menyadari kesalahan, memperbaiki dampaknya, dan kembali ke kelompoknya dengan karakter yang lebih kuat.
              </p>
            </div>

            <div className="p-4 bg-[#00685f]/5 border border-[#00685f]/25 rounded-2xl flex gap-3">
              <Info className="w-5 h-5 text-[#00685f] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#3d4947] font-semibold leading-relaxed">
                Sistem pengarsipan ini bersifat rahasia. Sesuai asas kerahasiaan konseling, rekam perkembangan karakter hanya diakses oleh guru BK, wali kelas, dan pimpinan sekolah demi kelancaran pendampingan.
              </p>
            </div>
          </div>
        </>
      )}

      {/* AUTOMATED EMAIL NOTIFICATION SIMULATOR MODAL */}
      {showEmailModal && emailData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#00685f] to-[#004e47] px-6 py-4.5 text-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <Mail className="w-5 h-5 text-teal-200 animate-pulse" />
                <div>
                  <h3 className="text-sm font-extrabold tracking-tight uppercase">
                    Notifikasi Email BK Otomatis Terpicu!
                  </h3>
                  <p className="text-[10px] text-teal-100 font-semibold opacity-90">
                    Batas Eskalasi Pembinaan Terlampaui ({emailData.triggerPoints} Bobot)
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                emailData.severity === 'TAHAP III (KRITIS)' 
                  ? 'bg-red-500/20 text-red-100 border-red-400' 
                  : emailData.severity === 'TAHAP II (SIAGA)' 
                    ? 'bg-amber-500/20 text-amber-100 border-amber-400'
                    : 'bg-teal-500/20 text-teal-100 border-teal-400'
              }`}>
                {emailData.severity}
              </span>
            </div>

            {/* Email Client Layout Container */}
            <div className="p-6 space-y-4 bg-[#f8f9ff]">
              <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs space-y-3">
                {/* Meta Fields */}
                <div className="grid grid-cols-1 gap-2 text-xs border-b border-gray-100 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                    <span className="font-bold text-gray-500 w-16">Dari:</span>
                    <span className="font-mono text-gray-800 bg-gray-100 px-2 py-0.5 rounded border border-gray-200/60 text-[11px] inline-block font-semibold">
                      {activeCounselor.email || 'admin.bk@smpn2susukan.sch.id'} <span className="text-gray-400">&lt;Sistem BK Otomatis: {activeCounselor.name}&gt;</span>
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                    <span className="font-bold text-gray-500 w-16">Kepada:</span>
                    <span className="font-mono text-[#00685f] bg-teal-50 px-2 py-0.5 rounded border border-teal-100 text-[11px] inline-block font-extrabold">
                      {emailData.to} <span className="text-teal-600/70">&lt;Wali Kelas Siswa&gt;</span>
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 pt-1">
                    <span className="font-bold text-gray-500 w-16 flex-shrink-0">Subjek:</span>
                    <span className="font-extrabold text-gray-900 leading-snug">
                      {emailData.subject}
                    </span>
                  </div>
                </div>

                {/* Email Body text content container */}
                <div className="space-y-1 bg-gray-50 rounded-lg p-3.5 border border-gray-100">
                  <pre className="font-sans text-xs text-gray-700 whitespace-pre-wrap leading-relaxed select-text">
                    {emailData.body}
                  </pre>
                </div>
              </div>

              {/* Real Action Links for dispatch */}
              <div className="p-4 bg-teal-50/80 border border-teal-200/60 rounded-xl space-y-2.5">
                <span className="text-xs font-extrabold text-teal-900 uppercase tracking-wider block">
                  ⚡ Opsi Pengiriman Langsung Wali Kelas (Operasional):
                </span>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={`mailto:${emailData.to}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`}
                    className="flex-1 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-sm text-center flex items-center justify-center gap-2 hover:no-underline transition-all active:scale-97"
                    title="Buka aplikasi email Anda (Gmail/Outlook) dengan isi pesan terisi otomatis"
                  >
                    <Mail className="w-4 h-4 shrink-0" />
                    <span>Kirim via Email Client</span>
                  </a>
                  
                  <button
                    type="button"
                    onClick={handleCreateDraft}
                    disabled={isCreatingDraft}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm text-center flex items-center justify-center gap-2 transition-all active:scale-97 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Simpan draf surat pemberitahuan ini langsung di folder Draf (Drafts) akun Gmail terhubung Anda"
                  >
                    {isCreatingDraft ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></span>
                    ) : (
                      <FileText className="w-4 h-4 shrink-0" />
                    )}
                    <span>{isCreatingDraft ? 'Menyimpan...' : 'Simpan Draf ke Gmail'}</span>
                  </button>

                  {currentWaliKelas?.phone && (
                    <a
                      href={`https://api.whatsapp.com/send?phone=${
                        currentWaliKelas.phone.startsWith('0') 
                          ? '62' + currentWaliKelas.phone.slice(1) 
                          : currentWaliKelas.phone
                      }&text=${encodeURIComponent(
                        `Yth. Wali Kelas *${selectedStudent?.class}* (${currentWaliKelas.name}),\n\nKami menginfokan perkembangan kedisiplinan siswa:\n` +
                        `- Nama: *${selectedStudent?.name}*\n` +
                        `- NISN: *${selectedStudent?.nis}*\n` +
                        `- Total Bobot Pembinaan: *${emailData.triggerPoints} (Siaga/Kritis)*\n` +
                        `- Status: *${emailData.severity}*\n\n` +
                        `Rekomendasi Tindakan:\n${
                          emailData.severity === 'TAHAP III (KRITIS)' 
                            ? 'Kasus segera diproses Sidang Dewan Guru.' 
                            : emailData.severity === 'TAHAP II (SIAGA)' 
                              ? 'Mohon jadwalkan Panggilan Orang Tua ke sekolah.' 
                              : 'Mohon berikan pembinaan kelas persuasif.'
                        }\n\n` +
                        `Detail draf surat elektronik resmi telah kami siapkan di unit BK. Terima kasih.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm text-center flex items-center justify-center gap-2 hover:no-underline transition-all active:scale-97"
                      title="Kirim pesan rincian singkat kesiswaan via WhatsApp otomatis ke Wali Kelas"
                    >
                      <span className="font-bold text-[10px] bg-white/20 px-1 py-0.5 rounded shrink-0">WA</span>
                      <span>Kirim via WhatsApp Wali Kelas</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Status Notice Indicator */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200/50 rounded-xl flex gap-2.5 items-start">
                <Info className="w-4.5 h-4.5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-800 font-semibold leading-relaxed">
                  <strong>Informasi Alur PPKSP:</strong> Sesuai Permendikbudristek 46/2023, tingginya bobot pembinaan ({emailData.triggerPoints}) memicu alur komunikasi kolaboratif ini secara otomatis demi pemulihan perilaku siswa. Gunakan tombol <strong>Simpan Draf ke Gmail</strong> untuk menyimpan rancangan diskusi ke folder draf Anda, atau gunakan opsi lainnya untuk mengirimkan langsung.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-2.5 justify-end items-center">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Batal / Perbaiki Data
              </button>

              <button
                type="button"
                onClick={handleSaveWithoutSending}
                className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                title="Simpan laporan ke sistem tanpa mengirimkan email/WA"
              >
                <Save className="w-3.5 h-3.5 text-purple-700" />
                <span>Simpan Saja (Tanpa Kirim Email/WA)</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmEmailAndSave}
                disabled={isSendingEmail}
                className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-97 flex items-center gap-2 cursor-pointer ${
                  isSendingEmail 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-[#00685f] hover:bg-[#005049]'
                }`}
              >
                {isSendingEmail ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isSendingEmail ? 'Mengirim Email...' : 'Kirim Notifikasi & Simpan Laporan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT VIOLATION MODAL */}
      {editingViolation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-red-600" />
                  <span>Edit Catatan Pelanggaran Siswa</span>
                </h3>
                <p className="text-[11px] text-gray-500 font-semibold">
                  Tiket: {editingViolation.ticketId} • Siswa: {editingViolation.studentName} ({editingViolation.studentClass})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingViolation(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Kategori Pelanggaran</label>
                <input
                  type="text"
                  value={editingViolation.category}
                  onChange={(e) => setEditingViolation({ ...editingViolation, category: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Bobot Pelanggaran (+)</label>
                  <input
                    type="number"
                    value={editingViolation.pointsAdded}
                    onChange={(e) => setEditingViolation({ ...editingViolation, pointsAdded: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Status Restitusi</label>
                  <select
                    value={getViolationRestitutionStatus(editingViolation)}
                    onChange={(e) => {
                      const newSt = e.target.value as RestitutionStatusType;
                      setEditingViolation({
                        ...editingViolation,
                        restitutionStatus: newSt,
                        handledBy:
                          newSt === 'Baru Dicatat' ? 'Belum Ditangani' :
                          newSt === 'Sudah Konseling' ? 'Guru BK' :
                          newSt === 'Proses Restitusi' ? 'Wali Kelas & Guru BK' : 'Guru BK',
                        restitutionCompletedDate: newSt === 'Selesai / Dipantau' ? (editingViolation.restitutionCompletedDate || new Date().toISOString().slice(0, 10)) : editingViolation.restitutionCompletedDate
                      });
                    }}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  >
                    <option value="Baru Dicatat">Baru Dicatat</option>
                    <option value="Sudah Konseling">Sudah Konseling</option>
                    <option value="Proses Restitusi">Proses Restitusi</option>
                    <option value="Selesai / Dipantau">Selesai / Dipantau</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Progres Penanganan / Restitusi</label>
                <textarea
                  rows={2}
                  value={editingViolation.handlingProgress || ''}
                  onChange={(e) => setEditingViolation({ ...editingViolation, handlingProgress: e.target.value })}
                  placeholder="Catatan penanganan..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Catatan / Detail Kasus</label>
                <textarea
                  rows={2}
                  value={editingViolation.notes || ''}
                  onChange={(e) => setEditingViolation({ ...editingViolation, notes: e.target.value })}
                  placeholder="Detail peristiwa..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setEditingViolation(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onUpdateViolation && editingViolation) {
                    onUpdateViolation(editingViolation);
                    setEditingViolation(null);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer shadow-sm"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚡ MODAL PILIH BANYAK SISWA SEKALIGUS (BULK STUDENT SELECTOR) */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-gray-200 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#00685f]/10 rounded-xl text-[#00685f] shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#0b1c30]">
                    ⚡ Input Kolektif / Pilih Beberapa Siswa Sekaligus
                  </h3>
                  <p className="text-xs text-gray-500 font-semibold">
                    Tandai siswa yang terlibat dalam kejadian yang sama untuk mencatat pelanggaran sekaligus secara efisien.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#0b1c30]">Filter Berdasarkan Kelas</label>
                <select
                  value={bulkFilterClass}
                  onChange={(e) => setBulkFilterClass(e.target.value)}
                  className="w-full bg-[#f8faf9] border border-[#bcc9c6]/50 rounded-xl px-3 py-2 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                >
                  <option value="Semua Kelas">Semua Kelas ({students.length} Siswa)</option>
                  {availableClassesList.map((cls) => (
                    <option key={cls} value={cls}>
                      Kelas {cls} ({students.filter((s) => s.class === cls).length} Siswa)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#0b1c30]">Cari Nama / NIS Siswa</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={bulkSearchQuery}
                    onChange={(e) => setBulkSearchQuery(e.target.value)}
                    placeholder="Ketik nama atau NIS..."
                    className="w-full bg-[#f8faf9] border border-[#bcc9c6]/50 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                  {bulkSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setBulkSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Selection actions bar */}
            <div className="flex items-center justify-between text-xs font-extrabold bg-[#e6f4f1]/60 px-3.5 py-2 rounded-xl border border-[#00685f]/20 shrink-0">
              <div className="text-[#00685f] flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>
                  Terpilih: <strong>{bulkSelectedIds.length}</strong> dari {students.length} Siswa
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllBulk}
                  className="px-2.5 py-1 bg-white hover:bg-[#00685f] hover:text-white text-[#00685f] border border-[#00685f]/30 rounded-lg text-[11px] transition-all cursor-pointer shadow-2xs"
                >
                  Pilih Semua (sesuai filter)
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllBulk}
                  className="px-2.5 py-1 bg-white hover:bg-red-500 hover:text-white text-red-600 border border-red-200 rounded-lg text-[11px] transition-all cursor-pointer shadow-2xs"
                >
                  Batal Pilih (sesuai filter)
                </button>
              </div>
            </div>

            {/* Scrollable Student List */}
            <div className="flex-1 overflow-y-auto pr-1 border border-gray-200 rounded-xl divide-y divide-gray-100 min-h-[220px]">
              {bulkFilteredStudents.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs italic">
                  Tidak ada siswa yang ditemukan sesuai filter
                </div>
              ) : (
                bulkFilteredStudents.map((st) => {
                  const isChecked = bulkSelectedIds.includes(st.id);
                  return (
                    <div
                      key={st.id}
                      onClick={() => toggleBulkSelectStudent(st.id)}
                      className={`p-3 flex items-center justify-between hover:bg-[#e6f4f1]/40 transition-colors cursor-pointer ${
                        isChecked ? 'bg-[#e6f4f1]/80 font-extrabold' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent div onClick
                          className="w-4 h-4 text-[#00685f] rounded border-gray-300 focus:ring-[#00685f] cursor-pointer"
                        />
                        <div className="w-8 h-8 rounded-full bg-[#00685f] text-white flex items-center justify-center text-xs font-black shrink-0 overflow-hidden shadow-2xs">
                          {st.avatarUrl ? (
                            <img src={st.avatarUrl} alt={st.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span>{st.initials}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0b1c30] truncate">{st.name}</p>
                          <p className="text-[10px] text-gray-500 font-semibold">
                            NIS: {st.nis} &bull; Kelas {st.class}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-md">
                          {st.class}
                        </span>
                        {st.violationPoints > 0 && (
                          <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold rounded-md">
                            {st.violationPoints} Bobot
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-500 font-semibold">
                {bulkSelectedIds.length} siswa akan ditambahkan ke form laporan.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkSelection}
                  className="px-5 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:scale-97"
                >
                  Selesai & Terapkan ({bulkSelectedIds.length} Siswa)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK STUDENT EDIT MODAL */}
      {selectedStudentForEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-[#0b1c30]">Profil & Edit Data Siswa</h3>
                <p className="text-[11px] text-gray-500">
                  Ubah data atau hapus siswa langsung dari arsip pendampingan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForEdit(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Kelas</label>
                  <input
                    type="text"
                    value={editStudentClass}
                    onChange={(e) => setEditStudentClass(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">NIS / NISN</label>
                  <input
                    type="text"
                    value={editStudentNis}
                    onChange={(e) => setEditStudentNis(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs space-y-1">
                <p className="font-bold text-gray-700">Ringkasan Bobot Karakter Siswa:</p>
                <p className="text-red-600 font-extrabold">Total Bobot Pelanggaran: {selectedStudentForEdit.violationPoints} Bobot</p>
                <p className="text-emerald-600 font-extrabold">Total Bobot Apresiasi: +{selectedStudentForEdit.achievementPoints || 0} Bobot</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              {onDeleteStudent && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDeleteTarget({
                      type: 'student',
                      id: selectedStudentForEdit.id,
                      title: `Hapus Siswa ${selectedStudentForEdit.name}`,
                      message: `Hapus ${selectedStudentForEdit.name} (${selectedStudentForEdit.class}) saja? Siswa lain tidak akan terhapus.`,
                      step: 1,
                    })
                  }
                  className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Siswa</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setSelectedStudentForEdit(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
                >
                  Tutup
                </button>
                {onUpdateStudent && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateStudent({
                        ...selectedStudentForEdit,
                        name: editStudentName,
                        class: editStudentClass,
                        nis: editStudentNis,
                      });
                      setSelectedStudentForEdit(null);
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#00685f] hover:bg-[#005049] rounded-xl cursor-pointer shadow-sm"
                  >
                    Simpan Perubahan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / DIALOG TAWARAN TINDAK LANJUT LAYANAN KONSELING BK */}
      {showFollowUpPromptModal && followUpPromptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-[#bcc9c6]/40 max-w-xl w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#00685f] shadow-xs flex-shrink-0">
                  <HeartHandshake className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Tersimpan Resmi
                    </span>
                    <span className="text-[10px] font-bold text-gray-500">Restitusi BK</span>
                  </div>
                  <h3 className="text-lg font-extrabold text-[#0b1c30] mt-0.5">
                    Laporan Pelanggaran Berhasil Disimpan!
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFollowUpPromptModal(false);
                  setFollowUpPromptData(null);
                  onCancel();
                }}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Context Card */}
            <div className="bg-[#f8faf9] border border-[#bcc9c6]/40 rounded-2xl p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#bcc9c6]/20 pb-2">
                <div className="text-xs font-bold text-[#0b1c30]">
                  Siswa:{' '}
                  <span className="text-[#00685f]">
                    {followUpPromptData.students.map((s) => s.name).join(', ')} (
                    {followUpPromptData.students.map((s) => s.class).join(', ')})
                  </span>
                </div>
                <div className="text-[10px] font-extrabold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                  +{followUpPromptData.pointsAdded} Bobot
                </div>
              </div>
              <p className="text-xs text-[#3d4947] font-semibold">
                Kategori:{' '}
                <span className="text-gray-900 font-extrabold">{followUpPromptData.category}</span>
              </p>
              {followUpPromptData.notes && (
                <p className="text-[11px] text-gray-600 bg-white p-2.5 rounded-xl border border-gray-200/70 italic">
                  "{followUpPromptData.notes}"
                </p>
              )}
            </div>

            {/* Question & Service Type Selector */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#0b1c30]">
                Apakah Anda ingin langsung membuat sesi <strong>Layanan Konseling</strong> tindak lanjut untuk siswa ini?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    Jenis Layanan BK:
                  </label>
                  <select
                    value={selectedFollowUpServiceType}
                    onChange={(e) => setSelectedFollowUpServiceType(e.target.value as BKServiceType)}
                    className="w-full bg-white border border-[#bcc9c6]/60 rounded-xl px-3 py-2 text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#00685f]"
                  >
                    <option value="Layanan Konseling Perorangan (Individual)">
                      Konseling Perorangan (Individual)
                    </option>
                    <option value="Layanan Bimbingan Kelompok">Bimbingan Kelompok</option>
                    <option value="Layanan Konseling Kelompok">Konseling Kelompok</option>
                    <option value="Layanan Mediasi">Layanan Mediasi</option>
                    <option value="Layanan Konsultasi">Layanan Konsultasi</option>
                    <option value="Layanan Advokasi">Layanan Advokasi</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    Status Awal Sesi:
                  </label>
                  <select
                    value={selectedFollowUpStatus}
                    onChange={(e) => setSelectedFollowUpStatus(e.target.value as 'Terjadwal' | 'Selesai')}
                    className="w-full bg-white border border-[#bcc9c6]/60 rounded-xl px-3 py-2 text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#00685f]"
                  >
                    <option value="Terjadwal">Jadwalkan Sesi Konseling (Terjadwal)</option>
                    <option value="Selesai">Langsung Catat Hasil Selesai (Selesai)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-[#bcc9c6]/30">
              <button
                type="button"
                onClick={() => {
                  showToast('✅ Catatan pelanggaran tersimpan rapi di dashboard.', 'info');
                  setShowFollowUpPromptModal(false);
                  setFollowUpPromptData(null);
                  onCancel();
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
              >
                Selesai (Kembali ke Dashboard)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onCreateFollowUpCounseling && followUpPromptData) {
                    const isMultiple = followUpPromptData.students.length > 1;
                    onCreateFollowUpCounseling({
                      students: followUpPromptData.students,
                      problem: `Tindak Lanjut Pembinaan Disiplin: ${followUpPromptData.category}`,
                      description: `Sesi tindak lanjut layanan konseling dan restitusi disiplin positif atas pelanggaran "${followUpPromptData.category}" (${followUpPromptData.date}). Catatan kejadian: ${followUpPromptData.notes || '-'}`,
                      serviceType: selectedFollowUpServiceType,
                      targetType: isMultiple ? 'Kelompok' : 'Individu',
                      status: selectedFollowUpStatus,
                      violationContext: {
                        category: followUpPromptData.category,
                        pointsAdded: followUpPromptData.pointsAdded,
                        date: followUpPromptData.date,
                        notes: followUpPromptData.notes,
                      },
                    });
                    setShowFollowUpPromptModal(false);
                    setFollowUpPromptData(null);
                  }
                }}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-extrabold text-white bg-[#00685f] hover:bg-[#005049] rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <HeartHandshake className="w-4 h-4" />
                <span>Buat Sesi Layanan Konseling</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK STATUS RESTITUSI EDIT MODAL */}
      {statusModalViolation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00685f]" />
                  <h3 className="font-extrabold text-base text-[#0b1c30]">
                    Ubah Status Penanganan & Restitusi
                  </h3>
                </div>
                <p className="text-xs text-gray-600 font-semibold mt-1">
                  Siswa: <strong className="text-[#00685f]">{statusModalViolation.studentName}</strong> ({statusModalViolation.studentClass}) • Tiket: #{statusModalViolation.ticketId}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Kasus: {statusModalViolation.category} (+{statusModalViolation.pointsAdded} Bobot)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalViolation(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 4 Pilihan Tahap Status */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-700 block uppercase tracking-wider">
                Pilih Tahap Penanganan Restitusi <span className="text-red-500">*</span>:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(['Baru Dicatat', 'Sudah Konseling', 'Proses Restitusi', 'Selesai / Dipantau'] as RestitutionStatusType[]).map((st) => {
                  const cfg = RESTITUTION_STATUS_CONFIG[st];
                  const isSelected = modalTargetStatus === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleSelectStatusInModal(st)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 shadow-2xs ${
                        isSelected
                          ? `${cfg.colorBadge} ring-2 ring-[#00685f] ring-offset-1 font-black shadow-xs`
                          : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-black">
                          <span className={`w-2.5 h-2.5 rounded-full ${cfg.colorDot}`} />
                          <span>{st}</span>
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-[#00685f]" />}
                      </div>
                      <span className="text-[10px] font-medium opacity-85 leading-tight">
                        {cfg.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input Khusus Sesuai Status Yang Dipilih */}
            {modalTargetStatus === 'Proses Restitusi' && (
              <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-900 uppercase tracking-wider">
                  <Sliders className="w-4 h-4 text-amber-600" />
                  <span>Detail Kesepakatan & Pemantauan Restitusi</span>
                </div>
                
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Isi Kesepakatan <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={modalAgreement}
                    onChange={(e) => setModalAgreement(e.target.value)}
                    placeholder="Contoh: Siswa berjanji tidak mengulangi dan bersedia merapikan perpustakaan selama 3 hari serta meminta maaf."
                    className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 text-[#0b1c30]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Deadline Pelaksanaan <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={modalDeadline}
                      onChange={(e) => setModalDeadline(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Nama Pemantau <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={modalSupervisor}
                      onChange={(e) => setModalSupervisor(e.target.value)}
                      placeholder="Contoh: Wali Kelas 8A & Guru BK"
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {modalTargetStatus === 'Selesai / Dipantau' && (
              <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-4 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-900 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Penyelesaian Kasus & Masa Pantau 2 Minggu</span>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Tanggal Selesai (Otomatis Hari Ini) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={modalCompletedDate}
                    onChange={(e) => setModalCompletedDate(e.target.value)}
                    className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  />
                  <p className="text-[11px] text-emerald-700 font-semibold mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Tanggal otomatis terisi hari ini. Kasus dinyatakan selesai dan masuk periode pemantauan 2 minggu.</span>
                  </p>
                </div>
              </div>
            )}

            {modalTargetStatus === 'Sudah Konseling' && (
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 space-y-1 animate-in fade-in duration-150">
                <p className="font-bold flex items-center gap-1.5 text-blue-950">
                  <span>💬 Sudah Bicara dengan Siswa</span>
                </p>
                <p className="text-[11px] text-blue-700 font-medium">
                  Konseling awal telah terlaksana. Siswa telah didengar keterangannya dan sedang diarahkan untuk menetapkan solusi restitusi.
                </p>
              </div>
            )}

            {modalTargetStatus === 'Baru Dicatat' && (
              <div className="bg-gray-100/80 border border-gray-200 rounded-xl p-3.5 text-xs text-gray-700 space-y-1 animate-in fade-in duration-150">
                <p className="font-bold flex items-center gap-1.5 text-gray-900">
                  <span>⏳ Baru Masuk, Belum Dipanggil</span>
                </p>
                <p className="text-[11px] text-gray-500 font-medium">
                  Catatan pembinaan baru terdaftar dalam arsip dan belum dijadwalkan sesi dialog/konseling bersama siswa.
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setStatusModalViolation(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveStatusModal}
                className="px-5 py-2 text-xs font-black text-white bg-[#00685f] hover:bg-[#005049] rounded-xl shadow-xs transition-all active:scale-97 cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Simpan Perubahan Status</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DETAIL KASUS & AUTO-SAVE PDF GOOGLE DRIVE                           */}
      {/* ========================================================================= */}
      {detailViolation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1c30]/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-[#bcc9c6]/40 my-auto animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#f8faf9] border-b border-[#bcc9c6]/30 px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-red-100 text-red-900 border border-red-200">
                    Tiket #{detailViolation.ticketId || detailViolation.id}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-[#00685f]/10 text-[#00685f] border border-[#00685f]/20">
                    Kelas {detailViolation.studentClass}
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#0b1c30]">
                  {detailViolation.studentName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailViolation(null);
                  setCaseDriveFailed(false);
                }}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              {/* Alert jika Drive upload failed */}
              {caseDriveFailed && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-bold">PDF berhasil dibuat, tapi gagal simpan ke Drive. Klik [Coba Lagi ke Drive]</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleProcessCaseDrivePdf(detailViolation)}
                    disabled={isProcessingDrivePdf}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-lg text-xs transition cursor-pointer shrink-0 shadow-2xs"
                  >
                    Coba Lagi ke Drive
                  </button>
                </div>
              )}

              {/* Grid Data Ringkasan Kasus */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#f8faf9] rounded-xl border border-gray-200">
                  <span className="text-gray-500 font-bold block mb-0.5">Kategori Pelanggaran:</span>
                  <span className="font-black text-[#0b1c30] text-sm">{detailViolation.category}</span>
                </div>
                <div className="p-3 bg-red-50/60 rounded-xl border border-red-200">
                  <span className="text-red-700 font-bold block mb-0.5">Bobot Poin Pembinaan:</span>
                  <span className="font-black text-red-700 text-sm">+{detailViolation.pointsAdded} Poin</span>
                </div>
                <div className="p-3 bg-[#f8faf9] rounded-xl border border-gray-200">
                  <span className="text-gray-500 font-bold block mb-0.5">Waktu Kejadian:</span>
                  <span className="font-semibold text-gray-800">{detailViolation.date} • {detailViolation.time || '-'}</span>
                </div>
                <div className="p-3 bg-[#f8faf9] rounded-xl border border-gray-200">
                  <span className="text-gray-500 font-bold block mb-0.5">Status Restitusi:</span>
                  <span className="font-bold text-[#00685f]">{detailViolation.restitutionStatus || 'Baru Dicatat'}</span>
                </div>
              </div>

              {/* Kronologi & Catatan */}
              <div>
                <label className="block text-xs font-black uppercase text-gray-700 mb-1">
                  Uraian Kejadian / Kronologi Kasus
                </label>
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {detailViolation.notes || 'Tidak ada catatan tambahan.'}
                </div>
              </div>

              {/* Kesepakatan Restitusi (jika ada) */}
              {detailViolation.restitutionAgreement && (
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-emerald-950">
                  <span className="font-black block mb-0.5 text-emerald-900">Kesepakatan Restitusi:</span>
                  <p className="font-medium italic">"{detailViolation.restitutionAgreement}"</p>
                  {detailViolation.restitutionDeadline && (
                    <span className="block mt-1 text-[11px] font-bold text-emerald-800">
                      Batas Waktu (Deadline): {detailViolation.restitutionDeadline}
                    </span>
                  )}
                </div>
              )}

              {/* Pelapor, Origin & Penanganan */}
              {(() => {
                const origin = getViolationOriginDisplay(detailViolation);
                return (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 border-t border-gray-100 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        Dilaporkan oleh: <strong className="text-gray-800">{origin.reporterLabel}</strong>
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                        reportedVia: {origin.reportedViaLabel}
                      </span>
                      {!origin.isPiket && (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold">
                          Data Lama
                        </span>
                      )}
                    </div>
                    <span>Ditangani oleh: <strong className="text-gray-800">{detailViolation.handledBy || 'Guru BK'}</strong></span>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-[#f8faf9] border-t border-[#bcc9c6]/30 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setDetailViolation(null);
                  setCaseDriveFailed(false);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                {/* 1. Tombol [Lihat PDF di Drive] */}
                {detailViolation.pdfUrl && (
                  <a
                    href={detailViolation.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 rounded-xl text-xs font-black transition shadow-2xs"
                    title="Buka dokumen PDF bukti kasus di Google Drive"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Lihat PDF di Drive</span>
                  </a>
                )}

                {/* 2. Tombol [Coba Lagi ke Drive] jika gagal */}
                {caseDriveFailed && (
                  <button
                    type="button"
                    onClick={() => handleProcessCaseDrivePdf(detailViolation)}
                    disabled={isProcessingDrivePdf}
                    className="inline-flex items-center gap-1 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition shadow-2xs cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Coba Lagi ke Drive</span>
                  </button>
                )}

                {/* 3. Tombol [Download Ulang] jika sudah ada PDF */}
                {detailViolation.pdfUrl ? (
                  <button
                    type="button"
                    onClick={() => handleProcessCaseDrivePdf(detailViolation)}
                    disabled={isProcessingDrivePdf}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 text-[#00685f] border border-[#00685f]/30 hover:bg-teal-100 rounded-xl text-xs font-black transition shadow-2xs cursor-pointer"
                    title="Download ulang dokumen PDF bukti kasus ini"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Ulang</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleProcessCaseDrivePdf(detailViolation)}
                    disabled={isProcessingDrivePdf}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-black transition shadow-2xs cursor-pointer active:scale-97"
                    title="Generate PDF resmi dan auto-save ke Google Drive"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{isProcessingDrivePdf ? 'Menyimpan ke Drive...' : 'Generate Layanan'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteTarget && (
        <div className="fixed inset-0 z-[120] bg-[#0b1c30]/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-[#bcc9c6]/50 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  Konfirmasi {confirmDeleteTarget.step} / 2
                </span>
                <h3 className="text-sm font-black text-[#0b1c30] mt-1">
                  {confirmDeleteTarget.step === 1
                    ? (confirmDeleteTarget.title || 'Konfirmasi Hapus 1 Data')
                    : 'Konfirmasi Akhir Pindah ke Sampah'}
                </h3>
                <p className="text-xs text-[#3d4947] mt-1 leading-relaxed">
                  {confirmDeleteTarget.step === 1
                    ? confirmDeleteTarget.message
                    : 'Yakin hapus laporan ini? Data akan dipindah ke sampah, tidak hilang permanen.'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteTarget(null)}
                className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 cursor-pointer"
              >
                Batal
              </button>
              {confirmDeleteTarget.step === 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDeleteTarget((prev) => (prev ? { ...prev, step: 2 } : null))
                  }
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                >
                  Lanjut Konfirmasi
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const target = confirmDeleteTarget;
                    setConfirmDeleteTarget(null);
                    if (!isValidDeleteId(target.id)) {
                      showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
                      return;
                    }
                    if (target.type === 'violation' && onDeleteViolation) {
                      onDeleteViolation(target.id);
                    } else if (target.type === 'student' && onDeleteStudent) {
                      onDeleteStudent(target.id);
                      setSelectedStudentForEdit(null);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  Ya, Pindahkan ke Sampah
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// Inline mini close icon replacement
function XIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
