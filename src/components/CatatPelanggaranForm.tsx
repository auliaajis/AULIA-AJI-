import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, ViolationRecord, Counselor, BKServiceType, BKComponentType, RestitutionStatusType } from '../types';
import {
  ChevronRight,
  Gavel,
  Search,
  AlertTriangle,
  Download,
  AlertCircle,
  X,
  ExternalLink,
  FileText,
  Edit3,
  Trash2,
  ChevronDown,
  SlidersHorizontal as Sliders,
  HeartHandshake,
  Clock,
  CheckCircle2,
  Check
} from 'lucide-react';
import { downloadViolationPDF, generateAndUploadCasePdf } from '../utils/pdfGenerator';
import { formatCardDateTime, formatCardDate } from '../utils/dateFormatter';
import { showToast } from '../utils/toast';
import { isValidDeleteId } from '../utils/safeDelete';
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
  onSaveViolation?: (record: Omit<ViolationRecord, 'id' | 'ticketId'>) => void;
  onUpdateViolation?: (record: ViolationRecord) => void;
  onDeleteViolation?: (id: string) => void;
  onUpdateStudent?: (student: Student) => void;
  onDeleteStudent?: (id: string) => void;
  onTindakLanjuti?: (violation: ViolationRecord) => void;
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
  initialArchiveSearch,
  initialOpenViolationId,
  onClearInitialOpenViolation,
  onNavigateToProfile,
  onUpdateViolation,
  onDeleteViolation,
  onUpdateStudent,
  onDeleteStudent,
  onTindakLanjuti,
  onCreateFollowUpCounseling,
  onCancel,
}: CatatPelanggaranFormProps) {
  // Archive search & multi-filter states (Form Catat Pelanggaran Guru BK dihapus; BK hanya Pembinaan & Arsip)
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

  // Date range filter states (kept compatible)
  const [archiveStartDate, setArchiveStartDate] = useState('');
  const [archiveEndDate, setArchiveEndDate] = useState('');

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
                            {(onTindakLanjuti || onCreateFollowUpCounseling) && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (onTindakLanjuti) {
                                    onTindakLanjuti(v);
                                    return;
                                  }
                                  if (onCreateFollowUpCounseling) {
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
                                      description: `Sesi tindak lanjut layanan konseling dan restitusi disiplin positif atas rujukan "${v.category}" (${v.date}). Tiket: #${v.ticketId || v.id}. Catatan kejadian: ${v.notes || '-'}`,
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
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                                title="Buka Form Pembinaan 3 Langkah untuk menindaklanjuti"
                              >
                                <HeartHandshake className="w-3.5 h-3.5" />
                                <span>Tindak Lanjuti</span>
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 text-[#00685f] border border-[#00685f]/30 hover:bg-teal-100 rounded-xl text-xs font-black transition shadow-2xs cursor-pointer active:scale-97"
                    title="Generate PDF resmi dan auto-save ke Google Drive"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{isProcessingDrivePdf ? 'Menyimpan ke Drive...' : 'Simpan PDF ke Drive'}</span>
                  </button>
                )}

                {onTindakLanjuti && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailViolation;
                      setDetailViolation(null);
                      setCaseDriveFailed(false);
                      onTindakLanjuti(target);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-black transition shadow-2xs cursor-pointer active:scale-97"
                  >
                    <HeartHandshake className="w-3.5 h-3.5" />
                    <span>Tindak Lanjuti</span>
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
