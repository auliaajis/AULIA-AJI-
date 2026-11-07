import { useState, useEffect, useRef, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import DataSiswaView from './components/DataSiswaView';
import CatatPelanggaranForm from './components/CatatPelanggaranForm';
import CatatApresiasiForm from './components/CatatApresiasiForm';
import TambahLayananForm from './components/TambahLayananForm';
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
import { RiwayatLayananView } from './components/RiwayatLayananView';
import { showToast } from './utils/toast';
import { motion, AnimatePresence } from 'motion/react';
import { downloadServicePDF, generateServicePDF, autoArchiveServiceToDrive, autoArchiveViolationToDrive } from './utils/pdfGenerator';
import { exportSingleServiceToIcs, exportServicesToIcs } from './utils/calendarSync';
import { triggerBackgroundAutoSync, ensureDriveFolderStructure } from './utils/googleSync';
import { registerDeletedId, registerSyncedIds, cleanupSyncedIds, clearCanonicalDeletedIds, resetStudentDeletedIds } from './utils/deletionTracker';
import { autoPushToJournal } from './utils/journalAutoLink';
import { CANONICAL_AULIA_STUDENTS } from './data/canonicalStudents';
import { 
  initRealtimeFirestoreSync, 
  stopRealtimeFirestoreSync,
  forceFullCloudSync,
  flushPendingCloudQueue,
  saveBulkToFirestore, 
  saveToFirestore, 
  deleteFromFirestore,
  saveAccountRequestToCloud,
  updateAccountRequestInCloud,
  deleteAccountRequestFromCloud,
  syncPreviewDataToAuliaAccount
} from './utils/firestoreSync';
import { getActiveSchoolId, setActiveSchoolId, getSchoolConfig, loadSchoolData, saveSchoolData, sanitizeSchoolId, switchSchoolWorkspace, getRegisteredSchools } from './utils/schoolConfig';
import { runStartupStorageCheck } from './utils/storageQuota';
import { purgeDummyData, purgeDummyStudents, isDummyStudent } from './utils/purgeDummyData';
import { applyTheme, getIsDarkMode } from './utils/theme';
import { verifyAndEnforceAccountPrivacy } from './utils/privacyVerification';

import {
  counselors,
  initialStudents,
  initialViolations,
  initialServices,
  initialLogs,
  initialHomeVisits,
  initialAttendanceHistory
} from './data/mockData';
import { Student, ViolationRecord, CounselingService, BKComponentType, ActivityLog, Counselor, StudentAchievement, PresetServiceData } from './types';
import { HeartHandshake, Calendar, Clock, Plus, UserCheck, Download, Edit2, Trash2, CheckCircle2, Search, Filter, Home, Mail, Layers, Info, Sparkles, BookOpen, Target, ShieldAlert, Settings, FileText, Printer, ArrowLeft } from 'lucide-react';
import { filterStudents, filterViolations, filterServices, filterAchievements, filterHomeVisits, filterLogs } from './utils/accessControl';
import { BK_COMPONENTS_DATA, getBKComponentForService, getComponentColorConfig, getPilarBadge, SIKLUS_LAYANAN_TERPADU } from './utils/bkKomprehensif';

export default function App() {
  // Navigation Routing States
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [preSelectedStudentId, setPreSelectedStudentId] = useState<string | undefined>(undefined);
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
    const currentSchoolId = getActiveSchoolId();
    let list: Counselor[] = loadSchoolData('bk_counselors', counselors, currentSchoolId);
    if (!list || list.length === 0) {
      list = [...counselors];
    }

    // Always guarantee Bapak Aulia Aji Sasongko exists with full privileges as Koordinator BK & Administrator
    let auliaIndex = list.findIndex(c => c.id === 'c1' || c.username === 'aulia' || (c.email && c.email.includes('auliasasongko')) || (c.name && c.name.toLowerCase().includes('aulia')));
    const defaultAulia: Counselor = {
      id: 'c1',
      name: 'Aulia Aji Sasongko, S.Pd.',
      role: 'Koordinator BK & Administrator Sekolah',
      nip: 'NIP. 19931231 202221 1 002',
      avatar: counselors.find(c => c.id === 'c1')?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
      allowedClasses: ['7A', '7B', '7C', '7D', '7E', '7F', '8A', '8B', '8C', '8D', '8E', '8F', '8G', '9A', '9B', '9C', '9D', '9E', '9F', '9G'],
      username: 'aulia',
      password: 'aulia',
      email: 'auliasasongko12@guru.smp.belajar.id',
      phone: '089681287339',
      schoolId: 'sch_20320123',
      schoolNpsn: '20320123',
      schoolName: 'SMP N 2 Susukan'
    };

    if (auliaIndex !== -1) {
      list[auliaIndex] = {
        ...defaultAulia,
        ...list[auliaIndex],
        id: 'c1',
        name: 'Aulia Aji Sasongko, S.Pd.',
        role: list[auliaIndex].role || 'Koordinator BK & Administrator Sekolah',
        nip: list[auliaIndex].nip && list[auliaIndex].nip !== '-' ? list[auliaIndex].nip : 'NIP. 19931231 202221 1 002',
        username: 'aulia',
        email: 'auliasasongko12@guru.smp.belajar.id',
        phone: list[auliaIndex].phone || '089681287339',
        allowedClasses: Array.isArray(list[auliaIndex].allowedClasses) ? list[auliaIndex].allowedClasses : []
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
        return {
          ...found,
          id: 'c1',
          name: 'Aulia Aji Sasongko, S.Pd.',
          role: found.role || 'Koordinator BK & Administrator Sekolah',
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
    const newCounselor: Counselor = {
      ...newCounselorRaw,
      allowedClasses: Array.isArray(newCounselorRaw.allowedClasses) ? newCounselorRaw.allowedClasses : [],
      role: newCounselorRaw.role || 'Guru Pembimbing BK',
      nip: newCounselorRaw.nip || '-',
      avatar: newCounselorRaw.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120'
    };
    const currentSchoolId = getActiveSchoolId();
    const targetSchoolId = newCounselor.schoolId || currentSchoolId;

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
    if (allCounselors.length <= 1) {
      alert('Tidak dapat menghapus satu-satunya profil guru pembimbing.');
      return;
    }
    const targetCounselor = allCounselors.find(c => c.id === id);
    const targetSchoolId = targetCounselor?.schoolId || getActiveSchoolId();
    const newList = allCounselors.filter(c => c.id !== id);
    setAllCounselors(newList);
    if (activeCounselor.id === id) {
      setActiveCounselor(newList[0]);
      localStorage.setItem('bk_active_counselor_id', newList[0].id);
    }
    saveSchoolData('bk_counselors', newList, targetSchoolId);
    deleteFromFirestore('bk_counselors', id, targetSchoolId);
    deleteAccountRequestFromCloud(id, targetSchoolId).catch(console.warn);
    window.dispatchEvent(new Event('storage'));
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
    alert('Database sekolah berhasil disiapkan! Berkas cadangan otomatis telah diunduh ke komputer Anda. Anda kini dapat mulai mengimpor data siswa atau menambahkan siswa baru untuk sekolah Anda.');
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
    const sanitized = isSmp && filtered.length > 0
      ? filtered.filter(s => !/^(10|11|12|X|XI|XII)/i.test(String(s.class || '').replace(/kelas\s*/i, '').trim()))
      : filtered;

    if (sanitized.length === 0 && sId === 'sch_20320123') {
      saveSchoolData('bk_students', CANONICAL_AULIA_STUDENTS, sId);
      return CANONICAL_AULIA_STUDENTS;
    }

    return sanitized;
  });

  const [violations, setViolations] = useState<ViolationRecord[]>(() => {
    const sId = getActiveSchoolId();
    const loaded = loadSchoolData<ViolationRecord[]>('bk_violations', sId === 'sch_20320123' ? initialViolations : [], sId);
    const isSmp = sId === 'sch_20320123' || (getSchoolConfig().schoolName || '').toLowerCase().includes('smp');
    const sanitized = isSmp && Array.isArray(loaded) && loaded.length > 0
      ? loaded.filter(v => !/^(10|11|12|X|XI|XII)/i.test(String(v.studentClass || '').replace(/kelas\s*/i, '').trim()))
      : loaded;

    if (sId === 'sch_20320123') {
      if (!sanitized || sanitized.length === 0) {
        saveSchoolData('bk_violations', initialViolations, sId);
        return initialViolations;
      }
    }
    return sanitized || [];
  });

  const [services, setServices] = useState<CounselingService[]>(() => {
    const sId = getActiveSchoolId();
    const loaded = loadSchoolData<CounselingService[]>('bk_services', sId === 'sch_20320123' ? initialServices : [], sId);
    if (sId === 'sch_20320123') {
      if (!loaded || loaded.length === 0) {
        saveSchoolData('bk_services', initialServices, sId);
        return initialServices;
      }
    }
    return loaded || [];
  });

  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    const sId = getActiveSchoolId();
    const loaded = loadSchoolData<ActivityLog[]>('bk_logs', sId === 'sch_20320123' ? initialLogs : [], sId);
    if (sId === 'sch_20320123') {
      if (!loaded || loaded.length === 0) {
        saveSchoolData('bk_logs', initialLogs, sId);
        return initialLogs;
      }
    }
    return Array.isArray(loaded) ? loaded.slice(0, 50) : [];
  });

  const [achievements, setAchievements] = useState<any[]>(() => {
    return loadSchoolData('bk_achievements', [], getActiveSchoolId());
  });

  const [homeVisits, setHomeVisits] = useState<any[]>(() => {
    const sId = getActiveSchoolId();
    const loaded = loadSchoolData<any[]>('bk_home_visits', sId === 'sch_20320123' ? initialHomeVisits : [], sId);
    if (sId === 'sch_20320123') {
      if (!loaded || loaded.length === 0) {
        saveSchoolData('bk_home_visits', initialHomeVisits, sId);
        return initialHomeVisits;
      }
    }
    return loaded || [];
  });

  // Modal & Filter states for Layanan BK
  const [editingService, setEditingService] = useState<CounselingService | null>(null);
  const [detailService, setDetailService] = useState<CounselingService | null>(null);
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'semua' | 'Terjadwal' | 'Selesai' | 'Dibatalkan'>('semua');
  const [servicePillarFilter, setServicePillarFilter] = useState<'semua' | BKComponentType>('semua');
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [selectedAbsensiClass, setSelectedAbsensiClass] = useState<string | undefined>(undefined);

  // Initialize Firebase Realtime Firestore Synchronization, Theme & Data Setup on mount
  useEffect(() => {
    resetStudentDeletedIds();
    clearCanonicalDeletedIds();
    runStartupStorageCheck();
    applyTheme(getIsDarkMode());

    // Enforce student data privacy and clean any foreign records
    const initialSchoolId = getActiveSchoolId();
    verifyAndEnforceAccountPrivacy(initialSchoolId);

    if (initialSchoolId === 'sch_20320123') {
      const checkStudents = loadSchoolData<Student[]>('bk_students', [], initialSchoolId);
      if (!Array.isArray(checkStudents) || checkStudents.length === 0) {
        saveSchoolData('bk_students', CANONICAL_AULIA_STUDENTS, initialSchoolId);
        setStudents(CANONICAL_AULIA_STUDENTS);
      } else {
        setStudents(checkStudents.filter((s) => !isDummyStudent(s)));
      }
    } else {
      const checkStudents = loadSchoolData<Student[]>('bk_students', [], initialSchoolId);
      if (Array.isArray(checkStudents)) {
        setStudents(checkStudents.filter((s) => !isDummyStudent(s)));
      }
    }

    if (initialSchoolId === 'sch_20320123') {
      const checkServices = loadSchoolData<CounselingService[]>('bk_services', [], initialSchoolId);
      if (!checkServices || checkServices.length === 0) {
        saveSchoolData('bk_services', initialServices, initialSchoolId);
        setServices(initialServices);
      }
      const checkViolations = loadSchoolData<ViolationRecord[]>('bk_violations', [], initialSchoolId);
      if (!checkViolations || checkViolations.length === 0) {
        saveSchoolData('bk_violations', initialViolations, initialSchoolId);
        setViolations(initialViolations);
      }
      const checkHomeVisits = loadSchoolData<any[]>('bk_home_visits', [], initialSchoolId);
      if (!checkHomeVisits || checkHomeVisits.length === 0) {
        saveSchoolData('bk_home_visits', initialHomeVisits, initialSchoolId);
        setHomeVisits(initialHomeVisits);
      }
      const checkLogs = loadSchoolData<ActivityLog[]>('bk_logs', [], initialSchoolId);
      if (!checkLogs || checkLogs.length === 0) {
        saveSchoolData('bk_logs', initialLogs, initialSchoolId);
        setLogs(initialLogs);
      }
      const checkAttendance = loadSchoolData<any[]>('bk_attendance_history', [], initialSchoolId);
      if (!checkAttendance || checkAttendance.length === 0) {
        saveSchoolData('bk_attendance_history', initialAttendanceHistory, initialSchoolId);
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

    const handleGoogleSessionRestored = (e: any) => {
      const tok = e?.detail?.token;
      ensureDriveFolderStructure(tok, true).catch(console.warn);
    };
    window.addEventListener('bk_google_session_restored', handleGoogleSessionRestored as EventListener);

    const handleRealtimeSync = (e: any) => {
      const key = e.detail?.key;
      const data = e.detail?.data;
      const schoolId = e.detail?.schoolId;
      const activeSchoolId = getActiveSchoolId();

      // If the broadcasted update belongs to another school workspace, ignore it (except counselors for cross-school pending ACC)
      if (schoolId && schoolId !== activeSchoolId && key !== 'bk_counselors') {
        return;
      }
      if (!key) return;

      const getSafeData = (k: string) => {
        if (Array.isArray(data)) return data;
        return loadSchoolData(k, [], activeSchoolId);
      };

      if (key === 'bk_students') {
        const val = getSafeData('bk_students');
        if (val) setStudents(val);
      } else if (key === 'bk_violations') {
        const val = getSafeData('bk_violations');
        if (val) setViolations(val);
      } else if (key === 'bk_services') {
        const val = getSafeData('bk_services');
        if (val) setServices(val);
      } else if (key === 'bk_logs') {
        const val = getSafeData('bk_logs');
        if (val) setLogs(Array.isArray(val) ? val.slice(0, 80) : val);
      } else if (key === 'bk_achievements') {
        const val = getSafeData('bk_achievements');
        if (val) setAchievements(val);
      } else if (key === 'bk_home_visits') {
        const val = getSafeData('bk_home_visits');
        if (val) setHomeVisits(val);
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

    // When switching active school, immediately reload school-isolated states
    const handleSchoolChanged = (e: any) => {
      const newSchoolId = e.detail?.schoolId || getActiveSchoolId();
      verifyAndEnforceAccountPrivacy(newSchoolId);
      const st = loadSchoolData('bk_students', initialStudents, newSchoolId);
      setStudents(st && st.length > 0 ? st : initialStudents);
      const vl = loadSchoolData('bk_violations', initialViolations, newSchoolId);
      setViolations(vl && vl.length > 0 ? vl : initialViolations);
      const sv = loadSchoolData('bk_services', initialServices, newSchoolId);
      setServices(sv && sv.length > 0 ? sv : initialServices);
      const lg = loadSchoolData('bk_logs', initialLogs, newSchoolId);
      setLogs(lg && lg.length > 0 ? lg.slice(0, 80) : initialLogs);
      setAchievements(loadSchoolData('bk_achievements', [], newSchoolId));
      setHomeVisits(loadSchoolData('bk_home_visits', [], newSchoolId));
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
        if (['bk_students', 'bk_violations', 'bk_services', 'bk_logs', 'bk_achievements', 'bk_home_visits', 'bk_counselors'].includes(baseKey)) {
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
    } else {
      setCurrentView(tab);
    }
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
    const nameWords = newStudent.name.trim().split(' ');
    const initials = nameWords.map((w) => w[0]).join('').substring(0, 2).toUpperCase();

    const currentSchoolId = getActiveSchoolId();
    const added: Student = {
      ...newStudent,
      id: `s-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      initials,
      schoolId: currentSchoolId,
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
    const currentSchoolId = getActiveSchoolId();
    const nameWords = updatedStudent.name.trim().split(' ');
    const initials = nameWords.map((w) => w[0]).join('').substring(0, 2).toUpperCase();
    const studentWithInitials = { ...updatedStudent, initials, schoolId: currentSchoolId };

    setStudents((prev) => {
      const updated = prev.map((s) => (s.id === updatedStudent.id ? studentWithInitials : s));
      saveSchoolData('bk_students', updated, currentSchoolId);
      return updated;
    });
    saveToFirestore('bk_students', studentWithInitials, currentSchoolId);
    showToast(`✅ Profil siswa "${studentWithInitials.name}" berhasil diperbarui!`, 'success');
  };

  // State trigger: Delete student
  const handleDeleteStudent = (id: string) => {
    registerDeletedId(id);
    const updated = students.filter((s) => s.id !== id);
    setStudents(updated);
    saveSchoolData('bk_students', updated);
    deleteFromFirestore('bk_students', id);
    window.dispatchEvent(new Event('storage'));
  };

  // State trigger: Clear all students and start with a clean slate
  const handleClearAllStudents = () => {
    const currentSchoolId = getActiveSchoolId();

    // Strictly clear student records only. Never wipe violations, services, home visits, or logs!
    students.forEach((s) => registerDeletedId(s.id));

    setStudents([]);

    localStorage.setItem(`bk_students_cleared_${currentSchoolId}`, 'true');
    localStorage.setItem(`bk_cleared_${currentSchoolId}`, 'true');
    localStorage.setItem('bk_dummy_students_purged', 'true');
    saveSchoolData('bk_students', [], currentSchoolId);
    saveBulkToFirestore('bk_students', [], currentSchoolId, true);

    window.dispatchEvent(new CustomEvent('bk_realtime_sync', {
      detail: { key: 'bk_students', data: [], schoolId: currentSchoolId }
    }));
    window.dispatchEvent(new Event('storage'));
  };

  const pushActivityLog = (newLog: ActivityLog) => {
    setLogs((prev) => [newLog, ...prev.slice(0, 79)]);
    saveToFirestore('bk_logs', newLog);
  };

  // State trigger: Record violation and update scores & activity feeds
  const handleSaveViolation = (newViolation: Omit<ViolationRecord, 'id' | 'ticketId'>) => {
    const randomTicketNum = Math.floor(1000 + Math.random() * 9000);
    const generatedTicketId = `PLG-${new Date().getFullYear()}-${randomTicketNum}`;
    const currentSchoolId = getActiveSchoolId();

    const added: ViolationRecord = {
      ...newViolation,
      id: `v-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      ticketId: generatedTicketId,
      schoolId: currentSchoolId,
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

        const newV: ViolationRecord = {
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
          handlingProgress: 'Disinkronkan otomatis dari Absensi Harian.',
          schoolId: getActiveSchoolId(),
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
    const currentSchoolId = getActiveSchoolId();
    const added: CounselingService = {
      ...newService,
      id: `srv-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      schoolId: currentSchoolId,
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

    // Reset pre-selected parameters (do not force dashboard so success screen displays)
    setPreSelectedStudentId(undefined);
  };

  const handleSaveAchievement = (newAchievement: any) => {
    const added = {
      ...newAchievement,
      id: `ach-${Date.now()}-${Math.floor(Math.random() * 100000)}`
    };

    setAchievements((prev) => [added, ...prev]);
    saveToFirestore('bk_achievements', added);

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

  const handleDeleteViolation = (id: string) => {
    const violationToDelete = violations.find(v => v.id === id);
    if (!violationToDelete) return;

    if (confirm('Apakah Anda yakin ingin menghapus catatan pelanggaran ini? Bobot pelanggaran siswa terkait akan berkurang secara otomatis.')) {
      registerDeletedId(id);
      const updatedViolations = violations.filter(v => v.id !== id);
      setViolations(updatedViolations);
      saveSchoolData('bk_violations', updatedViolations);
      deleteFromFirestore('bk_violations', id);

      const updatedStudents = students.map(student => {
        if (student.id === violationToDelete.studentId) {
          const upd = {
            ...student,
            violationPoints: Math.max(0, student.violationPoints - violationToDelete.pointsAdded)
          };
          saveToFirestore('bk_students', upd);
          return upd;
        }
        return student;
      });
      setStudents(updatedStudents);
      saveSchoolData('bk_students', updatedStudents);

      const today = new Date();
      const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
      const timeLabel = `HARI INI, ${formattedHour}`;
      const newLog: ActivityLog = {
        id: `log-${Date.now()}`,
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
    }
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

  const handleDeleteService = (id: string) => {
    const serviceToDelete = services.find(s => s.id === id);
    if (!serviceToDelete) return;

    if (confirm('Apakah Anda yakin ingin menghapus rekam layanan BK ini? Jumlah riwayat layanan siswa terkait akan berkurang secara otomatis.')) {
      registerDeletedId(id);
      const updatedServices = services.filter(s => s.id !== id);
      setServices(updatedServices);
      saveSchoolData('bk_services', updatedServices);
      deleteFromFirestore('bk_services', id);

      const participantIds = serviceToDelete.students.map(s => s.id);
      const updatedStudents = students.map(student => {
        if (participantIds.includes(student.id)) {
          const upd = {
            ...student,
            bkServicesCount: Math.max(0, student.bkServicesCount - 1)
          };
          saveToFirestore('bk_students', upd);
          return upd;
        }
        return student;
      });
      setStudents(updatedStudents);
      saveSchoolData('bk_students', updatedStudents);

      const today = new Date();
      const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
      const timeLabel = `HARI INI, ${formattedHour}`;
      const primaryStudentName = serviceToDelete.students[0]?.name || 'Siswa';
      const primaryStudentClass = serviceToDelete.students[0]?.class || '';
      const newLog: ActivityLog = {
        id: `log-${Date.now()}`,
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
    }
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

  const handleDeleteAchievement = (id: string) => {
    const achToDelete = achievements.find(a => a.id === id);
    if (!achToDelete) return;

    if (confirm('Apakah Anda yakin ingin menghapus bobot apresiasi ini? Bobot apresiasi siswa terkait akan berkurang secara otomatis.')) {
      registerDeletedId(id);
      const updatedAchievements = achievements.filter(a => a.id !== id);
      setAchievements(updatedAchievements);
      saveSchoolData('bk_achievements', updatedAchievements);
      deleteFromFirestore('bk_achievements', id);

      const updatedStudents = students.map(student => {
        if (student.id === achToDelete.studentId) {
          const upd = {
            ...student,
            achievementPoints: Math.max(0, (student.achievementPoints || 0) - achToDelete.pointsReward)
          };
          saveToFirestore('bk_students', upd);
          return upd;
        }
        return student;
      });
      setStudents(updatedStudents);
      saveSchoolData('bk_students', updatedStudents);

      const today = new Date();
      const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
      const timeLabel = `HARI INI, ${formattedHour}`;
      const newLog: ActivityLog = {
        id: `log-${Date.now()}`,
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
    }
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
            activeCounselor={activeCounselor}
            onNavigateToTab={handleNavigateToTab}
            onNavigateToForm={handleNavigateToForm}
            onUpdateViolationStatus={handleUpdateViolationStatus}
            onUpdateServiceStatus={handleUpdateServiceStatus}
            onEditService={(srv) => setEditingService(srv)}
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
            onDeleteViolation={handleDeleteViolation}
            onUpdateViolation={handleUpdateViolation}
            onDeleteService={handleDeleteService}
            onUpdateService={handleUpdateService}
            onDeleteAchievement={handleDeleteAchievement}
            onUpdateAchievement={handleUpdateAchievement}
            activeCounselor={activeCounselor}
            onAddStudent={handleAddStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
            onClearAllStudents={handleClearAllStudents}
            onNavigateToForm={handleNavigateToForm}
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
            onSaveViolation={handleSaveViolation}
            onUpdateViolation={handleUpdateViolation}
            onDeleteViolation={handleDeleteViolation}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
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
            onDeleteAchievement={handleDeleteAchievement}
            onUpdateAchievement={handleUpdateAchievement}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
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
                                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-[#00685f]" />
                                    <span>{srv.date}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-[#00685f]" />
                                    <span>
                                      {srv.startTime} - {srv.endTime} WIB
                                    </span>
                                  </div>
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
            activeCounselor={activeCounselor}
            onNavigateToTab={handleNavigateToTab}
            onNavigateToForm={handleNavigateToForm}
            onEditService={(srv) => setEditingService(srv)}
            onDeleteService={handleDeleteService}
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
            activeCounselor={activeCounselor}
            onNavigateToForm={handleNavigateToForm}
            onNavigateToStudioPdf={() => setCurrentView('studio-pdf')}
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
      case 'panggilan-ortu':
      case 'panggilan-orang-tua':
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
          />
        );
      default:
        return (
          <DashboardView
            students={filteredStudents}
            violations={filteredViolations}
            services={filteredServices}
            logs={filteredLogs}
            achievements={filteredAchievements}
            activeCounselor={activeCounselor}
            onNavigateToTab={handleNavigateToTab}
            onNavigateToForm={handleNavigateToForm}
            onUpdateViolationStatus={handleUpdateViolationStatus}
            onUpdateServiceStatus={handleUpdateServiceStatus}
            onEditService={(srv) => setEditingService(srv)}
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
          const cSchoolId = isAulia 
            ? 'sch_20320123' 
            : ((cleanNpsn ? sanitizeSchoolId(cleanNpsn) : '') || (counselor.schoolId ? sanitizeSchoolId(counselor.schoolId) : getActiveSchoolId()));

          const finalSchoolId = (isAulia || cSchoolId === 'sch_20320123' || cleanNpsn === '20320123') ? 'sch_20320123' : cSchoolId;

          // Ensure active school workspace matches target school
          if (finalSchoolId !== getActiveSchoolId()) {
            const registered = getRegisteredSchools();
            const targetSchool = registered.find(s => s.schoolId === finalSchoolId || (cleanNpsn && s.npsn === cleanNpsn)) || {
              schoolId: finalSchoolId,
              schoolName: isAulia ? 'SMP N 2 Susukan' : (counselor.schoolName || 'Sekolah Terdaftar'),
              npsn: isAulia ? '20320123' : (cleanNpsn || counselor.schoolNpsn || ''),
              schoolAddress: isAulia ? 'Jl. Kyai Hasan Anwar No. 16, Susukan, Kab. Semarang' : 'Alamat Sekolah',
              principalName: isAulia ? 'Agus Setiawan, S.Pd. Fis' : 'Kepala Sekolah',
              principalNip: isAulia ? '19680831 199103 1 007' : '-',
              governmentName: 'PEMERINTAH KABUPATEN SEMARANG',
              departmentName: 'DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA'
            };
            switchSchoolWorkspace(targetSchool);
          }

          setActiveSchoolId(finalSchoolId);

          // Build finalized counselor profile
          const finalizedCounselor: Counselor = isAulia ? {
            ...counselor,
            id: 'c1',
            name: 'Aulia Aji Sasongko, S.Pd.',
            role: 'Koordinator BK & Administrator Sekolah',
            nip: counselor.nip && counselor.nip !== '-' ? counselor.nip : 'NIP. 19931231 202221 1 002',
            avatar: counselor.avatar || counselors.find(c => c.id === 'c1')?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
            allowedClasses: ['7A', '7B', '7C', '7D', '7E', '7F', '8A', '8B', '8C', '8D', '8E', '8F', '8G', '9A', '9B', '9C', '9D', '9E', '9F', '9G'],
            username: 'aulia',
            email: 'auliasasongko12@guru.smp.belajar.id',
            phone: '089681287339',
            schoolId: 'sch_20320123',
            schoolNpsn: '20320123',
            schoolName: 'SMP N 2 Susukan'
          } : {
            ...counselor,
            schoolId: finalSchoolId,
            schoolNpsn: cleanNpsn || counselor.schoolNpsn || '',
            schoolName: counselor.schoolName || 'Sekolah Terdaftar'
          };

          // 1. Synchronously prepare and set states IMMEDIATELY so user NEVER sees 0 data
          const isCanonical = finalSchoolId === 'sch_20320123';
          const sFallback = isCanonical ? initialStudents : [];
          const vFallback = isCanonical ? initialViolations : [];
          const srvFallback = isCanonical ? initialServices : [];
          const lFallback = isCanonical ? initialLogs : [];
          const hvFallback = isCanonical ? initialHomeVisits : [];

          if (isCanonical) {
            resetStudentDeletedIds();
            if (typeof localStorage !== 'undefined') {
              localStorage.removeItem('bk_dummy_students_purged');
              localStorage.removeItem(`bk_cleared_${finalSchoolId}`);
              localStorage.removeItem(`bk_students_cleared_${finalSchoolId}`);
            }
          }

          const loadedStudents = loadSchoolData<Student[]>('bk_students', [], finalSchoolId);
          const finalStudents = (loadedStudents && loadedStudents.length > 0)
            ? loadedStudents.filter(s => !isDummyStudent(s))
            : sFallback;
          setStudents(finalStudents);
          saveSchoolData('bk_students', finalStudents, finalSchoolId);

          const loadedViolations = loadSchoolData<ViolationRecord[]>('bk_violations', vFallback, finalSchoolId);
          const finalViolations = (loadedViolations && loadedViolations.length > 0 && (!isCanonical || loadedViolations.length >= vFallback.length)) ? loadedViolations : vFallback;
          setViolations(finalViolations);
          saveSchoolData('bk_violations', finalViolations, finalSchoolId);

          const loadedServices = loadSchoolData<CounselingService[]>('bk_services', srvFallback, finalSchoolId);
          const finalServices = (loadedServices && loadedServices.length > 0 && (!isCanonical || loadedServices.length >= srvFallback.length)) ? loadedServices : srvFallback;
          setServices(finalServices);
          saveSchoolData('bk_services', finalServices, finalSchoolId);

          const loadedLogs = loadSchoolData<ActivityLog[]>('bk_logs', lFallback, finalSchoolId);
          const finalLogs = (loadedLogs && loadedLogs.length > 0) ? loadedLogs : lFallback;
          setLogs(finalLogs);
          saveSchoolData('bk_logs', finalLogs, finalSchoolId);

          const loadedHomeVisits = loadSchoolData<any[]>('bk_home_visits', hvFallback, finalSchoolId);
          const finalHomeVisits = (loadedHomeVisits && loadedHomeVisits.length > 0) ? loadedHomeVisits : hvFallback;
          setHomeVisits(finalHomeVisits);
          saveSchoolData('bk_home_visits', finalHomeVisits, finalSchoolId);

          setAchievements(loadSchoolData('bk_achievements', [], finalSchoolId));

          const attFallback = isCanonical ? initialAttendanceHistory : [];
          const loadedAttendance = loadSchoolData<any[]>('bk_attendance_history', attFallback, finalSchoolId);
          const finalAttendance = (loadedAttendance && loadedAttendance.length > 0) ? loadedAttendance : attFallback;
          saveSchoolData('bk_attendance_history', finalAttendance, finalSchoolId);

          // 2. Set authenticated state
          setActiveCounselor(finalizedCounselor);
          setIsLoggedIn(true);
          sessionStorage.setItem('bk_session_logged_in', 'true');
          localStorage.setItem('bk_is_logged_in', 'true');
          localStorage.setItem('bk_active_counselor_id', finalizedCounselor.id);

          // 3. Background asynchronous sync (never blocks UI or resets memory state)
          (async () => {
            try {
              verifyAndEnforceAccountPrivacy(finalSchoolId, finalizedCounselor.id);

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
      default:
        return 'Bimbingan Konseling';
    }
  };

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
          handleDeleteService(id);
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
          handleDeleteService(id);
          setDetailService(null);
        }}
        onUpdateStatus={(id, status) => {
          handleUpdateServiceStatus(id, status);
          if (detailService && detailService.id === id) {
            setDetailService({ ...detailService, status });
          }
        }}
      />
    </div>
  );
}
