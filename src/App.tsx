import { useState, useEffect, useRef, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import DataSiswaView from './components/DataSiswaView';
import CatatPelanggaranForm from './components/CatatPelanggaranForm';
import CatatApresiasiForm from './components/CatatApresiasiForm';
import TambahLayananForm from './components/TambahLayananForm';
import ProfilSiswaView from './components/ProfilSiswaView';
import PengaturanView from './components/PengaturanView';
import AbsensiView from './components/AbsensiView';
import GoogleIntegrationView from './components/GoogleIntegrationView';
import BackupRestoreView from './components/BackupRestoreView';
import JurnalHarianView from './components/JurnalHarianView';
import PanggilanOrangTuaView from './components/PanggilanOrangTuaView';
import HomeVisitView from './components/HomeVisitView';
import LoginView from './components/LoginView';
import AsesmenBkView from './components/AsesmenBkView';
import PembinaanPendisiplinanView from './components/PembinaanPendisiplinanView';
import LaporanRekapView from './components/LaporanRekapView';
import StudioPdfMakerView from './components/StudioPdfMakerView';
import EditLayananModal from './components/EditLayananModal';
import LayananDetailModal from './components/LayananDetailModal';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';
import BottomNavBar from './components/BottomNavBar';
import PageHeaderBanner from './components/PageHeaderBanner';
import LainnyaView from './components/LainnyaView';
import PeringatanView, { PeringatanFilterTab } from './components/PeringatanView';
import { RiwayatLayananView } from './components/RiwayatLayananView';
import EvaluasiProgramView from './components/EvaluasiProgramView';
import EvaluasiWizardModal from './components/EvaluasiWizardModal';
import FloatingSiBecik from './components/FloatingSiBecik';
import AiAssistantWidget from './components/AiAssistantWidget';
import RujukanPiketView from './components/RujukanPiketView';
import FormPembinaanModal, { PembinaanSubmitPayload } from './components/FormPembinaanModal';
import { getRujukanItemStatus, getRujukanCategoryLabel, isRujukanBaruPiket } from './utils/rujukanHelper';
import {
  getLocalSiBecikFabEnabled,
  saveSiBecikFabSettings,
  loadSiBecikFabSettingsFromFirestore,
  getSiBecikUnread,
  setSiBecikUnread,
  getSeenOverdueIds,
  markOverdueIdsSeen,
  fetchOverdueFollowUpIdsFromFirestore,
} from './utils/siBecikSettings';
import { downloadSingleEvaluationCardPDF } from './utils/evaluationPdfGenerator';
import { showToast } from './utils/toast';
import { isValidDeleteId, safeFilterSingleDelete, generateUniqueId } from './utils/safeDelete';
import { motion, AnimatePresence } from 'motion/react';
import { downloadServicePDF, generateServicePDF, autoArchiveServiceToDrive, autoArchiveViolationToDrive } from './utils/pdfGenerator';
import { formatCardDateTime, formatCardDate, formatCardTime } from './utils/dateFormatter';
import { exportSingleServiceToIcs, exportServicesToIcs } from './utils/calendarSync';
import { triggerBackgroundAutoSync, ensureDriveFolderStructure } from './utils/googleSync';
import { getDeletedIds, registerDeletedId, registerSyncedIds, cleanupSyncedIds } from './utils/deletionTracker';
import { autoPushToJournal } from './utils/journalAutoLink';
import {
  CANONICAL_AULIA_VIOLATIONS,
  CANONICAL_AULIA_SERVICES,
  CANONICAL_AULIA_HOME_VISITS,
  CANONICAL_AULIA_PARENT_SUMMONS,
  CANONICAL_AULIA_JOURNALS
} from './data/canonicalAuliaData';
import { 
  initRealtimeFirestoreSync, 
  stopRealtimeFirestoreSync,
  forceFullCloudSync,
  flushPendingCloudQueue,
  saveBulkToFirestore, 
  saveToFirestore, 
  softDeleteFromFirestore,
  softDeleteBulkStudentsFromFirestore,
  saveAccountRequestToCloud,
  updateAccountRequestInCloud,
  deleteAccountRequestFromCloud,
  getCloudCollectionData,
  setCloudCollectionData,
  getCloudConnectionInfo,
  testConnection,
  promoteFrequentGuestTeachers
} from './utils/firestoreSync';
import { firebaseConfig, auth } from './firebase';
import { googleSignIn } from './utils/firebaseAuth';
import PiketPage from './components/PiketPage';
import KelolaGuruPiketView from './components/KelolaGuruPiketView';
import { getActiveSchoolId, setActiveSchoolId, getSchoolConfig, loadSchoolData, saveSchoolData, sanitizeSchoolId, switchSchoolWorkspace, getRegisteredSchools, getValidatedSchoolIdentity, buildSchoolStamp, enforceCanonicalSchoolCacheRepair } from './utils/schoolConfig';
import { runStartupStorageCheck } from './utils/storageQuota';
import { purgeDummyData, purgeDummyStudents, isDummyStudent, deduplicateAndPurgeAllData, isRealNonDummyViolation } from './utils/purgeDummyData';
import { applyTheme, getIsDarkMode } from './utils/theme';
import { ensureSchoolDocumentExists } from './utils/multiSchoolMigration';

import {
  counselors
} from './data/mockData';
import { Student, ViolationRecord, CounselingService, BKComponentType, ActivityLog, Counselor, StudentAchievement, PresetServiceData, ProgramEvaluation } from './types';
import { HeartHandshake, Calendar, Clock, Plus, UserCheck, Download, Edit2, Trash2, CheckCircle2, Search, Filter, Home, Mail, Layers, Info, Sparkles, BookOpen, Target, ShieldAlert, Settings, FileText, Printer, ArrowLeft, AlertTriangle, RefreshCw } from 'lucide-react';
import { filterStudents, filterViolations, filterServices, filterAchievements, filterHomeVisits, filterLogs } from './utils/accessControl';
import { BK_COMPONENTS_DATA, getBKComponentForService, getComponentColorConfig, getPilarBadge, SIKLUS_LAYANAN_TERPADU } from './utils/bkKomprehensif';

function isPiketPublicPath(): boolean {
  if (typeof window === 'undefined') return false;
  const path = (window.location.pathname || '').toLowerCase();
  const hash = (window.location.hash || '').toLowerCase();
  return (
    path === '/piket' ||
    path.startsWith('/piket/') ||
    hash === '#/piket' ||
    hash.startsWith('#/piket/')
  );
}

export default function App() {
  const [isPiketRoute, setIsPiketRoute] = useState<boolean>(() => isPiketPublicPath());

  useEffect(() => {
    const handleRouteChange = () => {
      setIsPiketRoute(isPiketPublicPath());
    };
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

  // Route publik /piket: langsung tampilkan form piket tanpa cek login / onAuthStateChanged
  if (isPiketRoute) {
    return (
      <>
        <PiketPage />
        <ToastContainer />
      </>
    );
  }

  return <AuthenticatedBkApp />;
}

function AuthenticatedBkApp() {
  // Navigation Routing States
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [peringatanFilter, setPeringatanFilter] = useState<PeringatanFilterTab>('semua');
  const [preSelectedStudentId, setPreSelectedStudentId] = useState<string | undefined>(undefined);
  const [violationInitialTab, setViolationInitialTab] = useState<'input' | 'arsip'>('input');
  const [violationInitialSearch, setViolationInitialSearch] = useState('');
  const [violationInitialOpenId, setViolationInitialOpenId] = useState<string | undefined>(undefined);
  const [rujukanInitialSearch, setRujukanInitialSearch] = useState('');
  const [pembinaanTargetViolation, setPembinaanTargetViolation] = useState<ViolationRecord | null>(null);
  const [selectedProfileStudentId, setSelectedProfileStudentId] = useState<string | null>(null);
  const [previousView, setPreviousView] = useState<string>('dashboard');
  const [presetServiceData, setPresetServiceData] = useState<PresetServiceData | null>(null);
  const [presetJournalData, setPresetJournalData] = useState<{
    className?: string;
    topic?: string;
    subject?: string;
    startTime?: string;
    endTime?: string;
    period?: string;
  } | null>(null);

  // Authentication states: Cek status login tersimpan agar user-friendly & tidak logout berulang saat reload
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('bk_is_logged_in') || sessionStorage.getItem('bk_session_logged_in');
        return stored === 'true';
      }
    } catch (e) {}
    return false;
  });

  const [allCounselors, setAllCounselors] = useState<Counselor[]>(() => {
    enforceCanonicalSchoolCacheRepair();
    const currentSchoolId = getActiveSchoolId();
    let list: Counselor[] = loadSchoolData('bk_counselors', counselors, currentSchoolId);
    if (!list || list.length === 0) {
      list = [...counselors];
    }

    const activeCfg = getSchoolConfig(currentSchoolId);
    const hasManualOverride = typeof localStorage !== 'undefined' && localStorage.getItem('bk_manual_school_override') === 'true';

    // Always guarantee Bapak Aulia Aji Sasongko exists with full privileges as Koordinator BK & Administrator
    let auliaIndex = list.findIndex(c => c.id === 'c1' || c.username === 'aulia' || (c.email && c.email.includes('auliasasongko')) || (c.name && c.name.toLowerCase().includes('aulia')));
    const defaultAulia: Counselor = {
      id: 'c1',
      name: 'Aulia Aji Sasongko, S.Pd.',
      role: 'Koordinator BK & Guru Pembimbing Kelas 8',
      nip: 'NIP. 19931231 202221 1 002',
      avatar: counselors.find(c => c.id === 'c1')?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
      allowedClasses: ['8A', '8B', '8C', '8D', '8E', '8F', '8G'],
      username: 'aulia',
      password: 'aulia',
      email: 'auliasasongko12@guru.smp.belajar.id',
      phone: '089681287339',
      schoolId: 'sch_20320123',
      schoolNpsn: '20320123',
      schoolName: 'SMP N 2 Susukan'
    };

    if (auliaIndex !== -1) {
      const storedRole = String(list[auliaIndex].role || '').trim();
      const safeRole = !storedRole || storedRole.toLowerCase().includes('admin & guru')
        ? defaultAulia.role
        : storedRole;
      const safeSchoolName = hasManualOverride && activeCfg?.schoolName && !activeCfg.schoolName.toLowerCase().includes('kroya')
        ? activeCfg.schoolName
        : 'SMP N 2 Susukan';
      list[auliaIndex] = {
        ...defaultAulia,
        ...list[auliaIndex],
        id: 'c1',
        name: hasManualOverride && activeCfg?.koordinatorBkName ? activeCfg.koordinatorBkName : (list[auliaIndex].name || 'Aulia Aji Sasongko, S.Pd.'),
        role: safeRole,
        nip: list[auliaIndex].nip && list[auliaIndex].nip !== '-' ? list[auliaIndex].nip : 'NIP. 19931231 202221 1 002',
        username: 'aulia',
        email: 'auliasasongko12@guru.smp.belajar.id',
        phone: list[auliaIndex].phone || '089681287339',
        schoolId: hasManualOverride ? currentSchoolId : 'sch_20320123',
        schoolNpsn: hasManualOverride ? (activeCfg?.npsn || '') : '20320123',
        schoolName: safeSchoolName,
        allowedClasses: Array.isArray(list[auliaIndex].allowedClasses) ? list[auliaIndex].allowedClasses : defaultAulia.allowedClasses
      };
    } else {
      list.unshift(defaultAulia);
    }

    let binaIndex = list.findIndex(c => c.name?.toLowerCase().includes('bina saptarina') || c.username === 'bina' || c.id === 'c4');
    if (binaIndex !== -1) {
      list[binaIndex] = {
        ...list[binaIndex],
        email: 'binasaptarina58@guru.sma.belajar.id'
      };
    } else {
      const defaultBina = counselors.find(c => c.id === 'c4') || {
        id: 'c4',
        name: 'Bina Saptarina, S.Pd.',
        role: 'Guru Pembimbing BK (Anggota)',
        nip: 'NIP. 19920814 202121 2 005',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120',
        allowedClasses: ['7A', '7B', '8A', '8B'],
        username: 'bina',
        password: 'bina',
        email: 'binasaptarina58@guru.sma.belajar.id',
        phone: '081234567815'
      };
      list.push(defaultBina);
    }
    // Always ensure all 5 default counselors for SMP N 2 Susukan are present in the list
    counselors.forEach(defC => {
      const idx = list.findIndex(c => c.id === defC.id || c.username === defC.username);
      if (idx === -1) {
        list.push(defC);
      }
    });

    saveSchoolData('bk_counselors', list, currentSchoolId);

    return list.map(c => {
      const isAulia = c.id === 'c1' || c.username === 'aulia' || (c.name && c.name.toLowerCase().includes('aulia')) || (c.email && c.email.includes('auliasasongko'));
      return {
        ...c,
        allowedClasses: Array.isArray(c.allowedClasses) ? c.allowedClasses : [],
        role: isAulia ? (c.role || 'Koordinator BK & Administrator Sekolah') : (c.role || 'Guru Pembimbing BK'),
        nip: c.nip || '-',
        avatar: c.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120'
      };
    });
  });

  const [activeCounselor, setActiveCounselor] = useState<Counselor>(() => {
    const savedId = localStorage.getItem('bk_active_counselor_id');
    let found = allCounselors?.find((c) => c.id === savedId);
    
    // Always prioritize Bapak Aulia Aji Sasongko as the primary counselor if saved profile is missing, invalid, or generic admin
    if (!found || savedId === 'admin' || (found.name && found.name.toLowerCase().includes('admin utama'))) {
      found = allCounselors?.find(c => c.id === 'c1' || c.username === 'aulia' || (c.email && c.email.includes('auliasasongko')) || (c.name && c.name.toLowerCase().includes('aulia')));
      if (found) {
        localStorage.setItem('bk_active_counselor_id', found.id);
      }
    }
    if (found) {
      const isAulia = found.id === 'c1' || found.username === 'aulia' || (found.name && found.name.toLowerCase().includes('aulia')) || (found.email && found.email.includes('auliasasongko'));
      if (isAulia) {
        const hasManualOverride = typeof localStorage !== 'undefined' && localStorage.getItem('bk_manual_school_override') === 'true';
        const cfg = getSchoolConfig(hasManualOverride ? getActiveSchoolId() : 'sch_20320123');
        const safeRole = found.role && !String(found.role).toLowerCase().includes('admin & guru')
          ? found.role
          : 'Koordinator BK & Guru Pembimbing Kelas 8';
        return {
          ...found,
          id: 'c1',
          name: hasManualOverride && cfg?.koordinatorBkName ? cfg.koordinatorBkName : (found.name || 'Aulia Aji Sasongko, S.Pd.'),
          role: safeRole,
          schoolId: hasManualOverride ? (cfg.schoolId || 'sch_20320123') : 'sch_20320123',
          schoolNpsn: hasManualOverride ? (cfg.npsn || '') : '20320123',
          schoolName: hasManualOverride && cfg?.schoolName && !cfg.schoolName.toLowerCase().includes('kroya') ? cfg.schoolName : 'SMP N 2 Susukan',
          allowedClasses: Array.isArray(found.allowedClasses) ? found.allowedClasses : []
        };
      }
      return found;
    }
    if (allCounselors && allCounselors.length > 0) {
      const auliaFound = allCounselors.find(c => c.id === 'c1' || c.name?.toLowerCase().includes('aulia'));
      return auliaFound || allCounselors[0];
    }
    return counselors[0];
  });

  const handleUpdateCounselor = (updatedRaw: Counselor) => {
    const cleanNpsn = updatedRaw.schoolNpsn ? String(updatedRaw.schoolNpsn).replace(/[^0-9a-zA-Z]/g, '') : '';
    const currentSchoolId = getActiveSchoolId();
    const targetSchoolId = (cleanNpsn ? sanitizeSchoolId(cleanNpsn) : '') || 
                           (updatedRaw.schoolId ? sanitizeSchoolId(updatedRaw.schoolId) : currentSchoolId);

    const updated: Counselor = {
      ...updatedRaw,
      schoolId: targetSchoolId,
      schoolNpsn: cleanNpsn || updatedRaw.schoolNpsn,
      allowedClasses: Array.isArray(updatedRaw.allowedClasses) ? updatedRaw.allowedClasses : [],
      role: updatedRaw.role || 'Guru Pembimbing BK',
      nip: updatedRaw.nip || '-',
      avatar: updatedRaw.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120'
    };

    if (targetSchoolId === currentSchoolId) {
      const exists = allCounselors.some(c => c.id === updated.id);
      const newList = exists
        ? allCounselors.map(c => c.id === updated.id ? updated : c)
        : [...allCounselors, updated];
      setAllCounselors(newList);
      if (activeCounselor.id === updated.id) {
        setActiveCounselor(updated);
        localStorage.setItem('bk_active_counselor_id', updated.id);
      }
      saveSchoolData('bk_counselors', newList, targetSchoolId);
    } else {
      // Account belongs to another registered school partition
      const otherSchoolList = loadSchoolData<Counselor[]>('bk_counselors', [], targetSchoolId);
      const exists = otherSchoolList.some(c => c.id === updated.id);
      const updatedOtherList = exists
        ? otherSchoolList.map(c => c.id === updated.id ? updated : c)
        : [...otherSchoolList, updated];
      saveSchoolData('bk_counselors', updatedOtherList, targetSchoolId);

      // If this account was present in current allCounselors state, update it there too
      if (allCounselors.some(c => c.id === updated.id)) {
        setAllCounselors(prev => prev.map(c => c.id === updated.id ? updated : c));
      }
    }

    saveToFirestore('bk_counselors', updated, targetSchoolId);
    updateAccountRequestInCloud(updated).catch(console.warn);
    window.dispatchEvent(new Event('storage'));
  };

  const handleChangeCounselor = (counselor: Counselor) => {
    const sanitized = {
      ...counselor,
      allowedClasses: Array.isArray(counselor.allowedClasses) ? counselor.allowedClasses : []
    };
    setActiveCounselor(sanitized);
    localStorage.setItem('bk_active_counselor_id', sanitized.id);
    window.dispatchEvent(new Event('storage'));
  };

  const handleCreateCounselor = (newCounselorRaw: Counselor, makeActive: boolean = false) => {
    const currentSchoolId = activeCounselor?.schoolId || getActiveSchoolId();
    const targetSchoolId = newCounselorRaw.schoolId || currentSchoolId;
    const targetSchoolName = newCounselorRaw.schoolName || (targetSchoolId === 'sch_20320123' ? 'SMP N 2 Susukan' : (getSchoolConfig(targetSchoolId).schoolName || 'SMP N 2 Susukan'));

    const newCounselor: Counselor = {
      ...newCounselorRaw,
      schoolId: targetSchoolId,
      schoolName: targetSchoolName,
      allowedClasses: Array.isArray(newCounselorRaw.allowedClasses) ? newCounselorRaw.allowedClasses : [],
      role: newCounselorRaw.role || 'Guru Pembimbing BK',
      nip: newCounselorRaw.nip || '-',
      avatar: newCounselorRaw.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120'
    };

    if (targetSchoolId === currentSchoolId) {
      const newList = [...allCounselors.filter(c => c.id !== newCounselor.id), newCounselor];
      setAllCounselors(newList);
      if (makeActive) {
        setActiveCounselor(newCounselor);
        localStorage.setItem('bk_active_counselor_id', newCounselor.id);
      }
      saveSchoolData('bk_counselors', newList, targetSchoolId);
    } else {
      const otherSchoolList = loadSchoolData<Counselor[]>('bk_counselors', [], targetSchoolId);
      const updatedOtherList = [...otherSchoolList.filter(c => c.id !== newCounselor.id), newCounselor];
      saveSchoolData('bk_counselors', updatedOtherList, targetSchoolId);
    }

    saveToFirestore('bk_counselors', newCounselor, targetSchoolId);
    saveAccountRequestToCloud(newCounselor).catch(console.warn);
    window.dispatchEvent(new Event('storage'));
  };

  const handleDeleteCounselor = (id: string) => {
    if (!isValidDeleteId(id)) {
      showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
      return;
    }
    if (allCounselors.length <= 1) {
      showToast('Tidak dapat menghapus satu-satunya profil guru pembimbing.', 'error');
      return;
    }
    const targetCounselor = allCounselors.find(c => c.id === id);
    const targetSchoolId = targetCounselor?.schoolId || getActiveSchoolId();
    let aborted = false;
    let nextActiveFallback: Counselor | null = null;

    setAllCounselors(prev => {
      if (prev.length <= 1) {
        aborted = true;
        return prev;
      }
      const res = safeFilterSingleDelete(prev, id);
      if (!res.ok || res.next.length === 0) {
        aborted = true;
        return prev;
      }
      saveSchoolData('bk_counselors', res.next, targetSchoolId);
      if (activeCounselor.id === id) {
        nextActiveFallback = res.next[0];
      }
      return res.next;
    });

    if (aborted) return;
    if (nextActiveFallback) {
      setActiveCounselor(nextActiveFallback);
      localStorage.setItem('bk_active_counselor_id', (nextActiveFallback as Counselor).id);
    }

    softDeleteFromFirestore('bk_counselors', targetCounselor || id, {
      customSchoolId: targetSchoolId,
      deletedBy: activeCounselor?.name || 'Koordinator BK',
      entityType: 'Akun Konselor'
    });
    deleteAccountRequestFromCloud(id, targetSchoolId).catch(console.warn);
    window.dispatchEvent(new Event('storage'));
    showToast(`Akun "${targetCounselor?.name || 'Konselor'}" berhasil dihapus.`, 'success');
  };

  const handleResetToFreshSchool = () => {
    // 1. Automatically trigger a backup download before clearing
    const fullBackup = {
      app: 'SIKAP-BK',
      version: '2.5.0-pro',
      timestamp: new Date().toISOString(),
      schoolId: getActiveSchoolId(),
      schoolConfig: getSchoolConfig(),
      students,
      violations,
      services,
      logs,
      achievements,
      homeVisits,
      counselors: allCounselors
    };
    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SIKAP_BK_Backup_Sebelum_Reset_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // 2. Empty students, violations, services, logs for the active school
    const currentSchoolId = getActiveSchoolId();
    setStudents([]);
    setViolations([]);
    setServices([]);
    setLogs([]);
    setAchievements([]);
    setHomeVisits([]);

    localStorage.setItem(`bk_cleared_${currentSchoolId}`, 'true');
    setCloudCollectionData('bk_students', [], currentSchoolId);
    setCloudCollectionData('bk_violations', [], currentSchoolId);
    setCloudCollectionData('bk_services', [], currentSchoolId);
    setCloudCollectionData('bk_logs', [], currentSchoolId);
    setCloudCollectionData('bk_achievements', [], currentSchoolId);
    setCloudCollectionData('bk_home_visits', [], currentSchoolId);

    saveBulkToFirestore('bk_students', [], currentSchoolId, true);
    saveBulkToFirestore('bk_violations', [], currentSchoolId, true);
    saveBulkToFirestore('bk_services', [], currentSchoolId, true);
    saveBulkToFirestore('bk_logs', [], currentSchoolId, true);

    window.dispatchEvent(new Event('storage'));
    showToast('Database sekolah siap! Berkas cadangan otomatis telah diunduh.', 'success');
  };

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Sub-tab state for Layanan BK with slide animation direction tracking
  const [layananSubTab, setLayananSubTab] = useState<'sesi' | 'homevisit' | 'panggilan'>('sesi');
  const [layananTabDirection, setLayananTabDirection] = useState<number>(1);

  // Mobile navigation drawer toggle
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Core database states fed ONLY by Firestore onSnapshot (never seeded from localStorage or mockData)
  const [firebaseConnectionError, setFirebaseConnectionError] = useState<string | null>(() => {
    const info = getCloudConnectionInfo();
    return (info.status === 'error' || info.status === 'quota_exceeded') && info.lastError ? info.lastError : null;
  });

  const [students, setStudents] = useState<Student[]>([]);
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [services, setServices] = useState<CounselingService[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [homeVisits, setHomeVisits] = useState<any[]>([]);
  const [programEvaluations, setProgramEvaluations] = useState<ProgramEvaluation[]>([]);
  const [serviceEvaluations, setServiceEvaluations] = useState<ProgramEvaluation[]>([]);

  // Modal & Filter states for Layanan BK
  const [editingService, setEditingService] = useState<CounselingService | null>(null);
  const [detailService, setDetailService] = useState<CounselingService | null>(null);
  const [pendingPostSaveService, setPendingPostSaveService] = useState<CounselingService | null>(null);
  const [globalEvalServiceTarget, setGlobalEvalServiceTarget] = useState<CounselingService | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    step: 1 | 2;
    onConfirm: () => void;
  } | null>(null);
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'semua' | 'Terjadwal' | 'Selesai' | 'Dibatalkan'>('semua');
  const [servicePillarFilter, setServicePillarFilter] = useState<'semua' | BKComponentType>('semua');
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [selectedAbsensiClass, setSelectedAbsensiClass] = useState<string | undefined>(undefined);

  // Global Floating Si Becik states (position, visibility, keyboard hide, persistent toggle, real badge)
  const [isSiBecikOpen, setIsSiBecikOpen] = useState<boolean>(false);
  const [siBecikFabEnabled, setSiBecikFabEnabled] = useState<boolean>(() => getLocalSiBecikFabEnabled());
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);
  const [siBecikUnread, setSiBecikUnreadState] = useState<boolean>(() => getSiBecikUnread());
  const [overdueFollowUpIds, setOverdueFollowUpIds] = useState<string[]>([]);
  const [seenOverdueIds, setSeenOverdueIds] = useState<string[]>(() => getSeenOverdueIds());

  // Global keyboard & input focus listener so FAB auto-hides when user is typing anywhere
  useEffect(() => {
    const isEditableElement = (el: EventTarget | null): boolean => {
      if (!el || !(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      return el.isContentEditable;
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (isEditableElement(e.target)) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        if (!isEditableElement(document.activeElement)) {
          setIsKeyboardOpen(false);
        }
      }, 80);
    };

    const handleViewportResize = () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        const keyboardVisible = window.visualViewport.height < window.innerHeight * 0.75;
        if (keyboardVisible) {
          setIsKeyboardOpen(true);
        } else if (!isEditableElement(document.activeElement)) {
          setIsKeyboardOpen(false);
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    window.visualViewport?.addEventListener('resize', handleViewportResize);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  useEffect(() => {
    if (!isSiBecikOpen) {
      setIsKeyboardOpen(false);
    }
  }, [isSiBecikOpen, currentView]);

  // Redirect URL lama /catat, /catat-pelanggaran, /catat-kasus ke halaman Rujukan dari Piket
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkAndRedirectOldCatatRoute = () => {
      const path = window.location.pathname || '';
      const hash = window.location.hash || '';
      const isOldPath = /^\/catat(-pelanggaran|-kasus)?\/?$/i.test(path);
      const isOldHash = /^#\/?catat(-pelanggaran|-kasus)?\/?$/i.test(hash);
      if (isOldPath || isOldHash) {
        setCurrentView('rujukan-piket');
        try {
          window.history.replaceState(null, '', '/rujukan');
        } catch {
          // ignore history error
        }
        showToast('Menu Catat Pelanggaran kini dialihkan ke Rujukan dari Piket.', 'info');
      }
    };
    checkAndRedirectOldCatatRoute();
    window.addEventListener('popstate', checkAndRedirectOldCatatRoute);
    window.addEventListener('hashchange', checkAndRedirectOldCatatRoute);
    return () => {
      window.removeEventListener('popstate', checkAndRedirectOldCatatRoute);
      window.removeEventListener('hashchange', checkAndRedirectOldCatatRoute);
    };
  }, []);

  // Sync Si Becik FAB preference from Firestore userSettings & compute real >14 day overdue follow-ups
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    const schoolId = activeCounselor?.schoolId || getActiveSchoolId();

    void loadSiBecikFabSettingsFromFirestore(activeCounselor?.id, schoolId).then((remoteVal) => {
      if (!cancelled && typeof remoteVal === 'boolean') {
        setSiBecikFabEnabled(remoteVal);
      }
    });

    void fetchOverdueFollowUpIdsFromFirestore(schoolId, serviceEvaluations).then((ids) => {
      if (!cancelled) {
        setOverdueFollowUpIds(ids);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, activeCounselor?.id, activeCounselor?.schoolId, serviceEvaluations]);

  // Initialize Firebase Realtime Firestore Synchronization, Theme & Connection Health on mount
  useEffect(() => {
    runStartupStorageCheck();
    applyTheme(getIsDarkMode());

    const initialSchoolId = getActiveSchoolId();
    const checkCounselors = loadSchoolData<Counselor[]>('bk_counselors', [], initialSchoolId);
    if (!checkCounselors || checkCounselors.length < 5) {
      const mergedCounselors = [...counselors];
      if (checkCounselors && checkCounselors.length > 0) {
        checkCounselors.forEach(c => {
          const idx = mergedCounselors.findIndex(mc => mc.id === c.id || mc.username === c.username);
          if (idx !== -1) mergedCounselors[idx] = { ...mergedCounselors[idx], ...c };
          else mergedCounselors.push(c);
        });
      }
      saveSchoolData('bk_counselors', mergedCounselors, initialSchoolId);
      setAllCounselors(mergedCounselors);
    }

    // Ensure active counselor defaults to Bapak Aulia Aji Sasongko if missing or admin
    const savedActiveCounselorId = localStorage.getItem('bk_active_counselor_id');
    if (!savedActiveCounselorId || savedActiveCounselorId === 'admin') {
      localStorage.setItem('bk_active_counselor_id', 'c1');
    }

    // Verify Firebase connection immediately & listen for status errors
    testConnection().then((res) => {
      if (!res.ok && res.error) {
        setFirebaseConnectionError(res.error);
      } else if (res.ok) {
        setFirebaseConnectionError(null);
      }
    }).catch((err: any) => {
      setFirebaseConnectionError(err?.message || String(err));
    });

    const handleCloudStatus = (e: any) => {
      const info = e?.detail;
      if (!info) return;
      if ((info.status === 'error' || info.status === 'quota_exceeded') && info.lastError) {
        setFirebaseConnectionError(info.lastError);
      } else if (info.status === 'connected') {
        setFirebaseConnectionError(null);
      }
    };
    window.addEventListener('bk_cloud_status', handleCloudStatus);

    // Only start full Firestore realtime sync once Guru BK is logged in
    if (isLoggedIn) {
      initRealtimeFirestoreSync();
      forceFullCloudSync().catch((err: any) => {
        setFirebaseConnectionError(err?.message || String(err));
      });
      ensureDriveFolderStructure().catch(console.warn);
      ensureSchoolDocumentExists(initialSchoolId).catch(console.warn);
    }

    const handleGoogleSessionRestored = (e: any) => {
      const tok = e?.detail?.token;
      ensureDriveFolderStructure(tok, true).catch(console.warn);
    };
    window.addEventListener('bk_google_session_restored', handleGoogleSessionRestored as EventListener);

    const handleRealtimeSync = (e: any) => {
      const eventType = e.detail?.type;
      const key = e.detail?.key;
      const data = e.detail?.data;
      const itemId = e.detail?.itemId;
      const schoolId = e.detail?.schoolId;
      const activeSchoolId = getActiveSchoolId();

      if (schoolId && schoolId !== activeSchoolId && key !== 'bk_counselors') {
        return;
      }
      if (!key) return;

      if (eventType === 'doc_deleted' && isValidDeleteId(itemId)) {
        const cleanTarget = String(itemId).trim();
        if (key === 'bk_students') {
          setStudents(prev => safeFilterSingleDelete(prev, cleanTarget).next);
        } else if (key === 'bk_violations' || key === 'bk_cases') {
          setViolations(prev => safeFilterSingleDelete(prev, cleanTarget).next);
        } else if (key === 'bk_services' || key === 'bk_counseling') {
          setServices(prev => safeFilterSingleDelete(prev, cleanTarget).next);
        } else if (key === 'bk_logs') {
          setLogs(prev => safeFilterSingleDelete(prev, cleanTarget).next);
        } else if (key === 'bk_achievements' || key === 'bk_student_achievements') {
          setAchievements(prev => safeFilterSingleDelete(prev, cleanTarget).next);
        } else if (key === 'bk_home_visits') {
          setHomeVisits(prev => safeFilterSingleDelete(prev, cleanTarget).next);
        } else if (key === 'bk_program_evaluations') {
          setProgramEvaluations(prev => safeFilterSingleDelete(prev, cleanTarget).next);
        } else if (key === 'bk_service_evaluations') {
          setServiceEvaluations(prev => safeFilterSingleDelete(prev, cleanTarget).next);
        }
        return;
      }

      const getSafeData = (k: string) => {
        if (Array.isArray(data)) return data;
        return getCloudCollectionData(k, activeSchoolId);
      };

      if (key === 'bk_students') {
        const val = getSafeData('bk_students');
        if (Array.isArray(val)) setStudents(val);
      } else if (key === 'bk_violations' || key === 'bk_cases') {
        const val = getSafeData('bk_violations');
        if (Array.isArray(val)) setViolations(val);
      } else if (key === 'bk_services' || key === 'bk_counseling') {
        const val = getSafeData('bk_services');
        if (Array.isArray(val)) setServices(val);
      } else if (key === 'bk_logs') {
        const val = getSafeData('bk_logs');
        if (Array.isArray(val)) setLogs(val.slice(0, 80));
      } else if (key === 'bk_achievements' || key === 'bk_student_achievements') {
        const val = getSafeData('bk_achievements');
        if (Array.isArray(val)) setAchievements(val);
      } else if (key === 'bk_home_visits') {
        const val = getSafeData('bk_home_visits');
        if (Array.isArray(val)) setHomeVisits(val);
      } else if (key === 'bk_program_evaluations') {
        const val = getSafeData('bk_program_evaluations');
        if (Array.isArray(val)) setProgramEvaluations(val);
      } else if (key === 'bk_service_evaluations') {
        const val = getSafeData('bk_service_evaluations');
        if (Array.isArray(val)) setServiceEvaluations(val);
      } else if (key === 'bk_counselors') {
        const val = getSafeData('bk_counselors');
        if (val && Array.isArray(val) && val.length > 0) {
          setAllCounselors(prev => {
            const map = new Map<string, Counselor>();
            (prev || []).forEach(c => map.set(c.id, c));
            val.forEach((c: Counselor) => {
              const existing = map.get(c.id);
              const merged = { ...(existing || {}), ...c };
              map.set(c.id, {
                ...merged,
                allowedClasses: Array.isArray(merged.allowedClasses) ? merged.allowedClasses : [],
                role: merged.role || 'Guru Pembimbing BK',
                nip: merged.nip || '-',
                avatar: merged.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120'
              });
            });
            return Array.from(map.values());
          });
        }
      } else if (key === 'bk_walikelas_config') {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('storage'));
        }
      }
    };

    const handleAccountRequestsUpdated = (e: any) => {
      const requests = e.detail?.requests;
      if (Array.isArray(requests)) {
        const curSchoolId = getActiveSchoolId();
        const schoolRequests = requests.filter((req: Counselor) => {
          const reqSchoolId = req.schoolId ? sanitizeSchoolId(req.schoolId) : '';
          const reqNpsn = (req as any).schoolNpsn ? sanitizeSchoolId((req as any).schoolNpsn) : '';
          if (reqSchoolId === curSchoolId || reqNpsn === curSchoolId) return true;
          if (!reqSchoolId && !reqNpsn && curSchoolId === 'sch_20320123') return true;
          return false;
        });

        if (schoolRequests.length > 0) {
          setAllCounselors(prev => {
            const map = new Map<string, Counselor>();
            (prev || []).forEach(c => map.set(c.id, c));
            schoolRequests.forEach((req: Counselor) => {
              const existing = map.get(req.id);
              const merged = { ...(existing || {}), ...req, schoolId: curSchoolId };
              map.set(req.id, {
                ...merged,
                allowedClasses: Array.isArray(merged.allowedClasses) ? merged.allowedClasses : [],
                role: merged.role || 'Guru Pembimbing BK',
                nip: merged.nip || '-',
                avatar: merged.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120'
              });
            });
            return Array.from(map.values());
          });
        }
      }
    };

    const handleSchoolChanged = (e: any) => {
      const newSchoolId = e.detail?.schoolId || getActiveSchoolId();
      setStudents(getCloudCollectionData<Student>('bk_students', newSchoolId));
      setViolations(getCloudCollectionData<ViolationRecord>('bk_violations', newSchoolId));
      setServices(getCloudCollectionData<CounselingService>('bk_services', newSchoolId));
      setLogs(getCloudCollectionData<ActivityLog>('bk_logs', newSchoolId).slice(0, 80));
      setAchievements(getCloudCollectionData<any>('bk_achievements', newSchoolId));
      setHomeVisits(getCloudCollectionData<any>('bk_home_visits', newSchoolId));
      setProgramEvaluations(getCloudCollectionData<ProgramEvaluation>('bk_program_evaluations', newSchoolId));
      setServiceEvaluations(getCloudCollectionData<ProgramEvaluation>('bk_service_evaluations', newSchoolId));

      const loadedCounselors = loadSchoolData('bk_counselors', counselors, newSchoolId);
      if (loadedCounselors && loadedCounselors.length > 0) {
        setAllCounselors(loadedCounselors);
        const savedActiveId = localStorage.getItem('bk_active_counselor_id');
        const matched = loadedCounselors.find(c => c.id === savedActiveId) || loadedCounselors.find(c => c.id === 'c1' || c.name?.toLowerCase().includes('aulia'));
        if (matched) {
          setActiveCounselor(matched);
        } else {
          setActiveCounselor(loadedCounselors[0]);
        }
      }
    };

    window.addEventListener('bk_realtime_sync', handleRealtimeSync);
    window.addEventListener('bk_school_changed', handleSchoolChanged);
    window.addEventListener('bk_account_requests_updated', handleAccountRequestsUpdated);

    return () => {
      window.removeEventListener('bk_cloud_status', handleCloudStatus);
      window.removeEventListener('bk_realtime_sync', handleRealtimeSync);
      window.removeEventListener('bk_school_changed', handleSchoolChanged);
      window.removeEventListener('bk_account_requests_updated', handleAccountRequestsUpdated);
      window.removeEventListener('bk_google_session_restored', handleGoogleSessionRestored as EventListener);
    };
  }, []);

  useEffect(() => {
    saveSchoolData('bk_counselors', allCounselors);
  }, [allCounselors]);

  // Background Auto-Sync Trigger when core data changes (debounced to avoid network spikes)
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Run the background sync quietly with debounce to keep Google Sheets up-to-date smoothly
    const timer = setTimeout(() => {
      triggerBackgroundAutoSync();
    }, 2500);

    return () => clearTimeout(timer);
  }, [students, violations, services, achievements]);

  const handleOpenSiBecik = () => {
    setIsSiBecikOpen(true);
    setSiBecikUnreadState(false);
    setSiBecikUnread(false);
    if (overdueFollowUpIds.length > 0) {
      const updatedSeen = markOverdueIdsSeen(overdueFollowUpIds);
      setSeenOverdueIds(updatedSeen);
    }
  };

  const handleToggleSiBecikFab = (next: boolean) => {
    setSiBecikFabEnabled(next);
    void saveSiBecikFabSettings(next, activeCounselor?.id, activeCounselor?.schoolId || getActiveSchoolId());
    showToast(
      next
        ? 'Tombol melayang Si Becik aktif di semua halaman.'
        : 'Tombol melayang Si Becik disembunyikan. Anda tetap bisa membukanya dari Menu Lainnya > Si Becik.',
      'info'
    );
  };

  // Global search navigation trigger
  const handleNavigateToStudentTab = () => {
    setCurrentView('data-siswa');
  };

  // Centralized tab navigation with contextual parameter passing
  const handleNavigateToTab = (
    tab: string,
    searchQueryOrClass?: string,
    presetJournal?: {
      className?: string;
      topic?: string;
      subject?: string;
      startTime?: string;
      endTime?: string;
      period?: string;
    }
  ) => {
    if (tab === 'si-becik') {
      handleOpenSiBecik();
      return;
    }
    if (tab === 'absensi' && searchQueryOrClass) {
      setSelectedAbsensiClass(searchQueryOrClass);
    }
    if (presetJournal) {
      setPresetJournalData(presetJournal);
    }
    if (tab === 'data-siswa' && searchQueryOrClass) {
      setSearchQuery(searchQueryOrClass);
    }
    if (tab === 'home-visit' || tab === 'homevisit') {
      const currentIdx = layananSubTab === 'sesi' ? 0 : layananSubTab === 'homevisit' ? 1 : 2;
      setLayananTabDirection(1 >= currentIdx ? 1 : -1);
      setLayananSubTab('homevisit');
      setCurrentView('layanan-bk');
    } else if (tab === 'panggilan-ortu' || tab === 'panggilan-orang-tua' || tab === 'panggilan') {
      const currentIdx = layananSubTab === 'sesi' ? 0 : layananSubTab === 'homevisit' ? 1 : 2;
      setLayananTabDirection(2 >= currentIdx ? 1 : -1);
      setLayananSubTab('panggilan');
      setCurrentView('layanan-bk');
    } else if (tab === 'tambah-layanan' || tab === 'input-konseling' || tab === 'layanan-konseling' || tab === 'konseling') {
      setCurrentView('tambah-layanan');
    } else if (
      tab === 'catat' ||
      tab === 'catat-pelanggaran' ||
      tab === 'catat-kasus' ||
      tab === 'rujukan-piket' ||
      tab === 'rujukan'
    ) {
      setRujukanInitialSearch(searchQueryOrClass || '');
      setCurrentView('rujukan-piket');
      if (tab.startsWith('catat')) {
        showToast('Menu Catat Pelanggaran dialihkan ke Rujukan dari Piket.', 'info');
      }
    } else if (
      tab === 'pelanggaran' ||
      tab === 'arsip-pembinaan' ||
      tab === 'arsip-pelanggaran' ||
      tab === 'arsip-restitusi'
    ) {
      setViolationInitialOpenId(undefined);
      if (searchQueryOrClass) {
        setViolationInitialSearch(searchQueryOrClass);
        setViolationInitialTab('arsip');
      } else {
        setViolationInitialTab('arsip');
        setViolationInitialSearch('');
      }
      setCurrentView('arsip-pembinaan');
    } else if (tab === 'profil-siswa' || tab === 'profil' || tab === 'profile') {
      if (searchQueryOrClass) {
        const matched = students.find(
          (s) =>
            s.id === searchQueryOrClass ||
            (s.name && s.name.trim().toLowerCase() === searchQueryOrClass.trim().toLowerCase())
        );
        if (matched) {
          setSelectedProfileStudentId(matched.id);
        } else {
          const classMatch = searchQueryOrClass.match(/\((\d+[A-Za-z]?)\)/);
          if (classMatch) {
            const cls = classMatch[1];
            const inClass = students.filter((s) => s.class.includes(cls));
            if (inClass.length > 0) {
              const numMatch = searchQueryOrClass.match(/Siswa\s+(\d+)/i);
              const idx = numMatch ? Math.max(0, parseInt(numMatch[1], 10) - 1) : 0;
              setSelectedProfileStudentId(inClass[idx % inClass.length].id);
            }
          } else {
            setSelectedProfileStudentId(searchQueryOrClass);
          }
        }
      }
      setPreviousView(currentView);
      setCurrentView('profil-siswa');
    } else if (tab === 'peringatan') {
      if (
        searchQueryOrClass === 'restitusi' ||
        searchQueryOrClass === 'belum-dievaluasi' ||
        searchQueryOrClass === 'followup' ||
        searchQueryOrClass === 'semua'
      ) {
        setPeringatanFilter(searchQueryOrClass);
      } else {
        setPeringatanFilter('semua');
      }
      setCurrentView('peringatan');
    } else {
      setCurrentView(tab);
    }
  };

  // Navigasi cepat langsung ke Profil Siswa Khusus Guru BK
  const handleNavigateToProfile = (studentIdOrName: string) => {
    handleNavigateToTab('profil-siswa', studentIdOrName);
  };

  // Safe navigation form trigger with contextual student parameter binding
  const handleNavigateToForm = (form: string, selectStudentId?: string) => {
    setPreSelectedStudentId(selectStudentId);
    if (form === 'panggilan-ortu' || form === 'panggilan-orang-tua' || form === 'panggilan') {
      setLayananSubTab('panggilan');
      setCurrentView('layanan-bk');
    } else if (form === 'home-visit' || form === 'homevisit') {
      setLayananSubTab('homevisit');
      setCurrentView('layanan-bk');
    } else if (form === 'input-konseling' || form === 'layanan-konseling' || form === 'konseling' || form === 'tambah-layanan') {
      setCurrentView('tambah-layanan');
    } else if (
      form === 'catat' ||
      form === 'catat-pelanggaran' ||
      form === 'catat-kasus' ||
      form === 'rujukan-piket' ||
      form === 'rujukan'
    ) {
      setCurrentView('rujukan-piket');
      if (form.startsWith('catat')) {
        showToast('Menu Catat Pelanggaran dialihkan ke Rujukan dari Piket.', 'info');
      }
    } else if (form === 'pelanggaran' || form === 'arsip-pembinaan') {
      setViolationInitialTab('arsip');
      setCurrentView('arsip-pembinaan');
    } else if (form === 'apresiasi' || form === 'catat-apresiasi') {
      setCurrentView('apresiasi');
    } else {
      setCurrentView(form);
    }
  };

  // State trigger: Add standard student
  const handleAddStudent = (newStudent: Omit<Student, 'id' | 'initials'>) => {
    const schoolValidation = getValidatedSchoolIdentity(activeCounselor);
    if (!schoolValidation.ok) {
      showToast('Gagal: Sekolah belum diatur', 'error');
      return;
    }

    const nameWords = newStudent.name.trim().split(' ');
    const initials = nameWords.map((w) => w[0]).join('').substring(0, 2).toUpperCase();

    const stamp = buildSchoolStamp(schoolValidation, activeCounselor?.name || 'Guru BK');
    const currentSchoolId = schoolValidation.schoolId;
    const added: Student = {
      ...newStudent,
      ...stamp,
      id: generateUniqueId('s'),
      initials,
    };

    setStudents((prev) => [added, ...prev.filter((s) => s.id !== added.id)]);
    saveToFirestore('bk_students', added, currentSchoolId);
    showToast(`✅ Data siswa "${added.name}" berhasil disimpan!`, 'success');
  };

  // State trigger: Update student profile
  const handleUpdateStudent = (updatedStudent: Student) => {
    const currentSchoolId = activeCounselor?.schoolId || getActiveSchoolId();
    const currentSchoolName = activeCounselor?.schoolName || getSchoolConfig(currentSchoolId).schoolName || 'SMP N 2 Susukan';
    const nameWords = updatedStudent.name.trim().split(' ');
    const initials = nameWords.map((w) => w[0]).join('').substring(0, 2).toUpperCase();
    const studentWithInitials: Student = { 
      ...updatedStudent, 
      initials, 
      schoolId: updatedStudent.schoolId || currentSchoolId,
      schoolName: updatedStudent.schoolName || currentSchoolName
    };

    setStudents((prev) => prev.map((s) => (s.id === updatedStudent.id ? studentWithInitials : s)));
    saveToFirestore('bk_students', studentWithInitials, currentSchoolId);
    showToast(`✅ Profil siswa "${studentWithInitials.name}" berhasil diperbarui!`, 'success');
  };

  // State trigger: Soft delete student (persists to Firestore + hapusLog)
  const executeDeleteStudent = (id: string) => {
    if (!isValidDeleteId(id)) {
      showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
      return;
    }
    const cleanId = String(id).trim();
    const currentSchoolId = getActiveSchoolId();
    const targetStudent = students.find((s) => String(s.id).trim() === cleanId);
    let aborted = false;

    setStudents((prev) => {
      const res = safeFilterSingleDelete(prev, cleanId);
      if (!res.ok) {
        aborted = true;
        return prev;
      }
      return res.next;
    });

    if (aborted) return;

    registerDeletedId(cleanId);
    softDeleteFromFirestore('bk_students', targetStudent || cleanId, {
      customSchoolId: currentSchoolId,
      deletedBy: activeCounselor?.name || 'Koordinator BK',
      entityType: 'Siswa',
      studentId: cleanId,
      studentName: targetStudent?.name,
      studentClass: targetStudent?.class
    });
    window.dispatchEvent(new Event('storage'));
    showToast(`Siswa "${targetStudent?.name || 'terpilih'}" dihapus`, 'success');
  };

  const handleDeleteStudent = (id: string, skipConfirm: boolean = false) => {
    if (!isValidDeleteId(id)) {
      showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
      return;
    }
    const targetStudent = students.find((s) => String(s.id).trim() === String(id).trim());
    if (!targetStudent) return;
    if (skipConfirm) {
      executeDeleteStudent(id);
      return;
    }
    setDeleteConfirmModal({
      title: 'Hapus 1 Data Siswa',
      message: `Hapus ${targetStudent.name} (${targetStudent.class}) saja? Siswa lain tidak akan terhapus.`,
      confirmLabel: 'Ya, Hapus 1 Ini Saja',
      step: 1,
      onConfirm: () => executeDeleteStudent(id)
    });
  };

  // State trigger: Clear all students via bulk soft-delete
  const handleClearAllStudents = () => {
    const currentSchoolId = getActiveSchoolId();
    const toClear = [...students];

    toClear.forEach((s) => registerDeletedId(s.id));
    setStudents([]);

    localStorage.setItem(`bk_students_cleared_${currentSchoolId}`, 'true');
    localStorage.setItem(`bk_cleared_${currentSchoolId}`, 'true');
    localStorage.setItem('bk_dummy_students_purged', 'true');
    setCloudCollectionData('bk_students', [], currentSchoolId);
    softDeleteBulkStudentsFromFirestore(toClear, activeCounselor?.name || 'Koordinator BK', currentSchoolId);

    window.dispatchEvent(new Event('storage'));
  };

  const pushActivityLog = (newLog: ActivityLog) => {
    const schoolValidation = getValidatedSchoolIdentity(activeCounselor);
    const stampedLog: ActivityLog = schoolValidation.ok
      ? { ...buildSchoolStamp(schoolValidation, activeCounselor?.name || 'Guru BK'), ...newLog }
      : newLog;
    setLogs((prev) => [stampedLog, ...prev.slice(0, 79)]);
    if (schoolValidation.ok) {
      saveToFirestore('bk_logs', stampedLog, schoolValidation.schoolId);
    }
  };

  // State trigger: Record violation and update scores & activity feeds
  const handleSaveViolation = (newViolation: Omit<ViolationRecord, 'id' | 'ticketId'>) => {
    const schoolValidation = getValidatedSchoolIdentity(activeCounselor);
    if (!schoolValidation.ok) {
      showToast('Gagal: Sekolah belum diatur', 'error');
      return;
    }

    const randomTicketNum = Math.floor(1000 + Math.random() * 9000);
    const generatedTicketId = `PLG-${new Date().getFullYear()}-${randomTicketNum}`;
    const currentSchoolId = schoolValidation.schoolId;
    const stamp = buildSchoolStamp(schoolValidation, activeCounselor?.name || newViolation.reportedBy || 'Guru BK');

    const added: ViolationRecord = {
      ...newViolation,
      ...stamp,
      id: generateUniqueId('v'),
      ticketId: generatedTicketId,
      counselorId: activeCounselor?.id,
      reportedBy: newViolation.reportedBy || activeCounselor?.name || 'Guru BK',
    };

    // Optimistic UI update + immediate direct write to Firestore
    setViolations((prev) => [added, ...prev.filter((v) => v.id !== added.id)]);
    saveToFirestore('bk_violations', added, currentSchoolId);

    setStudents((prev) =>
      prev.map((student) => {
        if (student.id === newViolation.studentId) {
          const updatedStudent = {
            ...student,
            violationPoints: (student.violationPoints || 0) + newViolation.pointsAdded,
          };
          saveToFirestore('bk_students', updatedStudent, currentSchoolId);
          return updatedStudent;
        }
        return student;
      })
    );

    // Provide immediate, joyful success feedback
    showToast(
      `✅ Catatan pelanggaran ${newViolation.studentName} (${generatedTicketId}) berhasil disimpan & disinkronkan!`,
      'success'
    );

    // Create live activity feed log
    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;

    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      timeLabel,
      type: 'violation',
      title: `Pelanggaran: ${newViolation.category}`,
      description: `${newViolation.studentName} (${newViolation.studentClass}) dilaporkan di ${newViolation.location}.`,
      studentName: newViolation.studentName,
      studentClass: newViolation.studentClass,
      timestamp: new Date(),
    };

    pushActivityLog(newLog);

    // Automatically link to Jurnal Harian (with sourceType checking)
    autoPushToJournal({
      sourceType: 'violation',
      date: newViolation.date,
      startTime: newViolation.time || '09:00',
      endTime: '09:30',
      activityType: 'Kasus Mendesak',
      title: `Pembinaan Restitusi Pelanggaran: ${newViolation.category}`,
      description: `Pencatatan kasus pelanggaran & pembinaan ${newViolation.studentName} (${newViolation.studentClass}). Lokasi: ${newViolation.location}. Pelapor: ${newViolation.reportedBy}. Catatan: ${newViolation.notes || '-'}`,
      target: `${newViolation.studentName} (${newViolation.studentClass})`,
      status: newViolation.handledBy && newViolation.handledBy !== 'Belum Ditangani' ? 'Selesai' : 'Perlu Tindak Lanjut',
      counselorId: activeCounselor.id,
      proofPhotoUrl: newViolation.proofPhotoUrl,
      proofPhotoName: newViolation.proofPhotoName
    });

    // Otomatis buat dan arsipkan dokumen PDF ke Google Drive (SIKAP-BK/Pelanggaran) agar data aman bila aplikasi crash
    autoArchiveViolationToDrive(added).catch((driveErr) => {
      console.warn('Auto-archive violation to Drive note:', driveErr);
    });

    // Reset pre-selection and route back
    setPreSelectedStudentId(undefined);
    setCurrentView('dashboard');
  };

  // Synchronize attendance violations (Alpa -> Pembinaan)
  const handleSyncAttendanceViolations = (
    attendanceRecords: { studentId: string; studentName: string; nis: string; status: 'H' | 'S' | 'I' | 'A'; notes?: string }[],
    date: string,
    className: string,
    pointWeight: number
  ) => {
    const schoolValidation = getValidatedSchoolIdentity(activeCounselor);
    if (!schoolValidation.ok) {
      showToast('Gagal: Sekolah belum diatur', 'error');
      return 0;
    }
    let syncedCount = 0;

    // Identify alpa students and non-alpa students
    const alpaRecords = attendanceRecords.filter((r) => r.status === 'A');
    const presentOrExcusedIds = attendanceRecords.filter((r) => r.status !== 'A').map((r) => r.studentId);

    // 1. Remove previously auto-synced violations for students who are no longer marked 'A' on this date
    let updatedViolations = [...violations];
    let pointsToRemoveByStudent: Record<string, number> = {};

    updatedViolations = updatedViolations.filter((v) => {
      const isAutoSyncedAtt =
        v.date === date &&
        v.location === 'Absensi Harian Sekolah' &&
        v.category.includes('Tanpa Keterangan');

      if (isAutoSyncedAtt && presentOrExcusedIds.includes(v.studentId)) {
        pointsToRemoveByStudent[v.studentId] = (pointsToRemoveByStudent[v.studentId] || 0) + v.pointsAdded;
        registerDeletedId(v.id);
        return false;
      }
      return true;
    });

    // Deduct points from students whose Alpa status was removed
    if (Object.keys(pointsToRemoveByStudent).length > 0) {
      setStudents((prev) =>
        prev.map((student) => {
          if (pointsToRemoveByStudent[student.id]) {
            return {
              ...student,
              violationPoints: Math.max(0, student.violationPoints - pointsToRemoveByStudent[student.id]),
            };
          }
          return student;
        })
      );
    }

    // 2. Add violations for students currently marked 'A'
    const newViolationsToAdd: ViolationRecord[] = [];
    const pointsToAddByStudent: Record<string, number> = {};

    alpaRecords.forEach((rec) => {
      // Check if violation already exists for this student on this date
      const alreadyExists = updatedViolations.some(
        (v) =>
          v.studentId === rec.studentId &&
          v.date === date &&
          v.location === 'Absensi Harian Sekolah' &&
          v.category.includes('Tanpa Keterangan')
      );

      if (!alreadyExists) {
        const studentObj = students.find((s) => s.id === rec.studentId);
        const studentName = studentObj ? studentObj.name : rec.studentName;
        const randomTicketNum = Math.floor(1000 + Math.random() * 9000);
        const generatedTicketId = `PLG-${new Date().getFullYear()}-${randomTicketNum}`;

        const stamp = buildSchoolStamp(schoolValidation, activeCounselor?.name || 'Guru BK');
        const newV: ViolationRecord = {
          ...stamp,
          id: `v-att-${rec.studentId}-${date}-${Date.now()}`,
          ticketId: generatedTicketId,
          studentId: rec.studentId,
          studentName,
          studentClass: className,
          category: 'Kedisiplinan & Ketertiban: Tidak Masuk Tanpa Keterangan (Alpa)',
          pointsAdded: pointWeight,
          date,
          time: '07:30',
          location: 'Absensi Harian Sekolah',
          reportedBy: `Absensi Harian (${activeCounselor.name})`,
          notes: rec.notes
            ? `Absensi Alpa: ${rec.notes}`
            : `Tidak masuk tanpa keterangan pada tanggal ${date} (Diinput via Absensi Harian)`,
          handledBy: 'Belum Ditangani',
          counselorId: activeCounselor?.id,
        };

        newViolationsToAdd.push(newV);
        pointsToAddByStudent[rec.studentId] = (pointsToAddByStudent[rec.studentId] || 0) + pointWeight;
        syncedCount++;
      }
    });

    if (newViolationsToAdd.length > 0) {
      updatedViolations = [...newViolationsToAdd, ...updatedViolations];

      // Save each new violation to Firestore in real-time
      newViolationsToAdd.forEach((v) => {
        saveToFirestore('bk_violations', v).catch(console.warn);
      });

      // Update student points & persist to Firestore
      setStudents((prev) => {
        const nextStudents = prev.map((student) => {
          if (pointsToAddByStudent[student.id]) {
            const updatedStudent = {
              ...student,
              violationPoints: student.violationPoints + pointsToAddByStudent[student.id],
            };
            saveToFirestore('bk_students', updatedStudent).catch(console.warn);
            return updatedStudent;
          }
          return student;
        });
        return nextStudents;
      });

      // Create logs for each new violation
      const today = new Date();
      const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
        today.getMinutes()
      ).padStart(2, '0')}`;
      const timeLabel = `HARI INI, ${formattedHour}`;

      const newLogs: ActivityLog[] = newViolationsToAdd.map((v) => ({
        id: `log-att-${v.id}`,
        timeLabel,
        type: 'violation',
        title: `Pelanggaran Absensi (Alpa)`,
        description: `${v.studentName} (${v.studentClass}) dicatat Alpa pada ${date}. (+${v.pointsAdded} Bobot).`,
        studentName: v.studentName,
        studentClass: v.studentClass,
        timestamp: new Date(),
      }));

      newLogs.forEach((log) => {
        saveToFirestore('bk_logs', log).catch(console.warn);
      });

      setLogs((prev) => [...newLogs, ...prev].slice(0, 80));
    }

    setViolations(updatedViolations);
    return syncedCount;
  };

  // State trigger: Record counseling session, update services count and activity logs
  const handleSaveService = (newService: Omit<CounselingService, 'id'>) => {
    const schoolValidation = getValidatedSchoolIdentity(activeCounselor);
    if (!schoolValidation.ok) {
      showToast('Gagal: Sekolah belum diatur', 'error');
      return;
    }

    const currentSchoolId = schoolValidation.schoolId;
    const stamp = buildSchoolStamp(schoolValidation, newService.counselorName || activeCounselor?.name || 'Guru BK');
    const added: CounselingService = {
      ...newService,
      ...stamp,
      id: (newService as Partial<CounselingService>).id || generateUniqueId('srv'),
    };

    // Optimistic UI update + immediate direct write to Firestore
    setServices((prev) => [added, ...prev.filter((s) => s.id !== added.id)]);
    saveToFirestore('bk_services', added, currentSchoolId);

    if (added.linkedViolationId || added.linkedTicketId) {
      const vId = added.linkedViolationId;
      const tId = added.linkedTicketId;
      setViolations((prevViolations) =>
        prevViolations.map((v) => {
          if ((vId && v.id === vId) || (tId && v.ticketId === tId)) {
            const updatedV: ViolationRecord = {
              ...v,
              handledBy: 'Guru BK',
              handlingProgress: `Telah ditindaklanjuti via sesi ${added.serviceType} (${added.date || 'Hari ini'}) oleh ${added.counselorName || 'Guru BK'}. Hasil: ${added.output || 'Telah disepakati komitmen perbaikan perilaku/restitusi.'}`,
            };
            saveToFirestore('bk_violations', updatedV, currentSchoolId);
            return updatedV;
          }
          return v;
        })
      );
    }
    setPresetServiceData(null);

    const participantIds = newService.students.map((s) => s.id);
    setStudents((prev) =>
      prev.map((student) => {
        if (participantIds.includes(student.id)) {
          const updatedStudent = {
            ...student,
            bkServicesCount: (student.bkServicesCount || 0) + 1,
          };
          saveToFirestore('bk_students', updatedStudent, currentSchoolId);
          return updatedStudent;
        }
        return student;
      })
    );

    const primaryStudentName = newService.students[0]?.name || 'Siswa';
    showToast(
      `✅ Rekam layanan ${added.serviceType} (${primaryStudentName}) berhasil disimpan & disinkronkan!`,
      'success'
    );

    // Generate recent activity log item
    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;

    const primaryStudentClass = newService.students[0]?.class || '';

    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      timeLabel,
      type: 'counseling',
      title: newService.serviceType,
      description: `Sesi ${newService.status} dengan ${primaryStudentName} ${
        newService.students.length > 1 ? `dan ${newService.students.length - 1} lainnya` : ''
      }. Masalah: ${newService.problem}.`,
      studentName: primaryStudentName,
      studentClass: primaryStudentClass,
      timestamp: new Date(),
    };

    pushActivityLog(newLog);

    // Automatically link to Jurnal Harian
    const targetNamesStr = newService.students.map(s => `${s.name} (${s.class})`).join(', ');
    autoPushToJournal({
      sourceType: 'service',
      date: newService.date,
      startTime: newService.startTime || '08:00',
      endTime: newService.endTime || '08:45',
      activityType: 'Bimbingan Klasikal',
      title: `Rekam Layanan BK (${newService.serviceType}): ${newService.problem}`,
      description: `Sesi ${newService.status}. Rincian Sesi: ${newService.description}. Hasil/Output: ${newService.output}. Tindak Lanjut: ${newService.followUp}`,
      target: targetNamesStr || 'Siswa',
      status: newService.status === 'Selesai' ? 'Selesai' : newService.status === 'Terjadwal' ? 'Dalam Proses' : 'Perlu Tindak Lanjut',
      counselorId: activeCounselor.id,
      proofPhotoUrl: newService.proofPhotoUrl,
      proofPhotoName: newService.proofPhotoName
    });

    // Otomatis buat dan arsipkan dokumen PDF ke Google Drive (SIKAP-BK/Laporan_Layanan) agar data aman bila aplikasi crash
    autoArchiveServiceToDrive(added).catch((driveErr) => {
      console.warn('Auto-archive service to Drive note:', driveErr);
    });

    // Reset pre-selected parameters and IMMEDIATELY show post-save Evaluasi Layanan prompt
    setPreSelectedStudentId(undefined);
    setPendingPostSaveService(added);
  };

  const handleSaveAchievement = (newAchievement: any) => {
    const schoolValidation = getValidatedSchoolIdentity(activeCounselor);
    if (!schoolValidation.ok) {
      showToast('Gagal: Sekolah belum diatur', 'error');
      return;
    }
    const stamp = buildSchoolStamp(schoolValidation, activeCounselor?.name || 'Guru BK');
    const added = {
      ...newAchievement,
      ...stamp,
      id: generateUniqueId('ach')
    };

    setAchievements((prev) => [added, ...prev]);
    saveToFirestore('bk_achievements', added, schoolValidation.schoolId);

    // Update associated student achievementPoints
    setStudents((prevStudents) =>
      prevStudents.map((student) => {
        if (student.id === newAchievement.studentId) {
          const currentAchievements = student.achievementPoints || 0;
          const updated = {
            ...student,
            achievementPoints: currentAchievements + newAchievement.pointsReward,
          };
          saveToFirestore('bk_students', updated);
          return updated;
        }
        return student;
      })
    );

    // Create live activity feed log
    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;

    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      timeLabel,
      type: 'attendance', // Use attendance to color-code or default styling
      title: `Penghargaan Prestasi: ${newAchievement.achievementName}`,
      description: `${newAchievement.studentName} (${newAchievement.studentClass}) meraih penghargaan dengan +${newAchievement.pointsReward} bobot apresiasi.`,
      studentName: newAchievement.studentName,
      studentClass: newAchievement.studentClass,
      timestamp: new Date(),
    };

    pushActivityLog(newLog);

    // Automatically link to Jurnal Harian
    autoPushToJournal({
      sourceType: 'achievement',
      date: newAchievement.date,
      startTime: newAchievement.time || '08:00',
      endTime: '08:30',
      activityType: 'Lain-lain',
      title: `Pemberian Apresiasi / Prestasi: ${newAchievement.achievementName}`,
      description: `Pencatatan prestasi & apresiasi positif siswa ${newAchievement.studentName} (${newAchievement.studentClass}). Kategori: ${newAchievement.category}. Bobot Apresiasi: +${newAchievement.pointsReward}. Catatan: ${newAchievement.notes || '-'}`,
      target: `${newAchievement.studentName} (${newAchievement.studentClass})`,
      status: 'Selesai',
      counselorId: activeCounselor.id
    });
  };

  const handleAddAttendanceActivityLog = (
    title: string,
    description: string,
    studentName: string,
    studentClass: string,
    type: 'attendance'
  ) => {
    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;

    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      timeLabel,
      type,
      title,
      description,
      studentName,
      studentClass,
      timestamp: new Date(),
    };

    pushActivityLog(newLog);
  };

  const handleUpdateViolationStatus = (
    violationId: string,
    handledBy: 'Belum Ditangani' | 'Wali Kelas' | 'Guru BK' | 'Wali Kelas & Guru BK',
    handlingProgress: string
  ) => {
    const currentSchoolId = getActiveSchoolId();
    const targetV = violations.find((v) => v.id === violationId);
    if (targetV) {
      const updatedV: ViolationRecord = {
        ...targetV,
        handledBy,
        handlingProgress,
      };
      setViolations((prev) => prev.map((v) => (v.id === violationId ? updatedV : v)));
      saveToFirestore('bk_violations', updatedV, currentSchoolId);

      const today = new Date();
      const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
        today.getMinutes()
      ).padStart(2, '0')}`;
      const timeLabel = `HARI INI, ${formattedHour}`;

      const newLog: ActivityLog = {
        id: `log-${Date.now()}`,
        timeLabel,
        type: 'violation',
        title: `Penanganan Kasus: ${targetV.studentName}`,
        description: `Kasus "${targetV.category}" ditangani oleh ${handledBy}. Progres: ${handlingProgress}`,
        studentName: targetV.studentName,
        studentClass: targetV.studentClass,
        timestamp: new Date(),
      };
      pushActivityLog(newLog);
    }
  };

  const handleUpdateServiceStatus = (
    serviceId: string,
    status: 'Terjadwal' | 'Selesai' | 'Dibatalkan',
    followUp?: string
  ) => {
    const currentSchoolId = getActiveSchoolId();
    const targetS = services.find((s) => s.id === serviceId);
    if (targetS) {
      const updatedS: CounselingService = {
        ...targetS,
        status,
        followUp: followUp || targetS.followUp,
      };
      setServices((prev) => prev.map((s) => (s.id === serviceId ? updatedS : s)));
      saveToFirestore('bk_services', updatedS, currentSchoolId);

      const today = new Date();
      const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
        today.getMinutes()
      ).padStart(2, '0')}`;
      const timeLabel = `HARI INI, ${formattedHour}`;

      const studentNames = targetS.students.map((st) => st.name).join(', ');
      const newLog: ActivityLog = {
        id: `log-${Date.now()}`,
        timeLabel,
        type: 'counseling',
        title: `Layanan BK ${status}: ${studentNames}`,
        description: `Layanan "${targetS.serviceType}" diubah statusnya menjadi ${status}.`,
        studentName: targetS.students[0]?.name || '',
        studentClass: targetS.students[0]?.class || '',
        timestamp: new Date(),
      };
      pushActivityLog(newLog);
    }
  };

  const executeDeleteViolation = (id: string) => {
    if (!isValidDeleteId(id)) {
      showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
      return;
    }
    const cleanId = String(id).trim();
    const currentSchoolId = getActiveSchoolId();
    const violationToDelete = violations.find(v => String(v.id).trim() === cleanId);
    if (!violationToDelete) return;

    let aborted = false;
    setViolations(prev => {
      const res = safeFilterSingleDelete(prev, cleanId);
      if (!res.ok) {
        aborted = true;
        return prev;
      }
      setCloudCollectionData('bk_violations', res.next, currentSchoolId);
      return res.next;
    });

    if (aborted) return;

    registerDeletedId(cleanId);
    softDeleteFromFirestore('bk_violations', violationToDelete, {
      customSchoolId: currentSchoolId,
      deletedBy: activeCounselor?.name || 'Guru BK',
      entityType: 'Kasus / Pelanggaran'
    });

    setStudents(prevStudents => {
      const updatedStudents = prevStudents.map(student => {
        if (student.id === violationToDelete.studentId) {
          const upd = {
            ...student,
            violationPoints: Math.max(0, student.violationPoints - violationToDelete.pointsAdded)
          };
          saveToFirestore('bk_students', upd, currentSchoolId);
          return upd;
        }
        return student;
      });
      setCloudCollectionData('bk_students', updatedStudents, currentSchoolId);
      return updatedStudents;
    });

    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;
    const newLog: ActivityLog = {
      id: generateUniqueId('log'),
      timeLabel,
      type: 'violation',
      title: `Hapus Pelanggaran: ${violationToDelete.category}`,
      description: `Catatan pelanggaran ${violationToDelete.studentName} (${violationToDelete.studentClass}) telah dihapus. Bobot dikurangi: -${violationToDelete.pointsAdded}.`,
      studentName: violationToDelete.studentName,
      studentClass: violationToDelete.studentClass,
      timestamp: new Date(),
    };
    pushActivityLog(newLog);
    window.dispatchEvent(new Event('storage'));
    showToast(`Kasus "${violationToDelete.category}" berhasil dihapus`, 'success');
  };

  const handleDeleteViolation = (id: string, skipConfirm: boolean = false) => {
    if (!isValidDeleteId(id)) {
      showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
      return;
    }
    const violationToDelete = violations.find(v => String(v.id).trim() === String(id).trim());
    if (!violationToDelete) return;
    if (skipConfirm) {
      executeDeleteViolation(id);
      return;
    }
    setDeleteConfirmModal({
      title: 'Hapus 1 Catatan Kasus / Pelanggaran',
      message: `Hapus kasus "${violationToDelete.category}" milik ${violationToDelete.studentName} (${violationToDelete.studentClass}) saja? Kasus lain tidak akan terhapus.`,
      confirmLabel: 'Ya, Hapus 1 Ini Saja',
      step: 1,
      onConfirm: () => executeDeleteViolation(id)
    });
  };

  const handleUpdateViolation = (updated: ViolationRecord) => {
    const oldViolation = violations.find(v => v.id === updated.id);
    if (!oldViolation) return;

    const currentSchoolId = getActiveSchoolId();
    const ensured: ViolationRecord = {
      ...updated,
      schoolId: updated.schoolId || oldViolation.schoolId || currentSchoolId,
      counselorId: updated.counselorId || oldViolation.counselorId || activeCounselor?.id,
      reportedBy: updated.reportedBy || oldViolation.reportedBy || activeCounselor?.name || 'Guru BK'
    };

    setViolations(prev => prev.map(v => v.id === updated.id ? ensured : v));
    saveToFirestore('bk_violations', ensured, currentSchoolId);

    const pointsDiff = updated.pointsAdded - oldViolation.pointsAdded;
    if (pointsDiff !== 0) {
      setStudents(prevStudents =>
        prevStudents.map(student => {
          if (student.id === updated.studentId) {
            const upd = {
              ...student,
              violationPoints: Math.max(0, student.violationPoints + pointsDiff)
            };
            saveToFirestore('bk_students', upd);
            return upd;
          }
          return student;
        })
      );
    }

    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      timeLabel,
      type: 'violation',
      title: `Perbarui Pelanggaran: ${updated.category}`,
      description: `Data pelanggaran untuk ${updated.studentName} (${updated.studentClass}) diperbarui.`,
      studentName: updated.studentName,
      studentClass: updated.studentClass,
      timestamp: new Date(),
    };
    pushActivityLog(newLog);
  };

  // Simpan Pembinaan 3 Langkah dari FormPembinaanModal (tetap menjaga seluruh field asal rujukan Piket / data lama)
  const handleSavePembinaan = (payload: PembinaanSubmitPayload) => {
    const currentSchoolId = getActiveSchoolId();
    const orig = payload.violation;
    const counselorName = activeCounselor?.name || 'Guru BK';
    const nextRestitutionStatus =
      payload.pembinaanStatus === 'Selesai' ? 'Selesai / Dipantau' : 'Proses Restitusi';

    const updatedViolation: ViolationRecord = {
      ...orig,
      schoolId: orig.schoolId || currentSchoolId,
      counselorId: orig.counselorId || activeCounselor?.id,
      pembinaanDate: payload.pembinaanDate,
      pembinaanKronologi: payload.pembinaanKronologi,
      pembinaanResult: payload.pembinaanResult,
      pembinaanFollowUpPlan: payload.pembinaanFollowUpPlan,
      pembinaanStatus: payload.pembinaanStatus,
      pembinaanCounselor: counselorName,
      handledBy: 'Guru BK',
      handlingProgress:
        payload.pembinaanResult ||
        payload.pembinaanFollowUpPlan ||
        'Pembinaan telah dilakukan oleh Guru BK',
      restitutionStatus: nextRestitutionStatus,
      restitutionAgreement: payload.pembinaanFollowUpPlan || orig.restitutionAgreement,
      restitutionSupervisor: counselorName || orig.restitutionSupervisor || 'Guru BK',
      restitutionCompletedDate:
        payload.pembinaanStatus === 'Selesai'
          ? payload.pembinaanDate
          : orig.restitutionCompletedDate,
      updatedAt: new Date().toISOString(),
    };

    setViolations((prev) => prev.map((v) => (v.id === updatedViolation.id ? updatedViolation : v)));
    saveToFirestore('bk_violations', updatedViolation, currentSchoolId);

    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const catLabel = getRujukanCategoryLabel(orig);
    pushActivityLog({
      id: `log-pembinaan-${Date.now()}`,
      timeLabel: `HARI INI, ${formattedHour}`,
      type: 'violation',
      title: `Pembinaan BK (${payload.pembinaanStatus}): ${orig.studentName}`,
      description: `Tindak lanjut rujukan "${catLabel}" untuk ${orig.studentName} (${orig.studentClass}). Hasil: ${payload.pembinaanResult || '-'}`,
      studentName: orig.studentName,
      studentClass: orig.studentClass,
      timestamp: new Date(),
    });

    autoPushToJournal({
      sourceType: 'violation',
      date: payload.pembinaanDate,
      startTime: formattedHour,
      endTime: formattedHour,
      activityType: 'Kasus Mendesak',
      title: `Pembinaan Rujukan: ${catLabel}`,
      description: `Kronologi & Restitusi: ${payload.pembinaanKronologi}\nHasil: ${payload.pembinaanResult}\nRencana Tindak Lanjut: ${payload.pembinaanFollowUpPlan || '-'}`,
      target: `${orig.studentName} (${orig.studentClass})`,
      status: payload.pembinaanStatus === 'Selesai' ? 'Selesai' : 'Perlu Tindak Lanjut',
      counselorId: activeCounselor?.id,
    });

    setPembinaanTargetViolation(null);
    showToast(
      `Pembinaan ${orig.studentName} berhasil disimpan (${payload.pembinaanStatus}).`,
      'success'
    );

    if (payload.scheduleCounseling) {
      const matchedStudent = filteredStudents.find(
        (s) =>
          s.id === orig.studentId ||
          (s.name &&
            orig.studentName &&
            s.name.trim().toLowerCase() === orig.studentName.trim().toLowerCase())
      );
      const targetStudentId = matchedStudent?.id || orig.studentId;
      setPresetServiceData({
        serviceType: 'Layanan Konseling Perorangan (Individual)',
        bkComponent: 'Layanan Responsif',
        targetType: 'Individu',
        problem: `Pembinaan Rujukan: ${catLabel}`,
        description: `${payload.pembinaanKronologi}${
          payload.pembinaanFollowUpPlan
            ? `\nRencana Tindak Lanjut: ${payload.pembinaanFollowUpPlan}`
            : ''
        }`,
        studentIds: targetStudentId ? [targetStudentId] : [],
        status: 'Terjadwal',
        scheduleDate: payload.pembinaanDate,
        linkedViolationId: orig.id,
        linkedTicketId: orig.ticketId,
        violationContext: {
          category: catLabel,
          pointsAdded: orig.pointsAdded || 0,
          date: orig.date,
          notes: orig.notes,
          ticketId: orig.ticketId,
          violationId: orig.id,
        },
      });
      if (targetStudentId) {
        setPreSelectedStudentId(targetStudentId);
      }
      setCurrentView('tambah-layanan');
    }
  };

  // Tandai Semua Alpa Lama Sudah Dibina (1 klik tanpa menghapus data lama)
  const handleBulkMarkAlpaDone = async (targetItems: ViolationRecord[]) => {
    if (!targetItems || targetItems.length === 0) return;
    const currentSchoolId = getActiveSchoolId();
    const counselorName = activeCounselor?.name || 'Guru BK';
    const nowDate = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const targetIds = new Set(targetItems.map((it) => it.id));

    const updatedMap = new Map<string, ViolationRecord>();
    violations.forEach((v) => {
      if (!targetIds.has(v.id)) return;
      updatedMap.set(v.id, {
        ...v,
        schoolId: v.schoolId || currentSchoolId,
        pembinaanStatus: 'Selesai',
        pembinaanDate: v.pembinaanDate || nowDate,
        pembinaanCounselor: v.pembinaanCounselor || counselorName,
        handledBy: v.handledBy && v.handledBy !== 'Belum Ditangani' ? v.handledBy : 'Guru BK',
        handlingProgress: v.handlingProgress || 'Alpa lama ditandai sudah dibina oleh Guru BK',
        restitutionStatus: 'Selesai / Dipantau',
        restitutionCompletedDate: v.restitutionCompletedDate || nowDate,
        updatedAt: nowIso,
      });
    });

    const updatedItems = Array.from(updatedMap.values());
    if (updatedItems.length === 0) return;

    setViolations((prev) => prev.map((v) => updatedMap.get(v.id) || v));
    await saveBulkToFirestore('bk_violations', updatedItems, currentSchoolId, false, {
      stampMissingSchoolId: true,
    });
    showToast(`${updatedItems.length} catatan Alpa lama ditandai sudah dibina.`, 'success');
  };

  // Arsipkan Semua Data Lama dari daftar Rujukan aktif (tetap tersimpan aman di Firestore & Arsip)
  const handleArchiveAllDataLama = async (targetItems: ViolationRecord[]) => {
    if (!targetItems || targetItems.length === 0) return;
    const currentSchoolId = getActiveSchoolId();
    const counselorName = activeCounselor?.name || 'Guru BK';
    const nowDate = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const targetIds = new Set(targetItems.map((it) => it.id));

    const updatedMap = new Map<string, ViolationRecord>();
    violations.forEach((v) => {
      if (!targetIds.has(v.id)) return;
      updatedMap.set(v.id, {
        ...v,
        schoolId: v.schoolId || currentSchoolId,
        archivedFromRujukan: true,
        pembinaanStatus: v.pembinaanStatus || 'Selesai',
        pembinaanDate: v.pembinaanDate || nowDate,
        pembinaanCounselor: v.pembinaanCounselor || counselorName,
        handledBy: v.handledBy && v.handledBy !== 'Belum Ditangani' ? v.handledBy : 'Guru BK',
        handlingProgress: v.handlingProgress || 'Data lama diarsipkan ke Arsip Pembinaan',
        restitutionStatus: 'Selesai / Dipantau',
        updatedAt: nowIso,
      });
    });

    const updatedItems = Array.from(updatedMap.values());
    if (updatedItems.length === 0) return;

    setViolations((prev) => prev.map((v) => updatedMap.get(v.id) || v));
    await saveBulkToFirestore('bk_violations', updatedItems, currentSchoolId, false, {
      stampMissingSchoolId: true,
    });
    showToast(
      `${updatedItems.length} data lama diarsipkan. Tetap bisa diakses di tab Data Lama & Arsip.`,
      'success'
    );
  };

  const executeDeleteService = (id: string) => {
    if (!isValidDeleteId(id)) {
      showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
      return;
    }
    const cleanId = String(id).trim();
    const currentSchoolId = getActiveSchoolId();
    const serviceToDelete = services.find(s => String(s.id).trim() === cleanId);
    if (!serviceToDelete) return;

    let aborted = false;
    setServices(prev => {
      const res = safeFilterSingleDelete(prev, cleanId);
      if (!res.ok) {
        aborted = true;
        return prev;
      }
      setCloudCollectionData('bk_services', res.next, currentSchoolId);
      return res.next;
    });

    if (aborted) return;

    registerDeletedId(cleanId);
    softDeleteFromFirestore('bk_services', serviceToDelete, {
      customSchoolId: currentSchoolId,
      deletedBy: activeCounselor?.name || 'Guru BK',
      entityType: 'Layanan BK'
    });

    const participantIds = (serviceToDelete.students || []).map(s => s.id);
    setStudents(prevStudents => {
      const updatedStudents = prevStudents.map(student => {
        if (participantIds.includes(student.id)) {
          const upd = {
            ...student,
            bkServicesCount: Math.max(0, student.bkServicesCount - 1)
          };
          saveToFirestore('bk_students', upd, currentSchoolId);
          return upd;
        }
        return student;
      });
      setCloudCollectionData('bk_students', updatedStudents, currentSchoolId);
      return updatedStudents;
    });

    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;
    const primaryStudentName = serviceToDelete.students[0]?.name || 'Siswa';
    const primaryStudentClass = serviceToDelete.students[0]?.class || '';
    const newLog: ActivityLog = {
      id: generateUniqueId('log'),
      timeLabel,
      type: 'counseling',
      title: `Hapus Layanan BK`,
      description: `Arsip sesi layanan bimbingan dengan ${primaryStudentName} telah dihapus.`,
      studentName: primaryStudentName,
      studentClass: primaryStudentClass,
      timestamp: new Date(),
    };
    pushActivityLog(newLog);
    window.dispatchEvent(new Event('storage'));
    showToast(`Layanan "${serviceToDelete.serviceType}" berhasil dihapus`, 'success');
  };

  const handleDeleteService = (id: string, skipConfirm: boolean = false) => {
    if (!isValidDeleteId(id)) {
      showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
      return;
    }
    const serviceToDelete = services.find(s => String(s.id).trim() === String(id).trim());
    if (!serviceToDelete) return;
    if (skipConfirm) {
      executeDeleteService(id);
      return;
    }
    const primaryStudentName = serviceToDelete.students[0]?.name || 'Siswa';
    setDeleteConfirmModal({
      title: 'Hapus 1 Rekam Layanan BK',
      message: `Hapus layanan "${serviceToDelete.serviceType}" untuk ${primaryStudentName} saja? Layanan lain tidak akan terhapus.`,
      confirmLabel: 'Ya, Hapus 1 Ini Saja',
      step: 1,
      onConfirm: () => executeDeleteService(id)
    });
  };

  const handleUpdateService = (updated: CounselingService) => {
    const oldService = services.find(s => s.id === updated.id);
    if (!oldService) return;

    const currentSchoolId = getActiveSchoolId();
    const nowIso = new Date().toISOString();
    const ensuredUpdated: CounselingService = {
      ...updated,
      updatedAt: nowIso,
      createdAt: (updated as any).createdAt || (oldService as any).createdAt || nowIso,
    } as CounselingService;

    setServices(prev => {
      const next = prev.map(s => s.id === ensuredUpdated.id ? ensuredUpdated : s);
      setCloudCollectionData('bk_services', next, currentSchoolId);
      return next;
    });
    saveToFirestore('bk_services', ensuredUpdated, currentSchoolId).catch((err) => {
      showToast('Gagal menyimpan perubahan layanan ke cloud: ' + (err?.message || err), 'error');
    });

    const oldParticipantIds = oldService.students.map(st => st.id);
    const newParticipantIds = ensuredUpdated.students.map(st => st.id);

    const removedIds = oldParticipantIds.filter(id => !newParticipantIds.includes(id));
    const addedIds = newParticipantIds.filter(id => !oldParticipantIds.includes(id));

    if (removedIds.length > 0 || addedIds.length > 0) {
      setStudents(prevStudents => {
        const nextStudents = prevStudents.map(student => {
          if (removedIds.includes(student.id)) {
            const upd = { ...student, bkServicesCount: Math.max(0, student.bkServicesCount - 1), updatedAt: nowIso };
            saveToFirestore('bk_students', upd, currentSchoolId).catch(() => {});
            return upd;
          }
          if (addedIds.includes(student.id)) {
            const upd = { ...student, bkServicesCount: student.bkServicesCount + 1, updatedAt: nowIso };
            saveToFirestore('bk_students', upd, currentSchoolId).catch(() => {});
            return upd;
          }
          return student;
        });
        setCloudCollectionData('bk_students', nextStudents, currentSchoolId);
        return nextStudents;
      });
    }

    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;
    const primaryStudentName = updated.students[0]?.name || 'Siswa';
    const primaryStudentClass = updated.students[0]?.class || '';
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      timeLabel,
      type: 'counseling',
      title: `Perbarui Layanan BK: ${updated.serviceType}`,
      description: `Sesi ${updated.status} diperbarui untuk ${primaryStudentName}. Masalah: ${updated.problem}.`,
      studentName: primaryStudentName,
      studentClass: primaryStudentClass,
      timestamp: new Date(),
    };
    pushActivityLog(newLog);
  };

  const executeDeleteAchievement = (id: string) => {
    if (!isValidDeleteId(id)) {
      showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
      return;
    }
    const cleanId = String(id).trim();
    const currentSchoolId = getActiveSchoolId();
    const achToDelete = achievements.find(a => String(a.id).trim() === cleanId);
    if (!achToDelete) return;

    let aborted = false;
    setAchievements(prev => {
      const res = safeFilterSingleDelete(prev, cleanId);
      if (!res.ok) {
        aborted = true;
        return prev;
      }
      setCloudCollectionData('bk_achievements', res.next, currentSchoolId);
      return res.next;
    });

    if (aborted) return;

    registerDeletedId(cleanId);
    softDeleteFromFirestore('bk_achievements', achToDelete, {
      customSchoolId: currentSchoolId,
      deletedBy: activeCounselor?.name || 'Guru BK',
      entityType: 'Prestasi / Apresiasi'
    });

    setStudents(prevStudents => {
      const updatedStudents = prevStudents.map(student => {
        if (student.id === achToDelete.studentId) {
          const upd = {
            ...student,
            achievementPoints: Math.max(0, (student.achievementPoints || 0) - achToDelete.pointsReward)
          };
          saveToFirestore('bk_students', upd, currentSchoolId);
          return upd;
        }
        return student;
      });
      setCloudCollectionData('bk_students', updatedStudents, currentSchoolId);
      return updatedStudents;
    });

    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;
    const newLog: ActivityLog = {
      id: generateUniqueId('log'),
      timeLabel,
      type: 'attendance',
      title: `Hapus Apresiasi: ${achToDelete.achievementName}`,
      description: `Bobot apresiasi untuk ${achToDelete.studentName} (${achToDelete.studentClass}) telah dihapus. Bobot dikurangi: -${achToDelete.pointsReward}.`,
      studentName: achToDelete.studentName,
      studentClass: achToDelete.studentClass,
      timestamp: new Date(),
    };
    pushActivityLog(newLog);
    window.dispatchEvent(new Event('storage'));
    showToast(`Apresiasi "${achToDelete.achievementName}" berhasil dihapus`, 'success');
  };

  const handleDeleteAchievement = (id: string, skipConfirm: boolean = false) => {
    if (!isValidDeleteId(id)) {
      showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
      return;
    }
    const achToDelete = achievements.find(a => String(a.id).trim() === String(id).trim());
    if (!achToDelete) return;
    if (skipConfirm) {
      executeDeleteAchievement(id);
      return;
    }
    setDeleteConfirmModal({
      title: 'Hapus 1 Bobot Apresiasi',
      message: `Hapus apresiasi "${achToDelete.achievementName}" milik ${achToDelete.studentName} (${achToDelete.studentClass}) saja? Apresiasi lain tidak akan terhapus.`,
      confirmLabel: 'Ya, Hapus 1 Ini Saja',
      step: 1,
      onConfirm: () => executeDeleteAchievement(id)
    });
  };

  const handleUpdateAchievement = (updated: any) => {
    const oldAch = achievements.find(a => a.id === updated.id);
    if (!oldAch) return;

    setAchievements(prev => prev.map(a => a.id === updated.id ? updated : a));
    saveToFirestore('bk_achievements', updated);

    const pointsDiff = updated.pointsReward - oldAch.pointsReward;
    if (pointsDiff !== 0) {
      setStudents(prevStudents =>
        prevStudents.map(student => {
          if (student.id === updated.studentId) {
            const upd = {
              ...student,
              achievementPoints: Math.max(0, (student.achievementPoints || 0) + pointsDiff)
            };
            saveToFirestore('bk_students', upd);
            return upd;
          }
          return student;
        })
      );
    }

    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      timeLabel,
      type: 'attendance',
      title: `Perbarui Apresiasi: ${updated.achievementName}`,
      description: `Data apresiasi diperbarui untuk ${updated.studentName} (${updated.studentClass}). Bobot baru: ${updated.pointsReward}.`,
      studentName: updated.studentName,
      studentClass: updated.studentClass,
      timestamp: new Date(),
    };
    pushActivityLog(newLog);
  };

  const handleSaveEvaluation = (evaluation: ProgramEvaluation) => {
    const schoolValidation = getValidatedSchoolIdentity(activeCounselor);
    if (!schoolValidation.ok) {
      showToast('Gagal: Sekolah belum diatur', 'error');
      return;
    }
    const currentSchoolId = schoolValidation.schoolId;
    const stamp = buildSchoolStamp(schoolValidation, activeCounselor?.name || 'Guru BK', evaluation.createdAt);
    const stamped: ProgramEvaluation = {
      ...evaluation,
      ...stamp,
    };
    setProgramEvaluations((prev) => {
      const exists = prev.some((e) => e.id === stamped.id);
      const next = exists
        ? prev.map((e) => (e.id === stamped.id ? stamped : e))
        : [stamped, ...prev];
      setCloudCollectionData('bk_program_evaluations', next, currentSchoolId);
      return next;
    });
    saveToFirestore('bk_program_evaluations', stamped, currentSchoolId);
  };

  const executeDeleteEvaluation = (id: string) => {
    if (!isValidDeleteId(id)) {
      showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
      return;
    }
    const cleanId = String(id).trim();
    const currentSchoolId = getActiveSchoolId();
    const targetEval = programEvaluations.find(e => String(e.id).trim() === cleanId);
    let aborted = false;

    setProgramEvaluations((prev) => {
      const res = safeFilterSingleDelete(prev, cleanId);
      if (!res.ok) {
        aborted = true;
        return prev;
      }
      setCloudCollectionData('bk_program_evaluations', res.next, currentSchoolId);
      return res.next;
    });

    if (aborted) return;

    registerDeletedId(cleanId);
    softDeleteFromFirestore('bk_program_evaluations', targetEval || cleanId, {
      customSchoolId: currentSchoolId,
      deletedBy: activeCounselor?.name || 'Guru BK',
      entityType: 'Evaluasi Program'
    });
    showToast('1 evaluasi program berhasil dihapus', 'success');
  };

  const handleDeleteEvaluation = (id: string) => {
    if (!isValidDeleteId(id)) {
      showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
      return;
    }
    const targetEval = programEvaluations.find(e => String(e.id).trim() === String(id).trim());
    const label = targetEval?.namaProgram || targetEval?.bidang || 'evaluasi program ini';
    setDeleteConfirmModal({
      title: 'Hapus 1 Evaluasi Program',
      message: `Hapus "${label}" saja? Evaluasi lain tidak akan terhapus.`,
      confirmLabel: 'Ya, Hapus 1 Ini Saja',
      step: 1,
      onConfirm: () => executeDeleteEvaluation(id)
    });
  };

  const handleSaveServiceEvaluation = (evaluation: ProgramEvaluation) => {
    const schoolValidation = getValidatedSchoolIdentity(activeCounselor);
    if (!schoolValidation.ok) {
      showToast('Gagal: Sekolah belum diatur', 'error');
      return;
    }
    const currentSchoolId = schoolValidation.schoolId;
    const stamp = buildSchoolStamp(schoolValidation, activeCounselor?.name || 'Guru BK', evaluation.createdAt);
    const stamped: ProgramEvaluation = {
      ...evaluation,
      ...stamp,
      evaluationScope: 'layanan',
    };
    setServiceEvaluations((prev) => {
      const exists = prev.some((e) => e.id === stamped.id);
      const next = exists
        ? prev.map((e) => (e.id === stamped.id ? stamped : e))
        : [stamped, ...prev];
      setCloudCollectionData('bk_service_evaluations', next, currentSchoolId);
      return next;
    });
    saveToFirestore('bk_service_evaluations', stamped, currentSchoolId);
  };

  const executeDeleteServiceEvaluation = (id: string) => {
    if (!isValidDeleteId(id)) {
      showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
      return;
    }
    const cleanId = String(id).trim();
    const currentSchoolId = getActiveSchoolId();
    const targetEval = serviceEvaluations.find(e => String(e.id).trim() === cleanId);
    let aborted = false;

    setServiceEvaluations((prev) => {
      const res = safeFilterSingleDelete(prev, cleanId);
      if (!res.ok) {
        aborted = true;
        return prev;
      }
      setCloudCollectionData('bk_service_evaluations', res.next, currentSchoolId);
      return res.next;
    });

    if (aborted) return;

    registerDeletedId(cleanId);
    softDeleteFromFirestore('bk_service_evaluations', targetEval || cleanId, {
      customSchoolId: currentSchoolId,
      deletedBy: activeCounselor?.name || 'Guru BK',
      entityType: 'Evaluasi Layanan'
    });
    showToast('1 evaluasi layanan berhasil dihapus', 'success');
  };

  const handleDeleteServiceEvaluation = (id: string) => {
    if (!isValidDeleteId(id)) {
      showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
      return;
    }
    const targetEval = serviceEvaluations.find(e => String(e.id).trim() === String(id).trim());
    const label = targetEval?.namaProgram || targetEval?.bidang || 'evaluasi layanan ini';
    setDeleteConfirmModal({
      title: 'Hapus 1 Evaluasi Layanan',
      message: `Hapus "${label}" saja? Evaluasi lain tidak akan terhapus.`,
      confirmLabel: 'Ya, Hapus 1 Ini Saja',
      step: 1,
      onConfirm: () => executeDeleteServiceEvaluation(id)
    });
  };

  // State trigger: Handle imported Google database sync
  const handleGoogleDataImported = (data: {
    students?: Student[];
    violations?: ViolationRecord[];
    services?: CounselingService[];
    attendance?: any[];
    journals?: any[];
    homeVisits?: any[];
    achievements?: StudentAchievement[];
  }) => {
    localStorage.setItem('bk_google_sync_verified', 'true');
    window.dispatchEvent(new Event('storage'));

    const importSchoolId = getActiveSchoolId();
    if (data.students) {
      setStudents(data.students);
      setCloudCollectionData('bk_students', data.students, importSchoolId);
      void saveBulkToFirestore('bk_students', data.students, importSchoolId);
    }
    if (data.violations) {
      setViolations(data.violations);
      setCloudCollectionData('bk_violations', data.violations, importSchoolId);
      void saveBulkToFirestore('bk_violations', data.violations, importSchoolId);
    }
    if (data.services) {
      setServices(data.services);
      setCloudCollectionData('bk_services', data.services, importSchoolId);
      void saveBulkToFirestore('bk_services', data.services, importSchoolId);
    }
    if (data.achievements) {
      setAchievements(data.achievements);
      setCloudCollectionData('bk_achievements', data.achievements, importSchoolId);
      void saveBulkToFirestore('bk_achievements', data.achievements, importSchoolId);
    }
    if (data.attendance) {
      setCloudCollectionData('bk_attendance_history', data.attendance, importSchoolId);
      void saveBulkToFirestore('bk_attendance_history', data.attendance, importSchoolId);
    }
    if (data.journals) {
      setCloudCollectionData('bk_daily_journals', data.journals, importSchoolId);
      void saveBulkToFirestore('bk_daily_journals', data.journals, importSchoolId);
    }
    if (data.homeVisits) {
      setHomeVisits(data.homeVisits);
      setCloudCollectionData('bk_home_visits', data.homeVisits, importSchoolId);
      void saveBulkToFirestore('bk_home_visits', data.homeVisits, importSchoolId);
    }

    // Register all imported IDs as synced
    const allActiveIds = [
      ...(data.students || []).map((s: any) => s.id),
      ...(data.violations || []).map((v: any) => v.id),
      ...(data.services || []).map((s: any) => s.id),
      ...(data.attendance || []).map((a: any) => a.id),
      ...(data.journals || []).map((j: any) => j.id),
      ...(data.homeVisits || []).map((h: any) => h.id),
      ...(data.achievements || []).map((a: any) => a.id)
    ].filter(Boolean);
    registerSyncedIds(allActiveIds);
    cleanupSyncedIds(allActiveIds);

    // Insert sync event into activity feed
    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;

    const syncLog: ActivityLog = {
      id: `log-sync-${Date.now()}`,
      timeLabel,
      type: 'attendance',
      title: 'Sinkronisasi Google Sheets',
      description: 'Seluruh database disinkronkan dengan data awan Google Sheets Anda.',
      studentName: 'Sistem',
      studentClass: 'Semua',
      timestamp: new Date(),
    };

    pushActivityLog(syncLog);
  };

  // Rigorous Role-Based & School-Partitioned Filtered States (Zero Data-Leakage)
  const filteredStudents = useMemo(() => filterStudents(students, activeCounselor), [students, activeCounselor]);
  const filteredViolations = useMemo(() => filterViolations(violations, activeCounselor), [violations, activeCounselor]);
  const filteredServices = useMemo(() => filterServices(services, activeCounselor), [services, activeCounselor]);
  const filteredAchievements = useMemo(() => filterAchievements(achievements, activeCounselor), [achievements, activeCounselor]);
  const filteredHomeVisits = useMemo(() => filterHomeVisits(homeVisits, activeCounselor), [homeVisits, activeCounselor]);
  const filteredLogs = useMemo(() => filterLogs(logs, activeCounselor), [logs, activeCounselor]);

  const rujukanBaruCount = useMemo(
    () =>
      filteredViolations.filter(
        (v) =>
          v &&
          v.isDeleted !== true &&
          isRealNonDummyViolation(v) &&
          isRujukanBaruPiket(v) &&
          !v.archivedFromRujukan &&
          getRujukanItemStatus(v) === 'Baru'
      ).length,
    [filteredViolations]
  );

  // Otomatis masukkan guru tamu (+ Nama Lain) ke koleksi `teachers` jika sudah dipakai >= 3x di laporan Piket
  useEffect(() => {
    if (!isLoggedIn || filteredViolations.length === 0) return;
    void promoteFrequentGuestTeachers(filteredViolations, activeCounselor?.schoolId);
  }, [isLoggedIn, filteredViolations, activeCounselor?.schoolId]);

  const unseenOverdueCount = useMemo(
    () => overdueFollowUpIds.filter((id) => !seenOverdueIds.includes(id)).length,
    [overdueFollowUpIds, seenOverdueIds]
  );

  const siBecikBadgeCount = unseenOverdueCount + (siBecikUnread ? 1 : 0);

  // Render individual view layout switch
  const renderMainView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView
            students={filteredStudents}
            violations={filteredViolations}
            services={filteredServices}
            logs={filteredLogs}
            achievements={filteredAchievements}
            serviceEvaluations={serviceEvaluations}
            programEvaluations={programEvaluations}
            activeCounselor={activeCounselor}
            onNavigateToTab={handleNavigateToTab}
            onNavigateToForm={handleNavigateToForm}
            onTindakLanjuti={(v) => setPembinaanTargetViolation(v)}
            onOpenViolationDetail={(v) => {
              setViolationInitialTab('arsip');
              setViolationInitialSearch(v.ticketId || v.studentName || '');
              setViolationInitialOpenId(v.id);
              setCurrentView('arsip-pembinaan');
            }}
            onUpdateViolationStatus={handleUpdateViolationStatus}
            onUpdateServiceStatus={handleUpdateServiceStatus}
            onEditService={(srv) => setEditingService(srv)}
            onEvaluateService={(srv) => setGlobalEvalServiceTarget(srv)}
            onSaveServiceEvaluation={handleSaveServiceEvaluation}
            onLogout={handleLogout}
          />
        );
      case 'absensi':
        return (
          <AbsensiView
            students={filteredStudents}
            activeCounselor={activeCounselor}
            initialClass={selectedAbsensiClass}
            onAddActivityLog={handleAddAttendanceActivityLog}
            onAttendanceChanged={() => triggerBackgroundAutoSync()}
            onSyncAttendanceViolations={handleSyncAttendanceViolations}
            onBackToDashboard={() => setCurrentView('dashboard')}
          />
        );
      case 'data-siswa':
        return (
          <DataSiswaView
            students={filteredStudents}
            violations={filteredViolations}
            services={filteredServices}
            achievements={filteredAchievements}
            onSaveAchievement={handleSaveAchievement}
            onDeleteViolation={(id) => handleDeleteViolation(id, true)}
            onUpdateViolation={handleUpdateViolation}
            onDeleteService={(id) => handleDeleteService(id, true)}
            onUpdateService={handleUpdateService}
            onDeleteAchievement={(id) => handleDeleteAchievement(id, true)}
            onUpdateAchievement={handleUpdateAchievement}
            activeCounselor={activeCounselor}
            onAddStudent={handleAddStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={(id) => handleDeleteStudent(id, true)}
            onClearAllStudents={handleClearAllStudents}
            onNavigateToForm={handleNavigateToForm}
            onNavigateToProfile={handleNavigateToProfile}
            onNavigateToTab={handleNavigateToTab}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        );
      case 'kelola-guru-piket':
      case 'guru-piket':
        return (
          <KelolaGuruPiketView
            activeCounselor={activeCounselor}
            onBack={() => setCurrentView('dashboard')}
          />
        );
      case 'rujukan-piket':
      case 'rujukan':
      case 'catat':
      case 'catat-pelanggaran':
      case 'catat-kasus':
        return (
          <RujukanPiketView
            violations={filteredViolations}
            initialSearch={rujukanInitialSearch}
            onTindakLanjuti={(v) => setPembinaanTargetViolation(v)}
            onNavigateToProfile={handleNavigateToProfile}
            onOpenArsip={() => setCurrentView('arsip-pembinaan')}
            onBulkMarkAlpaDone={handleBulkMarkAlpaDone}
            onArchiveAllDataLama={handleArchiveAllDataLama}
          />
        );
      case 'arsip-pembinaan':
      case 'arsip-pelanggaran':
      case 'arsip-restitusi':
      case 'pelanggaran':
        return (
          <CatatPelanggaranForm
            students={filteredStudents}
            violations={filteredViolations}
            activeCounselor={activeCounselor}
            preSelectedStudentId={preSelectedStudentId}
            initialTab="arsip"
            initialArchiveSearch={violationInitialSearch}
            initialOpenViolationId={violationInitialOpenId}
            onClearInitialOpenViolation={() => setViolationInitialOpenId(undefined)}
            onNavigateToProfile={handleNavigateToProfile}
            onSaveViolation={handleSaveViolation}
            onUpdateViolation={handleUpdateViolation}
            onDeleteViolation={(id) => handleDeleteViolation(id, true)}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={(id) => handleDeleteStudent(id, true)}
            onTindakLanjuti={(v) => setPembinaanTargetViolation(v)}
            onCreateFollowUpCounseling={(data) => {
              const studentId = data.students[0]?.id;
              setPresetServiceData({
                serviceType: data.serviceType || 'Layanan Konseling Perorangan (Individual)',
                bkComponent: data.bkComponent || 'Layanan Responsif',
                targetType: data.targetType || 'Individu',
                problem: data.problem,
                description: data.description,
                studentIds: data.students.map((s) => s.id),
                status: data.status || 'Terjadwal',
                linkedViolationId: data.violationContext?.ticketId
                  ? violations.find((v) => v.ticketId === data.violationContext?.ticketId)?.id
                  : undefined,
                linkedTicketId: data.violationContext?.ticketId,
                violationContext: data.violationContext,
              });
              if (studentId) {
                setPreSelectedStudentId(studentId);
              }
              setCurrentView('tambah-layanan');
            }}
            onCancel={() => {
              setPreSelectedStudentId(undefined);
              setCurrentView('dashboard');
            }}
          />
        );
      case 'apresiasi':
      case 'catat-apresiasi':
        return (
          <CatatApresiasiForm
            students={filteredStudents}
            achievements={filteredAchievements}
            activeCounselor={activeCounselor}
            preSelectedStudentId={preSelectedStudentId}
            onSaveAchievement={handleSaveAchievement}
            onDeleteAchievement={(id) => handleDeleteAchievement(id, true)}
            onUpdateAchievement={handleUpdateAchievement}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={(id) => handleDeleteStudent(id, true)}
            onCancel={() => {
              setPreSelectedStudentId(undefined);
              setCurrentView('dashboard');
            }}
          />
        );
      case 'layanan-bk':
      case 'layanan':
      case 'home-visit':
      case 'homevisit':
      case 'panggilan-orang-tua':
      case 'panggilan-ortu':
      case 'panggilan':
        {
          const activeTab = (currentView === 'home-visit' || currentView === 'homevisit')
            ? 'homevisit' 
            : (currentView === 'panggilan-orang-tua' || currentView === 'panggilan-ortu' || currentView === 'panggilan')
            ? 'panggilan' 
            : layananSubTab;

          const LAYANAN_TAB_ORDER: Record<string, number> = { sesi: 0, homevisit: 1, panggilan: 2 };
          const handleSwitchLayananSubTab = (newTab: 'sesi' | 'homevisit' | 'panggilan') => {
            const currentIdx = LAYANAN_TAB_ORDER[activeTab] ?? 0;
            const nextIdx = LAYANAN_TAB_ORDER[newTab] ?? 0;
            setLayananTabDirection(nextIdx >= currentIdx ? 1 : -1);
            setLayananSubTab(newTab);
            if (currentView !== 'layanan-bk') setCurrentView('layanan-bk');
          };

          const layananSubTabVariants = {
            enter: (direction: number) => ({
              x: direction > 0 ? 36 : -36,
              opacity: 0,
              filter: 'blur(3px)',
            }),
            center: {
              x: 0,
              opacity: 1,
              filter: 'blur(0px)',
              transition: {
                duration: 0.28,
                ease: [0.16, 1, 0.3, 1] as const,
              },
            },
            exit: (direction: number) => ({
              x: direction > 0 ? -36 : 36,
              opacity: 0,
              filter: 'blur(3px)',
              transition: {
                duration: 0.2,
                ease: [0.16, 1, 0.3, 1] as const,
              },
            }),
          };

          return (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Top Sub-tab Switcher: Sesi Layanan vs Home Visit vs Panggilan Orang Tua */}
              <div className="flex items-center gap-1.5 p-1.5 bg-gray-100 rounded-2xl border border-[#bcc9c6]/40 w-fit flex-wrap shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleSwitchLayananSubTab('sesi')}
                  className={`relative px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-2 select-none active:scale-98 whitespace-nowrap ${
                    activeTab === 'sesi'
                      ? 'text-white'
                      : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-gray-200/50'
                  }`}
                >
                  {activeTab === 'sesi' && (
                    <motion.div
                      layoutId="layanan-subtab-pill-indicator"
                      className="absolute inset-0 bg-[#00685f] rounded-xl shadow-xs"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <HeartHandshake className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">Daftar Layanan BK</span>
                  <span
                    className={`relative z-10 px-1.5 py-0.5 text-[10px] rounded-full font-black transition-colors tabular-nums ${
                      activeTab === 'sesi'
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 text-[#3d4947]'
                    }`}
                  >
                    {filteredServices.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchLayananSubTab('homevisit')}
                  className={`relative px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-2 select-none active:scale-98 whitespace-nowrap ${
                    activeTab === 'homevisit'
                      ? 'text-white'
                      : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-gray-200/50'
                  }`}
                >
                  {activeTab === 'homevisit' && (
                    <motion.div
                      layoutId="layanan-subtab-pill-indicator"
                      className="absolute inset-0 bg-[#00685f] rounded-xl shadow-xs"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <Home className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">Home Visit</span>
                  <span
                    className={`relative z-10 px-1.5 py-0.5 text-[10px] rounded-full font-black transition-colors tabular-nums ${
                      activeTab === 'homevisit'
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 text-[#3d4947]'
                    }`}
                  >
                    {filteredHomeVisits.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchLayananSubTab('panggilan')}
                  className={`relative px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-2 select-none active:scale-98 whitespace-nowrap ${
                    activeTab === 'panggilan'
                      ? 'text-white'
                      : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-gray-200/50'
                  }`}
                >
                  {activeTab === 'panggilan' && (
                    <motion.div
                      layoutId="layanan-subtab-pill-indicator"
                      className="absolute inset-0 bg-[#00685f] rounded-xl shadow-xs"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <Mail className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">Panggilan Orang Tua</span>
                </button>
              </div>

              {/* Sub-tab Content */}
              <div className="overflow-hidden">
                <AnimatePresence mode="wait" custom={layananTabDirection} initial={false}>
                  {activeTab === 'homevisit' ? (
                    <motion.div
                      key="layanan-subtab-homevisit"
                      custom={layananTabDirection}
                      variants={layananSubTabVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                    >
                      <HomeVisitView
                        students={filteredStudents}
                        activeCounselor={activeCounselor}
                      />
                    </motion.div>
                  ) : activeTab === 'panggilan' ? (
                    <motion.div
                      key="layanan-subtab-panggilan"
                      custom={layananTabDirection}
                      variants={layananSubTabVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                    >
                      <PanggilanOrangTuaView
                        students={filteredStudents}
                        activeCounselor={activeCounselor}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="layanan-subtab-sesi"
                      custom={layananTabDirection}
                      variants={layananSubTabVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                    >
                      <RiwayatLayananView
                        services={filteredServices}
                        students={filteredStudents}
                        serviceEvaluations={serviceEvaluations}
                        activeCounselor={activeCounselor}
                        onNavigateToTab={handleNavigateToTab}
                        onNavigateToForm={handleNavigateToForm}
                        onEditService={(srv) => setEditingService(srv)}
                        onUpdateService={handleUpdateService}
                        onUpdateServiceStatus={(id, st) => handleUpdateServiceStatus(id, st)}
                        onSaveServiceEvaluation={handleSaveServiceEvaluation}
                        onDeleteService={handleDeleteService}
                        onEvaluateService={(srv) => setGlobalEvalServiceTarget(srv)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
    }
      case 'tambah-layanan':
      case 'input-konseling':
      case 'layanan-konseling':
      case 'konseling':
      case 'form-layanan':
        return (
          <TambahLayananForm
            students={filteredStudents}
            violations={filteredViolations}
            existingServices={filteredServices}
            preSelectedStudentId={preSelectedStudentId}
            presetServiceData={presetServiceData}
            onClearPresetServiceData={() => setPresetServiceData(null)}
            onSaveService={(newService) => {
              handleSaveService(newService);
              setPresetServiceData(null);
            }}
            onCancel={() => {
              setPreSelectedStudentId(undefined);
              setPresetServiceData(null);
              setCurrentView('dashboard');
            }}
            onNavigateToRiwayat={() => {
              setPreSelectedStudentId(undefined);
              setPresetServiceData(null);
              setCurrentView('riwayat-layanan');
            }}
          />
        );
      case 'riwayat-layanan':
      case 'riwayat':
      case 'riwayat-konseling':
        return (
          <RiwayatLayananView
            services={filteredServices}
            students={filteredStudents}
            serviceEvaluations={serviceEvaluations}
            activeCounselor={activeCounselor}
            onNavigateToTab={handleNavigateToTab}
            onNavigateToForm={handleNavigateToForm}
            onEditService={(srv) => setEditingService(srv)}
            onUpdateService={handleUpdateService}
            onUpdateServiceStatus={(id, st) => handleUpdateServiceStatus(id, st)}
            onSaveServiceEvaluation={handleSaveServiceEvaluation}
            onDeleteService={handleDeleteService}
            onEvaluateService={(srv) => setGlobalEvalServiceTarget(srv)}
          />
        );
      case 'asesmen-bk':
      case 'asesmen':
        return (
          <AsesmenBkView
            students={filteredStudents}
            onNavigateToForm={handleNavigateToForm}
          />
        );
      case 'pembinaan-pendisiplinan':
      case 'pembinaan':
      case 'pendisiplinan':
        return (
          <PembinaanPendisiplinanView
            students={filteredStudents}
            violations={filteredViolations}
            activeCounselor={activeCounselor}
            onNavigateToTab={(v) => setCurrentView(v)}
          />
        );
      case 'jurnal-harian':
      case 'jurnal':
        return (
          <JurnalHarianView
            activeCounselor={activeCounselor}
            services={filteredServices}
            violations={filteredViolations}
            students={filteredStudents}
            presetJournalData={presetJournalData}
            onClearPresetJournalData={() => setPresetJournalData(null)}
            onAddActivityLog={(data: any) => handleAddAttendanceActivityLog(
              data.title,
              data.description,
              data.studentName,
              data.studentClass,
              'attendance'
            )}
          />
        );
      case 'laporan-rekap':
      case 'laporan':
        return (
          <LaporanRekapView
            students={filteredStudents}
            services={filteredServices}
            violations={filteredViolations}
            achievements={filteredAchievements}
            homeVisits={filteredHomeVisits}
            programEvaluations={programEvaluations}
            activeCounselor={activeCounselor}
            onNavigateToForm={handleNavigateToForm}
            onNavigateToTab={handleNavigateToTab}
            onNavigateToStudioPdf={() => setCurrentView('studio-pdf')}
            onNavigateToEvaluasi={() => setCurrentView('evaluasi-program')}
            onUpdateViolationStatus={handleUpdateViolationStatus}
            onUpdateServiceStatus={handleUpdateServiceStatus}
          />
        );
      case 'peringatan':
        return (
          <PeringatanView
            students={filteredStudents}
            violations={filteredViolations}
            services={filteredServices}
            serviceEvaluations={serviceEvaluations}
            activeCounselor={activeCounselor}
            initialFilter={peringatanFilter}
            onNavigateToTab={handleNavigateToTab}
            onEvaluateService={(srv) => setGlobalEvalServiceTarget(srv)}
            onSaveServiceEvaluation={handleSaveServiceEvaluation}
          />
        );
      case 'evaluasi-program':
      case 'evaluasi':
        return (
          <EvaluasiProgramView
            evaluations={programEvaluations}
            serviceEvaluations={serviceEvaluations}
            services={filteredServices}
            students={filteredStudents}
            activeCounselor={activeCounselor}
            onSaveEvaluation={handleSaveEvaluation}
            onDeleteEvaluation={handleDeleteEvaluation}
            onSaveServiceEvaluation={handleSaveServiceEvaluation}
            onDeleteServiceEvaluation={handleDeleteServiceEvaluation}
            onBack={() => setCurrentView('dashboard')}
          />
        );
      case 'studio-pdf':
      case 'pdf-maker':
      case 'studio-pdf-maker':
        return (
          <StudioPdfMakerView
            students={filteredStudents}
            services={filteredServices}
            violations={filteredViolations}
            achievements={filteredAchievements}
            homeVisits={filteredHomeVisits}
            activeCounselor={activeCounselor}
            allCounselors={allCounselors}
            onNavigateToTab={(tab) => setCurrentView(tab)}
          />
        );
      case 'pengaturan':
        return (
          <PengaturanView
            activeCounselor={activeCounselor}
            allCounselors={allCounselors}
            students={students}
            onUpdateCounselor={handleUpdateCounselor}
            onChangeCounselor={handleChangeCounselor}
            onCreateCounselor={handleCreateCounselor}
            onDeleteCounselor={handleDeleteCounselor}
            onResetToFreshSchool={handleResetToFreshSchool}
          />
        );
      case 'google-sync':
        return (
          <GoogleIntegrationView
            onDataImported={handleGoogleDataImported}
            activeCounselor={activeCounselor}
          />
        );
      case 'backup-restore':
        return (
          <BackupRestoreView
            activeCounselor={activeCounselor}
            liveState={{
              students,
              violations,
              services,
              logs,
              achievements,
              homeVisits,
              programEvaluations,
              serviceEvaluations,
              allCounselors,
            }}
            onBack={() => setCurrentView('lainnya')}
            onClearAllStudents={handleClearAllStudents}
            onAddStudent={handleAddStudent}
            onNavigateToGoogleSync={() => setCurrentView('google-sync')}
            onDataRestored={() => {
              const sid = getActiveSchoolId();
              setStudents(getCloudCollectionData('bk_students', sid));
              setViolations(getCloudCollectionData('bk_violations', sid));
              setServices(getCloudCollectionData('bk_services', sid));
              setLogs(getCloudCollectionData('bk_logs', sid));
              setAchievements(getCloudCollectionData('bk_achievements', sid));
              setHomeVisits(getCloudCollectionData('bk_home_visits', sid));
              setProgramEvaluations(getCloudCollectionData('bk_program_evaluations', sid));
              setServiceEvaluations(getCloudCollectionData('bk_service_evaluations', sid));
              forceFullCloudSync().catch(() => {});
            }}
          />
        );
      case 'surat-panggilan':
        return (
          <PanggilanOrangTuaView
            students={filteredStudents}
            activeCounselor={activeCounselor}
          />
        );
      case 'lainnya':
      case 'menu-lainnya':
        return (
          <ErrorBoundary
            moduleName="Audit"
            onHideModule={() => setCurrentView('data-siswa')}
            onNavigateHome={() => setCurrentView('dashboard')}
          >
            <LainnyaView
              onNavigate={handleNavigateToTab}
              activeCounselor={activeCounselor}
              allCounselors={allCounselors}
              onLogout={handleLogout}
              students={filteredStudents}
              violations={filteredViolations}
              services={filteredServices}
              onClearAllStudents={handleClearAllStudents}
              onAddStudent={handleAddStudent}
            />
          </ErrorBoundary>
        );
      case 'profil-siswa':
      case 'profil': {
        const targetStudent =
          filteredStudents.find(
            (s) =>
              s.id === selectedProfileStudentId ||
              (s.name && s.name.trim().toLowerCase() === String(selectedProfileStudentId || '').trim().toLowerCase())
          ) ||
          filteredStudents[0];

        if (!targetStudent) {
          return (
            <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center max-w-md mx-auto my-12">
              <p className="text-sm text-gray-500 font-bold">Data siswa tidak ditemukan.</p>
              <button
                type="button"
                onClick={() => setCurrentView('dashboard')}
                className="mt-3 px-4 py-2 bg-[#00685f] text-white rounded-xl text-xs font-bold"
              >
                Kembali ke Beranda
              </button>
            </div>
          );
        }

        return (
          <ProfilSiswaView
            student={targetStudent}
            students={filteredStudents}
            violations={filteredViolations}
            services={filteredServices}
            achievements={filteredAchievements}
            homeVisits={filteredHomeVisits}
            activeCounselor={activeCounselor}
            onBack={() => {
              setCurrentView(previousView || 'dashboard');
            }}
            onNavigateToForm={handleNavigateToForm}
            onNavigateToTab={handleNavigateToTab}
            onUpdateViolation={handleUpdateViolation}
            onSelectStudent={(sId) => setSelectedProfileStudentId(sId)}
          />
        );
      }
      default:
        return (
          <DashboardView
            students={filteredStudents}
            violations={filteredViolations}
            services={filteredServices}
            logs={filteredLogs}
            achievements={filteredAchievements}
            serviceEvaluations={serviceEvaluations}
            activeCounselor={activeCounselor}
            onNavigateToTab={handleNavigateToTab}
            onNavigateToForm={handleNavigateToForm}
            onTindakLanjuti={(v) => setPembinaanTargetViolation(v)}
            onOpenViolationDetail={(v) => {
              setViolationInitialTab('arsip');
              setViolationInitialSearch(v.ticketId || v.studentName || '');
              setViolationInitialOpenId(v.id);
              setCurrentView('arsip-pembinaan');
            }}
            onUpdateViolationStatus={handleUpdateViolationStatus}
            onUpdateServiceStatus={handleUpdateServiceStatus}
            onEditService={(srv) => setEditingService(srv)}
            onEvaluateService={(srv) => setGlobalEvalServiceTarget(srv)}
            onSaveServiceEvaluation={handleSaveServiceEvaluation}
            onLogout={handleLogout}
          />
        );
    }
  };

  // Helper function to allow view change from header/dashboard quick links
  const onNavigateToTab = (
    tab: string,
    query?: string,
    presetJournal?: {
      className?: string;
      topic?: string;
      subject?: string;
      startTime?: string;
      endTime?: string;
      period?: string;
    }
  ) => {
    if (tab === 'si-becik') {
      handleOpenSiBecik();
      return;
    }
    if (query) {
      setSearchQuery(query);
    }
    if (presetJournal) {
      setPresetJournalData(presetJournal);
    }
    if (tab === 'absensi') {
      if (query) {
        setSelectedAbsensiClass(query);
      }
      setCurrentView('absensi');
    } else if (tab === 'home-visit' || tab === 'homevisit') {
      const currentIdx = layananSubTab === 'sesi' ? 0 : layananSubTab === 'homevisit' ? 1 : 2;
      setLayananTabDirection(1 >= currentIdx ? 1 : -1);
      setLayananSubTab('homevisit');
      setCurrentView('layanan-bk');
    } else if (tab === 'panggilan-ortu' || tab === 'panggilan-orang-tua' || tab === 'panggilan') {
      const currentIdx = layananSubTab === 'sesi' ? 0 : layananSubTab === 'homevisit' ? 1 : 2;
      setLayananTabDirection(2 >= currentIdx ? 1 : -1);
      setLayananSubTab('panggilan');
      setCurrentView('layanan-bk');
    } else if (tab === 'layanan-bk' || tab === 'sesi') {
      const currentIdx = layananSubTab === 'sesi' ? 0 : layananSubTab === 'homevisit' ? 1 : 2;
      setLayananTabDirection(0 >= currentIdx ? 1 : -1);
      setLayananSubTab('sesi');
      setCurrentView('layanan-bk');
    } else {
      setCurrentView(tab);
    }
  };

  const handleLogout = () => {
    stopRealtimeFirestoreSync();
    try {
      sessionStorage.removeItem('bk_session_logged_in');
      localStorage.removeItem('bk_is_logged_in');
      localStorage.removeItem('bk_active_counselor_id');
    } catch (e) {}
    setIsLoggedIn(false);
    setCurrentView('dashboard');
    // Clear all states in memory so no data from the previous account is kept
    setStudents([]);
    setViolations([]);
    setServices([]);
    setLogs([]);
    setAchievements([]);
    setHomeVisits([]);
  };

  if (!isLoggedIn) {
    return (
      <>
        <div className={`px-4 py-1.5 text-[11px] sm:text-xs font-bold flex flex-wrap items-center justify-between gap-2 border-b relative z-[1200] ${
          firebaseConnectionError
            ? 'bg-red-50 text-red-800 border-red-200'
            : 'bg-[#e6f4f1] text-[#005049] border-[#00685f]/20'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${firebaseConnectionError ? 'bg-red-600' : 'bg-emerald-600 animate-pulse'}`} />
            <span>Cloud: ai-studio-sistemadministra-39ee735c - students: {students.length} data</span>
          </div>
          <span className="text-[10px] opacity-80 font-mono">
            {firebaseConnectionError ? `Error: ${firebaseConnectionError}` : 'Online - Tersambung ke Cloud'} • projectId: {firebaseConfig.projectId}
          </span>
        </div>
        {firebaseConnectionError && (
          <div className="bg-red-600 text-white px-4 py-3 text-xs sm:text-sm font-extrabold flex flex-wrap items-center justify-between gap-2 shadow-md relative z-[1200]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>GAGAL KONEK FIREBASE: {firebaseConnectionError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setFirebaseConnectionError(null);
                initRealtimeFirestoreSync();
                forceFullCloudSync().catch((err: any) => setFirebaseConnectionError(err?.message || String(err)));
              }}
              className="px-3 py-1 rounded-lg bg-white text-red-700 text-xs font-extrabold cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        )}
        <LoginView
          allCounselors={allCounselors}
          onCreateNewCounselor={handleCreateCounselor}
          onLoginSuccess={async (counselor) => {
            const isAulia = counselor.id === 'c1' || 
                            counselor.username === 'aulia' || 
                            (counselor.email && counselor.email.toLowerCase().includes('auliasasongko')) ||
                            (counselor.name && counselor.name.toLowerCase().includes('aulia'));

            const cleanNpsn = counselor.schoolNpsn ? String(counselor.schoolNpsn).replace(/[^0-9a-zA-Z]/g, '') : '';
            const hasCounselorSchool = Boolean(isAulia || cleanNpsn || counselor.schoolId || counselor.schoolName);
            const cSchoolId = isAulia 
              ? 'sch_20320123' 
              : ((cleanNpsn ? sanitizeSchoolId(cleanNpsn) : '') || (counselor.schoolId ? sanitizeSchoolId(counselor.schoolId) : (hasCounselorSchool ? getActiveSchoolId() : '')));

            const finalSchoolId = (isAulia || cSchoolId === 'sch_20320123' || cleanNpsn === '20320123') ? 'sch_20320123' : (cSchoolId || getActiveSchoolId());

            if (hasCounselorSchool && finalSchoolId !== getActiveSchoolId()) {
              const registered = getRegisteredSchools();
              const targetSchool = registered.find(s => s.schoolId === finalSchoolId || (cleanNpsn && s.npsn === cleanNpsn)) || {
                schoolId: finalSchoolId,
                schoolName: isAulia ? 'SMP N 2 Susukan' : (counselor.schoolName || ''),
                npsn: isAulia ? '20320123' : (cleanNpsn || counselor.schoolNpsn || ''),
                schoolAddress: isAulia ? 'Jl. Kyai Hasan Anwar No. 16, Susukan, Kab. Semarang' : 'Alamat Sekolah',
                principalName: isAulia ? 'Agus Setiawan, S.Pd. Fis' : 'Kepala Sekolah',
                principalNip: isAulia ? '19680831 199103 1 007' : '-',
                governmentName: 'PEMERINTAH KABUPATEN SEMARANG',
                departmentName: 'DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA'
              };
              switchSchoolWorkspace(targetSchool);
            }

            if (hasCounselorSchool) {
              setActiveSchoolId(finalSchoolId);
            }

            const finalizedCounselor: Counselor = isAulia ? {
              ...counselor,
              id: 'c1',
              name: 'Aulia Aji Sasongko, S.Pd.',
              role: 'Koordinator BK & Guru Pembimbing Kelas 8',
              nip: counselor.nip && counselor.nip !== '-' ? counselor.nip : 'NIP. 19931231 202221 1 002',
              avatar: counselor.avatar || counselors.find(c => c.id === 'c1')?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
              allowedClasses: ['8A', '8B', '8C', '8D', '8E', '8F', '8G'],
              username: 'aulia',
              email: 'auliasasongko12@guru.smp.belajar.id',
              phone: '089681287339',
              schoolId: 'sch_20320123',
              schoolNpsn: '20320123',
              schoolName: 'SMP N 2 Susukan'
            } : {
              ...counselor,
              schoolId: counselor.schoolId || (cleanNpsn ? sanitizeSchoolId(cleanNpsn) : ''),
              schoolNpsn: cleanNpsn || counselor.schoolNpsn || '',
              schoolName: counselor.schoolName || ''
            };

            // 1. PURE FIRESTORE SOURCE OF TRUTH: Isi state hanya dari snapshot cloud di memori (mulai 0 jika belum ada di Firestore)
            const isCanonical = finalSchoolId === 'sch_20320123';
            setStudents(getCloudCollectionData<Student>('bk_students', finalSchoolId));
            setViolations(getCloudCollectionData<ViolationRecord>('bk_violations', finalSchoolId));
            setServices(getCloudCollectionData<CounselingService>('bk_services', finalSchoolId));
            setLogs(getCloudCollectionData<ActivityLog>('bk_logs', finalSchoolId));
            setHomeVisits(getCloudCollectionData<any>('bk_home_visits', finalSchoolId));
            setAchievements(getCloudCollectionData<any>('bk_achievements', finalSchoolId));
            setProgramEvaluations(getCloudCollectionData<ProgramEvaluation>('bk_program_evaluations', finalSchoolId));
            setServiceEvaluations(getCloudCollectionData<ProgramEvaluation>('bk_service_evaluations', finalSchoolId));

            // 2. Set authenticated state
            setActiveCounselor(finalizedCounselor);
            setIsLoggedIn(true);
            sessionStorage.setItem('bk_session_logged_in', 'true');
            localStorage.setItem('bk_is_logged_in', 'true');
            localStorage.setItem('bk_active_counselor_id', finalizedCounselor.id);

            // 3. Langsung jalankan onSnapshot & forceFullCloudSync dari Firestore
            (async () => {
              try {
                await ensureSchoolDocumentExists(finalSchoolId, finalizedCounselor);

                const loadedCounselors = loadSchoolData('bk_counselors', isCanonical ? counselors : [finalizedCounselor], finalSchoolId);
                let mergedCounselors = isCanonical ? [...counselors] : [finalizedCounselor];
                if (loadedCounselors && loadedCounselors.length > 0) {
                  loadedCounselors.forEach(c => {
                    const idx = mergedCounselors.findIndex(mc => mc.id === c.id || mc.username === c.username);
                    if (idx !== -1) mergedCounselors[idx] = { ...mergedCounselors[idx], ...c };
                    else mergedCounselors.push(c);
                  });
                }
                setAllCounselors(mergedCounselors);
                saveSchoolData('bk_counselors', mergedCounselors, finalSchoolId);

                stopRealtimeFirestoreSync();
                await initRealtimeFirestoreSync();
                await forceFullCloudSync();
                await flushPendingCloudQueue();
              } catch (syncErr: any) {
                setFirebaseConnectionError(syncErr?.message || String(syncErr));
              }
            })();
          }}
        />
      </>
    );
  }

  const getPageTitle = (view: string) => {
    switch (view) {
      case 'data-siswa':
        return searchQuery ? `Data Siswa (Pencarian: "${searchQuery}")` : 'Data Siswa Sekolah';
      case 'kelola-guru-piket':
      case 'guru-piket':
        return 'Kelola Guru Piket';
      case 'absensi':
        return selectedAbsensiClass ? `Presensi Kelas ${selectedAbsensiClass}` : 'Absen Siswa Hari Ini';
      case 'rujukan-piket':
      case 'rujukan':
      case 'catat':
      case 'catat-pelanggaran':
      case 'catat-kasus':
        return 'Rujukan dari Piket';
      case 'arsip-pembinaan':
      case 'arsip-pelanggaran':
      case 'arsip-restitusi':
      case 'pelanggaran':
        return 'Arsip Pembinaan & Riwayat Pelanggaran';
      case 'tambah-layanan':
      case 'input-konseling':
      case 'layanan-konseling':
      case 'konseling':
      case 'form-layanan':
        return 'Konseling Individual';
      case 'layanan-bk':
      case 'layanan':
        return 'Layanan Konseling & Rapat Kasus';
      case 'laporan-rekap':
      case 'laporan':
        return 'Laporan & Rekapitulasi BK';
      case 'evaluasi-program':
      case 'evaluasi':
        return 'Evaluasi Layanan & Program BK';
      case 'jurnal-harian':
      case 'jurnal':
        return 'Jurnal Harian Guru BK';
      case 'pengaturan':
        return 'Pengaturan Profil Guru BK';
      case 'google-sync':
        return 'Cadangan Data & Sinkronisasi Drive';
      case 'backup-restore':
        return 'Backup & Restore Semua Data';
      case 'asesmen-bk':
      case 'asesmen':
        return 'Sosiometri & Asesmen Siswa';
      case 'pembinaan-pendisiplinan':
      case 'pembinaan':
      case 'pendisiplinan':
        return 'Pembinaan & Pendisiplinan Positif';
      case 'studio-pdf':
      case 'pdf-maker':
        return 'Studio Pembuat Berkas PDF';
      case 'apresiasi':
      case 'catat-apresiasi':
        return 'Apresiasi & Prestasi Siswa';
      case 'panggilan-ortu':
      case 'panggilan-orang-tua':
      case 'surat-panggilan':
        return 'Surat Panggilan Orang Tua';
      case 'riwayat-layanan':
      case 'riwayat':
      case 'riwayat-konseling':
        return 'Riwayat Layanan Bimbingan & Konseling';
      case 'profil-siswa':
      case 'profil':
        return 'Profil Siswa Khusus Guru BK';
      case 'peringatan':
        return 'Pusat Peringatan & Tindak Lanjut';
      default:
        return 'Bimbingan Konseling';
    }
  };

  const formViewsSet = new Set([
    'tambah-layanan',
    'input-konseling',
    'layanan-konseling',
    'konseling',
    'form-layanan',
    'pelanggaran',
    'arsip-pembinaan',
    'rujukan-piket',
    'apresiasi',
    'catat-apresiasi',
    'layanan-bk',
    'home-visit',
    'homevisit',
    'panggilan-orang-tua',
    'panggilan-ortu',
    'panggilan',
    'surat-panggilan',
  ]);

  const isFormOrModalOpen =
    formViewsSet.has(currentView) ||
    editingService !== null ||
    detailService !== null ||
    pendingPostSaveService !== null ||
    globalEvalServiceTarget !== null ||
    pembinaanTargetViolation !== null;

  const showFab =
    isLoggedIn &&
    !isSiBecikOpen &&
    siBecikFabEnabled &&
    !isKeyboardOpen &&
    !isFormOrModalOpen;

  return (
    <div className={`min-h-screen text-[#0b1c30] app-root ${currentView === 'dashboard' ? 'bg-[#F6F7F9]' : 'bg-[#f8fafa]'}`}>
      {/* Main Full-Width Column (Sidebar removed for clean, focused layout) */}
      <div className="min-h-screen flex flex-col transition-all duration-300 app-main-column">
        {/* Top Header bar with direct student search */}
        <Header
          activeCounselor={activeCounselor}
          allCounselors={allCounselors}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNavigateToStudent={handleNavigateToStudentTab}
          onToggleSidebar={() => setCurrentView('lainnya')}
          services={filteredServices}
          violations={filteredViolations}
          homeVisits={filteredHomeVisits}
          students={filteredStudents}
          onNavigateToTab={handleNavigateToTab}
          onNavigateToForm={handleNavigateToForm}
          onEditService={(srv) => setEditingService(srv)}
          onAddServiceOnDate={() => handleNavigateToForm('tambah-layanan')}
          onLogout={handleLogout}
        />

        {/* Central Workspace view with bottom padding 100px on both mobile and laptop for BottomNavBar */}
        <main className="mt-16 p-4 sm:p-6 lg:p-8 pb-[100px] flex-1 app-workspace">
          <div className={`max-w-7xl mx-auto mb-3 px-4 py-2 rounded-xl border text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-2xs ${
            firebaseConnectionError
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-[#e6f4f1] text-[#005049] border-[#00685f]/20'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${firebaseConnectionError ? 'bg-red-600' : 'bg-emerald-600 animate-pulse'}`} />
              <span>Cloud: ai-studio-sistemadministra-39ee735c - students: {students.length} data</span>
            </div>
            <span className="text-[11px] opacity-80 font-mono">
              {firebaseConnectionError ? `Error: ${firebaseConnectionError}` : 'Online - Tersambung ke Cloud'} • projectId: {firebaseConfig.projectId} • violations: {violations.length} • services: {services.length}
            </span>
          </div>
          {firebaseConnectionError && (
            <div className="max-w-7xl mx-auto mb-4 bg-red-600 text-white px-4 py-3 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-3 border border-red-700">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-extrabold">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>GAGAL KONEK FIREBASE: {firebaseConnectionError}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!auth.currentUser && /permission|izin|insufficient/i.test(firebaseConnectionError) && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await googleSignIn();
                        setFirebaseConnectionError(null);
                        stopRealtimeFirestoreSync();
                        await initRealtimeFirestoreSync();
                        await forceFullCloudSync();
                        showToast('Sesi Cloud Firebase BK terverifikasi.', 'success');
                      } catch (err: any) {
                        setFirebaseConnectionError(err?.message || String(err));
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-300 text-[#0b1c30] text-xs font-extrabold hover:bg-amber-200 cursor-pointer shrink-0"
                  >
                    <span>Verifikasi Google BK</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFirebaseConnectionError(null);
                    stopRealtimeFirestoreSync();
                    initRealtimeFirestoreSync();
                    forceFullCloudSync().catch((err: any) => setFirebaseConnectionError(err?.message || String(err)));
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-red-700 text-xs font-extrabold hover:bg-red-50 cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Hubungkan Ulang</span>
                </button>
              </div>
            </div>
          )}
          <div className="max-w-7xl mx-auto app-content-container">
            {/* Tombol Kembali yang Jelas & Judul Halaman Besar di Atas (Setiap Halaman selain Beranda, Lainnya, dan Form Layanan Wizard) */}
            {currentView !== 'dashboard' && currentView !== 'lainnya' && currentView !== 'tambah-layanan' && currentView !== 'input-konseling' && currentView !== 'layanan-konseling' && currentView !== 'konseling' && currentView !== 'form-layanan' && (
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs animate-in fade-in duration-200">
                <div className="flex items-center gap-3.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setCurrentView('dashboard')}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-gray-50 hover:bg-[#e6f4f1] text-[#00685f] border border-[#bcc9c6]/50 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer active:scale-95 group shadow-2xs shrink-0"
                    title="Kembali ke Beranda"
                  >
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    <span>Kembali</span>
                  </button>

                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-[#00685f]/10 px-2 py-0.5 rounded-md">
                      Halaman Aktif
                    </span>
                    <h1 className="text-xl sm:text-2xl font-black text-[#0b1c30] tracking-tight truncate mt-0.5">
                      {getPageTitle(currentView)}
                    </h1>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentView('dashboard')}
                  className="self-end sm:self-auto text-xs font-bold text-gray-500 hover:text-gray-900 cursor-pointer px-2 py-1"
                >
                  Ke Beranda ↗
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {renderMainView()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Global Toast Notifications Banner */}
      <ToastContainer />

      {/* 
        Bottom Navigation Bar - ALWAYS VISIBLE on BOTH Mobile and Laptop
        [Beranda] [Siswa] [Layanan] [Rujukan] [Arsip] [Lainnya]
      */}
      <BottomNavBar
        currentView={currentView}
        onNavigate={handleNavigateToTab}
        studentCount={filteredStudents.length}
        rujukanBaruCount={rujukanBaruCount}
      />

      {/* Modal Form Pembinaan 3 Langkah (Tindak Lanjut Rujukan Piket & Riwayat Lama) */}
      <FormPembinaanModal
        violation={pembinaanTargetViolation}
        student={
          pembinaanTargetViolation
            ? filteredStudents.find(
                (s) =>
                  s.id === pembinaanTargetViolation.studentId ||
                  (s.name &&
                    pembinaanTargetViolation.studentName &&
                    s.name.trim().toLowerCase() ===
                      pembinaanTargetViolation.studentName.trim().toLowerCase())
              ) || null
            : null
        }
        activeCounselor={activeCounselor}
        onClose={() => setPembinaanTargetViolation(null)}
        onSubmit={handleSavePembinaan}
      />

      {/* Edit Scheduled Service Modal */}
      <EditLayananModal
        key={editingService?.id || 'edit-layanan-empty'}
        service={editingService}
        students={filterStudents(students, activeCounselor)}
        onSave={(updated) => {
          handleUpdateService(updated);
          setEditingService(null);
        }}
        onDelete={(id) => {
          handleDeleteService(id, true);
          setEditingService(null);
        }}
        onClose={() => setEditingService(null)}
      />

      {/* Layanan Comprehensive Detail & Document Preview Modal */}
      <LayananDetailModal
        service={detailService}
        isOpen={detailService !== null}
        onClose={() => setDetailService(null)}
        onEdit={(srv) => {
          setDetailService(null);
          setEditingService(srv);
        }}
        onDelete={(id) => {
          handleDeleteService(id, true);
          setDetailService(null);
        }}
        onUpdateStatus={(id, status) => {
          handleUpdateServiceStatus(id, status);
          if (detailService && detailService.id === id) {
            setDetailService({ ...detailService, status });
          }
        }}
      />

      {/* Pop-up Wajib Langsung Setelah Simpan Input Layanan */}
      {pendingPostSaveService && (
        <div className="fixed inset-0 z-[75] bg-[#0b1c30]/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-[#bcc9c6]/50 shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#e6f4f1] border border-[#00685f]/25 text-[#00685f] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-[#e6f4f1] px-2 py-0.5 rounded-md">
                  Konfirmasi Evaluasi Layanan
                </span>
                <h3 className="text-lg font-extrabold text-[#0b1c30] mt-1">
                  Layanan Tersimpan. Nilai Layanan Ini Sekarang?
                </h3>
                <p className="text-xs sm:text-sm text-[#3d4947] mt-1 leading-relaxed">
                  Layanan{' '}
                  <strong className="text-[#0b1c30]">
                    {pendingPostSaveService.problem || pendingPostSaveService.serviceType}
                  </strong>{' '}
                  sudah tersimpan. Evaluasi Layanan menjadi satu-satunya sumber data untuk Evaluasi Program BK.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  showToast(
                    'Layanan ditandai "Belum Dievaluasi" di pengingat Beranda dan daftar layanan.',
                    'info'
                  );
                  setPendingPostSaveService(null);
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-[#3d4947] hover:bg-gray-100 cursor-pointer"
              >
                Nanti Saja
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingPostSaveService;
                  setPendingPostSaveService(null);
                  setGlobalEvalServiceTarget(target);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs sm:text-sm font-extrabold cursor-pointer shadow-xs"
              >
                Nilai Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Evaluasi Layanan Pop-up Form (dipicu dari Post-Save Prompt, Beranda, atau Riwayat) */}
      {globalEvalServiceTarget && (
        <EvaluasiWizardModal
          isOpen={Boolean(globalEvalServiceTarget)}
          onClose={() => setGlobalEvalServiceTarget(null)}
          onSave={(savedEval, printPdfAfterSave) => {
            handleSaveServiceEvaluation(savedEval);
            setGlobalEvalServiceTarget(null);
            showToast('Evaluasi Layanan berhasil disimpan!', 'success');
            if (printPdfAfterSave) {
              downloadSingleEvaluationCardPDF(savedEval, activeCounselor);
            }
          }}
          services={filteredServices}
          activeCounselor={activeCounselor}
          presetService={globalEvalServiceTarget}
          availableClasses={Array.from(
            new Set(filteredStudents.map((st) => st.class).filter(Boolean))
          ).sort()}
        />
      )}

      {/* Global Si Becik Chat Modal (Dibuka lewat FloatingSiBecik, Menu Lainnya > Si Becik, atau Header) */}
      {isSiBecikOpen && (
        <div
          className="fixed inset-0 z-[1000] bg-[#0b1c30]/60 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
          onClick={() => setIsSiBecikOpen(false)}
        >
          <div
            className="w-full max-w-3xl my-auto max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <AiAssistantWidget
              counselor={
                activeCounselor || {
                  id: 'c1',
                  name: 'Guru BK',
                  nip: '-',
                  role: 'Bimbingan Konseling',
                  avatar: '',
                  allowedClasses: [],
                }
              }
              students={filteredStudents}
              services={filteredServices}
              violations={filteredViolations}
              fabEnabled={siBecikFabEnabled}
              onToggleFabEnabled={handleToggleSiBecikFab}
              onInputFocusChange={setIsKeyboardOpen}
              onClose={() => setIsSiBecikOpen(false)}
              onNavigateToTab={(tab, q) => {
                setIsSiBecikOpen(false);
                handleNavigateToTab(tab, q);
              }}
              onNavigateToForm={(form, stId) => {
                setIsSiBecikOpen(false);
                handleNavigateToForm(form, stId);
              }}
            />
          </div>
        </div>
      )}

      {/* Global 1-Item Safe Delete Confirmation Modal (Pengganti confirm() native) */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 z-[1050] bg-[#0b1c30]/65 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-red-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-700 bg-red-50 px-2 py-0.5 rounded-md">
                  Konfirmasi Hapus 1 Data
                </span>
                <h3 className="text-lg font-extrabold text-[#0b1c30] mt-1">
                  {deleteConfirmModal.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#3d4947] mt-1.5 leading-relaxed">
                  {deleteConfirmModal.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#3d4947] bg-gray-100 hover:bg-gray-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const cb = deleteConfirmModal.onConfirm;
                  setDeleteConfirmModal(null);
                  cb();
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-extrabold cursor-pointer shadow-xs"
              >
                {deleteConfirmModal.confirmLabel || 'Ya, Hapus 1 Ini Saja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Floating Si Becik Button — HANYA SATU DI APP.TSX */}
      <FloatingSiBecik
        visible={showFab}
        badgeCount={siBecikBadgeCount}
        onClick={handleOpenSiBecik}
      />
    </div>
  );
}
