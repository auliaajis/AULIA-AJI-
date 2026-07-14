import React, { useState, useEffect, useMemo } from 'react';
import { Student, ViolationRecord } from '../types';
import {
  ChevronRight,
  Gavel,
  Search,
  AlertTriangle,
  Save,
  Lightbulb,
  ShieldAlert,
  Info,
  Download,
  Filter
} from 'lucide-react';
import { downloadViolationPDF } from '../utils/pdfGenerator';

interface CatatPelanggaranFormProps {
  students: Student[];
  violations: ViolationRecord[];
  activeCounselor: { name: string };
  preSelectedStudentId?: string;
  onSaveViolation: (record: Omit<ViolationRecord, 'id' | 'ticketId'>) => void;
  onCancel: () => void;
}

export default function CatatPelanggaranForm({
  students,
  violations,
  activeCounselor,
  preSelectedStudentId,
  onSaveViolation,
  onCancel,
}: CatatPelanggaranFormProps) {
  // Tab switcher & search states
  const [activeTab, setActiveTab] = useState<'input' | 'arsip'>('input');
  const [archiveSearch, setArchiveSearch] = useState('');

  // Filtered violation records for archive list
  const filteredViolations = useMemo(() => {
    if (!violations) return [];
    return violations.filter(v => 
      v.studentName.toLowerCase().includes(archiveSearch.toLowerCase()) ||
      v.studentClass.toLowerCase().includes(archiveSearch.toLowerCase()) ||
      v.category.toLowerCase().includes(archiveSearch.toLowerCase()) ||
      v.ticketId.toLowerCase().includes(archiveSearch.toLowerCase())
    );
  }, [violations, archiveSearch]);

  // Autocomplete student query state
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Form states
  const [violationCategory, setViolationCategory] = useState<'' | 'Kedisiplinan' | 'Perilaku' | 'Akademik'>('');
  const [pointsAdded, setPointsAdded] = useState(0);
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [handledBy, setHandledBy] = useState<'Belum Ditangani' | 'Wali Kelas' | 'Guru BK' | 'Wali Kelas & Guru BK'>('Belum Ditangani');
  const [handlingProgress, setHandlingProgress] = useState('');

  // Auto Ticket ID generation
  const ticketId = useMemo(() => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    const year = new Date().getFullYear();
    return `PLG-${year}-${randomNum}`;
  }, []);

  // Pre-fill student if preSelectedStudentId matches
  useEffect(() => {
    if (preSelectedStudentId) {
      const found = students.find((s) => s.id === preSelectedStudentId);
      if (found) {
        setSelectedStudent(found);
        setStudentQuery(found.name);
      }
    }
  }, [preSelectedStudentId, students]);

  // Handle selected violation category points
  useEffect(() => {
    if (violationCategory === 'Kedisiplinan') setPointsAdded(15);
    else if (violationCategory === 'Perilaku') setPointsAdded(50);
    else if (violationCategory === 'Akademik') setPointsAdded(25);
    else setPointsAdded(0);
  }, [violationCategory]);

  // Set default current date and time
  useEffect(() => {
    const today = new Date();
    const formattedDate = today.toISOString().substring(0, 10);
    const minutes = today.getMinutes();
    const formattedTime = `${String(today.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    setIncidentDate(formattedDate);
    setIncidentTime(formattedTime);
  }, []);

  // Autocomplete matching students
  const filteredSuggestions = useMemo(() => {
    if (!studentQuery.trim()) return [];
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(studentQuery.toLowerCase()) ||
        s.nis.includes(studentQuery)
    );
  }, [studentQuery, students]);

  const handleSelectSuggestion = (student: Student) => {
    setSelectedStudent(student);
    setStudentQuery(student.name);
    setShowDropdown(false);
  };

  // Compute points threshold escalation details
  const currentPoints = selectedStudent ? selectedStudent.violationPoints : 0;
  const projectedPoints = currentPoints + pointsAdded;
  const isEscalating = projectedPoints >= 75;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert('Pilih siswa terlebih dahulu!');
      return;
    }
    if (!violationCategory) {
      alert('Pilih jenis kategori pelanggaran!');
      return;
    }

    onSaveViolation({
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      studentClass: selectedStudent.class,
      category: violationCategory,
      pointsAdded,
      date: incidentDate,
      time: incidentTime,
      location: incidentLocation || 'Lokal Sekolah',
      reportedBy: activeCounselor.name,
      notes,
      handledBy,
      handlingProgress: handledBy !== 'Belum Ditangani' ? handlingProgress : '',
    });

    alert('Laporan Pelanggaran Siswa berhasil dicatat dan diverifikasi.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-[#3d4947] opacity-80">
        <button onClick={onCancel} className="hover:text-[#00685f] cursor-pointer">
          Dashboard
        </button>
        <ChevronRight className="w-3 h-3 text-[#bcc9c6]" />
        <button onClick={onCancel} className="hover:text-[#00685f] cursor-pointer">
          Pelanggaran
        </button>
        <ChevronRight className="w-3 h-3 text-[#bcc9c6]" />
        <span className="text-[#00685f] font-bold">
          {activeTab === 'input' ? 'Input Pelanggaran Baru' : 'Arsip Catatan Pelanggaran'}
        </span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#00685f] tracking-tight">
            {activeTab === 'input' ? 'Catat Pelanggaran Siswa' : 'Arsip Pelanggaran Siswa'}
          </h2>
          <p className="text-sm text-[#3d4947]/70 font-semibold mt-1">
            {activeTab === 'input'
              ? 'Gunakan formulir ini untuk mendokumentasikan insiden kedisiplinan secara objektif dan akurat.'
              : 'Daftar semua insiden dan rekam jejak kedisiplinan yang tersertifikasi di database.'}
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('input')}
          className={`pb-3 px-6 text-sm font-extrabold transition-all border-b-2 cursor-pointer ${
            activeTab === 'input'
              ? 'border-[#00685f] text-[#00685f]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Input Pelanggaran Baru
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('arsip')}
          className={`pb-3 px-6 text-sm font-extrabold transition-all border-b-2 cursor-pointer ${
            activeTab === 'arsip'
              ? 'border-[#00685f] text-[#00685f]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Arsip Catatan Pelanggaran ({violations?.length || 0})
        </button>
      </div>

      {activeTab === 'arsip' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-[#bcc9c6]/30 overflow-hidden">
          {/* Detail Header banner */}
          <div className="p-6 border-b border-[#bcc9c6]/30 bg-[#f8f9ff] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center shadow-sm flex-shrink-0">
                <Gavel className="w-5.5 h-5.5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  Arsip Laporan Insiden
                </h3>
                <p className="text-xs text-[#3d4947]/70 font-semibold mt-0.5">
                  Unduh bukti pelanggaran dalam format PDF resmi.
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Cari nama, kelas, kategori..."
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                className="w-full bg-white border border-[#bcc9c6]/40 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 font-semibold text-[#0b1c30]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-[#f8f9ff] border-b border-[#bcc9c6]/30">
                <tr>
                  <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-[10px]">No</th>
                  <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-[10px]">Tiket ID</th>
                  <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-[10px]">Nama Siswa</th>
                  <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-[10px]">Kelas</th>
                  <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-[10px]">Kategori</th>
                  <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-[10px]">Poin</th>
                  <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-[10px]">Waktu / Pelapor</th>
                  <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-[10px]">Penanganan Wali / BK</th>
                  <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-[10px] text-center">Unduh Bukti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#bcc9c6]/20">
                {filteredViolations.length > 0 ? (
                  filteredViolations.map((v, index) => (
                    <tr key={v.id} className="hover:bg-[#eff4ff]/25 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-500">{index + 1}</td>
                      <td className="px-6 py-4 font-bold text-[#ba1a1a]">{v.ticketId}</td>
                      <td className="px-6 py-4 font-extrabold text-[#0b1c30]">{v.studentName}</td>
                      <td className="px-6 py-4 font-semibold text-gray-600">{v.studentClass}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded bg-red-50 text-[#ba1a1a] font-bold text-[10px]">
                          {v.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-red-600">+{v.pointsAdded}</td>
                      <td className="px-6 py-4 text-gray-500">
                        <div>{v.date} &bull; {v.time}</div>
                        <div className="text-[10px] opacity-75 font-semibold">Oleh: {v.reportedBy}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            v.handledBy === 'Wali Kelas' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            v.handledBy === 'Guru BK' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            v.handledBy === 'Wali Kelas & Guru BK' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            'bg-red-50 text-red-800 border border-red-100'
                          }`}>
                            {v.handledBy || 'Belum Ditangani'}
                          </span>
                          {v.handlingProgress && (
                            <p className="text-[11px] text-gray-600 font-medium max-w-[200px] leading-snug">
                              {v.handlingProgress}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => downloadViolationPDF(v)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ba1a1a]/10 text-[#ba1a1a] hover:bg-[#ba1a1a] hover:text-white rounded-lg font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                          title="Unduh Bukti Pelanggaran PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-400 italic">
                      Tidak ada arsip pelanggaran yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Main Card Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#bcc9c6]/30 overflow-hidden">
            {/* Detail Header banner */}
            <div className="p-6 border-b border-[#bcc9c6]/30 bg-[#f8f9ff] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center shadow-sm flex-shrink-0">
                  <Gavel className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0b1c30]">
                    Detail Laporan Insiden
                  </h3>
                  <p className="text-xs text-[#3d4947]/70 font-semibold">
                    Mohon lengkapi seluruh field yang tersedia di bawah.
                  </p>
                </div>
              </div>
              <div className="bg-[#eff4ff] border border-[#bcc9c6]/30 rounded-full px-4 py-1.5 self-start sm:self-center">
                <p className="text-xs text-[#0b1c30] font-semibold">
                  ID Tiket: <span className="font-extrabold text-[#00685f]">#{ticketId}</span>
                </p>
              </div>
            </div>

            {/* Input Form Body */}
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Student Search Autocomplete Selector */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                    <Search className="w-4 h-4 text-[#00685f]" />
                    <span>Pilih Siswa</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={studentQuery}
                      onChange={(e) => {
                        setStudentQuery(e.target.value);
                        setSelectedStudent(null);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder="Ketik NISN atau nama lengkap siswa..."
                      className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
                    />
                    <Search className="w-4.5 h-4.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>

                  {/* Match list Suggestion box */}
                  {showDropdown && studentQuery && !selectedStudent && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#bcc9c6]/40 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto custom-scrollbar">
                      {filteredSuggestions.length > 0 ? (
                        filteredSuggestions.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => handleSelectSuggestion(s)}
                            className="p-3 hover:bg-[#eff4ff]/60 cursor-pointer flex items-center justify-between border-b border-[#bcc9c6]/10 last:border-b-0"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#eff4ff] flex items-center justify-center text-xs font-bold text-[#00685f]">
                                {s.initials}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-[#0b1c30]">{s.name}</p>
                                <p className="text-[10px] text-gray-500 font-semibold">
                                  NISN: {s.nis} | Kelas: {s.class}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-[#ba1a1a] bg-[#ffdad6]/40 px-2 py-0.5 rounded">
                              {s.violationPoints} Poin
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-[#3d4947] opacity-60">
                          Siswa tidak ditemukan...
                        </div>
                      )}
                    </div>
                  )}

                  {/* Binded indicator overlay */}
                  {selectedStudent && (
                    <div className="mt-2 p-2.5 bg-[#f4fffc] border border-[#00685f]/25 rounded-xl flex items-center justify-between">
                      <div className="text-xs">
                        <span className="font-bold text-[#00685f]">Siswa Terpilih: </span>
                        <span className="font-semibold text-gray-700">
                          {selectedStudent.name} ({selectedStudent.class})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudent(null);
                          setStudentQuery('');
                        }}
                        className="p-1 text-[#ba1a1a] hover:bg-red-50 rounded-full"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Violation Category dropdown list */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
                    <span>Jenis Kategori Pelanggaran</span>
                  </label>
                  <select
                    value={violationCategory}
                    onChange={(e) =>
                      setViolationCategory(e.target.value as '' | 'Kedisiplinan' | 'Perilaku' | 'Akademik')
                    }
                    required
                    className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
                  >
                    <option value="">Pilih Kategori...</option>
                    <option value="Kedisiplinan">
                      Kedisiplinan (Terlambat, Atribut, dll) — 15 Poin
                    </option>
                    <option value="Perilaku">
                      Perilaku (Perkelahian, Bullying, dll) — 50 Poin
                    </option>
                    <option value="Akademik">
                      Akademik (Menyontek, Tugas Palsu, dll) — 25 Poin
                    </option>
                  </select>
                </div>
              </div>

              {/* Real-time reactive projected points display block */}
              {selectedStudent && violationCategory && (
                <div className="p-4 bg-[#f8f9ff] rounded-xl border border-[#bcc9c6]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-[#3d4947] uppercase tracking-wider opacity-80">
                      Poin Pelanggaran Baru:
                    </p>
                    <h4 className="text-xl font-extrabold text-[#ba1a1a] mt-1">
                      +{pointsAdded} Poin
                    </h4>
                  </div>
                  <div className="hidden sm:block h-10 w-[1px] bg-[#bcc9c6]/40"></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-[#3d4947] uppercase tracking-wider opacity-80">
                      Akumulasi Total Poin Siswa:
                    </p>
                    <h4 className="text-xl font-extrabold text-[#0b1c30] mt-1">
                      {currentPoints} <span className="text-[#ba1a1a] font-black">→ {projectedPoints}</span>
                    </h4>
                  </div>
                </div>
              )}

              {/* Conditional Escalation threshold Warning Alert banner */}
              {selectedStudent && violationCategory && isEscalating && (
                <div className="bg-[#ffdad6] border-2 border-[#ba1a1a] p-4.5 rounded-xl flex gap-3.5 items-start shadow-sm animate-in zoom-in-95 duration-300">
                  <ShieldAlert className="w-8 h-8 text-[#ba1a1a] flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-extrabold text-[#ba1a1a] text-sm leading-snug">
                      Peringatan Batas Eskalasi: Kategori Bahaya!
                    </h5>
                    <p className="text-xs text-[#93000a] opacity-90 mt-1 leading-relaxed font-semibold">
                      Penambahan poin ini membawa siswa ke tingkat akumulasi melebihi ambang batas aman ({projectedPoints} poin). Guru BK diwajibkan untuk menjadwalkan panggilan orang tua/wali murid segera setelah laporan ini disimpan.
                    </p>
                  </div>
                </div>
              )}

              {/* Date, Time & Location Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0b1c30]">Tanggal Kejadian</label>
                  <input
                    type="date"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    required
                    className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0b1c30]">Waktu</label>
                  <input
                    type="time"
                    value={incidentTime}
                    onChange={(e) => setIncidentTime(e.target.value)}
                    required
                    className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0b1c30]">Lokasi</label>
                  <input
                    type="text"
                    value={incidentLocation}
                    onChange={(e) => setIncidentLocation(e.target.value)}
                    placeholder="Misal: Kantin, Lab Fisika, Kelas 8A"
                    required
                    className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
                  />
                </div>
              </div>

              {/* Monitoring Penanganan Wali Kelas / Guru BK */}
              <div className="p-5 bg-[#eff4ff]/40 rounded-2xl border border-blue-100 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0b1c30] flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-blue-600 rounded-full"></span>
                  Monitoring Penanganan Kasus
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0b1c30]">
                      Status Penanganan
                    </label>
                    <select
                      value={handledBy}
                      onChange={(e) => setHandledBy(e.target.value as any)}
                      className="w-full bg-white border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
                    >
                      <option value="Belum Ditangani">Belum Ditangani / Dalam Proses</option>
                      <option value="Wali Kelas">Sudah Ditangani Wali Kelas</option>
                      <option value="Guru BK">Sudah Ditangani Guru BK</option>
                      <option value="Wali Kelas & Guru BK">Sudah Ditangani Wali Kelas &amp; Guru BK</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0b1c30]">
                      Penanganan Sejauh Apa
                    </label>
                    <input
                      type="text"
                      value={handlingProgress}
                      onChange={(e) => setHandlingProgress(e.target.value)}
                      disabled={handledBy === 'Belum Ditangani'}
                      placeholder={
                        handledBy === 'Belum Ditangani'
                          ? 'Pilih penangan terlebih dahulu...'
                          : 'Contoh: Pemberian surat peringatan, pembinaan, panggilan ortu...'
                      }
                      required={handledBy !== 'Belum Ditangani'}
                      className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm ${
                        handledBy === 'Belum Ditangani'
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-white text-[#0b1c30] border-[#bcc9c6]/40'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Reporting Teacher property */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30]">
                  Guru Pelapor / Saksi Utama (Read-Only)
                </label>
                <input
                  type="text"
                  value={activeCounselor.name}
                  readOnly
                  className="w-full bg-gray-100 border border-[#bcc9c6]/30 text-gray-500 rounded-xl px-4 py-3 text-sm font-semibold cursor-not-allowed"
                />
              </div>

              {/* Additional Chronology Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30]">
                  Catatan Tambahan &amp; Kronologi Kejadian
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Jelaskan secara detail kejadian, respon/penjelasan siswa saat ditanya, serta tindakan penanganan pertama yang diambil..."
                  required
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 resize-none shadow-sm"
                ></textarea>
              </div>

              {/* Footer Action buttons */}
              <div className="pt-6 flex flex-col sm:flex-row gap-4 border-t border-[#bcc9c6]/20">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 py-3 border border-[#bcc9c6] text-[#3d4947] hover:bg-[#eff4ff]/30 rounded-xl text-sm font-bold transition-all"
                >
                  Batalkan
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-97 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4.5 h-4.5" />
                  <span>Simpan Laporan Pelanggaran</span>
                </button>
              </div>
            </form>
          </div>

          {/* Auxiliary Help Tips cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-[#825100]/5 border border-[#825100]/25 rounded-2xl flex gap-3">
              <Lightbulb className="w-5 h-5 text-[#825100] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#3d4947] font-semibold leading-relaxed">
                Siswa dengan akumulasi poin di atas 100 akan secara otomatis dikirimkan ke dewan kehormatan untuk program "Eskalasi Kepala Sekolah".
              </p>
            </div>

            <div className="p-4 bg-[#00685f]/5 border border-[#00685f]/25 rounded-2xl flex gap-3">
              <Info className="w-5 h-5 text-[#00685f] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#3d4947] font-semibold leading-relaxed">
                Sistem pengarsipan ini terenkripsi penuh. Sesuai regulasi privasi murid, dokumen ini hanya bisa diakses oleh personel BK berwenang dan jajaran kepala sekolah.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Inline mini close icon replacement
function XIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
