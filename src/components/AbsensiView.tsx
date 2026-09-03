import { useState, useMemo, useEffect } from 'react';
import { Student, ClassAttendanceRecord, StudentAttendance } from '../types';
import { downloadAttendanceRecapPDF, formatIndonesianDate } from '../utils/pdfGenerator';
import { saveBulkToFirestore, saveSchoolData, loadSchoolData, deleteFromFirestore } from '../utils/firestoreSync';
import { registerDeletedId } from '../utils/deletionTracker';
import { 
  Calendar, 
  UserCheck, 
  Check, 
  Trash2, 
  History, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  Eye, 
  TrendingUp, 
  AlertTriangle, 
  ChevronRight, 
  RefreshCw, 
  Info,
  Clock,
  Sparkles,
  ClipboardList,
  Edit3,
  Award,
  BookOpen
} from 'lucide-react';

interface AbsensiViewProps {
  students: Student[];
  activeCounselor: { name: string };
  initialClass?: string;
  onAddActivityLog: (title: string, description: string, studentName: string, studentClass: string, type: 'attendance') => void;
  onAttendanceChanged?: () => void;
  onSyncAttendanceViolations?: (
    records: StudentAttendance[],
    date: string,
    className: string,
    pointWeight: number
  ) => number;
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

export default function AbsensiView({
  students,
  activeCounselor,
  initialClass,
  onAddActivityLog,
  onAttendanceChanged,
  onSyncAttendanceViolations,
}: AbsensiViewProps) {
  // Navigation Tabs: 'input' | 'matrix' | 'history' | 'recap'
  const [activeTab, setActiveTab] = useState<'input' | 'matrix' | 'history' | 'recap'>('input');

  // Auto-sync settings for Alpa / Tanpa Keterangan
  const [alpaPointWeight, setAlpaPointWeight] = useState<number>(() => {
    const saved = localStorage.getItem('bk_alpa_point_weight');
    return saved ? Number(saved) || 20 : 20;
  });

  const [autoSyncAlpa, setAutoSyncAlpa] = useState<boolean>(() => {
    const saved = localStorage.getItem('bk_auto_sync_alpa');
    return saved !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('bk_alpa_point_weight', String(alpaPointWeight));
  }, [alpaPointWeight]);

  useEffect(() => {
    localStorage.setItem('bk_auto_sync_alpa', String(autoSyncAlpa));
  }, [autoSyncAlpa]);

  // Available Classes from student database
  const availableClasses = useMemo(() => {
    const classesFromStudents = Array.from(new Set(students.map((s) => s.class)))
      .filter(Boolean)
      .sort();
    if (classesFromStudents.length > 0) return classesFromStudents;
    return ['Kelas 7A', 'Kelas 7B', 'Kelas 7C', 'Kelas 8A', 'Kelas 8B', 'Kelas 8C', 'Kelas 9A', 'Kelas 9B', 'Kelas 9C'];
  }, [students]);

  // Selected State for Form Input
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (initialClass && (availableClasses.includes(initialClass) || availableClasses.length > 0)) {
      return initialClass;
    }
    return availableClasses[0] || 'Kelas 7A';
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

  // Historical attendance list from school storage & Firestore
  const [history, setHistory] = useState<ClassAttendanceRecord[]>(() => {
    return loadSchoolData('bk_attendance_history', []);
  });

  // Realtime subscriber for remote changes
  useEffect(() => {
    const handleRealtimeUpdate = (e: any) => {
      if (e.detail?.key === 'bk_attendance_history') {
        if (Array.isArray(e.detail.data)) {
          setHistory(e.detail.data);
        } else {
          setHistory(loadSchoolData('bk_attendance_history', []));
        }
      }
    };

    window.addEventListener('bk_realtime_sync', handleRealtimeUpdate);
    window.addEventListener('bk_attendance_history_changed', handleRealtimeUpdate);
    window.addEventListener('storage', (e) => {
      if (e.key === 'bk_attendance_history') {
        handleRealtimeUpdate({ detail: { key: e.key } });
      }
    });

    return () => {
      window.removeEventListener('bk_realtime_sync', handleRealtimeUpdate);
      window.removeEventListener('bk_attendance_history_changed', handleRealtimeUpdate);
    };
  }, []);

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
  const saveHistoryToStorage = (updatedHistory: ClassAttendanceRecord[]) => {
    setHistory(updatedHistory);
    saveSchoolData('bk_attendance_history', updatedHistory);
    localStorage.setItem('bk_attendance_history', JSON.stringify(updatedHistory));
    saveBulkToFirestore('bk_attendance_history', updatedHistory);
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
  }, [selectedClass, selectedDate, history, students]);

  // Calculate student monthly attendance accumulation (for quick badges)
  const studentMonthlySummary = useMemo(() => {
    const currentMonthPrefix = normalizeDateStr(selectedDate).slice(0, 7); // e.g. "2026-07"
    const targetNorm = normalizeClassStr(selectedClass);

    const relevantRecords = history.filter((h: any) => {
      const hClassNorm = normalizeClassStr(h.class || h.className || h.kelas || '');
      const hDateNorm = normalizeDateStr(h.date);
      return hClassNorm === targetNorm && hDateNorm.startsWith(currentMonthPrefix);
    });

    const map: Record<string, { S: number; I: number; A: number; H: number }> = {};

    relevantRecords.forEach((h) => {
      h.records.forEach((r) => {
        if (!map[r.studentId]) {
          map[r.studentId] = { S: 0, I: 0, A: 0, H: 0 };
        }
        if (r.status === 'S') map[r.studentId].S += 1;
        if (r.status === 'I') map[r.studentId].I += 1;
        if (r.status === 'A') map[r.studentId].A += 1;
        if (r.status === 'H') map[r.studentId].H += 1;
      });
    });

    return map;
  }, [history, selectedClass, selectedDate]);

  // Filter students matching the selected class + search query + status filter
  const filteredStudents = useMemo(() => {
    let result = students
      .filter((s) => s.class === selectedClass)
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((s) => {
        const rec = attendanceRecords[s.id];
        return rec && rec.status === statusFilter;
      });
    }

    return result;
  }, [students, selectedClass, searchQuery, statusFilter, attendanceRecords]);

  // Set single student status
  const handleSetStatus = (studentId: string, status: 'H' | 'S' | 'I' | 'A') => {
    setAttendanceRecords((prev) => {
      const record = prev[studentId];
      if (!record) return prev;
      return {
        ...prev,
        [studentId]: {
          ...record,
          status,
        },
      };
    });
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

  // Quick Preset Note Handler
  const handleApplyPresetNote = (studentId: string, presetText: string) => {
    setAttendanceRecords((prev) => {
      const record = prev[studentId];
      if (!record) return prev;
      return {
        ...prev,
        [studentId]: {
          ...record,
          notes: presetText,
        },
      };
    });
  };

  // Bulk actions
  const handleBulkSetStatus = (status: 'H' | 'S' | 'I' | 'A') => {
    setAttendanceRecords((prev) => {
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

  // Save/Submit attendance record
  const handleSaveAttendance = () => {
    const recordsArray = Object.values(attendanceRecords) as StudentAttendance[];
    if (recordsArray.length === 0) return;

    const targetNorm = normalizeClassStr(selectedClass);
    const dateNorm = normalizeDateStr(selectedDate);
    const recordId = `att-${selectedClass.replace(/\s+/g, '-').toLowerCase()}-${selectedDate}`;
    const d = new Date();
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} WIB`;
    const timestampLabel = `${formatIndonesianDate(d.toISOString().split('T')[0])}, ${timeStr}`;

    const newRecord: ClassAttendanceRecord = {
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

    saveHistoryToStorage(updatedHistory);

    let syncedCount = 0;
    if (autoSyncAlpa && onSyncAttendanceViolations) {
      syncedCount = onSyncAttendanceViolations(
        recordsArray,
        selectedDate,
        selectedClass,
        alpaPointWeight
      );
    }

    const sick = recordsArray.filter((r) => r.status === 'S').length;
    const izin = recordsArray.filter((r) => r.status === 'I').length;
    const alpa = recordsArray.filter((r) => r.status === 'A').length;

    const description = `Mengisi absensi harian ${selectedClass} tanggal ${selectedDate}. (Sakit: ${sick}, Izin: ${izin}, Alpa: ${alpa})`;
    
    onAddActivityLog(
      `Absensi Harian ${selectedClass}`,
      description,
      'Semua Siswa',
      selectedClass,
      'attendance'
    );

    if (syncedCount > 0) {
      alert(`✅ Absensi ${selectedClass} tanggal ${selectedDate} berhasil disimpan!\n\n⚡ ${syncedCount} siswa Tanpa Keterangan (Alpa) otomatis disinkronkan ke Data Pembinaan (+${alpaPointWeight} Poin per siswa).`);
    } else {
      alert(`✅ Absensi ${selectedClass} tanggal ${selectedDate} berhasil disimpan dan disinkronkan!`);
    }
  };

  // Delete history item
  const handleDeleteHistory = (recordId: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus arsip absensi ini?')) {
      registerDeletedId(recordId);
      deleteFromFirestore('bk_attendance_history', recordId);
      const updatedHistory = history.filter((h) => h.id !== recordId);
      saveHistoryToStorage(updatedHistory);
      if (detailModalRecord && detailModalRecord.id === recordId) {
        setDetailModalRecord(null);
      }
    }
  };

  // Quick statistics for current selection
  const stats = useMemo(() => {
    const classStudents = students.filter((s) => s.class === selectedClass);
    const total = classStudents.length;
    if (total === 0) return { H: 0, S: 0, I: 0, A: 0, percent: 0, total: 0 };

    const recordsArray = Object.values(attendanceRecords) as StudentAttendance[];
    const H = recordsArray.filter((r) => r.status === 'H').length;
    const S = recordsArray.filter((r) => r.status === 'S').length;
    const I = recordsArray.filter((r) => r.status === 'I').length;
    const A = recordsArray.filter((r) => r.status === 'A').length;
    const percent = Math.round((H / total) * 100);

    return { H, S, I, A, percent, total };
  }, [attendanceRecords, students, selectedClass]);

  // Download PDF Recap Trigger
  const handleDownloadRecap = () => {
    const recordsInRange = history.filter(
      (h) => h.class === recapClass && h.date >= recapStartDate && h.date <= recapEndDate
    );
    if (recordsInRange.length === 0) {
      alert(`Belum ada data absensi tercatat untuk ${recapClass} pada rentang tanggal ${recapStartDate} s.d ${recapEndDate}`);
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
      .filter((s) => s.class === matrixClass)
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));

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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title & Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#bcc9c6]/30 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-[#00685f]/10 text-[#00685f] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-[#00685f]/20">
              <Calendar className="w-3 h-3 text-[#00685f]" />
              Modul Absensi Kesiswaan BK
            </span>
            <span className="text-[10px] text-gray-500 font-semibold">SMP N 2 Susukan</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0b1c30]">
            Pencatatan & Monitoring Absensi
          </h2>
          <p className="text-xs text-[#3d4947]/80 font-medium mt-0.5">
            Pencatatan harian, matriks pemantauan rekap bulanan, serta deteksi rawan ketidakhadiran siswa.
          </p>
        </div>

        {/* Tab Navigation Pill Buttons */}
        <div className="flex items-center bg-[#f0f4f3] p-1.5 rounded-xl border border-[#bcc9c6]/30 self-start md:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('input')}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'input'
                ? 'bg-[#00685f] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#0b1c30] hover:bg-white/60'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Form Input Harian</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'matrix'
                ? 'bg-[#00685f] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#0b1c30] hover:bg-white/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Matriks & Monitoring</span>
            {matrixData.alertStudents.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-[#00685f] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#0b1c30] hover:bg-white/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Arsip Riwayat</span>
          </button>

          <button
            onClick={() => setActiveTab('recap')}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'recap'
                ? 'bg-[#00685f] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#0b1c30] hover:bg-white/60'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Cetak Rekap PDF</span>
          </button>
        </div>
      </div>

      {/* TAB 1: FORM INPUT ABSENSI HARIAN */}
      {activeTab === 'input' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Class & Date Control Panel */}
          <div className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider block">
                Pilih Kelas Target
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full text-xs bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl py-2.5 px-3 font-extrabold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/50 cursor-pointer"
              >
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider block">
                Tanggal Absensi Harian
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-xs bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl py-2.5 px-3 font-extrabold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/50 cursor-pointer"
              />
            </div>

            <div className="bg-[#00685f]/5 border border-[#00685f]/15 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#00685f] rounded-lg text-white">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#3d4947] tracking-wider opacity-70">
                    Petugas Pencatat
                  </p>
                  <p className="text-xs font-bold text-[#0b1c30]">{activeCounselor.name}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-[#00685f] bg-[#00685f]/10 px-2 py-0.5 rounded-full">
                {stats.total} Siswa
              </span>
            </div>
          </div>

          {/* Auto-sync to Pembinaan Settings Banner */}
          <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5 shadow-xs">
            <div className="flex items-start md:items-center gap-3">
              <div className="p-2 bg-emerald-600 rounded-xl text-white shrink-0 mt-0.5 md:mt-0 shadow-xs">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                    Sinkronisasi Otomatis Ke Pembinaan (Alpa)
                  </h4>
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                    autoSyncAlpa 
                      ? 'bg-emerald-200 text-emerald-900 border-emerald-300' 
                      : 'bg-gray-100 text-gray-600 border-gray-300'
                  }`}>
                    {autoSyncAlpa ? `Aktif (+${alpaPointWeight} Poin/Alpa)` : 'Nonaktif'}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900/90 font-medium leading-relaxed mt-0.5">
                  Siswa yang dicatat <strong className="underline">Tanpa Keterangan (Alpa)</strong> akan otomatis masuk ke laporan Pembinaan dengan bobot <strong className="text-emerald-950">{alpaPointWeight} poin</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end md:self-auto bg-white/90 p-2 rounded-xl border border-emerald-200/80 shadow-2xs">
              <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5 cursor-pointer">
                <span className="whitespace-nowrap">Bobot Poin:</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={alpaPointWeight}
                  onChange={(e) => setAlpaPointWeight(Math.max(1, Number(e.target.value) || 20))}
                  className="w-14 bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-black text-[#0b1c30] text-center focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                />
              </label>

              <button
                type="button"
                onClick={() => setAutoSyncAlpa(!autoSyncAlpa)}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer shadow-2xs ${
                  autoSyncAlpa
                    ? 'bg-[#00685f] text-white hover:bg-[#005049]'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {autoSyncAlpa ? 'Sinkron Aktif' : 'Aktifkan'}
              </button>
            </div>
          </div>

          {/* Record Status Banner Indicator */}
          {currentSavedRecord ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold">
                    Data Absensi {selectedClass} Tanggal {selectedDate} Sudah Tersimpan!
                  </p>
                  <p className="text-[11px] text-amber-800/80 font-medium">
                    Terakhir diperbarui: {currentSavedRecord.updatedAt} oleh {currentSavedRecord.submittedBy}.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 px-3 py-1 rounded-full border border-amber-300 self-start sm:self-auto">
                Mode Memperbarui / Edit
              </span>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-900">
              <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold">
                  Catatan Baru: Belum Ada Absensi Tercatat Untuk {selectedClass} Tanggal {selectedDate}
                </p>
                <p className="text-[11px] text-emerald-800/80 font-medium">
                  Semua siswa secara otomatis diset "Hadir (H)". Silakan ubah status siswa yang sakit, izin, atau alpa.
                </p>
              </div>
            </div>
          )}

          {/* Overview Stats Quick Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/20 shadow-xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tingkat Kehadiran</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-[#00685f]">{stats.percent}%</span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Hadir: {stats.H} / {stats.total}</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/20 shadow-xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Hadir (H)</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-emerald-600">{stats.H}</span>
                <span className="text-[10px] font-semibold text-gray-400">Siswa</span>
              </div>
              <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${stats.percent}%` }} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/20 shadow-xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sakit (S)</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-amber-500">{stats.S}</span>
                <span className="text-[10px] font-semibold text-gray-400">Siswa</span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Surat / Keterangan</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/20 shadow-xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Izin (I)</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-blue-500">{stats.I}</span>
                <span className="text-[10px] font-semibold text-gray-400">Siswa</span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Kabar Orang Tua</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/20 shadow-xs col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Alpa (A)</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-red-600">{stats.A}</span>
                <span className="text-[10px] font-semibold text-gray-400">Siswa</span>
              </div>
              <p className="text-[10px] text-red-600/80 font-bold mt-0.5">Tanpa Keterangan</p>
            </div>
          </div>

          {/* Quick Filter & Bulk Action Bar */}
          <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/30 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Left: Search Student & Status Filter Pills */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari nama siswa / NISN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-[#00685f]/40"
                />
              </div>

              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-colors cursor-pointer ${
                    statusFilter === 'ALL' ? 'bg-white text-[#0b1c30] shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Semua ({stats.total})
                </button>
                <button
                  onClick={() => setStatusFilter('H')}
                  className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-colors cursor-pointer ${
                    statusFilter === 'H' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  H ({stats.H})
                </button>
                <button
                  onClick={() => setStatusFilter('S')}
                  className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-colors cursor-pointer ${
                    statusFilter === 'S' ? 'bg-amber-500 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  S ({stats.S})
                </button>
                <button
                  onClick={() => setStatusFilter('I')}
                  className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-colors cursor-pointer ${
                    statusFilter === 'I' ? 'bg-blue-500 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  I ({stats.I})
                </button>
                <button
                  onClick={() => setStatusFilter('A')}
                  className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-colors cursor-pointer ${
                    statusFilter === 'A' ? 'bg-red-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  A ({stats.A})
                </button>
              </div>
            </div>

            {/* Right: Quick Bulk Action Buttons */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden sm:inline">Set Massal:</span>
              <button
                onClick={() => handleBulkSetStatus('H')}
                className="px-3 py-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
              >
                Tandai Hadir Semua
              </button>
              <button
                onClick={() => handleBulkSetStatus('A')}
                className="px-3 py-1.5 text-xs font-extrabold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-colors cursor-pointer"
              >
                Tandai Alpa Semua
              </button>
            </div>
          </div>

          {/* Student List Cards Table */}
          <div className="bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-xs overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#bcc9c6]/20 bg-[#f8fafa] flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#0b1c30]">
                Daftar Kehadiran Siswa ({filteredStudents.length} siswa ditampilkan)
              </span>
              <span className="text-[10px] font-bold text-gray-500">
                Lengkapi status H / S / I / A & catatan jika diperlukan
              </span>
            </div>

            <div className="divide-y divide-[#bcc9c6]/15 max-h-[620px] overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="p-12 text-center text-[#3d4947]/60">
                  <Users className="w-10 h-10 mx-auto text-[#bcc9c6] mb-3" />
                  <p className="text-sm font-bold">Tidak ada siswa ditemukan</p>
                  <p className="text-xs mt-1">Coba sesuaikan kata kunci pencarian atau ubah filter kelas.</p>
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const record = attendanceRecords[student.id] || {
                    studentId: student.id,
                    studentName: student.name,
                    nis: student.nis,
                    status: 'H',
                    notes: '',
                  };

                  const monthlyStats = studentMonthlySummary[student.id] || { S: 0, I: 0, A: 0, H: 0 };

                  return (
                    <div
                      key={student.id}
                      className="p-4.5 sm:px-6 hover:bg-[#f8f9ff]/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      {/* Left: Student Identity + Monthly Absence Badge */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00685f] to-[#004d44] text-white flex items-center justify-center text-xs font-black shadow-xs shrink-0">
                          {student.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-extrabold text-[#0b1c30] truncate">{student.name}</p>
                            <span className="text-[9px] font-mono text-gray-500">NISN: {student.nis}</span>
                          </div>

                          {/* Cumulative Month Absences Pill (User Friendly Monitor) */}
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] text-gray-500 font-bold">Rekap Bulan Ini:</span>
                            <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                              {monthlyStats.H} Hadir
                            </span>
                            {monthlyStats.S > 0 && (
                              <span className="text-[9px] font-extrabold bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded border border-amber-200">
                                {monthlyStats.S} Sakit
                              </span>
                            )}
                            {monthlyStats.I > 0 && (
                              <span className="text-[9px] font-extrabold bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200">
                                {monthlyStats.I} Izin
                              </span>
                            )}
                            {monthlyStats.A > 0 && (
                              <span className="text-[9px] font-black bg-red-100 text-red-800 px-1.5 py-0.2 rounded border border-red-300 animate-pulse">
                                {monthlyStats.A} Alpa ⚠️
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Interactive Status Toggle Buttons & Notes Preset */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-1 bg-[#f0f4f3] p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => handleSetStatus(student.id, 'H')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              record.status === 'H'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-gray-600 hover:bg-white'
                            }`}
                          >
                            Hadir (H)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStatus(student.id, 'S')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              record.status === 'S'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-gray-600 hover:bg-white'
                            }`}
                            title="Sakit"
                          >
                            Sakit (S)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStatus(student.id, 'I')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              record.status === 'I'
                                ? 'bg-blue-500 text-white shadow-xs'
                                : 'text-gray-600 hover:bg-white'
                            }`}
                            title="Izin"
                          >
                            Izin (I)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStatus(student.id, 'A')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              record.status === 'A'
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'text-gray-600 hover:bg-white'
                            }`}
                            title="Alpa / Tanpa Keterangan"
                          >
                            Alpa (A)
                          </button>
                        </div>

                        {/* Notes Input + Preset Tag Buttons */}
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder="Keterangan / Alasan..."
                            value={record.notes}
                            onChange={(e) => handleSetNotes(student.id, e.target.value)}
                            className="text-xs bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3 py-2 w-full sm:w-52 focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 font-medium"
                          />
                          {/* Quick Preset Tags for faster typing */}
                          {record.status !== 'H' && (
                            <div className="flex flex-wrap gap-1">
                              {record.status === 'S' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApplyPresetNote(student.id, 'Demam & Pusing')}
                                    className="text-[9px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 cursor-pointer"
                                  >
                                    + Demam
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleApplyPresetNote(student.id, 'Ada Surat Dokter')}
                                    className="text-[9px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 cursor-pointer"
                                  >
                                    + Surat Dokter
                                  </button>
                                </>
                              )}
                              {record.status === 'I' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApplyPresetNote(student.id, 'Acara Keluarga')}
                                    className="text-[9px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 cursor-pointer"
                                  >
                                    + Acara Keluarga
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleApplyPresetNote(student.id, 'Dispensasi Lomba')}
                                    className="text-[9px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 cursor-pointer"
                                  >
                                    + Dispensasi
                                  </button>
                                </>
                              )}
                              {record.status === 'A' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApplyPresetNote(student.id, 'Tanpa Konfirmasi Ortu')}
                                    className="text-[9px] font-bold bg-red-50 hover:bg-red-100 text-red-800 px-1.5 py-0.5 rounded border border-red-200 cursor-pointer"
                                  >
                                    + Tanpa Kabar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleApplyPresetNote(student.id, 'Bolos Sekolah')}
                                    className="text-[9px] font-bold bg-red-50 hover:bg-red-100 text-red-800 px-1.5 py-0.5 rounded border border-red-200 cursor-pointer"
                                  >
                                    + Bolos
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4.5 bg-[#f8fafa] border-t border-[#bcc9c6]/20 flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-500">
                Pencatat: <strong className="text-[#0b1c30]">{activeCounselor.name}</strong>
              </span>
              <button
                onClick={handleSaveAttendance}
                disabled={filteredStudents.length === 0}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-extrabold transition-all shadow-md active:scale-97 cursor-pointer ${
                  filteredStudents.length === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                    : 'bg-[#00685f] hover:bg-[#005049] text-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Simpan & Sinkronisasi Absensi Harian</span>
              </button>
            </div>
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
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#0b1c30] truncate">
                          {item.student.name}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-gray-400">
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
                <div className="col-span-full py-16 text-center text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Info className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-bold">Belum ada riwayat absensi tercatat</p>
                  <p className="text-xs mt-1">Gunakan Form Input Harian untuk mulai mencatat absensi kelas.</p>
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
    </div>
  );
}
