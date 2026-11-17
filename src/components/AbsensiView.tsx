import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Student, ClassAttendanceRecord, StudentAttendance } from '../types';
import { downloadAttendanceRecapPDF, formatIndonesianDate } from '../utils/pdfGenerator';
import { 
  saveBulkToFirestore, 
  saveSchoolData, 
  loadSchoolData, 
  softDeleteFromFirestore,
  saveToFirestore,
  fetchCloudAttendance,
  flushPendingCloudQueue
} from '../utils/firestoreSync';
import { getSchoolConfig, getActiveSchoolId, getValidatedSchoolIdentity, buildSchoolStamp } from '../utils/schoolConfig';
import { getDeletedIds, registerDeletedId } from '../utils/deletionTracker';
import { showToast } from '../utils/toast';
import { isValidDeleteId, safeFilterSingleDelete } from '../utils/safeDelete';
import { 
  Calendar, 
  UserCheck, 
  Trash2, 
  History, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  FileSpreadsheet, 
  Search, 
  Eye, 
  TrendingUp, 
  AlertTriangle, 
  ChevronRight, 
  ChevronDown,
  RefreshCw, 
  Info,
  ClipboardList,
  Edit3,
  RotateCcw
} from 'lucide-react';
import { initialAttendanceHistory } from '../data/mockData';
import { compareClassNames, compareStudentNamesAZ } from '../utils/classNormalizer';

interface AbsensiViewProps {
  students: Student[];
  activeCounselor: { name: string; allowedClasses?: string[] | string };
  initialClass?: string;
  onAddActivityLog: (title: string, description: string, studentName: string, studentClass: string, type: 'attendance') => void;
  onAttendanceChanged?: () => void;
  onSyncAttendanceViolations?: (
    records: StudentAttendance[],
    date: string,
    className: string,
    pointWeight: number
  ) => number;
  onBackToDashboard?: () => void;
}

// Normalization helper for robust class name comparisons
const normalizeClassStr = (str: string = ''): string => {
  return String(str || '')
    .toLowerCase()
    .replace(/^kelas\s+/i, '')
    .replace(/^kls\s+/i, '')
    .replace(/^siswa\s+/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

const normalizeDateStr = (dateStr: string = ''): string => {
  if (!dateStr) return '';
  return String(dateStr).trim().slice(0, 10);
};

const STATUS_META: Record<'H' | 'S' | 'I' | 'A', {
  label: string;
  chipClass: string;
  optionClass: string;
}> = {
  H: {
    label: 'HADIR',
    chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-400 hover:bg-emerald-100',
    optionClass: 'text-emerald-700 hover:bg-emerald-50',
  },
  S: {
    label: 'SAKIT',
    chipClass: 'bg-amber-50 text-amber-800 border-amber-400 hover:bg-amber-100',
    optionClass: 'text-amber-800 hover:bg-amber-50',
  },
  I: {
    label: 'IZIN',
    chipClass: 'bg-blue-50 text-blue-700 border-blue-400 hover:bg-blue-100',
    optionClass: 'text-blue-700 hover:bg-blue-50',
  },
  A: {
    label: 'ALPA',
    chipClass: 'bg-rose-50 text-rose-700 border-rose-400 hover:bg-rose-100',
    optionClass: 'text-rose-700 hover:bg-rose-50',
  },
};

export default function AbsensiView({
  students,
  activeCounselor,
  initialClass,
  onAddActivityLog,
  onAttendanceChanged,
  onSyncAttendanceViolations,
  onBackToDashboard,
}: AbsensiViewProps) {
  // Navigation Tabs: 'input' | 'matrix' | 'history' | 'recap'
  const [activeTab, setActiveTab] = useState<'input' | 'matrix' | 'history' | 'recap'>('input');

  // Auto-sync settings for Alpa / Tanpa Keterangan
  const [alpaPointWeight] = useState<number>(() => {
    const saved = localStorage.getItem('bk_alpa_point_weight');
    return saved ? Number(saved) || 20 : 20;
  });

  const [autoSyncAlpa] = useState<boolean>(() => {
    const saved = localStorage.getItem('bk_auto_sync_alpa');
    return saved !== 'false';
  });

  // Note/keterangan modal state
  const [noteModal, setNoteModal] = useState<Student | null>(null);

  // Dropdown status open state (studentId)
  const [openDropdownStudentId, setOpenDropdownStudentId] = useState<string | null>(null);

  // Undo stack for quick revert
  const [undoStack, setUndoStack] = useState<Array<{
    snapshot: Record<string, StudentAttendance>;
    label: string;
  }>>([]);

  // Confirmation modal before final save / delete / restore
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncAlpaOnConfirm, setSyncAlpaOnConfirm] = useState(true);
  const [pendingDeleteRecordId, setPendingDeleteRecordId] = useState<string | null>(null);
  const [showRestoreAttConfirm, setShowRestoreAttConfirm] = useState(false);

  // Swipe gesture state
  const [swipeState, setSwipeState] = useState<{
    studentId: string;
    startX: number;
    startY: number;
    deltaX: number;
    isHorizontal: boolean | null;
  } | null>(null);
  const swipeTriggeredRef = useRef<boolean>(false);

  // Available Classes from student database (sorted 7A..7H, 8A..8H, 9A..9H)
  const availableClasses = useMemo(() => {
    const isDisallowed = (c: string) => /^(10|11|12|X|XI|XII)/i.test(String(c).replace(/kelas\s*/i, '').trim());
    const classesFromStudents = Array.from(new Set(students.map((s) => s.class)))
      .filter((c) => Boolean(c) && !isDisallowed(c))
      .sort(compareClassNames);
    if (classesFromStudents.length > 0) return classesFromStudents;
    const allowed = activeCounselor?.allowedClasses;
    if (Array.isArray(allowed) && allowed.length > 0) {
      return allowed.map(c => c.startsWith('Kelas') ? c : `Kelas ${c}`).sort(compareClassNames);
    }
    return ['Kelas 8A', 'Kelas 8B', 'Kelas 8C', 'Kelas 8D', 'Kelas 8E', 'Kelas 8F', 'Kelas 8G'];
  }, [students, activeCounselor]);

  // Selected State for Form Input
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (initialClass && (availableClasses.includes(initialClass) || availableClasses.length > 0)) {
      return initialClass;
    }
    return availableClasses[0] || 'Kelas 8A';
  });

  useEffect(() => {
    if (initialClass) {
      setSelectedClass(initialClass);
      setActiveTab('input');
    }
  }, [initialClass]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - tzOffset).toISOString().slice(0, 10);
  });

  // Current records loaded or created for selected class/date
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, StudentAttendance>>({});

  // Search & Filter state inside Input Form
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'H' | 'S' | 'I' | 'A'>('ALL');

  // Historical attendance list from school storage & Firestore (only seed once; never resurrect deleted docs)
  const [history, setHistory] = useState<ClassAttendanceRecord[]>(() => {
    const schoolId = getActiveSchoolId();
    const seedFlag = `bk_att_seeded_${schoolId}`;
    const alreadySeeded = typeof localStorage !== 'undefined' && localStorage.getItem(seedFlag) === 'true';
    const deletedSet = new Set(getDeletedIds());
    const loaded = loadSchoolData<ClassAttendanceRecord[]>('bk_attendance_history', []);
    if (Array.isArray(loaded) && loaded.length > 0) {
      return loaded.filter((h) => h && h.isDeleted !== true && !deletedSet.has(String(h.id)));
    }
    if (!alreadySeeded) {
      const initialClean = initialAttendanceHistory.filter((h) => h && !deletedSet.has(String(h.id)));
      saveSchoolData('bk_attendance_history', initialClean);
      if (typeof localStorage !== 'undefined') localStorage.setItem(seedFlag, 'true');
      return initialClean;
    }
    return [];
  });

  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);

  // Automatically fetch fresh cloud attendance from Firestore on mount (across devices)
  useEffect(() => {
    let isMounted = true;
    fetchCloudAttendance().then((cloudRecords) => {
      const deletedSet = new Set(getDeletedIds());
      if (isMounted && Array.isArray(cloudRecords)) {
        const active = cloudRecords.filter((h) => h && h.isDeleted !== true && !deletedSet.has(String(h.id)));
        if (active.length > 0) {
          setHistory(active);
        }
      }
    }).catch(console.warn);

    return () => {
      isMounted = false;
    };
  }, []);

  // Realtime subscriber for remote changes
  useEffect(() => {
    const handleRealtimeUpdate = (e: any) => {
      if (e.detail?.key === 'bk_attendance_history') {
        const deletedSet = new Set(getDeletedIds());
        if (Array.isArray(e.detail.data)) {
          setHistory(e.detail.data.filter((h: any) => h && h.isDeleted !== true && !deletedSet.has(String(h.id))));
        } else {
          setHistory(loadSchoolData<ClassAttendanceRecord[]>('bk_attendance_history', []).filter((h) => h && h.isDeleted !== true && !deletedSet.has(String(h.id))));
        }
      }
    };

    window.addEventListener('bk_realtime_sync', handleRealtimeUpdate);
    window.addEventListener('bk_attendance_history_changed', handleRealtimeUpdate);
    window.addEventListener('storage', (e) => {
      if (e.key && (e.key === 'bk_attendance_history' || e.key.startsWith('bk_attendance_history_sch_'))) {
        handleRealtimeUpdate({ detail: { key: 'bk_attendance_history' } });
      }
    });

    return () => {
      window.removeEventListener('bk_realtime_sync', handleRealtimeUpdate);
      window.removeEventListener('bk_attendance_history_changed', handleRealtimeUpdate);
    };
  }, []);

  // Close status dropdown when clicking outside
  useEffect(() => {
    if (!openDropdownStudentId) return;
    const handleOutside = () => setOpenDropdownStudentId(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [openDropdownStudentId]);

  // Manual trigger to pull fresh Firestore data & flush offline writes
  const handleManualCloudRefresh = async () => {
    setIsCloudSyncing(true);
    try {
      await flushPendingCloudQueue();
      const latest = await fetchCloudAttendance();
      if (latest && Array.isArray(latest)) {
        setHistory(latest);
      }
      showToast('☁️ Data absensi berhasil disinkronkan langsung dengan Cloud Firestore!', 'success');
    } catch (e) {
      showToast('Gagal menyinkronkan data dengan cloud. Periksa koneksi internet.', 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Manual restoration of canonical attendance data
  const handleRestoreAttendanceData = () => {
    setShowRestoreAttConfirm(true);
  };

  const executeRestoreAttendanceData = async () => {
    setShowRestoreAttConfirm(false);
    await saveHistoryToStorage(initialAttendanceHistory);
    showToast('🎉 Seluruh data absensi kelas 8A - 8G berhasil dipulihkan secara penuh!', 'success');
  };

  // Selected Detail Modal Record for Inspection
  const [detailModalRecord, setDetailModalRecord] = useState<ClassAttendanceRecord | null>(null);

  // Month & Year state for Matrix View
  const [matrixClass, setMatrixClass] = useState<string>(availableClasses[0] || 'Kelas 7A');
  const [matrixMonth, setMatrixMonth] = useState<string>(() => {
    const today = new Date();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${m}`;
  });

  // Recap Date Range State
  const getFirstDayOfMonth = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const firstDay = new Date(y, m, 1);
    const tzOffset = firstDay.getTimezoneOffset() * 60000;
    return new Date(firstDay.getTime() - tzOffset).toISOString().slice(0, 10);
  };

  const getTodayDateString = () => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - tzOffset).toISOString().slice(0, 10);
  };

  const [recapStartDate, setRecapStartDate] = useState<string>(getFirstDayOfMonth);
  const [recapEndDate, setRecapEndDate] = useState<string>(getTodayDateString);
  const [recapClass, setRecapClass] = useState<string>(selectedClass);

  // Keep recapClass in sync with selectedClass when selectedClass changes
  useEffect(() => {
    setRecapClass(selectedClass);
  }, [selectedClass]);

  // Save history back to school storage and Firestore Realtime
  const saveHistoryToStorage = async (updatedHistory: ClassAttendanceRecord[], singleRecord?: ClassAttendanceRecord) => {
    setHistory(updatedHistory);
    saveSchoolData('bk_attendance_history', updatedHistory);
    localStorage.setItem('bk_attendance_history', JSON.stringify(updatedHistory));

    // Save individual record to Firestore with atomic versioning & optimistic sync (<1ms)
    if (singleRecord && singleRecord.id) {
      saveToFirestore('bk_attendance_history', singleRecord).catch(console.warn);
    }
    saveBulkToFirestore('bk_attendance_history', updatedHistory).catch(console.warn);

    window.dispatchEvent(new CustomEvent('bk_attendance_history_changed', { detail: updatedHistory }));
    window.dispatchEvent(new Event('storage'));
    if (onAttendanceChanged) {
      onAttendanceChanged();
    }
  };

  // Robust helper to find attendance record matching class and date
  const findMatchingRecord = (classTarget: string, dateTarget: string): ClassAttendanceRecord | undefined => {
    const targetNorm = normalizeClassStr(classTarget);
    const dateNorm = normalizeDateStr(dateTarget);

    return history.find((h: any) => {
      const hClassNorm = normalizeClassStr(h.class || h.className || h.kelas || '');
      const hDateNorm = normalizeDateStr(h.date);
      return hClassNorm === targetNorm && hDateNorm === dateNorm;
    });
  };

  // Check if current selected date already has a saved record
  const currentSavedRecord = useMemo(() => {
    return findMatchingRecord(selectedClass, selectedDate);
  }, [history, selectedClass, selectedDate]);

  // Load attendance record when selected class or date changes
  useEffect(() => {
    const existingRecord = findMatchingRecord(selectedClass, selectedDate);

    const classStudents = students.filter(
      (s) => normalizeClassStr(s.class) === normalizeClassStr(selectedClass)
    );
    const newRecords: Record<string, StudentAttendance> = {};

    if (existingRecord) {
      existingRecord.records.forEach((rec) => {
        newRecords[rec.studentId] = rec;
      });
      classStudents.forEach((student) => {
        if (!newRecords[student.id]) {
          newRecords[student.id] = {
            studentId: student.id,
            studentName: student.name,
            nis: student.nis,
            status: 'H',
            notes: '',
          };
        }
      });
    } else {
      classStudents.forEach((student) => {
        newRecords[student.id] = {
          studentId: student.id,
          studentName: student.name,
          nis: student.nis,
          status: 'H',
          notes: '',
        };
      });
    }

    setAttendanceRecords(newRecords);
    setUndoStack([]);
    setOpenDropdownStudentId(null);
  }, [selectedClass, selectedDate, history, students]);

  // Class students sorted strictly A-Z (1..N attendance order matching Menu Siswa)
  const classStudentsSorted = useMemo(() => {
    const targetNorm = normalizeClassStr(selectedClass);
    return students
      .filter((s) => normalizeClassStr(s.class) === targetNorm)
      .sort(compareStudentNamesAZ);
  }, [students, selectedClass]);

  const absenNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    classStudentsSorted.forEach((st, idx) => {
      map.set(st.id, idx + 1);
    });
    return map;
  }, [classStudentsSorted]);

  // Filter students matching the selected class + search query + status filter (preserving A-Z attendance order)
  const filteredStudents = useMemo(() => {
    let result = classStudentsSorted;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s &&
          (String(s.name || '').toLowerCase().includes(q) ||
            String(s.nis ?? '').toLowerCase().includes(q) ||
            String(s.nisn ?? '').toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((s) => {
        const rec = attendanceRecords[s.id];
        return rec && rec.status === statusFilter;
      });
    }

    return result;
  }, [classStudentsSorted, searchQuery, statusFilter, attendanceRecords]);

  // Set single student status + push undo snapshot
  const handleSetStatus = (studentId: string, status: 'H' | 'S' | 'I' | 'A', customLabel?: string) => {
    setAttendanceRecords((prev) => {
      const record = prev[studentId];
      if (!record || record.status === status) return prev;
      setUndoStack((stack) => [
        ...stack.slice(-19),
        {
          snapshot: { ...prev },
          label: customLabel || `${record.studentName}: ${STATUS_META[record.status].label} → ${STATUS_META[status].label}`,
        },
      ]);
      return {
        ...prev,
        [studentId]: {
          ...record,
          status,
        },
      };
    });
  };

  // Cara 1 - Tap Nama: siklus H -> S -> I -> A -> H
  const handleTapNameCycle = (student: Student) => {
    if (swipeTriggeredRef.current) {
      swipeTriggeredRef.current = false;
      return;
    }
    const currentStatus = attendanceRecords[student.id]?.status || 'H';
    const nextMap: Record<'H' | 'S' | 'I' | 'A', 'H' | 'S' | 'I' | 'A'> = {
      H: 'S',
      S: 'I',
      I: 'A',
      A: 'H',
    };
    handleSetStatus(student.id, nextMap[currentStatus]);
  };

  // Undo last status change (single or bulk)
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setAttendanceRecords(last.snapshot);
    setUndoStack((prev) => prev.slice(0, -1));
    showToast(`Dibatalkan: ${last.label}`, 'info');
  };

  // Set single student notes/remarks
  const handleSetNotes = (studentId: string, notes: string) => {
    setAttendanceRecords((prev) => {
      const record = prev[studentId];
      if (!record) return prev;
      return {
        ...prev,
        [studentId]: {
          ...record,
          notes,
        },
      };
    });
  };

  // Bulk actions with Undo support
  const handleBulkSetStatus = (status: 'H' | 'S' | 'I' | 'A') => {
    setAttendanceRecords((prev) => {
      setUndoStack((stack) => [
        ...stack.slice(-19),
        {
          snapshot: { ...prev },
          label: `Tandai semua ${STATUS_META[status].label}`,
        },
      ]);
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => {
        updated[id] = {
          ...updated[id],
          status,
        };
      });
      return updated;
    });
  };

  // Swipe handlers (Cara 3: Geser kanan = Hadir, Geser kiri = Alpa)
  const startSwipe = (studentId: string, clientX: number, clientY: number) => {
    swipeTriggeredRef.current = false;
    setSwipeState({
      studentId,
      startX: clientX,
      startY: clientY,
      deltaX: 0,
      isHorizontal: null,
    });
  };

  const moveSwipe = (studentId: string, clientX: number, clientY: number) => {
    setSwipeState((prev) => {
      if (!prev || prev.studentId !== studentId) return prev;
      const dx = clientX - prev.startX;
      const dy = clientY - prev.startY;
      let isHoriz = prev.isHorizontal;
      if (isHoriz === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        isHoriz = Math.abs(dx) > Math.abs(dy) * 1.25;
      }
      if (!isHoriz) {
        return { ...prev, isHorizontal: false, deltaX: 0 };
      }
      const clamped = Math.max(-85, Math.min(85, dx));
      return { ...prev, isHorizontal: true, deltaX: clamped };
    });
  };

  const endSwipe = (student: Student) => {
    setSwipeState((prev) => {
      if (!prev || prev.studentId !== student.id) return null;
      if (prev.isHorizontal) {
        if (prev.deltaX >= 52) {
          swipeTriggeredRef.current = true;
          handleSetStatus(student.id, 'H', `${student.name}: Geser kanan → HADIR`);
          showToast(`${student.name}: HADIR`, 'success');
        } else if (prev.deltaX <= -52) {
          swipeTriggeredRef.current = true;
          handleSetStatus(student.id, 'A', `${student.name}: Geser kiri → ALPA`);
          showToast(`${student.name}: ALPA`, 'info');
        }
      }
      return null;
    });
  };

  // Open Save confirmation modal first
  const handleRequestSaveAttendance = () => {
    const recordsArray = Object.values(attendanceRecords) as StudentAttendance[];
    if (recordsArray.length === 0) return;
    setSyncAlpaOnConfirm(autoSyncAlpa);
    setShowSaveConfirmModal(true);
  };

  // Confirmed Save/Submit attendance record -> return to Beranda
  const handleConfirmSaveAttendance = async () => {
    const schoolValidation = getValidatedSchoolIdentity(activeCounselor as any);
    if (!schoolValidation.ok) {
      showToast('Gagal: Sekolah belum diatur', 'error');
      return;
    }
    const recordsArray = Object.values(attendanceRecords) as StudentAttendance[];
    if (recordsArray.length === 0) return;

    setIsSaving(true);
    try {
      const targetNorm = normalizeClassStr(selectedClass);
      const dateNorm = normalizeDateStr(selectedDate);
      const recordId = `att-${selectedClass.replace(/\s+/g, '-').toLowerCase()}-${selectedDate}`;
      const d = new Date();
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} WIB`;
      const timestampLabel = `${formatIndonesianDate(d.toISOString().split('T')[0])}, ${timeStr}`;
      const stamp = buildSchoolStamp(schoolValidation, activeCounselor?.name || 'Guru BK');

      const newRecord: ClassAttendanceRecord = {
        ...stamp,
        id: recordId,
        class: selectedClass,
        date: selectedDate,
        records: recordsArray,
        updatedAt: timestampLabel,
        submittedBy: activeCounselor.name,
      };

      const existingIndex = history.findIndex((h: any) => {
        return (
          h.id === recordId ||
          (normalizeClassStr(h.class || h.className || h.kelas || '') === targetNorm &&
            normalizeDateStr(h.date) === dateNorm)
        );
      });

      let updatedHistory = [...history];
      if (existingIndex > -1) {
        updatedHistory[existingIndex] = newRecord;
      } else {
        updatedHistory = [newRecord, ...updatedHistory];
      }

      await saveHistoryToStorage(updatedHistory, newRecord);

      let syncedCount = 0;
      if (syncAlpaOnConfirm && onSyncAttendanceViolations) {
        const alpaRecords = recordsArray.filter((r) => r.status === 'A');
        if (alpaRecords.length > 0) {
          syncedCount = onSyncAttendanceViolations(
            alpaRecords,
            selectedDate,
            selectedClass,
            alpaPointWeight
          );
        }
      }

      const sick = recordsArray.filter((r) => r.status === 'S').length;
      const izin = recordsArray.filter((r) => r.status === 'I').length;
      const alpa = recordsArray.filter((r) => r.status === 'A').length;

      const description = `Mengisi absensi harian ${selectedClass} tanggal ${formatIndonesianDate(selectedDate)}. (Sakit: ${sick}, Izin: ${izin}, Alpa: ${alpa})`;
      onAddActivityLog(
        `Absensi Harian ${selectedClass}`,
        description,
        'Semua Siswa',
        selectedClass,
        'attendance'
      );

      flushPendingCloudQueue().catch(console.warn);

      setShowSaveConfirmModal(false);
      if (syncedCount > 0) {
        showToast(`Absensi ${selectedClass} (${formatIndonesianDate(selectedDate)}) tersimpan! (+${syncedCount} Alpa masuk Pembinaan)`, 'success');
      } else {
        showToast(`Absensi ${selectedClass} (${formatIndonesianDate(selectedDate)}) berhasil disimpan!`, 'success');
      }

      if (onBackToDashboard) {
        onBackToDashboard();
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Delete history item (soft delete + audit log)
  const handleDeleteHistory = (recordId: string) => {
    setPendingDeleteRecordId(recordId);
  };

  const executeDeleteHistory = async (recordId: string) => {
    setPendingDeleteRecordId(null);
    if (!isValidDeleteId(recordId)) {
      showToast('Gagal: ID arsip absensi tidak valid, hapus dibatalkan', 'error');
      return;
    }
    const res = safeFilterSingleDelete(history, recordId);
    if (!res.ok) return;
    const targetRecord = res.removed;
    await saveHistoryToStorage(res.next);
    registerDeletedId(recordId);
    await softDeleteFromFirestore('bk_attendance_history', targetRecord || recordId, {
      deletedBy: activeCounselor?.name || 'Guru BK',
      deletedReason: 'Dihapus dari riwayat absensi',
      entityType: 'Absensi',
      nama: targetRecord ? `${targetRecord.class} (${targetRecord.date})` : recordId,
      kelas: targetRecord?.class || '',
    });
    if (detailModalRecord && detailModalRecord.id === recordId) {
      setDetailModalRecord(null);
    }
    showToast('Arsip absensi dihapus dan dipindahkan ke Sampah', 'info');
  };

  // Quick statistics for current selection
  const stats = useMemo(() => {
    const total = classStudentsSorted.length;
    if (total === 0) return { H: 0, S: 0, I: 0, A: 0, percent: 0, total: 0 };

    const recordsArray = Object.values(attendanceRecords) as StudentAttendance[];
    const H = recordsArray.filter((r) => r.status === 'H').length;
    const S = recordsArray.filter((r) => r.status === 'S').length;
    const I = recordsArray.filter((r) => r.status === 'I').length;
    const A = recordsArray.filter((r) => r.status === 'A').length;
    const percent = Math.round((H / total) * 100);

    return { H, S, I, A, percent, total };
  }, [attendanceRecords, classStudentsSorted]);

  // Download PDF Recap Trigger
  const handleDownloadRecap = () => {
    const recordsInRange = history.filter(
      (h) => normalizeClassStr(h.class) === normalizeClassStr(recapClass) && h.date >= recapStartDate && h.date <= recapEndDate
    );
    if (recordsInRange.length === 0) {
      showToast(`Belum ada data absensi tercatat untuk ${recapClass} pada rentang tanggal ${recapStartDate} s.d ${recapEndDate}`, 'error');
      return;
    }

    downloadAttendanceRecapPDF(
      recapClass,
      recapStartDate,
      recapEndDate,
      students,
      history
    );
  };

  // Matrix View Calculations
  const matrixData = useMemo(() => {
    const monthRecords = history.filter(
      (h) => h.class === matrixClass && h.date.startsWith(matrixMonth)
    );

    // Get sorted unique dates in this month
    const datesRecorded = Array.from(new Set(monthRecords.map((h) => h.date))).sort();

    // Map by studentId -> date -> StudentAttendance
    const studentClassList = students
      .filter((s) => normalizeClassStr(s.class) === normalizeClassStr(matrixClass))
      .sort(compareStudentNamesAZ);

    const studentMap: Record<string, {
      student: Student;
      recordsByDate: Record<string, StudentAttendance | undefined>;
      totalH: number;
      totalS: number;
      totalI: number;
      totalA: number;
      percent: number;
    }> = {};

    studentClassList.forEach((st) => {
      studentMap[st.id] = {
        student: st,
        recordsByDate: {},
        totalH: 0,
        totalS: 0,
        totalI: 0,
        totalA: 0,
        percent: 0,
      };
    });

    monthRecords.forEach((m) => {
      m.records.forEach((r) => {
        if (studentMap[r.studentId]) {
          studentMap[r.studentId].recordsByDate[m.date] = r;
          if (r.status === 'H') studentMap[r.studentId].totalH += 1;
          if (r.status === 'S') studentMap[r.studentId].totalS += 1;
          if (r.status === 'I') studentMap[r.studentId].totalI += 1;
          if (r.status === 'A') studentMap[r.studentId].totalA += 1;
        }
      });
    });

    // Calculate percentage per student
    const totalDaysCount = datesRecorded.length;
    Object.values(studentMap).forEach((item) => {
      if (totalDaysCount > 0) {
        item.percent = Math.round((item.totalH / totalDaysCount) * 100);
      } else {
        item.percent = 100;
      }
    });

    // High Risk / Frequent Absentees (S/I/A >= 3 or A >= 2)
    const alertStudents = Object.values(studentMap).filter(
      (item) => item.totalA >= 2 || (item.totalS + item.totalI + item.totalA) >= 3
    );

    return {
      monthRecords,
      datesRecorded,
      studentClassList,
      studentMap,
      totalDaysCount,
      alertStudents,
    };
  }, [history, matrixClass, matrixMonth, students]);

  return (
    <div className="space-y-4 pb-[110px]">
      {/* Header Ringkas & Tab Tunggal (Input / Matriks / Riwayat / Rekap PDF) */}
      <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-2xs p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0b1c30] tracking-tight">Absensi Siswa Harian</h1>
          <p className="text-xs font-semibold text-[#3d4947] mt-0.5">
            {getSchoolConfig().schoolName} &bull; {selectedClass} &bull; {formatIndonesianDate(selectedDate)}
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('input')}
            className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'input'
                ? 'bg-[#1A5C4A] text-white shadow-2xs'
                : 'text-[#3d4947] hover:text-[#0b1c30]'
            }`}
          >
            Input
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'matrix'
                ? 'bg-[#1A5C4A] text-white shadow-2xs'
                : 'text-[#3d4947] hover:text-[#0b1c30]'
            }`}
          >
            <span>Matriks</span>
            {matrixData.alertStudents.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-[#1A5C4A] text-white shadow-2xs'
                : 'text-[#3d4947] hover:text-[#0b1c30]'
            }`}
          >
            Riwayat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recap')}
            className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'recap'
                ? 'bg-[#1A5C4A] text-white shadow-2xs'
                : 'text-[#3d4947] hover:text-[#0b1c30]'
            }`}
          >
            Rekap PDF
          </button>
          <button
            type="button"
            onClick={handleManualCloudRefresh}
            disabled={isCloudSyncing}
            className="px-2.5 py-2 rounded-lg text-xs font-bold text-[#1A5C4A] hover:bg-white transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
            title="Sinkronkan data absensi dengan Cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isCloudSyncing ? 'Sinkron...' : 'Cloud'}</span>
          </button>
        </div>
      </div>

      {/* TAB 1: INPUT ABSENSI HARIAN */}
      {activeTab === 'input' && (
        <div className="space-y-4">
          {/* Panel Pilih Kelas Target, Tanggal, & Petugas */}
          <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/40 shadow-2xs grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-[#3d4947] uppercase tracking-wider block">
                Pilih Kelas Target
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full text-xs bg-[#f8faf9] border border-[#bcc9c6]/50 rounded-xl py-2.5 px-3 font-extrabold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#1A5C4A]/40 cursor-pointer"
              >
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-[#3d4947] uppercase tracking-wider block">
                Tanggal Absensi
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-xs bg-[#f8faf9] border border-[#bcc9c6]/50 rounded-xl py-2.5 px-3 font-extrabold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#1A5C4A]/40 cursor-pointer"
              />
            </div>

            <div className="bg-[#f8faf9] border border-[#bcc9c6]/40 rounded-xl p-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#D6EFE9] text-[#1A5C4A] flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-[#3d4947]">Petugas</p>
                  <p className="text-xs font-extrabold text-[#0b1c30] truncate">{activeCounselor.name}</p>
                </div>
              </div>
              <span className="text-xs font-extrabold text-[#1A5C4A] shrink-0">
                {stats.total} Siswa
              </span>
            </div>
          </div>

          {/* 4 Kotak Status (HADIR / SAKIT / IZIN / ALPA) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'H' ? 'ALL' : 'H')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                statusFilter === 'H'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-white hover:bg-emerald-50/40 border-[#bcc9c6]/40 text-[#0b1c30]'
              }`}
            >
              <p className={`text-[11px] font-black uppercase tracking-wider ${statusFilter === 'H' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                HADIR
              </p>
              <p className="text-2xl font-black mt-1 tabular-nums">{stats.H}</p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'S' ? 'ALL' : 'S')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                statusFilter === 'S'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-white hover:bg-amber-50/40 border-[#bcc9c6]/40 text-[#0b1c30]'
              }`}
            >
              <p className={`text-[11px] font-black uppercase tracking-wider ${statusFilter === 'S' ? 'text-amber-100' : 'text-amber-700'}`}>
                SAKIT
              </p>
              <p className="text-2xl font-black mt-1 tabular-nums">{stats.S}</p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'I' ? 'ALL' : 'I')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                statusFilter === 'I'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                  : 'bg-white hover:bg-blue-50/40 border-[#bcc9c6]/40 text-[#0b1c30]'
              }`}
            >
              <p className={`text-[11px] font-black uppercase tracking-wider ${statusFilter === 'I' ? 'text-blue-100' : 'text-blue-700'}`}>
                IZIN
              </p>
              <p className="text-2xl font-black mt-1 tabular-nums">{stats.I}</p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'A' ? 'ALL' : 'A')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                statusFilter === 'A'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                  : 'bg-white hover:bg-rose-50/40 border-[#bcc9c6]/40 text-[#0b1c30]'
              }`}
            >
              <p className={`text-[11px] font-black uppercase tracking-wider ${statusFilter === 'A' ? 'text-rose-100' : 'text-rose-700'}`}>
                ALPA
              </p>
              <p className="text-2xl font-black mt-1 tabular-nums">{stats.A}</p>
            </button>
          </div>

          {currentSavedRecord && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 text-xs text-amber-900">
              <span className="font-semibold">
                Absensi {selectedClass} ({formatIndonesianDate(selectedDate)}) sudah tercatat — perubahan akan memperbarui arsip ini.
              </span>
              <span className="font-extrabold shrink-0">Edit Mode</span>
            </div>
          )}

          {/* Pencarian Live + Hint Geser + Tombol Batal / Undo */}
          <div className="bg-white rounded-2xl p-3.5 border border-[#bcc9c6]/40 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama / NISN siswa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-10 pr-8 py-2.5 bg-[#f8faf9] border border-[#bcc9c6]/50 rounded-xl font-semibold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#1A5C4A]/40"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    aria-label="Hapus pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {statusFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className="px-3 py-2.5 text-xs font-bold text-[#0b1c30] bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer shrink-0"
                >
                  Semua ({stats.total})
                </button>
              )}

              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-extrabold border transition-all shrink-0 ${
                  undoStack.length > 0
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 cursor-pointer'
                    : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                }`}
                title="Kembalikan perubahan status terakhir"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Batal / Undo{undoStack.length > 0 ? ` (${undoStack.length})` : ''}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-[#3d4947] px-0.5">
              <span>Tap nama = ganti status &bull; Geser kanan = Hadir, Geser kiri = Alpa</span>
              <span>{filteredStudents.length} dari {stats.total} siswa</span>
            </div>
          </div>

          {/* Daftar Siswa Absensi: Tinggi 76-84px+, Nama Full 2 Baris, 3 Cara Input */}
          <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-2xs overflow-visible">
            {filteredStudents.length === 0 ? (
              <div className="p-12 text-center text-[#3d4947]">
                <Users className="w-10 h-10 mx-auto text-[#bcc9c6] mb-2" />
                <p className="text-sm font-bold text-[#0b1c30]">Tidak ada siswa ditemukan</p>
                <p className="text-xs mt-1">
                  Ubah kata kunci pencarian atau pilih kelas lain di atas.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredStudents.map((student, idx) => {
                  const record = attendanceRecords[student.id] || {
                    studentId: student.id,
                    studentName: student.name,
                    nis: student.nis,
                    status: 'H' as const,
                    notes: '',
                  };
                  const statusMeta = STATUS_META[record.status];
                  const isSwipingThis = swipeState?.studentId === student.id && swipeState.isHorizontal;
                  const dragX = isSwipingThis ? swipeState.deltaX : 0;
                  const isDropdownOpen = openDropdownStudentId === student.id;
                  const openDropdownUpward = filteredStudents.length > 3 && idx >= filteredStudents.length - 2;
                  const fullNis = String(student.nis || student.nisn || '-').trim();
                  const absenNo = absenNumberMap.get(student.id) || '-';

                  return (
                    <div
                      key={student.id}
                      onTouchStart={(e) => {
                        const t = e.touches[0];
                        if (t) startSwipe(student.id, t.clientX, t.clientY);
                      }}
                      onTouchMove={(e) => {
                        const t = e.touches[0];
                        if (t) moveSwipe(student.id, t.clientX, t.clientY);
                      }}
                      onTouchEnd={() => endSwipe(student)}
                      onPointerDown={(e) => {
                        if (e.pointerType === 'mouse' && e.button === 0) {
                          startSwipe(student.id, e.clientX, e.clientY);
                        }
                      }}
                      onPointerMove={(e) => {
                        if (e.pointerType === 'mouse' && swipeState?.studentId === student.id) {
                          moveSwipe(student.id, e.clientX, e.clientY);
                        }
                      }}
                      onPointerUp={(e) => {
                        if (e.pointerType === 'mouse' && swipeState?.studentId === student.id) {
                          endSwipe(student);
                        }
                      }}
                      onPointerCancel={() => setSwipeState(null)}
                      style={{
                        transform: dragX ? `translateX(${dragX}px)` : undefined,
                      }}
                      className={`min-h-[80px] py-3 px-3.5 sm:px-5 flex items-center justify-between gap-3 transition-colors select-none touch-pan-y relative ${
                        dragX >= 35
                          ? 'bg-emerald-50/90'
                          : dragX <= -35
                            ? 'bg-rose-50/90'
                            : 'bg-white hover:bg-[#f8faf9]'
                      } ${isDropdownOpen ? 'z-30' : 'z-0'}`}
                    >
                      {/* Kiri + Tengah (~60% ruang): No Besar + Avatar Bulat + Nama Full 2 Baris (Tap untuk siklus status) */}
                      <div
                        onClick={() => handleTapNameCycle(student)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleTapNameCycle(student);
                          }
                        }}
                        className="flex items-center gap-3 flex-1 basis-[60%] min-w-0 cursor-pointer"
                      >
                        <span className="w-7 text-center text-base font-black text-[#0b1c30] tabular-nums shrink-0">
                          {absenNo}
                        </span>

                        <div className="w-10 h-10 rounded-full bg-[#D6EFE9] text-[#1A5C4A] flex items-center justify-center text-xs font-extrabold shrink-0">
                          {student.initials}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-extrabold text-[#0b1c30] leading-snug break-words">
                            {student.name}
                          </p>
                          <p className="text-xs font-semibold text-[#3d4947] mt-0.5 break-words">
                            NIS: {fullNis} &bull; No. Absen {absenNo}
                            {record.notes ? ` • Ket: ${record.notes}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Kanan (~40% ruang): Dropdown Chip Status Besar (HADIR / SAKIT / IZIN / ALPA) */}
                      <div
                        className="w-[40%] max-w-[160px] sm:max-w-[200px] shrink-0 flex items-center justify-end gap-1.5 relative"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {record.status !== 'H' && (
                          <button
                            type="button"
                            onClick={() => setNoteModal(student)}
                            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-100 text-[#3d4947] cursor-pointer shrink-0"
                            title="Tambah atau edit keterangan"
                            aria-label="Edit keterangan"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setOpenDropdownStudentId(isDropdownOpen ? null : student.id)
                          }
                          className={`min-h-[46px] flex-1 sm:flex-none sm:min-w-[132px] px-3.5 py-2 rounded-xl border-2 text-sm font-black flex items-center justify-between gap-2 transition-all cursor-pointer ${statusMeta.chipClass}`}
                        >
                          <span>{statusMeta.label}</span>
                          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isDropdownOpen && (
                          <div
                            className={`absolute right-0 ${
                              openDropdownUpward ? 'bottom-[52px]' : 'top-[52px]'
                            } w-44 bg-white rounded-2xl shadow-2xl border border-gray-200 p-1.5 z-50 space-y-1`}
                          >
                            {(['H', 'S', 'I', 'A'] as const).map((code) => {
                              const opt = STATUS_META[code];
                              const active = record.status === code;
                              return (
                                <button
                                  key={code}
                                  type="button"
                                  onClick={() => {
                                    handleSetStatus(student.id, code);
                                    setOpenDropdownStudentId(null);
                                  }}
                                  className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-left text-sm font-black flex items-center justify-between transition-colors cursor-pointer ${
                                    active ? `${opt.chipClass} border` : opt.optionClass
                                  }`}
                                >
                                  <span>{opt.label}</span>
                                  {active && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 1 Set Tombol Simpan Nempel (Sticky) di Bawah Layar */}
          <div className="sticky bottom-16 sm:bottom-3 z-20 bg-white/95 backdrop-blur-md border border-[#bcc9c6]/50 p-3 sm:p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBulkSetStatus('H')}
                className="flex-1 sm:flex-none px-3.5 py-2.5 text-xs font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-all cursor-pointer"
              >
                Tandai Hadir Semua
              </button>
              <button
                type="button"
                onClick={() => handleBulkSetStatus('A')}
                className="flex-1 sm:flex-none px-3.5 py-2.5 text-xs font-extrabold text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-all cursor-pointer"
              >
                Tandai Alpa Semua
              </button>
            </div>

            <button
              type="button"
              onClick={handleRequestSaveAttendance}
              disabled={filteredStudents.length === 0}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-black transition-all shadow-sm cursor-pointer ${
                filteredStudents.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-[#1A5C4A] hover:bg-[#144739] text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>Simpan Absensi ({stats.total} Siswa)</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: MATRIKS & MONITORING KEHADIRAN BULANAN (User Friendly Monitoring) */}
      {activeTab === 'matrix' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Matrix Controls & Month Selector */}
          <div className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Pilih Kelas
                </label>
                <select
                  value={matrixClass}
                  onChange={(e) => setMatrixClass(e.target.value)}
                  className="text-xs bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl py-2 px-3 font-extrabold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/50 cursor-pointer"
                >
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Pilih Bulan & Tahun
                </label>
                <input
                  type="month"
                  value={matrixMonth}
                  onChange={(e) => setMatrixMonth(e.target.value)}
                  className="text-xs bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl py-2 px-3 font-extrabold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/50 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#00685f] bg-[#00685f]/10 px-3 py-1.5 rounded-xl border border-[#00685f]/20">
                Total {matrixData.totalDaysCount} Hari Terrekam di Bulan Ini
              </span>
            </div>
          </div>

          {/* Attention Watchlist Card Grid (Siswa Rawan Tidak Hadir) */}
          <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/5 rounded-2xl p-5 border border-amber-300/40 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 animate-bounce" />
                <h3 className="text-sm font-extrabold text-[#0b1c30]">
                  Deteksi Dini Rawan Ketidakhadiran (Perhatian Khusus BK)
                </h3>
              </div>
              <span className="text-xs font-black bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full">
                {matrixData.alertStudents.length} Siswa Terdeteksi
              </span>
            </div>

            {matrixData.alertStudents.length === 0 ? (
              <p className="text-xs text-gray-600 font-medium bg-white/70 p-3 rounded-xl border border-amber-200/50">
                🎉 Sangat Baik! Tidak ada siswa di {matrixClass} yang memiliki Alpa ≥ 2 atau total ketidakhadiran (S/I/A) ≥ 3 pada bulan {matrixMonth}.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {matrixData.alertStudents.map((item) => (
                  <div
                    key={item.student.id}
                    className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs flex flex-col justify-between space-y-2"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-extrabold text-[#0b1c30] break-words leading-snug">
                          {item.student.name}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-gray-400 shrink-0">
                          {item.student.class}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-mono">NISN: {item.student.nis}</p>
                    </div>

                    {/* Breakdown Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-extrabold bg-red-100 text-red-800 px-2 py-0.5 rounded-md border border-red-200">
                        {item.totalA} Alpa
                      </span>
                      <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                        {item.totalS} Sakit
                      </span>
                      <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200">
                        {item.totalI} Izin
                      </span>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
                      <span className="text-gray-500 font-semibold">Kehadiran: {item.percent}%</span>
                      <span className="text-[#00685f] font-extrabold flex items-center gap-0.5">
                        Perlu Bimbingan BK <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Monthly Attendance Matrix Table */}
          <div className="bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-xs overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#bcc9c6]/20 bg-[#f8fafa] flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-extrabold text-[#0b1c30] text-sm">
                  Matriks Kehadiran Siswa ({matrixClass} - {matrixMonth})
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  Tabel pemantauan visual status kehadiran harian per siswa dalam sebulan.
                </p>
              </div>

              {/* Legend Badges */}
              <div className="flex items-center gap-2 text-[10px] font-extrabold">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  H = Hadir
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  S = Sakit
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  I = Izin
                </span>
                <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                  A = Alpa
                </span>
              </div>
            </div>

            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100/80 text-[#0b1c30] font-black text-[11px] border-b border-gray-200">
                    <th className="p-3 pl-6 min-w-[40px]">No</th>
                    <th className="p-3 min-w-[180px]">Nama Siswa</th>
                    <th className="p-3 min-w-[80px]">NISN</th>
                    {matrixData.datesRecorded.map((dateStr) => {
                      const dayNum = dateStr.slice(8, 10);
                      return (
                        <th
                          key={dateStr}
                          className="p-2 text-center min-w-[36px] bg-gray-50 border-l border-gray-200/60"
                          title={`Tanggal ${dateStr}`}
                        >
                          {dayNum}
                        </th>
                      );
                    })}
                    <th className="p-3 text-center min-w-[50px] bg-emerald-50 text-emerald-900 border-l border-gray-200">H</th>
                    <th className="p-3 text-center min-w-[50px] bg-amber-50 text-amber-900">S</th>
                    <th className="p-3 text-center min-w-[50px] bg-blue-50 text-blue-900">I</th>
                    <th className="p-3 text-center min-w-[50px] bg-red-50 text-red-900">A</th>
                    <th className="p-3 text-center min-w-[70px] bg-teal-50 text-teal-900">% Hadir</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200/60 font-medium">
                  {matrixData.studentClassList.length === 0 ? (
                    <tr>
                      <td colSpan={6 + matrixData.datesRecorded.length} className="p-8 text-center text-gray-500">
                        Belum ada data siswa di {matrixClass}.
                      </td>
                    </tr>
                  ) : (
                    matrixData.studentClassList.map((student, idx) => {
                      const item = matrixData.studentMap[student.id];

                      return (
                        <tr key={student.id} className="hover:bg-[#f8f9ff] transition-colors">
                          <td className="p-3 pl-6 font-bold text-gray-400">{idx + 1}</td>
                          <td className="p-3 font-extrabold text-[#0b1c30]">{student.name}</td>
                          <td className="p-3 font-mono text-[10px] text-gray-500">{student.nis}</td>

                          {/* Daily matrix status cells */}
                          {matrixData.datesRecorded.map((dateStr) => {
                            const rec = item ? item.recordsByDate[dateStr] : undefined;
                            const status = rec ? rec.status : '-';

                            let bgClass = 'bg-gray-50 text-gray-300';
                            if (status === 'H') bgClass = 'bg-emerald-100 text-emerald-800 font-black';
                            if (status === 'S') bgClass = 'bg-amber-100 text-amber-800 font-black';
                            if (status === 'I') bgClass = 'bg-blue-100 text-blue-800 font-black';
                            if (status === 'A') bgClass = 'bg-red-500 text-white font-black animate-pulse';

                            return (
                              <td
                                key={dateStr}
                                className="p-1.5 text-center border-l border-gray-200/50"
                              >
                                <span
                                  className={`inline-block w-6 h-6 rounded-md text-[10px] leading-6 align-middle ${bgClass}`}
                                  title={rec ? `${dateStr}: ${status} (${rec.notes || 'Tanpa Catatan'})` : 'Belum Dicatat'}
                                >
                                  {status}
                                </span>
                              </td>
                            );
                          })}

                          {/* Summary columns */}
                          <td className="p-2 text-center font-bold bg-emerald-50/60 text-emerald-800 border-l border-gray-200">
                            {item ? item.totalH : 0}
                          </td>
                          <td className="p-2 text-center font-bold bg-amber-50/60 text-amber-800">
                            {item ? item.totalS : 0}
                          </td>
                          <td className="p-2 text-center font-bold bg-blue-50/60 text-blue-800">
                            {item ? item.totalI : 0}
                          </td>
                          <td className="p-2 text-center font-extrabold bg-red-50/60 text-red-700">
                            {item ? item.totalA : 0}
                          </td>
                          <td className="p-2 text-center font-black bg-teal-50/60 text-[#00685f]">
                            {item ? item.percent : 0}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ARSIP RIWAYAT & DETAIL INSPEKSI */}
      {activeTab === 'history' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-extrabold text-[#0b1c30] text-sm">Arsip Riwayat Absensi Terrekam</h3>
                <p className="text-xs text-gray-500 font-medium">
                  Seluruh dokumen pencatatan kehadiran yang telah tersimpan di sistem.
                </p>
              </div>
              <span className="text-xs font-bold text-[#00685f] bg-[#00685f]/10 px-3 py-1 rounded-lg">
                Total {history.length} Berkas Tersimpan
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.length === 0 ? (
                <div className="col-span-full py-16 text-center text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-3">
                  <Info className="w-10 h-10 mx-auto text-gray-300 mb-1" />
                  <p className="text-sm font-bold text-[#0b1c30]">Belum ada riwayat absensi tercatat</p>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Gunakan Form Input Harian untuk mulai mencatat, atau pulihkan data kehadiran presensi Kelas 8A - 8G bawaan di bawah ini.
                  </p>
                  <button
                    onClick={handleRestoreAttendanceData}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-97"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Pulihkan Arsip Presensi Kelas 8</span>
                  </button>
                </div>
              ) : (
                history.map((h) => {
                  const sCount = h.records.filter((r) => r.status === 'S').length;
                  const iCount = h.records.filter((r) => r.status === 'I').length;
                  const aCount = h.records.filter((r) => r.status === 'A').length;
                  const hCount = h.records.filter((r) => r.status === 'H').length;
                  const total = h.records.length;
                  const percent = total > 0 ? Math.round((hCount / total) * 100) : 0;

                  return (
                    <div
                      key={h.id}
                      className="bg-[#f8f9ff] hover:bg-[#f3f5ff] rounded-2xl p-4 border border-[#bcc9c6]/30 transition-all flex flex-col justify-between relative group shadow-2xs"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-sm font-black text-[#0b1c30]">{h.class}</span>
                            <p className="text-[10px] text-gray-500 font-mono flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3 text-[#00685f]" />
                              {h.date}
                            </p>
                          </div>

                          <button
                            onClick={() => handleDeleteHistory(h.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-white cursor-pointer transition-colors"
                            title="Hapus riwayat"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Breakdown badges */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                            {percent}% Hadir ({hCount})
                          </span>
                          {sCount > 0 && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                              {sCount} Sakit
                            </span>
                          )}
                          {iCount > 0 && (
                            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200">
                              {iCount} Izin
                            </span>
                          )}
                          {aCount > 0 && (
                            <span className="text-[10px] font-black bg-red-100 text-red-800 px-2 py-0.5 rounded-md border border-red-200">
                              {aCount} Alpa
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between text-[10px]">
                        <span className="text-gray-500 font-semibold">Petugas: {h.submittedBy}</span>
                        <button
                          onClick={() => setDetailModalRecord(h)}
                          className="px-3 py-1 bg-[#00685f] hover:bg-[#004d44] text-white font-extrabold rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-2xs active:scale-95"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Lihat Detail</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CETAK & REKAP PDF */}
      {activeTab === 'recap' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-gradient-to-r from-[#004d44] via-[#00685f] to-[#005049] rounded-2xl p-6 sm:p-8 text-white shadow-xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 rounded-2xl border border-white/20">
                <FileSpreadsheet className="w-8 h-8 text-amber-300" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">
                  Unduh Rekapitulasi Absensi Siap Cetak (PDF)
                </h3>
                <p className="text-xs text-teal-100 font-medium mt-1 max-w-2xl leading-relaxed">
                  Generasi berkas PDF resmi rekap kehadiran siswa per periode bulan atau semester untuk arsip sekolah, laporan kesiswaan, atau rapat Wali Murid.
                </p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-teal-200 uppercase tracking-wider block">
                  Kelas Target
                </label>
                <select
                  value={recapClass}
                  onChange={(e) => setRecapClass(e.target.value)}
                  className="w-full text-xs bg-white text-slate-900 border border-teal-200 rounded-xl py-2.5 px-3 font-extrabold focus:outline-none cursor-pointer"
                >
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-teal-200 uppercase tracking-wider block">
                  Mulai Tanggal
                </label>
                <input
                  type="date"
                  value={recapStartDate}
                  onChange={(e) => setRecapStartDate(e.target.value)}
                  className="w-full text-xs bg-white text-slate-900 border border-teal-200 rounded-xl py-2.5 px-3 font-extrabold focus:outline-none cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-teal-200 uppercase tracking-wider block">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={recapEndDate}
                  onChange={(e) => setRecapEndDate(e.target.value)}
                  className="w-full text-xs bg-white text-slate-900 border border-teal-200 rounded-xl py-2.5 px-3 font-extrabold focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleDownloadRecap}
                className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-xs rounded-xl transition-all shadow-lg hover:shadow-amber-400/20 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4 text-slate-900" />
                <span>Unduh Rekap PDF Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL INSPECTION MODAL FOR PAST ATTENDANCE RECORD */}
      {detailModalRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-teal-100 overflow-hidden my-8 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[#00685f] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <ClipboardList className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-200 bg-white/10 px-2 py-0.5 rounded">
                    Detail Berkas Absensi
                  </span>
                  <h3 className="text-base font-extrabold text-white mt-0.5">
                    {detailModalRecord.class} — {detailModalRecord.date}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setDetailModalRecord(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-emerald-800 uppercase">Hadir (H)</p>
                  <p className="text-xl font-black text-emerald-700 mt-1">
                    {detailModalRecord.records.filter((r) => r.status === 'H').length}
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-amber-800 uppercase">Sakit (S)</p>
                  <p className="text-xl font-black text-amber-700 mt-1">
                    {detailModalRecord.records.filter((r) => r.status === 'S').length}
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-blue-800 uppercase">Izin (I)</p>
                  <p className="text-xl font-black text-blue-700 mt-1">
                    {detailModalRecord.records.filter((r) => r.status === 'I').length}
                  </p>
                </div>

                <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-red-800 uppercase">Alpa (A)</p>
                  <p className="text-xl font-black text-red-700 mt-1">
                    {detailModalRecord.records.filter((r) => r.status === 'A').length}
                  </p>
                </div>
              </div>

              {/* Student Attendance Detail Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-[#0b1c30] font-bold">
                    <tr>
                      <th className="p-3">Nama Siswa</th>
                      <th className="p-3">NISN</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3">Catatan / Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {detailModalRecord.records.map((r) => {
                      let badge = 'bg-emerald-100 text-emerald-800';
                      if (r.status === 'S') badge = 'bg-amber-100 text-amber-800';
                      if (r.status === 'I') badge = 'bg-blue-100 text-blue-800';
                      if (r.status === 'A') badge = 'bg-red-100 text-red-800 font-black';

                      return (
                        <tr key={r.studentId} className="hover:bg-gray-50">
                          <td className="p-3 font-extrabold text-[#0b1c30]">{r.studentName}</td>
                          <td className="p-3 font-mono text-[10px] text-gray-500">{r.nis}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold ${badge}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="p-3 text-gray-600 italic">{r.notes || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">
                Pencatat: <strong>{detailModalRecord.submittedBy}</strong> ({detailModalRecord.updatedAt})
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedClass(detailModalRecord.class);
                    setSelectedDate(detailModalRecord.date);
                    setDetailModalRecord(null);
                    setActiveTab('input');
                  }}
                  className="px-4 py-2 bg-[#00685f] hover:bg-[#004d44] text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit di Form Harian</span>
                </button>

                <button
                  onClick={() => setDetailModalRecord(null)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI SIMPAN ABSENSI */}
      {showSaveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-[#bcc9c6]/40 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-[#D6EFE9] text-[#1A5C4A] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#0b1c30]">Konfirmasi Simpan Absensi</h3>
                <p className="text-xs font-semibold text-[#3d4947]">
                  Simpan absensi {selectedClass} - {formatIndonesianDate(selectedDate)}?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-gray-200 text-xs font-bold text-[#0b1c30]">
              Hadir: <span className="text-emerald-700 font-black">{stats.H}</span>,{' '}
              Sakit: <span className="text-amber-700 font-black">{stats.S}</span>,{' '}
              Izin: <span className="text-blue-700 font-black">{stats.I}</span>,{' '}
              Alpa: <span className="text-rose-700 font-black">{stats.A}</span>
            </div>

            {stats.A > 0 && onSyncAttendanceViolations && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50/70 border border-rose-200 cursor-pointer text-xs text-rose-950">
                <input
                  type="checkbox"
                  checked={syncAlpaOnConfirm}
                  onChange={(e) => setSyncAlpaOnConfirm(e.target.checked)}
                  className="mt-0.5 rounded accent-rose-600 cursor-pointer"
                />
                <span className="font-semibold leading-snug">
                  Masukkan {stats.A} siswa Alpa ke Pembinaan (+{alpaPointWeight} poin)
                </span>
              </label>
            )}

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowSaveConfirmModal(false)}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-[#0b1c30] font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmSaveAttendance}
                className="flex-1 py-2.5 px-4 bg-[#1A5C4A] hover:bg-[#144739] disabled:opacity-60 text-white font-black text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {isSaving ? 'Menyimpan...' : 'Ya, Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP KETERANGAN SAKIT / IZIN / ALPA */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-[#D6EFE9] rounded-xl text-[#1A5C4A] shrink-0">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-[#0b1c30]">Keterangan Kehadiran</h4>
                  <p className="text-xs font-semibold text-[#3d4947] break-words">{noteModal.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNoteModal(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Pilih Alasan Cepat:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['Demam & Batuk', 'Surat Dokter', 'Izin Keluarga', 'Tanpa Kabar'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSetNotes(noteModal.id, preset)}
                    className="text-[11px] font-bold bg-[#f8faf9] hover:bg-gray-100 text-[#0b1c30] px-2.5 py-1 rounded-lg border border-gray-200 cursor-pointer"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              placeholder="Tulis keterangan..."
              value={attendanceRecords[noteModal.id]?.notes || ''}
              onChange={(e) => handleSetNotes(noteModal.id, e.target.value)}
              className="w-full text-xs p-2.5 bg-[#f8faf9] border border-gray-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-[#1A5C4A]/40"
            />

            <button
              type="button"
              onClick={() => setNoteModal(null)}
              className="w-full py-2.5 bg-[#1A5C4A] hover:bg-[#144739] text-white text-xs font-black rounded-xl transition-all cursor-pointer"
            >
              Simpan Keterangan
            </button>
          </div>
        </div>
      )}
      {pendingDeleteRecordId && (() => {
        const targetHist = history.find((h) => h.id === pendingDeleteRecordId);
        return (
        <div className="fixed inset-0 z-[120] bg-[#0b1c30]/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-[#bcc9c6]/50 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0b1c30]">Konfirmasi Hapus Arsip Absensi</h3>
                <p className="text-xs text-[#3d4947] mt-1 leading-relaxed">
                  Hapus arsip absensi {targetHist ? `${targetHist.class} (${targetHist.date})` : 'ini'} saja? Arsip absensi lain tidak akan terhapus.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteRecordId(null)}
                className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => executeDeleteHistory(pendingDeleteRecordId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Ya, Hapus 1 Ini Saja
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {showRestoreAttConfirm && (
        <div className="fixed inset-0 z-[120] bg-[#0b1c30]/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-[#bcc9c6]/50 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#00685f] flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0b1c30]">Pulihkan Arsip Absensi?</h3>
                <p className="text-xs text-[#3d4947] mt-1 leading-relaxed">
                  Pulihkan arsip data absensi kelas (Kelas 8A s/d 8G) ke sistem dan sinkronkan ke Cloud?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRestoreAttConfirm(false)}
                className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeRestoreAttendanceData}
                className="px-4 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold cursor-pointer"
              >
                Ya, Pulihkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
