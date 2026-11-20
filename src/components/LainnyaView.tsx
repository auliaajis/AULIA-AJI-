import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  FileText, 
  Columns3, 
  Share2, 
  UserCheck, 
  Settings, 
  Database, 
  Award, 
  BookOpen, 
  HelpCircle, 
  ChevronRight,
  LogOut,
  Bot,
  Mail,
  ClipboardCheck,
  BellRing,
  Wrench,
  CheckCircle2,
  RefreshCw,
  X,
  Lock,
  AlertTriangle,
  FileSpreadsheet,
  RotateCcw,
  Cloud,
  Trash2,
  Upload,
  UserX,
  ShieldCheck,
  Eye
} from 'lucide-react';
import { Counselor, CounselingService, Student, ViolationRecord, HapusLogEntry } from '../types';
import { fixMissingSchoolId, mergeAuthenticStudentsPool, restoreOriginalUserData } from '../utils/multiSchoolMigration';
import { getActiveSchoolId, getSchoolConfig, hasConfiguredSchool, saveSchoolData } from '../utils/schoolConfig';
import {
  auditSchoolIdentity,
  migrateLegacyUnassignedData,
  relocateOtherSchoolDataToCurrentSchool,
  SchoolIdentityAuditResult,
  MigrationSummaryResult,
  IdentityAuditCategory,
  OtherSchoolAuditItem
} from '../utils/schoolIdentityMigration';
import {
  saveBulkToFirestore,
  syncPreviewDataToAuliaAccount,
  fetchSoftDeletedRecordsFromFirestore,
  restoreSoftDeletedFromFirestore,
  permanentDeleteFromFirestore,
  SoftDeletedTrashItem
} from '../utils/firestoreSync';
import { getDeletedIds } from '../utils/deletionTracker';
import { isDummyStudent, purgeDummyStudents } from '../utils/purgeDummyData';
import { showToast } from '../utils/toast';
import PanduanBskap2022Modal from './PanduanBskap2022Modal';
import UserManualModal from './UserManualModal';
import ErrorBoundary from './ErrorBoundary';

interface LainnyaViewProps {
  onNavigate: (view: string) => void;
  activeCounselor?: Counselor;
  onLogout?: () => void;
  students?: Student[];
  violations?: ViolationRecord[];
  services?: CounselingService[];
  onClearAllStudents?: () => void;
  onAddStudent?: (student: Omit<Student, 'id' | 'initials'>) => void;
}

export const LainnyaView: React.FC<LainnyaViewProps> = ({
  onNavigate,
  activeCounselor,
  onLogout,
  students = [],
  violations = [],
  services = [],
  onClearAllStudents,
  onAddStudent,
}) => {
  const [showBskapModal, setShowBskapModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAlihTanganModal, setShowAlihTanganModal] = useState(false);
  const [showPilarModal, setShowPilarModal] = useState(false);
  const [showPerbaikanDataModal, setShowPerbaikanDataModal] = useState(false);
  const [isMigratingData, setIsMigratingData] = useState(false);
  const [isRestoringData, setIsRestoringData] = useState(false);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);

  // Kelola Data Siswa - Darurat (Terkunci dengan peringatan dulu)
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyUnlocked, setEmergencyUnlocked] = useState(false);
  const [emergencyTab, setEmergencyTab] = useState<'tools' | 'audit' | 'trash' | 'import' | 'backup'>('tools');
  const [emergencyStatusMsg, setEmergencyStatusMsg] = useState<string | null>(null);
  const [isSyncingAulia, setIsSyncingAulia] = useState(false);
  const [isPurgingDummy, setIsPurgingDummy] = useState(false);
  const [confirmWipeInput, setConfirmWipeInput] = useState('');
  const [showWipeConfirmBox, setShowWipeConfirmBox] = useState(false);
  const [importText, setImportText] = useState('');
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

  // Audit Identitas Sekolah & Migrasi Data Lama Manual
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
  const [isRunningLegacyMigration, setIsRunningLegacyMigration] = useState(false);
  const [legacyMigrationResult, setLegacyMigrationResult] = useState<MigrationSummaryResult | null>(null);
  const [claimingSingleId, setClaimingSingleId] = useState<string | null>(null);
  const [relocatingSingleId, setRelocatingSingleId] = useState<string | null>(null);
  const [isRelocatingAll, setIsRelocatingAll] = useState(false);
  const [pendingClaimAllModal, setPendingClaimAllModal] = useState<{ step: 1 | 2 } | null>(null);
  const [pendingRelocateModal, setPendingRelocateModal] = useState<{ step: 1 | 2; targetLabel: string } | null>(null);
  const [backupScanResults, setBackupScanResults] = useState<{
    key: string;
    label: string;
    count: number;
    sampleNames: string[];
    students: Student[];
  }[]>([]);

  const hasDummyStudents = useMemo(() => students.some(isDummyStudent), [students]);

  const unmigratedSummary = useMemo(() => {
    const unmigratedStudents = students.filter((s) => (s as any).isLegacyUnmigrated || !s.schoolId).length;
    const unmigratedViolations = violations.filter((v) => (v as any).isLegacyUnmigrated || !v.schoolId).length;
    const unmigratedServices = services.filter((s) => (s as any).isLegacyUnmigrated || !s.schoolId).length;
    return {
      studentsCount: unmigratedStudents,
      servicesCount: unmigratedViolations + unmigratedServices,
      total: unmigratedStudents + unmigratedViolations + unmigratedServices,
    };
  }, [students, violations, services]);

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
    if (showEmergencyModal && emergencyUnlocked && emergencyTab === 'audit') {
      const openKey = `${activeCounselor?.schoolId || getActiveSchoolId()}-audit`;
      if (lastAuditScanKeyRef.current !== openKey) {
        lastAuditScanKeyRef.current = openKey;
        void handleLoadIdentityAudit();
      }
    } else if (!showEmergencyModal) {
      lastAuditScanKeyRef.current = '';
    }
  }, [showEmergencyModal, emergencyUnlocked, emergencyTab]);

  useEffect(() => {
    setUnassignedPage(1);
  }, [auditCategoryFilter]);

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
    setIsRunningLegacyMigration(true);
    try {
      const res = await migrateLegacyUnassignedData(activeCounselor);
      setLegacyMigrationResult(res);
      setMigrationNotice(res.message);
      setEmergencyStatusMsg(res.message);
      showToast(res.message, res.success ? 'success' : 'error');
      setShowLegacyMigrationConfirm(false);
      await handleLoadIdentityAudit();
    } catch (err: any) {
      const errMsg = `Gagal migrasi data lama: ${err?.message || 'Terjadi kesalahan'}`;
      setMigrationNotice(errMsg);
      setEmergencyStatusMsg(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsRunningLegacyMigration(false);
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
      setLegacyMigrationResult(res);
      setEmergencyStatusMsg(`"${label}" ditandai sebagai milik sekolah Anda.`);
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
      setLegacyMigrationResult(res);
      setEmergencyStatusMsg(res.message);
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
      setLegacyMigrationResult(res);
      setMigrationNotice(res.message);
      setEmergencyStatusMsg(res.message);
      showToast(res.message, res.success ? 'success' : 'error');
      await handleLoadIdentityAudit();
    } catch (err: any) {
      const errMsg = `Gagal memindahkan data sekolah lain: ${err?.message || err}`;
      setEmergencyStatusMsg(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsRelocatingAll(false);
    }
  };

  const handleFixLegacyData = async () => {
    setIsMigratingData(true);
    try {
      const res = await fixMissingSchoolId(activeCounselor);
      setMigrationNotice(res.message);
      showToast(res.message, res.success ? 'success' : 'error');
    } catch (err: any) {
      const errMsg = `Gagal memperbaiki data: ${err?.message || 'Terjadi kesalahan sistem'}`;
      setMigrationNotice(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsMigratingData(false);
    }
  };

  const handleRestoreOriginalData = async () => {
    setIsRestoringData(true);
    try {
      const res = await restoreOriginalUserData(activeCounselor?.schoolId);
      setMigrationNotice(res.message);
      setEmergencyStatusMsg(res.message);
      showToast(res.message, res.success ? 'success' : 'error');
    } catch (err: any) {
      const errMsg = `Gagal memulihkan data: ${err?.message || 'Terjadi kesalahan sistem'}`;
      setMigrationNotice(errMsg);
      setEmergencyStatusMsg(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsRestoringData(false);
    }
  };

  const handleSyncToAulia = async () => {
    setIsSyncingAulia(true);
    try {
      const res = await syncPreviewDataToAuliaAccount();
      if (res.success) {
        const msg = `Berhasil sinkronisasi ke Cloud (${res.counts.students} siswa, ${res.counts.violations} pelanggaran, ${res.counts.services} layanan).`;
        setEmergencyStatusMsg(msg);
        showToast(msg, 'success');
      } else {
        const msg = `Sinkronisasi gagal: ${res.error || 'Terjadi kendala'}`;
        setEmergencyStatusMsg(msg);
        showToast(msg, 'error');
      }
    } catch (err: any) {
      const msg = `Gagal sinkronisasi: ${err?.message || 'Periksa koneksi'}`;
      setEmergencyStatusMsg(msg);
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
      setEmergencyStatusMsg(msg);
      showToast(msg, 'success');
    } catch (err: any) {
      const msg = `Gagal membersihkan siswa dummy: ${err?.message || err}`;
      setEmergencyStatusMsg(msg);
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
    if (showEmergencyModal && emergencyUnlocked && emergencyTab === 'trash') {
      loadTrashRecords();
    }
  }, [showEmergencyModal, emergencyUnlocked, emergencyTab]);

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
      setEmergencyStatusMsg(msg);
      showToast(msg, 'success');
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
      setEmergencyStatusMsg(`Data "${item.nama}" dihapus permanen.`);
      showToast('Data dihapus permanen', 'success');
    } catch (err: any) {
      showToast(`Gagal menghapus permanen: ${err?.message || err}`, 'error');
    } finally {
      setIsPermanentDeleting(false);
    }
  };

  useEffect(() => {
    if (!showEmergencyModal || !emergencyUnlocked || emergencyTab !== 'backup' || typeof localStorage === 'undefined') {
      return;
    }
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
  }, [showEmergencyModal, emergencyUnlocked, emergencyTab]);

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
    setEmergencyStatusMsg(msg);
    showToast(msg, 'success');
  };

  const handleJSONBackupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const stList: Student[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.students) ? parsed.students : [];
        if (stList.length === 0) {
          showToast('Format berkas cadangan tidak sesuai atau tidak berisi data siswa.', 'error');
          return;
        }
        handleApplyRecoveredStudents(stList, file.name);
      } catch (err) {
        showToast('Gagal membaca berkas cadangan: ' + (err as Error).message, 'error');
      }
    };
    reader.readAsText(file);
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
    setEmergencyStatusMsg(msg);
    showToast(msg, 'success');
    setImportText('');
    setEmergencyTab('tools');
  };

  // Grouped Menu Items as required:
  // "Program Tahunan, RPL, Pilar 1-4, Sosiometri Lanjutan, Alih Tangan Kasus, Pengaturan, Backup Data"
  const administrasiItems = [
    {
      id: 'si-becik',
      title: 'Si Becik (Asisten AI BK)',
      desc: 'Konsultasi teknik konseling, rapikan laporan, & buat RPL (tetap bisa dibuka saat tombol melayang OFF)',
      icon: <Bot className="w-5 h-5 text-[#1A5C4A]" />,
      tag: 'Asisten AI',
      action: () => onNavigate('si-becik'),
    },
    {
      id: 'evaluasi-program',
      title: 'Evaluasi Layanan & Program BK',
      desc: '2 jalur sejajar mandiri: Evaluasi per Sesi Layanan dan Evaluasi Program BK per Bidang & Periode',
      icon: <ClipboardCheck className="w-5 h-5 text-[#00685f]" />,
      tag: 'Evaluasi',
      action: () => onNavigate('evaluasi-program'),
    },
    {
      id: 'prota',
      title: 'Program Tahunan (Prota)',
      desc: 'Rencana kerja operasional bimbingan konseling tahunan & semester',
      icon: <Calendar className="w-5 h-5 text-teal-600" />,
      tag: 'Perencanaan',
      action: () => onNavigate('laporan-rekap'),
    },
    {
      id: 'rpl',
      title: 'RPL (Rencana Pelaksanaan Layanan)',
      desc: 'Format RPL 1 Lembar Kurikulum Merdeka untuk bimbingan klasikal & kelompok',
      icon: <FileText className="w-5 h-5 text-blue-600" />,
      tag: 'RPL BK',
      action: () => onNavigate('studio-pdf'),
    },
    {
      id: 'pilar',
      title: 'Pilar 1-4 Bimbingan Konseling',
      desc: 'Layanan Dasar, Perencanaan Individual, Konseling, & Dukungan Sistem',
      icon: <Columns3 className="w-5 h-5 text-indigo-600" />,
      tag: 'Komprehensif',
      action: () => setShowPilarModal(true),
    },
    {
      id: 'sosiometri',
      title: 'Sosiometri Lanjutan',
      desc: 'Pemetaan hubungan pertemanan, dinamika sosial siswa, & sosiogram kelas',
      icon: <Share2 className="w-5 h-5 text-purple-600" />,
      tag: 'Asesmen',
      action: () => onNavigate('asesmen-bk'),
    },
    {
      id: 'panggilan-ortu',
      title: 'Surat Panggilan Orang Tua',
      desc: 'Pembuatan surat undangan pemanggilan resmi, berita acara kehadiran, & arsip tanda tangan',
      icon: <Mail className="w-5 h-5 text-rose-600" />,
      tag: 'Undangan',
      action: () => onNavigate('panggilan-ortu'),
    },
    {
      id: 'alih-tangan',
      title: 'Alih Tangan Kasus (Referral)',
      desc: 'Rujukan kasus ke pihak ahli eksternal (Psikolog, Puskesmas, Dokter, dll)',
      icon: <UserCheck className="w-5 h-5 text-purple-600" />,
      tag: 'Rujukan',
      action: () => setShowAlihTanganModal(true),
    },
    {
      id: 'peringatan',
      title: 'Peringatan & Tindak Lanjut',
      desc: 'Daftar lengkap pengingat restitusi, layanan belum dievaluasi, dan follow-up 14 hari',
      icon: <BellRing className="w-5 h-5 text-amber-600" />,
      tag: 'Pantau',
      action: () => onNavigate('peringatan'),
    },
    {
      id: 'backup-restore',
      title: 'Backup & Restore',
      desc: 'Backup lengkap semua data (.json, CSV, Excel, PDF), restore aman, & sinkron ke Firebase Cloud',
      icon: <Database className="w-5 h-5 text-[#00685f]" />,
      tag: 'Backup & Cloud',
      action: () => onNavigate('backup-restore'),
    },
    {
      id: 'backup',
      title: 'Backup Data & Cloud Drive',
      desc: 'Sinkronisasi Google Drive/Sheets, ekspor Excel, & proteksi arsip PDF',
      icon: <Cloud className="w-5 h-5 text-emerald-600" />,
      tag: 'Google Sync',
      action: () => onNavigate('google-sync'),
    },
    {
      id: 'perbaikan-data',
      title: 'Perbaikan Data',
      desc: 'Pemulihan & sinkronisasi data lama sekolah (hanya dijalankan manual jika diperlukan)',
      icon: <Wrench className="w-5 h-5 text-teal-700" />,
      tag: 'Pemeliharaan',
      action: () => setShowPerbaikanDataModal(true),
    },
    {
      id: 'audit-identitas',
      title: 'Audit Identitas Sekolah',
      desc: 'Periksa jumlah data milik sekolah, data lama tanpa schoolId, & migrasi manual 1 klik',
      icon: <ShieldCheck className="w-5 h-5 text-[#00685f]" />,
      tag: 'Identitas',
      action: () => {
        setEmergencyUnlocked(true);
        setEmergencyTab('audit');
        setShowUnassignedList(false);
        setShowWipeConfirmBox(false);
        setConfirmWipeInput('');
        setEmergencyStatusMsg(null);
        setShowEmergencyModal(true);
      },
    },
    {
      id: 'kelola-siswa-darurat',
      title: 'Kelola Data Siswa - Darurat',
      desc: 'Terkunci: Impor massal Excel/CSV, cek cadangan, kembalikan data asli, sinkron Cloud, & kosongkan siswa',
      icon: <Lock className="w-5 h-5 text-amber-700" />,
      tag: 'Terkunci',
      action: () => {
        setEmergencyUnlocked(false);
        setEmergencyTab('tools');
        setShowWipeConfirmBox(false);
        setConfirmWipeInput('');
        setEmergencyStatusMsg(null);
        setShowEmergencyModal(true);
      },
    },
    {
      id: 'pengaturan',
      title: 'Pengaturan',
      desc: 'Profil Guru BK, penetapan rombel kelas asuhan, dan konfigurasi sekolah',
      icon: <Settings className="w-5 h-5 text-slate-700" />,
      tag: 'Sistem',
      action: () => onNavigate('pengaturan'),
    },
  ];

  const alatBantuItems = [
    {
      id: 'apresiasi',
      title: 'Apresiasi & Prestasi Siswa',
      desc: 'Pencatatan penghargaan karakter baik, bakat, minat, & prestasi siswa',
      icon: <Award className="w-5 h-5 text-amber-600" />,
      action: () => onNavigate('apresiasi'),
    },
    {
      id: 'jurnal',
      title: 'Jurnal Harian Guru BK',
      desc: 'Buku catatan harian kegiatan bimbingan siap cetak untuk pengawas sekolah',
      icon: <FileText className="w-5 h-5 text-teal-600" />,
      action: () => onNavigate('jurnal-harian'),
    },
    {
      id: 'panduan-bskap',
      title: 'Buku Panduan Resmi BK (BSKAP 2022)',
      desc: 'Regulasi resmi Kemendikbudristek & panduan pencegahan kekerasan PPKSP',
      icon: <BookOpen className="w-5 h-5 text-sky-600" />,
      action: () => setShowBskapModal(true),
    },
    {
      id: 'manual',
      title: 'Petunjuk Penggunaan Aplikasi',
      desc: 'Panduan langkah demi langkah penggunaan seluruh fitur aplikasi SIKAP-BK',
      icon: <HelpCircle className="w-5 h-5 text-violet-600" />,
      action: () => setShowManualModal(true),
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-[100px]">
      {/* Tombol Kembali yang Jelas */}
      <div>
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-[#00685f] border border-[#bcc9c6]/50 rounded-xl text-sm font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Kembali ke Beranda</span>
        </button>
      </div>

      {/* Judul Halaman Besar di Atas */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-[#00685f]/10 px-2.5 py-0.5 rounded-md border border-[#00685f]/15">
            Administrasi & Perangkat BK
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0b1c30] mt-1 tracking-tight">
            Menu Lainnya
          </h1>
          <p className="text-xs sm:text-sm text-[#3d4947] mt-1 font-medium">
            Program tahunan, instrumen asesmen sosiometri, RPL, rujukan kasus, hingga cadangan data.
          </p>
        </div>

        {activeCounselor && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 self-start sm:self-auto shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#00685f] text-white flex items-center justify-center font-bold text-sm">
              {activeCounselor.name ? activeCounselor.name.charAt(0) : 'G'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-[#0b1c30] truncate">{activeCounselor.name}</p>
              <p className="text-[11px] text-gray-500 truncate">{activeCounselor.role || 'Guru BK'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bagian 1: Administrasi Inti Bimbingan Konseling */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00685f]" />
          <h2 className="text-sm font-black text-[#0b1c30] uppercase tracking-wider">
            Perangkat & Administrasi BK
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {administrasiItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className="flex items-start gap-4 p-4 bg-white hover:bg-[#e6f4f1]/50 border border-[#bcc9c6]/40 hover:border-[#00685f]/50 rounded-2xl text-left transition-all cursor-pointer group active:scale-98 shadow-2xs"
            >
              <div className="p-3 rounded-xl bg-gray-50 group-hover:bg-[#00685f]/10 transition-colors border border-gray-200/60 shrink-0">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-[#0b1c30] group-hover:text-[#00685f] transition-colors leading-snug">
                    {item.title}
                  </h3>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 shrink-0">
                    {item.tag}
                  </span>
                </div>
                <p className="text-xs text-[#3d4947] opacity-80 mt-1 line-clamp-2 leading-relaxed">
                  {item.desc}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#00685f] group-hover:translate-x-0.5 transition-all shrink-0 mt-3" />
            </button>
          ))}
        </div>
      </div>

      {/* Bagian 2: Alat Bantu & Referensi Resmi */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 px-1">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
          <h2 className="text-sm font-black text-[#0b1c30] uppercase tracking-wider">
            Alat Bantu & Referensi Guru
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {alatBantuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className="flex items-start gap-3.5 p-4 bg-white hover:bg-blue-50/50 border border-[#bcc9c6]/40 hover:border-blue-400/50 rounded-2xl text-left transition-all cursor-pointer group active:scale-98 shadow-2xs"
            >
              <div className="p-2.5 rounded-xl bg-gray-50 group-hover:bg-blue-100 transition-colors border border-gray-200/60 shrink-0">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-[#0b1c30] group-hover:text-blue-700 transition-colors leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-[#3d4947] opacity-80 mt-1 line-clamp-2 leading-relaxed">
                  {item.desc}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-2" />
            </button>
          ))}
        </div>
      </div>

      {/* Bagian 3: Sesi Akun & Ganti Akun */}
      {onLogout && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-between gap-4 p-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl text-left transition-all cursor-pointer active:scale-99 shadow-2xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-2.5 rounded-xl bg-white text-rose-600 border border-rose-200 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-rose-900">Keluar / Ganti Akun</h3>
                <p className="text-xs text-rose-700 mt-0.5">
                  Keluar dari sesi aktif untuk masuk menggunakan akun Guru BK atau sekolah lainnya.
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-rose-500 shrink-0" />
          </button>
        </div>
      )}

      {/* Modal Alih Tangan Kasus */}
      {showAlihTanganModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0b1c30]">Alih Tangan Kasus (Referral)</h3>
                  <p className="text-xs text-gray-500">Prosedur rujukan kasus siswa ke pihak ahli</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAlihTanganModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-[#3d4947] space-y-3 leading-relaxed">
              <p>
                <strong>Kapan Alih Tangan Kasus dilakukan?</strong><br />
                Dilakukan saat masalah siswa berada di luar kewenangan guru BK, seperti gangguan klinis/kejiwaan berat, kecanduan narkoba, kekerasan seksual/hukum, atau penyakit fisik kronis.
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                <p className="font-bold text-amber-900">Alur Standar Referral:</p>
                <ol className="list-decimal pl-4 space-y-0.5 text-amber-800">
                  <li>Konsultasi dengan Kepala Sekolah & orang tua/wali.</li>
                  <li>Pembuatan Surat Pengantar / Berita Acara Alih Tangan.</li>
                  <li>Pemberian rujukan ke Lembaga Ahli (Psikolog/Puskesmas/Dinsos).</li>
                  <li>Pemantauan berkala (follow-up) perkembangan siswa di sekolah.</li>
                </ol>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAlihTanganModal(false);
                  onNavigate('layanan-bk');
                }}
                className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
              >
                Buka Format Surat Rujukan di Layanan BK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4 Pilar BK */}
      {showPilarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <Columns3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0b1c30]">4 Pilar Bimbingan Konseling Komprehensif</h3>
                  <p className="text-xs text-gray-500">Struktur program resmi Kemendikbudristek & POP BK</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPilarModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 space-y-1">
                <p className="font-black text-teal-900 text-sm">1. Layanan Dasar</p>
                <p className="text-teal-800 leading-relaxed">
                  Bimbingan klasikal tatap muka di kelas, bimbingan kelompok, serta papan bimbingan untuk seluruh siswa tanpa terkecuali.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                <p className="font-black text-blue-900 text-sm">2. Perencanaan Individual</p>
                <p className="text-blue-800 leading-relaxed">
                  Membantu siswa merencanakan masa depan, studi lanjut ke SMA/SMK, asesmen minat bakat, dan pemilihan karir.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                <p className="font-black text-rose-900 text-sm">3. Layanan Responsif</p>
                <p className="text-rose-800 leading-relaxed">
                  Konseling individual, mediasi masalah teman sebaya, home visit, pemanggilan ortu, serta penanganan kasus darurat.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 space-y-1">
                <p className="font-black text-purple-900 text-sm">4. Dukungan Sistem</p>
                <p className="text-purple-800 leading-relaxed">
                  Pengembangan keprofesian berkelanjutan, manajemen prota/prosem, riset sosiometri, dan kolaborasi pihak sekolah.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPilarModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Perbaikan Data (Tersembunyi default, hanya muncul saat menu Perbaikan Data diklik) */}
      {showPerbaikanDataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#e6f4f1] text-[#00685f]">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0b1c30]">
                    Pemulihan &amp; Sinkronisasi Data Lama Sekolah
                  </h3>
                  <p className="text-xs text-gray-500">
                    Menu pemeliharaan manual &bull; {students.length} Siswa Terverifikasi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPerbaikanDataModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 cursor-pointer"
                aria-label="Tutup modal perbaikan data"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 space-y-2 text-xs text-[#3d4947]">
              <div className="flex items-center gap-2 flex-wrap">
                {unmigratedSummary.total > 0 ? (
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black rounded-full uppercase tracking-wider">
                    {unmigratedSummary.total} Data Perlu Migrasi
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-teal-100 text-[#00685f] border border-teal-200 text-[10px] font-black rounded-full uppercase tracking-wider">
                    {students.length} Siswa Terverifikasi
                  </span>
                )}
              </div>
              <p className="leading-relaxed">
                Mengisi field <code className="font-mono bg-teal-100/70 px-1 py-0.5 rounded text-[11px]">schoolId</code> &amp;{' '}
                <code className="font-mono bg-teal-100/70 px-1 py-0.5 rounded text-[11px]">schoolName</code> pada dokumen lama siswa,
                kasus, dan layanan tanpa mengubah isi data atau menduplikasi dokumen.
              </p>
              {migrationNotice && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#00685f] text-white text-xs font-bold shadow-xs leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
                  <span>{migrationNotice}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPerbaikanDataModal(false);
                  setShowLegacyMigrationConfirm(true);
                  void handleLoadIdentityAudit();
                }}
                disabled={isRestoringData || isMigratingData || isRunningLegacyMigration}
                className="px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Database className="w-4 h-4" />
                <span>Migrasi Data Lama</span>
              </button>

              <button
                type="button"
                onClick={handleRestoreOriginalData}
                disabled={isRestoringData || isMigratingData}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className={`w-4 h-4 ${isRestoringData ? 'animate-spin' : ''}`} />
                <span>{isRestoringData ? 'Memulihkan Data...' : 'Kembalikan Data Asli Saya'}</span>
              </button>

              <button
                type="button"
                onClick={handleFixLegacyData}
                disabled={isMigratingData || isRestoringData}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${isMigratingData ? 'animate-spin' : ''}`} />
                <span>{isMigratingData ? 'Memperbaiki...' : 'Perbaiki Data Lama'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Kelola Data Siswa - Darurat (Dengan Kunci Peringatan & Isolasi ErrorBoundary) */}
      {showEmergencyModal && (
        <ErrorBoundary
          moduleName="Audit"
          onHideModule={() => {
            setShowEmergencyModal(false);
            onNavigate('data-siswa');
          }}
          onNavigateHome={() => {
            setShowEmergencyModal(false);
            onNavigate('dashboard');
          }}
        >
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  {emergencyUnlocked ? <AlertTriangle className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0b1c30]">
                    Kelola Data Siswa - Darurat
                  </h3>
                  <p className="text-xs text-gray-500">
                    {emergencyUnlocked
                      ? `Alat administrasi & pemulihan • ${students.length} Siswa aktif`
                      : 'Area terkunci untuk mencegah perubahan data tidak disengaja'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmergencyModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 cursor-pointer"
                aria-label="Tutup modal darurat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!emergencyUnlocked ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <p className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Peringatan Keamanan Data</span>
                  </p>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Menu ini berisi tindakan sensitif yang dapat mengimpor data massal, menimpa daftar siswa dari cadangan, mengirim sinkronisasi Cloud, atau mengosongkan seluruh data siswa. Gunakan hanya jika Anda benar-benar perlu memulihkan atau menata ulang basis data siswa.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEmergencyModal(false)}
                    className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmergencyUnlocked(true)}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Saya Mengerti, Buka Menu Darurat</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {emergencyStatusMsg && (
                  <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs font-bold text-[#1A5C4A] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{emergencyStatusMsg}</span>
                  </div>
                )}

                {/* Navigasi Tab Darurat */}
                <div className="flex flex-wrap gap-1.5 bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEmergencyTab('tools')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      emergencyTab === 'tools' ? 'bg-[#1A5C4A] text-white shadow-2xs' : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    Tindakan Darurat
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmergencyTab('audit')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      emergencyTab === 'audit' ? 'bg-[#1A5C4A] text-white shadow-2xs' : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Audit Identitas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmergencyTab('trash')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      emergencyTab === 'trash' ? 'bg-[#1A5C4A] text-white shadow-2xs' : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sampah / Riwayat Hapus</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmergencyTab('import')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      emergencyTab === 'import' ? 'bg-[#1A5C4A] text-white shadow-2xs' : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    Impor Excel / CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmergencyTab('backup')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      emergencyTab === 'backup' ? 'bg-[#1A5C4A] text-white shadow-2xs' : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    Cek Cadangan
                  </button>
                </div>

                {emergencyTab === 'tools' && (
                  <div className="space-y-2.5">
                    <div className="p-3.5 rounded-xl border-2 border-[#00685f]/30 bg-[#e6f4f1]/60 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Database className="w-5 h-5 text-[#00685f] shrink-0" />
                        <div>
                          <p className="text-xs font-extrabold text-[#0b1c30]">Migrasi Data Lama</p>
                          <p className="text-[11px] text-[#3d4947]">
                            Tandai data lama yang belum punya sekolahId (Home Visit, Konseling, Siswa, Kasus) sebagai milik sekolah ini
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLegacyMigrationConfirm(true);
                          void handleLoadIdentityAudit();
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-extrabold shrink-0 cursor-pointer shadow-2xs"
                      >
                        Migrasi Data Lama
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEmergencyTab('audit')}
                      className="w-full p-3.5 rounded-xl border border-teal-200 bg-white hover:border-[#00685f] hover:bg-[#f8faf9] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-[#00685f] shrink-0" />
                        <div>
                          <p className="text-xs font-extrabold text-[#0b1c30]">Audit Identitas Sekolah</p>
                          <p className="text-[11px] text-gray-600">
                            Periksa total data milik sekolah ini vs data lama tanpa schoolId dan tandai manual
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#00685f] shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmergencyTab('trash')}
                      className="w-full p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 hover:border-rose-400 hover:bg-rose-50 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Trash2 className="w-5 h-5 text-rose-600 shrink-0" />
                        <div>
                          <p className="text-xs font-extrabold text-[#0b1c30]">Sampah / Riwayat Hapus</p>
                          <p className="text-[11px] text-gray-600">
                            Lihat siswa, kasus, atau layanan yang sudah dihapus untuk Pulihkan atau Hapus Permanen
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-rose-500 shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmergencyTab('import')}
                      className="w-full p-3.5 rounded-xl border border-gray-200 hover:border-[#1A5C4A]/50 hover:bg-[#f8faf9] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-[#1A5C4A] shrink-0" />
                        <div>
                          <p className="text-xs font-extrabold text-[#0b1c30]">Impor Excel / CSV</p>
                          <p className="text-[11px] text-gray-500">Tempel baris Excel/Google Sheets atau unggah file CSV siswa</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmergencyTab('backup')}
                      className="w-full p-3.5 rounded-xl border border-gray-200 hover:border-[#1A5C4A]/50 hover:bg-[#f8faf9] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <RotateCcw className="w-5 h-5 text-[#1A5C4A] shrink-0" />
                        <div>
                          <p className="text-xs font-extrabold text-[#0b1c30]">Cek Cadangan</p>
                          <p className="text-[11px] text-gray-500">Pindai cache browser atau unggah berkas cadangan JSON/CSV</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>

                    <div className="p-3.5 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xs font-extrabold text-[#0b1c30]">Kembalikan Data Asli</p>
                          <p className="text-[11px] text-gray-500">Pulihkan daftar siswa asli tanpa data contoh dari penyimpanan</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isRestoringData}
                        onClick={handleRestoreOriginalData}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shrink-0 cursor-pointer"
                      >
                        {isRestoringData ? 'Memulihkan...' : 'Pulihkan'}
                      </button>
                    </div>

                    <div className="p-3.5 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Cloud className="w-5 h-5 text-[#1A5C4A] shrink-0" />
                        <div>
                          <p className="text-xs font-extrabold text-[#0b1c30]">Kirim ke Akun Aulia (Cloud)</p>
                          <p className="text-[11px] text-gray-500">Kirim cadangan data sekolah ke Cloud Firestore</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isSyncingAulia}
                        onClick={handleSyncToAulia}
                        className="px-3 py-1.5 rounded-lg bg-[#1A5C4A] hover:bg-[#144739] disabled:opacity-60 text-white text-xs font-bold shrink-0 cursor-pointer"
                      >
                        {isSyncingAulia ? 'Mengirim...' : 'Kirim Cloud'}
                      </button>
                    </div>

                    {hasDummyStudents && (
                      <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <UserX className="w-5 h-5 text-amber-700 shrink-0" />
                          <div>
                            <p className="text-xs font-extrabold text-amber-950">Hapus Siswa Dummy</p>
                            <p className="text-[11px] text-amber-800">Bersihkan siswa contoh bawaan dari daftar aktif</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isPurgingDummy}
                          onClick={handlePurgeDummy}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-bold shrink-0 cursor-pointer"
                        >
                          {isPurgingDummy ? 'Menghapus...' : 'Bersihkan'}
                        </button>
                      </div>
                    )}

                    {onClearAllStudents && (
                      <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Trash2 className="w-5 h-5 text-rose-600 shrink-0" />
                            <div>
                              <p className="text-xs font-extrabold text-rose-950">Kosongkan Siswa</p>
                              <p className="text-[11px] text-rose-800">
                                Menghapus seluruh {students.length} siswa aktif untuk mulai ulang dari 0 siswa
                              </p>
                            </div>
                          </div>
                          {!showWipeConfirmBox && (
                            <button
                              type="button"
                              disabled={students.length === 0}
                              onClick={() => setShowWipeConfirmBox(true)}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold shrink-0 cursor-pointer"
                            >
                              Kosongkan
                            </button>
                          )}
                        </div>

                        {showWipeConfirmBox && (
                          <div className="p-3 rounded-xl bg-white border border-rose-200 space-y-2">
                            <p className="text-[11px] font-bold text-rose-900">
                              Ketik <span className="font-mono bg-rose-100 px-1 rounded">HAPUS</span> untuk konfirmasi mengosongkan seluruh data siswa:
                            </p>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={confirmWipeInput}
                                onChange={(e) => setConfirmWipeInput(e.target.value)}
                                placeholder="Ketik HAPUS"
                                className="flex-1 px-3 py-1.5 border border-rose-300 rounded-lg text-xs font-mono text-[#0b1c30]"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setShowWipeConfirmBox(false);
                                  setConfirmWipeInput('');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-bold text-gray-700 cursor-pointer"
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
                                  setEmergencyStatusMsg('Database siswa telah dikosongkan (0 siswa).');
                                  showToast('Database siswa dikosongkan.', 'success');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
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

                {emergencyTab === 'import' && (
                  <form onSubmit={handleEmergencyImportSubmit} className="space-y-3">
                    <div className="p-3 rounded-xl bg-[#f8faf9] border border-gray-200 text-xs text-[#3d4947] space-y-1">
                      <p className="font-bold text-[#0b1c30]">Format: NISN, Nama Siswa, Kelas, Gender (L/P)</p>
                      <p className="text-[11px]">Tempel langsung dari Excel/Google Sheets atau unggah berkas CSV/TXT.</p>
                    </div>

                    <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-[#bcc9c6] hover:border-[#1A5C4A] rounded-xl cursor-pointer text-xs font-bold text-[#1A5C4A] bg-[#f8faf9]">
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
                      rows={5}
                      placeholder="Contoh: 21221001, Ahmad Fauzi, 7A, L"
                      className="w-full bg-[#f8faf9] border border-gray-200 rounded-xl p-3 text-xs font-mono text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#1A5C4A]"
                    />

                    {parsedImportStudents.length > 0 && (
                      <p className="text-xs font-bold text-[#1A5C4A]">
                        Terbaca {parsedImportStudents.filter((s) => !s.error).length} data valid dari {parsedImportStudents.length} baris.
                      </p>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEmergencyTab('tools')}
                        className="px-4 py-2 rounded-xl bg-gray-100 text-xs font-bold text-gray-700 cursor-pointer"
                      >
                        Kembali
                      </button>
                      <button
                        type="submit"
                        disabled={parsedImportStudents.filter((s) => !s.error).length === 0}
                        className="px-4 py-2 rounded-xl bg-[#1A5C4A] hover:bg-[#144739] disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer"
                      >
                        Impor ({parsedImportStudents.filter((s) => !s.error).length} Siswa)
                      </button>
                    </div>
                  </form>
                )}

                {emergencyTab === 'backup' && (
                  <div className="space-y-3">
                    {backupScanResults.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {backupScanResults.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-2"
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
                              className="px-3 py-1.5 rounded-lg bg-[#1A5C4A] text-white text-xs font-bold shrink-0 cursor-pointer"
                            >
                              Pulihkan
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center">
                        Tidak ditemukan cadangan siswa lokal di browser ini.
                      </p>
                    )}

                    <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-[#bcc9c6] hover:border-[#1A5C4A] rounded-xl cursor-pointer text-xs font-bold text-[#1A5C4A] bg-[#f8faf9]">
                      <Upload className="w-4 h-4" />
                      <span>Unggah File Cadangan (.json / .csv)</span>
                      <input type="file" accept=".json,.csv" onChange={handleJSONBackupUpload} className="hidden" />
                    </label>
                  </div>
                )}

                {emergencyTab === 'audit' && (() => {
                  const activeSchoolLabel = auditResult?.schoolName || getSchoolConfig().schoolName || 'SMP N 2 Susukan';
                  const otherLabels = auditResult?.otherSchoolLabels || [];
                  const otherSchoolLabelDisplay = otherLabels.length > 0 ? otherLabels.slice(0, 2).join(', ') : 'Sekolah Lain';
                  return (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/60 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-black text-[#0b1c30]">Audit Identitas Sekolah</p>
                          <p className="text-[11px] text-[#3d4947]">
                            Sekolah Aktif: <span className="font-bold text-[#00685f]">{activeSchoolLabel}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleLoadIdentityAudit}
                          disabled={isAuditing}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-[#bcc9c6]/60 hover:bg-gray-50 text-[11px] font-bold text-[#0b1c30] flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${isAuditing ? 'animate-spin' : ''}`} />
                          <span>Pindai Ulang</span>
                        </button>
                      </div>

                      {isAuditing && !auditResult ? (
                        <p className="text-xs text-gray-500 py-2">Memindai data Firestore &amp; cache lokal...</p>
                      ) : auditResult ? (
                        <div className="space-y-2">
                          <div className="p-3 rounded-xl bg-white border border-[#bcc9c6]/50 text-xs font-bold text-[#0b1c30] tabular-nums leading-relaxed">
                            Total: {auditResult.total} &bull; {activeSchoolLabel}:{' '}
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

                          <div className="p-3 rounded-xl bg-white border border-[#00685f]/25 text-xs font-bold text-[#0b1c30] tabular-nums leading-relaxed">
                            Siswa {activeSchoolLabel}: <span className="text-[#00685f] font-black">{auditResult.studentBreakdown.currentSchool}</span> &bull; Siswa{' '}
                            {otherLabels.length > 0 ? otherSchoolLabelDisplay : 'Sekolah Lain'} (salah sekolah, perlu dipindah):{' '}
                            <span className={auditResult.studentBreakdown.otherSchool > 0 ? 'text-rose-700 font-black' : 'text-[#0b1c30]'}>
                              {auditResult.studentBreakdown.otherSchool}
                            </span>{' '}
                            &bull; Siswa tanpa schoolId (data lama):{' '}
                            <span className={auditResult.studentBreakdown.unassignedLegacy > 0 ? 'text-amber-700 font-black' : 'text-[#00685f]'}>
                              {auditResult.studentBreakdown.unassignedLegacy}
                            </span>
                          </div>

                          {auditResult.unassignedLegacy > 0 && (
                            <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl font-medium">
                              Rincian data lama tanpa identitas: Siswa ({auditResult.unassignedByCategory.students}), Home Visit ({auditResult.unassignedByCategory.homeVisits}), Konseling ({auditResult.unassignedByCategory.counseling}), Bimbingan ({auditResult.unassignedByCategory.bimbingan}), Pelanggaran ({auditResult.unassignedByCategory.violations}), Kasus ({auditResult.unassignedByCategory.cases}), Absensi ({auditResult.unassignedByCategory.attendance}), Lainnya ({auditResult.unassignedByCategory.others}).
                            </p>
                          )}

                          {legacyMigrationResult && (
                            <div className="p-3 rounded-xl bg-[#e6f4f1] border border-[#00685f]/30 text-xs font-bold text-[#005049]">
                              {legacyMigrationResult.message}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowUnassignedList((v) => !v)}
                              className="px-3 py-2 rounded-xl bg-white border border-[#00685f]/40 hover:bg-[#e6f4f1]/60 text-[#00685f] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>
                                {showUnassignedList
                                  ? 'Sembunyikan Data Lama Tanpa Identitas'
                                  : `Lihat Data Lama Tanpa Identitas (${auditResult.unassignedLegacy})`}
                              </span>
                            </button>

                            {auditResult.unassignedLegacy > 0 && (
                              <button
                                type="button"
                                disabled={isRunningLegacyMigration}
                                onClick={() => setShowLegacyMigrationConfirm(true)}
                                className="px-3.5 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer shadow-2xs"
                              >
                                {isRunningLegacyMigration ? 'Memigrasi...' : `Migrasi Data Lama ke ${activeSchoolLabel}`}
                              </button>
                            )}

                            {auditResult.unassignedLegacy > 0 && (
                              <button
                                type="button"
                                disabled={isRunningLegacyMigration}
                                onClick={() => setPendingClaimAllModal({ step: 1 })}
                                className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer shadow-2xs"
                              >
                                Tandai Semua Sebagai Milik Saya
                              </button>
                            )}

                            {auditResult.ownedByOtherSchool > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setShowOtherSchoolList((v) => !v)}
                                  className="px-3 py-2 rounded-xl bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
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

                      <p className="text-[11px] text-[#3d4947] pt-1 border-t border-gray-200/70">
                        Info sinkronisasi: Menu Audit Identitas Sekolah aktif di Preview maupun Situs Asli. Jika perubahan terbaru belum tampil di Situs Asli, klik tombol <strong>Publish</strong> di AI Studio.
                      </p>
                    </div>

                    {showOtherSchoolList && auditResult && auditResult.otherSchoolItems.length > 0 && (
                      <div className="space-y-2 p-3 rounded-xl border border-rose-200 bg-rose-50/40">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-extrabold text-rose-900">
                            Daftar Data Sekolah Lain ({auditResult.otherSchoolItems.length})
                          </p>
                          <span className="text-[11px] font-bold text-rose-800 tabular-nums">
                            Halaman {Math.min(otherSchoolPage, otherSchoolTotalPages)} / {otherSchoolTotalPages}
                          </span>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
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
                          <div className="flex items-center justify-between pt-1.5 border-t border-rose-200/70">
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
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap gap-1">
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
                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                              {paginatedUnassignedItems.map((item) => (
                                <div
                                  key={`${item.category}-${item.id}`}
                                  className="p-3 rounded-xl border border-gray-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                                >
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                                        {item.entityType}
                                      </span>
                                      {item.date && (
                                        <span className="text-[10px] font-semibold text-gray-500">{item.date}</span>
                                      )}
                                    </div>
                                    <p className="text-xs font-extrabold text-[#0b1c30] break-words">{item.label}</p>
                                    <p className="text-[11px] text-[#3d4947] break-words">{item.sublabel}</p>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={claimingSingleId === item.id || isRunningLegacyMigration}
                                    onClick={() => handleClaimSingleLegacyItem(item.id, item.label)}
                                    className="px-3 py-1.5 rounded-xl bg-[#00685f] hover:bg-[#005049] disabled:opacity-50 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                                  >
                                    {claimingSingleId === item.id ? 'Menyimpan...' : 'Tandai Sebagai Milik Sekolah Saya'}
                                  </button>
                                </div>
                              ))}
                            </div>
                            {unassignedTotalPages > 1 && (
                              <div className="flex items-center justify-between pt-1.5 border-t border-gray-200">
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

                {emergencyTab === 'trash' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        {(['Semua', 'Siswa', 'Kasus', 'Layanan', 'Lainnya'] as const).map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setTrashFilter(cat)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                              trashFilter === cat
                                ? 'bg-[#00685f] text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={loadTrashRecords}
                        disabled={isLoadingTrash}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-[11px] font-bold text-[#0b1c30] flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingTrash ? 'animate-spin' : ''}`} />
                        <span>Muat Ulang</span>
                      </button>
                    </div>

                    {isLoadingTrash ? (
                      <div className="p-6 text-center text-xs text-gray-500 font-semibold">
                        Memuat data Sampah / Riwayat Hapus...
                      </div>
                    ) : filteredTrashItems.length === 0 ? (
                      <div className="p-6 rounded-xl bg-gray-50 border border-dashed border-gray-300 text-center space-y-1">
                        <Trash2 className="w-6 h-6 text-gray-400 mx-auto" />
                        <p className="text-xs font-bold text-[#0b1c30]">Sampah Kosong</p>
                        <p className="text-[11px] text-gray-500">
                          Tidak ada data terhapus pada kategori ini.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {filteredTrashItems.map((item) => (
                          <div
                            key={`${item.colName}-${item.id}`}
                            className="p-3 rounded-xl border border-gray-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
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
                      <div className="pt-2 border-t border-gray-200 space-y-1.5">
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
                )}
              </div>
            )}
          </div>
        </div>
        </ErrorBoundary>
      )}

      {/* Konfirmasi 2x Hapus Permanen dari Sampah */}
      {pendingPermanentDelete && (
        <div className="fixed inset-0 z-[130] bg-[#0b1c30]/70 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-rose-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0b1c30]">
                  {pendingPermanentDelete.step === 1
                    ? 'Hapus Permanen (Langkah 1/2)'
                    : 'Konfirmasi Final (Langkah 2/2)'}
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

      {/* Modal Konfirmasi [Migrasi Data Lama] */}
      {showLegacyMigrationConfirm && (
        <div className="fixed inset-0 z-[130] bg-[#0b1c30]/70 backdrop-blur-[2px] flex items-center justify-center p-4">
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
                disabled={isRunningLegacyMigration}
                onClick={() => setShowLegacyMigrationConfirm(false)}
                className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isRunningLegacyMigration}
                onClick={handleConfirmRunLegacyMigration}
                className="px-4 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
              >
                {isRunningLegacyMigration ? 'Memigrasi Data...' : 'Saya Paham, Migrasi Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Konfirmasi 2x Tandai Semua Sebagai Milik Saya */}
      {pendingClaimAllModal && (
        <div className="fixed inset-0 z-[130] bg-[#0b1c30]/70 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-[#bcc9c6]/50 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0b1c30]">
                  {pendingClaimAllModal.step === 1
                    ? 'Tandai Semua Data Lama (1/2)'
                    : 'Konfirmasi Final Migrasi (2/2)'}
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

      {/* Konfirmasi 2x Pindahkan Data Sekolah Lain */}
      {pendingRelocateModal && (
        <div className="fixed inset-0 z-[130] bg-[#0b1c30]/70 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-rose-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0b1c30]">
                  {pendingRelocateModal.step === 1
                    ? 'Pindahkan Data Sekolah Lain (1/2)'
                    : 'Konfirmasi Pemindahan Data (2/2)'}
                </h3>
                <p className="text-xs text-[#3d4947] mt-1 leading-relaxed">
                  {pendingRelocateModal.step === 1
                    ? `Anda akan memindahkan ${auditResult?.ownedByOtherSchool || 0} data (${pendingRelocateModal.targetLabel}) agar tercatat sebagai milik "${auditResult?.schoolName || getSchoolConfig().schoolName}". Pastikan data tersebut memang milik sekolah Anda yang salah tercatat.`
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

      {/* Modal Panduan BSKAP 2022 */}
      <PanduanBskap2022Modal
        isOpen={showBskapModal}
        onClose={() => setShowBskapModal(false)}
      />

      {/* Modal Manual Pengguna */}
      <UserManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
      />
    </div>
  );
};

export default LainnyaView;
