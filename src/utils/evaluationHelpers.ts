import { collection, getDocs } from 'firebase/firestore';
import {
  CaseFinalStatus,
  CaseStatusSummary,
  CounselingService,
  Counselor,
  EvaluationFollowUpStatus,
  EvaluationJenisMasalah,
  EvaluationTeknikType,
  EvaluationTujuanType,
  FokusUtamaTahunan,
  NeedDeterminationMethod,
  ProgramEvaluation,
  ProgramProblemMetricItem,
  ProgramTechniqueMetricItem,
  RencanaTahunanData,
  ServiceEvaluation6Scores,
  ServiceEvaluationBaseline,
} from '../types';
import { getBKComponentForService } from './bkKomprehensif';
import { formatTanggalIndonesia, formatTanggalWaktuIndonesia } from './dateFormatter';
import { db, loadSchoolData } from './firestoreSync';
import { isDummyRecord } from './purgeDummyData';
import { getActiveSchoolId, sanitizeSchoolId } from './schoolConfig';
import { isAdministrator } from './accessControl';

export { formatTanggalIndonesia, formatTanggalWaktuIndonesia };

export const STANDARD_EVALUATION_BIDANG = [
  'Layanan Dasar',
  'Layanan Responsif',
  'Perencanaan Individual',
  'Dukungan Sistem',
] as const;

export type StandardEvaluationBidang = (typeof STANDARD_EVALUATION_BIDANG)[number];
export type ExtendedEvaluationBidang = StandardEvaluationBidang | 'Belum Terkategori';

export const BIDANG_HEX_COLORS: Record<StandardEvaluationBidang, string> = {
  'Layanan Responsif': '#1A5C4A',
  'Layanan Dasar': '#2A6CB6',
  'Perencanaan Individual': '#C77A1A',
  'Dukungan Sistem': '#3A7A7A',
};

export const DEFAULT_TAHUN_AJARAN_OPTIONS = ['2026/2027', '2025/2026', '2024/2025'];

/**
 * Normalizes a raw bidang/bkComponent string or CounselingService into one of the 4 standard bidang
 * or 'Belum Terkategori' when empty/unknown (never discards documents).
 */
export function normalizeBidangFlexible(
  rawBidang?: string | null,
  rawServiceType?: string | null
): ExtendedEvaluationBidang {
  const cleanStr = (val?: string | null) =>
    String(val || '')
      .toLowerCase()
      .replace(/[\s_-]+/g, '');

  const primary = cleanStr(rawBidang);
  if (primary) {
    if (primary.includes('dasar') || primary.includes('basic') || primary === 'pilar1') {
      return 'Layanan Dasar';
    }
    if (primary.includes('responsif') || primary.includes('responsive') || primary === 'pilar3') {
      return 'Layanan Responsif';
    }
    if (
      primary.includes('perencanaan') ||
      primary.includes('individual') ||
      primary.includes('peminatan') ||
      primary.includes('karir') ||
      primary === 'pilar2'
    ) {
      return 'Perencanaan Individual';
    }
    if (
      primary.includes('dukungan') ||
      primary.includes('sistem') ||
      primary.includes('system') ||
      primary === 'pilar4'
    ) {
      return 'Dukungan Sistem';
    }
  }

  const secondary = cleanStr(rawServiceType);
  if (secondary) {
    if (
      secondary.includes('dasar') ||
      secondary.includes('basic') ||
      secondary.includes('klasikal') ||
      secondary.includes('orientasi') ||
      secondary.includes('informasi') ||
      secondary.includes('penguasaankonten') ||
      secondary.includes('papanbimbingan') ||
      secondary.includes('asesmenkebutuhan') ||
      secondary.includes('needassessment') ||
      secondary.includes('bimbingankelompok')
    ) {
      return 'Layanan Dasar';
    }
    if (
      secondary.includes('perencanaan') ||
      secondary.includes('peminatan') ||
      secondary.includes('penempatan') ||
      secondary.includes('penyaluran') ||
      secondary.includes('karir') ||
      secondary.includes('bakat') ||
      secondary.includes('potensi') ||
      secondary.includes('portofolio')
    ) {
      return 'Perencanaan Individual';
    }
    if (
      secondary.includes('dukungan') ||
      secondary.includes('sistem') ||
      secondary.includes('konsultasi') ||
      secondary.includes('kolaborasi') ||
      secondary.includes('alihtangan') ||
      secondary.includes('referral') ||
      secondary.includes('konferensi') ||
      secondary.includes('kunjunganrumah') ||
      secondary.includes('homevisit') ||
      secondary.includes('manajemen') ||
      secondary.includes('evaluasi')
    ) {
      return 'Dukungan Sistem';
    }
    if (
      secondary.includes('responsif') ||
      secondary.includes('konseling') ||
      secondary.includes('mediasi') ||
      secondary.includes('advokasi') ||
      secondary.includes('bantuan')
    ) {
      return 'Layanan Responsif';
    }
  }

  return 'Belum Terkategori';
}

/**
 * Maps a CounselingService's pillar/type into one of the 4 standard Evaluasi Program BK tabs.
 */
export function mapServiceToEvaluationBidang(service: Partial<CounselingService>): StandardEvaluationBidang {
  const anySrv = service as any;
  const flex = normalizeBidangFlexible(
    anySrv.bidang || anySrv.bidangProgram || service.bkComponent,
    service.serviceType
  );
  if (flex !== 'Belum Terkategori') return flex;
  const raw = service.bkComponent || getBKComponentForService(service.serviceType || '');
  const lower = String(raw || '').toLowerCase();

  if (lower.includes('dasar')) return 'Layanan Dasar';
  if (lower.includes('perencanaan') || lower.includes('peminatan')) return 'Perencanaan Individual';
  if (lower.includes('dukungan')) return 'Dukungan Sistem';
  return 'Layanan Responsif';
}

/**
 * Normalizes any evaluation's bidang string for grouping under the 4 main tabs.
 */
export function normalizeBidangTab(bidang?: string): StandardEvaluationBidang {
  const flex = normalizeBidangFlexible(bidang, '');
  if (flex !== 'Belum Terkategori') return flex;
  return 'Layanan Dasar';
}

/**
 * Safely parses Firestore Timestamp (.toDate()), serialized seconds object, Date, or ISO/DMY string.
 * Falls back to createdAt / updatedAt when tanggal/date is absent.
 */
export function parseFlexibleDate(val: any): Date | null {
  if (!val) return null;

  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        const d = val.toDate();
        if (d instanceof Date && !isNaN(d.getTime()) && d.getFullYear() > 1970) return d;
      } catch {}
    }
    const sec = val.seconds ?? val._seconds;
    if (typeof sec === 'number' && Number.isFinite(sec)) {
      const d = new Date(sec * 1000);
      if (!isNaN(d.getTime()) && d.getFullYear() > 1970) return d;
    }
    if (val instanceof Date) {
      return !isNaN(val.getTime()) && val.getFullYear() > 1970 ? val : null;
    }
  }

  if (typeof val === 'number' && Number.isFinite(val)) {
    const d = new Date(val);
    return !isNaN(d.getTime()) && d.getFullYear() > 1970 ? d : null;
  }

  const str = String(val).trim();
  if (!str || str.startsWith('1899-12-30')) return null;

  const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = parseInt(ymd[2], 10);
    const dNum = parseInt(ymd[3], 10);
    if (y > 1970 && m >= 1 && m <= 12 && dNum >= 1 && dNum <= 31) {
      return new Date(y, m - 1, dNum, 12, 0, 0);
    }
  }

  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const dNum = parseInt(dmy[1], 10);
    const m = parseInt(dmy[2], 10);
    const y = parseInt(dmy[3], 10);
    if (y > 1970 && m >= 1 && m <= 12 && dNum >= 1 && dNum <= 31) {
      return new Date(y, m - 1, dNum, 12, 0, 0);
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1970) {
    return parsed;
  }
  return null;
}

export function normalizeServiceDate(srv: any): {
  dateObj: Date | null;
  isoDate: string;
  formattedDate: string;
} {
  const candidates = [srv?.tanggal, srv?.date, srv?.createdAt, srv?.updatedAt];
  for (const cand of candidates) {
    const d = parseFlexibleDate(cand);
    if (d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const isoDate = `${y}-${m}-${day}`;
      return {
        dateObj: d,
        isoDate,
        formattedDate: formatTanggalIndonesia(d),
      };
    }
  }
  return {
    dateObj: null,
    isoDate: '',
    formattedDate: 'Tanggal belum tercatat',
  };
}

/**
 * Infers Semester ('Ganjil' | 'Genap') from a date string/object.
 * Indonesian academic calendar: July-Dec = Ganjil, Jan-Jun = Genap.
 */
export function getSemesterFromDate(dateInput?: any): 'Ganjil' | 'Genap' {
  const parsed = parseFlexibleDate(dateInput);
  if (parsed) {
    return parsed.getMonth() + 1 >= 7 ? 'Ganjil' : 'Genap';
  }
  const iso = String(dateInput || '').slice(0, 10);
  const parts = iso.split('-');
  if (parts.length >= 2) {
    const month = parseInt(parts[1], 10);
    if (!Number.isNaN(month)) {
      return month >= 7 ? 'Ganjil' : 'Genap';
    }
  }
  const nowMonth = new Date().getMonth() + 1;
  return nowMonth >= 7 ? 'Ganjil' : 'Genap';
}

/**
 * Infers Tahun Ajaran (e.g. '2026/2027') from a date string/object.
 */
export function getTahunAjaranFromDate(dateInput?: any): string {
  const parsed = parseFlexibleDate(dateInput);
  if (parsed) {
    const y = parsed.getFullYear();
    const m = parsed.getMonth() + 1;
    return m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
  }
  const iso = String(dateInput || '').slice(0, 10);
  const parts = iso.split('-');
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (parts.length >= 2) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!Number.isNaN(y) && !Number.isNaN(m)) {
      year = y;
      month = m;
    }
  }

  return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export function getCurrentPeriodDefaults(): { semester: 'Ganjil' | 'Genap'; tahunAjaran: string } {
  const today = new Date().toISOString().slice(0, 10);
  return {
    semester: getSemesterFromDate(today),
    tahunAjaran: getTahunAjaranFromDate(today),
  };
}

export function computeEvaluationPercentage(realisasi: number, target: number | null | undefined): number | null {
  if (target === null || target === undefined || Number.isNaN(Number(target)) || Number(target) <= 0) {
    return null;
  }
  const real = Number(realisasi) || 0;
  return Math.round((real / Number(target)) * 100);
}

export function extractClassesFromService(service: any): string {
  if (!Array.isArray(service?.students) || service.students.length === 0) {
    if (service?.studentClass) {
      return String(service.studentClass).replace(/kelas\s*/i, '').trim().toUpperCase();
    }
    if (service?.kelas) {
      return String(service.kelas).replace(/kelas\s*/i, '').trim().toUpperCase();
    }
    return service?.targetType === 'Klasikal' ? 'Klasikal' : 'Umum';
  }
  const clsSet = new Set<string>();
  service.students.forEach((s: any) => {
    if (s?.class) {
      clsSet.add(String(s.class).replace(/kelas\s*/i, '').trim().toUpperCase());
    }
  });
  return clsSet.size > 0 ? Array.from(clsSet).sort().join(', ') : 'Umum';
}

export function normalizeClassToken(cls?: string): string {
  return String(cls || '')
    .replace(/kelas\s*/i, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

export function evaluationMatchesClassFilter(ev: ProgramEvaluation, selectedClass: string): boolean {
  if (!selectedClass || selectedClass === 'Semua' || selectedClass.toLowerCase().includes('semua')) {
    return true;
  }
  const targetNorm = normalizeClassToken(selectedClass);
  const rawTokens = String(ev.kelas || '')
    .split(/[,;/]+/)
    .map((t) => normalizeClassToken(t))
    .filter(Boolean);
  return rawTokens.some((tok) => tok === targetNorm || tok.includes(targetNorm));
}

export function serviceMatchesClassFilter(srv: any, selectedClass: string): boolean {
  if (!selectedClass || selectedClass === 'Semua' || selectedClass.toLowerCase().includes('semua')) {
    return true;
  }
  const targetNorm = normalizeClassToken(selectedClass);
  if (Array.isArray(srv?.students) && srv.students.length > 0) {
    return srv.students.some((s: any) => normalizeClassToken(s?.class) === targetNorm);
  }
  const fallbackCls = normalizeClassToken(srv?.studentClass || srv?.kelas);
  return fallbackCls ? fallbackCls === targetNorm || fallbackCls.includes(targetNorm) : false;
}

export async function compressImageToDataUrl(
  file: File,
  maxDimension: number = 880,
  quality: number = 0.72
): Promise<{ name: string; dataUrl: string; type: string; sizeLabel: string }> {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!file.type.startsWith('image/')) {
    const rawDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return {
      name: file.name,
      dataUrl: rawDataUrl,
      type: file.type || 'application/octet-stream',
      sizeLabel: formatBytes(file.size),
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak valid'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            name: file.name,
            dataUrl: String(reader.result || ''),
            type: 'image/jpeg',
            sizeLabel: formatBytes(file.size),
          });
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressedUrl = canvas.toDataURL('image/jpeg', quality);
        const approxBytes = Math.round((compressedUrl.length * 3) / 4);
        resolve({
          name: file.name,
          dataUrl: compressedUrl,
          type: 'image/jpeg',
          sizeLabel: formatBytes(approxBytes),
        });
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export function getNormalizedEvidenceList(
  buktiFoto?: ProgramEvaluation['buktiFoto']
): { name: string; dataUrl: string; type?: string; sizeLabel?: string }[] {
  if (!Array.isArray(buktiFoto)) return [];
  return buktiFoto
    .map((item, idx) => {
      if (typeof item === 'string') {
        return {
          name: `Lampiran ${idx + 1}`,
          dataUrl: item,
          type: item.startsWith('data:image/') ? 'image/jpeg' : 'application/octet-stream',
        };
      }
      return item;
    })
    .filter((item) => item && item.dataUrl);
}

export interface AggregatedProgramActivity {
  id: string;
  title: string;
  serviceType: string;
  bidangNormalized: ExtendedEvaluationBidang;
  date: string;
  formattedDate: string;
  kelas: string;
  studentCount: number;
  status: string;
  isOutsidePeriod: boolean;
  periodNote: string;
}

export interface BidangAggregationBucket {
  bidang: ExtendedEvaluationBidang;
  totalServices: number;
  totalStudentsServed: number;
  totalParticipantEntries: number;
  inPeriodCount: number;
  outsidePeriodCount: number;
  activities: AggregatedProgramActivity[];
  classesSummary: string;
}

export interface AggregatedProgramServicesResult {
  totalServices: number;
  totalStudentsServed: number;
  totalParticipantEntries: number;
  activities: AggregatedProgramActivity[];
  classesSummary: string;
}

export interface SyncProgramEvaluasiResult {
  semester: 'Ganjil' | 'Genap';
  tahunAjaran: string;
  classFilter: string;
  syncedAtIso: string;
  syncedAtFormatted: string;
  totalServicesRead: number;
  userServicesCount: number;
  inPeriodCount: number;
  outsidePeriodCount: number;
  totalServicesCounted: number;
  totalUniqueStudents: number;
  classesSummary: string;
  bidangBuckets: Record<StandardEvaluationBidang, BidangAggregationBucket>;
  unclassifiedBucket: BidangAggregationBucket;
  detectedBidangSummary: string;
  allActivities: AggregatedProgramActivity[];
}

function getPeriodDateBounds(semester: 'Ganjil' | 'Genap', tahunAjaran: string): {
  start: Date;
  end: Date;
} {
  const parts = String(tahunAjaran || '2026/2027').split('/');
  const startYear = parseInt(parts[0], 10) || 2026;
  const endYear = parseInt(parts[1], 10) || startYear + 1;

  if (semester === 'Ganjil') {
    // Semester Ganjil: 1 Juli - 31 Desember
    return {
      start: new Date(startYear, 6, 1, 0, 0, 0),
      end: new Date(startYear, 11, 31, 23, 59, 59),
    };
  }
  // Semester Genap: 1 Januari - 30 Juni
  return {
    start: new Date(endYear, 0, 1, 0, 0, 0),
    end: new Date(endYear, 5, 30, 23, 59, 59),
  };
}

function serviceBelongsToActiveUser(
  srv: any,
  activeCounselor?: Counselor,
  activeSchoolId?: string
): boolean {
  if (!srv) return false;

  // Enforce school boundary when explicit schoolId exists
  const srvSchoolId = srv.schoolId ? sanitizeSchoolId(String(srv.schoolId)) : '';
  const targetSchoolId = activeSchoolId ? sanitizeSchoolId(activeSchoolId) : getActiveSchoolId();
  if (srvSchoolId && srvSchoolId !== targetSchoolId) {
    return false;
  }

  if (!activeCounselor) return true;

  const isAdmin = isAdministrator(activeCounselor);
  const cId = String(activeCounselor.id || '').trim().toLowerCase();
  const cName = String(activeCounselor.name || '').trim().toLowerCase();
  const cFirstName = cName.split(/[\s,]+/).filter(Boolean)[0] || '';
  const cEmail = String(activeCounselor.email || '').trim().toLowerCase();
  const cUser = String(activeCounselor.username || '').trim().toLowerCase();

  const sCreatedBy = String(srv.createdBy || '').trim().toLowerCase();
  const sCounselorId = String(srv.counselorId || '').trim().toLowerCase();
  const sCounselorName = String(srv.counselorName || '').trim().toLowerCase();
  const sRecordedBy = String(srv.recordedBy || '').trim().toLowerCase();

  const matchAuthor = (fieldVal: string) => {
    if (!fieldVal) return false;
    if (cId && fieldVal === cId) return true;
    if (cEmail && fieldVal === cEmail) return true;
    if (cUser && (fieldVal === cUser || fieldVal.includes(cUser))) return true;
    if (cName && (fieldVal === cName || fieldVal.includes(cName) || cName.includes(fieldVal))) return true;
    if (cFirstName && cFirstName.length >= 4 && fieldVal.includes(cFirstName)) return true;
    return false;
  };

  if (
    matchAuthor(sCreatedBy) ||
    matchAuthor(sCounselorId) ||
    matchAuthor(sCounselorName) ||
    matchAuthor(sRecordedBy)
  ) {
    return true;
  }

  // Administrator/Koordinator or legacy unattributed docs within the same school
  const hasAnyAuthorField = Boolean(sCreatedBy || sCounselorId || sCounselorName || sRecordedBy);
  if (isAdmin || !hasAnyAuthorField) {
    return true;
  }

  return false;
}

function extractStudentKeysFromService(srv: any): { keys: string[]; classes: string[]; entryCount: number } {
  const keys: string[] = [];
  const classes: string[] = [];

  if (Array.isArray(srv?.students) && srv.students.length > 0) {
    srv.students.forEach((st: any) => {
      if (!st) return;
      const sid = String(st.id || st.studentId || '').trim();
      const sName = String(st.name || st.studentName || '').toLowerCase().trim();
      const sClass = normalizeClassToken(st.class || st.studentClass || '');
      if (sid) {
        keys.push(`id:${sid}`);
      } else if (sName) {
        keys.push(`nc:${sName}|${sClass}`);
      }
      if (sClass) classes.push(sClass);
    });
    return { keys, classes, entryCount: srv.students.length };
  }

  const singleId = String(srv?.studentId || '').trim();
  const singleName = String(srv?.studentName || '').toLowerCase().trim();
  const singleClass = normalizeClassToken(srv?.studentClass || srv?.kelas || '');
  if (singleId) {
    keys.push(`id:${singleId}`);
  } else if (singleName) {
    keys.push(`nc:${singleName}|${singleClass}`);
  }
  if (singleClass) classes.push(singleClass);

  return {
    keys,
    classes,
    entryCount: keys.length > 0 ? 1 : 0,
  };
}

/**
 * Pure computation engine on raw services array (used both by syncProgramEvaluasi async & instant reactive updates).
 */
export function computeAll4BidangAggregation(
  rawServices: any[],
  options: {
    semester: 'Ganjil' | 'Genap';
    tahunAjaran: string;
    classFilter?: string;
    activeCounselor?: Counselor;
    activeSchoolId?: string;
    totalServicesReadOverride?: number;
  }
): SyncProgramEvaluasiResult {
  const {
    semester,
    tahunAjaran,
    classFilter = 'Semua',
    activeCounselor,
    activeSchoolId = getActiveSchoolId(),
    totalServicesReadOverride,
  } = options;

  const cleanList = (Array.isArray(rawServices) ? rawServices : []).filter(
    (item) => item && !isDummyRecord(item, 'bk_services')
  );
  const totalServicesRead = totalServicesReadOverride ?? cleanList.length;

  // 1. User filter in JS code (never via rigid Firestore query)
  let userServices = cleanList.filter((srv) =>
    serviceBelongsToActiveUser(srv, activeCounselor, activeSchoolId)
  );
  // Safeguard: if same-school services exist but strict author string didn't match, keep school services
  if (userServices.length === 0 && cleanList.length > 0) {
    userServices = cleanList.filter((srv) => {
      const sId = srv?.schoolId ? sanitizeSchoolId(String(srv.schoolId)) : '';
      return !sId || sId === sanitizeSchoolId(activeSchoolId);
    });
  }

  // 2. Class filter ONLY if user did not pick Semua / Semua Kelas Binaan
  const classFilteredServices =
    !classFilter ||
    classFilter === 'Semua' ||
    classFilter.toLowerCase().includes('semua')
      ? userServices
      : userServices.filter((srv) => serviceMatchesClassFilter(srv, classFilter));

  const bounds = getPeriodDateBounds(semester, tahunAjaran);

  const createEmptyBucket = (bidang: ExtendedEvaluationBidang): BidangAggregationBucket => ({
    bidang,
    totalServices: 0,
    totalStudentsServed: 0,
    totalParticipantEntries: 0,
    inPeriodCount: 0,
    outsidePeriodCount: 0,
    activities: [],
    classesSummary: 'Semua Kelas',
  });

  const bidangBuckets: Record<StandardEvaluationBidang, BidangAggregationBucket> = {
    'Layanan Dasar': createEmptyBucket('Layanan Dasar'),
    'Layanan Responsif': createEmptyBucket('Layanan Responsif'),
    'Perencanaan Individual': createEmptyBucket('Perencanaan Individual'),
    'Dukungan Sistem': createEmptyBucket('Dukungan Sistem'),
  };
  const unclassifiedBucket = createEmptyBucket('Belum Terkategori');

  const uniqueKeysPerBucket: Record<ExtendedEvaluationBidang, Set<string>> = {
    'Layanan Dasar': new Set<string>(),
    'Layanan Responsif': new Set<string>(),
    'Perencanaan Individual': new Set<string>(),
    'Dukungan Sistem': new Set<string>(),
    'Belum Terkategori': new Set<string>(),
  };
  const classesPerBucket: Record<ExtendedEvaluationBidang, Set<string>> = {
    'Layanan Dasar': new Set<string>(),
    'Layanan Responsif': new Set<string>(),
    'Perencanaan Individual': new Set<string>(),
    'Dukungan Sistem': new Set<string>(),
    'Belum Terkategori': new Set<string>(),
  };

  const globalUniqueStudents = new Set<string>();
  const globalClassesSet = new Set<string>();
  let totalInPeriod = 0;
  let totalOutsidePeriod = 0;
  const allActivities: AggregatedProgramActivity[] = [];

  classFilteredServices.forEach((srv, idx) => {
    const anySrv = srv as any;
    const bidangNorm = normalizeBidangFlexible(
      anySrv.bidang || anySrv.bidangProgram || srv.bkComponent,
      srv.serviceType
    );

    const { dateObj, isoDate, formattedDate } = normalizeServiceDate(srv);
    let isOutsidePeriod = false;
    let periodNote = `${semester} ${tahunAjaran}`;

    if (!dateObj) {
      isOutsidePeriod = true;
      periodNote = 'Di luar periode (tanggal tidak tersedia)';
    } else if (dateObj < bounds.start || dateObj > bounds.end) {
      isOutsidePeriod = true;
      const docSem = getSemesterFromDate(dateObj);
      const docTa = getTahunAjaranFromDate(dateObj);
      periodNote = `Di luar periode (${docSem} ${docTa})`;
    }

    if (isOutsidePeriod) {
      totalOutsidePeriod += 1;
    } else {
      totalInPeriod += 1;
    }

    const { keys, classes, entryCount } = extractStudentKeysFromService(srv);
    keys.forEach((k) => {
      uniqueKeysPerBucket[bidangNorm].add(k);
      globalUniqueStudents.add(k);
    });
    classes.forEach((c) => {
      classesPerBucket[bidangNorm].add(c);
      globalClassesSet.add(c);
    });

    const act: AggregatedProgramActivity = {
      id: String(srv.id || `srv-${idx}`),
      title: srv.problem || srv.topic || srv.serviceType || 'Layanan BK',
      serviceType: srv.serviceType || '-',
      bidangNormalized: bidangNorm,
      date: isoDate,
      formattedDate,
      kelas: extractClassesFromService(srv),
      studentCount: entryCount,
      status: srv.status || 'Selesai',
      isOutsidePeriod,
      periodNote,
    };

    allActivities.push(act);

    const targetBucket =
      bidangNorm === 'Belum Terkategori' ? unclassifiedBucket : bidangBuckets[bidangNorm];
    targetBucket.totalServices += 1;
    targetBucket.totalParticipantEntries += entryCount;
    if (isOutsidePeriod) targetBucket.outsidePeriodCount += 1;
    else targetBucket.inPeriodCount += 1;
    targetBucket.activities.push(act);
  });

  // Finalize counts & sort (prioritize Selected Tahun Ajaran / In-Period items first)
  const finalizeBucket = (bucket: BidangAggregationBucket) => {
    bucket.totalStudentsServed = uniqueKeysPerBucket[bucket.bidang].size;
    bucket.classesSummary =
      classesPerBucket[bucket.bidang].size > 0
        ? Array.from(classesPerBucket[bucket.bidang]).sort().join(', ')
        : 'Semua Kelas';
    bucket.activities.sort((a, b) => {
      if (a.isOutsidePeriod !== b.isOutsidePeriod) {
        return a.isOutsidePeriod ? 1 : -1;
      }
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  };

  STANDARD_EVALUATION_BIDANG.forEach((b) => finalizeBucket(bidangBuckets[b]));
  finalizeBucket(unclassifiedBucket);

  allActivities.sort((a, b) => {
    if (a.isOutsidePeriod !== b.isOutsidePeriod) {
      return a.isOutsidePeriod ? 1 : -1;
    }
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  const debugParts = STANDARD_EVALUATION_BIDANG.map(
    (b) => `${b}: ${bidangBuckets[b].totalServices}`
  );
  if (unclassifiedBucket.totalServices > 0) {
    debugParts.push(`Belum Terkategori: ${unclassifiedBucket.totalServices}`);
  }

  const now = new Date();
  return {
    semester,
    tahunAjaran,
    classFilter,
    syncedAtIso: now.toISOString(),
    syncedAtFormatted: formatTanggalWaktuIndonesia(now),
    totalServicesRead,
    userServicesCount: userServices.length,
    inPeriodCount: totalInPeriod,
    outsidePeriodCount: totalOutsidePeriod,
    totalServicesCounted: classFilteredServices.length,
    totalUniqueStudents: globalUniqueStudents.size,
    classesSummary:
      globalClassesSet.size > 0
        ? Array.from(globalClassesSet).sort().join(', ')
        : 'Semua Kelas',
    bidangBuckets,
    unclassifiedBucket,
    detectedBidangSummary: debugParts.join(' | '),
    allActivities,
  };
}

/**
 * Fetches ALL documents from Firestore `services` (both root `services` and `schools/{schoolId}/services`)
 * WITHOUT rigid Firestore query filters, merges with cached/state services, then normalizes & aggregates
 * all 4 BK bidang simultaneously in client code.
 */
export async function syncProgramEvaluasi(params: {
  semester: 'Ganjil' | 'Genap';
  tahunAjaran: string;
  classFilter?: string;
  activeCounselor?: Counselor;
  fallbackServices?: CounselingService[];
}): Promise<SyncProgramEvaluasiResult> {
  const activeSchoolId = getActiveSchoolId();
  const docMap = new Map<string, any>();

  const ingest = (raw: any) => {
    if (!raw || !raw.id) return;
    if (isDummyRecord(raw, 'bk_services')) return;
    docMap.set(String(raw.id), raw);
  };

  // Seed with in-memory & localStorage services first so offline or instant reads never return 0
  if (Array.isArray(params.fallbackServices)) {
    params.fallbackServices.forEach(ingest);
  }
  try {
    const localSchoolServices = loadSchoolData<any[]>('bk_services', [], activeSchoolId);
    if (Array.isArray(localSchoolServices)) {
      localSchoolServices.forEach(ingest);
    }
  } catch {}

  // Fetch ALL documents from Firestore `services` (school subcollection + root collection) WITHOUT rigid filters
  let firestoreReadCount = 0;
  try {
    const [subSnap, rootSnap] = await Promise.allSettled([
      getDocs(collection(db, 'schools', activeSchoolId, 'services')),
      getDocs(collection(db, 'services')),
    ]);

    if (subSnap.status === 'fulfilled') {
      subSnap.value.forEach((d) => {
        firestoreReadCount += 1;
        ingest({ id: d.id, ...d.data() });
      });
    }
    if (rootSnap.status === 'fulfilled') {
      rootSnap.value.forEach((d) => {
        firestoreReadCount += 1;
        const item = { id: d.id, ...d.data() };
        if (!docMap.has(String(d.id))) {
          ingest(item);
        }
      });
    }
  } catch (err) {
    console.warn('[syncProgramEvaluasi] Firestore read fallback to local cache:', err);
  }

  const allMerged = Array.from(docMap.values());
  return computeAll4BidangAggregation(allMerged, {
    semester: params.semester,
    tahunAjaran: params.tahunAjaran,
    classFilter: params.classFilter || 'Semua',
    activeCounselor: params.activeCounselor,
    activeSchoolId,
    totalServicesReadOverride: Math.max(firestoreReadCount, allMerged.length),
  });
}

/**
 * Legacy-compatible single-bidang helper (used in EvaluasiProgramView tab summary & PDF).
 */
export function aggregateServicesForProgramPeriod(
  services: CounselingService[],
  bidang: string,
  semester: 'Ganjil' | 'Genap' | 'Semua',
  tahunAjaran: string,
  classFilter: string = 'Semua'
): AggregatedProgramServicesResult {
  const targetBidang = normalizeBidangTab(bidang);
  const matching = (Array.isArray(services) ? services : []).filter((srv) => {
    if (!srv) return false;
    if (mapServiceToEvaluationBidang(srv) !== targetBidang) return false;
    if (semester !== 'Semua' && getSemesterFromDate(srv.date) !== semester) return false;
    if (tahunAjaran !== 'Semua' && getTahunAjaranFromDate(srv.date) !== tahunAjaran) return false;
    if (classFilter !== 'Semua' && !serviceMatchesClassFilter(srv, classFilter)) return false;
    return true;
  });

  const uniqueStudentKeys = new Set<string>();
  const classesSet = new Set<string>();
  let totalParticipantEntries = 0;

  const activities: AggregatedProgramActivity[] = matching
    .map((srv) => {
      const studentsArr = Array.isArray(srv.students) ? srv.students : [];
      totalParticipantEntries += studentsArr.length;
      studentsArr.forEach((st) => {
        const key = st.id
          ? `id:${st.id}`
          : `nc:${(st.name || '').toLowerCase().trim()}|${normalizeClassToken(st.class)}`;
        uniqueStudentKeys.add(key);
        if (st.class) classesSet.add(normalizeClassToken(st.class));
      });
      const normD = normalizeServiceDate(srv);
      return {
        id: srv.id,
        title: srv.problem || srv.serviceType || 'Layanan BK',
        serviceType: srv.serviceType || '-',
        bidangNormalized: targetBidang,
        date: normD.isoDate,
        formattedDate: normD.formattedDate,
        kelas: extractClassesFromService(srv),
        studentCount: studentsArr.length,
        status: srv.status || 'Selesai',
        isOutsidePeriod: false,
        periodNote: `${semester} ${tahunAjaran}`,
      };
    })
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  return {
    totalServices: matching.length,
    totalStudentsServed: uniqueStudentKeys.size,
    totalParticipantEntries,
    activities,
    classesSummary: classesSet.size > 0 ? Array.from(classesSet).sort().join(', ') : 'Semua Kelas',
  };
}

// ============================================================================
// KUNCI ALUR UTAMA: EVALUASI LAYANAN (6 SKOR + BASELINE + FOLLOW-UP DELTA) -> EVALUASI PROGRAM BK
// ============================================================================

export const EVALUATION_JENIS_MASALAH: EvaluationJenisMasalah[] = [
  'Terlambat',
  'Bolos',
  'Konflik Teman',
  'Motivasi Belajar Rendah',
  'Kecemasan',
  'Keluarga',
  'Disiplin',
  'Perencanaan Karir',
  'Lainnya',
];

export const LEGACY_PROBLEM_LABELS: string[] = [
  'Motivasi',
  'Motivasi Belajar',
  'Disiplin & Telat',
  'Pertemanan',
  'Pertemanan & Ejekan',
  'Game & Gadget',
  'Emosi',
  'Emosi & Perilaku',
  'Masalah Rumah',
];

export function isLegacyJenisMasalah(val?: string | null, serviceType?: string | null): boolean {
  const raw = String(val || '').trim();
  if (!raw) {
    // Also flag old Konseling Kelompok / Mediasi / Klasikal / Referal services lacking standardized Blok B
    return Boolean(serviceType);
  }
  if (EVALUATION_JENIS_MASALAH.includes(raw as EvaluationJenisMasalah)) {
    return false;
  }
  const lower = raw.toLowerCase();
  if (LEGACY_PROBLEM_LABELS.some((lbl) => lbl.toLowerCase() === lower)) {
    return true;
  }
  return true;
}

export function mapLegacyProblemToStandardJenisMasalah(val?: string | null): EvaluationJenisMasalah {
  const lower = String(val || '').trim().toLowerCase();
  if (!lower) return 'Lainnya';
  if (lower.includes('telat') || lower.includes('terlambat')) return 'Terlambat';
  if (lower.includes('bolos') || lower.includes('alpa')) return 'Bolos';
  if (lower.includes('teman') || lower.includes('ejek') || lower.includes('konflik') || lower.includes('bully')) {
    return 'Konflik Teman';
  }
  if (lower.includes('motivasi') || lower.includes('belajar')) return 'Motivasi Belajar Rendah';
  if (lower.includes('cemas') || lower.includes('emosi') || lower.includes('stres')) return 'Kecemasan';
  if (lower.includes('rumah') || lower.includes('keluarga') || lower.includes('ortu')) return 'Keluarga';
  if (lower.includes('disiplin') || lower.includes('game') || lower.includes('gadget')) return 'Disiplin';
  if (lower.includes('karir') || lower.includes('masa depan') || lower.includes('peminatan')) return 'Perencanaan Karir';
  return 'Lainnya';
}

export const EVALUATION_TEKNIK_OPTIONS: EvaluationTeknikType[] = [
  'Konseling Individual',
  'Konseling Kelompok',
  'Bimbingan Klasikal',
  'Mediasi',
  'Observasi',
  'Wawancara',
  'Home Visit',
  'Referal',
];

export const EVALUATION_TUJUAN_OPTIONS: EvaluationTujuanType[] = [
  'Memahami Masalah',
  'Mengubah Perilaku',
  'Memberi Dukungan',
  'Merencanakan Masa Depan',
  'Menyelesaikan Konflik',
];

export const EVALUATION_FOLLOWUP_STATUS_OPTIONS: EvaluationFollowUpStatus[] = [
  'Belum Dikerjakan',
  'Sedang Berjalan',
  'Selesai',
  'Tidak Berhasil',
];

// Lapisan 1: Kebutuhan Awal Siswa (diisi 1x di Awal Semester)
export const KEBUTUHAN_UTAMA_OPTIONS: string[] = [
  'Motivasi Belajar Rendah',
  'Terlambat',
  'Konflik Teman',
  'Kecemasan',
  'Keluarga',
  'Disiplin',
  'Perencanaan Karir',
];

export const CARA_MENENTUKAN_KEBUTUHAN_OPTIONS: NeedDeterminationMethod[] = [
  'Angket Siswa',
  'Observasi Wali Kelas',
  'Data Tahun Lalu',
  'Perkiraan Guru BK',
];

// Lapisan 3: Status Akhir Kasus (pada Evaluasi Layanan terisi, bisa diubah kapan saja)
export const STATUS_AKHIR_KASUS_OPTIONS: CaseFinalStatus[] = [
  'Tuntas',
  'Masih Berproses',
  'Dirujuk ke Psikolog / Pihak Luar',
  'Tidak Tertangani',
];

export const ALASAN_TIDAK_TERTANGANI_OPTIONS: string[] = [
  'Siswa Pindah',
  'Orang Tua Menolak',
  'Di Luar Kewenangan BK',
];

// Lapisan 4: Kendala Terbesar Refleksi Konselor (1x di Akhir Semester)
export const KENDALA_TERBESAR_REFLEKSI_OPTIONS: string[] = [
  'Waktu',
  'Beban Mengajar',
  'Dukungan Wali Kelas',
  'Ruang Konseling',
  'Jadwal Bentrok',
  'Banyak Layanan Belum Dievaluasi',
  'Lainnya',
];

export const UNCOLLECTED_PLACEHOLDER = 'Belum terkumpul';
export const EMPTY_BLOCK_PLACEHOLDER = 'Belum ada data, boleh dikosongkan';

export function isUncollectedPlaceholderText(val?: string | null): boolean {
  const s = String(val || '').trim().toLowerCase();
  if (!s) return true;
  return (
    s === '-' ||
    s === 'belum terkumpul' ||
    s === 'belum ada data, boleh dikosongkan' ||
    s === 'belum ada data untuk bidang ini.' ||
    s === 'belum ada data' ||
    s === 'kosong'
  );
}

export function hasRealStakeholderVoices(sh?: {
  suaraSiswa?: string;
  suaraWaliKelas?: string;
  suaraKepsekOrtu?: string;
} | null): boolean {
  if (!sh) return false;
  return (
    !isUncollectedPlaceholderText(sh.suaraSiswa) ||
    !isUncollectedPlaceholderText(sh.suaraWaliKelas) ||
    !isUncollectedPlaceholderText(sh.suaraKepsekOrtu)
  );
}

export function resolveServiceCaseFinalStatus(ev?: Partial<ProgramEvaluation> | null): CaseFinalStatus {
  if (ev?.statusAkhirKasus) return ev.statusAkhirKasus;
  const followUp = String(ev?.statusTindakLanjut || '');
  const teknik = String(ev?.teknikDipakai || ev?.jenisLayanan || '').toLowerCase();
  if (followUp === 'Perlu Rujukan' || teknik.includes('referal') || teknik.includes('alih tangan')) {
    return 'Dirujuk ke Psikolog / Pihak Luar';
  }
  if (followUp === 'Tidak Berhasil') {
    return 'Tidak Tertangani';
  }
  if (isServiceEvalFollowUpCompleted(ev)) {
    return 'Tuntas';
  }
  return 'Masih Berproses';
}

export function buildKebutuhanPlanId(schoolId: string, semester: 'Ganjil' | 'Genap', tahunAjaran: string): string {
  const safeSchool = sanitizeSchoolId(schoolId || 'default');
  const safeTa = String(tahunAjaran || '20262027').replace(/[^0-9a-zA-Z]/g, '');
  return `kebutuhan-${safeSchool}-${semester.toLowerCase()}-${safeTa}`;
}

export const FOKUS_UTAMA_TAHUNAN_OPTIONS: FokusUtamaTahunan[] = [
  'Mengurangi Bolos',
  'Menangani Konflik Teman',
  'Meningkatkan Motivasi Belajar',
  'Mengurangi Kecemasan',
];

export function buildRencanaTahunanPlanId(schoolId: string, tahunAjaran: string): string {
  const safeSchool = sanitizeSchoolId(schoolId || 'default');
  const safeTa = String(tahunAjaran || '20262027').replace(/[^0-9a-zA-Z]/g, '');
  return `rencana-tahunan-${safeSchool}-${safeTa}`;
}

export function getPreviousTahunAjaran(tahunAjaran: string): string {
  const match = String(tahunAjaran || '').match(/^(\d{4})\/(\d{4})$/);
  if (!match) return '2025/2026';
  const y1 = parseInt(match[1], 10) - 1;
  const y2 = parseInt(match[2], 10) - 1;
  return `${y1}/${y2}`;
}

export function calculateRencanaTahunanDraft(params: {
  tahunAjaran?: string;
  jamPerMinggu?: number;
  jumlahKelas?: number;
  fokusUtama?: FokusUtamaTahunan;
}): RencanaTahunanData {
  const tahunAjaran = params.tahunAjaran || '2026/2027';
  const jamPerMinggu = Math.max(0, Math.min(10, Number(params.jamPerMinggu ?? 1) || 0));
  const jumlahKelas = Math.max(1, Math.min(40, Math.round(Number(params.jumlahKelas ?? 7) || 1)));
  const fokusUtama: FokusUtamaTahunan = FOKUS_UTAMA_TAHUNAN_OPTIONS.includes(
    params.fokusUtama as FokusUtamaTahunan
  )
    ? (params.fokusUtama as FokusUtamaTahunan)
    : 'Meningkatkan Motivasi Belajar';

  const mingguEfektif = 36; // 52 minggu - 14 minggu libur/ujian/jeda
  const pertemuanPerKelas = Math.round(jamPerMinggu * mingguEfektif);
  const totalKlasikal = pertemuanPerKelas * jumlahKelas;
  const perSemester = Math.floor(totalKlasikal / 2);
  const targetRealistis90 = Math.floor(totalKlasikal * 0.9);

  const targetLayananDasar = targetRealistis90;
  const targetLayananResponsif = 80; // 2-3 kasus/minggu x 36 minggu efektif (realistis)
  const targetPerencanaanIndividual = 2 * jumlahKelas * 2; // 2 sesi/kelas x 2 semester
  const targetDukunganSistem = 24; // 2 kegiatan/bulan x 12 bulan
  const totalTarget =
    targetLayananDasar +
    targetLayananResponsif +
    targetPerencanaanIndividual +
    targetDukunganSistem;
  const isOverloaded = totalTarget > 400;

  const fokusStrategyMap: Record<FokusUtamaTahunan, string> = {
    'Mengurangi Bolos':
      'Prioritaskan deteksi dini absensi pagi di Layanan Responsif & Home Visit tepat waktu, serta penguatan disiplin hadir di Bimbingan Klasikal.',
    'Menangani Konflik Teman':
      'Perbanyak layanan Mediasi sebaya & Konseling Kelompok pada Layanan Responsif, disertai materi anti-perundungan di Layanan Dasar.',
    'Meningkatkan Motivasi Belajar':
      'Fokuskan Bimbingan Klasikal pada manajemen waktu & strategi belajar efektif serta Perencanaan Individual untuk target studi.',
    'Mengurangi Kecemasan':
      'Optimalkan Konseling Individual & kelompok dukungan emosi pada Layanan Responsif serta edukasi regulasi stres di kelas.',
  };

  const overloadMsg = isOverloaded
    ? ` Perhatian: total ${totalTarget} layanan/tahun melampaui batas realistis 400 layanan untuk 1 guru BK.`
    : ` Total beban ${totalTarget} layanan/tahun masih realistis ditangani 1 guru BK.`;

  const aiNote = `Dengan ${jamPerMinggu} jam BK/minggu untuk ${jumlahKelas} kelas (36 minggu efektif), target realistis Layanan Dasar 90% = ${targetLayananDasar} sesi.${overloadMsg} Fokus Utama "${fokusUtama}": ${fokusStrategyMap[fokusUtama]}`;

  return {
    tahunAjaran,
    jamPerMinggu,
    jumlahKelas,
    fokusUtama,
    mingguEfektif,
    pertemuanPerKelas,
    totalKlasikal,
    perSemester,
    targetRealistis90,
    targetLayananDasar,
    targetLayananResponsif,
    targetPerencanaanIndividual,
    targetDukunganSistem,
    totalTarget,
    isOverloaded,
    aiNote,
    updatedAt: new Date().toISOString(),
  };
}

export function getActiveRencanaTahunan(
  evaluations: ProgramEvaluation[],
  tahunAjaran?: string
): RencanaTahunanData {
  const ta = tahunAjaran || getCurrentPeriodDefaults().tahunAjaran;
  const hit = (evaluations || []).find(
    (e) =>
      e.evaluationScope === 'rencana-tahunan' &&
      (e.tahunAjaran === ta || e.rencanaTahunan?.tahunAjaran === ta) &&
      e.rencanaTahunan
  );
  if (hit?.rencanaTahunan) return hit.rencanaTahunan;
  return calculateRencanaTahunanDraft({ tahunAjaran: ta, jamPerMinggu: 1, jumlahKelas: 7 });
}

export const EVALUATION_6_SCORES_META: {
  key: keyof Pick<
    ServiceEvaluation6Scores,
    | 'ketercapaianTujuan'
    | 'perubahanPerilaku'
    | 'keterlibatanSiswa'
    | 'keterbukaanSiswa'
    | 'kesesuaianTeknik'
    | 'kesiapanTindakLanjut'
  >;
  label: string;
  hint: string;
}[] = [
  { key: 'ketercapaianTujuan', label: 'Ketercapaian Tujuan', hint: 'Sejauh mana tujuan sesi tercapai' },
  { key: 'perubahanPerilaku', label: 'Perubahan Perilaku', hint: 'Komitmen/perubahan sikap siswa' },
  { key: 'keterlibatanSiswa', label: 'Keterlibatan Siswa', hint: 'Keaktifan siswa mengikuti sesi' },
  { key: 'keterbukaanSiswa', label: 'Keterbukaan Siswa', hint: 'Kejujuran & kenyamanan bercerita' },
  { key: 'kesesuaianTeknik', label: 'Kesesuaian Teknik', hint: 'Ketepatan metode dengan masalah' },
  { key: 'kesiapanTindakLanjut', label: 'Kesiapan Tindak Lanjut', hint: 'Kejelasan langkah setelah sesi' },
];

export const EVALUATION_4_KLASIKAL_SCORES_META: {
  key: keyof Pick<
    ServiceEvaluation6Scores,
    | 'ketercapaianTujuan'
    | 'keterlibatanSiswa'
    | 'kesesuaianTeknik'
    | 'kesiapanTindakLanjut'
  >;
  label: string;
  hint: string;
}[] = [
  { key: 'ketercapaianTujuan', label: 'Ketercapaian Tujuan Klasikal', hint: 'Sejauh mana tujuan layanan kelas tercapai' },
  { key: 'keterlibatanSiswa', label: 'Partisipasi & Dinamika Kelas', hint: 'Keaktifan kelas mengikuti sesi klasikal' },
  { key: 'kesesuaianTeknik', label: 'Kesesuaian Metode Klasikal', hint: 'Ketepatan teknik & media untuk dinamika kelas' },
  { key: 'kesiapanTindakLanjut', label: 'Kesiapan Tindak Lanjut Kelas', hint: 'Kejelasan agenda penguatan/monitoring kelas' },
];

export function isServiceKlasikalType(serviceType?: string | null, teknik?: string | null): boolean {
  const s = String(serviceType || '').toLowerCase();
  const t = String(teknik || '').toLowerCase();
  return s.includes('klasikal') || t.includes('klasikal');
}

export function mapJenisMasalahToBidang(jenisMasalah?: string): StandardEvaluationBidang {
  const m = String(jenisMasalah || '').toLowerCase();
  if (m.includes('perencanaan karir') || m.includes('karir') || m.includes('masa depan') || m.includes('peminatan')) {
    return 'Perencanaan Individual';
  }
  if (
    m.includes('terlambat') ||
    m.includes('bolos') ||
    m.includes('konflik') ||
    m.includes('cemas') ||
    m.includes('kecemasan') ||
    m.includes('keluarga') ||
    m.includes('disiplin')
  ) {
    return 'Layanan Responsif';
  }
  if (m.includes('motivasi') || m.includes('belajar')) {
    return 'Layanan Dasar';
  }
  return 'Layanan Responsif';
}

export function inferJenisMasalahFromService(srv?: Partial<CounselingService> | null): EvaluationJenisMasalah {
  const explicitBlokB = srv?.specificDetails?.blokB?.jenisMasalah;
  if (explicitBlokB && EVALUATION_JENIS_MASALAH.includes(explicitBlokB as EvaluationJenisMasalah)) {
    return explicitBlokB as EvaluationJenisMasalah;
  }
  const hay = `${srv?.problem || ''} ${srv?.focusIssue || ''} ${srv?.description || ''}`.toLowerCase();
  if (hay.includes('perencanaan karir') || hay.includes('karir') || hay.includes('masa depan') || hay.includes('peminatan') || hay.includes('jurusan')) {
    return 'Perencanaan Karir';
  }
  if (hay.includes('terlambat') || hay.includes('telat')) return 'Terlambat';
  if (hay.includes('bolos') || hay.includes('alpa') || hay.includes('mangkir')) return 'Bolos';
  if (hay.includes('konflik') || hay.includes('bertengkar') || hay.includes('bully') || hay.includes('teman') || hay.includes('mediasi')) {
    return 'Konflik Teman';
  }
  if (hay.includes('motivasi') || hay.includes('malas') || hay.includes('nilai') || hay.includes('belajar')) {
    return 'Motivasi Belajar Rendah';
  }
  if (hay.includes('cemas') || hay.includes('takut') || hay.includes('stres') || hay.includes('khawatir') || hay.includes('emosi')) {
    return 'Kecemasan';
  }
  if (hay.includes('keluarga') || hay.includes('orang tua') || hay.includes('rumah')) return 'Keluarga';
  if (hay.includes('disiplin') || hay.includes('tata tertib') || hay.includes('seragam') || hay.includes('hp') || hay.includes('gadget')) {
    return 'Disiplin';
  }
  return 'Lainnya';
}

export function inferTeknikFromService(srv?: Partial<CounselingService> | null): EvaluationTeknikType {
  const explicitTeknik = srv?.specificDetails?.blokB?.teknik;
  if (explicitTeknik) {
    return explicitTeknik === 'Kelompok' ? 'Konseling Kelompok' : explicitTeknik;
  }
  const subJenis = srv?.specificDetails?.observasiWawancaraReferal?.subJenis;
  if (subJenis === 'Observasi' || subJenis === 'Wawancara' || subJenis === 'Referal') {
    return subJenis;
  }
  const hay = `${srv?.serviceType || ''} ${srv?.description || ''}`.toLowerCase();
  if (hay.includes('home visit') || hay.includes('kunjungan rumah')) return 'Home Visit';
  if (hay.includes('klasikal')) return 'Bimbingan Klasikal';
  if (hay.includes('mediasi')) return 'Mediasi';
  if (hay.includes('kelompok')) return 'Konseling Kelompok';
  if (hay.includes('referal') || hay.includes('alih tangan')) return 'Referal';
  if (hay.includes('wawancara') && !hay.includes('observasi')) return 'Wawancara';
  if (hay.includes('observasi')) return 'Observasi';
  return 'Konseling Individual';
}

export function inferTujuanFromService(srv?: Partial<CounselingService> | null): EvaluationTujuanType {
  const explicitTujuan = srv?.specificDetails?.blokB?.tujuanLayanan;
  if (explicitTujuan && EVALUATION_TUJUAN_OPTIONS.includes(explicitTujuan as EvaluationTujuanType)) {
    return explicitTujuan as EvaluationTujuanType;
  }
  const hay = `${srv?.serviceType || ''} ${srv?.problem || ''} ${srv?.description || ''}`.toLowerCase();
  if (hay.includes('konflik') || hay.includes('mediasi') || hay.includes('bertengkar')) return 'Menyelesaikan Konflik';
  if (hay.includes('karir') || hay.includes('peminatan') || hay.includes('cita') || hay.includes('masa depan')) {
    return 'Merencanakan Masa Depan';
  }
  if (hay.includes('dukungan') || hay.includes('cemas') || hay.includes('keluarga')) return 'Memberi Dukungan';
  if (hay.includes('orientasi') || hay.includes('informasi') || hay.includes('memahami') || hay.includes('observasi')) return 'Memahami Masalah';
  return 'Mengubah Perilaku';
}

export function compute6ScoreSummary(
  partial: Partial<
    Pick<
      ServiceEvaluation6Scores,
      | 'ketercapaianTujuan'
      | 'perubahanPerilaku'
      | 'keterlibatanSiswa'
      | 'keterbukaanSiswa'
      | 'kesesuaianTeknik'
      | 'kesiapanTindakLanjut'
    >
  >,
  options?: { isKlasikal?: boolean }
): ServiceEvaluation6Scores {
  const clamp = (v: any) => {
    const n = Math.round(Number(v) || 3);
    return Math.max(1, Math.min(5, n));
  };
  const isKlasikal = Boolean(options?.isKlasikal);
  const ketercapaianTujuan = clamp(partial.ketercapaianTujuan ?? 4);
  const perubahanPerilaku = isKlasikal ? 0 : clamp(partial.perubahanPerilaku ?? 4);
  const keterlibatanSiswa = clamp(partial.keterlibatanSiswa ?? 4);
  const keterbukaanSiswa = isKlasikal ? 0 : clamp(partial.keterbukaanSiswa ?? 4);
  const kesesuaianTeknik = clamp(partial.kesesuaianTeknik ?? 4);
  const kesiapanTindakLanjut = clamp(partial.kesiapanTindakLanjut ?? 4);

  const totalSkor = isKlasikal
    ? ketercapaianTujuan + keterlibatanSiswa + kesesuaianTeknik + kesiapanTindakLanjut
    : ketercapaianTujuan +
      perubahanPerilaku +
      keterlibatanSiswa +
      keterbukaanSiswa +
      kesesuaianTeknik +
      kesiapanTindakLanjut;
  const divisor = isKlasikal ? 4 : 6;
  const rataRata = Number((totalSkor / divisor).toFixed(2));
  const kategori =
    rataRata >= 4.25
      ? 'Sangat Berhasil'
      : rataRata >= 3.5
        ? 'Berhasil'
        : rataRata >= 2.5
          ? 'Cukup'
          : 'Perlu Perbaikan';

  return {
    ketercapaianTujuan,
    perubahanPerilaku,
    keterlibatanSiswa,
    keterbukaanSiswa,
    kesesuaianTeknik,
    kesiapanTindakLanjut,
    totalSkor,
    rataRata,
    kategori,
  };
}

/**
 * Normalizes retrospective Baseline (keparahan 1-5 worst, frekuensi 1-5 worst, motivasiAwal 1-5 best)
 * onto a 1.0 - 5.0 condition scale aligned with follow-up Skor Perubahan Sekarang (1-5).
 */
export function computeBaselineKondisiAwal(
  baseline?: Partial<ServiceEvaluationBaseline> | null
): number {
  const k = Math.max(1, Math.min(5, Number(baseline?.keparahan ?? 3)));
  const f = Math.max(1, Math.min(5, Number(baseline?.frekuensi ?? 3)));
  const m = Math.max(1, Math.min(5, Number(baseline?.motivasiAwal ?? 3)));
  return Number((((6 - k) + (6 - f) + m) / 3).toFixed(2));
}

export function computeFollowUpDelta(
  baseline: Partial<ServiceEvaluationBaseline> | null | undefined,
  skorPerubahanSekarang: number
): number {
  const base = baseline?.skorKondisiAwal ?? computeBaselineKondisiAwal(baseline);
  const nowScore = Math.max(1, Math.min(5, Number(skorPerubahanSekarang) || 3));
  return Number((nowScore - base).toFixed(2));
}

export function isServiceEvalFollowUpCompleted(ev?: Partial<ProgramEvaluation> | null): boolean {
  const st = String(ev?.statusTindakLanjut || '');
  return st === 'Selesai' || st === 'Sudah Ditindaklanjuti';
}

export function getDaysSinceDate(dateInput?: any): number {
  const d = parseFlexibleDate(dateInput);
  if (!d) return 0;
  const diffMs = Date.now() - d.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function isEvaluationDueFor14DayFollowUp(ev?: ProgramEvaluation | null): boolean {
  if (!ev) return false;
  if (ev.evaluationScope === 'program' || !ev.serviceId) return false;
  if (ev.followUpCheck) return false;
  if (isServiceEvalFollowUpCompleted(ev)) return false;
  const days = getDaysSinceDate(ev.tanggal);
  return days >= 14;
}

export function getStudentServiceOrdinal(
  allServices: CounselingService[],
  targetService?: Partial<CounselingService> | null
): number {
  if (!targetService || !Array.isArray(targetService.students) || targetService.students.length === 0) {
    return 1;
  }
  const primary = targetService.students[0];
  const pId = String(primary.id || '').trim();
  const pName = String(primary.name || '').trim().toLowerCase();

  const matching = (allServices || []).filter((srv) =>
    (srv.students || []).some(
      (st) =>
        (pId && st.id === pId) ||
        (pName && String(st.name || '').trim().toLowerCase() === pName)
    )
  );
  if (matching.length === 0) return 1;
  const sorted = [...matching].sort((a, b) =>
    String(`${a.date || ''} ${a.startTime || ''}`).localeCompare(
      String(`${b.date || ''} ${b.startTime || ''}`)
    )
  );
  const idx = sorted.findIndex((s) => s.id === targetService.id);
  return idx >= 0 ? idx + 1 : sorted.length;
}

export function getEffectiveServiceEvalScore(ev: ProgramEvaluation): number {
  if (ev.scores6 && typeof ev.scores6.rataRata === 'number' && ev.scores6.rataRata > 0) {
    return ev.scores6.rataRata;
  }
  return Number(ev.nilai) > 0 ? Number(ev.nilai) : 0;
}

export interface ProgramBidangEvalBucket {
  bidang: StandardEvaluationBidang;
  totalServices: number;
  evaluatedCount: number;
  unevaluatedCount: number;
  totalStudentsUnique: number;
  rata6Skor: number;
  avgKeparahan: number | null;
  avgFrekuensi: number | null;
  avgMotivasiAwal: number | null;
  avgDeltaFollowUp: number | null;
  followUpCheckedCount: number;
  persenRtlSelesai: number;
  evaluations: ProgramEvaluation[];
  activityTitles: string[];
}

export interface ProgramFromEvaluationsResult {
  semester: 'Ganjil' | 'Genap';
  tahunAjaran: string;
  classFilter: string;
  syncedAtIso: string;
  syncedAtFormatted: string;
  totalServicesInPeriod: number;
  servicesTerlaksana: number;
  servicesDibatalkan: number;
  servicesTerjadwal: number;
  evaluatedServicesCount: number;
  unevaluatedServicesCount: number;
  totalUniqueStudents: number;
  classesSummary: string;
  rata6SkorGlobal: number;
  rataRataDeltaFollowUp: number | null;
  followUpCheckedCount: number;
  pendingFollowUpCount: number;
  persenTindakLanjutSelesai: number;
  caseSummary: CaseStatusSummary;
  bidangBuckets: Record<StandardEvaluationBidang, ProgramBidangEvalBucket>;
  byJenisMasalah: ProgramProblemMetricItem[];
  byTeknik: ProgramTechniqueMetricItem[];
  matchedEvaluations: ProgramEvaluation[];
  unevaluatedServices: CounselingService[];
  sampleFeedbackSiswa: string[];
  sampleFeedbackWali: string[];
}

/**
 * Pure computation engine for Evaluasi Program BK.
 * STRICT RULE: Evaluation scores, problem groupings, technique averages, baseline/delta,
 * and follow-up % come ONLY from filled Evaluasi Layanan (`serviceEvaluations`).
 * `services` is used ONLY to compute total service count and Sudah Dievaluasi vs Belum Dievaluasi.
 */
export function computeProgramFromServiceEvaluations(params: {
  services: CounselingService[];
  serviceEvaluations: ProgramEvaluation[];
  semester: 'Ganjil' | 'Genap';
  tahunAjaran: string;
  classFilter?: string;
  activeCounselor?: Counselor;
  activeSchoolId?: string;
}): ProgramFromEvaluationsResult {
  const {
    services = [],
    serviceEvaluations = [],
    semester,
    tahunAjaran,
    classFilter = 'Semua',
    activeCounselor,
    activeSchoolId = getActiveSchoolId(),
  } = params;

  const isAllClasses =
    !classFilter || classFilter === 'Semua' || classFilter.toLowerCase().includes('semua');

  // 1. Filter real services for period + class (only for counting Sudah vs Belum Dievaluasi)
  const cleanServices = (Array.isArray(services) ? services : []).filter(
    (s) => s && !isDummyRecord(s, 'bk_services')
  );
  let scopedServices = cleanServices.filter((srv) =>
    serviceBelongsToActiveUser(srv, activeCounselor, activeSchoolId)
  );
  if (scopedServices.length === 0 && cleanServices.length > 0) {
    scopedServices = cleanServices.filter((srv) => {
      const sId = srv?.schoolId ? sanitizeSchoolId(String(srv.schoolId)) : '';
      return !sId || sId === sanitizeSchoolId(activeSchoolId);
    });
  }

  const periodServices = scopedServices.filter((srv) => {
    const { dateObj } = normalizeServiceDate(srv);
    const sem = getSemesterFromDate(dateObj || srv.date);
    const ta = getTahunAjaranFromDate(dateObj || srv.date);
    if (sem !== semester || ta !== tahunAjaran) return false;
    if (!isAllClasses && !serviceMatchesClassFilter(srv, classFilter)) return false;
    return true;
  });

  // 2. Filter Evaluasi Layanan (ONLY source of evaluation metrics!)
  const cleanEvals = (Array.isArray(serviceEvaluations) ? serviceEvaluations : []).filter(
    (ev) =>
      ev &&
      ev.evaluationScope !== 'program' &&
      ev.evaluationScope !== 'kebutuhan-awal' &&
      ev.evaluationScope !== 'rencana-tahunan' &&
      Boolean(ev.serviceId || ev.scores6 || ev.jenisMasalah)
  );
  const periodEvals = cleanEvals.filter((ev) => {
    const evSem = ev.semester || getSemesterFromDate(ev.tanggal);
    const evTa = ev.tahunAjaran || getTahunAjaranFromDate(ev.tanggal);
    if (evSem !== semester || evTa !== tahunAjaran) return false;
    if (!isAllClasses && !evaluationMatchesClassFilter(ev, classFilter)) return false;
    return true;
  });

  const servicesTerlaksana = periodServices.filter((s) => s.status === 'Selesai').length;
  const servicesDibatalkan = periodServices.filter((s) => s.status === 'Dibatalkan').length;
  const servicesTerjadwal = periodServices.filter((s) => s.status === 'Terjadwal').length;

  const evaluatedServiceIdSet = new Set(
    cleanEvals.map((ev) => String(ev.serviceId || '')).filter(Boolean)
  );
  const unevaluatedServices = periodServices.filter((s) => !evaluatedServiceIdSet.has(s.id));
  const matchedServicesCount = periodServices.filter((s) => evaluatedServiceIdSet.has(s.id)).length;
  // Also count period evaluations whose service might not be in periodServices list (e.g. legacy)
  const evaluatedServicesCount = Math.max(matchedServicesCount, periodEvals.length);
  const unevaluatedServicesCount = unevaluatedServices.length;
  const totalServicesInPeriod = Math.max(periodServices.length, evaluatedServicesCount + unevaluatedServicesCount);

  const serviceById = new Map<string, CounselingService>();
  scopedServices.forEach((s) => serviceById.set(s.id, s));

  const createBucket = (bidang: StandardEvaluationBidang): ProgramBidangEvalBucket => ({
    bidang,
    totalServices: 0,
    evaluatedCount: 0,
    unevaluatedCount: 0,
    totalStudentsUnique: 0,
    rata6Skor: 0,
    avgKeparahan: null,
    avgFrekuensi: null,
    avgMotivasiAwal: null,
    avgDeltaFollowUp: null,
    followUpCheckedCount: 0,
    persenRtlSelesai: 0,
    evaluations: [],
    activityTitles: [],
  });

  const bidangBuckets: Record<StandardEvaluationBidang, ProgramBidangEvalBucket> = {
    'Layanan Dasar': createBucket('Layanan Dasar'),
    'Layanan Responsif': createBucket('Layanan Responsif'),
    'Perencanaan Individual': createBucket('Perencanaan Individual'),
    'Dukungan Sistem': createBucket('Dukungan Sistem'),
  };
  const uniqueKeysPerBidang: Record<StandardEvaluationBidang, Set<string>> = {
    'Layanan Dasar': new Set(),
    'Layanan Responsif': new Set(),
    'Perencanaan Individual': new Set(),
    'Dukungan Sistem': new Set(),
  };
  const globalUniqueStudents = new Set<string>();
  const globalClasses = new Set<string>();

  // Count real services per bidang (only for Jumlah Layanan & Belum Dievaluasi count)
  periodServices.forEach((srv) => {
    const bName = mapServiceToEvaluationBidang(srv);
    bidangBuckets[bName].totalServices += 1;
    if (!evaluatedServiceIdSet.has(srv.id)) {
      bidangBuckets[bName].unevaluatedCount += 1;
    }
    const { keys, classes } = extractStudentKeysFromService(srv);
    classes.forEach((c) => globalClasses.add(c));
    if (evaluatedServiceIdSet.has(srv.id)) {
      keys.forEach((k) => {
        uniqueKeysPerBidang[bName].add(k);
        globalUniqueStudents.add(k);
      });
    }
  });

  // Group metrics strictly from Evaluasi Layanan (`periodEvals`)
  const problemGroups = new Map<
    string,
    {
      evals: ProgramEvaluation[];
      scores: number[];
      baselines: number[];
      deltas: number[];
      completed: number;
      teknikCounts: Map<string, number>;
    }
  >();

  const teknikGroups = new Map<
    string,
    { scores: number[]; completed: number; count: number }
  >();

  const globalScores: number[] = [];
  const globalDeltas: number[] = [];
  let completedFollowUpCount = 0;
  let followUpCheckedCount = 0;
  const caseSummary: CaseStatusSummary = {
    totalKasus: periodEvals.length,
    tuntas: 0,
    masihBerproses: 0,
    dirujuk: 0,
    tidakTertangani: 0,
  };

  periodEvals.forEach((ev) => {
    const finalCaseSt = resolveServiceCaseFinalStatus(ev);
    if (finalCaseSt === 'Tuntas') caseSummary.tuntas += 1;
    else if (finalCaseSt === 'Dirujuk ke Psikolog / Pihak Luar') caseSummary.dirujuk += 1;
    else if (finalCaseSt === 'Tidak Tertangani') caseSummary.tidakTertangani += 1;
    else caseSummary.masihBerproses += 1;
    const bName = normalizeBidangTab(ev.bidang);
    const bucket = bidangBuckets[bName];
    bucket.evaluatedCount += 1;
    bucket.evaluations.push(ev);
    if (ev.namaProgram) bucket.activityTitles.push(ev.namaProgram);

    const linkedSrv = ev.serviceId ? serviceById.get(ev.serviceId) : undefined;
    if (linkedSrv) {
      const { keys, classes } = extractStudentKeysFromService(linkedSrv);
      keys.forEach((k) => {
        uniqueKeysPerBidang[bName].add(k);
        globalUniqueStudents.add(k);
      });
      classes.forEach((c) => globalClasses.add(c));
    } else if (ev.kelas) {
      ev.kelas
        .split(/[,;/]+/)
        .map((t) => normalizeClassToken(t))
        .filter(Boolean)
        .forEach((c) => globalClasses.add(c));
    }

    const scoreVal = getEffectiveServiceEvalScore(ev);
    if (scoreVal > 0) globalScores.push(scoreVal);

    const isDone = isServiceEvalFollowUpCompleted(ev);
    if (isDone) completedFollowUpCount += 1;

    const baseVal = ev.baseline
      ? ev.baseline.skorKondisiAwal ?? computeBaselineKondisiAwal(ev.baseline)
      : 3;

    let deltaVal: number | null = null;
    if (ev.followUpCheck && typeof ev.followUpCheck.delta === 'number') {
      deltaVal = ev.followUpCheck.delta;
      globalDeltas.push(deltaVal);
      followUpCheckedCount += 1;
    }

    const problemKey = String(ev.jenisMasalah || 'Lainnya').trim() || 'Lainnya';
    const rawTeknikKey = String(ev.teknikDipakai || ev.jenisLayanan || 'Konseling Individual').trim();
    const teknikKey = rawTeknikKey === 'Kelompok' ? 'Konseling Kelompok' : rawTeknikKey;

    if (!problemGroups.has(problemKey)) {
      problemGroups.set(problemKey, {
        evals: [],
        scores: [],
        baselines: [],
        deltas: [],
        completed: 0,
        teknikCounts: new Map(),
      });
    }
    const pg = problemGroups.get(problemKey)!;
    pg.evals.push(ev);
    if (scoreVal > 0) pg.scores.push(scoreVal);
    pg.baselines.push(baseVal);
    if (deltaVal !== null) pg.deltas.push(deltaVal);
    if (isDone) pg.completed += 1;
    pg.teknikCounts.set(teknikKey, (pg.teknikCounts.get(teknikKey) || 0) + 1);

    if (!teknikGroups.has(teknikKey)) {
      teknikGroups.set(teknikKey, { scores: [], completed: 0, count: 0 });
    }
    const tg = teknikGroups.get(teknikKey)!;
    tg.count += 1;
    if (scoreVal > 0) tg.scores.push(scoreVal);
    if (isDone) tg.completed += 1;
  });

  STANDARD_EVALUATION_BIDANG.forEach((bName) => {
    const bucket = bidangBuckets[bName];
    bucket.totalStudentsUnique = uniqueKeysPerBidang[bName].size;
    const sc = bucket.evaluations
      .map((ev) => getEffectiveServiceEvalScore(ev))
      .filter((v) => v > 0);
    bucket.rata6Skor =
      sc.length > 0 ? Number((sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(2)) : 0;

    const kVals = bucket.evaluations
      .map((ev) => ev.baseline?.keparahan)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const fVals = bucket.evaluations
      .map((ev) => ev.baseline?.frekuensi)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const mVals = bucket.evaluations
      .map((ev) => ev.baseline?.motivasiAwal)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const dVals = bucket.evaluations
      .map((ev) => ev.followUpCheck?.delta)
      .filter((v): v is number => typeof v === 'number');
    const doneCnt = bucket.evaluations.filter((ev) => isServiceEvalFollowUpCompleted(ev)).length;

    bucket.avgKeparahan =
      kVals.length > 0 ? Number((kVals.reduce((a, b) => a + b, 0) / kVals.length).toFixed(2)) : null;
    bucket.avgFrekuensi =
      fVals.length > 0 ? Number((fVals.reduce((a, b) => a + b, 0) / fVals.length).toFixed(2)) : null;
    bucket.avgMotivasiAwal =
      mVals.length > 0 ? Number((mVals.reduce((a, b) => a + b, 0) / mVals.length).toFixed(2)) : null;
    bucket.avgDeltaFollowUp =
      dVals.length > 0 ? Number((dVals.reduce((a, b) => a + b, 0) / dVals.length).toFixed(2)) : null;
    bucket.followUpCheckedCount = dVals.length;
    bucket.persenRtlSelesai =
      bucket.evaluations.length > 0 ? Math.round((doneCnt / bucket.evaluations.length) * 100) : 0;
  });

  const sampleFeedbackSiswa = Array.from(
    new Set(
      periodEvals
        .map((ev) => String(ev.feedbackSiswaKomentar || '').trim())
        .filter((txt) => !isUncollectedPlaceholderText(txt))
    )
  ).slice(0, 5);
  const sampleFeedbackWali = Array.from(
    new Set(
      periodEvals
        .map((ev) => String(ev.feedbackWaliKomentar || '').trim())
        .filter((txt) => !isUncollectedPlaceholderText(txt))
    )
  ).slice(0, 5);

  const byJenisMasalah: ProgramProblemMetricItem[] = Array.from(problemGroups.entries())
    .map(([jenisMasalah, g]) => {
      const avgS =
        g.scores.length > 0
          ? Number((g.scores.reduce((a, b) => a + b, 0) / g.scores.length).toFixed(2))
          : 0;
      const avgB =
        g.baselines.length > 0
          ? Number((g.baselines.reduce((a, b) => a + b, 0) / g.baselines.length).toFixed(2))
          : 0;
      const avgD =
        g.deltas.length > 0
          ? Number((g.deltas.reduce((a, b) => a + b, 0) / g.deltas.length).toFixed(2))
          : null;
      const topTeknik = Array.from(g.teknikCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
      return {
        jenisMasalah,
        totalEvaluasi: g.evals.length,
        rataRataSkor: avgS,
        rataRataBaseline: avgB,
        rataRataDelta: avgD,
        persenSelesai: g.evals.length > 0 ? Math.round((g.completed / g.evals.length) * 100) : 0,
        teknikDominan: topTeknik,
      };
    })
    .sort((a, b) => b.totalEvaluasi - a.totalEvaluasi);

  const byTeknik: ProgramTechniqueMetricItem[] = Array.from(teknikGroups.entries())
    .map(([teknik, g]) => ({
      teknik,
      totalEvaluasi: g.count,
      rataRataSkor:
        g.scores.length > 0
          ? Number((g.scores.reduce((a, b) => a + b, 0) / g.scores.length).toFixed(2))
          : 0,
      persenSelesai: g.count > 0 ? Math.round((g.completed / g.count) * 100) : 0,
    }))
    .sort((a, b) => b.totalEvaluasi - a.totalEvaluasi);

  const now = new Date();
  return {
    semester,
    tahunAjaran,
    classFilter,
    syncedAtIso: now.toISOString(),
    syncedAtFormatted: formatTanggalWaktuIndonesia(now),
    totalServicesInPeriod,
    servicesTerlaksana,
    servicesDibatalkan,
    servicesTerjadwal,
    evaluatedServicesCount,
    unevaluatedServicesCount,
    totalUniqueStudents: globalUniqueStudents.size,
    classesSummary:
      globalClasses.size > 0 ? Array.from(globalClasses).sort().join(', ') : 'Semua Kelas',
    rata6SkorGlobal:
      globalScores.length > 0
        ? Number((globalScores.reduce((a, b) => a + b, 0) / globalScores.length).toFixed(2))
        : 0,
    rataRataDeltaFollowUp:
      globalDeltas.length > 0
        ? Number((globalDeltas.reduce((a, b) => a + b, 0) / globalDeltas.length).toFixed(2))
        : null,
    followUpCheckedCount,
    pendingFollowUpCount: Math.max(0, periodEvals.length - followUpCheckedCount),
    persenTindakLanjutSelesai:
      periodEvals.length > 0 ? Math.round((completedFollowUpCount / periodEvals.length) * 100) : 0,
    caseSummary,
    bidangBuckets,
    byJenisMasalah,
    byTeknik,
    matchedEvaluations: periodEvals,
    unevaluatedServices,
    sampleFeedbackSiswa,
    sampleFeedbackWali,
  };
}

export interface Step2ProgramAiDrafts {
  bidangDrafts: Record<
    StandardEvaluationBidang,
    { kondisiAwal: string; kondisiSetelah: string }
  >;
  stakeholderDraft: {
    suaraSiswa: string;
    suaraWaliKelas: string;
    suaraKepsekOrtu: string;
  };
  refleksiDraft: {
    teknikBerhasil: string;
    teknikGagalDiubah: string;
    kendalaTerbesar: string;
    kendalaPenjelas: string;
  };
  rencanaPerbaikanDraft: {
    lanjutkan: string;
    hentikan: string;
    ubah: string;
    butuhDukungan: string;
  };
}

export function buildKendalaTailoredSupport(kendalaTerbesar: string, dirujukCount = 0): string {
  const suffix = dirujukCount > 0 ? ' serta fasilitasi rujukan profesional siswa.' : '.';
  switch (kendalaTerbesar) {
    case 'Banyak Layanan Belum Dievaluasi':
      return `Butuh dukungan kepala sekolah terkait penjadwalan waktu administrasi BK agar evaluasi layanan selesai tepat waktu${suffix}`;
    case 'Jadwal Bentrok':
      return `Butuh dukungan kepala sekolah dan guru mapel agar jadwal pemanggilan BK tidak bentrok jam pelajaran${suffix}`;
    case 'Ruang Konseling':
      return `Butuh dukungan kepala sekolah untuk menyediakan ruang konseling yang lebih privat dan tenang${suffix}`;
    case 'Dukungan Wali Kelas':
      return `Butuh dukungan wali kelas untuk membantu deteksi dini dan pemantauan perilaku siswa di kelas${suffix}`;
    case 'Beban Mengajar':
      return `Butuh dukungan kepala sekolah untuk penataan jam layanan BK agar tidak tergerus beban tugas lain${suffix}`;
    case 'Waktu':
      return `Butuh dukungan kepala sekolah untuk alokasi jam khusus konseling dan follow-up siswa${suffix}`;
    default:
      return `Butuh dukungan kepala sekolah dan wali kelas agar jadwal layanan dan tindak lanjut berjalan lancar${suffix}`;
  }
}

export function buildKendalaPenjelasDraft(
  kendalaTerbesar: string,
  unevaluatedCount: number,
  cancelledCount: number
): string {
  switch (kendalaTerbesar) {
    case 'Banyak Layanan Belum Dievaluasi':
      return `Kendala terbesar adalah ${unevaluatedCount} layanan belum dievaluasi.`;
    case 'Jadwal Bentrok':
      return cancelledCount > 0
        ? `Terdapat ${cancelledCount} layanan batal karena jadwal pemanggilan bentrok dengan jam pelajaran.`
        : 'Jadwal pemanggilan konseling sering bentrok dengan jam pelajaran siswa.';
    case 'Ruang Konseling':
      return 'Ruang konseling yang tersedia belum cukup privat untuk sesi konseling mendalam.';
    case 'Dukungan Wali Kelas':
      return 'Koordinasi tindak lanjut bersama wali kelas perlu diperkuat agar pemantauan harian berjalan.';
    case 'Beban Mengajar':
      return 'Beban tugas tambahan membatasi waktu layanan konseling dan evaluasi tepat waktu.';
    case 'Waktu':
      return 'Waktu yang tersedia belum cukup untuk menyelesaikan seluruh layanan dan cek follow-up 14 hari.';
    default:
      return 'Masih terdapat hambatan teknis pelaksanaan serta pelaporan tindak lanjut layanan BK.';
  }
}

export function buildLocalStep2Drafts(params: {
  syncResult: ProgramFromEvaluationsResult;
  kebutuhanAwal?: { kebutuhanUtama?: string[]; caraMenentukan?: string } | null;
  rencanaTahunan?: RencanaTahunanData | null;
}): Step2ProgramAiDrafts {
  const { syncResult, kebutuhanAwal, rencanaTahunan } = params;
  const formatScore = (val: number | null) =>
    val === null ? '-' : Number.isInteger(val) ? String(val) : val.toFixed(2).replace(/\.00$/, '');

  const getTargetSemesterForBidang = (bName: StandardEvaluationBidang): number | null => {
    if (!rencanaTahunan) return null;
    const annual =
      bName === 'Layanan Dasar'
        ? rencanaTahunan.targetLayananDasar
        : bName === 'Layanan Responsif'
          ? rencanaTahunan.targetLayananResponsif
          : bName === 'Perencanaan Individual'
            ? rencanaTahunan.targetPerencanaanIndividual
            : rencanaTahunan.targetDukunganSistem;
    return annual > 0 ? Math.max(1, Math.round(annual / 2)) : null;
  };

  const bidangDrafts = {} as Step2ProgramAiDrafts['bidangDrafts'];
  STANDARD_EVALUATION_BIDANG.forEach((bName) => {
    const b = syncResult.bidangBuckets[bName];
    const targetSem = getTargetSemesterForBidang(bName);
    const pctTarget =
      targetSem && targetSem > 0 ? Math.round((b.totalServices / targetSem) * 100) : null;

    if (!b || b.evaluatedCount === 0) {
      bidangDrafts[bName] = {
        kondisiAwal:
          targetSem !== null
            ? `Target semester Rencana Tahunan ${targetSem} sesi (realisasi berjalan ${b.totalServices} sesi / ${pctTarget ?? 0}%), namun belum ada Evaluasi Layanan terisi.`
            : 'Belum ada data untuk bidang ini.',
        kondisiSetelah: 'Belum ada data untuk bidang ini.',
      };
      return;
    }

    const kepTxt = b.avgKeparahan !== null ? `Keparahan ${formatScore(b.avgKeparahan)}` : '';
    const frekTxt = b.avgFrekuensi !== null ? `Frekuensi ${formatScore(b.avgFrekuensi)}` : '';
    const metricPair = [kepTxt, frekTxt].filter(Boolean).join(', ');
    const beratLabel =
      b.avgKeparahan !== null
        ? b.avgKeparahan >= 3.5
          ? 'Kondisi awal tergolong berat.'
          : b.avgKeparahan >= 2.5
            ? 'Kondisi awal tergolong sedang.'
            : 'Kondisi awal tergolong ringan.'
        : 'Data baseline awal masih terbatas.';

    const targetClause =
      targetSem !== null
        ? ` Target semester ${targetSem} sesi (realisasi ${b.totalServices} / ${pctTarget}%).`
        : '';

    const kondisiAwal = metricPair
      ? `Dari ${b.evaluatedCount} layanan yang dievaluasi, baseline awal menunjukkan ${metricPair}. ${beratLabel}${targetClause}`
      : `Dari ${b.evaluatedCount} layanan yang dievaluasi, catatan baseline awal belum lengkap.${targetClause}`;

    const followUpTxt =
      b.followUpCheckedCount === 0
        ? 'Perubahan belum bisa disimpulkan karena follow-up 14 hari belum ada.'
        : b.avgDeltaFollowUp !== null
          ? `Follow-up 14 hari mencatat delta ${b.avgDeltaFollowUp >= 0 ? '+' : ''}${b.avgDeltaFollowUp.toFixed(2)} (${b.persenRtlSelesai}% RTL selesai).`
          : `Ketuntasan tindak lanjut mencapai ${b.persenRtlSelesai}%.`;

    const kondisiSetelah = `Setelah program, rata-rata ${b.rata6Skor.toFixed(2)} / 5 dari ${b.evaluatedCount} layanan. ${followUpTxt}`;
    bidangDrafts[bName] = { kondisiAwal, kondisiSetelah };
  });

  const stakeholderDraft = {
    suaraSiswa:
      syncResult.sampleFeedbackSiswa.length > 0
        ? syncResult.sampleFeedbackSiswa[0]
        : UNCOLLECTED_PLACEHOLDER,
    suaraWaliKelas:
      syncResult.sampleFeedbackWali.length > 0
        ? syncResult.sampleFeedbackWali[0]
        : UNCOLLECTED_PLACEHOLDER,
    suaraKepsekOrtu: UNCOLLECTED_PLACEHOLDER,
  };

  const sortedTeknik = [...syncResult.byTeknik].sort((a, b) => b.rataRataSkor - a.rataRataSkor);
  const topTeknik = sortedTeknik[0];
  const teknikBerhasil = topTeknik
    ? `Teknik ${topTeknik.teknik} terlihat paling berhasil (${topTeknik.rataRataSkor} / 5 dari ${topTeknik.totalEvaluasi} sesi), karena...`
    : EMPTY_BLOCK_PLACEHOLDER;

  const isInsufficientTeknikFail =
    syncResult.evaluatedServicesCount < 3 || sortedTeknik.length <= 1;
  const worstTeknik = sortedTeknik[sortedTeknik.length - 1];
  const teknikGagalDiubah =
    syncResult.evaluatedServicesCount === 0
      ? EMPTY_BLOCK_PLACEHOLDER
      : isInsufficientTeknikFail
        ? `Belum ada cukup data untuk menentukan teknik yang gagal, karena baru ${syncResult.evaluatedServicesCount} dari ${syncResult.totalServicesInPeriod} layanan yang dievaluasi.`
        : worstTeknik && worstTeknik.rataRataSkor < 3.5
          ? `Teknik ${worstTeknik.teknik} mencatat skor terendah (${worstTeknik.rataRataSkor} / 5 dari ${worstTeknik.totalEvaluasi} sesi) sehingga perlu disesuaikan pendekatannya.`
          : `Belum ada teknik yang gagal secara menonjol dari ${syncResult.evaluatedServicesCount} layanan, namun variasi metode tetap perlu diuji.`;

  let recommendedKendala = 'Waktu';
  if (
    syncResult.unevaluatedServicesCount > 0 &&
    syncResult.unevaluatedServicesCount >= syncResult.evaluatedServicesCount
  ) {
    recommendedKendala = 'Banyak Layanan Belum Dievaluasi';
  } else if (syncResult.servicesDibatalkan > 0) {
    recommendedKendala = 'Jadwal Bentrok';
  } else if (syncResult.unevaluatedServicesCount > 0) {
    recommendedKendala = 'Banyak Layanan Belum Dievaluasi';
  }

  const kendalaPenjelas = buildKendalaPenjelasDraft(
    recommendedKendala,
    syncResult.unevaluatedServicesCount,
    syncResult.servicesDibatalkan
  );

  const topProblem = syncResult.byJenisMasalah[0];
  const needList = Array.isArray(kebutuhanAwal?.kebutuhanUtama)
    ? kebutuhanAwal!.kebutuhanUtama.filter(Boolean)
    : [];
  const needMatched =
    needList.length === 0 || !topProblem
      ? true
      : needList.some((n) => topProblem.jenisMasalah.toLowerCase().includes(n.toLowerCase()));

  const lanjutkan = topTeknik
    ? `Lanjutkan teknik ${topTeknik.teknik} yang meraih rata-rata ${topTeknik.rataRataSkor} / 5 dari ${topTeknik.totalEvaluasi} sesi.`
    : 'Belum ada layanan yang dievaluasi untuk menentukan praktik terbaik yang dilanjutkan.';

  const hentikan =
    syncResult.evaluatedServicesCount < 3
      ? 'Belum ada cukup data untuk memutuskan apa yang dihentikan.'
      : worstTeknik && worstTeknik.rataRataSkor < 3.0
        ? `Hentikan pola ${worstTeknik.teknik} tanpa tindak lanjut jelas (skor ${worstTeknik.rataRataSkor} / 5 dari ${worstTeknik.totalEvaluasi} sesi).`
        : !needMatched && needList.length > 0 && topProblem
          ? `Kurangi layanan reaktif berlebih di luar kebutuhan awal (${needList.join(' & ')}) agar program tetap terarah.`
          : 'Belum ada teknik yang harus dihentikan penuh, cukup perbaiki pengisian evaluasi agar tidak tertunda.';

  const ubahParts: string[] = [];
  if (syncResult.unevaluatedServicesCount > 0) {
    ubahParts.push(
      `Ubah kebiasaan menunda evaluasi dengan mengisi form evaluasi langsung setelah layanan (${syncResult.unevaluatedServicesCount} layanan belum dinilai).`
    );
  }
  if (syncResult.pendingFollowUpCount > 0 && ubahParts.length === 0) {
    ubahParts.push(
      `Jadwalkan pengingat rutin untuk menuntaskan ${syncResult.pendingFollowUpCount} cek follow-up 14 hari yang belum diisi.`
    );
  }
  if (!needMatched && needList.length > 0) {
    ubahParts.push(
      `Arahkan jadwal bimbingan klasikal lebih awal agar sesuai kebutuhan awal siswa (${needList.join(' & ')}).`
    );
  }
  if (ubahParts.length === 0) {
    ubahParts.push('Atur jadwal pemanggilan siswa dan evaluasi layanan agar konsisten tepat waktu.');
  }

  const rencanaPerbaikanDraft = {
    lanjutkan,
    hentikan,
    ubah: ubahParts.slice(0, 2).join(' '),
    butuhDukungan: buildKendalaTailoredSupport(recommendedKendala, syncResult.caseSummary.dirujuk),
  };

  return {
    bidangDrafts,
    stakeholderDraft,
    refleksiDraft: {
      teknikBerhasil,
      teknikGagalDiubah,
      kendalaTerbesar: recommendedKendala,
      kendalaPenjelas,
    },
    rencanaPerbaikanDraft,
  };
}

/**
 * Syncs Evaluasi Layanan (`service_evaluations`) + real service counts from Firestore & local cache,
 * then aggregates Program BK strictly from filled Evaluasi Layanan.
 */
export async function syncProgramFromServiceEvaluations(params: {
  semester: 'Ganjil' | 'Genap';
  tahunAjaran: string;
  classFilter?: string;
  activeCounselor?: Counselor;
  fallbackServices?: CounselingService[];
  fallbackServiceEvaluations?: ProgramEvaluation[];
}): Promise<ProgramFromEvaluationsResult> {
  const activeSchoolId = getActiveSchoolId();

  const srvMap = new Map<string, CounselingService>();
  const evalMap = new Map<string, ProgramEvaluation>();

  const ingestSrv = (s: any) => {
    if (s && s.id && !isDummyRecord(s, 'bk_services')) srvMap.set(String(s.id), s);
  };
  const ingestEval = (e: any) => {
    if (
      e &&
      e.id &&
      e.evaluationScope !== 'program' &&
      e.evaluationScope !== 'kebutuhan-awal' &&
      e.evaluationScope !== 'rencana-tahunan'
    ) {
      evalMap.set(String(e.id), e);
    }
  };

  (params.fallbackServices || []).forEach(ingestSrv);
  (params.fallbackServiceEvaluations || []).forEach(ingestEval);

  try {
    const localSrvs = loadSchoolData<any[]>('bk_services', [], activeSchoolId);
    if (Array.isArray(localSrvs)) localSrvs.forEach(ingestSrv);
    const localEvals = loadSchoolData<any[]>('bk_service_evaluations', [], activeSchoolId);
    if (Array.isArray(localEvals)) localEvals.forEach(ingestEval);
  } catch {}

  try {
    const [srvSub, srvRoot, evalSub, evalRoot] = await Promise.allSettled([
      getDocs(collection(db, 'schools', activeSchoolId, 'services')),
      getDocs(collection(db, 'services')),
      getDocs(collection(db, 'schools', activeSchoolId, 'service_evaluations')),
      getDocs(collection(db, 'service_evaluations')),
    ]);

    if (srvSub.status === 'fulfilled') srvSub.value.forEach((d) => ingestSrv({ id: d.id, ...d.data() }));
    if (srvRoot.status === 'fulfilled') {
      srvRoot.value.forEach((d) => {
        if (!srvMap.has(d.id)) ingestSrv({ id: d.id, ...d.data() });
      });
    }
    if (evalSub.status === 'fulfilled') evalSub.value.forEach((d) => ingestEval({ id: d.id, ...d.data() }));
    if (evalRoot.status === 'fulfilled') {
      evalRoot.value.forEach((d) => {
        if (!evalMap.has(d.id)) ingestEval({ id: d.id, ...d.data() });
      });
    }
  } catch (err) {
    console.warn('[syncProgramFromServiceEvaluations] Firestore read fallback to local:', err);
  }

  return computeProgramFromServiceEvaluations({
    services: Array.from(srvMap.values()),
    serviceEvaluations: Array.from(evalMap.values()),
    semester: params.semester,
    tahunAjaran: params.tahunAjaran,
    classFilter: params.classFilter || 'Semua',
    activeCounselor: params.activeCounselor,
    activeSchoolId,
  });
}
