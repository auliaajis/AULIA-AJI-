import { useState, useEffect, useRef } from 'react';
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
import EditLayananModal from './components/EditLayananModal';
import ToastContainer from './components/ToastContainer';
import MobileFab from './components/MobileFab';
import { motion, AnimatePresence } from 'motion/react';
import { downloadServicePDF } from './utils/pdfGenerator';
import { triggerBackgroundAutoSync } from './utils/googleSync';
import { registerDeletedId, registerSyncedIds, cleanupSyncedIds } from './utils/deletionTracker';
import { autoPushToJournal } from './utils/journalAutoLink';
import { 
  initRealtimeFirestoreSync, 
  saveBulkToFirestore, 
  saveToFirestore, 
  deleteFromFirestore,
  saveAccountRequestToCloud,
  updateAccountRequestInCloud,
  deleteAccountRequestFromCloud
} from './utils/firestoreSync';
import { getActiveSchoolId, loadSchoolData, saveSchoolData } from './utils/schoolConfig';
import { purgeDummyData } from './utils/purgeDummyData';
import { applyTheme, getIsDarkMode } from './utils/theme';

import {
  counselors
} from './data/mockData';
import { Student, ViolationRecord, CounselingService, ActivityLog, Counselor, StudentAchievement } from './types';
import { HeartHandshake, Calendar, Clock, Plus, UserCheck, Download, Edit2, Trash2, CheckCircle2, Search, Filter, Home, Mail } from 'lucide-react';
import { filterStudents, filterViolations, filterServices, filterLogs } from './utils/accessControl';

export default function App() {
  // Navigation Routing States
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [preSelectedStudentId, setPreSelectedStudentId] = useState<string | undefined>(undefined);
  const [presetJournalData, setPresetJournalData] = useState<{
    className?: string;
    topic?: string;
    subject?: string;
    startTime?: string;
    endTime?: string;
    period?: string;
  } | null>(null);

  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const requireLogin = localStorage.getItem('bk_require_login') !== 'false'; // Defaults to true
    if (!requireLogin) {
      return true; // Login bypassed
    }
    return localStorage.getItem('bk_is_logged_in') === 'true';
  });

  const [allCounselors, setAllCounselors] = useState<Counselor[]>(() => {
    const currentSchoolId = getActiveSchoolId();
    let list: Counselor[] = loadSchoolData('bk_counselors', counselors, currentSchoolId);

    // Ensure Aulia Aji Sasongko exists as main user / c1
    let auliaIndex = list.findIndex(c => c.id === 'c1' || c.username === 'aulia' || (c.email && c.email.includes('auliasasongko')));
    if (auliaIndex !== -1) {
      list[auliaIndex] = {
        ...list[auliaIndex],
        id: 'c1',
        name: 'Aulia Aji Sasongko, S.Pd.',
        role: 'Admin & Guru Pembimbing BK',
        nip: list[auliaIndex].nip && list[auliaIndex].nip !== '-' ? list[auliaIndex].nip : 'NIP. 19931231 202221 1 002',
        username: 'aulia',
        email: 'auliasasongko12@guru.smp.belajar.id'
      };
    } else {
      const defaultAulia = counselors.find(c => c.id === 'c1');
      if (defaultAulia) {
        list.splice(1, 0, defaultAulia);
      }
    }

    // Ensure Bina Saptarina exists as a distinct team member with exact email
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

    saveSchoolData('bk_counselors', list, currentSchoolId);
    return list;
  });

  const [activeCounselor, setActiveCounselor] = useState<Counselor>(() => {
    const savedId = localStorage.getItem('bk_active_counselor_id');
    const found = allCounselors?.find((c) => c.id === savedId);
    if (found && !found.name.toLowerCase().includes('bina saptarina')) {
      return found;
    }
    const aulia = allCounselors?.find(c => c.id === 'c1' || c.username === 'aulia');
    if (aulia) {
      localStorage.setItem('bk_active_counselor_id', aulia.id);
      return aulia;
    }
    return counselors[1] || counselors[0];
  });

  const handleUpdateCounselor = (updated: Counselor) => {
    const newList = allCounselors.map(c => c.id === updated.id ? updated : c);
    setAllCounselors(newList);
    if (activeCounselor.id === updated.id) {
      setActiveCounselor(updated);
      localStorage.setItem('bk_active_counselor_id', updated.id);
    }
    const targetSchoolId = updated.schoolId || getActiveSchoolId();
    saveSchoolData('bk_counselors', newList, targetSchoolId);
    saveBulkToFirestore('bk_counselors', newList, targetSchoolId);
    saveToFirestore('bk_counselors', updated, targetSchoolId);
    updateAccountRequestInCloud(updated).catch(console.warn);
    window.dispatchEvent(new Event('storage'));
  };

  const handleChangeCounselor = (counselor: Counselor) => {
    setActiveCounselor(counselor);
    localStorage.setItem('bk_active_counselor_id', counselor.id);
    window.dispatchEvent(new Event('storage'));
  };

  const handleCreateCounselor = (newCounselor: Counselor, makeActive: boolean = false) => {
    const newList = [...allCounselors.filter(c => c.id !== newCounselor.id), newCounselor];
    setAllCounselors(newList);
    if (makeActive) {
      setActiveCounselor(newCounselor);
      localStorage.setItem('bk_active_counselor_id', newCounselor.id);
    }
    const targetSchoolId = newCounselor.schoolId || getActiveSchoolId();
    saveSchoolData('bk_counselors', newList, targetSchoolId);
    saveBulkToFirestore('bk_counselors', newList, targetSchoolId);
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
    saveBulkToFirestore('bk_counselors', newList, targetSchoolId);
    deleteFromFirestore('bk_counselors', id, targetSchoolId);
    deleteAccountRequestFromCloud(id, targetSchoolId).catch(console.warn);
    window.dispatchEvent(new Event('storage'));
  };

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Sub-tab state for Layanan BK
  const [layananSubTab, setLayananSubTab] = useState<'sesi' | 'homevisit' | 'panggilan'>('sesi');

  // Mobile navigation drawer toggle
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Core database states synchronized with localStorage & isolated per School ID
  const [students, setStudents] = useState<Student[]>(() => {
    return loadSchoolData('bk_students', [], getActiveSchoolId());
  });

  const [violations, setViolations] = useState<ViolationRecord[]>(() => {
    return loadSchoolData('bk_violations', [], getActiveSchoolId());
  });

  const [services, setServices] = useState<CounselingService[]>(() => {
    return loadSchoolData('bk_services', [], getActiveSchoolId());
  });

  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    return loadSchoolData('bk_logs', [], getActiveSchoolId());
  });

  const [achievements, setAchievements] = useState<any[]>(() => {
    return loadSchoolData('bk_achievements', [], getActiveSchoolId());
  });

  const [homeVisits, setHomeVisits] = useState<any[]>(() => {
    return loadSchoolData('bk_home_visits', [], getActiveSchoolId());
  });

  // Modal & Filter states for Layanan BK
  const [editingService, setEditingService] = useState<CounselingService | null>(null);
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'semua' | 'Terjadwal' | 'Selesai' | 'Dibatalkan'>('semua');
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [selectedAbsensiClass, setSelectedAbsensiClass] = useState<string | undefined>(undefined);

  // Initialize Firebase Realtime Firestore Synchronization, Theme & Purge Dummy Data on mount
  useEffect(() => {
    applyTheme(getIsDarkMode());

    // Purge any lingering dummy records automatically on mount
    purgeDummyData().then(({ totalPurged }) => {
      if (totalPurged > 0) {
        const currentSchoolId = getActiveSchoolId();
        setStudents(loadSchoolData('bk_students', [], currentSchoolId));
        setViolations(loadSchoolData('bk_violations', [], currentSchoolId));
        setServices(loadSchoolData('bk_services', [], currentSchoolId));
        setLogs(loadSchoolData('bk_logs', [], currentSchoolId));
      }
    });

    initRealtimeFirestoreSync();

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
        if (val) setLogs(val);
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
              map.set(c.id, { ...(existing || {}), ...c });
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
        setAllCounselors(prev => {
          const map = new Map<string, Counselor>();
          (prev || []).forEach(c => map.set(c.id, c));
          requests.forEach((req: Counselor) => {
            const existing = map.get(req.id);
            map.set(req.id, { ...(existing || {}), ...req });
          });
          const updated = Array.from(map.values());
          saveSchoolData('bk_counselors', updated);
          return updated;
        });
      }
    };

    // When switching active school, immediately reload school-isolated states
    const handleSchoolChanged = (e: any) => {
      const newSchoolId = e.detail?.schoolId || getActiveSchoolId();
      setStudents(loadSchoolData('bk_students', [], newSchoolId));
      setViolations(loadSchoolData('bk_violations', [], newSchoolId));
      setServices(loadSchoolData('bk_services', [], newSchoolId));
      setLogs(loadSchoolData('bk_logs', [], newSchoolId));
      setAchievements(loadSchoolData('bk_achievements', [], newSchoolId));
      setHomeVisits(loadSchoolData('bk_home_visits', [], newSchoolId));
      const loadedCounselors = loadSchoolData('bk_counselors', counselors, newSchoolId);
      if (loadedCounselors && loadedCounselors.length > 0) {
        setAllCounselors(loadedCounselors);
        setActiveCounselor(loadedCounselors[0]);
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
      window.removeEventListener('storage', handleStorageEvent as EventListener);
    };
  }, []);

  // Persists states on edits and syncs to Realtime Cloud Database (namespaced by schoolId)
  useEffect(() => {
    saveSchoolData('bk_students', students);
    saveBulkToFirestore('bk_students', students);
  }, [students]);

  useEffect(() => {
    saveSchoolData('bk_violations', violations);
    saveBulkToFirestore('bk_violations', violations);
  }, [violations]);

  useEffect(() => {
    saveSchoolData('bk_services', services);
    saveBulkToFirestore('bk_services', services);
  }, [services]);

  useEffect(() => {
    saveSchoolData('bk_logs', logs);
    saveBulkToFirestore('bk_logs', logs);
  }, [logs]);

  useEffect(() => {
    saveSchoolData('bk_achievements', achievements);
    saveBulkToFirestore('bk_achievements', achievements);
  }, [achievements]);

  useEffect(() => {
    saveSchoolData('bk_counselors', allCounselors);
    saveBulkToFirestore('bk_counselors', allCounselors);
  }, [allCounselors]);

  // Background Auto-Sync Trigger when core data changes (excluding initial render)
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Run the background sync quietly to keep Google Sheets up-to-date in real-time
    triggerBackgroundAutoSync();
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
      setLayananSubTab('homevisit');
      setCurrentView('layanan-bk');
    } else if (tab === 'panggilan-ortu' || tab === 'panggilan-orang-tua' || tab === 'panggilan') {
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

    const added: Student = {
      ...newStudent,
      id: `s-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      initials,
    };

    setStudents((prev) => [added, ...prev]);
  };

  // State trigger: Update student profile
  const handleUpdateStudent = (updatedStudent: Student) => {
    const nameWords = updatedStudent.name.trim().split(' ');
    const initials = nameWords.map((w) => w[0]).join('').substring(0, 2).toUpperCase();
    const studentWithInitials = { ...updatedStudent, initials };

    setStudents((prev) => prev.map((s) => (s.id === updatedStudent.id ? studentWithInitials : s)));
  };

  // State trigger: Delete student
  const handleDeleteStudent = (id: string) => {
    registerDeletedId(id);
    const updated = students.filter((s) => s.id !== id);
    setStudents(updated);
    saveSchoolData('bk_students', updated);
    saveBulkToFirestore('bk_students', updated);
    deleteFromFirestore('bk_students', id);
    window.dispatchEvent(new Event('storage'));
  };

  // State trigger: Clear all students and start with a clean slate
  const handleClearAllStudents = () => {
    students.forEach((s) => registerDeletedId(s.id));
    violations.forEach((v) => registerDeletedId(v.id));
    services.forEach((srv) => registerDeletedId(srv.id));
    logs.forEach((l) => registerDeletedId(l.id));

    setStudents([]);
    setViolations([]);
    setServices([]);
    setLogs([]);

    saveBulkToFirestore('bk_students', []);
    saveBulkToFirestore('bk_violations', []);
    saveBulkToFirestore('bk_services', []);
    saveBulkToFirestore('bk_logs', []);
  };

  // State trigger: Record violation and update scores & activity feeds
  const handleSaveViolation = (newViolation: Omit<ViolationRecord, 'id' | 'ticketId'>) => {
    const randomTicketNum = Math.floor(1000 + Math.random() * 9000);
    const generatedTicketId = `PLG-${new Date().getFullYear()}-${randomTicketNum}`;

    const added: ViolationRecord = {
      ...newViolation,
      id: `v-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      ticketId: generatedTicketId,
    };

    // Update violations list using functional state update
    setViolations((prev) => [added, ...prev]);

    // Update associated student points using functional state update
    setStudents((prev) =>
      prev.map((student) => {
        if (student.id === newViolation.studentId) {
          return {
            ...student,
            violationPoints: student.violationPoints + newViolation.pointsAdded,
          };
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
      type: 'violation',
      title: `Pelanggaran: ${newViolation.category}`,
      description: `${newViolation.studentName} (${newViolation.studentClass}) dilaporkan di ${newViolation.location}.`,
      studentName: newViolation.studentName,
      studentClass: newViolation.studentClass,
      timestamp: new Date(),
    };

    setLogs((prev) => [newLog, ...prev]);

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
        };

        newViolationsToAdd.push(newV);
        pointsToAddByStudent[rec.studentId] = (pointsToAddByStudent[rec.studentId] || 0) + pointWeight;
        syncedCount++;
      }
    });

    if (newViolationsToAdd.length > 0) {
      updatedViolations = [...newViolationsToAdd, ...updatedViolations];

      // Update student points
      setStudents((prev) =>
        prev.map((student) => {
          if (pointsToAddByStudent[student.id]) {
            return {
              ...student,
              violationPoints: student.violationPoints + pointsToAddByStudent[student.id],
            };
          }
          return student;
        })
      );

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

      setLogs((prev) => [...newLogs, ...prev]);
    }

    setViolations(updatedViolations);
    return syncedCount;
  };

  // State trigger: Record counseling session, update services count and activity logs
  const handleSaveService = (newService: Omit<CounselingService, 'id'>) => {
    const added: CounselingService = {
      ...newService,
      id: `srv-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    };

    // Update counseling list using functional state update
    setServices((prev) => [added, ...prev]);

    // Update bkServicesCount for all participants
    const participantIds = newService.students.map((s) => s.id);
    setStudents((prev) =>
      prev.map((student) => {
        if (participantIds.includes(student.id)) {
          return {
            ...student,
            bkServicesCount: student.bkServicesCount + 1,
          };
        }
        return student;
      })
    );

    // Generate recent activity log item
    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;

    const primaryStudentName = newService.students[0]?.name || 'Siswa';
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

    setLogs((prev) => [newLog, ...prev]);

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

    // Reset parameters and navigate back
    setPreSelectedStudentId(undefined);
    setCurrentView('dashboard');
  };

  const handleSaveAchievement = (newAchievement: any) => {
    const added = {
      ...newAchievement,
      id: `ach-${Date.now()}-${Math.floor(Math.random() * 100000)}`
    };

    setAchievements((prev) => [added, ...prev]);

    // Update associated student achievementPoints
    setStudents((prevStudents) =>
      prevStudents.map((student) => {
        if (student.id === newAchievement.studentId) {
          const currentAchievements = student.achievementPoints || 0;
          return {
            ...student,
            achievementPoints: currentAchievements + newAchievement.pointsReward,
          };
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

    setLogs((prevLogs) => [newLog, ...prevLogs]);

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

    setLogs((prev) => [newLog, ...prev]);
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
      setLogs((prevLogs) => [newLog, ...prevLogs]);
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
      setLogs((prevLogs) => [newLog, ...prevLogs]);
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
      saveBulkToFirestore('bk_violations', updatedViolations);
      deleteFromFirestore('bk_violations', id);

      const updatedStudents = students.map(student => {
        if (student.id === violationToDelete.studentId) {
          return {
            ...student,
            violationPoints: Math.max(0, student.violationPoints - violationToDelete.pointsAdded)
          };
        }
        return student;
      });
      setStudents(updatedStudents);
      saveSchoolData('bk_students', updatedStudents);
      saveBulkToFirestore('bk_students', updatedStudents);

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
      setLogs(prev => [newLog, ...prev]);
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleUpdateViolation = (updated: ViolationRecord) => {
    const oldViolation = violations.find(v => v.id === updated.id);
    if (!oldViolation) return;

    setViolations(prev => prev.map(v => v.id === updated.id ? updated : v));

    const pointsDiff = updated.pointsAdded - oldViolation.pointsAdded;
    if (pointsDiff !== 0) {
      setStudents(prevStudents =>
        prevStudents.map(student => {
          if (student.id === updated.studentId) {
            return {
              ...student,
              violationPoints: Math.max(0, student.violationPoints + pointsDiff)
            };
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
    setLogs(prev => [newLog, ...prev]);
  };

  const handleDeleteService = (id: string) => {
    const serviceToDelete = services.find(s => s.id === id);
    if (!serviceToDelete) return;

    if (confirm('Apakah Anda yakin ingin menghapus rekam layanan BK ini? Jumlah riwayat layanan siswa terkait akan berkurang secara otomatis.')) {
      registerDeletedId(id);
      const updatedServices = services.filter(s => s.id !== id);
      setServices(updatedServices);
      saveSchoolData('bk_services', updatedServices);
      saveBulkToFirestore('bk_services', updatedServices);
      deleteFromFirestore('bk_services', id);

      const participantIds = serviceToDelete.students.map(s => s.id);
      const updatedStudents = students.map(student => {
        if (participantIds.includes(student.id)) {
          return {
            ...student,
            bkServicesCount: Math.max(0, student.bkServicesCount - 1)
          };
        }
        return student;
      });
      setStudents(updatedStudents);
      saveSchoolData('bk_students', updatedStudents);
      saveBulkToFirestore('bk_students', updatedStudents);

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
      setLogs(prev => [newLog, ...prev]);
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
    setLogs(prev => [newLog, ...prev]);
  };

  const handleDeleteAchievement = (id: string) => {
    const achToDelete = achievements.find(a => a.id === id);
    if (!achToDelete) return;

    if (confirm('Apakah Anda yakin ingin menghapus bobot apresiasi ini? Bobot apresiasi siswa terkait akan berkurang secara otomatis.')) {
      registerDeletedId(id);
      const updatedAchievements = achievements.filter(a => a.id !== id);
      setAchievements(updatedAchievements);
      saveSchoolData('bk_achievements', updatedAchievements);
      saveBulkToFirestore('bk_achievements', updatedAchievements);
      deleteFromFirestore('bk_achievements', id);

      const updatedStudents = students.map(student => {
        if (student.id === achToDelete.studentId) {
          return {
            ...student,
            achievementPoints: Math.max(0, (student.achievementPoints || 0) - achToDelete.pointsReward)
          };
        }
        return student;
      });
      setStudents(updatedStudents);
      saveSchoolData('bk_students', updatedStudents);
      saveBulkToFirestore('bk_students', updatedStudents);

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
      setLogs(prev => [newLog, ...prev]);
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleUpdateAchievement = (updated: any) => {
    const oldAch = achievements.find(a => a.id === updated.id);
    if (!oldAch) return;

    setAchievements(prev => prev.map(a => a.id === updated.id ? updated : a));

    const pointsDiff = updated.pointsReward - oldAch.pointsReward;
    if (pointsDiff !== 0) {
      setStudents(prevStudents =>
        prevStudents.map(student => {
          if (student.id === updated.studentId) {
            return {
              ...student,
              achievementPoints: Math.max(0, (student.achievementPoints || 0) + pointsDiff)
            };
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
    setLogs(prev => [newLog, ...prev]);
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

    setLogs((prev) => [syncLog, ...prev]);
  };

  // Render individual view layout switch
  const renderMainView = () => {
    const filteredStudents = filterStudents(students, activeCounselor);
    const filteredViolations = filterViolations(violations, activeCounselor);
    const filteredServices = filterServices(services, activeCounselor);
    const filteredLogs = filterLogs(logs, activeCounselor);

    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView
            students={filteredStudents}
            violations={filteredViolations}
            services={filteredServices}
            logs={filteredLogs}
            achievements={achievements}
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
            achievements={achievements}
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
            achievements={achievements}
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

          const searchedAndFilteredServices = filteredServices.filter((srv) => {
            const matchesStatus =
              serviceStatusFilter === 'semua' || srv.status === serviceStatusFilter;
            const term = serviceSearchTerm.toLowerCase();
            const matchesSearch =
              !term ||
              srv.problem.toLowerCase().includes(term) ||
              srv.serviceType.toLowerCase().includes(term) ||
              (srv.description && srv.description.toLowerCase().includes(term)) ||
              srv.students.some(
                (st) =>
                  st.name.toLowerCase().includes(term) ||
                  st.class.toLowerCase().includes(term)
              );
            return matchesStatus && matchesSearch;
          });

          return (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Top Sub-tab Switcher: Sesi Layanan vs Home Visit vs Panggilan Orang Tua */}
              <div className="flex items-center gap-1.5 p-1.5 bg-gray-100/90 rounded-2xl border border-[#bcc9c6]/40 w-fit flex-wrap shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setLayananSubTab('sesi');
                    if (currentView !== 'layanan-bk') setCurrentView('layanan-bk');
                  }}
                  className={`relative px-4 py-2.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer flex items-center gap-2 select-none ${
                    activeTab === 'sesi'
                      ? 'text-[#00685f]'
                      : 'text-[#3d4947] hover:text-[#0b1c30]'
                  }`}
                >
                  {activeTab === 'sesi' && (
                    <motion.div
                      layoutId="layanan-subtab-pill-indicator"
                      className="absolute inset-0 bg-white rounded-xl shadow-xs border border-gray-200/60"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <HeartHandshake className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">Sesi Layanan BK & Konseling</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLayananSubTab('homevisit');
                    if (currentView !== 'layanan-bk') setCurrentView('layanan-bk');
                  }}
                  className={`relative px-4 py-2.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer flex items-center gap-2 select-none ${
                    activeTab === 'homevisit'
                      ? 'text-[#00685f]'
                      : 'text-[#3d4947] hover:text-[#0b1c30]'
                  }`}
                >
                  {activeTab === 'homevisit' && (
                    <motion.div
                      layoutId="layanan-subtab-pill-indicator"
                      className="absolute inset-0 bg-white rounded-xl shadow-xs border border-gray-200/60"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <Home className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">Kunjungan Rumah (Home Visit)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLayananSubTab('panggilan');
                    if (currentView !== 'layanan-bk') setCurrentView('layanan-bk');
                  }}
                  className={`relative px-4 py-2.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer flex items-center gap-2 select-none ${
                    activeTab === 'panggilan'
                      ? 'text-[#00685f]'
                      : 'text-[#3d4947] hover:text-[#0b1c30]'
                  }`}
                >
                  {activeTab === 'panggilan' && (
                    <motion.div
                      layoutId="layanan-subtab-pill-indicator"
                      className="absolute inset-0 bg-white rounded-xl shadow-xs border border-gray-200/60"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <Mail className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">Panggilan Orang Tua</span>
                </button>
              </div>

              {/* Sub-tab Content with Smooth Framer Motion Transitions */}
              <AnimatePresence mode="wait">
                {activeTab === 'homevisit' ? (
                  <motion.div
                    key="layanan-subtab-homevisit"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    <HomeVisitView
                      students={filteredStudents}
                      activeCounselor={activeCounselor}
                    />
                  </motion.div>
                ) : activeTab === 'panggilan' ? (
                  <motion.div
                    key="layanan-subtab-panggilan"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    <PanggilanOrangTuaView
                      students={filteredStudents}
                      activeCounselor={activeCounselor}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="layanan-subtab-sesi"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h2 className="text-2xl font-extrabold text-[#0b1c30]">Daftar Layanan BK</h2>
                        <p className="text-sm text-[#3d4947]/70 font-semibold mt-0.5">
                          Kelola, edit, dan pantau seluruh sesi bimbingan dan konseling siswa.
                        </p>
                      </div>
                      <button
                        onClick={() => handleNavigateToForm('tambah-layanan')}
                        className="flex items-center gap-2 px-5 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-sm font-bold transition-all shadow-md cursor-pointer active:scale-97"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah Sesi Layanan</span>
                      </button>
                    </div>

                    {/* Filters & Search Control Bar */}
                    <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/30 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
                      {/* Search Bar */}
                      <div className="relative w-full md:w-80">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={serviceSearchTerm}
                          onChange={(e) => setServiceSearchTerm(e.target.value)}
                          placeholder="Cari nama siswa, topik, kelas..."
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
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                isActive
                                  ? 'bg-white text-[#00685f] shadow-xs'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              {st === 'semua' ? 'Semua Status' : st}
                              <span className={`ml-1.5 px-1.5 py-0.2 text-[10px] rounded-full ${isActive ? 'bg-[#00685f]/10 text-[#00685f]' : 'bg-gray-200 text-gray-600'}`}>
                                {count}
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
                        <p className="text-xs text-gray-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter status.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {searchedAndFilteredServices.map((srv) => {
                          let badgeColor = 'bg-[#00685f]/10 text-[#00685f]';
                          if (srv.status === 'Selesai') badgeColor = 'bg-[#6b38d4]/10 text-[#6b38d4]';
                          else if (srv.status === 'Dibatalkan') badgeColor = 'bg-[#ba1a1a]/10 text-[#ba1a1a]';

                          return (
                            <div
                              key={srv.id}
                              className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                            >
                              <div>
                                <div className="flex justify-between items-start mb-3 gap-2">
                                  <span className="text-xs bg-[#eff4ff] text-[#00685f] font-extrabold px-2.5 py-1 rounded-lg">
                                    {srv.serviceType}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${badgeColor}`}>
                                      {srv.status}
                                    </span>
                                    {/* Edit Modal Trigger Button */}
                                    <button
                                      onClick={() => setEditingService(srv)}
                                      className="p-1.5 bg-gray-50 hover:bg-[#00685f]/10 text-gray-600 hover:text-[#00685f] rounded-lg transition-colors cursor-pointer border border-gray-200/80"
                                      title="Edit Detail & Sesi Layanan"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <h4 className="font-bold text-[#0b1c30] text-sm line-clamp-1">
                                  {srv.problem}
                                </h4>
                                <p className="text-xs text-[#3d4947]/80 line-clamp-2 mt-1 leading-relaxed">
                                  {srv.description}
                                </p>

                                {srv.proofPhotoUrl && (
                                  <div className="mt-3 relative rounded-lg overflow-hidden border border-gray-100 bg-gray-50 h-20 flex items-center justify-center">
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
                                <div className="flex items-center justify-between gap-2 pt-1">
                                  <div className="flex items-center gap-1.5 flex-1">
                                    {srv.status === 'Terjadwal' ? (
                                      <button
                                        onClick={() =>
                                          handleUpdateServiceStatus(
                                            srv.id,
                                            'Selesai',
                                            srv.followUp || 'Sesi konseling telah diselesaikan.'
                                          )
                                        }
                                        className="flex-1 py-1.5 px-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Selesaikan</span>
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => setEditingService(srv)}
                                        className="flex-1 py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                        <span>Edit / Detail</span>
                                      </button>
                                    )}

                                    <button
                                      onClick={() => downloadServicePDF(srv)}
                                      className="py-1.5 px-2.5 bg-[#00685f]/10 text-[#00685f] hover:bg-[#00685f] hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                      title="Unduh PDF Bukti"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <button
                                    onClick={() => handleDeleteService(srv.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
            preSelectedStudentId={preSelectedStudentId}
            onSaveService={handleSaveService}
            onCancel={() => {
              setPreSelectedStudentId(undefined);
              setCurrentView('dashboard');
            }}
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
            achievements={achievements}
            homeVisits={homeVisits}
            activeCounselor={activeCounselor}
            onNavigateToForm={handleNavigateToForm}
          />
        );
      case 'pengaturan':
        return (
          <PengaturanView
            activeCounselor={activeCounselor}
            allCounselors={allCounselors}
            onUpdateCounselor={handleUpdateCounselor}
            onChangeCounselor={handleChangeCounselor}
            onCreateCounselor={handleCreateCounselor}
            onDeleteCounselor={handleDeleteCounselor}
          />
        );
      case 'google-sync':
        return <GoogleIntegrationView onDataImported={handleGoogleDataImported} />;
      default:
        return (
          <DashboardView
            students={filteredStudents}
            violations={filteredViolations}
            services={filteredServices}
            logs={filteredLogs}
            achievements={achievements}
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
      setLayananSubTab('homevisit');
      setCurrentView('layanan-bk');
    } else if (tab === 'panggilan-ortu' || tab === 'panggilan-orang-tua' || tab === 'panggilan') {
      setLayananSubTab('panggilan');
      setCurrentView('layanan-bk');
    } else if (tab === 'layanan-bk' || tab === 'sesi') {
      setLayananSubTab('sesi');
      setCurrentView('layanan-bk');
    } else {
      setCurrentView(tab);
    }
  };

  if (!isLoggedIn) {
    return (
      <LoginView
        allCounselors={allCounselors}
        onCreateNewCounselor={handleCreateCounselor}
        onLoginSuccess={(counselor) => {
          setActiveCounselor(counselor);
          setIsLoggedIn(true);
          localStorage.setItem('bk_is_logged_in', 'true');
          localStorage.setItem('bk_active_counselor_id', counselor.id);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafa] text-[#0b1c30]">
      {/* Sidebar Controller */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          setIsMobileSidebarOpen(false); // Auto close sidebar on mobile navigation
        }}
        activeCounselor={activeCounselor}
        allCounselors={allCounselors}
        onUpdateCounselor={handleUpdateCounselor}
        onChangeCounselor={handleChangeCounselor}
        onCreateCounselor={handleCreateCounselor}
        onDeleteCounselor={handleDeleteCounselor}
        onLogout={() => {
          localStorage.setItem('bk_is_logged_in', 'false');
          setIsLoggedIn(false);
          setCurrentView('dashboard');
        }}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Column Wrapper */}
      <div className="lg:pl-64 min-h-screen flex flex-col transition-all duration-300">
        {/* Top Header bar with search input */}
        <Header
          activeCounselor={activeCounselor}
          allCounselors={allCounselors}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNavigateToStudent={handleNavigateToStudentTab}
          onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          services={services}
          violations={violations}
          homeVisits={homeVisits}
          students={students}
          onNavigateToTab={onNavigateToTab}
          onEditService={(srv) => setEditingService(srv)}
          onAddServiceOnDate={() => handleNavigateToForm('tambah-layanan')}
        />

        {/* Central Workspace view */}
        <main className="mt-16 p-4 sm:p-6 lg:p-8 flex-1">
          <div className="max-w-7xl mx-auto">
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

      {/* Mobile Floating Action Button (FAB) */}
      <MobileFab onNavigate={(view) => setCurrentView(view)} />

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
    </div>
  );
}
