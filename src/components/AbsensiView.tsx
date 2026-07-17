import { useState, useMemo, useEffect } from 'react';
import { Student, ClassAttendanceRecord, StudentAttendance } from '../types';
import { downloadAttendanceRecapPDF } from '../utils/pdfGenerator';
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
  PlusCircle,
  HelpCircle,
  Info
} from 'lucide-react';

interface AbsensiViewProps {
  students: Student[];
  activeCounselor: { name: string };
  onAddActivityLog: (title: string, description: string, studentName: string, studentClass: string, type: 'attendance') => void;
  onAttendanceChanged?: () => void;
}

export default function AbsensiView({
  students,
  activeCounselor,
  onAddActivityLog,
  onAttendanceChanged,
}: AbsensiViewProps) {
  // Get unique classes from student database, fallback if empty
  const availableClasses = useMemo(() => {
    const classesFromStudents = Array.from(new Set(students.map((s) => s.class)))
      .filter(Boolean)
      .sort();
    if (classesFromStudents.length > 0) return classesFromStudents;
    return ['Kelas 7A', 'Kelas 7B', 'Kelas 7C', 'Kelas 8A', 'Kelas 8B', 'Kelas 8C', 'Kelas 9A', 'Kelas 9B', 'Kelas 9C'];
  }, [students]);

  // Selected State
  const [selectedClass, setSelectedClass] = useState<string>(availableClasses[0] || 'Kelas 7A');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = new Date(today.getTime() - tzOffset).toISOString().slice(0, 10);
    return localISOTime;
  });

  // Current records loaded or created for this class/date
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, StudentAttendance>>({});
  
  // Historical attendance list from localStorage
  const [history, setHistory] = useState<ClassAttendanceRecord[]>(() => {
    const saved = localStorage.getItem('bk_attendance_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Helper for date formatting
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

  const handleDownloadRecap = () => {
    // Check if there are records in history for selected class and range
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

  // Load attendance record when selected class or date changes
  useEffect(() => {
    // Look up in history
    const existingRecord = history.find(
      (h) => h.class === selectedClass && h.date === selectedDate
    );

    const classStudents = students.filter((s) => s.class === selectedClass);
    const newRecords: Record<string, StudentAttendance> = {};

    if (existingRecord) {
      // Map existing records
      existingRecord.records.forEach((rec) => {
        newRecords[rec.studentId] = rec;
      });
      // Fill in any students that might be new in this class but not in the saved record
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
      // Default to "H" (Hadir) for everyone
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

  // Save history back to localStorage
  const saveHistoryToStorage = (updatedHistory: ClassAttendanceRecord[]) => {
    setHistory(updatedHistory);
    localStorage.setItem('bk_attendance_history', JSON.stringify(updatedHistory));
    if (onAttendanceChanged) {
      onAttendanceChanged();
    }
  };

  // Filter students matching the selected class
  const filteredStudents = useMemo(() => {
    return students.filter((s) => s.class === selectedClass);
  }, [students, selectedClass]);

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

    const recordId = `att-${selectedClass.replace(/\s+/g, '-').toLowerCase()}-${selectedDate}`;
    const timestampLabel = new Date().toLocaleString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });

    const newRecord: ClassAttendanceRecord = {
      id: recordId,
      class: selectedClass,
      date: selectedDate,
      records: recordsArray,
      updatedAt: timestampLabel,
      submittedBy: activeCounselor.name,
    };

    // Replace if existing, else prepend
    const existingIndex = history.findIndex((h) => h.id === recordId);
    let updatedHistory = [...history];

    if (existingIndex > -1) {
      updatedHistory[existingIndex] = newRecord;
    } else {
      updatedHistory = [newRecord, ...updatedHistory];
    }

    saveHistoryToStorage(updatedHistory);

    // Calculate count of absentees for description
    const sick = recordsArray.filter((r) => r.status === 'S').length;
    const izin = recordsArray.filter((r) => r.status === 'I').length;
    const alpa = recordsArray.filter((r) => r.status === 'A').length;

    const description = `Mengisi absensi harian ${selectedClass} tanggal ${selectedDate}. (Sakit: ${sick}, Izin: ${izin}, Alpa: ${alpa})`;
    
    // Add to activity log
    onAddActivityLog(
      `Absensi Harian ${selectedClass}`,
      description,
      'Semua Siswa',
      selectedClass,
      'attendance'
    );

    alert(`Absensi ${selectedClass} tanggal ${selectedDate} berhasil disimpan!`);
  };

  // Delete history item
  const handleDeleteHistory = (recordId: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus arsip absensi ini?')) {
      const updatedHistory = history.filter((h) => h.id !== recordId);
      saveHistoryToStorage(updatedHistory);
    }
  };

  // Quick statistics for current selection
  const stats = useMemo(() => {
    const recordsArray = Object.values(attendanceRecords) as StudentAttendance[];
    const total = recordsArray.length;
    if (total === 0) return { H: 0, S: 0, I: 0, A: 0, percent: 0 };

    const H = recordsArray.filter((r) => r.status === 'H').length;
    const S = recordsArray.filter((r) => r.status === 'S').length;
    const I = recordsArray.filter((r) => r.status === 'I').length;
    const A = recordsArray.filter((r) => r.status === 'A').length;
    const percent = Math.round((H / total) * 100);

    return { H, S, I, A, percent };
  }, [attendanceRecords]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b1c30]">Fitur Absensi Harian Perkelas</h2>
          <p className="text-sm text-[#3d4947]/70 font-semibold mt-0.5">
            Pencatatan kehadiran manual harian siswa bimbingan per kelas.
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={() => handleBulkSetStatus('H')}
            className="px-3.5 py-2 text-xs font-bold text-[#00685f] bg-[#00685f]/10 hover:bg-[#00685f]/20 rounded-xl transition-colors cursor-pointer"
          >
            Hadir Semua
          </button>
          <button
            onClick={() => handleBulkSetStatus('A')}
            className="px-3.5 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors cursor-pointer"
          >
            Alpa Semua
          </button>
        </div>
      </div>

      {/* Filter and Config Bar */}
      <div className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        {/* Class Switcher */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider block">
            Pilih Kelas
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full text-xs bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl py-2.5 px-3 font-semibold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 cursor-pointer"
          >
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>

        {/* Date Picker */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider block">
            Tanggal Absensi
          </label>
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full text-xs bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl py-2.5 px-3 font-semibold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 cursor-pointer"
            />
          </div>
        </div>

        {/* Active Counselor Display */}
        <div className="bg-[#00685f]/5 border border-[#00685f]/10 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 bg-[#00685f] rounded-lg text-white">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-[#3d4947] tracking-wider opacity-70">
              Konselor Pencatat
            </p>
            <p className="text-xs font-bold text-[#0b1c30]">{activeCounselor.name}</p>
          </div>
        </div>
      </div>

      {/* Rekap Absensi PDF Section */}
      <div className="bg-gradient-to-r from-teal-50/70 to-[#00685f]/5 rounded-2xl p-5 border border-[#00685f]/20 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#00685f]/15 rounded-xl text-[#00685f] inline-block">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <h3 className="font-extrabold text-[#0b1c30] text-sm sm:text-base">Rekap Absensi Bulanan & Periode</h3>
          </div>
          <p className="text-xs text-[#3d4947]/85 font-medium leading-relaxed">
            Pilih periode tanggal dan kelas yang diinginkan untuk mengunduh rekapitulasi persentase kehadiran, sakit, izin, dan alpa siswa bimbingan dalam format PDF siap cetak.
          </p>
        </div>
        
        <div className="flex flex-wrap items-end gap-3.5 bg-white p-4 rounded-xl border border-[#bcc9c6]/20 shadow-2xs self-start md:self-auto w-full md:w-auto">
          <div className="space-y-1.5 min-w-[120px] flex-1 md:flex-none">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Kelas</label>
            <select
              value={recapClass}
              onChange={(e) => setRecapClass(e.target.value)}
              className="w-full text-xs bg-[#f8f9ff] border border-[#bcc9c6]/30 rounded-lg py-2 px-2.5 font-bold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 cursor-pointer"
            >
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 min-w-[110px] flex-1 md:flex-none">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Mulai Tanggal</label>
            <input
              type="date"
              value={recapStartDate}
              onChange={(e) => setRecapStartDate(e.target.value)}
              className="w-full text-xs bg-[#f8f9ff] border border-[#bcc9c6]/30 rounded-lg py-2 px-2.5 font-bold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5 min-w-[110px] flex-1 md:flex-none">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Selesai Tanggal</label>
            <input
              type="date"
              value={recapEndDate}
              onChange={(e) => setRecapEndDate(e.target.value)}
              className="w-full text-xs bg-[#f8f9ff] border border-[#bcc9c6]/30 rounded-lg py-2 px-2.5 font-bold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 cursor-pointer"
            />
          </div>

          <button
            onClick={handleDownloadRecap}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold rounded-lg shadow-sm hover:shadow-md active:scale-97 transition-all cursor-pointer w-full md:w-auto mt-2 md:mt-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Unduh Rekap PDF</span>
          </button>
        </div>
      </div>

      {/* Overview Stats Widget */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/20 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Persentase Hadir</span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-2xl font-black text-[#00685f]">{stats.percent}%</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 font-medium">Dari {filteredStudents.length} siswa</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/20 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Hadir</span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-2xl font-black text-emerald-600">{stats.H}</span>
            <span className="text-[10px] font-semibold text-gray-400">Siswa</span>
          </div>
          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${stats.percent}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/20 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Sakit</span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-2xl font-black text-amber-500">{stats.S}</span>
            <span className="text-[10px] font-semibold text-gray-400">Siswa</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 font-medium">Butuh pemantauan kesehatan</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/20 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Izin</span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-2xl font-black text-blue-500">{stats.I}</span>
            <span className="text-[10px] font-semibold text-gray-400">Siswa</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 font-medium">Disertai surat/kabar</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/20 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Alpa (Tanpa Keterangan)</span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-2xl font-black text-red-600">{stats.A}</span>
            <span className="text-[10px] font-semibold text-gray-400">Siswa</span>
          </div>
          <p className="text-[10px] text-red-600/70 font-semibold mt-1">Potensi pelanggaran poin</p>
        </div>
      </div>

      {/* Main Student List Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-xs overflow-hidden flex flex-col">
          <div className="px-6 py-4.5 border-b border-[#bcc9c6]/20 bg-[#f8fafa] flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[#0b1c30] text-sm">Daftar Kehadiran Siswa</h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Pilih status absensi untuk masing-masing siswa kelas {selectedClass}.
              </p>
            </div>
            <span className="text-xs bg-[#eff4ff] text-[#00685f] font-bold px-2.5 py-1 rounded-lg">
              {filteredStudents.length} Terdaftar
            </span>
          </div>

          <div className="divide-y divide-[#bcc9c6]/15 max-h-[580px] overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-[#3d4947]/60">
                <Users className="w-10 h-10 mx-auto text-[#bcc9c6] mb-3" />
                <p className="text-sm font-bold">Belum ada siswa terdaftar di {selectedClass}</p>
                <p className="text-xs mt-1">Harap tambah siswa ke kelas ini di menu "Data Siswa" terlebih dahulu.</p>
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

                return (
                  <div key={student.id} className="p-4.5 sm:px-6 hover:bg-[#f8f9ff]/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Student Identity */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00685f] to-[#005049] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                        {student.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#0b1c30] truncate">{student.name}</p>
                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">NISN: {student.nis}</p>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Status Buttons */}
                      <div className="flex items-center gap-1.5 bg-[#f0f4f3] p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => handleSetStatus(student.id, 'H')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                            record.status === 'H'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-gray-600 hover:bg-white'
                          }`}
                        >
                          H
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetStatus(student.id, 'S')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                            record.status === 'S'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-gray-600 hover:bg-white'
                          }`}
                          title="Sakit"
                        >
                          S
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetStatus(student.id, 'I')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                            record.status === 'I'
                              ? 'bg-blue-500 text-white shadow-xs'
                              : 'text-gray-600 hover:bg-white'
                          }`}
                          title="Izin"
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetStatus(student.id, 'A')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                            record.status === 'A'
                              ? 'bg-red-600 text-white shadow-xs'
                              : 'text-gray-600 hover:bg-white'
                          }`}
                          title="Alpa / Tanpa Keterangan"
                        >
                          A
                        </button>
                      </div>

                      {/* Notes Input */}
                      <input
                        type="text"
                        placeholder="Catatan / Keterangan..."
                        value={record.notes}
                        onChange={(e) => handleSetNotes(student.id, e.target.value)}
                        className="text-xs bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3 py-2 w-full sm:w-44 focus:outline-none focus:ring-1 focus:ring-[#00685f]/50"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-4.5 bg-[#f8fafa] border-t border-[#bcc9c6]/20 flex justify-end">
            <button
              onClick={handleSaveAttendance}
              disabled={filteredStudents.length === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md active:scale-97 cursor-pointer ${
                filteredStudents.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-[#00685f] hover:bg-[#005049] text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan & Catat Absensi</span>
            </button>
          </div>
        </div>

        {/* Sidebar: Attendance History Logs */}
        <div className="bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-xs p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#bcc9c6]/15">
              <div className="p-1.5 bg-[#6b38d4]/10 rounded-lg text-[#6b38d4]">
                <History className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-bold text-[#0b1c30] text-sm">Riwayat Absensi</h3>
                <p className="text-[10px] text-gray-500">Arsip absensi harian yang sudah dicatat</p>
              </div>
            </div>

            <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
              {history.length === 0 ? (
                <div className="py-12 text-center text-[#3d4947]/60">
                  <Info className="w-8 h-8 mx-auto text-[#bcc9c6]/75 mb-2" />
                  <p className="text-xs font-bold">Belum ada riwayat tercatat</p>
                  <p className="text-[10px] mt-1 leading-relaxed px-4">
                    Data kehadiran yang Anda simpan akan muncul rapi di panel riwayat ini.
                  </p>
                </div>
              ) : (
                history.map((h) => {
                  const sCount = h.records.filter((r) => r.status === 'S').length;
                  const iCount = h.records.filter((r) => r.status === 'I').length;
                  const aCount = h.records.filter((r) => r.status === 'A').length;
                  const hCount = h.records.filter((r) => r.status === 'H').length;
                  const total = h.records.length;
                  const percent = Math.round((hCount / total) * 100);

                  return (
                    <div
                      key={h.id}
                      className="group bg-[#f8f9ff] hover:bg-[#f3f5ff] rounded-xl p-3 border border-[#bcc9c6]/20 transition-all flex flex-col justify-between relative"
                    >
                      <button
                        onClick={() => handleDeleteHistory(h.id)}
                        className="absolute top-2.5 right-2.5 p-1 text-gray-400 hover:text-red-600 rounded-lg hover:bg-white/60 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Hapus riwayat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div>
                        <div className="flex justify-between items-start pr-6">
                          <span className="text-xs font-bold text-[#0b1c30]">{h.class}</span>
                          <span className="text-[10px] text-gray-400 font-semibold">{h.date}</span>
                        </div>

                        {/* Attendance badging stats */}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                            {percent}% Hadir
                          </span>
                          {sCount > 0 && (
                            <span className="text-[9px] font-semibold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                              {sCount} S
                            </span>
                          )}
                          {iCount > 0 && (
                            <span className="text-[9px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                              {iCount} I
                            </span>
                          )}
                          {aCount > 0 && (
                            <span className="text-[9px] font-extrabold bg-red-50 text-red-700 px-1.5 py-0.5 rounded">
                              {aCount} A
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-[#bcc9c6]/10 flex justify-between items-center text-[9px] font-bold text-gray-400">
                        <span>Pencatat: {h.submittedBy}</span>
                        <span>{h.updatedAt}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-[#eff4ff] border border-blue-100 rounded-xl p-3 flex gap-2.5 mt-4">
            <Info className="w-4.5 h-4.5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-[#0b1c30] leading-none mb-1">Informasi Sinkronisasi</p>
              <p className="text-[9px] text-gray-500 leading-normal">
                Setiap kali absensi dicatat, sistem akan otomatis memperbarui arsip riwayat dan menambah entri aktivitas di halaman utama.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
