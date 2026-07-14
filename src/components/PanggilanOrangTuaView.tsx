import React, { useState, useEffect } from 'react';
import { Counselor, Student, ParentSummon } from '../types';
import { 
  Mail, 
  Printer, 
  Plus, 
  Trash2, 
  Search, 
  FileText, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  CheckCircle2, 
  Clock3, 
  XCircle, 
  AlertCircle,
  FileSpreadsheet,
  RefreshCw
} from 'lucide-react';
import { downloadParentSummonPDF, formatIndonesianDate } from '../utils/pdfGenerator';

interface PanggilanOrangTuaViewProps {
  students: Student[];
  activeCounselor: Counselor;
}

export default function PanggilanOrangTuaView({ students, activeCounselor }: PanggilanOrangTuaViewProps) {
  // Tabs: 'daftar' (List) or 'buat' (Create Form)
  const [activeTab, setActiveTab] = useState<'daftar' | 'buat'>('daftar');
  
  // Summons State
  const [summons, setSummons] = useState<ParentSummon[]>(() => {
    const saved = localStorage.getItem('bk_parent_summons');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading parent summons:', e);
      }
    }
    return [];
  });

  // Form States
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [parentName, setParentName] = useState<string>('');
  const [letterNumber, setLetterNumber] = useState<string>('');
  const [letterDate, setLetterDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [summonDate, setSummonDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [summonTime, setSummonTime] = useState<string>('09:00');
  const [summonPlace, setSummonPlace] = useState<string>('Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan');
  const [agenda, setAgenda] = useState<string>('Konsultasi bimbingan perkembangan perilaku, kedisiplinan, dan belajar putra/putri Bapak/Ibu');
  const [customAgenda, setCustomAgenda] = useState<string>('');
  const [status, setStatus] = useState<'Terkirim' | 'Hadir' | 'Batal' | 'Penjadwalan Ulang'>('Terkirim');

  // Search/Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Auto-sync summons to localStorage
  useEffect(() => {
    localStorage.setItem('bk_parent_summons', JSON.stringify(summons));
  }, [summons]);

  // Helper to get Roman numeral for months (Indonesian letter format)
  const getRomanMonth = (monthNumber: number): string => {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return romans[monthNumber] || 'I';
  };

  // Helper to auto-generate beautiful formal school letter number
  const generateLetterNumber = (count: number) => {
    const year = new Date().getFullYear();
    const month = getRomanMonth(new Date().getMonth());
    const paddedCount = String(count + 1).padStart(3, '0');
    // Formal Indonesian letter classification for student affairs: 421.7
    return `421.7/${paddedCount}/SMPN2/${month}/${year}`;
  };

  // Auto-populate / auto-generate fields when active tab changes or student changes
  useEffect(() => {
    if (activeTab === 'buat') {
      setLetterNumber(generateLetterNumber(summons.length));
    }
  }, [activeTab, summons.length]);

  // Handle student selection to auto fill fields if appropriate
  const handleStudentChange = (studentId: string) => {
    setSelectedStudentId(studentId);
    const student = students.find(s => s.id === studentId);
    if (student) {
      // Propose common default parent prefix
      setParentName(`Bapak / Ibu Wali dari ${student.name}`);
    } else {
      setParentName('');
    }
  };

  // Form submission / creation
  const handleCreateSummon = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStudentId) {
      alert('Silakan pilih siswa terlebih dahulu.');
      return;
    }
    if (!parentName.trim()) {
      alert('Nama orang tua / wali tidak boleh kosong.');
      return;
    }
    if (!letterNumber.trim()) {
      alert('Nomor surat tidak boleh kosong.');
      return;
    }

    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    const finalAgenda = agenda === 'Lainnya' ? customAgenda : agenda;

    if (!finalAgenda.trim()) {
      alert('Agenda atau alasan bimbingan tidak boleh kosong.');
      return;
    }

    const newSummon: ParentSummon = {
      id: `ps-${Date.now()}`,
      letterNumber,
      date: letterDate,
      studentId: student.id,
      studentName: student.name,
      studentClass: student.class,
      studentNis: student.nis,
      parentName: parentName,
      summonDate,
      summonTime,
      summonPlace,
      agenda: finalAgenda,
      counselorId: activeCounselor.id,
      status: 'Terkirim',
      createdAt: new Date().toISOString()
    };

    setSummons(prev => [newSummon, ...prev]);
    
    // Automatically print/download the PDF
    downloadParentSummonPDF(newSummon, activeCounselor);

    // Reset Form
    setSelectedStudentId('');
    setParentName('');
    setCustomAgenda('');
    
    // Toast alert / Notification
    alert(`Surat Panggilan Orang Tua untuk ${student.name} berhasil dibuat dan diunduh.`);
    
    // Go back to list tab
    setActiveTab('daftar');
  };

  // Handle status update
  const handleUpdateStatus = (id: string, newStatus: 'Terkirim' | 'Hadir' | 'Batal' | 'Penjadwalan Ulang') => {
    setSummons(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
  };

  // Handle delete
  const handleDeleteSummon = (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus catatan surat panggilan untuk ${name}?`)) {
      setSummons(prev => prev.filter(s => s.id !== id));
    }
  };

  // Filtered summons for list
  const filteredSummons = summons.filter(s => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      s.studentName.toLowerCase().includes(searchLower) ||
      s.studentClass.toLowerCase().includes(searchLower) ||
      s.letterNumber.toLowerCase().includes(searchLower) ||
      s.agenda.toLowerCase().includes(searchLower);
    
    // If admin, show all, else show counselor's own letters
    const matchesCounselor = activeCounselor.id === 'admin' || s.counselorId === activeCounselor.id;

    return matchesSearch && matchesCounselor;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b1c30] flex items-center gap-2">
            <Mail className="w-7 h-7 text-[#00685f]" />
            <span>Panggilan Orang Tua / Wali Murid</span>
          </h2>
          <p className="text-sm text-[#3d4947]/70 font-semibold mt-0.5">
            Manajemen dan pembuatan surat panggilan resmi koordinasi orang tua murid dengan standar kop sekolah resmi.
          </p>
        </div>
        
        {/* Tab Controls */}
        <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
          <button
            onClick={() => setActiveTab('daftar')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 ${
              activeTab === 'daftar'
                ? 'bg-[#00685f] text-white shadow-sm'
                : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-gray-200'
            }`}
          >
            Daftar Surat Panggilan
          </button>
          <button
            onClick={() => setActiveTab('buat')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 ${
              activeTab === 'buat'
                ? 'bg-[#00685f] text-white shadow-sm'
                : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-gray-200'
            }`}
          >
            Buat Surat Panggilan
          </button>
        </div>
      </div>

      {activeTab === 'buat' ? (
        /* CREATE FORM TAB */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleCreateSummon} className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-xs space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="font-extrabold text-[#0b1c30] text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#00685f]" />
                <span>Drafting Surat Resmi Panggilan Orang Tua</span>
              </h3>
              <p className="text-xs text-[#3d4947]/70 font-semibold mt-1">
                Kop surat, tanggal surat, tata letak formal, dan tanda tangan Kepala Sekolah serta Guru BK akan terlampir otomatis.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Target Student selection */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Pilih Siswa Target <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => handleStudentChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} (Kelas {student.class}) [NIS: {student.nis}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Parents Name */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Nama Orang Tua / Wali Murid <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder="Bapak / Ibu Wali Murid"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                    required
                  />
                </div>
              </div>

              {/* Letter Number (Auto-populated but editable) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Nomor Surat Resmi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={letterNumber}
                  onChange={(e) => setLetterNumber(e.target.value)}
                  placeholder="Contoh: 421.7/001/SMP2/VII/2026"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
                <p className="text-[10px] text-gray-500 font-medium">Nomor surat otomatis di-increment dari registrasi, tetapi dapat diedit manual.</p>
              </div>

              {/* Letter Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Tanggal Surat Dibuat
                </label>
                <input
                  type="date"
                  value={letterDate}
                  onChange={(e) => setLetterDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Summon Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Hari & Tanggal Pertemuan <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={summonDate}
                  onChange={(e) => setSummonDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Summon Time */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Jam Kehadiran <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={summonTime}
                  onChange={(e) => setSummonTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Summon Place */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Tempat Pertemuan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={summonPlace}
                  onChange={(e) => setSummonPlace(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Agenda select option */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Agenda / Alasan Panggilan <span className="text-red-500">*</span>
                </label>
                <select
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                >
                  <option value="Konsultasi bimbingan perkembangan perilaku, kedisiplinan, dan belajar putra/putri Bapak/Ibu">
                    Konsultasi perkembangan perilaku, kedisiplinan, dan belajar (Umum)
                  </option>
                  <option value="Koordinasi tindak lanjut penanganan pelanggaran kedisiplinan tata tertib sekolah">
                    Koordinasi tindak lanjut penanganan tata tertib/pelanggaran siswa
                  </option>
                  <option value="Koordinasi bimbingan minat, bakat, kelanjutan studi, dan masa depan karir siswa">
                    Konsultasi bimbingan minat, bakat, dan kelanjutan karir/studi
                  </option>
                  <option value="Sesi khusus mediasi pertikaian / penyelesaian permasalahan hubungan sosial antar siswa">
                    Sesi khusus mediasi / problem-solving hubungan sosial
                  </option>
                  <option value="Lainnya">Agenda Lainnya (Tulis Manual)</option>
                </select>
              </div>

              {/* Custom Agenda input */}
              {agenda === 'Lainnya' && (
                <div className="space-y-1.5 md:col-span-2 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-bold text-orange-600 uppercase tracking-wide block">
                    Tulis Manual Agenda / Alasan Panggilan <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={customAgenda}
                    onChange={(e) => setCustomAgenda(e.target.value)}
                    rows={3}
                    placeholder="Contoh: Koordinasi mendesak penyelesaian kasus ketidakhadiran berturut-turut tanpa keterangan..."
                    className="w-full px-3.5 py-2.5 bg-amber-50/50 border border-orange-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-md cursor-pointer active:scale-97"
              >
                <Printer className="w-4 h-4" />
                <span>Simpan & Unduh Surat Panggilan (PDF)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('daftar')}
                className="py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Kembali ke Daftar
              </button>
            </div>
          </form>

          {/* Form Side Guide / Preview Info */}
          <div className="bg-[#eff4ff]/80 rounded-2xl p-6 border border-[#00685f]/10 shadow-xs space-y-4">
            <h4 className="font-extrabold text-[#00685f] text-sm flex items-center gap-1.5">
              <AlertCircle className="w-4.5 h-4.5 text-[#00685f]" />
              <span>Panduan Administrasi Surat Panggilan</span>
            </h4>
            
            <div className="text-xs text-[#3d4947] space-y-3 font-medium leading-relaxed">
              <p>
                Surat panggilan orang tua merupakan dokumen resmi sekolah yang memiliki implikasi formal. 
              </p>
              
              <ul className="list-disc list-inside space-y-2 text-[#3d4947]/90 font-semibold pl-1">
                <li>
                  <strong className="text-[#0b1c30]">Penomoran Surat:</strong> Gunakan format penomoran surat keluar resmi BK yang berlaku di {activeCounselor.allowedClasses.includes('all') ? 'sekolah' : 'kelas Anda'}.
                </li>
                <li>
                  <strong className="text-[#0b1c30]">Tempat Pelaksanaan:</strong> Secara default disarankan di Ruang BK guna menjamin kerahasiaan dan kenyamanan proses bimbingan.
                </li>
                <li>
                  <strong className="text-[#0b1c30]">Pengesahan:</strong> Surat ini secara hukum ditandatangani oleh Kepala Sekolah sebagai pihak yang mengetahui, serta Guru BK yang bersangkutan selaku pengundang.
                </li>
              </ul>
              
              <div className="bg-white p-3.5 rounded-xl border border-[#00685f]/10 text-[11px] font-bold text-gray-600">
                <span className="text-[#00685f] block mb-1">Informasi Penandatangan:</span>
                <div>Kepala Sekolah: Drs. H. Suhardi, M.Pd.</div>
                <div>Guru BK: {activeCounselor.name}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* SUMMONS LIST TAB */
        <div className="space-y-4">
          
          {/* Filters & Actions Bar */}
          <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/30 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari siswa, kelas, nomor surat, atau agenda..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#00685f]"
              />
            </div>

            <button
              onClick={() => setActiveTab('buat')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Surat Baru</span>
            </button>
          </div>

          {/* List Display */}
          {filteredSummons.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-[#bcc9c6]/30 text-center space-y-3">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-[#00685f]">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-[#0b1c30] text-sm">Tidak Ada Surat Panggilan</h3>
              <p className="text-xs text-[#3d4947]/70 font-semibold max-w-sm mx-auto">
                {searchQuery ? 'Tidak ditemukan data panggilan yang cocok dengan pencarian Anda.' : 'Anda belum pernah membuat surat panggilan orang tua / wali murid.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors"
                >
                  Clear Pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSummons.map((summon) => {
                // Color badges for status
                let badgeClass = 'bg-[#00685f]/10 text-[#00685f]';
                let StatusIcon = Clock3;
                if (summon.status === 'Hadir') {
                  badgeClass = 'bg-[#6b38d4]/10 text-[#6b38d4]';
                  StatusIcon = CheckCircle2;
                } else if (summon.status === 'Batal') {
                  badgeClass = 'bg-red-50 text-red-600 border border-red-100';
                  StatusIcon = XCircle;
                } else if (summon.status === 'Penjadwalan Ulang') {
                  badgeClass = 'bg-amber-50 text-amber-600 border border-amber-100';
                  StatusIcon = RefreshCw;
                }

                return (
                  <div 
                    key={summon.id}
                    className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      
                      {/* Badge / Letter Date row */}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded">
                          Surat: {summon.date}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 ${badgeClass}`}>
                            <StatusIcon className="w-3 h-3" />
                            <span>{summon.status}</span>
                          </span>
                        </div>
                      </div>

                      {/* Title & Student */}
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Target Siswa:</p>
                        <h4 className="font-extrabold text-[#0b1c30] text-sm">
                          {summon.studentName}
                        </h4>
                        <p className="text-xs font-bold text-[#00685f] mt-0.5">
                          Kelas {summon.studentClass} • NIS {summon.studentNis}
                        </p>
                      </div>

                      {/* Official Letter Number */}
                      <div className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-100 text-xs">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">No. Surat Resmi:</div>
                        <div className="font-mono font-extrabold text-gray-800 tracking-tight select-all truncate">
                          {summon.letterNumber}
                        </div>
                      </div>

                      {/* Meeting Agenda Details */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Agenda Pertemuan:</p>
                        <p className="text-xs font-semibold text-[#3d4947] leading-relaxed line-clamp-3 bg-teal-50/30 p-2.5 rounded-xl border border-[#00685f]/5">
                          {summon.agenda}
                        </p>
                      </div>

                      {/* Summon Date/Time/Place details */}
                      <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-500">
                        <div className="space-y-1">
                          <span className="text-gray-400 font-medium block">HARI/TANGGAL</span>
                          <span className="text-gray-800 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-[#00685f]" />
                            <span className="truncate">{formatIndonesianDate(summon.summonDate).split(',')[1]?.trim() || summon.summonDate}</span>
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-gray-400 font-medium block">WAKTU</span>
                          <span className="text-gray-800 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#00685f]" />
                            <span>{summon.summonTime} WIB</span>
                          </span>
                        </div>
                        <div className="col-span-2 space-y-0.5 pt-1">
                          <span className="text-gray-400 font-medium block">LOKASI</span>
                          <span className="text-gray-800 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#00685f]" />
                            <span className="truncate" title={summon.summonPlace}>{summon.summonPlace}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer actions block */}
                    <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
                      
                      {/* Status select editor */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-gray-400 font-bold">STATUS PENANGANAN:</span>
                        <select
                          value={summon.status}
                          onChange={(e) => handleUpdateStatus(summon.id, e.target.value as any)}
                          className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold text-gray-700 focus:outline-none"
                        >
                          <option value="Terkirim">Terkirim</option>
                          <option value="Hadir">Siswa/Wali Hadir</option>
                          <option value="Batal">Dibatalkan</option>
                          <option value="Penjadwalan Ulang">Reschedule</option>
                        </select>
                      </div>

                      {/* Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => downloadParentSummonPDF(summon, activeCounselor)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#00685f]/10 text-[#00685f] hover:bg-[#00685f] hover:text-white rounded-lg text-[10px] font-extrabold transition-all cursor-pointer shadow-xs active:scale-95"
                          title="Cetak Ulang Surat Panggilan Resmi (PDF)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Cetak Surat (PDF)</span>
                        </button>
                        <button
                          onClick={() => handleDeleteSummon(summon.id, summon.studentName)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 cursor-pointer"
                          title="Hapus Rekaman"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
