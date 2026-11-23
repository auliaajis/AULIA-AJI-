import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import {
  getActiveSchoolId,
  getSchoolConfig,
  saveSchoolConfig,
  sanitizeSchoolId,
  SchoolConfig,
} from './schoolConfig';
import {
  db,
  ensureFirebaseAuth,
  pushCollectionToFirestore,
  registerSchoolToCloud,
  forceFullCloudSync,
  flushPendingCloudQueue,
  markCloudSyncCompleted,
  deduplicateCollectionItems,
  sortCollectionData,
  getCanonicalRootCollections,
  getSchoolDocRef,
  syncSettingsToPengaturan,
  getCloudCollectionData,
  setCloudCollectionData,
  SYNC_MAP,
} from './firestoreSync';
import { getDeletedIds, unregisterDeletedId } from './deletionTracker';
import { isDummyRecord } from './purgeDummyData';
import { drawLetterhead, finalizeAndSavePdf, getActiveCounselorSigner } from './pdfGenerator';
import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import {
  Student,
  ViolationRecord,
  CounselingService,
  ActivityLog,
  Counselor,
  StudentAchievement,
  HomeVisitRecord,
  ProgramEvaluation,
} from '../types';

export const APP_BACKUP_VERSION = '3.5.0';

export interface LiveAppDataInput {
  students?: Student[];
  violations?: ViolationRecord[];
  services?: CounselingService[];
  logs?: ActivityLog[];
  achievements?: StudentAchievement[];
  homeVisits?: HomeVisitRecord[];
  programEvaluations?: ProgramEvaluation[];
  serviceEvaluations?: ProgramEvaluation[];
  allCounselors?: Counselor[];
}

export interface BackupCollections {
  students: any[];
  violations: any[];
  services: any[];
  homeVisits: any[];
  parentSummons: any[];
  dailyJournals: any[];
  attendanceHistory: any[];
  achievements: any[];
  suratPerjanjianList: any[];
  kontrakPerilakuList: any[];
  jurnalPembinaanDisiplinList: any[];
  komitmenRtlList: any[];
  teachingSchedule: any[];
  classTeachingProgress: any[];
  stickyNotes: any[];
  programEvaluations: any[];
  serviceEvaluations: any[];
  activityLogs: any[];
  counselors: any[];
}

export interface BackupSettingsPayload {
  schoolConfig: SchoolConfig;
  walikelasConfig: any;
  violationRules: any;
  parentSummonTemplates: any;
  akpdClassSessions: any;
  autoJournalSettings: any;
  siBecikFabEnabled: boolean | null;
}

export interface FullBackupPayload {
  app: string;
  appVersion: string;
  format: 'bk-gridasus-full-backup-v1';
  backupDate: string;
  backupDateLabel: string;
  schoolId: string;
  schoolName: string;
  exportedBy: string;
  counts: BackupCounts;
  collections: BackupCollections;
  settings: BackupSettingsPayload;
}

export interface BackupCounts {
  students: number;
  violations: number;
  services: number;
  homeVisits: number;
  parentSummons: number;
  dailyJournals: number;
  teachingSchedule: number;
  attendanceHistory: number;
  achievements: number;
  pembinaanTotal: number;
  evaluationsTotal: number;
  activityLogs: number;
  counselors: number;
  stickyNotes: number;
  agendaTotal: number;
  totalRecords: number;
}

export interface BackupDownloadResult {
  fileName: string;
  sizeBytes: number;
  sizeLabel: string;
  counts: BackupCounts;
  summaryText: string;
  payload: FullBackupPayload;
}

export interface BackupPreviewResult {
  valid: boolean;
  error?: string;
  appName: string;
  appVersion: string;
  backupDate: string;
  backupDateLabel: string;
  schoolId: string;
  schoolName: string;
  exportedBy: string;
  counts: BackupCounts;
  hasSettings: boolean;
  payload?: FullBackupPayload;
}

export interface RestoreExecutionResult {
  success: boolean;
  mode: 'merge' | 'replace';
  restoredCounts: BackupCounts;
  cloudSynced: boolean;
  cloudError?: string;
  summaryText: string;
}

export interface CloudSyncExecutionResult {
  success: boolean;
  uploadedTotal: number;
  perCollection: Record<string, number>;
  syncedAtLabel: string;
  error?: string;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function buildTimestampSlug(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}-${hh}${mm}`;
}

function normalizeArrayItems(raw: any, localKey: string, deletedSet: Set<string>, schoolId: string): any[] {
  if (!Array.isArray(raw)) return [];
  const filtered = raw.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    if (item.isDeleted === true) return false;
    const idStr = item.id !== undefined && item.id !== null ? String(item.id).trim() : '';
    if (idStr && deletedSet.has(idStr)) return false;
    if (isDummyRecord(item, localKey)) return false;
    return true;
  });
  return deduplicateCollectionItems(localKey, filtered, schoolId);
}

function mergeArraySources(localKey: string, schoolId: string, deletedSet: Set<string>, ...sources: any[]): any[] {
  const map = new Map<string, any>();
  const noIdItems: any[] = [];

  for (const src of sources) {
    if (!Array.isArray(src)) continue;
    for (const item of src) {
      if (!item || typeof item !== 'object') continue;
      if (item.isDeleted === true) continue;
      if (isDummyRecord(item, localKey)) continue;
      const idStr = item.id !== undefined && item.id !== null ? String(item.id).trim() : '';
      if (idStr) {
        if (deletedSet.has(idStr)) continue;
        const prev = map.get(idStr);
        map.set(idStr, prev ? { ...prev, ...item } : item);
      } else {
        noIdItems.push(item);
      }
    }
  }

  const combined = [...Array.from(map.values()), ...noIdItems];
  return sortCollectionData(localKey, combined, schoolId);
}

export function computeCounts(collections: BackupCollections): BackupCounts {
  const students = collections.students.length;
  const violations = collections.violations.length;
  const services = collections.services.length;
  const homeVisits = collections.homeVisits.length;
  const parentSummons = collections.parentSummons.length;
  const dailyJournals = collections.dailyJournals.length;
  const teachingSchedule = collections.teachingSchedule.length;
  const attendanceHistory = collections.attendanceHistory.length;
  const achievements = collections.achievements.length;
  const pembinaanTotal =
    collections.suratPerjanjianList.length +
    collections.kontrakPerilakuList.length +
    collections.jurnalPembinaanDisiplinList.length +
    collections.komitmenRtlList.length;
  const evaluationsTotal = collections.programEvaluations.length + collections.serviceEvaluations.length;
  const activityLogs = collections.activityLogs.length;
  const counselors = collections.counselors.length;
  const stickyNotes = collections.stickyNotes.length;
  const agendaTotal = dailyJournals + teachingSchedule + stickyNotes;
  const totalRecords =
    students +
    violations +
    services +
    homeVisits +
    parentSummons +
    dailyJournals +
    teachingSchedule +
    attendanceHistory +
    achievements +
    pembinaanTotal +
    evaluationsTotal +
    activityLogs +
    counselors +
    stickyNotes;

  return {
    students,
    violations,
    services,
    homeVisits,
    parentSummons,
    dailyJournals,
    teachingSchedule,
    attendanceHistory,
    achievements,
    pembinaanTotal,
    evaluationsTotal,
    activityLogs,
    counselors,
    stickyNotes,
    agendaTotal,
    totalRecords,
  };
}

export function collectFullBackupSnapshot(
  activeCounselor?: Counselor | null,
  liveState?: LiveAppDataInput
): FullBackupPayload {
  const schoolId = sanitizeSchoolId(activeCounselor?.schoolId || getActiveSchoolId());
  const schoolConfig = getSchoolConfig(schoolId);
  const deletedSet = new Set(getDeletedIds());

  const cloudStudents = getCloudCollectionData<any>('bk_students', schoolId);
  const cloudViolations = getCloudCollectionData<any>('bk_violations', schoolId);
  const cloudServices = getCloudCollectionData<any>('bk_services', schoolId);
  const cloudHomeVisits = getCloudCollectionData<any>('bk_home_visits', schoolId);
  const cloudParentSummons = getCloudCollectionData<any>('bk_parent_summons', schoolId);
  const cloudDailyJournals = getCloudCollectionData<any>('bk_daily_journals', schoolId);
  const cloudAttendance = getCloudCollectionData<any>('bk_attendance_history', schoolId);
  const cloudAchievements = mergeArraySources(
    'bk_achievements',
    schoolId,
    deletedSet,
    getCloudCollectionData<any>('bk_achievements', schoolId),
    getCloudCollectionData<any>('bk_student_achievements', schoolId),
    liveState?.achievements || []
  );
  const cloudSuratPerjanjian = getCloudCollectionData<any>('bk_surat_perjanjian_list', schoolId);
  const cloudKontrakPerilaku = getCloudCollectionData<any>('bk_kontrak_perilaku_list', schoolId);
  const cloudJurnalPembinaan = getCloudCollectionData<any>('bk_jurnal_pembinaan_disiplin_list', schoolId);
  const cloudKomitmenRtl = getCloudCollectionData<any>('bk_komitmen_rtl_list', schoolId);
  const cloudTeachingSchedule = getCloudCollectionData<any>('bk_teaching_schedule', schoolId);
  const cloudClassProgress = getCloudCollectionData<any>('bk_class_teaching_progress', schoolId);
  const cloudStickyNotes = getCloudCollectionData<any>('bk_sticky_notes', schoolId);
  const cloudProgEval = getCloudCollectionData<any>('bk_program_evaluations', schoolId);
  const cloudSrvEval = getCloudCollectionData<any>('bk_service_evaluations', schoolId);
  const cloudLogs = getCloudCollectionData<any>('bk_logs', schoolId);
  const cloudCounselors = getCloudCollectionData<any>('bk_counselors', schoolId);

  const collections: BackupCollections = {
    students: mergeArraySources('bk_students', schoolId, deletedSet, cloudStudents, liveState?.students || []),
    violations: mergeArraySources('bk_violations', schoolId, deletedSet, cloudViolations, liveState?.violations || []),
    services: mergeArraySources('bk_services', schoolId, deletedSet, cloudServices, liveState?.services || []),
    homeVisits: mergeArraySources('bk_home_visits', schoolId, deletedSet, cloudHomeVisits, liveState?.homeVisits || []),
    parentSummons: mergeArraySources('bk_parent_summons', schoolId, deletedSet, cloudParentSummons),
    dailyJournals: mergeArraySources('bk_daily_journals', schoolId, deletedSet, cloudDailyJournals),
    attendanceHistory: mergeArraySources('bk_attendance_history', schoolId, deletedSet, cloudAttendance),
    achievements: cloudAchievements,
    suratPerjanjianList: mergeArraySources('bk_surat_perjanjian_list', schoolId, deletedSet, cloudSuratPerjanjian),
    kontrakPerilakuList: mergeArraySources('bk_kontrak_perilaku_list', schoolId, deletedSet, cloudKontrakPerilaku),
    jurnalPembinaanDisiplinList: mergeArraySources('bk_jurnal_pembinaan_disiplin_list', schoolId, deletedSet, cloudJurnalPembinaan),
    komitmenRtlList: mergeArraySources('bk_komitmen_rtl_list', schoolId, deletedSet, cloudKomitmenRtl),
    teachingSchedule: cloudTeachingSchedule,
    classTeachingProgress: cloudClassProgress,
    stickyNotes: mergeArraySources('bk_sticky_notes', schoolId, deletedSet, cloudStickyNotes),
    programEvaluations: mergeArraySources('bk_program_evaluations', schoolId, deletedSet, cloudProgEval, liveState?.programEvaluations || []),
    serviceEvaluations: mergeArraySources('bk_service_evaluations', schoolId, deletedSet, cloudSrvEval, liveState?.serviceEvaluations || []),
    activityLogs: mergeArraySources('bk_logs', schoolId, deletedSet, cloudLogs, liveState?.logs || []),
    counselors: mergeArraySources('bk_counselors', schoolId, deletedSet, cloudCounselors, liveState?.allCounselors || []),
  };

  let siBecikFabEnabled: boolean | null = null;
  if (typeof localStorage !== 'undefined') {
    const fabRaw = localStorage.getItem('bk_si_becik_fab_enabled');
    if (fabRaw !== null) siBecikFabEnabled = fabRaw === 'true';
  }

  const settings: BackupSettingsPayload = {
    schoolConfig,
    walikelasConfig: getCloudCollectionData<any>('bk_walikelas_config', schoolId),
    violationRules: getCloudCollectionData<any>('bk_violation_rules', schoolId),
    parentSummonTemplates: getCloudCollectionData<any>('bk_parent_summon_templates', schoolId),
    akpdClassSessions: getCloudCollectionData<any>('bk_akpd_class_sessions', schoolId),
    autoJournalSettings: null,
    siBecikFabEnabled,
  };

  const now = new Date();
  const counts = computeCounts(collections);

  return {
    app: 'BK GRIDASUS - Sistem Administrasi & Layanan BK',
    appVersion: APP_BACKUP_VERSION,
    format: 'bk-gridasus-full-backup-v1',
    backupDate: now.toISOString(),
    backupDateLabel: now.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    schoolId,
    schoolName: schoolConfig.schoolName || activeCounselor?.schoolName || 'SMP N 2 Susukan',
    exportedBy: activeCounselor?.name || schoolConfig.koordinatorBkName || 'Koordinator BK',
    counts,
    collections,
    settings,
  };
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function buildBackupSummaryText(counts: BackupCounts, prefix = 'Berhasil backup'): string {
  return `${prefix} ${counts.students} siswa, ${counts.violations} pelanggaran, ${counts.services} layanan BK, ${counts.homeVisits} home visit, ${counts.agendaTotal} agenda/jurnal, ${counts.pembinaanTotal} catatan pembinaan, & ${counts.attendanceHistory} sesi absensi.`;
}

export function downloadFullBackupJSON(
  activeCounselor?: Counselor | null,
  liveState?: LiveAppDataInput
): BackupDownloadResult {
  const payload = collectFullBackupSnapshot(activeCounselor, liveState);
  const fileName = `backup-bk-gridasus-${buildTimestampSlug()}.json`;
  const jsonText = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const sizeBytes = blob.size;
  const sizeLabel = formatFileSize(sizeBytes);

  triggerBrowserDownload(blob, fileName);

  return {
    fileName,
    sizeBytes,
    sizeLabel,
    counts: payload.counts,
    summaryText: buildBackupSummaryText(payload.counts, 'Berhasil backup'),
    payload,
  };
}

function escapeCsvCell(val: any): string {
  const str = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadStudentsCSV(studentsInput?: Student[], activeCounselor?: Counselor | null): { fileName: string; count: number; sizeLabel: string } {
  const schoolId = sanitizeSchoolId(activeCounselor?.schoolId || getActiveSchoolId());
  const deletedSet = new Set(getDeletedIds());
  const list = studentsInput && studentsInput.length > 0
    ? normalizeArrayItems(studentsInput, 'bk_students', deletedSet, schoolId)
    : normalizeArrayItems(getCloudCollectionData<any>('bk_students', schoolId), 'bk_students', deletedSet, schoolId);

  const headers = ['ID', 'NIS', 'NISN', 'Nama Siswa', 'Kelas', 'Jenis Kelamin', 'Poin Pelanggaran', 'Poin Prestasi', 'Jumlah Layanan', 'No HP Orang Tua', 'Alamat'];
  const rows = list.map((s: any) => [
    s.id || '',
    s.nis || '',
    s.nisn || '',
    s.name || '',
    s.class || '',
    s.gender || '',
    s.violationPoints ?? 0,
    s.achievementPoints ?? 0,
    s.bkServicesCount ?? 0,
    s.parentPhone || '',
    s.address || '',
  ].map(escapeCsvCell).join(','));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const fileName = `backup-siswa-bk-gridasus-${buildTimestampSlug()}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  triggerBrowserDownload(blob, fileName);

  return { fileName, count: list.length, sizeLabel: formatFileSize(blob.size) };
}

export function downloadViolationsCSV(violationsInput?: ViolationRecord[], activeCounselor?: Counselor | null): { fileName: string; count: number; sizeLabel: string } {
  const schoolId = sanitizeSchoolId(activeCounselor?.schoolId || getActiveSchoolId());
  const deletedSet = new Set(getDeletedIds());
  const list = violationsInput && violationsInput.length > 0
    ? normalizeArrayItems(violationsInput, 'bk_violations', deletedSet, schoolId)
    : normalizeArrayItems(getCloudCollectionData<any>('bk_violations', schoolId), 'bk_violations', deletedSet, schoolId);

  const headers = ['ID', 'Tanggal', 'Jam', 'Nama Siswa', 'Kelas', 'Jenis Pelanggaran', 'Kategori', 'Poin', 'Status', 'Kronologi / Deskripsi', 'Tindak Lanjut / Restitusi', 'Dicatat Oleh'];
  const rows = list.map((v: any) => [
    v.id || '',
    v.date || '',
    v.time || '',
    v.studentName || '',
    v.studentClass || '',
    v.violationType || '',
    v.category || '',
    v.points ?? 0,
    v.status || '',
    v.description || '',
    v.restitutionAction || v.followUp || '',
    v.reportedBy || '',
  ].map(escapeCsvCell).join(','));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const fileName = `backup-pelanggaran-bk-gridasus-${buildTimestampSlug()}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  triggerBrowserDownload(blob, fileName);

  return { fileName, count: list.length, sizeLabel: formatFileSize(blob.size) };
}

export function exportAllToExcel(
  activeCounselor?: Counselor | null,
  liveState?: LiveAppDataInput
): { fileName: string; counts: BackupCounts } {
  const payload = collectFullBackupSnapshot(activeCounselor, liveState);
  const c = payload.collections;
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    { Keterangan: 'Aplikasi', Nilai: payload.app },
    { Keterangan: 'Versi', Nilai: payload.appVersion },
    { Keterangan: 'Sekolah', Nilai: payload.schoolName },
    { Keterangan: 'ID Sekolah', Nilai: payload.schoolId },
    { Keterangan: 'Tanggal Export', Nilai: payload.backupDateLabel },
    { Keterangan: 'Diekspor Oleh', Nilai: payload.exportedBy },
    { Keterangan: 'Total Data Siswa', Nilai: payload.counts.students },
    { Keterangan: 'Total Catatan Pelanggaran / Kasus', Nilai: payload.counts.violations },
    { Keterangan: 'Total Layanan BK', Nilai: payload.counts.services },
    { Keterangan: 'Total Home Visit', Nilai: payload.counts.homeVisits },
    { Keterangan: 'Total Surat Panggilan Ortu', Nilai: payload.counts.parentSummons },
    { Keterangan: 'Total Jurnal & Agenda Mengajar', Nilai: payload.counts.agendaTotal },
    { Keterangan: 'Total Catatan Pembinaan Disiplin', Nilai: payload.counts.pembinaanTotal },
    { Keterangan: 'Total Rekam Absensi Kelas', Nilai: payload.counts.attendanceHistory },
    { Keterangan: 'Total Apresiasi / Prestasi', Nilai: payload.counts.achievements },
    { Keterangan: 'Total Evaluasi Layanan & Program', Nilai: payload.counts.evaluationsTotal },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Ringkasan');

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      c.students.length > 0
        ? c.students.map((s: any, idx: number) => ({
            No: idx + 1,
            ID: s.id || '',
            NIS: s.nis || '',
            NISN: s.nisn || '',
            Nama: s.name || '',
            Kelas: s.class || '',
            Gender: s.gender || '',
            PoinPelanggaran: s.violationPoints ?? 0,
            PoinPrestasi: s.achievementPoints ?? 0,
            TotalLayanan: s.bkServicesCount ?? 0,
            HpOrtu: s.parentPhone || '',
            Alamat: s.address || '',
          }))
        : [{ Keterangan: 'Belum ada data siswa' }]
    ),
    'Data Siswa'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      c.violations.length > 0
        ? c.violations.map((v: any, idx: number) => ({
            No: idx + 1,
            ID: v.id || '',
            Tanggal: v.date || '',
            Jam: v.time || '',
            Siswa: v.studentName || '',
            Kelas: v.studentClass || '',
            Pelanggaran: v.violationType || '',
            Kategori: v.category || '',
            Poin: v.points ?? 0,
            Status: v.status || '',
            Deskripsi: v.description || '',
            Restitusi: v.restitutionAction || '',
          }))
        : [{ Keterangan: 'Belum ada catatan pelanggaran' }]
    ),
    'Pelanggaran'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      c.services.length > 0
        ? c.services.map((srv: any, idx: number) => ({
            No: idx + 1,
            ID: srv.id || '',
            Tanggal: srv.date || '',
            JenisLayanan: srv.serviceType || '',
            PilarBK: srv.bkComponent || '',
            Bidang: srv.bidangBimbingan || '',
            Peserta: Array.isArray(srv.students) ? srv.students.map((st: any) => `${st.name} (${st.class})`).join('; ') : '',
            TopikMasalah: srv.problem || '',
            Deskripsi: srv.description || '',
            TindakLanjut: srv.followUp || '',
            Status: srv.status || '',
          }))
        : [{ Keterangan: 'Belum ada data layanan BK' }]
    ),
    'Layanan BK'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      c.homeVisits.length > 0
        ? c.homeVisits.map((hv: any, idx: number) => ({
            No: idx + 1,
            ID: hv.id || '',
            Tanggal: hv.visitDate || hv.date || '',
            Siswa: hv.studentName || '',
            Kelas: hv.studentClass || '',
            Alamat: hv.address || '',
            Tujuan: hv.purpose || '',
            HasilKunjungan: hv.findings || hv.notes || '',
            Status: hv.status || '',
          }))
        : [{ Keterangan: 'Belum ada data home visit' }]
    ),
    'Home Visit'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      c.dailyJournals.length > 0 || c.teachingSchedule.length > 0
        ? [
            ...c.dailyJournals.map((j: any) => ({
              Tipe: 'Jurnal Harian',
              Tanggal_Hari: j.date || '',
              Waktu: `${j.startTime || ''}-${j.endTime || ''}`,
              Kelas: j.targetClass || j.studentClass || '',
              Kegiatan_Materi: j.activityTitle || j.topic || j.description || '',
              Catatan: j.result || j.followUp || '',
            })),
            ...c.teachingSchedule.map((t: any) => ({
              Tipe: 'Jadwal Mengajar',
              Tanggal_Hari: t.day || '',
              Waktu: t.timeRange || t.period || '',
              Kelas: t.className || '',
              Kegiatan_Materi: t.subject || '',
              Catatan: '',
            })),
          ]
        : [{ Keterangan: 'Belum ada data jurnal atau jadwal mengajar' }]
    ),
    'Agenda & Jurnal'
  );

  const pembinaanRows = [
    ...c.suratPerjanjianList.map((p: any) => ({ Jenis: 'Surat Perjanjian', Tanggal: p.date || '', Siswa: p.studentName || '', Kelas: p.studentClass || '', Ringkasan: p.agreementSummary || p.violationDetail || '' })),
    ...c.kontrakPerilakuList.map((p: any) => ({ Jenis: 'Kontrak Perilaku', Tanggal: p.date || '', Siswa: p.studentName || '', Kelas: p.studentClass || '', Ringkasan: p.targetBehavior || p.goal || '' })),
    ...c.jurnalPembinaanDisiplinList.map((p: any) => ({ Jenis: 'Jurnal Pembinaan Disiplin', Tanggal: p.date || '', Siswa: p.studentName || '', Kelas: p.studentClass || '', Ringkasan: p.coachingNotes || p.actionTaken || '' })),
    ...c.komitmenRtlList.map((p: any) => ({ Jenis: 'Komitmen RTL', Tanggal: p.date || '', Siswa: p.studentName || '', Kelas: p.studentClass || '', Ringkasan: p.commitment || p.nextSteps || '' })),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(pembinaanRows.length > 0 ? pembinaanRows : [{ Keterangan: 'Belum ada catatan pembinaan' }]),
    'Pembinaan'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      c.attendanceHistory.length > 0
        ? c.attendanceHistory.map((a: any, idx: number) => ({
            No: idx + 1,
            Tanggal: a.date || '',
            Kelas: a.className || '',
            TotalSiswa: Array.isArray(a.records) ? a.records.length : a.totalStudents ?? 0,
            Hadir: Array.isArray(a.records) ? a.records.filter((r: any) => r.status === 'Hadir').length : a.presentCount ?? 0,
            Sakit: Array.isArray(a.records) ? a.records.filter((r: any) => r.status === 'Sakit').length : a.sickCount ?? 0,
            Izin: Array.isArray(a.records) ? a.records.filter((r: any) => r.status === 'Izin').length : a.permissionCount ?? 0,
            Alpa: Array.isArray(a.records) ? a.records.filter((r: any) => r.status === 'Alpa').length : a.absentCount ?? 0,
          }))
        : [{ Keterangan: 'Belum ada data absensi' }]
    ),
    'Absensi'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      c.parentSummons.length > 0
        ? c.parentSummons.map((ps: any, idx: number) => ({
            No: idx + 1,
            NomorSurat: ps.letterNumber || '',
            Tanggal: ps.summonDate || ps.date || '',
            Siswa: ps.studentName || '',
            Kelas: ps.studentClass || '',
            Keperluan: ps.reason || ps.subject || '',
            Status: ps.status || '',
          }))
        : [{ Keterangan: 'Belum ada surat panggilan orang tua' }]
    ),
    'Panggilan Ortu'
  );

  const fileName = `backup-lengkap-bk-gridasus-${buildTimestampSlug()}.xlsx`;
  XLSX.writeFile(wb, fileName);

  return { fileName, counts: payload.counts };
}

export function exportAllSummaryPDF(
  activeCounselor?: Counselor | null,
  liveState?: LiveAppDataInput
): { fileName: string; counts: BackupCounts } {
  const payload = collectFullBackupSnapshot(activeCounselor, liveState);
  const signer = getActiveCounselorSigner(activeCounselor);
  const doc = new jsPDF();
  const accentColor = [0, 104, 95]; // #00685f

  drawLetterhead(doc, accentColor);

  let y = 42;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(11, 28, 48);
  doc.text('RINGKASAN BACKUP DATA ADMINISTRASI BK', 105, y, { align: 'center' });

  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(61, 73, 71);
  doc.text(`Dicadangkan pada: ${payload.backupDateLabel} | Versi Aplikasi: ${payload.appVersion}`, 105, y, { align: 'center' });

  y += 10;
  const rows: Array<[string, string]> = [
    ['Sekolah / ID Partisi', `${payload.schoolName} (${payload.schoolId})`],
    ['Guru BK / Koordinator', signer.name],
    ['Data Siswa Aktif', `${payload.counts.students} siswa`],
    ['Arsip Pelanggaran & Restitusi', `${payload.counts.violations} catatan`],
    ['Layanan Bimbingan & Konseling', `${payload.counts.services} sesi layanan`],
    ['Kunjungan Rumah (Home Visit)', `${payload.counts.homeVisits} laporan`],
    ['Surat Panggilan Orang Tua', `${payload.counts.parentSummons} surat`],
    ['Jurnal Harian & Agenda Mengajar', `${payload.counts.dailyJournals} jurnal + ${payload.counts.teachingSchedule} jadwal + ${payload.counts.stickyNotes} catatan`],
    ['Catatan Pembinaan Disiplin', `${payload.counts.pembinaanTotal} dokumen`],
    ['Riwayat Presensi / Absensi', `${payload.counts.attendanceHistory} sesi kelas`],
    ['Apresiasi & Prestasi Siswa', `${payload.counts.achievements} catatan`],
    ['Evaluasi Layanan & Program', `${payload.counts.evaluationsTotal} instrumen`],
    ['Total Keseluruhan Rekam Data', `${payload.counts.totalRecords} item`],
  ];

  doc.setDrawColor(188, 201, 198);
  doc.setFillColor(230, 244, 241);
  doc.rect(15, y, 180, 8, 'FD');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 104, 95);
  doc.text('Komponen Basis Data BK', 18, y + 5.5);
  doc.text('Jumlah Data Tersimpan', 130, y + 5.5);
  y += 8;

  rows.forEach(([label, val], idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 249);
    doc.rect(15, y, 180, 7.5, 'FD');
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(11, 28, 48);
    doc.text(label, 18, y + 5);
    doc.setFont('Helvetica', 'bold');
    doc.text(val, 130, y + 5);
    y += 7.5;
  });

  y += 8;
  if (payload.collections.violations.length > 0 && y < 235) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(11, 28, 48);
    doc.text('5 Catatan Pelanggaran Terbaru:', 15, y);
    y += 5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    payload.collections.violations.slice(0, 5).forEach((v: any, idx: number) => {
      if (y > 265) return;
      const line = `${idx + 1}. [${v.date || '-'}] ${v.studentName || '-'} (${v.studentClass || '-'}) - ${v.violationType || '-'} (+${v.points ?? 0} poin)`;
      doc.text(line.slice(0, 105), 15, y);
      y += 4.5;
    });
  }

  y = Math.max(y + 10, 240);
  if (y > 260) {
    doc.addPage();
    y = 30;
  }
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(11, 28, 48);
  doc.text(`Susukan, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 132, y);
  doc.text('Koordinator / Guru BK,', 132, y + 5);
  doc.setFont('Helvetica', 'bold');
  doc.text(signer.name, 132, y + 23);
  if (signer.nip && signer.nip !== '-') {
    doc.setFont('Helvetica', 'normal');
    doc.text(signer.nip, 132, y + 28);
  }

  const fileName = `ringkasan-backup-bk-gridasus-${buildTimestampSlug()}.pdf`;
  finalizeAndSavePdf(doc, fileName, {
    category: 'rekap',
    successToastMessage: `Ringkasan PDF berhasil diunduh (${fileName})`,
  });

  return { fileName, counts: payload.counts };
}

export function parseBackupFilePreview(rawJsonText: string): BackupPreviewResult {
  try {
    const parsed = JSON.parse(rawJsonText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        valid: false,
        error: 'Format file JSON tidak valid. Pastikan file merupakan hasil ekspor Backup & Restore BK GRIDASUS.',
        appName: '-',
        appVersion: '-',
        backupDate: '',
        backupDateLabel: '-',
        schoolId: '',
        schoolName: '-',
        exportedBy: '-',
        counts: computeCounts({
          students: [], violations: [], services: [], homeVisits: [], parentSummons: [],
          dailyJournals: [], attendanceHistory: [], achievements: [], suratPerjanjianList: [],
          kontrakPerilakuList: [], jurnalPembinaanDisiplinList: [], komitmenRtlList: [],
          teachingSchedule: [], classTeachingProgress: [], stickyNotes: [],
          programEvaluations: [], serviceEvaluations: [], activityLogs: [], counselors: [],
        }),
        hasSettings: false,
      };
    }

    // Support both structured `collections` and legacy flat root keys
    const src = (parsed.collections && typeof parsed.collections === 'object')
      ? parsed.collections
      : (parsed.data && typeof parsed.data === 'object')
        ? parsed.data
        : parsed;

    const toArr = (v: any) => (Array.isArray(v) ? v : []);
    const schoolId = sanitizeSchoolId(String(parsed.schoolId || parsed.settings?.schoolConfig?.schoolId || getActiveSchoolId()));
    const deletedSet = new Set<string>();

    const collections: BackupCollections = {
      students: normalizeArrayItems(toArr(src.students || src.bk_students), 'bk_students', deletedSet, schoolId),
      violations: normalizeArrayItems(toArr(src.violations || src.bk_violations || src.cases), 'bk_violations', deletedSet, schoolId),
      services: normalizeArrayItems(toArr(src.services || src.bk_services || src.counseling), 'bk_services', deletedSet, schoolId),
      homeVisits: normalizeArrayItems(toArr(src.homeVisits || src.bk_home_visits), 'bk_home_visits', deletedSet, schoolId),
      parentSummons: normalizeArrayItems(toArr(src.parentSummons || src.bk_parent_summons), 'bk_parent_summons', deletedSet, schoolId),
      dailyJournals: normalizeArrayItems(toArr(src.dailyJournals || src.bk_daily_journals), 'bk_daily_journals', deletedSet, schoolId),
      attendanceHistory: normalizeArrayItems(toArr(src.attendanceHistory || src.bk_attendance_history), 'bk_attendance_history', deletedSet, schoolId),
      achievements: normalizeArrayItems(toArr(src.achievements || src.bk_achievements), 'bk_achievements', deletedSet, schoolId),
      suratPerjanjianList: normalizeArrayItems(toArr(src.suratPerjanjianList || src.bk_surat_perjanjian_list), 'bk_surat_perjanjian_list', deletedSet, schoolId),
      kontrakPerilakuList: normalizeArrayItems(toArr(src.kontrakPerilakuList || src.bk_kontrak_perilaku_list), 'bk_kontrak_perilaku_list', deletedSet, schoolId),
      jurnalPembinaanDisiplinList: normalizeArrayItems(toArr(src.jurnalPembinaanDisiplinList || src.bk_jurnal_pembinaan_disiplin_list), 'bk_jurnal_pembinaan_disiplin_list', deletedSet, schoolId),
      komitmenRtlList: normalizeArrayItems(toArr(src.komitmenRtlList || src.bk_komitmen_rtl_list), 'bk_komitmen_rtl_list', deletedSet, schoolId),
      teachingSchedule: toArr(src.teachingSchedule || src.bk_teaching_schedule),
      classTeachingProgress: toArr(src.classTeachingProgress || src.bk_class_teaching_progress),
      stickyNotes: normalizeArrayItems(toArr(src.stickyNotes || src.bk_sticky_notes), 'bk_sticky_notes', deletedSet, schoolId),
      programEvaluations: normalizeArrayItems(toArr(src.programEvaluations || src.bk_program_evaluations), 'bk_program_evaluations', deletedSet, schoolId),
      serviceEvaluations: normalizeArrayItems(toArr(src.serviceEvaluations || src.bk_service_evaluations), 'bk_service_evaluations', deletedSet, schoolId),
      activityLogs: normalizeArrayItems(toArr(src.activityLogs || src.bk_logs), 'bk_logs', deletedSet, schoolId),
      counselors: normalizeArrayItems(toArr(src.counselors || src.bk_counselors), 'bk_counselors', deletedSet, schoolId),
    };

    const counts = computeCounts(collections);
    const hasSettings = Boolean(parsed.settings && typeof parsed.settings === 'object');

    if (counts.totalRecords === 0 && !hasSettings && !parsed.format) {
      return {
        valid: false,
        error: 'File JSON tidak mengandung koleksi data BK yang dikenali atau isinya kosong.',
        appName: '-',
        appVersion: '-',
        backupDate: '',
        backupDateLabel: '-',
        schoolId: '',
        schoolName: '-',
        exportedBy: '-',
        counts,
        hasSettings: false,
      };
    }

    const rawDate = parsed.backupDate || parsed.exportedAt || '';
    let dateLabel = parsed.backupDateLabel || '';
    if (!dateLabel && rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        dateLabel = d.toLocaleString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }

    const currentSchoolCfg = getSchoolConfig(schoolId);
    const settingsObj: BackupSettingsPayload = {
      schoolConfig: parsed.settings?.schoolConfig || currentSchoolCfg,
      walikelasConfig: parsed.settings?.walikelasConfig ?? [],
      violationRules: parsed.settings?.violationRules ?? [],
      parentSummonTemplates: parsed.settings?.parentSummonTemplates ?? [],
      akpdClassSessions: parsed.settings?.akpdClassSessions ?? [],
      autoJournalSettings: parsed.settings?.autoJournalSettings ?? null,
      siBecikFabEnabled:
        typeof parsed.settings?.siBecikFabEnabled === 'boolean' ? parsed.settings.siBecikFabEnabled : null,
    };

    const payload: FullBackupPayload = {
      app: String(parsed.app || 'BK GRIDASUS'),
      appVersion: String(parsed.appVersion || parsed.version || '1.0.0'),
      format: 'bk-gridasus-full-backup-v1',
      backupDate: String(rawDate || new Date().toISOString()),
      backupDateLabel: dateLabel || 'Tanggal tidak tercantum',
      schoolId,
      schoolName: String(parsed.schoolName || settingsObj.schoolConfig?.schoolName || 'SMP N 2 Susukan'),
      exportedBy: String(parsed.exportedBy || 'Guru BK'),
      counts,
      collections,
      settings: settingsObj,
    };

    return {
      valid: true,
      appName: payload.app,
      appVersion: payload.appVersion,
      backupDate: payload.backupDate,
      backupDateLabel: payload.backupDateLabel,
      schoolId: payload.schoolId,
      schoolName: payload.schoolName,
      exportedBy: payload.exportedBy,
      counts,
      hasSettings,
      payload,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Gagal membaca file JSON: ${err?.message || 'Struktur file rusak'}`,
      appName: '-',
      appVersion: '-',
      backupDate: '',
      backupDateLabel: '-',
      schoolId: '',
      schoolName: '-',
      exportedBy: '-',
      counts: computeCounts({
        students: [], violations: [], services: [], homeVisits: [], parentSummons: [],
        dailyJournals: [], attendanceHistory: [], achievements: [], suratPerjanjianList: [],
        kontrakPerilakuList: [], jurnalPembinaanDisiplinList: [], komitmenRtlList: [],
        teachingSchedule: [], classTeachingProgress: [], stickyNotes: [],
        programEvaluations: [], serviceEvaluations: [], activityLogs: [], counselors: [],
      }),
      hasSettings: false,
    };
  }
}

export async function restoreBackupData(
  payload: FullBackupPayload,
  mode: 'merge' | 'replace',
  activeCounselor?: Counselor | null
): Promise<RestoreExecutionResult> {
  const schoolId = sanitizeSchoolId(activeCounselor?.schoolId || getActiveSchoolId());
  const schoolConfig = getSchoolConfig(schoolId);
  const schoolName = schoolConfig.schoolName || activeCounselor?.schoolName || 'SMP N 2 Susukan';
  const c = payload.collections;

  const stampItems = (arr: any[]) =>
    arr.map((it) => {
      if (!it || typeof it !== 'object') return it;
      const itemId = String(it.id || `rst_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      unregisterDeletedId(itemId);
      const cleaned = { ...it };
      delete cleaned.isLegacyUnmigrated;
      return {
        ...cleaned,
        id: itemId,
        isDeleted: false,
        schoolId,
        sekolahId: schoolId,
        schoolName: cleaned.schoolName || schoolName,
        namaSekolah: cleaned.namaSekolah || schoolName,
      };
    });

  const collectionKeyPairs: Array<{ localKey: string; backupList: any[] }> = [
    { localKey: 'bk_students', backupList: c.students },
    { localKey: 'bk_violations', backupList: c.violations },
    { localKey: 'bk_services', backupList: c.services },
    { localKey: 'bk_home_visits', backupList: c.homeVisits },
    { localKey: 'bk_parent_summons', backupList: c.parentSummons },
    { localKey: 'bk_daily_journals', backupList: c.dailyJournals },
    { localKey: 'bk_attendance_history', backupList: c.attendanceHistory },
    { localKey: 'bk_achievements', backupList: c.achievements },
    { localKey: 'bk_surat_perjanjian_list', backupList: c.suratPerjanjianList },
    { localKey: 'bk_kontrak_perilaku_list', backupList: c.kontrakPerilakuList },
    { localKey: 'bk_jurnal_pembinaan_disiplin_list', backupList: c.jurnalPembinaanDisiplinList },
    { localKey: 'bk_komitmen_rtl_list', backupList: c.komitmenRtlList },
    { localKey: 'bk_sticky_notes', backupList: c.stickyNotes },
    { localKey: 'bk_program_evaluations', backupList: c.programEvaluations },
    { localKey: 'bk_service_evaluations', backupList: c.serviceEvaluations },
    { localKey: 'bk_logs', backupList: c.activityLogs },
    { localKey: 'bk_counselors', backupList: c.counselors },
  ];

  const finalCollectionsMap: Record<string, any[]> = {};

  if (mode === 'replace') {
    for (const pair of collectionKeyPairs) {
      const stamped = sortCollectionData(pair.localKey, stampItems(pair.backupList), schoolId);
      finalCollectionsMap[pair.localKey] = stamped;
      setCloudCollectionData(pair.localKey, stamped, schoolId);
    }
  } else {
    // Merge mode: preserve existing active Firestore records, add missing IDs from backup
    for (const pair of collectionKeyPairs) {
      const existing = getCloudCollectionData<any>(pair.localKey, schoolId);
      const map = new Map<string, any>();
      if (Array.isArray(existing)) {
        existing.forEach((item) => {
          if (item && item.id && item.isDeleted !== true) {
            map.set(String(item.id), item);
          }
        });
      }
      stampItems(pair.backupList).forEach((item) => {
        if (!item || !item.id) return;
        const rid = String(item.id);
        if (!map.has(rid)) {
          map.set(rid, item);
        }
      });
      const merged = sortCollectionData(pair.localKey, Array.from(map.values()), schoolId);
      finalCollectionsMap[pair.localKey] = merged;
      setCloudCollectionData(pair.localKey, merged, schoolId);
    }
  }

  // Restore teaching schedule & class progress into Firestore cloud cache
  const restoreTeachingGrouped = (
    items: any[],
    defaultKey: 'bk_teaching_schedule' | 'bk_class_teaching_progress'
  ) => {
    if (!Array.isArray(items)) return;
    const cleanedItems = items
      .filter((raw) => raw && typeof raw === 'object')
      .map((raw) => {
        const copy = { ...raw };
        delete copy._storageKeyTag;
        const id = String(copy.id || copy.className || `${copy.day || ''}_${copy.className || ''}_${copy.period || ''}`);
        return { ...copy, id, schoolId, schoolName };
      });

    if (mode === 'replace') {
      finalCollectionsMap[defaultKey] = cleanedItems;
      setCloudCollectionData(defaultKey, cleanedItems, schoolId);
      return;
    }

    const existing = getCloudCollectionData<any>(defaultKey, schoolId);
    const map = new Map<string, any>();
    if (Array.isArray(existing)) {
      existing.forEach((it) => {
        const key = String(it?.id || it?.className || '');
        if (key) map.set(key, it);
      });
    }
    cleanedItems.forEach((it) => {
      const key = String(it.id || it.className || '');
      if (key && !map.has(key)) {
        map.set(key, it);
      }
    });
    const merged = Array.from(map.values());
    finalCollectionsMap[defaultKey] = merged;
    setCloudCollectionData(defaultKey, merged, schoolId);
  };

  restoreTeachingGrouped(c.teachingSchedule, 'bk_teaching_schedule');
  restoreTeachingGrouped(c.classTeachingProgress, 'bk_class_teaching_progress');

  // Restore settings
  const s = payload.settings;
  if (s) {
    if (s.schoolConfig && (mode === 'replace' || !localStorage.getItem('bk_school_config'))) {
      saveSchoolConfig({ ...s.schoolConfig, schoolId });
    }
    const restoreSimpleSetting = (key: string, val: any) => {
      if (val === null || val === undefined) return;
      const arrVal = Array.isArray(val) ? val : Object.values(val || {});
      if (arrVal.length === 0 && mode === 'merge') return;
      if (mode === 'replace') {
        setCloudCollectionData(key, arrVal, schoolId);
        finalCollectionsMap[key] = arrVal;
      } else {
        const curr = getCloudCollectionData<any>(key, schoolId);
        if (!Array.isArray(curr) || curr.length === 0) {
          setCloudCollectionData(key, arrVal, schoolId);
          finalCollectionsMap[key] = arrVal;
        }
      }
    };

    restoreSimpleSetting('bk_walikelas_config', s.walikelasConfig);
    restoreSimpleSetting('bk_violation_rules', s.violationRules);
    restoreSimpleSetting('bk_parent_summon_templates', s.parentSummonTemplates);
    restoreSimpleSetting('bk_akpd_class_sessions', s.akpdClassSessions);
    restoreSimpleSetting('bk_auto_journal_settings', s.autoJournalSettings);
    if (typeof s.siBecikFabEnabled === 'boolean' && typeof localStorage !== 'undefined') {
      localStorage.setItem('bk_si_becik_fab_enabled', String(s.siBecikFabEnabled));
    }
  }

  // Push restored data to Firebase Firestore
  let cloudSynced = false;
  let cloudError: string | undefined;
  try {
    await ensureFirebaseAuth();
    if (s?.schoolConfig) {
      await registerSchoolToCloud({ ...s.schoolConfig, schoolId }, schoolId);
    }

    const pushResults = await Promise.all(
      Object.entries(finalCollectionsMap).map(async ([localKey, list]) => {
        const isWipe = mode === 'replace' && Array.isArray(list) && list.length === 0;
        return pushCollectionToFirestore(localKey, list, schoolId, isWipe, {
          stampMissingSchoolId: true,
          bypassCache: true,
        });
      })
    );

    const anyFailed = pushResults.find((r) => !r.success);
    if (anyFailed) {
      cloudError = anyFailed.error || 'Sebagian koleksi gagal disinkronkan ke Cloud.';
    } else {
      cloudSynced = true;
      markCloudSyncCompleted(schoolId);
    }
  } catch (err: any) {
    cloudError = err?.message || String(err);
  }

  // Dispatch realtime update events to all React views
  if (typeof window !== 'undefined') {
    Object.entries(finalCollectionsMap).forEach(([key, data]) => {
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { type: 'sync', key, data, schoolId } }));
    });
    window.dispatchEvent(new CustomEvent('bk_attendance_history_changed', { detail: finalCollectionsMap['bk_attendance_history'] || [] }));
    window.dispatchEvent(new Event('bk_violation_rules_changed'));
    window.dispatchEvent(new Event('bk_school_config_updated'));
    window.dispatchEvent(new Event('storage'));
  }

  const restoredCounts = computeCounts({
    students: finalCollectionsMap['bk_students'] || [],
    violations: finalCollectionsMap['bk_violations'] || [],
    services: finalCollectionsMap['bk_services'] || [],
    homeVisits: finalCollectionsMap['bk_home_visits'] || [],
    parentSummons: finalCollectionsMap['bk_parent_summons'] || [],
    dailyJournals: finalCollectionsMap['bk_daily_journals'] || [],
    attendanceHistory: finalCollectionsMap['bk_attendance_history'] || [],
    achievements: finalCollectionsMap['bk_achievements'] || [],
    suratPerjanjianList: finalCollectionsMap['bk_surat_perjanjian_list'] || [],
    kontrakPerilakuList: finalCollectionsMap['bk_kontrak_perilaku_list'] || [],
    jurnalPembinaanDisiplinList: finalCollectionsMap['bk_jurnal_pembinaan_disiplin_list'] || [],
    komitmenRtlList: finalCollectionsMap['bk_komitmen_rtl_list'] || [],
    teachingSchedule: finalCollectionsMap['bk_teaching_schedule'] || [],
    classTeachingProgress: c.classTeachingProgress || [],
    stickyNotes: finalCollectionsMap['bk_sticky_notes'] || [],
    programEvaluations: finalCollectionsMap['bk_program_evaluations'] || [],
    serviceEvaluations: finalCollectionsMap['bk_service_evaluations'] || [],
    activityLogs: finalCollectionsMap['bk_logs'] || [],
    counselors: finalCollectionsMap['bk_counselors'] || [],
  });

  const actionWord = mode === 'replace' ? 'Berhasil memulihkan (Ganti Total)' : 'Berhasil menggabungkan';
  return {
    success: true,
    mode,
    restoredCounts,
    cloudSynced,
    cloudError,
    summaryText: buildBackupSummaryText(restoredCounts, actionWord),
  };
}

export async function syncAllLocalDataToFirestore(
  activeCounselor?: Counselor | null,
  liveState?: LiveAppDataInput
): Promise<CloudSyncExecutionResult> {
  const schoolId = sanitizeSchoolId(activeCounselor?.schoolId || getActiveSchoolId());
  const snapshot = collectFullBackupSnapshot(activeCounselor, liveState);
  const c = snapshot.collections;
  const s = snapshot.settings;

  const perCollection: Record<string, number> = {};
  let uploadedTotal = 0;

  try {
    await ensureFirebaseAuth();
    await registerSchoolToCloud(s.schoolConfig, schoolId);

    // Save school settings doc inside school workspace
    try {
      await setDoc(
        doc(db, 'schools', schoolId, 'settings', 'app_settings'),
        {
          schoolId,
          walikelasConfig: s.walikelasConfig || [],
          violationRules: s.violationRules || [],
          parentSummonTemplates: s.parentSummonTemplates || [],
          akpdClassSessions: s.akpdClassSessions || [],
          autoJournalSettings: s.autoJournalSettings || null,
          siBecikFabEnabled: s.siBecikFabEnabled,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {}

    const uploadTargets: Array<{ localKey: string; items: any[] }> = [
      { localKey: 'bk_students', items: c.students },
      { localKey: 'bk_violations', items: c.violations },
      { localKey: 'bk_services', items: c.services },
      { localKey: 'bk_home_visits', items: c.homeVisits },
      { localKey: 'bk_parent_summons', items: c.parentSummons },
      { localKey: 'bk_daily_journals', items: c.dailyJournals },
      { localKey: 'bk_attendance_history', items: c.attendanceHistory },
      { localKey: 'bk_achievements', items: c.achievements },
      { localKey: 'bk_surat_perjanjian_list', items: c.suratPerjanjianList },
      { localKey: 'bk_kontrak_perilaku_list', items: c.kontrakPerilakuList },
      { localKey: 'bk_jurnal_pembinaan_disiplin_list', items: c.jurnalPembinaanDisiplinList },
      { localKey: 'bk_komitmen_rtl_list', items: c.komitmenRtlList },
      { localKey: 'bk_teaching_schedule', items: c.teachingSchedule },
      { localKey: 'bk_class_teaching_progress', items: c.classTeachingProgress },
      { localKey: 'bk_sticky_notes', items: c.stickyNotes },
      { localKey: 'bk_program_evaluations', items: c.programEvaluations },
      { localKey: 'bk_service_evaluations', items: c.serviceEvaluations },
      { localKey: 'bk_logs', items: c.activityLogs },
      { localKey: 'bk_counselors', items: c.counselors },
    ];

    // Update pure in-memory cloud cache to stay consistent during upload
    for (const target of uploadTargets) {
      if (target.items.length > 0 && target.localKey !== 'bk_class_teaching_progress') {
        const cleanToSave = target.items.map((it) => {
          if (!it || typeof it !== 'object') return it;
          const copy = { ...it };
          delete copy._storageKeyTag;
          delete copy.isLegacyUnmigrated;
          return {
            ...copy,
            schoolId,
            sekolahId: copy.sekolahId || schoolId,
            schoolName: copy.schoolName || snapshot.schoolName,
          };
        });
        setCloudCollectionData(target.localKey, cleanToSave, schoolId);
      }
    }

    const results = await Promise.all(
      uploadTargets.map(async (target) => {
        if (target.items.length === 0) {
          perCollection[target.localKey] = 0;
          return { success: true, count: 0 };
        }
        const cleanItems = target.items.map((it) => {
          const copy = { ...it };
          delete copy._storageKeyTag;
          return copy;
        });
        const res = await pushCollectionToFirestore(target.localKey, cleanItems, schoolId, false, {
          stampMissingSchoolId: true,
          bypassCache: true,
        });
        perCollection[target.localKey] = res.count;
        uploadedTotal += res.count;
        return res;
      })
    );

    const failed = results.find((r) => !r.success);
    await flushPendingCloudQueue();
    await forceFullCloudSync();

    if (failed) {
      return {
        success: false,
        uploadedTotal,
        perCollection,
        syncedAtLabel: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        error: failed.error || 'Gagal mengunggah sebagian data ke Firestore.',
      };
    }

    const syncInfo = markCloudSyncCompleted(schoolId, perCollection);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bk_cloud_status', { detail: { status: 'connected', lastSyncTime: syncInfo.timeLabel } }));
    }

    return {
      success: true,
      uploadedTotal,
      perCollection,
      syncedAtLabel: syncInfo.dateTimeLabel,
    };
  } catch (err: any) {
    return {
      success: false,
      uploadedTotal,
      perCollection,
      syncedAtLabel: '-',
      error: err?.message || String(err),
    };
  }
}

export const LEGACY_MIGRATION_FLAG_PREFIX = 'bk_legacy_firestore_migrated_';

export interface LegacyMigrationResult {
  success: boolean;
  alreadyMigrated: boolean;
  migratedStudents: number;
  migratedViolations: number;
  migratedServices: number;
  migratedOther: number;
  skippedDuplicates: number;
  totalMigrated: number;
  message: string;
  error?: string;
}

export function hasCompletedLegacyFirestoreMigration(schoolIdInput?: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  const sId = sanitizeSchoolId(schoolIdInput || getActiveSchoolId());
  return localStorage.getItem(`${LEGACY_MIGRATION_FLAG_PREFIX}${sId}`) === 'true';
}

function normStr(val: any): string {
  return String(val || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Migrasi satu kali seluruh data lama dari localStorage ke Firebase Firestore.
 * Mengecek duplikat terlebih dahulu berdasarkan id / nis / nama+kelas agar tidak ganda,
 * tidak pernah menimpa Firestore dengan data kosong, dan menandai selesai setelah sukses.
 */
export async function migrateLegacyLocalDataToFirestore(
  activeCounselor?: Counselor | null,
  liveState?: LiveAppDataInput
): Promise<LegacyMigrationResult> {
  const schoolId = sanitizeSchoolId(activeCounselor?.schoolId || getActiveSchoolId());
  const schoolConfig = getSchoolConfig(schoolId);
  const schoolName = schoolConfig.schoolName || activeCounselor?.schoolName || 'SMP N 2 Susukan';
  const snapshot = collectFullBackupSnapshot(activeCounselor, liveState);
  const c = snapshot.collections;
  const s = snapshot.settings;

  try {
    await ensureFirebaseAuth();
    await registerSchoolToCloud(s.schoolConfig, schoolId);

    const targets: Array<{ localKey: string; colName: string; items: any[] }> = [
      { localKey: 'bk_students', colName: SYNC_MAP['bk_students'] || 'students', items: c.students },
      { localKey: 'bk_violations', colName: SYNC_MAP['bk_violations'] || 'violations', items: c.violations },
      { localKey: 'bk_services', colName: SYNC_MAP['bk_services'] || 'services', items: c.services },
      { localKey: 'bk_home_visits', colName: SYNC_MAP['bk_home_visits'] || 'home_visits', items: c.homeVisits },
      { localKey: 'bk_parent_summons', colName: SYNC_MAP['bk_parent_summons'] || 'parent_summons', items: c.parentSummons },
      { localKey: 'bk_daily_journals', colName: SYNC_MAP['bk_daily_journals'] || 'daily_journals', items: c.dailyJournals },
      { localKey: 'bk_attendance_history', colName: SYNC_MAP['bk_attendance_history'] || 'attendance_history', items: c.attendanceHistory },
      { localKey: 'bk_achievements', colName: SYNC_MAP['bk_achievements'] || 'achievements', items: c.achievements },
      { localKey: 'bk_surat_perjanjian_list', colName: SYNC_MAP['bk_surat_perjanjian_list'] || 'surat_perjanjian_list', items: c.suratPerjanjianList },
      { localKey: 'bk_kontrak_perilaku_list', colName: SYNC_MAP['bk_kontrak_perilaku_list'] || 'kontrak_perilaku_list', items: c.kontrakPerilakuList },
      { localKey: 'bk_jurnal_pembinaan_disiplin_list', colName: SYNC_MAP['bk_jurnal_pembinaan_disiplin_list'] || 'jurnal_pembinaan_disiplin_list', items: c.jurnalPembinaanDisiplinList },
      { localKey: 'bk_komitmen_rtl_list', colName: SYNC_MAP['bk_komitmen_rtl_list'] || 'komitmen_rtl_list', items: c.komitmenRtlList },
      { localKey: 'bk_teaching_schedule', colName: SYNC_MAP['bk_teaching_schedule'] || 'teaching_schedule', items: c.teachingSchedule },
      { localKey: 'bk_class_teaching_progress', colName: SYNC_MAP['bk_class_teaching_progress'] || 'class_teaching_progress', items: c.classTeachingProgress },
      { localKey: 'bk_sticky_notes', colName: SYNC_MAP['bk_sticky_notes'] || 'sticky_notes', items: c.stickyNotes },
      { localKey: 'bk_program_evaluations', colName: SYNC_MAP['bk_program_evaluations'] || 'program_evaluations', items: c.programEvaluations },
      { localKey: 'bk_service_evaluations', colName: SYNC_MAP['bk_service_evaluations'] || 'service_evaluations', items: c.serviceEvaluations },
      { localKey: 'bk_logs', colName: SYNC_MAP['bk_logs'] || 'activity_logs', items: c.activityLogs },
      { localKey: 'bk_counselors', colName: SYNC_MAP['bk_counselors'] || 'counselors', items: c.counselors },
    ];

    let migratedStudents = 0;
    let migratedViolations = 0;
    let migratedServices = 0;
    let migratedOther = 0;
    let skippedDuplicates = 0;

    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    for (const target of targets) {
      if (!Array.isArray(target.items) || target.items.length === 0) continue;

      const rootAliases = Array.from(new Set([target.colName, ...getCanonicalRootCollections(target.colName)]));
      const existingIds = new Set<string>();
      const existingNis = new Set<string>();
      const existingNameClass = new Set<string>();
      const existingViolationKeys = new Set<string>();
      const existingServiceKeys = new Set<string>();

      const snapResults = await Promise.allSettled([
        getDocs(collection(db, 'schools', schoolId, target.colName)),
        ...rootAliases.map((rc) => getDocs(collection(db, rc))),
      ]);

      snapResults.forEach((res) => {
        if (res.status !== 'fulfilled') return;
        res.value.forEach((docSnap) => {
          const d = docSnap.data() as any;
          if (!d || d.isDeleted === true) return;
          const rid = String(d.id || docSnap.id || '').trim();
          if (rid) existingIds.add(rid);

          if (target.localKey === 'bk_students') {
            const nis = String(d.nis || '').trim();
            if (nis) existingNis.add(nis);
            const nc = `${normStr(d.name)}::${normStr(d.class)}`;
            if (normStr(d.name)) existingNameClass.add(nc);
          } else if (target.localKey === 'bk_violations') {
            if (d.ticketId) existingIds.add(String(d.ticketId).trim());
            const vk = `${normStr(d.studentName)}::${normStr(d.category || d.violationType)}::${normStr(d.date)}`;
            if (normStr(d.studentName)) existingViolationKeys.add(vk);
          } else if (target.localKey === 'bk_services') {
            const studentNames = Array.isArray(d.students) ? d.students.map((st: any) => normStr(st.name)).sort().join(',') : '';
            const sk = `${normStr(d.date)}::${normStr(d.problem || d.serviceType)}::${studentNames}`;
            if (normStr(d.date)) existingServiceKeys.add(sk);
          }
        });
      });

      const toUpload: any[] = [];
      for (const rawItem of target.items) {
        if (!rawItem || typeof rawItem !== 'object' || rawItem.isDeleted === true) continue;
        if (isDummyRecord(rawItem, target.localKey)) continue;

        const clean = { ...rawItem };
        delete clean._storageKeyTag;
        delete clean.isLegacyUnmigrated;

        const docId = String(clean.id || `mig_${target.colName}_${nowMs}_${Math.random().toString(36).slice(2, 7)}`).trim();
        let isDup = existingIds.has(docId);

        if (!isDup && target.localKey === 'bk_students') {
          const nis = String(clean.nis || '').trim();
          const nc = `${normStr(clean.name)}::${normStr(clean.class)}`;
          if ((nis && existingNis.has(nis)) || (normStr(clean.name) && existingNameClass.has(nc))) {
            isDup = true;
          }
        } else if (!isDup && target.localKey === 'bk_violations') {
          const ticket = clean.ticketId ? String(clean.ticketId).trim() : '';
          const vk = `${normStr(clean.studentName)}::${normStr(clean.category || clean.violationType)}::${normStr(clean.date)}`;
          if ((ticket && existingIds.has(ticket)) || (normStr(clean.studentName) && existingViolationKeys.has(vk))) {
            isDup = true;
          }
        } else if (!isDup && target.localKey === 'bk_services') {
          const studentNames = Array.isArray(clean.students) ? clean.students.map((st: any) => normStr(st.name)).sort().join(',') : '';
          const sk = `${normStr(clean.date)}::${normStr(clean.problem || clean.serviceType)}::${studentNames}`;
          if (normStr(clean.date) && existingServiceKeys.has(sk)) {
            isDup = true;
          }
        }

        if (isDup) {
          skippedDuplicates++;
          continue;
        }

        existingIds.add(docId);
        const payload = {
          ...clean,
          id: docId,
          isDeleted: false,
          schoolId,
          sekolahId: clean.sekolahId || schoolId,
          schoolName: clean.schoolName || schoolName,
          namaSekolah: clean.namaSekolah || clean.schoolName || schoolName,
          createdAt: clean.createdAt || nowIso,
          updatedAt: nowIso,
          _version: Number(clean._version) > 0 ? Number(clean._version) : 1,
          _updatedAt: nowMs,
        };
        toUpload.push(payload);
      }

      if (toUpload.length === 0) continue;

      const opsPerItem = 1 + rootAliases.length;
      const maxItemsPerBatch = Math.max(1, Math.floor(400 / opsPerItem));

      for (let i = 0; i < toUpload.length; i += maxItemsPerBatch) {
        const chunk = toUpload.slice(i, i + maxItemsPerBatch);
        const batch = writeBatch(db);
        for (const docPayload of chunk) {
          batch.set(getSchoolDocRef(target.colName, docPayload.id, schoolId), docPayload, { merge: true });
          rootAliases.forEach((rootCol) => {
            batch.set(doc(db, rootCol, docPayload.id), docPayload, { merge: true });
          });
        }
        await batch.commit();
      }

      if (target.localKey === 'bk_students') migratedStudents += toUpload.length;
      else if (target.localKey === 'bk_violations') migratedViolations += toUpload.length;
      else if (target.localKey === 'bk_services') migratedServices += toUpload.length;
      else migratedOther += toUpload.length;
    }

    // Sinkronkan pengaturan sekolah & konfigurasi ke dokumen pengaturan/{schoolId}
    await syncSettingsToPengaturan(schoolId, {
      schoolConfig: s.schoolConfig,
      walikelasConfig: s.walikelasConfig || [],
      violationRules: s.violationRules || [],
      parentSummonTemplates: s.parentSummonTemplates || [],
      akpdClassSessions: s.akpdClassSessions || [],
      autoJournalSettings: s.autoJournalSettings || null,
      siBecikFabEnabled: s.siBecikFabEnabled,
    });

    await flushPendingCloudQueue();
    await forceFullCloudSync();

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${LEGACY_MIGRATION_FLAG_PREFIX}${schoolId}`, 'true');
    }
    markCloudSyncCompleted(schoolId);

    const totalMigrated = migratedStudents + migratedViolations + migratedServices + migratedOther;
    return {
      success: true,
      alreadyMigrated: false,
      migratedStudents,
      migratedViolations,
      migratedServices,
      migratedOther,
      skippedDuplicates,
      totalMigrated,
      message: `Berhasil migrasi ${migratedStudents} siswa, ${migratedViolations} pelanggaran ke Firestore`,
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    return {
      success: false,
      alreadyMigrated: false,
      migratedStudents: 0,
      migratedViolations: 0,
      migratedServices: 0,
      migratedOther: 0,
      skippedDuplicates: 0,
      totalMigrated: 0,
      message: `Gagal migrasi data lama ke Firestore: ${errMsg}`,
      error: errMsg,
    };
  }
}

function resolveViolationOriginLabel(v: any): { originText: string; reportedViaText: string; isLegacy: boolean } {
  const reportedViaRaw = String(v.reportedVia || '').trim();
  const sourceRaw = String(v.source || '').trim().toLowerCase();
  const reportedByRaw = String(v.reportedBy || '').trim();
  const isPiket =
    reportedViaRaw.toLowerCase().includes('piket') ||
    sourceRaw === 'link_piket' ||
    sourceRaw === 'piket' ||
    reportedByRaw.toLowerCase().includes('piket');

  if (isPiket) {
    return {
      originText: reportedByRaw || 'Guru Piket',
      reportedViaText: reportedViaRaw || 'Link Piket',
      isLegacy: false,
    };
  }
  return {
    originText: reportedByRaw ? `${reportedByRaw} (BK - Data Lama)` : 'BK - Data Lama',
    reportedViaText: reportedViaRaw || 'Input BK Lama',
    isLegacy: true,
  };
}

export function exportArchiveViolationsAndServicesExcel(
  activeCounselor?: Counselor | null,
  liveState?: LiveAppDataInput
): { fileName: string; violationsCount: number; servicesCount: number } {
  const schoolId = sanitizeSchoolId(activeCounselor?.schoolId || getActiveSchoolId());
  const deletedSet = new Set(getDeletedIds());
  const violationsList = mergeArraySources(
    'bk_violations',
    schoolId,
    deletedSet,
    getCloudCollectionData<any>('bk_violations', schoolId),
    liveState?.violations || []
  );
  const servicesList = mergeArraySources(
    'bk_services',
    schoolId,
    deletedSet,
    getCloudCollectionData<any>('bk_services', schoolId),
    liveState?.services || []
  );

  const wb = XLSX.utils.book_new();
  const violRows = violationsList.length > 0
    ? violationsList.map((v: any, idx: number) => {
        const origin = resolveViolationOriginLabel(v);
        return {
          No: idx + 1,
          ID: v.id || '',
          Tiket: v.ticketId || '',
          Tanggal: v.date || '',
          Waktu: v.time || '',
          NamaSiswa: v.studentName || '',
          Kelas: v.studentClass || '',
          NIS: v.nis || '',
          Kategori: v.category || v.violationType || '',
          Poin: v.pointsAdded ?? v.points ?? 0,
          StatusRestitusi: v.restitutionStatus || v.status || 'Baru Dicatat',
          DilaporkanOleh: origin.originText,
          ReportedVia: origin.reportedViaText,
          StatusData: origin.isLegacy ? 'Data Lama' : 'Rujukan Piket Baru',
          MigratedAt: v.migratedAt ?? 'null',
          Catatan: v.notes || v.description || '',
          KesepakatanRestitusi: v.restitutionAgreement || v.handlingProgress || '',
        };
      })
    : [{ Keterangan: 'Belum ada data arsip pelanggaran' }];

  const srvRows = servicesList.length > 0
    ? servicesList.map((s: any, idx: number) => ({
        No: idx + 1,
        ID: s.id || '',
        Tanggal: s.date || '',
        Jam: `${s.startTime || ''}${s.endTime ? ` - ${s.endTime}` : ''}`,
        JenisLayanan: s.serviceType || '',
        PilarBK: s.bkComponent || '',
        Bidang: s.bidangBimbingan || '',
        Siswa: Array.isArray(s.students) ? s.students.map((st: any) => `${st.name} (${st.class})`).join('; ') : '',
        TopikMasalah: s.problem || '',
        Uraian: s.description || '',
        TindakLanjut: s.followUp || '',
        Status: s.status || '',
        Konselor: s.counselorName || '',
      }))
    : [{ Keterangan: 'Belum ada data layanan BK' }];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(violRows), 'Arsip Pelanggaran');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(srvRows), 'Layanan BK');

  const fileName = `arsip-pembinaan-bk-gridasus-${buildTimestampSlug()}.xlsx`;
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBrowserDownload(blob, fileName);

  return {
    fileName,
    violationsCount: violationsList.length,
    servicesCount: servicesList.length,
  };
}

export function exportArchiveViolationsAndServicesCSV(
  activeCounselor?: Counselor | null,
  liveState?: LiveAppDataInput
): { fileName: string; totalRows: number; sizeLabel: string } {
  const schoolId = sanitizeSchoolId(activeCounselor?.schoolId || getActiveSchoolId());
  const deletedSet = new Set(getDeletedIds());
  const violationsList = mergeArraySources(
    'bk_violations',
    schoolId,
    deletedSet,
    getCloudCollectionData<any>('bk_violations', schoolId),
    liveState?.violations || []
  );
  const servicesList = mergeArraySources(
    'bk_services',
    schoolId,
    deletedSet,
    getCloudCollectionData<any>('bk_services', schoolId),
    liveState?.services || []
  );

  const headers = [
    'Tipe Data',
    'ID',
    'Tanggal',
    'Waktu',
    'Nama Siswa',
    'Kelas',
    'Kategori / Jenis Layanan',
    'Poin',
    'Status',
    'Dilaporkan Oleh / Konselor',
    'ReportedVia',
    'Label Data',
    'Catatan / Uraian',
    'Tindak Lanjut / Restitusi',
  ];

  const rows: string[] = [];
  violationsList.forEach((v: any) => {
    const origin = resolveViolationOriginLabel(v);
    rows.push(
      [
        'Pelanggaran / Rujukan',
        v.id || '',
        v.date || '',
        v.time || '',
        v.studentName || '',
        v.studentClass || '',
        v.category || v.violationType || '',
        v.pointsAdded ?? v.points ?? 0,
        v.restitutionStatus || v.status || 'Baru Dicatat',
        origin.originText,
        origin.reportedViaText,
        origin.isLegacy ? 'Data Lama' : 'Rujukan Piket',
        v.notes || v.description || '',
        v.restitutionAgreement || v.handlingProgress || '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  });

  servicesList.forEach((s: any) => {
    const peserta = Array.isArray(s.students)
      ? s.students.map((st: any) => `${st.name} (${st.class})`).join('; ')
      : '';
    const kelas = Array.isArray(s.students)
      ? Array.from(new Set(s.students.map((st: any) => st.class).filter(Boolean))).join('; ')
      : '';
    rows.push(
      [
        'Layanan BK',
        s.id || '',
        s.date || '',
        `${s.startTime || ''}${s.endTime ? `-${s.endTime}` : ''}`,
        peserta,
        kelas,
        s.serviceType || '',
        0,
        s.status || '',
        s.counselorName || '',
        'Layanan BK',
        'Layanan',
        s.problem || s.description || '',
        s.followUp || '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const fileName = `arsip-pembinaan-layanan-bk-${buildTimestampSlug()}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  triggerBrowserDownload(blob, fileName);

  return {
    fileName,
    totalRows: violationsList.length + servicesList.length,
    sizeLabel: formatFileSize(blob.size),
  };
}


