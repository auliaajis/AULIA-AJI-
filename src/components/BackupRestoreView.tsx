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
} from 'lucide-react';
import { Counselor } from '../types';
import { showToast } from '../utils/toast';
import { getActiveSchoolId, getSchoolConfig } from '../utils/schoolConfig';
import { getLastCloudSyncInfo, CloudSyncRecordInfo, clearLocalCacheAndReloadFromCloud } from '../utils/firestoreSync';
import {
  collectFullBackupSnapshot,
  downloadFullBackupJSON,
  downloadStudentsCSV,
  downloadViolationsCSV,
  exportAllToExcel,
  exportAllSummaryPDF,
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

interface BackupRestoreViewProps {
  activeCounselor?: Counselor | null;
  liveState: LiveAppDataInput;
  onBack: () => void;
  onDataRestored?: () => void;
}

export default function BackupRestoreView({
  activeCounselor,
  liveState,
  onBack,
  onDataRestored,
}: BackupRestoreViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const schoolId = activeCounselor?.schoolId || getActiveSchoolId();
  const schoolConfig = getSchoolConfig(schoolId);

  const [refreshTick, setRefreshTick] = useState(0);
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

  const currentSnapshot = useMemo(() => {
    return collectFullBackupSnapshot(activeCounselor, liveState);
  }, [activeCounselor, liveState, refreshTick]);

  const counts = currentSnapshot.counts;

  const handleDownloadJsonBackup = () => {
    try {
      const res = downloadFullBackupJSON(activeCounselor, liveState);
      setLastBackupResult(res);
      setSecondaryExportMsg(null);
      showToast(`Backup JSON berhasil diunduh (${res.sizeLabel})`, 'success');
    } catch (err: any) {
      showToast(`Gagal membuat backup JSON: ${err?.message || String(err)}`, 'error');
    }
  };

  const handleDownloadStudentsCsv = () => {
    try {
      const res = downloadStudentsCSV(liveState.students, activeCounselor);
      setSecondaryExportMsg(`CSV Siswa berhasil diunduh: ${res.fileName} (${res.count} siswa • ${res.sizeLabel})`);
      showToast(`Backup ${res.count} siswa (CSV) berhasil diunduh`, 'success');
    } catch (err: any) {
      showToast(`Gagal export CSV siswa: ${err?.message || String(err)}`, 'error');
    }
  };

  const handleDownloadViolationsCsv = () => {
    try {
      const res = downloadViolationsCSV(liveState.violations, activeCounselor);
      setSecondaryExportMsg(`CSV Pelanggaran berhasil diunduh: ${res.fileName} (${res.count} catatan • ${res.sizeLabel})`);
      showToast(`Backup ${res.count} pelanggaran (CSV) berhasil diunduh`, 'success');
    } catch (err: any) {
      showToast(`Gagal export CSV pelanggaran: ${err?.message || String(err)}`, 'error');
    }
  };

  const handleExportAllExcel = () => {
    try {
      const res = exportAllToExcel(activeCounselor, liveState);
      setSecondaryExportMsg(
        `Workbook Excel lengkap berhasil diunduh: ${res.fileName} (${res.counts.totalRecords} total data dalam beberapa sheet)`
      );
      showToast('Export semua data ke Excel (.xlsx) berhasil!', 'success');
    } catch (err: any) {
      showToast(`Gagal export Excel: ${err?.message || String(err)}`, 'error');
    }
  };

  const handleExportAllPdf = () => {
    try {
      const res = exportAllSummaryPDF(activeCounselor, liveState);
      setSecondaryExportMsg(`Ringkasan PDF berhasil diunduh: ${res.fileName}`);
    } catch (err: any) {
      showToast(`Gagal export PDF: ${err?.message || String(err)}`, 'error');
    }
  };

  const handleSyncToCloud = async () => {
    setIsSyncingCloud(true);
    setCloudActionMsg(null);
    try {
      const res = await syncAllLocalDataToFirestore(activeCounselor, liveState);
      setRefreshTick((t) => t + 1);
      setCloudInfo(getLastCloudSyncInfo(schoolId));
      if (res.success) {
        setCloudActionMsg({
          type: 'success',
          text: `Sinkronisasi ke Firebase Firestore selesai (${res.uploadedTotal} dokumen diunggah/digabungkan aman pada ${res.syncedAtLabel}).`,
        });
        showToast('Semua data lokal berhasil disinkronkan ke Firebase Cloud!', 'success');
      } else {
        setCloudActionMsg({
          type: 'error',
          text: res.error || 'Sebagian data belum berhasil disinkronkan ke Cloud. Periksa koneksi internet Anda.',
        });
        showToast(res.error || 'Sinkronisasi ke Cloud mengalami kendala.', 'warning');
      }
    } catch (err: any) {
      setCloudActionMsg({
        type: 'error',
        text: err?.message || 'Gagal menyambung ke Firebase Firestore.',
      });
      showToast('Gagal sinkron ke Cloud.', 'error');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleClearLocalCacheAndReload = async () => {
    setIsReloadingFromCloud(true);
    setCloudActionMsg(null);
    try {
      const res = await clearLocalCacheAndReloadFromCloud();
      setRefreshTick((t) => t + 1);
      setCloudInfo(getLastCloudSyncInfo(schoolId));
      if (res.success) {
        if (onDataRestored) onDataRestored();
        const summary = `Cache lokal dihapus & data ditarik ulang langsung dari Firestore: ${res.counts.students} siswa, ${res.counts.violations} pelanggaran, ${res.counts.services} layanan, ${res.counts.homeVisits} home visit, ${res.counts.journals} jurnal, & ${res.counts.attendance} sesi absensi.`;
        setCloudActionMsg({ type: 'success', text: summary });
        showToast(summary, 'success');
      } else {
        const errMsg = res.error || 'Gagal menarik ulang data dari Firebase Firestore.';
        setCloudActionMsg({ type: 'error', text: errMsg });
        showToast(errMsg, 'error');
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      setCloudActionMsg({ type: 'error', text: `GAGAL KONEK FIREBASE: ${errMsg}` });
      showToast(`Gagal mengambil data Cloud: ${errMsg}`, 'error');
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
      setRefreshTick((t) => t + 1);
      setCloudInfo(getLastCloudSyncInfo(schoolId));
      if (res.success) {
        setHasMigratedLegacy(true);
        if (onDataRestored) onDataRestored();
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
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

  const isCloudSynced = cloudInfo.status === 'synced';
  const isOffline = cloudInfo.status === 'offline';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-2xl p-5 border border-[#bcc9c6]/40 shadow-xs">
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
                Backup & Restore Semua Data
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/20">
                {schoolConfig.schoolName || 'SMP N 2 Susukan'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#3d4947] mt-1">
              Cadangkan seluruh koleksi data sekolah (JSON, CSV, Excel, PDF), pulihkan cadangan dengan aman, & sinkronkan langsung ke Firebase Firestore.
            </p>
          </div>
        </div>
      </div>

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
            <p className="text-lg font-extrabold text-[#0b1c30] mt-1">{counts.students}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/30">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3d4947]">
              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
              <span>Pelanggaran</span>
            </div>
            <p className="text-lg font-extrabold text-[#0b1c30] mt-1">{counts.violations}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/30">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3d4947]">
              <HeartHandshake className="w-3.5 h-3.5 text-[#00685f]" />
              <span>Layanan BK</span>
            </div>
            <p className="text-lg font-extrabold text-[#0b1c30] mt-1">{counts.services}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/30">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3d4947]">
              <Home className="w-3.5 h-3.5 text-purple-600" />
              <span>Home Visit</span>
            </div>
            <p className="text-lg font-extrabold text-[#0b1c30] mt-1">{counts.homeVisits}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/30">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3d4947]">
              <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
              <span>Agenda/Jurnal</span>
            </div>
            <p className="text-lg font-extrabold text-[#0b1c30] mt-1">{counts.agendaTotal}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/30">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3d4947]">
              <BookMarked className="w-3.5 h-3.5 text-amber-600" />
              <span>Pembinaan</span>
            </div>
            <p className="text-lg font-extrabold text-[#0b1c30] mt-1">{counts.pembinaanTotal}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/30">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3d4947]">
              <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Absensi</span>
            </div>
            <p className="text-lg font-extrabold text-[#0b1c30] mt-1">{counts.attendanceHistory}</p>
          </div>
        </div>
      </div>

      {/* One-Time Legacy Migration Card (Hidden automatically after successful completion) */}
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
                  Pindahkan seluruh data lama di browser (siswa, pelanggaran, layanan BK, home visit, agenda/jurnal, &amp; pengaturan) ke Firebase Firestore dengan pengecekan duplikat otomatis agar AI Studio dan Vercel menampilkan data yang sama persis.
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
              Mengemas 100% data dalam 1 file JSON utuh: Data Siswa, Arsip Pelanggaran & Restitusi, Layanan BK, Home Visit, Surat Panggilan Ortu, Agenda & Jadwal, Catatan Pembinaan, Absensi, Apresiasi, Evaluasi, dan Pengaturan Sekolah.
            </p>
          </div>
        </div>

        {/* Main JSON Backup Button */}
        <div className="p-4 rounded-2xl bg-[#f8faf9] border border-[#bcc9c6]/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold text-[#0b1c30]">
              Cadangan Lengkap Format JSON (.json)
            </p>
            <p className="text-xs text-[#3d4947] mt-0.5">
              Nama file otomatis: <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-gray-200">backup-bk-gridasus-TANGGAL-JAM.json</code> • Siap untuk Restore kapan saja.
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

        {/* Post-Backup Summary Card */}
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
            <p className="text-[11px] text-emerald-800/80 font-mono">
              Nama File: {lastBackupResult.fileName}
            </p>
          </div>
        )}

        {/* Additional CSV / Excel / PDF Backup Buttons */}
        <div className="space-y-2.5">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#3d4947]">
            Backup Tambahan & Export Dokumen
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
                Pilih file backup <code className="font-mono text-[11px] bg-gray-100 px-1 rounded">.json</code> untuk melihat preview isi data sebelum dipulihkan ke aplikasi & Cloud Firestore.
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

        {/* Preview Isi File Backup */}
        {restorePreview && (
          <div
            className={`rounded-2xl p-5 border space-y-4 ${
              restorePreview.valid
                ? 'bg-[#f8faf9] border-[#00685f]/30'
                : 'bg-red-50 border-red-200'
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

                {/* Preview Counts Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                    <p className="text-[11px] font-semibold text-[#3d4947]">Siswa</p>
                    <p className="text-base font-extrabold text-[#0b1c30]">{restorePreview.counts.students}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                    <p className="text-[11px] font-semibold text-[#3d4947]">Pelanggaran</p>
                    <p className="text-base font-extrabold text-[#0b1c30]">{restorePreview.counts.violations}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                    <p className="text-[11px] font-semibold text-[#3d4947]">Layanan BK</p>
                    <p className="text-base font-extrabold text-[#0b1c30]">{restorePreview.counts.services}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                    <p className="text-[11px] font-semibold text-[#3d4947]">Home Visit & Ortu</p>
                    <p className="text-base font-extrabold text-[#0b1c30]">
                      {restorePreview.counts.homeVisits + restorePreview.counts.parentSummons}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                    <p className="text-[11px] font-semibold text-[#3d4947]">Agenda / Jurnal</p>
                    <p className="text-base font-extrabold text-[#0b1c30]">{restorePreview.counts.agendaTotal}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                    <p className="text-[11px] font-semibold text-[#3d4947]">Catatan Pembinaan</p>
                    <p className="text-base font-extrabold text-[#0b1c30]">{restorePreview.counts.pembinaanTotal}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                    <p className="text-[11px] font-semibold text-[#3d4947]">Absensi Kelas</p>
                    <p className="text-base font-extrabold text-[#0b1c30]">{restorePreview.counts.attendanceHistory}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#bcc9c6]/40">
                    <p className="text-[11px] font-semibold text-[#3d4947]">Pengaturan & Lainnya</p>
                    <p className="text-base font-extrabold text-[#0b1c30]">
                      {restorePreview.hasSettings ? 'Tersedia' : 'Tidak Ada'}
                    </p>
                  </div>
                </div>

                {/* 2 Pilihan Restore */}
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
                        Aman: Data saat ini tetap dipertahankan, dan data dari file backup yang belum ada akan ditambahkan ke aplikasi & Cloud.
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

                {/* Action Button */}
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

        {/* Post-Restore Result Banner */}
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

      {/* Confirmation Modal requiring exact "YA" before Replace Total */}
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
                  <h3 className="text-lg font-extrabold text-[#0b1c30] mt-1">
                    Ganti Total Semua Data?
                  </h3>
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
              Tindakan ini akan <strong className="text-red-700">menghapus/mengganti semua data lama</strong> di aplikasi & Cloud Firestore dengan isi file <strong className="text-[#0b1c30]">{selectedFileName}</strong>.
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
    </div>
  );
}
