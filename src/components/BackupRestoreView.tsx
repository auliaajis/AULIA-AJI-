import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Cloud,
  CloudOff,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ShieldCheck,
  Database,
  Trash2,
  Users,
  ShieldAlert,
  HeartHandshake,
  CalendarDays,
  BookMarked,
  ClipboardCheck,
  Home,
  X,
  Wrench,
  RotateCcw,
  UserX,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { Counselor, Student, HapusLogEntry } from '../types';
import { showToast } from '../utils/toast';
import { getActiveSchoolId, getSchoolConfig, hasConfiguredSchool, saveSchoolData } from '../utils/schoolConfig';
import {
  getLastCloudSyncInfo,
  CloudSyncRecordInfo,
  clearLocalCacheAndReloadFromCloud,
  saveBulkToFirestore,
  syncPreviewDataToAuliaAccount,
  fetchSoftDeletedRecordsFromFirestore,
  restoreSoftDeletedFromFirestore,
  permanentDeleteFromFirestore,
  SoftDeletedTrashItem,
} from '../utils/firestoreSync';
import {
  collectFullBackupSnapshot,
  downloadFullBackupJSON,
  downloadStudentsCSV,
  downloadViolationsCSV,
  exportAllToExcel,
  exportAllSummaryPDF,
  exportArchiveViolationsAndServicesExcel,
  exportArchiveViolationsAndServicesCSV,
  parseBackupFilePreview,
  restoreBackupData,
  syncAllLocalDataToFirestore,
  hasCompletedLegacyFirestoreMigration,
  migrateLegacyLocalDataToFirestore,
  formatFileSize,
  LiveAppDataInput,
  BackupDownloadResult,
  BackupPreviewResult,
  RestoreExecutionResult,
  LegacyMigrationResult,
} from '../utils/backupRestore';
import { fixMissingSchoolId, mergeAuthenticStudentsPool, restoreOriginalUserData } from '../utils/multiSchoolMigration';
import {
  auditSchoolIdentity,
  migrateLegacyUnassignedData,
  relocateOtherSchoolDataToCurrentSchool,
  SchoolIdentityAuditResult,
  MigrationSummaryResult,
  IdentityAuditCategory,
  OtherSchoolAuditItem,
} from '../utils/schoolIdentityMigration';
import { getDeletedIds } from '../utils/deletionTracker';
import { isDummyStudent, purgeDummyStudents } from '../utils/purgeDummyData';

interface BackupRestoreViewProps {
  activeCounselor?: Counselor | null;
  liveState: LiveAppDataInput;
  onBack: () => void;
  onDataRestored?: () => void;
  onClearAllStudents?: () => void;
  onAddStudent?: (student: Omit<Student, 'id' | 'initials'>) => void;
  onNavigateToGoogleSync?: () => void;
  initialTab?: 'backup' | 'perbaikan' | 'audit';
}

export default function BackupRestoreView({
  activeCounselor,
  liveState,
  onBack,
  onDataRestored,
  onClearAllStudents,
  onAddStudent,
  onNavigateToGoogleSync,
  initialTab = 'backup',
}: BackupRestoreViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const schoolId = activeCounselor?.schoolId || getActiveSchoolId();
  const schoolConfig = getSchoolConfig(schoolId);

  const [mainTab, setMainTab] = useState<'backup' | 'perbaikan' | 'audit'>(initialTab);
  const [refreshTick, setRefreshTick] = useState(0);

  // Tab 1: Backup & Restore + Cloud Sync States
  const [cloudInfo, setCloudInfo] = useState<CloudSyncRecordInfo>(() => getLastCloudSyncInfo(schoolId));
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isReloadingFromCloud, setIsReloadingFromCloud] = useState(false);
  const [cloudActionMsg, setCloudActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastBackupResult, setLastBackupResult] = useState<BackupDownloadResult | null>(null);
  const [secondaryExportMsg, setSecondaryExportMsg] = useState<string | null>(null);

  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFileSize, setSelectedFileSize] = useState<string>('');
  const [restorePreview, setRestorePreview] = useState<BackupPreviewResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreExecutionResult | null>(null);
  const [showReplaceConfirmModal, setShowReplaceConfirmModal] = useState(false);
  const [confirmYaInput, setConfirmYaInput] = useState('');

  const [hasMigratedLegacy, setHasMigratedLegacy] = useState<boolean>(() =>
    hasCompletedLegacyFirestoreMigration(schoolId)
  );
  const [isMigratingLegacy, setIsMigratingLegacy] = useState(false);
  const [legacyMigrationResult, setLegacyMigrationResult] = useState<LegacyMigrationResult | null>(null);

  // Tab 2: Perbaikan Data, Impor, Sampah & Darurat States
  const [repairStatusMsg, setRepairStatusMsg] = useState<string | null>(null);
  const [isMigratingData, setIsMigratingData] = useState(false);
  const [isRestoringOriginal, setIsRestoringOriginal] = useState(false);
  const [isSyncingAulia, setIsSyncingAulia] = useState(false);
  const [isPurgingDummy, setIsPurgingDummy] = useState(false);
  const [showWipeConfirmBox, setShowWipeConfirmBox] = useState(false);
  const [confirmWipeInput, setConfirmWipeInput] = useState('');
  const [importText, setImportText] = useState('');

  // Browser Cache Scanner & Trash
  const [backupScanResults, setBackupScanResults] = useState<
    { key: string; label: string; count: number; sampleNames: string[]; students: Student[] }[]
  >([]);
  const [trashItems, setTrashItems] = useState<SoftDeletedTrashItem[]>([]);
  const [trashLogs, setTrashLogs] = useState<HapusLogEntry[]>([]);
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);
  const [trashFilter, setTrashFilter] = useState<'Semua' | 'Siswa' | 'Kasus' | 'Layanan' | 'Lainnya'>('Semua');
  const [restoringItemId, setRestoringItemId] = useState<string | null>(null);
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState<{
    item: SoftDeletedTrashItem;
    step: 1 | 2;
  } | null>(null);
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);

  // Tab 3: Audit & Identitas States
  const AUDIT_PAGE_SIZE = 20;
  const [auditResult, setAuditResult] = useState<SchoolIdentityAuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [showUnassignedList, setShowUnassignedList] = useState(false);
  const [showOtherSchoolList, setShowOtherSchoolList] = useState(false);
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<'Semua' | IdentityAuditCategory>('Semua');
  const [unassignedPage, setUnassignedPage] = useState(1);
  const [otherSchoolPage, setOtherSchoolPage] = useState(1);
  const lastAuditScanKeyRef = useRef<string>('');
  const [showLegacyMigrationConfirm, setShowLegacyMigrationConfirm] = useState(false);
  const [isRunningIdentityMigration, setIsRunningIdentityMigration] = useState(false);
  const [identityMigrationResult, setIdentityMigrationResult] = useState<MigrationSummaryResult | null>(null);
  const [claimingSingleId, setClaimingSingleId] = useState<string | null>(null);
  const [relocatingSingleId, setRelocatingSingleId] = useState<string | null>(null);
  const [isRelocatingAll, setIsRelocatingAll] = useState(false);
  const [pendingClaimAllModal, setPendingClaimAllModal] = useState<{ step: 1 | 2 } | null>(null);
  const [pendingRelocateModal, setPendingRelocateModal] = useState<{ step: 1 | 2; targetLabel: string } | null>(null);

  const liveStudents = useMemo(() => liveState.students || [], [liveState.students]);
  const liveViolations = useMemo(() => liveState.violations || [], [liveState.violations]);
  const liveServices = useMemo(() => liveState.services || [], [liveState.services]);
  const hasDummyStudents = useMemo(() => liveStudents.some(isDummyStudent), [liveStudents]);

  const unmigratedSummary = useMemo(() => {
    const unmigratedStudents = liveStudents.filter((s) => (s as any).isLegacyUnmigrated || !s.schoolId).length;
    const unmigratedViolations = liveViolations.filter((v) => (v as any).isLegacyUnmigrated || !v.schoolId).length;
    const unmigratedServices = liveServices.filter((s) => (s as any).isLegacyUnmigrated || !s.schoolId).length;
    return {
      studentsCount: unmigratedStudents,
      servicesCount: unmigratedViolations + unmigratedServices,
      total: unmigratedStudents + unmigratedViolations + unmigratedServices,
    };
  }, [liveStudents, liveViolations, liveServices]);

  useEffect(() => {
    setHasMigratedLegacy(hasCompletedLegacyFirestoreMigration(schoolId));
  }, [schoolId]);

  useEffect(() => {
    const updateCloudState = () => {
      setCloudInfo(getLastCloudSyncInfo(schoolId));
    };
    updateCloudState();
    window.addEventListener('bk_cloud_status', updateCloudState);
    window.addEventListener('online', updateCloudState);
    window.addEventListener('offline', updateCloudState);
    return () => {
      window.removeEventListener('bk_cloud_status', updateCloudState);
      window.removeEventListener('online', updateCloudState);
      window.removeEventListener('offline', updateCloudState);
    };
  }, [schoolId, refreshTick]);

  // Scan local browser cache when entering Perbaikan tab
  useEffect(() => {
    if (mainTab !== 'perbaikan' || typeof localStorage === 'undefined') return;
    const results: {
      key: string;
      label: string;
      count: number;
      sampleNames: string[];
      students: Student[];
    }[] = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          key.includes('student') ||
          key.includes('siswa') ||
          key.startsWith('bk_backup_') ||
          key.includes('backup') ||
          key.startsWith('bk_attendance_history')
        ) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            let rawStudents: any[] = [];
            const parsed = JSON.parse(raw);

            if (key.startsWith('bk_attendance_history') && Array.isArray(parsed)) {
              const sId = getActiveSchoolId();
              const sName = getSchoolConfig(sId).schoolName || 'SMP N 2 Susukan';
              rawStudents = mergeAuthenticStudentsPool([], sId, sName, { attendance: parsed });
            } else if (Array.isArray(parsed)) {
              rawStudents = parsed;
            } else if (parsed && Array.isArray(parsed.students)) {
              rawStudents = parsed.students;
            }

            const authenticOnly = rawStudents.filter(
              (item: any) => item && (item.name || item.nis) && !isDummyStudent(item)
            );
            if (authenticOnly.length > 0) {
              results.push({
                key,
                label: key
                  .replace('bk_attendance_history_', 'Ekstrak Absensi Sekolah: ')
                  .replace('bk_attendance_history', 'Ekstrak Absensi')
                  .replace('bk_students_', 'ID Sekolah: ')
                  .replace('bk_students', 'Penyimpanan Utama'),
                count: authenticOnly.length,
                sampleNames: authenticOnly.slice(0, 3).map((s: any) => s.name || s.nis || 'Tanpa Nama'),
                students: authenticOnly,
              });
            }
          } catch {}
        }
      }
    } catch {}
    setBackupScanResults(results);
  }, [mainTab]);

  // Load Audit Identity automatically on entering Tab 3 (once per open/school)
  const handleLoadIdentityAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await auditSchoolIdentity(activeCounselor);
      setAuditResult(res);
      setUnassignedPage(1);
      setOtherSchoolPage(1);
    } catch (err: any) {
      showToast(`Gagal memindai identitas sekolah: ${err?.message || err}`, 'error');
    } finally {
      setIsAuditing(false);
    }
  };

  useEffect(() => {
    if (mainTab === 'audit') {
      const openKey = `${activeCounselor?.schoolId || getActiveSchoolId()}-audit`;
      if (lastAuditScanKeyRef.current !== openKey) {
        lastAuditScanKeyRef.current = openKey;
        void handleLoadIdentityAudit();
      }
    }
  }, [mainTab, activeCounselor?.schoolId]);

  useEffect(() => {
    setUnassignedPage(1);
  }, [auditCategoryFilter]);

  const currentSnapshot = useMemo(() => {
    return collectFullBackupSnapshot(activeCounselor, liveState);
  }, [activeCounselor, liveState, refreshTick]);

  const counts = currentSnapshot.counts;

  // --- TAB 1 HANDLERS ---
  const handleDownloadJsonBackup = () => {
    try {
      const res = downloadFullBackupJSON(activeCounselor, liveState);
      setLastBackupResult(res);
      showToast('Backup JSON semua data berhasil diunduh!', 'success');
    } catch (err: any) {
      showToast(`Gagal membuat backup JSON: ${err?.message || String(err)}`, 'error');
    }
  };

  const handleDownloadStudentsCsv = () => {
    try {
      const res = downloadStudentsCSV(liveStudents, activeCounselor);
      setSecondaryExportMsg(`CSV Siswa berhasil diunduh: ${res.fileName} (${res.count} siswa)`);
      showToast(`Backup ${res.count} siswa CSV diunduh.`, 'success');
    } catch (err: any) {
      showToast(`Gagal backup siswa CSV: ${err?.message || String(err)}`, 'error');
    }
  };

  const handleDownloadViolationsCsv = () => {
    try {
      const res = downloadViolationsCSV(liveViolations, activeCounselor);
      setSecondaryExportMsg(`CSV Pelanggaran berhasil diunduh: ${res.fileName} (${res.count} catatan)`);
      showToast(`Backup ${res.count} pelanggaran CSV diunduh.`, 'success');
    } catch (err: any) {
      showToast(`Gagal backup pelanggaran CSV: ${err?.message || String(err)}`, 'error');
    }
  };

  const handleExportAllExcel = () => {
    try {
      const res = exportAllToExcel(activeCounselor, liveState);
      setSecondaryExportMsg(`Workbook Excel Multi-Sheet berhasil diunduh: ${res.fileName} (${res.counts.totalRecords} baris data)`);
      showToast('Export semua data ke Excel berhasil!', 'success');
    } catch (err: any) {
      showToast(`Gagal export ke Excel: ${err?.message || String(err)}`, 'error');
    }
  };

  const handleExportAllPdf = () => {
    try {
      const res = exportAllSummaryPDF(activeCounselor, liveState);
      setSecondaryExportMsg(`Laporan PDF Ringkasan Lengkap berhasil diunduh: ${res.fileName}`);
      showToast('Export ringkasan semua data ke PDF berhasil!', 'success');
    } catch (err: any) {
      showToast(`Gagal export ke PDF: ${err?.message || String(err)}`, 'error');
    }
  };

  const handleExportArchiveExcel = () => {
    try {
      const res = exportArchiveViolationsAndServicesExcel(activeCounselor, liveState);
      setSecondaryExportMsg(
        `Arsip Excel Pelanggaran & Layanan BK berhasil diunduh: ${res.fileName} (${res.violationsCount} pelanggaran, ${res.servicesCount} layanan BK)`
      );
      showToast(
        `Ekspor Arsip Excel berhasil (${res.violationsCount} pelanggaran & ${res.servicesCount} layanan BK).`,
        'success'
      );
    } catch (err: any) {
      showToast(`Gagal ekspor arsip Excel: ${err?.message || String(err)}`, 'error');
    }
  };

  const handleExportArchiveCSV = () => {
    try {
      const res = exportArchiveViolationsAndServicesCSV(activeCounselor, liveState);
      setSecondaryExportMsg(
        `Arsip CSV Pelanggaran & Layanan BK berhasil diunduh: ${res.fileName} (${res.totalRows} baris, ${res.sizeLabel})`
      );
      showToast(`Ekspor Arsip CSV berhasil (${res.totalRows} baris, ${res.sizeLabel}).`, 'success');
    } catch (err: any) {
      showToast(`Gagal ekspor arsip CSV: ${err?.message || String(err)}`, 'error');
    }
  };

  const handleSyncToCloud = async () => {
    setIsSyncingCloud(true);
    setCloudActionMsg(null);
    try {
      const res = await syncAllLocalDataToFirestore(activeCounselor, liveState);
      setCloudInfo(getLastCloudSyncInfo(schoolId));
      if (res.success) {
        const syncedColsCount = Object.values(res.perCollection || {}).filter((n) => n > 0).length;
        setCloudActionMsg({
          type: 'success',
          text: `Sinkronisasi Cloud berhasil! ${syncedColsCount} koleksi data (${res.uploadedTotal} item) kini tersimpan aman di Firebase Firestore.`,
        });
        showToast('Seluruh data berhasil disinkronkan ke Cloud Firebase!', 'success');
      } else {
        setCloudActionMsg({
          type: 'error',
          text: res.error || 'Sebagian data gagal disinkronkan ke Cloud. Pastikan koneksi internet aktif.',
        });
        showToast('Sinkronisasi Cloud belum lengkap. Periksa koneksi internet.', 'warning');
      }
    } catch (err: any) {
      setCloudActionMsg({
        type: 'error',
        text: err?.message || 'Gagal menghubungi server Firebase Firestore.',
      });
      showToast('Gagal sinkronisasi ke Cloud Firebase.', 'error');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleClearLocalCacheAndReload = async () => {
    setIsReloadingFromCloud(true);
    setCloudActionMsg(null);
    try {
      const res = await clearLocalCacheAndReloadFromCloud();
      setCloudInfo(getLastCloudSyncInfo(schoolId));
      setRefreshTick((t) => t + 1);
      if (onDataRestored) {
        onDataRestored();
      }
      if (res.success) {
        setCloudActionMsg({
          type: 'success',
          text: `Cache lokal dibersihkan & data terbaru diambil dari Firebase Firestore (${res.counts.students} siswa, ${res.counts.violations} pelanggaran, ${res.counts.services} layanan BK).`,
        });
        showToast('Data terbaru berhasil diambil dari Firestore!', 'success');
      } else {
        setCloudActionMsg({
          type: 'error',
          text: res.error || 'Gagal mengambil ulang data dari Firestore.',
        });
        showToast('Gagal mengambil ulang data dari Firestore.', 'error');
      }
    } catch (err: any) {
      setCloudActionMsg({
        type: 'error',
        text: err?.message || 'Gagal membersihkan cache dan mengambil ulang data Firestore.',
      });
      showToast('Terjadi kesalahan saat menyegarkan data dari Cloud.', 'error');
    } finally {
      setIsReloadingFromCloud(false);
    }
  };

  const handleMigrateLegacyToFirestore = async () => {
    setIsMigratingLegacy(true);
    setLegacyMigrationResult(null);
    try {
      const res = await migrateLegacyLocalDataToFirestore(activeCounselor, liveState);
      setLegacyMigrationResult(res);
      setHasMigratedLegacy(hasCompletedLegacyFirestoreMigration(schoolId));
      setCloudInfo(getLastCloudSyncInfo(schoolId));
      setRefreshTick((t) => t + 1);
      if (res.success) {
        if (onDataRestored) onDataRestored();
        showToast(res.message, 'success');
      } else {
        showToast(res.error || 'Gagal migrasi data lama ke Firestore.', 'error');
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      setLegacyMigrationResult({
        success: false,
        alreadyMigrated: false,
        migratedStudents: 0,
        migratedViolations: 0,
        migratedServices: 0,
        migratedOther: 0,
        skippedDuplicates: 0,
        totalMigrated: 0,
        message: `Gagal migrasi data lama ke Firestore: ${msg}`,
        error: msg,
      });
      showToast('Gagal migrasi data lama ke Firestore.', 'error');
    } finally {
      setIsMigratingLegacy(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreResult(null);
    setSelectedFileName(file.name);
    setSelectedFileSize(formatFileSize(file.size));

    try {
      const text = await file.text();
      const preview = parseBackupFilePreview(text);
      setRestorePreview(preview);
      setRestoreMode('merge');
      if (!preview.valid) {
        showToast(preview.error || 'File backup tidak valid.', 'error');
      } else {
        showToast('File backup siap dipulihkan. Periksa preview isi file di bawah.', 'info');
      }
    } catch (err: any) {
      showToast(`Gagal membaca file: ${err?.message || String(err)}`, 'error');
    } finally {
      e.target.value = '';
    }
  };

  const executeRestore = async (modeToRun: 'merge' | 'replace') => {
    if (!restorePreview?.valid || !restorePreview.payload) return;
    setIsRestoring(true);
    setShowReplaceConfirmModal(false);
    setConfirmYaInput('');

    try {
      const res = await restoreBackupData(restorePreview.payload, modeToRun, activeCounselor);
      setRestoreResult(res);
      setRefreshTick((t) => t + 1);
      setCloudInfo(getLastCloudSyncInfo(schoolId));
      if (onDataRestored) {
        onDataRestored();
      }
      showToast('Restore data berhasil! Memuat ulang aplikasi agar seluruh menu terbarui...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1700);
    } catch (err: any) {
      showToast(`Gagal memulihkan data: ${err?.message || String(err)}`, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleTriggerRestore = () => {
    if (!restorePreview?.valid || !restorePreview.payload) return;
    if (restoreMode === 'replace') {
      setConfirmYaInput('');
      setShowReplaceConfirmModal(true);
    } else {
      void executeRestore('merge');
    }
  };

  // --- TAB 2 HANDLERS (PERBAIKAN, IMPOR, SAMPAH) ---
  const handleFixLegacyData = async () => {
    setIsMigratingData(true);
    try {
      const res = await fixMissingSchoolId(activeCounselor);
      setRepairStatusMsg(res.message);
      showToast(res.message, res.success ? 'success' : 'error');
      if (onDataRestored) onDataRestored();
    } catch (err: any) {
      const errMsg = `Gagal memperbaiki data: ${err?.message || 'Terjadi kesalahan sistem'}`;
      setRepairStatusMsg(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsMigratingData(false);
    }
  };

  const handleRestoreOriginalData = async () => {
    setIsRestoringOriginal(true);
    try {
      const res = await restoreOriginalUserData(activeCounselor?.schoolId);
      setRepairStatusMsg(res.message);
      showToast(res.message, res.success ? 'success' : 'error');
      if (onDataRestored) onDataRestored();
    } catch (err: any) {
      const errMsg = `Gagal memulihkan data: ${err?.message || 'Terjadi kesalahan sistem'}`;
      setRepairStatusMsg(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsRestoringOriginal(false);
    }
  };

  const handleSyncToAulia = async () => {
    setIsSyncingAulia(true);
    try {
      const res = await syncPreviewDataToAuliaAccount();
      if (res.success) {
        const msg = `Berhasil sinkronisasi ke Cloud (${res.counts.students} siswa, ${res.counts.violations} pelanggaran, ${res.counts.services} layanan).`;
        setRepairStatusMsg(msg);
        showToast(msg, 'success');
      } else {
        const msg = `Sinkronisasi gagal: ${res.error || 'Terjadi kendala'}`;
        setRepairStatusMsg(msg);
        showToast(msg, 'error');
      }
    } catch (err: any) {
      const msg = `Gagal sinkronisasi: ${err?.message || 'Periksa koneksi'}`;
      setRepairStatusMsg(msg);
      showToast(msg, 'error');
    } finally {
      setIsSyncingAulia(false);
    }
  };

  const handlePurgeDummy = async () => {
    setIsPurgingDummy(true);
    try {
      const res = await purgeDummyStudents();
      const msg =
        res.totalPurged > 0
          ? `Berhasil menghapus ${res.totalPurged} siswa dummy. Sisa: ${res.remainingCount} siswa.`
          : 'Database sudah bersih, tidak ditemukan siswa dummy.';
      setRepairStatusMsg(msg);
      showToast(msg, 'success');
      if (onDataRestored) onDataRestored();
    } catch (err: any) {
      const msg = `Gagal membersihkan siswa dummy: ${err?.message || err}`;
      setRepairStatusMsg(msg);
      showToast(msg, 'error');
    } finally {
      setIsPurgingDummy(false);
    }
  };

  const loadTrashRecords = async () => {
    setIsLoadingTrash(true);
    try {
      const targetSchoolId = activeCounselor?.schoolId || getActiveSchoolId();
      const res = await fetchSoftDeletedRecordsFromFirestore(targetSchoolId);
      setTrashItems(res.items || []);
      setTrashLogs(res.logs || []);
    } catch (err: any) {
      showToast(`Gagal memuat Sampah: ${err?.message || 'Coba lagi'}`, 'error');
    } finally {
      setIsLoadingTrash(false);
    }
  };

  useEffect(() => {
    if (mainTab === 'perbaikan') {
      void loadTrashRecords();
    }
  }, [mainTab]);

  const filteredTrashItems = useMemo(() => {
    if (trashFilter === 'Semua') return trashItems;
    return trashItems.filter((item) => {
      const et = (item.entityType || '').toLowerCase();
      if (trashFilter === 'Siswa') return et.includes('siswa');
      if (trashFilter === 'Kasus') return et.includes('kasus') || et.includes('pelanggaran');
      if (trashFilter === 'Layanan') return et.includes('layanan');
      return !et.includes('siswa') && !et.includes('kasus') && !et.includes('pelanggaran') && !et.includes('layanan');
    });
  }, [trashItems, trashFilter]);

  const handleRestoreFromTrash = async (item: SoftDeletedTrashItem) => {
    setRestoringItemId(item.id);
    try {
      const targetSchoolId = activeCounselor?.schoolId || getActiveSchoolId();
      await restoreSoftDeletedFromFirestore(item, targetSchoolId);
      setTrashItems((prev) => prev.filter((it) => !(it.id === item.id && it.colName === item.colName)));
      setTrashLogs((prev) => prev.filter((l) => String(l.recordId) !== String(item.id)));
      const msg = `Data "${item.nama}" berhasil dipulihkan.`;
      setRepairStatusMsg(msg);
      showToast(msg, 'success');
      if (onDataRestored) onDataRestored();
    } catch (err: any) {
      showToast(`Gagal memulihkan data: ${err?.message || err}`, 'error');
    } finally {
      setRestoringItemId(null);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!pendingPermanentDelete) return;
    if (pendingPermanentDelete.step === 1) {
      setPendingPermanentDelete({ ...pendingPermanentDelete, step: 2 });
      return;
    }
    const { item } = pendingPermanentDelete;
    setIsPermanentDeleting(true);
    try {
      const targetSchoolId = activeCounselor?.schoolId || getActiveSchoolId();
      await permanentDeleteFromFirestore(item.localKey, item.id, targetSchoolId, item.hapusLogId);
      setTrashItems((prev) => prev.filter((it) => !(it.id === item.id && it.colName === item.colName)));
      setTrashLogs((prev) => prev.filter((l) => String(l.recordId) !== String(item.id)));
      setPendingPermanentDelete(null);
      setRepairStatusMsg(`Data "${item.nama}" dihapus permanen.`);
      showToast('Data dihapus permanen', 'success');
    } catch (err: any) {
      showToast(`Gagal menghapus permanen: ${err?.message || err}`, 'error');
    } finally {
      setIsPermanentDeleting(false);
    }
  };

  const parsedImportStudents = useMemo(() => {
    if (!importText.trim()) return [];
    const lines = importText.split(/\r?\n/);
    const result: Array<{ nis: string; name: string; class: string; gender: 'L' | 'P'; error?: string }> = [];
    let autoNisCounter = 26000001 + Math.floor(Math.random() * 10000);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const lineLower = line.toLowerCase();
      if (
        (lineLower.includes('nis') && lineLower.includes('nama')) ||
        lineLower.includes('nama siswa') ||
        lineLower.includes('nama,kelas')
      ) {
        continue;
      }

      let cols: string[] = [];
      if (line.includes('\t')) cols = line.split('\t');
      else if (line.includes(';')) cols = line.split(';');
      else if (line.includes(',')) cols = line.split(',');
      else cols = line.split(/\s+/);

      cols = cols.map((c) => c.trim()).filter(Boolean);
      if (cols.length === 0) continue;

      let nis = '';
      let name = '';
      let rawClass = '7A';
      let rawGender = 'L';

      if (cols.length === 1) {
        name = cols[0];
        nis = String(autoNisCounter++);
      } else {
        const isFirstColNis = /^\d+$/.test(cols[0]) && cols[0].length >= 3;
        const rest = isFirstColNis ? cols.slice(1) : [...cols];
        nis = isFirstColNis ? cols[0] : String(autoNisCounter++);

        const lastToken = rest[rest.length - 1]?.toUpperCase() || '';
        if (lastToken === 'L' || lastToken === 'P' || lastToken.includes('PEREMPUAN') || lastToken.includes('LAKI')) {
          rawGender = lastToken;
          rest.pop();
        }
        const newLastToken = rest[rest.length - 1] || '';
        if (/^(\d+|kelas|[A-Z])/.test(newLastToken) || /\d/.test(newLastToken)) {
          rawClass = newLastToken;
          rest.pop();
        }
        name = rest.join(' ');
      }

      const cleanClass = rawClass.trim() || '7A';
      if (!name.trim()) {
        result.push({ nis, name: '', class: cleanClass, gender: 'L', error: 'Nama kosong' });
        continue;
      }
      const gLower = rawGender.toLowerCase();
      const gender: 'L' | 'P' =
        gLower === 'p' || gLower.includes('perempuan') || gLower.includes('female') || gLower === 'w' || gLower === 'wanita'
          ? 'P'
          : 'L';

      result.push({ nis, name: name.trim(), class: cleanClass, gender });
    }
    return result;
  }, [importText]);

  const handleApplyRecoveredStudents = (recoveredList: Student[], sourceName: string) => {
    const sId = getActiveSchoolId();
    const deletedSet = new Set(getDeletedIds());
    const cleanRecovered = (recoveredList || []).filter(
      (st) => st && st.isDeleted !== true && !deletedSet.has(String(st.id))
    );
    localStorage.removeItem(`bk_cleared_${sId}`);
    saveSchoolData('bk_students', cleanRecovered, sId);
    saveBulkToFirestore('bk_students', cleanRecovered, sId).catch(() => {});
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_students', data: cleanRecovered, schoolId: sId } }));
    window.dispatchEvent(new Event('storage'));
    const msg = `Berhasil memulihkan ${cleanRecovered.length} data siswa dari "${sourceName}".`;
    setRepairStatusMsg(msg);
    showToast(msg, 'success');
    if (onDataRestored) onDataRestored();
  };

  const handleEmergencyImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddStudent) {
      showToast('Fitur tambah siswa belum terhubung.', 'error');
      return;
    }
    const valid = parsedImportStudents.filter((s) => !s.error);
    if (valid.length === 0) {
      showToast('Tidak ada data siswa valid untuk diimpor.', 'error');
      return;
    }
    valid.forEach((st) => {
      onAddStudent({
        nis: st.nis,
        name: st.name,
        class: st.class,
        gender: st.gender,
        violationPoints: 0,
        bkServicesCount: 0,
      });
    });
    const msg = `Berhasil mengimpor ${valid.length} siswa ke database.`;
    setRepairStatusMsg(msg);
    showToast(msg, 'success');
    setImportText('');
  };

  // --- TAB 3 HANDLERS (AUDIT IDENTITAS SEKOLAH) ---
  const filteredUnassignedItems = useMemo(() => {
    const list = auditResult?.unassignedItems || [];
    if (auditCategoryFilter === 'Semua') return list;
    return list.filter((it) => it.category === auditCategoryFilter);
  }, [auditResult, auditCategoryFilter]);

  const unassignedTotalPages = Math.max(1, Math.ceil(filteredUnassignedItems.length / AUDIT_PAGE_SIZE));
  const paginatedUnassignedItems = useMemo(() => {
    const safePage = Math.min(unassignedPage, unassignedTotalPages);
    const start = (safePage - 1) * AUDIT_PAGE_SIZE;
    return filteredUnassignedItems.slice(start, start + AUDIT_PAGE_SIZE);
  }, [filteredUnassignedItems, unassignedPage, unassignedTotalPages]);

  const otherSchoolItems = auditResult?.otherSchoolItems || [];
  const otherSchoolTotalPages = Math.max(1, Math.ceil(otherSchoolItems.length / AUDIT_PAGE_SIZE));
  const paginatedOtherSchoolItems = useMemo(() => {
    const safePage = Math.min(otherSchoolPage, otherSchoolTotalPages);
    const start = (safePage - 1) * AUDIT_PAGE_SIZE;
    return otherSchoolItems.slice(start, start + AUDIT_PAGE_SIZE);
  }, [otherSchoolItems, otherSchoolPage, otherSchoolTotalPages]);

  const handleConfirmRunLegacyMigration = async () => {
    if (!hasConfiguredSchool(activeCounselor)) {
      showToast('Gagal: Sekolah belum diatur', 'error');
      setShowLegacyMigrationConfirm(false);
      return;
    }
    setIsRunningIdentityMigration(true);
    try {
      const res = await migrateLegacyUnassignedData(activeCounselor);
      setIdentityMigrationResult(res);
      setRepairStatusMsg(res.message);
      showToast(res.message, res.success ? 'success' : 'error');
      setShowLegacyMigrationConfirm(false);
      await handleLoadIdentityAudit();
      if (onDataRestored) onDataRestored();
    } catch (err: any) {
      const errMsg = `Gagal migrasi data lama: ${err?.message || 'Terjadi kesalahan'}`;
      setRepairStatusMsg(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsRunningIdentityMigration(false);
    }
  };

  const handleClaimSingleLegacyItem = async (id: string, label: string) => {
    if (!hasConfiguredSchool(activeCounselor)) {
      showToast('Gagal: Sekolah belum diatur', 'error');
      return;
    }
    setClaimingSingleId(id);
    try {
      const res = await migrateLegacyUnassignedData(activeCounselor, [id]);
      setIdentityMigrationResult(res);
      setRepairStatusMsg(`"${label}" ditandai sebagai milik sekolah Anda.`);
      showToast(`"${label}" ditandai sebagai milik sekolah Anda.`, 'success');
      await handleLoadIdentityAudit();
    } catch (err: any) {
      showToast(`Gagal menandai data: ${err?.message || err}`, 'error');
    } finally {
      setClaimingSingleId(null);
    }
  };

  const handleConfirmClaimAllStep = async () => {
    if (!pendingClaimAllModal) return;
    if (pendingClaimAllModal.step === 1) {
      setPendingClaimAllModal({ step: 2 });
      return;
    }
    setPendingClaimAllModal(null);
    await handleConfirmRunLegacyMigration();
  };

  const handleRelocateSingleOtherSchoolItem = async (item: OtherSchoolAuditItem) => {
    if (!hasConfiguredSchool(activeCounselor)) {
      showToast('Gagal: Sekolah belum diatur', 'error');
      return;
    }
    setRelocatingSingleId(item.id);
    try {
      const res = await relocateOtherSchoolDataToCurrentSchool(activeCounselor, [item.id]);
      setIdentityMigrationResult(res);
      setRepairStatusMsg(res.message);
      showToast(res.message, res.success ? 'success' : 'error');
      await handleLoadIdentityAudit();
    } catch (err: any) {
      showToast(`Gagal memindahkan data: ${err?.message || err}`, 'error');
    } finally {
      setRelocatingSingleId(null);
    }
  };

  const handleConfirmRelocateAllStep = async () => {
    if (!pendingRelocateModal) return;
    if (pendingRelocateModal.step === 1) {
      setPendingRelocateModal({ ...pendingRelocateModal, step: 2 });
      return;
    }
    setPendingRelocateModal(null);
    setIsRelocatingAll(true);
    try {
      const res = await relocateOtherSchoolDataToCurrentSchool(activeCounselor);
      setIdentityMigrationResult(res);
      setRepairStatusMsg(res.message);
      showToast(res.message, res.success ? 'success' : 'error');
      await handleLoadIdentityAudit();
    } catch (err: any) {
      const errMsg = `Gagal memindahkan data sekolah lain: ${err?.message || err}`;
      setRepairStatusMsg(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsRelocatingAll(false);
    }
  };

  const isCloudSynced = cloudInfo.status === 'synced';
  const isOffline = cloudInfo.status === 'offline';

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-16">
      {/* Header Navigation */}
      <div className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/40 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2.5 rounded-xl bg-gray-100 hover:bg-[#e6f4f1] text-[#0b1c30] hover:text-[#00685f] transition-colors cursor-pointer shrink-0"
              title="Kembali ke Menu Lainnya"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#0b1c30]">
                  Backup, Perbaikan &amp; Keamanan Data
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/20">
                  {schoolConfig.schoolName || 'SMP N 2 Susukan'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#3d4947] mt-1">
                Pusat pencadangan JSON/CSV/Excel/PDF, pemulihan &amp; perbaikan data lama, sampah riwayat hapus, dan audit identitas sekolah.
              </p>
            </div>
          </div>

          {onNavigateToGoogleSync && (
            <button
              type="button"
              onClick={onNavigateToGoogleSync}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-extrabold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Cloud className="w-4 h-4 text-emerald-700" />
              <span>Google Drive / Sheets Sync</span>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
            </button>
          )}
        </div>

        {/* 3 Segmented Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl border border-[#bcc9c6]/40 w-full sm:w-fit">
          <button
            type="button"
            onClick={() => setMainTab('backup')}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none ${
              mainTab === 'backup'
                ? 'bg-[#00685f] text-white shadow-xs'
                : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-white/70'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Backup &amp; Restore</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab('perbaikan')}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none ${
              mainTab === 'perbaikan'
                ? 'bg-[#00685f] text-white shadow-xs'
                : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-white/70'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Perbaikan Data</span>
            {unmigratedSummary.total > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                mainTab === 'perbaikan' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {unmigratedSummary.total}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMainTab('audit')}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none ${
              mainTab === 'audit'
                ? 'bg-[#00685f] text-white shadow-xs'
                : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-white/70'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Audit &amp; Identitas</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: BACKUP & RESTORE                                               */}
      {/* ===================================================================== */}
      {mainTab === 'backup' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Cloud Sync Status & Firebase Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#bcc9c6]/40 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                    isCloudSynced
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                      : isOffline
                      ? 'bg-red-50 border-red-200 text-red-600'
                      : 'bg-amber-50 border-amber-200 text-amber-600'
                  }`}
                >
                  {isOffline ? <CloudOff className="w-6 h-6" /> : <Cloud className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#3d4947]">
                      Status Penyimpanan Cloud (Firebase Firestore)
                    </span>
                    {isCloudSynced ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Tersimpan di Cloud • Pukul {cloudInfo.timeLabel}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {isOffline ? 'Offline / Belum Tersinkron' : 'Belum Tersinkron'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#3d4947] mt-1.5 leading-relaxed">
                    Penyimpanan utama berada di Firebase Firestore (partisi <strong className="text-[#0b1c30]">{schoolId}</strong>). Penyimpanan browser hanya berfungsi sebagai cache cepat agar data tidak hilang saat offline.
                    {cloudInfo.syncedAtIso && (
                      <span className="block text-[11px] text-[#3d4947]/80 mt-0.5">
                        Sinkronisasi terakhir: {cloudInfo.dateTimeLabel}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleClearLocalCacheAndReload}
                  disabled={isReloadingFromCloud || isSyncingCloud}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <Trash2 className={`w-4 h-4 ${isReloadingFromCloud ? 'animate-pulse' : ''}`} />
                  <span>
                    {isReloadingFromCloud
                      ? 'Mengambil dari Firestore...'
                      : 'Hapus Cache Lokal & Ambil Ulang dari Cloud'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncToCloud}
                  disabled={isSyncingCloud || isReloadingFromCloud}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#00685f] hover:bg-[#005049] disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                  <span>{isSyncingCloud ? 'Menyinkronkan ke Cloud...' : 'Sinkron ke Cloud (Firebase)'}</span>
                </button>
              </div>
            </div>

            {cloudActionMsg && (
              <div
                className={`p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-start gap-2.5 ${
                  cloudActionMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {cloudActionMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                )}
                <span>{cloudActionMsg.text}</span>
              </div>
            )}

            {/* Data Inventory Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-2 border-t border-[#bcc9c6]/30">
              <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/30">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3d4947]">
                  <Users className="w-3.5 h-3.5 text-[#00685f]" />
                  <span>Siswa</span>
                </div>
                <p className="text-lg font-extrabold text-[#0b1c30] mt-1 tabular-nums">{counts.students}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/30">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3d4947]">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                  <span>Pelanggaran</span>
                </div>
                <p className="text-lg font-extrabold text-[#0b1c30] mt-1 tabular-nums">{counts.violations}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/30">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3d4947]">
                  <HeartHandshake className="w-3.5 h-3.5 text-[#00685f]" />
                  <span>Layanan BK</span>
                </div>
                <p className="text-lg font-extrabold text-[#0b1c30] mt-1 tabular-nums">{counts.services}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/30">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3d4947]">
                  <Home className="w-3.5 h-3.5 text-purple-600" />
                  <span>Home Visit</span>
                </div>
                <p className="text-lg font-extrabold text-[#0b1c30] mt-1 tabular-nums">{counts.homeVisits}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/30">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3d4947]">
                  <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                  <span>Agenda/Jurnal</span>
                </div>
                <p className="text-lg font-extrabold text-[#0b1c30] mt-1 tabular-nums">{counts.agendaTotal}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/30">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3d4947]">
                  <BookMarked className="w-3.5 h-3.5 text-amber-600" />
                  <span>Pembinaan</span>
                </div>
                <p className="text-lg font-extrabold text-[#0b1c30] mt-1 tabular-nums">{counts.pembinaanTotal}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/30">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3d4947]">
                  <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Absensi</span>
                </div>
                <p className="text-lg font-extrabold text-[#0b1c30] mt-1 tabular-nums">{counts.attendanceHistory}</p>
              </div>
            </div>
          </div>

          {/* One-Time Legacy Migration Card (Hidden automatically after completion) */}
          {(!hasMigratedLegacy || legacyMigrationResult) && (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#00685f]/30 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#e6f4f1] border border-[#00685f]/20 text-[#00685f] flex items-center justify-center shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base sm:text-lg font-extrabold text-[#0b1c30]">
                        Migrasi Data Lama ke Firestore
                      </h2>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-50 text-[#00685f] border border-teal-200">
                        Sekali Klik • Anti Duplikat
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#3d4947] mt-1">
                      Pindahkan seluruh data lama di browser ke Firebase Firestore dengan pengecekan duplikat otomatis.
                    </p>
                  </div>
                </div>

                {!hasMigratedLegacy && (
                  <button
                    type="button"
                    onClick={handleMigrateLegacyToFirestore}
                    disabled={isMigratingLegacy}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#00685f] hover:bg-[#005049] disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold shadow-xs transition-all cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-4 h-4 ${isMigratingLegacy ? 'animate-spin' : ''}`} />
                    <span>{isMigratingLegacy ? 'Memigrasi Data...' : 'Migrasi Data Lama ke Firestore'}</span>
                  </button>
                )}
              </div>

              {legacyMigrationResult && (
                <div
                  className={`p-4 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 ${
                    legacyMigrationResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {legacyMigrationResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  )}
                  <div className="space-y-1">
                    <p className="font-extrabold">{legacyMigrationResult.message}</p>
                    {legacyMigrationResult.success && (
                      <p className="text-xs text-emerald-800">
                        Rincian tambahan: {legacyMigrationResult.migratedServices} layanan BK, {legacyMigrationResult.migratedOther} data agenda/home visit/lainnya diunggah
                        {legacyMigrationResult.skippedDuplicates > 0
                          ? ` (${legacyMigrationResult.skippedDuplicates} duplikat sudah ada di Firestore sehingga dilewati aman)`
                          : ''}.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 1: BACKUP SEMUA DATA */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#bcc9c6]/40 shadow-xs space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#e6f4f1] border border-[#00685f]/20 text-[#00685f] flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#0b1c30]">1. Backup Semua Data</h2>
                <p className="text-xs sm:text-sm text-[#3d4947] mt-0.5">
                  Mengemas 100% data dalam 1 file JSON utuh: Data Siswa, Arsip Pelanggaran &amp; Restitusi, Layanan BK, Home Visit, Surat Panggilan Ortu, Agenda &amp; Jadwal, Catatan Pembinaan, Absensi, Apresiasi, Evaluasi, dan Pengaturan Sekolah.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#f8faf9] border border-[#bcc9c6]/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm font-extrabold text-[#0b1c30]">Cadangan Lengkap Format JSON (.json)</p>
                <p className="text-xs text-[#3d4947] mt-0.5">
                  Nama file otomatis:{' '}
                  <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-gray-200">
                    backup-bk-gridasus-TANGGAL-JAM.json
                  </code>{' '}
                  • Siap untuk Restore kapan saja.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadJsonBackup}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-sm font-extrabold shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Backup Sekarang (Download JSON)</span>
              </button>
            </div>

            {lastBackupResult && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 font-extrabold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Backup Berhasil Diunduh</span>
                  </div>
                  <span className="text-xs font-bold bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-200">
                    Ukuran File: {lastBackupResult.sizeLabel}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-semibold">{lastBackupResult.summaryText}</p>
                <p className="text-[11px] text-emerald-800/80 font-mono">Nama File: {lastBackupResult.fileName}</p>
              </div>
            )}

            <div className="space-y-2.5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#3d4947]">
                Backup Tambahan &amp; Export Dokumen
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={handleDownloadStudentsCsv}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-[#e6f4f1]/60 text-[#0b1c30] border border-[#bcc9c6]/60 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#00685f]" />
                  <span>Backup Siswa CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadViolationsCsv}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-[#e6f4f1]/60 text-[#0b1c30] border border-[#bcc9c6]/60 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-red-600" />
                  <span>Backup Pelanggaran CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportAllExcel}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Export Semua ke Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportAllPdf}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-purple-700" />
                  <span>Export Semua ke PDF</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleExportArchiveExcel}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#00685f]/10 hover:bg-[#00685f]/15 text-[#00685f] border border-[#00685f]/30 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#00685f]" />
                  <span>Ekspor Arsip ke Excel (Pelanggaran + Layanan BK)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportArchiveCSV}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-[#e6f4f1]/60 text-[#00685f] border border-[#00685f]/30 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#00685f]" />
                  <span>Ekspor Arsip ke CSV (Pelanggaran + Layanan BK)</span>
                </button>
              </div>
              {secondaryExportMsg && (
                <p className="text-xs font-semibold text-[#00685f] bg-[#e6f4f1] px-3 py-2 rounded-xl border border-[#00685f]/20">
                  {secondaryExportMsg}
                </p>
              )}
            </div>
          </div>

          {/* SECTION 2: RESTORE DATA DARI FILE JSON */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#bcc9c6]/40 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-[#0b1c30]">2. Restore Data dari File JSON</h2>
                  <p className="text-xs sm:text-sm text-[#3d4947] mt-0.5">
                    Pilih file backup <code className="font-mono text-[11px] bg-gray-100 px-1 rounded">.json</code> untuk melihat preview isi data sebelum dipulihkan ke aplikasi &amp; Cloud Firestore.
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelected}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isRestoring}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0b1c30] hover:bg-[#18314f] text-white text-xs sm:text-sm font-extrabold shadow-xs transition-all cursor-pointer shrink-0"
              >
                <FileJson className="w-4 h-4" />
                <span>Restore dari File JSON</span>
              </button>
            </div>

            {restorePreview && (
              <div
                className={`rounded-2xl p-5 border space-y-4 ${
                  restorePreview.valid ? 'bg-[#f8faf9] border-[#00685f]/30' : 'bg-red-50 border-red-200'
                }`}
              >
                {!restorePreview.valid ? (
                  <div className="flex items-start gap-3 text-red-800">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                    <div>
                      <p className="text-sm font-extrabold">File Backup Tidak Valid</p>
                      <p className="text-xs mt-1">{restorePreview.error}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#bcc9c6]/40">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-[#e6f4f1] px-2 py-0.5 rounded-md">
                          Preview Isi File Backup
                        </span>
                        <h3 className="text-sm sm:text-base font-extrabold text-[#0b1c30] mt-1">
                          {selectedFileName}{' '}
                          <span className="text-xs font-semibold text-[#3d4947]">({selectedFileSize})</span>
                        </h3>
                      </div>
                      <div className="text-xs text-[#3d4947] sm:text-right">
                        <p>
                          Tanggal Backup: <strong className="text-[#0b1c30]">{restorePreview.backupDateLabel}</strong>
                        </p>
                        <p>
                          Sekolah: <strong className="text-[#0b1c30]">{restorePreview.schoolName}</strong> (v{restorePreview.appVersion})
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                        <p className="text-[11px] font-semibold text-[#3d4947]">Siswa</p>
                        <p className="text-base font-extrabold text-[#0b1c30] tabular-nums">{restorePreview.counts.students}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                        <p className="text-[11px] font-semibold text-[#3d4947]">Pelanggaran</p>
                        <p className="text-base font-extrabold text-[#0b1c30] tabular-nums">{restorePreview.counts.violations}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                        <p className="text-[11px] font-semibold text-[#3d4947]">Layanan BK</p>
                        <p className="text-base font-extrabold text-[#0b1c30] tabular-nums">{restorePreview.counts.services}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                        <p className="text-[11px] font-semibold text-[#3d4947]">Home Visit &amp; Ortu</p>
                        <p className="text-base font-extrabold text-[#0b1c30] tabular-nums">
                          {restorePreview.counts.homeVisits + restorePreview.counts.parentSummons}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                        <p className="text-[11px] font-semibold text-[#3d4947]">Agenda / Jurnal</p>
                        <p className="text-base font-extrabold text-[#0b1c30] tabular-nums">{restorePreview.counts.agendaTotal}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                        <p className="text-[11px] font-semibold text-[#3d4947]">Catatan Pembinaan</p>
                        <p className="text-base font-extrabold text-[#0b1c30] tabular-nums">{restorePreview.counts.pembinaanTotal}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                        <p className="text-[11px] font-semibold text-[#3d4947]">Absensi Kelas</p>
                        <p className="text-base font-extrabold text-[#0b1c30] tabular-nums">{restorePreview.counts.attendanceHistory}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                        <p className="text-[11px] font-semibold text-[#3d4947]">Pengaturan &amp; Lainnya</p>
                        <p className="text-base font-extrabold text-[#0b1c30]">
                          {restorePreview.hasSettings ? 'Tersedia' : 'Tidak Ada'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-2">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-[#0b1c30]">
                        Pilih Mode Restore:
                      </p>

                      <label
                        className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                          restoreMode === 'merge'
                            ? 'bg-[#e6f4f1]/70 border-[#00685f] shadow-2xs'
                            : 'bg-white border-[#bcc9c6]/50 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restoreMode"
                          value="merge"
                          checked={restoreMode === 'merge'}
                          onChange={() => setRestoreMode('merge')}
                          className="mt-1 accent-[#00685f]"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-extrabold text-[#0b1c30]">
                              Gabungkan (tambah yang belum ada, jangan hapus data lama)
                            </span>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[#00685f] text-white">
                              Disarankan / Default
                            </span>
                          </div>
                          <p className="text-xs text-[#3d4947] mt-0.5">
                            Aman: Data saat ini tetap dipertahankan, dan data dari file backup yang belum ada akan ditambahkan ke aplikasi &amp; Cloud.
                          </p>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                          restoreMode === 'replace'
                            ? 'bg-red-50 border-red-400 shadow-2xs'
                            : 'bg-white border-[#bcc9c6]/50 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restoreMode"
                          value="replace"
                          checked={restoreMode === 'replace'}
                          onChange={() => setRestoreMode('replace')}
                          className="mt-1 accent-red-600"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-extrabold text-red-900">
                              Ganti Total (hapus semua data lama, ganti dengan isi file backup)
                            </span>
                          </div>
                          <p className="text-xs text-red-700 mt-0.5">
                            Hati-hati: Seluruh data saat ini akan diganti total dengan isi file backup. Memerlukan konfirmasi ketik &quot;YA&quot;.
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRestorePreview(null);
                          setSelectedFileName('');
                        }}
                        className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-[#3d4947] hover:bg-gray-100 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleTriggerRestore}
                        disabled={isRestoring}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold text-white shadow-xs transition-all cursor-pointer disabled:opacity-60 ${
                          restoreMode === 'replace'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-[#00685f] hover:bg-[#005049]'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>
                          {isRestoring
                            ? 'Memulihkan Data...'
                            : restoreMode === 'replace'
                            ? 'Lanjutkan Restore (Ganti Total)'
                            : 'Pulihkan Sekarang (Gabungkan)'}
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {restoreResult && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1.5">
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Restore Data Berhasil</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold">{restoreResult.summaryText}</p>
                <p className="text-xs text-emerald-800">
                  {restoreResult.cloudSynced
                    ? 'Data telah tersimpan di cache lokal & disinkronkan ke Firebase Firestore. Memuat ulang halaman...'
                    : `Data telah dipulihkan di aplikasi. Catatan Cloud: ${restoreResult.cloudError || 'Menunggu koneksi'}. Memuat ulang halaman...`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: PERBAIKAN DATA, IMPOR, SAMPAH & DARURAT                        */}
      {/* ===================================================================== */}
      {mainTab === 'perbaikan' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {repairStatusMsg && (
            <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-xs sm:text-sm font-bold text-[#00685f] flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{repairStatusMsg}</span>
            </div>
          )}

          {/* Pemeliharaan & Sinkronisasi Data Lama */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#bcc9c6]/40 shadow-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#e6f4f1] border border-[#00685f]/20 text-[#00685f] flex items-center justify-center shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#0b1c30]">Perbaikan &amp; Pemulihan Data Sekolah</h2>
                <p className="text-xs sm:text-sm text-[#3d4947] mt-0.5">
                  Jalankan hanya secara manual jika ada data lama yang belum muncul atau perlu dipulihkan.
                </p>
              </div>
            </div>

            {unmigratedSummary.total > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
                Terdeteksi <strong>{unmigratedSummary.studentsCount} siswa</strong> dan{' '}
                <strong>{unmigratedSummary.servicesCount} catatan layanan/pelanggaran</strong> tanpa identitas sekolah (Data Lama).
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl border border-[#00685f]/30 bg-[#e6f4f1]/50 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold text-[#0b1c30]">Migrasi Data Lama (1 Klik)</p>
                  <p className="text-[11px] text-[#3d4947] mt-0.5">
                    Tandai seluruh data lama tanpa schoolId (Siswa, Home Visit, Layanan, Kasus) ke sekolah ini.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowLegacyMigrationConfirm(true);
                    void handleLoadIdentityAudit();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-extrabold shrink-0 cursor-pointer"
                >
                  Migrasi Data
                </button>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 bg-white flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold text-[#0b1c30]">Perbaiki Identitas Data Lama</p>
                  <p className="text-[11px] text-[#3d4947] mt-0.5">
                    Lengkapi `schoolId` yang kosong pada cache lokal &amp; sinkronkan ke Firestore.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isMigratingData || isRestoringOriginal}
                  onClick={handleFixLegacyData}
                  className="px-3.5 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] disabled:opacity-60 text-white text-xs font-extrabold shrink-0 cursor-pointer"
                >
                  {isMigratingData ? 'Memperbaiki...' : 'Perbaiki Data'}
                </button>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 bg-white flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold text-[#0b1c30]">Kembalikan Data Asli</p>
                  <p className="text-[11px] text-[#3d4947] mt-0.5">
                    Pulihkan daftar siswa asli tanpa data contoh dari penyimpanan.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isRestoringOriginal || isMigratingData}
                  onClick={handleRestoreOriginalData}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold shrink-0 cursor-pointer"
                >
                  {isRestoringOriginal ? 'Memulihkan...' : 'Pulihkan Asli'}
                </button>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 bg-white flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold text-[#0b1c30]">Sinkron Preview ke Cloud</p>
                  <p className="text-[11px] text-[#3d4947] mt-0.5">
                    Kirim cadangan data sekolah aktif ke Cloud Firestore.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSyncingAulia}
                  onClick={handleSyncToAulia}
                  className="px-3.5 py-2 rounded-xl bg-[#0b1c30] hover:bg-[#18314f] disabled:opacity-60 text-white text-xs font-extrabold shrink-0 cursor-pointer"
                >
                  {isSyncingAulia ? 'Mengirim...' : 'Kirim Cloud'}
                </button>
              </div>
            </div>

            {hasDummyStudents && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <UserX className="w-5 h-5 text-amber-700 shrink-0" />
                  <div>
                    <p className="text-xs font-extrabold text-amber-950">Hapus Siswa Dummy</p>
                    <p className="text-[11px] text-amber-800">Bersihkan siswa contoh bawaan dari daftar aktif.</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isPurgingDummy}
                  onClick={handlePurgeDummy}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-extrabold shrink-0 cursor-pointer"
                >
                  {isPurgingDummy ? 'Menghapus...' : 'Bersihkan Dummy'}
                </button>
              </div>
            )}
          </div>

          {/* Impor Massal Excel / CSV & Cek Cadangan Browser */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Impor Siswa */}
            <form
              onSubmit={handleEmergencyImportSubmit}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-[#bcc9c6]/40 shadow-xs space-y-3"
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-[#00685f]" />
                <div>
                  <h3 className="text-sm font-extrabold text-[#0b1c30]">Impor Siswa (Excel / CSV)</h3>
                  <p className="text-[11px] text-[#3d4947]">Format: NISN, Nama Siswa, Kelas, Gender (L/P)</p>
                </div>
              </div>

              <label className="flex items-center justify-center gap-2 p-2.5 border-2 border-dashed border-[#bcc9c6] hover:border-[#00685f] rounded-xl cursor-pointer text-xs font-bold text-[#00685f] bg-[#f8faf9]">
                <Upload className="w-4 h-4" />
                <span>Pilih File (.csv / .txt)</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const txt = ev.target?.result as string;
                      if (txt) setImportText(txt);
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>

              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={4}
                placeholder="Tempel baris Excel / ketik: 21221001, Ahmad Fauzi, 7A, L"
                className="w-full bg-[#f8faf9] border border-gray-200 rounded-xl p-3 text-xs font-mono text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20"
              />

              {parsedImportStudents.length > 0 && (
                <p className="text-xs font-bold text-[#00685f]">
                  Terbaca {parsedImportStudents.filter((s) => !s.error).length} data valid dari {parsedImportStudents.length} baris.
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={parsedImportStudents.filter((s) => !s.error).length === 0}
                  className="px-4 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer"
                >
                  Impor ({parsedImportStudents.filter((s) => !s.error).length} Siswa)
                </button>
              </div>
            </form>

            {/* Cek Cadangan Lokal Browser */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#bcc9c6]/40 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-5 h-5 text-[#00685f]" />
                <div>
                  <h3 className="text-sm font-extrabold text-[#0b1c30]">Cek Cadangan Siswa di Browser</h3>
                  <p className="text-[11px] text-[#3d4947]">
                    Pindai sisa cache browser lama jika pernah menyimpan daftar siswa di perangkat ini.
                  </p>
                </div>
              </div>

              {backupScanResults.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {backupScanResults.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#f8faf9] rounded-xl border border-gray-200 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#0b1c30] truncate">
                          {item.label} ({item.count} Siswa)
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          Contoh: {item.sampleNames.join(', ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyRecoveredStudents(item.students, item.label)}
                        className="px-3 py-1.5 rounded-lg bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold shrink-0 cursor-pointer"
                      >
                        Pulihkan
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 p-4 bg-[#f8faf9] rounded-xl border border-dashed border-gray-300 text-center">
                  Tidak ditemukan cadangan siswa lokal terpisah di browser ini.
                </p>
              )}
            </div>
          </div>

          {/* Sampah / Riwayat Hapus */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#bcc9c6]/40 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <div>
                  <h3 className="text-base font-extrabold text-[#0b1c30]">Sampah &amp; Riwayat Hapus</h3>
                  <p className="text-xs text-[#3d4947]">
                    Pulihkan siswa, kasus, atau layanan yang terhapus, atau hapus permanen.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={loadTrashRecords}
                disabled={isLoadingTrash}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#0b1c30] flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTrash ? 'animate-spin' : ''}`} />
                <span>Muat Ulang</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(['Semua', 'Siswa', 'Kasus', 'Layanan', 'Lainnya'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTrashFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    trashFilter === cat
                      ? 'bg-[#00685f] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {isLoadingTrash ? (
              <div className="p-6 text-center text-xs text-gray-500 font-semibold">
                Memuat data Sampah / Riwayat Hapus...
              </div>
            ) : filteredTrashItems.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#f8faf9] border border-dashed border-gray-300 text-center space-y-1">
                <Trash2 className="w-6 h-6 text-gray-400 mx-auto" />
                <p className="text-xs font-bold text-[#0b1c30]">Sampah Kosong</p>
                <p className="text-[11px] text-gray-500">Tidak ada data terhapus pada kategori ini.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredTrashItems.map((item) => (
                  <div
                    key={`${item.colName}-${item.id}`}
                    className="p-3 rounded-xl border border-gray-200 bg-[#f8faf9] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-extrabold">
                          {item.entityType}
                        </span>
                        {item.kelas && (
                          <span className="px-2 py-0.5 rounded-md bg-teal-50 text-[#00685f] text-[10px] font-bold">
                            {item.kelas}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-extrabold text-[#0b1c30] break-words">{item.nama}</p>
                      <p className="text-[10px] text-gray-500">
                        Dihapus: {item.deletedAt} &bull; Oleh: {item.deletedBy}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={restoringItemId === item.id}
                        onClick={() => handleRestoreFromTrash(item)}
                        className="px-3 py-1.5 rounded-xl bg-[#00685f] hover:bg-[#005049] disabled:opacity-50 text-white text-[11px] font-bold cursor-pointer"
                      >
                        {restoringItemId === item.id ? 'Memulihkan...' : 'Pulihkan'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingPermanentDelete({ item, step: 1 })}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        Hapus Permanen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {trashLogs.length > 0 && (
              <div className="pt-3 border-t border-gray-100 space-y-1.5">
                <p className="text-[11px] font-extrabold text-[#3d4947] uppercase tracking-wider">
                  Log Audit Penghapusan Terakhir ({trashLogs.length})
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {trashLogs.slice(0, 15).map((log) => (
                    <div
                      key={log.id}
                      className="px-2.5 py-1.5 rounded-lg bg-[#f8faf9] border border-gray-200 text-[10px] text-[#3d4947] flex items-center justify-between gap-2"
                    >
                      <span className="truncate font-semibold">
                        [{log.entityType}] {log.nama} {log.kelas ? `(${log.kelas})` : ''}
                      </span>
                      <span className="text-gray-500 shrink-0">{log.tanggalHapus}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Zona Berbahaya: Kosongkan Siswa */}
          {onClearAllStudents && (
            <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-rose-950">Kosongkan Data Siswa (Reset 0 Siswa)</p>
                    <p className="text-xs text-rose-800">
                      Menghapus seluruh {liveStudents.length} siswa aktif jika ingin mulai ulang dari awal.
                    </p>
                  </div>
                </div>
                {!showWipeConfirmBox && (
                  <button
                    type="button"
                    disabled={liveStudents.length === 0}
                    onClick={() => setShowWipeConfirmBox(true)}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-extrabold shrink-0 cursor-pointer"
                  >
                    Kosongkan Siswa
                  </button>
                )}
              </div>

              {showWipeConfirmBox && (
                <div className="p-3.5 rounded-xl bg-white border border-rose-200 space-y-2.5">
                  <p className="text-xs font-bold text-rose-900">
                    Ketik <span className="font-mono bg-rose-100 px-1.5 py-0.5 rounded">HAPUS</span> untuk konfirmasi mengosongkan seluruh data siswa:
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={confirmWipeInput}
                      onChange={(e) => setConfirmWipeInput(e.target.value)}
                      placeholder="Ketik HAPUS"
                      className="flex-1 min-w-[160px] px-3 py-2 border border-rose-300 rounded-xl text-xs font-mono text-[#0b1c30]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowWipeConfirmBox(false);
                        setConfirmWipeInput('');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-gray-100 text-xs font-bold text-gray-700 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={confirmWipeInput.trim().toUpperCase() !== 'HAPUS'}
                      onClick={() => {
                        onClearAllStudents();
                        setShowWipeConfirmBox(false);
                        setConfirmWipeInput('');
                        setRepairStatusMsg('Database siswa telah dikosongkan (0 siswa).');
                        showToast('Database siswa dikosongkan.', 'success');
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer"
                    >
                      Hapus Permanen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: AUDIT & IDENTITAS SEKOLAH                                      */}
      {/* ===================================================================== */}
      {mainTab === 'audit' && (() => {
        const activeSchoolLabel = auditResult?.schoolName || getSchoolConfig().schoolName || 'SMP N 2 Susukan';
        const otherLabels = auditResult?.otherSchoolLabels || [];
        const otherSchoolLabelDisplay = otherLabels.length > 0 ? otherLabels.slice(0, 2).join(', ') : 'Sekolah Lain';

        return (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#bcc9c6]/40 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#e6f4f1] border border-[#00685f]/20 text-[#00685f] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-[#0b1c30]">Audit Identitas Sekolah</h2>
                    <p className="text-xs text-[#3d4947]">
                      Sekolah Aktif: <span className="font-extrabold text-[#00685f]">{activeSchoolLabel}</span> ({schoolId})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLoadIdentityAudit}
                  disabled={isAuditing}
                  className="px-3.5 py-2 rounded-xl bg-white border border-[#bcc9c6]/60 hover:bg-gray-50 text-xs font-extrabold text-[#0b1c30] flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
                  <span>{isAuditing ? 'Memindai...' : 'Pindai Ulang'}</span>
                </button>
              </div>

              {isAuditing && !auditResult ? (
                <p className="text-xs text-gray-500 py-4 text-center">Memindai data Firestore &amp; cache lokal...</p>
              ) : auditResult ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 text-xs font-bold text-[#0b1c30] tabular-nums leading-relaxed">
                    Total Dokumen: {auditResult.total} &bull; {activeSchoolLabel}:{' '}
                    <span className="text-[#00685f] font-black">{auditResult.ownedByCurrentSchool}</span> &bull;{' '}
                    {otherLabels.length > 0 ? otherSchoolLabelDisplay : 'Sekolah Lain'}:{' '}
                    <span className={auditResult.ownedByOtherSchool > 0 ? 'text-rose-700 font-black' : 'text-[#0b1c30]'}>
                      {auditResult.ownedByOtherSchool}
                    </span>{' '}
                    &bull; Tanpa schoolId:{' '}
                    <span className={auditResult.unassignedLegacy > 0 ? 'text-amber-700 font-black' : 'text-[#00685f]'}>
                      {auditResult.unassignedLegacy}
                    </span>{' '}
                    &bull; isDeleted:{' '}
                    <span className="text-gray-600 font-black">{auditResult.deletedCount ?? 0}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#00685f]/25 text-xs font-bold text-[#0b1c30] tabular-nums leading-relaxed">
                    Siswa {activeSchoolLabel}: <span className="text-[#00685f] font-black">{auditResult.studentBreakdown.currentSchool}</span> &bull; Siswa{' '}
                    {otherLabels.length > 0 ? otherSchoolLabelDisplay : 'Sekolah Lain'} (salah sekolah):{' '}
                    <span className={auditResult.studentBreakdown.otherSchool > 0 ? 'text-rose-700 font-black' : 'text-[#0b1c30]'}>
                      {auditResult.studentBreakdown.otherSchool}
                    </span>{' '}
                    &bull; Siswa tanpa schoolId (data lama):{' '}
                    <span className={auditResult.studentBreakdown.unassignedLegacy > 0 ? 'text-amber-700 font-black' : 'text-[#00685f]'}>
                      {auditResult.studentBreakdown.unassignedLegacy}
                    </span>
                  </div>

                  {auditResult.unassignedLegacy > 0 && (
                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 px-3.5 py-2.5 rounded-xl font-medium">
                      Rincian data lama tanpa identitas: Siswa ({auditResult.unassignedByCategory.students}), Home Visit ({auditResult.unassignedByCategory.homeVisits}), Konseling ({auditResult.unassignedByCategory.counseling}), Bimbingan ({auditResult.unassignedByCategory.bimbingan}), Pelanggaran ({auditResult.unassignedByCategory.violations}), Kasus ({auditResult.unassignedByCategory.cases}), Absensi ({auditResult.unassignedByCategory.attendance}), Lainnya ({auditResult.unassignedByCategory.others}).
                    </p>
                  )}

                  {identityMigrationResult && (
                    <div className="p-3 rounded-xl bg-[#e6f4f1] border border-[#00685f]/30 text-xs font-bold text-[#005049]">
                      {identityMigrationResult.message}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowUnassignedList((v) => !v)}
                      className="px-3.5 py-2 rounded-xl bg-white border border-[#00685f]/40 hover:bg-[#e6f4f1]/60 text-[#00685f] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>
                        {showUnassignedList
                          ? 'Sembunyikan Data Lama Tanpa Identitas'
                          : `Lihat Data Tanpa schoolId (${auditResult.unassignedLegacy})`}
                      </span>
                    </button>

                    {auditResult.unassignedLegacy > 0 && (
                      <>
                        <button
                          type="button"
                          disabled={isRunningIdentityMigration}
                          onClick={() => setShowLegacyMigrationConfirm(true)}
                          className="px-3.5 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer shadow-2xs"
                        >
                          {isRunningIdentityMigration ? 'Memigrasi...' : `Migrasi Data Lama ke ${activeSchoolLabel}`}
                        </button>
                        <button
                          type="button"
                          disabled={isRunningIdentityMigration}
                          onClick={() => setPendingClaimAllModal({ step: 1 })}
                          className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer shadow-2xs"
                        >
                          Tandai Semua Sebagai Milik Saya
                        </button>
                      </>
                    )}

                    {auditResult.ownedByOtherSchool > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowOtherSchoolList((v) => !v)}
                          className="px-3.5 py-2 rounded-xl bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>
                            {showOtherSchoolList
                              ? 'Sembunyikan Data Sekolah Lain'
                              : `Lihat Data Sekolah Lain (${auditResult.ownedByOtherSchool})`}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={isRelocatingAll}
                          onClick={() => setPendingRelocateModal({ step: 1, targetLabel: otherSchoolLabelDisplay })}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer shadow-2xs"
                        >
                          {isRelocatingAll ? 'Memindahkan...' : `Pindahkan Data ${otherSchoolLabelDisplay} ke ${activeSchoolLabel}`}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {showOtherSchoolList && auditResult && auditResult.otherSchoolItems.length > 0 && (
              <div className="space-y-2.5 p-4 rounded-2xl border border-rose-200 bg-rose-50/40">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-extrabold text-rose-900">
                    Daftar Data Sekolah Lain ({auditResult.otherSchoolItems.length})
                  </p>
                  <span className="text-[11px] font-bold text-rose-800 tabular-nums">
                    Halaman {Math.min(otherSchoolPage, otherSchoolTotalPages)} / {otherSchoolTotalPages}
                  </span>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {paginatedOtherSchoolItems.map((item) => (
                    <div
                      key={`other-${item.category}-${item.id}`}
                      className="p-3 rounded-xl border border-rose-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-extrabold">
                            {item.entityType}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {item.currentSchoolLabel}
                          </span>
                        </div>
                        <p className="text-xs font-extrabold text-[#0b1c30] break-words">{item.label}</p>
                        <p className="text-[11px] text-[#3d4947] break-words">{item.sublabel}</p>
                      </div>
                      <button
                        type="button"
                        disabled={relocatingSingleId === item.id || isRelocatingAll}
                        onClick={() => handleRelocateSingleOtherSchoolItem(item)}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                      >
                        {relocatingSingleId === item.id ? 'Memindahkan...' : `Pindahkan ke ${activeSchoolLabel}`}
                      </button>
                    </div>
                  ))}
                </div>
                {otherSchoolTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t border-rose-200/70">
                    <button
                      type="button"
                      disabled={otherSchoolPage <= 1}
                      onClick={() => setOtherSchoolPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-bold text-rose-900 disabled:opacity-40 cursor-pointer"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-[11px] font-bold text-rose-900 tabular-nums">
                      20 item/halaman &bull; Hal {Math.min(otherSchoolPage, otherSchoolTotalPages)} dari {otherSchoolTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={otherSchoolPage >= otherSchoolTotalPages}
                      onClick={() => setOtherSchoolPage((p) => Math.min(otherSchoolTotalPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-bold text-rose-900 disabled:opacity-40 cursor-pointer"
                    >
                      Berikutnya
                    </button>
                  </div>
                )}
              </div>
            )}

            {showUnassignedList && auditResult && (
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#bcc9c6]/40 shadow-xs space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(['Semua', 'Home Visit', 'Konseling', 'Bimbingan', 'Siswa', 'Pelanggaran', 'Kasus', 'Absensi', 'Lainnya'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setAuditCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        auditCategoryFilter === cat
                          ? 'bg-[#00685f] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {filteredUnassignedItems.length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 text-center">
                    Semua data pada kategori ini sudah memiliki identitas sekolah.
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {paginatedUnassignedItems.map((item) => (
                        <div
                          key={`${item.category}-${item.id}`}
                          className="p-3 rounded-xl border border-gray-200 bg-[#f8faf9] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                                {item.entityType}
                              </span>
                              {item.date && <span className="text-[10px] font-semibold text-gray-500">{item.date}</span>}
                            </div>
                            <p className="text-xs font-extrabold text-[#0b1c30] break-words">{item.label}</p>
                            <p className="text-[11px] text-[#3d4947] break-words">{item.sublabel}</p>
                          </div>
                          <button
                            type="button"
                            disabled={claimingSingleId === item.id || isRunningIdentityMigration}
                            onClick={() => handleClaimSingleLegacyItem(item.id, item.label)}
                            className="px-3 py-1.5 rounded-xl bg-[#00685f] hover:bg-[#005049] disabled:opacity-50 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                          >
                            {claimingSingleId === item.id ? 'Menyimpan...' : 'Tandai Milik Sekolah Saya'}
                          </button>
                        </div>
                      ))}
                    </div>
                    {unassignedTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <button
                          type="button"
                          disabled={unassignedPage <= 1}
                          onClick={() => setUnassignedPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-xs font-bold text-[#0b1c30] disabled:opacity-40 cursor-pointer"
                        >
                          Sebelumnya
                        </button>
                        <span className="text-[11px] font-bold text-[#3d4947] tabular-nums">
                          20 item/halaman &bull; Hal {Math.min(unassignedPage, unassignedTotalPages)} dari {unassignedTotalPages} ({filteredUnassignedItems.length} total)
                        </span>
                        <button
                          type="button"
                          disabled={unassignedPage >= unassignedTotalPages}
                          onClick={() => setUnassignedPage((p) => Math.min(unassignedTotalPages, p + 1))}
                          className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-xs font-bold text-[#0b1c30] disabled:opacity-40 cursor-pointer"
                        >
                          Berikutnya
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* MODALS (Replace YA, Permanent Delete 2x, Migration Confirms)          */}
      {/* ===================================================================== */}
      {showReplaceConfirmModal && (
        <div className="fixed inset-0 z-[1100] bg-[#0b1c30]/65 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-red-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-700 bg-red-50 px-2 py-0.5 rounded-md">
                    Konfirmasi Keamanan
                  </span>
                  <h3 className="text-lg font-extrabold text-[#0b1c30] mt-1">Ganti Total Semua Data?</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReplaceConfirmModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#3d4947] leading-relaxed">
              Tindakan ini akan <strong className="text-red-700">menghapus/mengganti semua data lama</strong> di aplikasi &amp; Cloud Firestore dengan isi file <strong className="text-[#0b1c30]">{selectedFileName}</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-[#0b1c30]">
                Ketik <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-mono">YA</span> untuk konfirmasi:
              </label>
              <input
                type="text"
                value={confirmYaInput}
                onChange={(e) => setConfirmYaInput(e.target.value)}
                placeholder="Ketik YA"
                className="w-full px-3.5 py-2.5 rounded-xl border border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-bold text-[#0b1c30]"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowReplaceConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#3d4947] hover:bg-gray-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={confirmYaInput.trim().toUpperCase() !== 'YA' || isRestoring}
                onClick={() => void executeRestore('replace')}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs sm:text-sm font-extrabold cursor-pointer shadow-xs"
              >
                Ya, Ganti Total Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingPermanentDelete && (
        <div className="fixed inset-0 z-[1100] bg-[#0b1c30]/70 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-rose-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0b1c30]">
                  {pendingPermanentDelete.step === 1 ? 'Hapus Permanen (Langkah 1/2)' : 'Konfirmasi Final (Langkah 2/2)'}
                </h3>
                <p className="text-xs text-[#3d4947] mt-1 leading-relaxed">
                  {pendingPermanentDelete.step === 1
                    ? 'Hapus permanen? Tidak bisa dikembalikan lagi.'
                    : `Anda benar-benar yakin menghapus permanen "${pendingPermanentDelete.item.nama}"? Data akan dihapus total dari Firestore.`}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isPermanentDeleting}
                onClick={() => setPendingPermanentDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPermanentDeleting}
                onClick={handleConfirmPermanentDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                {isPermanentDeleting
                  ? 'Menghapus...'
                  : pendingPermanentDelete.step === 1
                  ? 'Ya, Lanjutkan'
                  : 'Ya, Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLegacyMigrationConfirm && (
        <div className="fixed inset-0 z-[1100] bg-[#0b1c30]/70 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-[#bcc9c6]/50 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#e6f4f1] text-[#00685f] flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-[#0b1c30]">Konfirmasi Migrasi Data Lama</h3>
                <p className="text-xs text-[#3d4947] leading-relaxed">
                  Proses ini hanya menandai data lama yang <strong>belum memiliki schoolId / sekolahId</strong> agar menjadi milik{' '}
                  <strong>{getSchoolConfig().schoolName}</strong>. Data yang sudah punya <code className="font-mono">schoolId</code> lain tidak akan diubah.
                </p>
                {auditResult && (
                  <p className="text-[11px] font-bold text-[#00685f] pt-1">
                    Terdeteksi {auditResult.unassignedLegacy} data lama tanpa identitas (Siswa: {auditResult.unassignedByCategory.students}, Home Visit: {auditResult.unassignedByCategory.homeVisits}, Konseling: {auditResult.unassignedByCategory.counseling}, Bimbingan: {auditResult.unassignedByCategory.bimbingan}, Pelanggaran: {auditResult.unassignedByCategory.violations}, Kasus: {auditResult.unassignedByCategory.cases}).
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isRunningIdentityMigration}
                onClick={() => setShowLegacyMigrationConfirm(false)}
                className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isRunningIdentityMigration}
                onClick={handleConfirmRunLegacyMigration}
                className="px-4 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
              >
                {isRunningIdentityMigration ? 'Memigrasi Data...' : 'Saya Paham, Migrasi Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingClaimAllModal && (
        <div className="fixed inset-0 z-[1100] bg-[#0b1c30]/70 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-[#bcc9c6]/50 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0b1c30]">
                  {pendingClaimAllModal.step === 1 ? 'Tandai Semua Data Lama (1/2)' : 'Konfirmasi Final Migrasi (2/2)'}
                </h3>
                <p className="text-xs text-[#3d4947] mt-1 leading-relaxed">
                  {pendingClaimAllModal.step === 1
                    ? `Tandai seluruh ${auditResult?.unassignedLegacy || 0} data lama tanpa identitas sebagai milik sekolah ini? Data milik sekolah lain tetap aman dan tidak diubah.`
                    : `Anda yakin menandai semua data lama tanpa schoolId menjadi milik "${auditResult?.schoolName || getSchoolConfig().schoolName}" sekarang?`}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingClaimAllModal(null)}
                className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmClaimAllStep}
                className="px-4 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-extrabold cursor-pointer"
              >
                {pendingClaimAllModal.step === 1 ? 'Ya, Lanjutkan' : 'Saya Paham, Migrasi Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingRelocateModal && (
        <div className="fixed inset-0 z-[1100] bg-[#0b1c30]/70 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-rose-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0b1c30]">
                  {pendingRelocateModal.step === 1 ? 'Pindahkan Data Sekolah Lain (1/2)' : 'Konfirmasi Pemindahan Data (2/2)'}
                </h3>
                <p className="text-xs text-[#3d4947] mt-1 leading-relaxed">
                  {pendingRelocateModal.step === 1
                    ? `Anda akan memindahkan ${auditResult?.ownedByOtherSchool || 0} data (${pendingRelocateModal.targetLabel}) agar tercatat sebagai milik "${auditResult?.schoolName || getSchoolConfig().schoolName}".`
                    : `Konfirmasi terakhir: pindahkan semua ${auditResult?.ownedByOtherSchool || 0} data dari ${pendingRelocateModal.targetLabel} ke "${auditResult?.schoolName || getSchoolConfig().schoolName}" sekarang?`}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRelocateModal(null)}
                className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmRelocateAllStep}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer"
              >
                {pendingRelocateModal.step === 1 ? 'Ya, Lanjutkan' : 'Ya, Pindahkan Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
