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
  deleteAccountRequestFromCloud
} from './utils/firestoreSync';
import { getActiveSchoolId, setActiveSchoolId, getSchoolConfig, loadSchoolData, saveSchoolData, sanitizeSchoolId, switchSchoolWorkspace, getRegisteredSchools, getValidatedSchoolIdentity, buildSchoolStamp, enforceCanonicalSchoolCacheRepair } from './utils/schoolConfig';
import { runStartupStorageCheck } from './utils/storageQuota';
import { purgeDummyData, purgeDummyStudents, isDummyStudent, deduplicateAndPurgeAllData } from './utils/purgeDummyData';
import { applyTheme, getIsDarkMode } from './utils/theme';
import { ensureSchoolDocumentExists } from './utils/multiSchoolMigration';

import {
  counselors,
  initialViolations,
  initialServices,
  initialLogs,
  initialHomeVisits
} from './data/mockData';
import { Student, ViolationRecord, CounselingService, BKComponentType, ActivityLog, Counselor, StudentAchievement, PresetServiceData, ProgramEvaluation } from './types';
import { HeartHandshake, Calendar, Clock, Plus, UserCheck, Download, Edit2, Trash2, CheckCircle2, Search, Filter, Home, Mail, Layers, Info, Sparkles, BookOpen, Target, ShieldAlert, Settings, FileText, Printer, ArrowLeft } from 'lucide-react';
import { filterStudents, filterViolations, filterServices, filterAchievements, filterHomeVisits, filterLogs } from './utils/accessControl';
import { BK_COMPONENTS_DATA, getBKComponentForService, getComponentColorConfig, getPilarBadge, SIKLUS_LAYANAN_TERPADU } from './utils/bkKomprehensif';

export default function App() {
  // Navigation Routing States
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [peringatanFilter, setPeringatanFilter] = useState<PeringatanFilterTab>('semua');
  const [preSelectedStudentId, setPreSelectedStudentId] = useState<string | undefined>(undefined);
  const [violationInitialTab, setViolationInitialTab] = useState<'input' | 'arsip'>('input');
  const [violationInitialSearch, setViolationInitialSearch] = useState('');
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
    saveSchoolData('bk_students', [], currentSchoolId);
    saveSchoolData('bk_violations', [], currentSchoolId);
    saveSchoolData('bk_services', [], currentSchoolId);
    saveSchoolData('bk_logs', [], currentSchoolId);
    saveSchoolData('bk_achievements', [], currentSchoolId);
    saveSchoolData('bk_home_visits', [], currentSchoolId);

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

  // Core database states synchronized with localStorage & isolated per School ID
  const [students, setStudents] = useState<Student[]>(() => {
    const sId = getActiveSchoolId();
    const isExplicitlyCleared = typeof localStorage !== 'undefined' && 
      (localStorage.getItem(`bk_cleared_${sId}`) === 'true' || localStorage.getItem(`bk_students_cleared_${sId}`) === 'true');
    const isDummyPurged = typeof localStorage !== 'undefined' && localStorage.getItem('bk_dummy_students_purged') === 'true';

    const loaded = loadSchoolData<Student[]>('bk_students', [], sId);
    if (!Array.isArray(loaded)) return [];

    let filtered = loaded;
    if (isDummyPurged) {
      filtered = filtered.filter(s => !isDummyStudent(s));
    }
    if (isExplicitlyCleared && filtered.length === 0) {
      return [];
    }

    const isSmp = sId === 'sch_20320123' || (getSchoolConfig().schoolName || '').toLowerCase().includes('smp');
    const deletedSet = new Set(getDeletedIds());
    const cleanNonDummy = filtered.filter((s) => {
      if (!s || s.isDeleted === true || deletedSet.has(String(s.id)) || isDummyStudent(s)) return false;
      if (isSmp && /^(10|11|12|X|XI|XII)/i.test(String(s.class || '').replace(/kelas\s*/i, '').trim())) {
        return false;
      }
      return true;
    });

    if (cleanNonDummy.length !== loaded.length) {
      saveSchoolData('bk_students', cleanNonDummy, sId);
    }

    return cleanNonDummy;
  });

  const [violations, setViolations] = useState<ViolationRecord[]>(() => {
    const sId = getActiveSchoolId();
    const deletedSet = new Set(getDeletedIds());
    const hasSeeded = typeof localStorage !== 'undefined' && localStorage.getItem(`bk_initial_seeded_${sId}`) === 'true';
    const loaded = loadSchoolData<ViolationRecord[]>('bk_violations', [], sId);
    const isSmp = sId === 'sch_20320123' || (getSchoolConfig().schoolName || '').toLowerCase().includes('smp');
    const sanitized = Array.isArray(loaded)
      ? loaded.filter(v => {
          if (!v || v.isDeleted === true || deletedSet.has(String(v.id))) return false;
          if (isSmp && /^(10|11|12|X|XI|XII)/i.test(String(v.studentClass || '').replace(/kelas\s*/i, '').trim())) return false;
          return true;
        })
      : [];

    if (sId === 'sch_20320123' && !hasSeeded && sanitized.length === 0) {
      const seed = initialViolations.filter(v => !deletedSet.has(String(v.id)));
      saveSchoolData('bk_violations', seed, sId);
      return seed;
    }
    return sanitized;
  });

  const [services, setServices] = useState<CounselingService[]>(() => {
    const sId = getActiveSchoolId();
    const deletedSet = new Set(getDeletedIds());
    const hasSeeded = typeof localStorage !== 'undefined' && localStorage.getItem(`bk_initial_seeded_${sId}`) === 'true';
    const loaded = loadSchoolData<CounselingService[]>('bk_services', [], sId);
    const sanitized = Array.isArray(loaded)
      ? loaded.filter(s => s && s.isDeleted !== true && !deletedSet.has(String(s.id)))
      : [];
    if (sId === 'sch_20320123' && !hasSeeded && sanitized.length === 0) {
      const seed = initialServices.filter(s => !deletedSet.has(String(s.id)));
      saveSchoolData('bk_services', seed, sId);
      return seed;
    }
    return sanitized;
  });

  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    const sId = getActiveSchoolId();
    const deletedSet = new Set(getDeletedIds());
    const hasSeeded = typeof localStorage !== 'undefined' && localStorage.getItem(`bk_initial_seeded_${sId}`) === 'true';
    const loaded = loadSchoolData<ActivityLog[]>('bk_logs', [], sId);
    const sanitized = Array.isArray(loaded)
      ? loaded.filter(l => l && l.isDeleted !== true && !deletedSet.has(String(l.id)))
      : [];
    if (sId === 'sch_20320123' && !hasSeeded && sanitized.length === 0) {
      const seed = initialLogs.filter(l => !deletedSet.has(String(l.id)));
      saveSchoolData('bk_logs', seed, sId);
      return seed;
    }
    return sanitized.slice(0, 50);
  });

  const [achievements, setAchievements] = useState<any[]>(() => {
    const deletedSet = new Set(getDeletedIds());
    const loaded = loadSchoolData<any[]>('bk_achievements', [], getActiveSchoolId());
    return Array.isArray(loaded) ? loaded.filter(a => a && a.isDeleted !== true && !deletedSet.has(String(a.id))) : [];
  });

  const [homeVisits, setHomeVisits] = useState<any[]>(() => {
    const sId = getActiveSchoolId();
    const deletedSet = new Set(getDeletedIds());
    const hasSeeded = typeof localStorage !== 'undefined' && localStorage.getItem(`bk_initial_seeded_${sId}`) === 'true';
    const loaded = loadSchoolData<any[]>('bk_home_visits', [], sId);
    const sanitized = Array.isArray(loaded)
      ? loaded.filter(h => h && h.isDeleted !== true && !deletedSet.has(String(h.id)))
      : [];
    if (sId === 'sch_20320123' && !hasSeeded && sanitized.length === 0) {
      const seed = initialHomeVisits.filter(h => !deletedSet.has(String(h.id)));
      saveSchoolData('bk_home_visits', seed, sId);
      return seed;
    }
    return sanitized;
  });

  const [programEvaluations, setProgramEvaluations] = useState<ProgramEvaluation[]>(() => {
    const sId = getActiveSchoolId();
    const deletedSet = new Set(getDeletedIds());
    const loaded = loadSchoolData<ProgramEvaluation[]>('bk_program_evaluations', [], sId);
    return Array.isArray(loaded) ? loaded.filter(e => e && e.isDeleted !== true && !deletedSet.has(String(e.id))) : [];
  });

  const [serviceEvaluations, setServiceEvaluations] = useState<ProgramEvaluation[]>(() => {
    const sId = getActiveSchoolId();
    const deletedSet = new Set(getDeletedIds());
    const loaded = loadSchoolData<ProgramEvaluation[]>('bk_service_evaluations', [], sId);
    return Array.isArray(loaded) ? loaded.filter(e => e && e.isDeleted !== true && !deletedSet.has(String(e.id))) : [];
  });

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

  // Initialize Firebase Realtime Firestore Synchronization, Theme & Data Setup on mount
  useEffect(() => {
    runStartupStorageCheck();
    applyTheme(getIsDarkMode());

    const initialSchoolId = getActiveSchoolId();
    const isCanonicalSchool = initialSchoolId === 'sch_20320123';
    const deletedSet = new Set(getDeletedIds());
    const hasSeededFlag = typeof localStorage !== 'undefined' && localStorage.getItem(`bk_initial_seeded_${initialSchoolId}`) === 'true';

    const rawCheckStudents = loadSchoolData<Student[]>('bk_students', [], initialSchoolId);
    const cleanLocalStudents = Array.isArray(rawCheckStudents)
      ? rawCheckStudents.filter((s) => s && s.isDeleted !== true && !deletedSet.has(String(s.id)) && !isDummyStudent(s))
      : [];

    if (!Array.isArray(rawCheckStudents) || cleanLocalStudents.length !== rawCheckStudents.length) {
      saveSchoolData('bk_students', cleanLocalStudents, initialSchoolId);
    }
    setStudents(cleanLocalStudents);

    if (isCanonicalSchool && !hasSeededFlag) {
      const checkServices = loadSchoolData<CounselingService[]>('bk_services', [], initialSchoolId);
      if (!checkServices || checkServices.length === 0) {
        const seedS = initialServices.filter(s => !deletedSet.has(String(s.id)));
        saveSchoolData('bk_services', seedS, initialSchoolId);
        setServices(seedS);
      }
      const checkViolations = loadSchoolData<ViolationRecord[]>('bk_violations', [], initialSchoolId);
      if (!checkViolations || checkViolations.length === 0) {
        const seedV = initialViolations.filter(v => !deletedSet.has(String(v.id)));
        saveSchoolData('bk_violations', seedV, initialSchoolId);
        setViolations(seedV);
      }
      const checkHomeVisits = loadSchoolData<any[]>('bk_home_visits', [], initialSchoolId);
      if (!checkHomeVisits || checkHomeVisits.length === 0) {
        const seedHv = initialHomeVisits.filter(h => !deletedSet.has(String(h.id)));
        saveSchoolData('bk_home_visits', seedHv, initialSchoolId);
        setHomeVisits(seedHv);
      }
      const checkLogs = loadSchoolData<ActivityLog[]>('bk_logs', [], initialSchoolId);
      if (!checkLogs || checkLogs.length === 0) {
        const seedL = initialLogs.filter(l => !deletedSet.has(String(l.id)));
        saveSchoolData('bk_logs', seedL, initialSchoolId);
        setLogs(seedL);
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`bk_initial_seeded_${initialSchoolId}`, 'true');
      }
    }
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

    initRealtimeFirestoreSync();
    // Cloud-First: Immediately pull latest remote data from Firestore (<300ms)
    forceFullCloudSync().catch(console.warn);
    // Initialize & verify Google Drive organized folder structure ('SIKAP-BK/Laporan_Layanan', 'SIKAP-BK/Pelanggaran', 'SIKAP-BK/Jurnal', etc.)
    ensureDriveFolderStructure().catch(console.warn);

    // Multi-sekolah: Ensure collection `schools/{schoolId}` exists
    ensureSchoolDocumentExists(initialSchoolId).catch(console.warn);

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

      // If the broadcasted update belongs to another school workspace, ignore it (except counselors for cross-school pending ACC)
      if (schoolId && schoolId !== activeSchoolId && key !== 'bk_counselors') {
        return;
      }
      if (!key) return;

      // Surgical 1-item removal for doc_deleted events (never wipe whole state!)
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

      const isExplicitClear = typeof localStorage !== 'undefined' &&
        (localStorage.getItem(`bk_cleared_${activeSchoolId}`) === 'true' || localStorage.getItem(`bk_students_cleared_${activeSchoolId}`) === 'true');

      const getSafeData = (k: string) => {
        if (Array.isArray(data)) return data;
        return loadSchoolData(k, [], activeSchoolId);
      };

      const applyGuardedSync = <T,>(setter: (fn: (prev: T[]) => T[]) => void, val: T[], allowEmpty = true) => {
        if (!Array.isArray(val)) return;
        setter(prev => {
          if (Array.isArray(prev) && prev.length > 5 && val.length === 0 && !allowEmpty) {
            return prev;
          }
          return val;
        });
      };

      if (key === 'bk_students') {
        const val = getSafeData('bk_students');
        if (val) applyGuardedSync(setStudents, val, isExplicitClear);
      } else if (key === 'bk_violations' || key === 'bk_cases') {
        const val = getSafeData('bk_violations');
        if (val) applyGuardedSync(setViolations, val, isExplicitClear);
      } else if (key === 'bk_services' || key === 'bk_counseling') {
        const val = getSafeData('bk_services');
        if (val) applyGuardedSync(setServices, val, isExplicitClear);
      } else if (key === 'bk_logs') {
        const val = getSafeData('bk_logs');
        if (val) setLogs(Array.isArray(val) ? val.slice(0, 80) : val);
      } else if (key === 'bk_achievements' || key === 'bk_student_achievements') {
        const val = getSafeData('bk_achievements');
        if (val) applyGuardedSync(setAchievements, val, isExplicitClear);
      } else if (key === 'bk_home_visits') {
        const val = getSafeData('bk_home_visits');
        if (val) applyGuardedSync(setHomeVisits, val, isExplicitClear);
      } else if (key === 'bk_program_evaluations') {
        const val = getSafeData('bk_program_evaluations');
        if (val && Array.isArray(val)) applyGuardedSync(setProgramEvaluations, val, isExplicitClear);
      } else if (key === 'bk_service_evaluations') {
        const val = getSafeData('bk_service_evaluations');
        if (val && Array.isArray(val)) applyGuardedSync(setServiceEvaluations, val, isExplicitClear);
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
      }
    };

    // Dedicated listener for new account requests (pengajuan akun baru) in realtime
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
            const updated = Array.from(map.values());
            saveSchoolData('bk_counselors', updated, curSchoolId);
            return updated;
          });
        }
      }
    };

    // When switching active school, immediately reload school-isolated states (filter soft-deleted!)
    const handleSchoolChanged = (e: any) => {
      const newSchoolId = e.detail?.schoolId || getActiveSchoolId();
      const delSet = new Set(getDeletedIds());
      const filterActive = <T extends { id?: any; isDeleted?: boolean }>(arr: T[]): T[] =>
        Array.isArray(arr) ? arr.filter(it => it && it.isDeleted !== true && !delSet.has(String(it.id))) : [];

      const st = loadSchoolData<Student[]>('bk_students', [], newSchoolId);
      setStudents(filterActive(st).filter(s => !isDummyStudent(s)));
      const vl = loadSchoolData<ViolationRecord[]>('bk_violations', [], newSchoolId);
      setViolations(filterActive(vl));
      const sv = loadSchoolData<CounselingService[]>('bk_services', [], newSchoolId);
      setServices(filterActive(sv));
      const lg = loadSchoolData<ActivityLog[]>('bk_logs', [], newSchoolId);
      setLogs(filterActive(lg).slice(0, 80));
      setAchievements(filterActive(loadSchoolData<any[]>('bk_achievements', [], newSchoolId)));
      setHomeVisits(filterActive(loadSchoolData<any[]>('bk_home_visits', [], newSchoolId)));
      setProgramEvaluations(filterActive(loadSchoolData<ProgramEvaluation[]>('bk_program_evaluations', [], newSchoolId)));
      setServiceEvaluations(filterActive(loadSchoolData<ProgramEvaluation[]>('bk_service_evaluations', [], newSchoolId)));
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

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key) {
        // Strip school partition suffix if any
        let baseKey = e.key;
        if (baseKey.includes('_sch_')) {
          baseKey = baseKey.split('_sch_')[0];
        }
        if (['bk_students', 'bk_violations', 'bk_services', 'bk_logs', 'bk_achievements', 'bk_home_visits', 'bk_program_evaluations', 'bk_service_evaluations', 'bk_counselors'].includes(baseKey)) {
          handleRealtimeSync({ detail: { key: baseKey, schoolId: getActiveSchoolId() } });
        }
      }
    };

    window.addEventListener('bk_realtime_sync', handleRealtimeSync);
    window.addEventListener('bk_school_changed', handleSchoolChanged);
    window.addEventListener('bk_account_requests_updated', handleAccountRequestsUpdated);
    window.addEventListener('storage', handleStorageEvent as EventListener);

    return () => {
      window.removeEventListener('bk_realtime_sync', handleRealtimeSync);
      window.removeEventListener('bk_school_changed', handleSchoolChanged);
      window.removeEventListener('bk_account_requests_updated', handleAccountRequestsUpdated);
      window.removeEventListener('bk_google_session_restored', handleGoogleSessionRestored as EventListener);
      window.removeEventListener('storage', handleStorageEvent as EventListener);
    };
  }, []);

  // Keep cleared flag in sync if students are dynamically added
  useEffect(() => {
    const sId = getActiveSchoolId();
    const isCleared = typeof localStorage !== 'undefined' && localStorage.getItem(`bk_cleared_${sId}`) === 'true';
    if (isCleared && students.length > 0) {
      localStorage.removeItem(`bk_cleared_${sId}`);
    }
  }, [students.length]);

  // Local cache mirrors for instant page transitions without circular cloud writes
  useEffect(() => {
    saveSchoolData('bk_students', students);
  }, [students]);

  useEffect(() => {
    saveSchoolData('bk_violations', violations);
  }, [violations]);

  useEffect(() => {
    saveSchoolData('bk_services', services);
  }, [services]);

  useEffect(() => {
    saveSchoolData('bk_logs', logs);
  }, [logs]);

  useEffect(() => {
    saveSchoolData('bk_achievements', achievements);
  }, [achievements]);

  useEffect(() => {
    saveSchoolData('bk_counselors', allCounselors);
  }, [allCounselors]);

  useEffect(() => {
    saveSchoolData('bk_program_evaluations', programEvaluations);
  }, [programEvaluations]);

  useEffect(() => {
    saveSchoolData('bk_service_evaluations', serviceEvaluations);
  }, [serviceEvaluations]);

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
    } else if (tab === 'pelanggaran' || tab === 'catat-pelanggaran' || tab === 'arsip-pelanggaran' || tab === 'arsip-restitusi') {
      if (searchQueryOrClass) {
        setViolationInitialSearch(searchQueryOrClass);
        setViolationInitialTab('arsip');
      } else {
        setViolationInitialTab('arsip');
        setViolationInitialSearch('');
      }
      setCurrentView('pelanggaran');
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
    } else if (form === 'pelanggaran' || form === 'catat-pelanggaran') {
      setCurrentView('pelanggaran');
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

    setStudents((prev) => {
      const updated = [added, ...prev.filter((s) => s.id !== added.id)];
      saveSchoolData('bk_students', updated, currentSchoolId);
      return updated;
    });
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

    setStudents((prev) => {
      const updated = prev.map((s) => (s.id === updatedStudent.id ? studentWithInitials : s));
      saveSchoolData('bk_students', updated, currentSchoolId);
      return updated;
    });
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
      saveSchoolData('bk_students', res.next, currentSchoolId);
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
    saveSchoolData('bk_students', [], currentSchoolId);
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

    // Update violations list & sync directly to local school storage
    setViolations((prev) => {
      const updated = [added, ...prev.filter((v) => v.id !== added.id)];
      saveSchoolData('bk_violations', updated, currentSchoolId);
      return updated;
    });
    saveToFirestore('bk_violations', added, currentSchoolId);

    // Update associated student points & sync directly to local school storage
    setStudents((prev) => {
      const updated = prev.map((student) => {
        if (student.id === newViolation.studentId) {
          const updatedStudent = {
            ...student,
            violationPoints: (student.violationPoints || 0) + newViolation.pointsAdded,
          };
          saveToFirestore('bk_students', updatedStudent, currentSchoolId);
          return updatedStudent;
        }
        return student;
      });
      saveSchoolData('bk_students', updated, currentSchoolId);
      return updated;
    });

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

    // Update counseling list & sync directly to local school storage
    setServices((prev) => {
      const updated = [added, ...prev.filter((s) => s.id !== added.id)];
      saveSchoolData('bk_services', updated, currentSchoolId);
      return updated;
    });
    saveToFirestore('bk_services', added, currentSchoolId);

    // If linked to a student violation record, automatically mark violation handled by Guru BK
    if (added.linkedViolationId || added.linkedTicketId) {
      const vId = added.linkedViolationId;
      const tId = added.linkedTicketId;
      setViolations((prevViolations) => {
        const updatedViolations = prevViolations.map((v) => {
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
        });
        saveSchoolData('bk_violations', updatedViolations, currentSchoolId);
        return updatedViolations;
      });
    }
    setPresetServiceData(null);

    // Update bkServicesCount for all participants & sync directly to local school storage
    const participantIds = newService.students.map((s) => s.id);
    setStudents((prev) => {
      const updated = prev.map((student) => {
        if (participantIds.includes(student.id)) {
          const updatedStudent = {
            ...student,
            bkServicesCount: (student.bkServicesCount || 0) + 1,
          };
          saveToFirestore('bk_students', updatedStudent, currentSchoolId);
          return updatedStudent;
        }
        return student;
      });
      saveSchoolData('bk_students', updated, currentSchoolId);
      return updated;
    });

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
    setViolations((prev) =>
      prev.map((v) => {
        if (v.id === violationId) {
          return {
            ...v,
            handledBy,
            handlingProgress,
          };
        }
        return v;
      })
    );

    // Add activity log
    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;

    const targetV = violations.find((v) => v.id === violationId);
    if (targetV) {
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
    setServices((prev) =>
      prev.map((s) => {
        if (s.id === serviceId) {
          return {
            ...s,
            status,
            followUp: followUp || s.followUp,
          };
        }
        return s;
      })
    );

    // Add activity log
    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;

    const targetS = services.find((s) => s.id === serviceId);
    if (targetS) {
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
      saveSchoolData('bk_violations', res.next, currentSchoolId);
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
      saveSchoolData('bk_students', updatedStudents, currentSchoolId);
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
      saveSchoolData('bk_services', res.next, currentSchoolId);
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
      saveSchoolData('bk_students', updatedStudents, currentSchoolId);
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

    setServices(prev => prev.map(s => s.id === updated.id ? updated : s));

    const oldParticipantIds = oldService.students.map(st => st.id);
    const newParticipantIds = updated.students.map(st => st.id);

    const removedIds = oldParticipantIds.filter(id => !newParticipantIds.includes(id));
    const addedIds = newParticipantIds.filter(id => !oldParticipantIds.includes(id));

    if (removedIds.length > 0 || addedIds.length > 0) {
      setStudents(prevStudents =>
        prevStudents.map(student => {
          if (removedIds.includes(student.id)) {
            return { ...student, bkServicesCount: Math.max(0, student.bkServicesCount - 1) };
          }
          if (addedIds.includes(student.id)) {
            return { ...student, bkServicesCount: student.bkServicesCount + 1 };
          }
          return student;
        })
      );
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
      saveSchoolData('bk_achievements', res.next, currentSchoolId);
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
      saveSchoolData('bk_students', updatedStudents, currentSchoolId);
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
      saveSchoolData('bk_program_evaluations', next, currentSchoolId);
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
      saveSchoolData('bk_program_evaluations', res.next, currentSchoolId);
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
      saveSchoolData('bk_service_evaluations', next, currentSchoolId);
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
      saveSchoolData('bk_service_evaluations', res.next, currentSchoolId);
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

    if (data.students) setStudents(data.students);
    if (data.violations) setViolations(data.violations);
    if (data.services) setServices(data.services);
    if (data.achievements) setAchievements(data.achievements);
    if (data.attendance) {
      localStorage.setItem('bk_attendance_history', JSON.stringify(data.attendance));
    }
    if (data.journals) {
      localStorage.setItem('bk_daily_journals', JSON.stringify(data.journals));
    }
    if (data.homeVisits) {
      localStorage.setItem('bk_home_visits', JSON.stringify(data.homeVisits));
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
      case 'pelanggaran':
      case 'catat-pelanggaran':
        return (
          <CatatPelanggaranForm
            students={filteredStudents}
            violations={filteredViolations}
            activeCounselor={activeCounselor}
            preSelectedStudentId={preSelectedStudentId}
            initialTab={violationInitialTab}
            initialArchiveSearch={violationInitialSearch}
            onNavigateToProfile={handleNavigateToProfile}
            onSaveViolation={handleSaveViolation}
            onUpdateViolation={handleUpdateViolation}
            onDeleteViolation={(id) => handleDeleteViolation(id, true)}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={(id) => handleDeleteStudent(id, true)}
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

          const searchedAndFilteredServices = filteredServices.filter((srv) => {
            const matchesStatus =
              serviceStatusFilter === 'semua' || srv.status === serviceStatusFilter;
            const currentPillar = srv.bkComponent || getBKComponentForService(srv.serviceType);
            const matchesPillar =
              servicePillarFilter === 'semua' || currentPillar === servicePillarFilter;
            const term = serviceSearchTerm.toLowerCase();
            const matchesSearch =
              !term ||
              srv.problem.toLowerCase().includes(term) ||
              srv.serviceType.toLowerCase().includes(term) ||
              (srv.focusIssue && srv.focusIssue.toLowerCase().includes(term)) ||
              (srv.description && srv.description.toLowerCase().includes(term)) ||
              srv.students.some(
                (st) =>
                  st &&
                  (String(st.name || '').toLowerCase().includes(term) ||
                    String(st.class || '').toLowerCase().includes(term) ||
                    String(st.nis ?? '').toLowerCase().includes(term))
              );
            return matchesStatus && matchesPillar && matchesSearch;
          });

          return (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Module Header Banner */}
              <PageHeaderBanner
                category="Layanan & Bimbingan"
                title="Layanan Konseling & Advokasi Siswa"
                description="Pusat pendokumentasian sesi konseling individual/kelompok, kunjungan rumah (home visit), serta pemanggilan resmi orang tua/wali."
                icon={<HeartHandshake className="w-5 h-5" />}
                badge="4 Pilar BK Komprehensif"
                workflowHint="1. Pilih Sub-modul (Sesi / Home Visit / Panggilan) › 2. Input Rekam Bimbingan › 3. Simpan & Cetak Berita Acara PDF"
                stats={[
                  { label: 'Sesi Selesai', value: filteredServices.filter(s => s.status === 'Selesai').length, color: 'text-emerald-700' },
                  { label: 'Sesi Terjadwal', value: filteredServices.filter(s => s.status === 'Terjadwal').length, color: 'text-amber-700' },
                  { label: 'Home Visit', value: filteredHomeVisits.length },
                  { label: 'Total Sesi', value: filteredServices.length, color: 'text-[#00685f]' }
                ]}
                actions={
                  <button
                    onClick={() => handleNavigateToForm('tambah-layanan')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-md cursor-pointer active:scale-97"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Sesi Baru</span>
                  </button>
                }
              />

              {/* Top Sub-tab Switcher: Sesi Layanan vs Home Visit vs Panggilan Orang Tua */}
              <div className="flex items-center gap-1.5 p-1.5 bg-gray-100 rounded-2xl border border-[#bcc9c6]/40 w-fit flex-wrap shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleSwitchLayananSubTab('sesi')}
                  className={`relative px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-2 select-none active:scale-98 ${
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
                  <span className="relative z-10">Sesi Layanan BK & Konseling</span>
                  <span
                    className={`relative z-10 px-1.5 py-0.5 text-[10px] rounded-full font-black transition-colors ${
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
                  className={`relative px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-2 select-none active:scale-98 ${
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
                  <span className="relative z-10">Kunjungan Rumah (Home Visit)</span>
                  <span
                    className={`relative z-10 px-1.5 py-0.5 text-[10px] rounded-full font-black transition-colors ${
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
                  className={`relative px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-2 select-none active:scale-98 ${
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

              {/* Sub-tab Content with Smooth Directional Slide Transitions */}
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
                      className="space-y-6"
                    >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h2 className="text-2xl font-extrabold text-[#0b1c30]">Daftar Layanan BK</h2>
                        <p className="text-sm text-[#3d4947]/70 font-semibold mt-0.5">
                          Kelola, edit, dan pantau seluruh sesi bimbingan dan konseling siswa.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          onClick={() => exportServicesToIcs(
                            searchedAndFilteredServices,
                            `Jadwal-Layanan-BK-${new Date().toISOString().slice(0, 10)}.ics`,
                            'Jadwal Layanan BK SMPN 2 Susukan'
                          )}
                          className="flex items-center gap-1.5 px-3.5 py-3 bg-[#00685f]/10 hover:bg-[#00685f] text-[#00685f] hover:text-white rounded-xl text-sm font-bold transition-all border border-[#00685f]/30 cursor-pointer shadow-xs active:scale-97"
                          title="Ekspor daftar jadwal sesi layanan ini ke format file kalender .ics (Google Calendar / HP)"
                        >
                          <Download className="w-4 h-4" />
                          <span>Ekspor .ics ({searchedAndFilteredServices.length})</span>
                        </button>

                        <button
                          onClick={() => handleNavigateToForm('tambah-layanan')}
                          className="flex items-center gap-2 px-5 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-sm font-bold transition-all shadow-md cursor-pointer active:scale-97"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Tambah Sesi Layanan</span>
                        </button>
                      </div>
                    </div>

                    {/* Filters & Search Control Bar */}
                    <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/30 shadow-xs space-y-3">
                      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        {/* Search Bar */}
                        <div className="relative w-full md:w-80">
                          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={serviceSearchTerm}
                            onChange={(e) => setServiceSearchTerm(e.target.value)}
                            placeholder="Cari nama siswa, topik, pilar, masalah..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                          />
                          {serviceSearchTerm && (
                            <button
                              onClick={() => setServiceSearchTerm('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Status Filter Tabs */}
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
                          {(['semua', 'Terjadwal', 'Selesai', 'Dibatalkan'] as const).map((st) => {
                            const isActive = serviceStatusFilter === st;
                            const count =
                              st === 'semua'
                                ? filteredServices.length
                                : filteredServices.filter((s) => s.status === st).length;
                            return (
                              <button
                                key={st}
                                onClick={() => setServiceStatusFilter(st)}
                                className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap select-none ${
                                  isActive
                                    ? 'text-[#00685f]'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                              >
                                {isActive && (
                                  <motion.div
                                    layoutId="layanan-status-filter-pill"
                                    className="absolute inset-0 bg-white rounded-lg shadow-xs"
                                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                                  />
                                )}
                                <span className="relative z-10">{st === 'semua' ? 'Semua Status' : st}</span>
                                <span className={`relative z-10 ml-1.5 px-1.5 py-0.2 text-[10px] rounded-full ${isActive ? 'bg-[#00685f]/10 text-[#00685f]' : 'bg-gray-200 text-gray-600'}`}>
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 4 Pillars Filter Segmented Bar */}
                      <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5 overflow-x-auto pb-1">
                        <button
                          onClick={() => setServicePillarFilter('semua')}
                          className={`relative px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 select-none ${
                            servicePillarFilter === 'semua'
                              ? 'text-white'
                              : 'bg-gray-50 text-[#3d4947] hover:bg-gray-100 border border-gray-200/60'
                          }`}
                        >
                          {servicePillarFilter === 'semua' && (
                            <motion.div
                              layoutId="layanan-pillar-filter-pill"
                              className="absolute inset-0 bg-[#00685f] rounded-xl shadow-xs"
                              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                            />
                          )}
                          <span className="relative z-10">Semua 4 Pilar BK</span>
                          <span className={`relative z-10 px-1.5 py-0.2 text-[10px] rounded-full ${servicePillarFilter === 'semua' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                            {filteredServices.length}
                          </span>
                        </button>

                        {BK_COMPONENTS_DATA.map((comp) => {
                          const isActive = servicePillarFilter === comp.id;
                          const pilarCount = filteredServices.filter(
                            (s) => (s.bkComponent || getBKComponentForService(s.serviceType)) === comp.id
                          ).length;

                          return (
                            <button
                              key={comp.id}
                              onClick={() => setServicePillarFilter(comp.id)}
                              className={`relative px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 select-none ${
                                isActive
                                  ? 'text-white'
                                  : 'bg-gray-50 text-[#3d4947] hover:bg-gray-100 border border-gray-200/60'
                              }`}
                            >
                              {isActive && (
                                <motion.div
                                  layoutId="layanan-pillar-filter-pill"
                                  className="absolute inset-0 bg-[#00685f] rounded-xl shadow-xs"
                                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                                />
                              )}
                              <span className="relative z-10">Pilar {comp.pilarNumber}: {comp.name}</span>
                              <span className={`relative z-10 px-1.5 py-0.2 text-[10px] rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                                {pilarCount}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {searchedAndFilteredServices.length === 0 ? (
                      <div className="bg-white rounded-2xl p-12 text-center border border-[#bcc9c6]/30">
                        <HeartHandshake className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-bold text-[#0b1c30]">Tidak ada rekam layanan BK ditemukan</p>
                        <p className="text-xs text-gray-500 mt-1">Coba sesuaikan kata kunci pencarian, filter status, atau pilar BK.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {searchedAndFilteredServices.map((srv) => {
                          let badgeColor = 'bg-[#00685f]/10 text-[#00685f]';
                          if (srv.status === 'Selesai') badgeColor = 'bg-[#6b38d4]/10 text-[#6b38d4]';
                          else if (srv.status === 'Dibatalkan') badgeColor = 'bg-[#ba1a1a]/10 text-[#ba1a1a]';

                          const pilarName = srv.bkComponent || getBKComponentForService(srv.serviceType);
                          const pilarBadgeInfo = getPilarBadge(pilarName);
                          const isServiceEvaluated = serviceEvaluations.some((ev) => ev.serviceId === srv.id);

                          return (
                            <div
                              key={srv.id}
                              className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                            >
                              <div>
                                <div className="flex justify-between items-start mb-2 gap-2">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs bg-[#eff4ff] text-[#00685f] font-extrabold px-2.5 py-1 rounded-lg">
                                      {srv.serviceType}
                                    </span>
                                    {!isServiceEvaluated && (
                                      <span
                                        className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300"
                                        title="Badge terkunci sampai Evaluasi Layanan diisi"
                                      >
                                        Belum Dievaluasi
                                      </span>
                                    )}
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${pilarBadgeInfo.badgeClass}`}>
                                      {pilarBadgeInfo.pilar}
                                    </span>
                                    {(srv.bidangBimbingan || srv.specificDetails?.bidangBimbingan) && (
                                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/70">
                                        Bidang: {srv.bidangBimbingan || srv.specificDetails?.bidangBimbingan}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${badgeColor}`}>
                                      {srv.status}
                                    </span>
                                    {/* Edit Modal Trigger Button */}
                                    <button
                                      onClick={() => setEditingService(srv)}
                                      className="p-1.5 bg-gray-50 hover:bg-[#00685f]/10 text-gray-600 hover:text-[#00685f] rounded-lg transition-colors cursor-pointer border border-gray-200/80"
                                      title="Edit Sesi Layanan"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {srv.focusIssue && (
                                  <div className="mb-2">
                                    <span className="inline-block text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200/70 px-2 py-0.5 rounded-md">
                                      Fokus: {srv.focusIssue}
                                    </span>
                                  </div>
                                )}

                                <div 
                                  onClick={() => setDetailService(srv)}
                                  className="cursor-pointer group-hover:text-[#00685f] transition-colors"
                                >
                                  <h4 className="font-bold text-[#0b1c30] text-sm line-clamp-1 group-hover:text-[#00685f]">
                                    {srv.problem}
                                  </h4>
                                  <p className="text-xs text-[#3d4947]/80 line-clamp-2 mt-1 leading-relaxed">
                                    {srv.description}
                                  </p>
                                </div>

                                {srv.proofPhotoUrl && (
                                  <div 
                                    onClick={() => setDetailService(srv)}
                                    className="mt-3 relative rounded-lg overflow-hidden border border-gray-100 bg-gray-50 h-20 flex items-center justify-center cursor-pointer"
                                  >
                                    <img
                                      src={srv.proofPhotoUrl}
                                      alt="Bukti Sesi"
                                      className="h-full object-contain"
                                      referrerPolicy="no-referrer"
                                    />
                                    <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                      Bukti Foto
                                    </span>
                                  </div>
                                )}

                                <div className="mt-4 pt-3 border-t border-[#bcc9c6]/10 space-y-1.5">
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                    Peserta Siswa:
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {srv.students.map((st) => (
                                      <span
                                        key={st.id}
                                        className="text-[10px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                                      >
                                        {st.name} ({st.class})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 pt-3 border-t border-[#bcc9c6]/10 space-y-3">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                                  <Calendar className="w-3.5 h-3.5 text-[#00685f]" />
                                  <span>{formatCardDateTime(srv.date, srv.startTime)}</span>
                                </div>

                                {/* Quick Action Controls */}
                                <div className="flex items-center justify-between gap-1.5 pt-1">
                                  <div className="flex flex-wrap items-center gap-1.5 flex-1">
                                    <button
                                      onClick={() => setDetailService(srv)}
                                      className="py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-[#3d4947] rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer border border-gray-200/80 active:scale-97"
                                      title="Buka Dokumen Lengkap & Rekam Jejak"
                                    >
                                      <FileText className="w-3 h-3" />
                                      <span>Detail</span>
                                    </button>

                                    <button
                                      onClick={() => generateServicePDF(srv)}
                                      className="py-1.5 px-2.5 bg-[#e6f4f1] hover:bg-[#d0ebe6] text-[#00685f] hover:text-[#005049] rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-[#00685f]/30 shadow-2xs active:scale-97"
                                      title="Cetak PDF Laporan Sesi Spesifik"
                                    >
                                      <Printer className="w-3 h-3 text-[#00685f]" />
                                      <span>Cetak PDF</span>
                                    </button>

                                    <button
                                      onClick={() => exportSingleServiceToIcs(srv)}
                                      className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer border border-emerald-300 shadow-2xs active:scale-97"
                                      title="Ekspor sesi ini ke format file kalender .ics (Google Calendar / HP)"
                                    >
                                      <Calendar className="w-3 h-3 text-emerald-600" />
                                      <span>.ics</span>
                                    </button>

                                    {srv.status === 'Terjadwal' && (
                                      <button
                                        onClick={() =>
                                          handleUpdateServiceStatus(
                                            srv.id,
                                            'Selesai',
                                            srv.followUp || 'Sesi konseling telah diselesaikan.'
                                          )
                                        }
                                        className="py-1.5 px-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-97"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Selesaikan</span>
                                      </button>
                                    )}

                                    {!isServiceEvaluated && (
                                      <button
                                        onClick={() => setGlobalEvalServiceTarget(srv)}
                                        className="py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-97"
                                        title="Nilai Layanan Ini Sekarang"
                                      >
                                        <Sparkles className="w-3 h-3" />
                                        <span>Nilai</span>
                                      </button>
                                    )}
                                  </div>

                                  <button
                                    onClick={() => handleDeleteService(srv.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                    title="Hapus Rekam Layanan"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
          <LainnyaView
            onNavigate={handleNavigateToTab}
            activeCounselor={activeCounselor}
            onLogout={handleLogout}
            students={filteredStudents}
            violations={filteredViolations}
            services={filteredServices}
            onClearAllStudents={handleClearAllStudents}
            onAddStudent={handleAddStudent}
          />
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

          // Ensure active school workspace matches target school
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

          // Build finalized counselor profile (jangan memalsukan schoolName/schoolId jika sekolah user belum diatur)
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

          // 1. Synchronously load non-deleted states WITHOUT resurrecting deleted records!
          const isCanonical = finalSchoolId === 'sch_20320123';
          const deletedSet = new Set(getDeletedIds());
          const hasSeededFlag = typeof localStorage !== 'undefined' && localStorage.getItem(`bk_initial_seeded_${finalSchoolId}`) === 'true';
          const filterActive = <T extends { id?: any; isDeleted?: boolean }>(arr: T[]): T[] =>
            Array.isArray(arr) ? arr.filter(it => it && it.isDeleted !== true && !deletedSet.has(String(it.id))) : [];

          const loadedStudents = loadSchoolData<Student[]>('bk_students', [], finalSchoolId);
          const cleanStudents = filterActive(loadedStudents).filter(s => !isDummyStudent(s));
          setStudents(cleanStudents);
          saveSchoolData('bk_students', cleanStudents, finalSchoolId);

          const loadedViolations = filterActive(loadSchoolData<ViolationRecord[]>('bk_violations', [], finalSchoolId));
          const finalViolations = (loadedViolations.length === 0 && isCanonical && !hasSeededFlag)
            ? initialViolations.filter(v => !deletedSet.has(String(v.id)))
            : loadedViolations;
          setViolations(finalViolations);
          saveSchoolData('bk_violations', finalViolations, finalSchoolId);

          const loadedServices = filterActive(loadSchoolData<CounselingService[]>('bk_services', [], finalSchoolId));
          const finalServices = (loadedServices.length === 0 && isCanonical && !hasSeededFlag)
            ? initialServices.filter(s => !deletedSet.has(String(s.id)))
            : loadedServices;
          setServices(finalServices);
          saveSchoolData('bk_services', finalServices, finalSchoolId);

          const loadedLogs = filterActive(loadSchoolData<ActivityLog[]>('bk_logs', [], finalSchoolId));
          const finalLogs = (loadedLogs.length === 0 && isCanonical && !hasSeededFlag)
            ? initialLogs.filter(l => !deletedSet.has(String(l.id)))
            : loadedLogs;
          setLogs(finalLogs);
          saveSchoolData('bk_logs', finalLogs, finalSchoolId);

          const loadedHomeVisits = filterActive(loadSchoolData<any[]>('bk_home_visits', [], finalSchoolId));
          const finalHomeVisits = (loadedHomeVisits.length === 0 && isCanonical && !hasSeededFlag)
            ? initialHomeVisits.filter(h => !deletedSet.has(String(h.id)))
            : loadedHomeVisits;
          setHomeVisits(finalHomeVisits);
          saveSchoolData('bk_home_visits', finalHomeVisits, finalSchoolId);

          if (typeof localStorage !== 'undefined' && isCanonical) {
            localStorage.setItem(`bk_initial_seeded_${finalSchoolId}`, 'true');
          }

          setAchievements(filterActive(loadSchoolData<any[]>('bk_achievements', [], finalSchoolId)));
          setProgramEvaluations(filterActive(loadSchoolData<ProgramEvaluation[]>('bk_program_evaluations', [], finalSchoolId)));
          setServiceEvaluations(filterActive(loadSchoolData<ProgramEvaluation[]>('bk_service_evaluations', [], finalSchoolId)));

          // 2. Set authenticated state
          setActiveCounselor(finalizedCounselor);
          setIsLoggedIn(true);
          sessionStorage.setItem('bk_session_logged_in', 'true');
          localStorage.setItem('bk_is_logged_in', 'true');
          localStorage.setItem('bk_active_counselor_id', finalizedCounselor.id);

          // 3. Background cloud sync (strictly respects isDeleted !== true from Firestore)
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
            } catch (syncErr) {
              console.warn('Background sync on login warning:', syncErr);
            }
          })();
        }}
      />
    );
  }

  const getPageTitle = (view: string) => {
    switch (view) {
      case 'data-siswa':
        return searchQuery ? `Data Siswa (Pencarian: "${searchQuery}")` : 'Data Siswa Sekolah';
      case 'absensi':
        return selectedAbsensiClass ? `Presensi Kelas ${selectedAbsensiClass}` : 'Absen Siswa Hari Ini';
      case 'pelanggaran':
      case 'catat-pelanggaran':
        return 'Catat Kasus Siswa';
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
    'catat-pelanggaran',
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
    globalEvalServiceTarget !== null;

  const showFab =
    isLoggedIn &&
    !isSiBecikOpen &&
    siBecikFabEnabled &&
    !isKeyboardOpen &&
    !isFormOrModalOpen;

  const unseenOverdueCount = useMemo(
    () => overdueFollowUpIds.filter((id) => !seenOverdueIds.includes(id)).length,
    [overdueFollowUpIds, seenOverdueIds]
  );

  const siBecikBadgeCount = unseenOverdueCount + (siBecikUnread ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#f8fafa] text-[#0b1c30] app-root">
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
        [Beranda] [Siswa] [+ Catat] [Laporan] [Lainnya]
      */}
      <BottomNavBar
        currentView={currentView}
        onNavigate={handleNavigateToTab}
        studentCount={filteredStudents.length}
      />

      {/* Edit Scheduled Service Modal */}
      <EditLayananModal
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
