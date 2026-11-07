import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  Plus, 
  Search, 
  Calendar, 
  MapPin, 
  Users, 
  FileText, 
  Camera, 
  Upload, 
  Download, 
  Trash2, 
  ChevronRight, 
  X, 
  Check, 
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { Student, Counselor, HomeVisitRecord, BidangBimbinganType } from '../types';
import { BIDANG_BIMBINGAN_OPTIONS } from '../utils/bkKomprehensif';
import { getSchoolConfig, downloadHomeVisitPDF, downloadRekapHomeVisitPDF } from '../utils/pdfGenerator';
import { triggerBackgroundAutoSync } from '../utils/googleSync';
import { registerDeletedId } from '../utils/deletionTracker';
import { autoPushToJournal } from '../utils/journalAutoLink';
import { saveBulkToFirestore, saveSchoolData, loadSchoolData, deleteFromFirestore, saveToFirestore } from '../utils/firestoreSync';
import { filterHomeVisits } from '../utils/accessControl';
import GoogleDrivePhotoUploader from './GoogleDrivePhotoUploader';
import { initialHomeVisits } from '../data/mockData';

interface SignaturePadProps {
  label: string;
  onChange: (base64: string | undefined) => void;
}

function SignaturePad({ label, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: any) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setIsEmpty(false);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onChange(canvas.toDataURL('image/png'));
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange(undefined);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0b1c30'; // Dark Slate
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  return (
    <div className="space-y-1.5 p-3.5 bg-gray-50 border border-gray-300 rounded-xl w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-bold text-[#0b1c30] uppercase tracking-wide block">
          {label}
        </span>
        {!isEmpty && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] font-extrabold text-red-600 hover:underline uppercase cursor-pointer"
          >
            Reset TTD
          </button>
        )}
      </div>

      <div className="relative bg-white border border-dashed border-gray-300 rounded-lg overflow-hidden h-28 flex items-center justify-center">
        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              Sentuh / Seret Layar HP
            </span>
            <span className="text-[9px] text-gray-400 mt-0.5">
              Tulis Tanda Tangan di Sini
            </span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={400}
          height={140}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        />
      </div>
    </div>
  );
}

interface HomeVisitViewProps {
  students: Student[];
  activeCounselor: Counselor;
}

export default function HomeVisitView({ students, activeCounselor }: HomeVisitViewProps) {
  const isInitialMount = useRef(true);

  // Core states
  const [visits, setVisits] = useState<HomeVisitRecord[]>(() => {
    const loaded = loadSchoolData<HomeVisitRecord[]>('bk_home_visits', initialHomeVisits);
    if (!loaded || loaded.length === 0) {
      saveSchoolData('bk_home_visits', initialHomeVisits);
      return initialHomeVisits;
    }
    return loaded;
  });

  // Navigation / Modal States
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<HomeVisitRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [parentNameMet, setParentNameMet] = useState('');
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bidangBimbingan, setBidangBimbingan] = useState<BidangBimbinganType>('Pribadi');
  const [address, setAddress] = useState('');
  const [purpose, setPurpose] = useState('');
  const [result, setResult] = useState('');
  const [agreement, setAgreement] = useState('');
  
  // Photo capture & upload states
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [photoName, setPhotoName] = useState<string | undefined>(undefined);
  const [driveFileId, setDriveFileId] = useState<string | undefined>(undefined);
  const [driveViewUrl, setDriveViewUrl] = useState<string | undefined>(undefined);

  // Digital Signature states
  const [parentSignature, setParentSignature] = useState<string | undefined>(undefined);
  const [counselorSignature, setCounselorSignature] = useState<string | undefined>(undefined);

  // Sync to local cache
  useEffect(() => {
    saveSchoolData('bk_home_visits', visits);
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    triggerBackgroundAutoSync();
  }, [visits]);

  // Realtime subscriber for remote changes
  useEffect(() => {
    const handleRealtimeUpdate = (e: any) => {
      if (e.detail?.key === 'bk_home_visits') {
        if (Array.isArray(e.detail.data)) {
          setVisits(e.detail.data);
        } else {
          setVisits(loadSchoolData('bk_home_visits', []));
        }
      }
    };

    window.addEventListener('bk_realtime_sync', handleRealtimeUpdate);
    window.addEventListener('storage', (e) => {
      if (e.key === 'bk_home_visits') {
        handleRealtimeUpdate({ detail: { key: e.key } });
      }
    });

    return () => {
      window.removeEventListener('bk_realtime_sync', handleRealtimeUpdate);
    };
  }, []);

  // Handle student selection from autocomplete
  const handleSelectStudent = (student: Student) => {
    setSelectedStudentId(student.id);
    setSelectedStudent(student);
    setStudentSearch(student.name);
    setShowStudentDropdown(false);
    
    // Auto populate common fields
    setParentNameMet(`Bapak / Ibu Wali dari ${student.name}`);
  };

  // Filter student suggestions
  const studentSuggestions = React.useMemo(() => {
    const query = studentSearch.toLowerCase().trim();
    if (!query) return [];
    return students
      .filter((s) => {
        if (!s) return false;
        const name = String(s.name || '').toLowerCase();
        const nis = String(s.nis ?? '').toLowerCase();
        const nisn = String(s.nisn ?? '').toLowerCase();
        const sClass = String(s.class || '').toLowerCase();
        return name.includes(query) || nis.includes(query) || nisn.includes(query) || sClass.includes(query);
      })
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id'));
  }, [studentSearch, students]);

  // Submit form handler
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert('Silakan pilih siswa target terlebih dahulu.');
      return;
    }

    const year = new Date(visitDate).getFullYear();
    const randomNumber = Math.floor(100 + Math.random() * 900);
    const reportNumber = `HV-${year}-${randomNumber}`;

    const newRecord: HomeVisitRecord = {
      id: `hv-${Date.now()}`,
      reportNumber,
      date: visitDate,
      bidangBimbingan,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name || '',
      studentClass: selectedStudent.class || '',
      studentNis: String(selectedStudent.nis ?? ''),
      parentNameMet,
      address,
      purpose,
      result,
      agreement,
      photoUrl,
      photoName,
      driveFileId,
      driveViewUrl,
      parentSignature,
      counselorSignature,
      counselorName: activeCounselor.name,
      counselorId: activeCounselor.id,
      createdAt: new Date().toISOString()
    };

    setVisits((prev) => [newRecord, ...prev]);
    saveToFirestore('bk_home_visits', newRecord);
    
    // Add activity log to local store for dashboard
    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;
    
    const savedLogs = localStorage.getItem('bk_logs');
    let existingLogs = [];
    try {
      existingLogs = savedLogs ? JSON.parse(savedLogs) : [];
      if (!Array.isArray(existingLogs)) existingLogs = [];
    } catch (e) {
      existingLogs = [];
    }
    const newLog = {
      id: `log-hv-${Date.now()}`,
      timeLabel,
      type: 'homevisit',
      title: `Home Visit: ${selectedStudent.name}`,
      description: `Kunjungan rumah ke tempat tinggal ${selectedStudent.name} (${selectedStudent.class}) ditemui ${parentNameMet}.`,
      studentName: selectedStudent.name,
      studentClass: selectedStudent.class,
      timestamp: new Date().toISOString()
    };
    saveSchoolData('bk_logs', [newLog, ...existingLogs.slice(0, 79)]);
    saveToFirestore('bk_logs', newLog);

    // Automatically push entry directly to Jurnal Harian
    autoPushToJournal({
      sourceType: 'summon_visit',
      date: visitDate,
      startTime: '09:00',
      endTime: '10:30',
      activityType: 'Konsultasi Orang Tua',
      title: `Kunjungan Rumah (Home Visit) - No: ${reportNumber}`,
      description: `Laporan Kunjungan Rumah ke kediaman ${selectedStudent.name} (${selectedStudent.class}). Alamat: ${address}. Ditemui: ${parentNameMet}. Tujuan: ${purpose}. Hasil: ${result}. Kesepakatan: ${agreement}`,
      target: `Siswa ${selectedStudent.name} (${selectedStudent.class}) & Ortu/Wali (${parentNameMet})`,
      status: 'Selesai',
      counselorId: activeCounselor.id,
      proofPhotoUrl: photoUrl,
      proofPhotoName: photoName
    });

    // Otomatis terbitkan & unduh dokumen PDF resmi Home Visit
    downloadHomeVisitPDF(newRecord);

    // Close form and reset fields
    setShowAddForm(false);
    resetFormFields();
  };

  const resetFormFields = () => {
    setSelectedStudentId('');
    setSelectedStudent(null);
    setStudentSearch('');
    setParentNameMet('');
    setVisitDate(new Date().toISOString().split('T')[0]);
    setBidangBimbingan('Pribadi');
    setAddress('');
    setPurpose('');
    setResult('');
    setAgreement('');
    setPhotoUrl(undefined);
    setPhotoName(undefined);
    setDriveFileId(undefined);
    setDriveViewUrl(undefined);
    setParentSignature(undefined);
    setCounselorSignature(undefined);
  };

  const handleDeleteVisit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Apakah Anda yakin ingin menghapus arsip bukti Home Visit ini?')) {
      registerDeletedId(id);
      deleteFromFirestore('bk_home_visits', id);
      setVisits(visits.filter((v) => v.id !== id));
      if (selectedVisit?.id === id) {
        setSelectedVisit(null);
      }
    }
  };

  // Filtered visits for main listing
  const filteredVisits = React.useMemo(() => {
    const counselorAllowedVisits = filterHomeVisits(visits, activeCounselor);
    const q = searchQuery.toLowerCase().trim();
    if (!q) return counselorAllowedVisits;
    return counselorAllowedVisits.filter((v) => {
      if (!v) return false;
      const sName = String(v.studentName || '').toLowerCase();
      const sNis = String(v.studentNis ?? '').toLowerCase();
      const sClass = String(v.studentClass || '').toLowerCase();
      const repNo = String(v.reportNumber || '').toLowerCase();
      const purposeText = String(v.purpose || '').toLowerCase();
      return (
        sName.includes(q) ||
        sNis.includes(q) ||
        sClass.includes(q) ||
        repNo.includes(q) ||
        purposeText.includes(q)
      );
    });
  }, [searchQuery, visits, activeCounselor]);

  // PDF Generator for Home Visit Record
  const handleDownloadPDF = (record: HomeVisitRecord) => {
    downloadHomeVisitPDF(record);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b1c30]">Dokumentasi Home Visit</h2>
          <p className="text-xs text-[#3d4947]/70 font-semibold mt-0.5">
            Manajemen laporan dan pencatatan kunjungan rumah (Home Visit) siswa untuk investigasi preventif bimbingan konseling.
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-97 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Bukti Home Visit</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait" initial={false}>
      {showAddForm ? (
        /* Form Bukti Home Visit Card */
        <motion.div
          key="homevisit-form"
          initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-md p-6 max-w-3xl mx-auto"
        >
          <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#eff4ff] rounded-xl text-[#00685f]">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#0b1c30] text-lg">Formulir Bukti Home Visit</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                  {getSchoolConfig().schoolName} • {getSchoolConfig().governmentName || 'Pemerintah Daerah'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowAddForm(false);
                resetFormFields();
              }}
              className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
              title="Batal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-5">
            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Autocomplete Student Search */}
              <div className="space-y-1.5 md:col-span-2 relative">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Cari & Pilih Siswa Target <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      setSelectedStudentId('');
                      setSelectedStudent(null);
                      setShowStudentDropdown(true);
                    }}
                    onFocus={() => setShowStudentDropdown(true)}
                    placeholder="Masukkan nama, NISN, atau kelas murid..."
                    className="w-full pl-3.5 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                    required
                  />
                  <Search className="w-4.5 h-4.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>

                {showStudentDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowStudentDropdown(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#bcc9c6]/40 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto custom-scrollbar">
                      {studentSuggestions.length > 0 ? (
                        studentSuggestions.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => handleSelectStudent(s)}
                            className="p-3 hover:bg-[#eff4ff]/60 cursor-pointer flex items-center justify-between border-b border-[#bcc9c6]/10 last:border-b-0 relative z-30"
                          >
                            <div>
                              <p className="text-xs font-bold text-[#0b1c30]">{s.name}</p>
                              <p className="text-[10px] text-gray-500 font-semibold">
                                NISN: {s.nis || '-'} | Kelas: {s.class || '-'}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold text-[#00685f] bg-[#e6fcf5] px-2 py-0.5 rounded">
                              Pilih
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-[#3d4947] opacity-60">
                          {studentSearch.trim() ? 'Siswa tidak ditemukan...' : 'Ketik nama siswa untuk mencari...'}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Selected student detail summary card inside form */}
                {selectedStudent && (
                  <div className="mt-2 p-3 bg-[#e6fcf5] border border-[#00685f]/20 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#00685f]">Siswa Terpilih:</p>
                      <p className="text-xs font-black text-[#0b1c30] mt-0.5">
                        {selectedStudent.name} ({selectedStudent.class})
                      </p>
                      <p className="text-[10px] text-gray-500 font-semibold">
                        NISN: {selectedStudent.nis || '-'} | Akumulasi Pelanggaran: {selectedStudent.violationPoints || 0} Poin
                      </p>
                    </div>
                    <span className="bg-[#00685f]/10 text-[#00685f] p-1.5 rounded-lg">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </span>
                  </div>
                )}
              </div>

              {/* Date of Visit */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Tanggal Kunjungan <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Bidang Bimbingan Standar SOP Dinas */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide flex items-center justify-between">
                  <span>Bidang Bimbingan <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-[#00685f] font-bold">SOP Dinas BK</span>
                </label>
                <select
                  value={bidangBimbingan}
                  onChange={(e) => setBidangBimbingan(e.target.value as BidangBimbinganType)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                >
                  {BIDANG_BIMBINGAN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Bidang {opt.label} — {opt.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Parent Name Met */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Nama Orang Tua / Wali yang Ditemui <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={parentNameMet}
                  onChange={(e) => setParentNameMet(e.target.value)}
                  placeholder="Contoh: Ibu Siti Aminah (Ibu Kandung)"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Visit Address */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Alamat Lengkap Kunjungan Rumah <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Masukkan alamat lengkap rumah yang dikunjungi..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f] resize-none"
                  required
                />
              </div>

              {/* Purpose / Objective */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Maksud & Tujuan Kunjungan <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Contoh: Konfirmasi ketidakhadiran siswa tanpa keterangan (Alpa) selama 4 hari berturut-turut serta mencari solusi..."
                  rows={2.5}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f] resize-none"
                  required
                />
              </div>

              {/* Findings / Results */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Hasil Kunjungan (Temuan Masalah / Kondisi Lapangan) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  placeholder="Contoh: Orang tua terkejut mengetahui siswa membolos, ternyata siswa pergi dari rumah namun tidak sampai ke sekolah karena masalah pergaulan..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f] resize-none"
                  required
                />
              </div>

              {/* Solusi / Agreement reached */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Kesepakatan / Tindak Lanjut Solusi <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={agreement}
                  onChange={(e) => setAgreement(e.target.value)}
                  placeholder="Contoh: Orang tua setuju mengantar langsung siswa sampai pintu gerbang sekolah, siswa bersedia dibina harian oleh Guru BK..."
                  rows={2.5}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f] resize-none"
                  required
                />
              </div>

              {/* ATTACHMENT PHOTO SECTION via Google Drive */}
              <div className="space-y-2 md:col-span-2">
                <GoogleDrivePhotoUploader
                  photoUrl={photoUrl}
                  photoName={photoName}
                  driveFileId={driveFileId}
                  driveViewUrl={driveViewUrl}
                  category="home_visit"
                  studentName={selectedStudent?.name}
                  date={visitDate}
                  label="Foto Bukti Home Visit (Google Drive API)"
                  description="Unggah foto atau potret langsung dari kamera. File disimpan otomatis ke folder Google Drive."
                  onPhotoChange={({ photoUrl, photoName, driveFileId, driveViewUrl }) => {
                    setPhotoUrl(photoUrl);
                    setPhotoName(photoName);
                    setDriveFileId(driveFileId);
                    setDriveViewUrl(driveViewUrl);
                  }}
                />
              </div>

              {/* DIGITAL SIGNATURES SECTION */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Tanda Tangan Elektronik (Touchscreen HP / Mouse)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SignaturePad
                    label="Tanda Tangan Orang Tua / Wali"
                    onChange={setParentSignature}
                  />
                  <SignaturePad
                    label="Tanda Tangan Guru BK / Konselor"
                    onChange={setCounselorSignature}
                  />
                </div>
              </div>

            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  resetFormFields();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-[#3d4947] transition-colors cursor-pointer"
              >
                Batal / Kembali
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Simpan & Terbitkan Laporan
              </button>
            </div>
          </form>
        </motion.div>
      ) : (
        /* Main Visits Listing Dashboard View */
        <motion.div
          key="homevisit-list"
          initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          
          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#bcc9c6]/30 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari arsip Home Visit berdasarkan nama siswa, kelas, NISN atau nomor laporan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl text-xs font-semibold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 placeholder:text-gray-400"
              />
            </div>

            <button
              onClick={() => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                const today = now.toISOString().split('T')[0];
                downloadRekapHomeVisitPDF({
                  startDate: firstDay,
                  endDate: today,
                  selectedClass: 'semua',
                  homeVisits: filteredVisits,
                  activeCounselor
                });
              }}
              className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-[#00685f] border border-teal-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap active:scale-97 shrink-0"
              title="Unduh Buku Register Rekapitulasi Home Visit Resmi (PDF)"
            >
              <Download className="w-4 h-4" />
              <span>Cetak Rekap Home Visit (PDF)</span>
            </button>
          </div>

          {/* Records Display Grid */}
          {filteredVisits.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVisits.map((v) => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVisit(v)}
                  className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] bg-teal-50 text-[#00685f] font-extrabold px-2.5 py-1 rounded-lg border border-[#00685f]/10">
                          {v.reportNumber}
                        </span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-200/60">
                          Bidang {v.bidangBimbingan || 'Pribadi'}
                        </span>
                      </div>
                      <span className="text-[9px] text-gray-400 font-bold">
                        {v.date}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-[#0b1c30] text-sm truncate">
                        {v.studentName}
                      </h4>
                      <p className="text-[11px] text-gray-500 font-semibold">
                        Kelas: {v.studentClass || '-'} | NISN: {v.studentNis || '-'}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2.5 rounded-xl border border-[#bcc9c6]/10 space-y-1">
                      <p className="text-[10px] text-[#3d4947] font-bold uppercase tracking-wider">
                        Masalah/Tujuan:
                      </p>
                      <p className="text-xs text-[#3d4947]/90 font-medium line-clamp-2">
                        {v.purpose}
                      </p>
                    </div>

                    {v.photoUrl && (
                      <div className="flex items-center gap-1.5 text-[#00685f] text-[10px] font-bold">
                        <Camera className="w-3.5 h-3.5" />
                        <span>Ada Lampiran Foto</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#bcc9c6]/10 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-bold">
                      Oleh: {v.counselorName}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPDF(v);
                        }}
                        className="p-1.5 bg-[#eff4ff] text-[#00685f] hover:bg-[#00685f] hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Unduh PDF Laporan Resmi"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteVisit(v.id, e)}
                        className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Hapus Laporan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="bg-white rounded-2xl p-16 text-center border border-[#bcc9c6]/30 shadow-sm max-w-md mx-auto">
              <div className="p-4 bg-teal-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Home className="w-8 h-8 text-[#00685f]" />
              </div>
              <h3 className="font-extrabold text-[#0b1c30] text-base">Arsip Home Visit Kosong</h3>
              <p className="text-xs text-gray-500 font-semibold mt-1">
                {searchQuery.trim() 
                  ? 'Tidak ada arsip Home Visit yang cocok dengan kata pencarian Anda.' 
                  : 'Belum ada arsip pelaksanaan Home Visit yang dilaporkan untuk saat ini.'}
              </p>
              {searchQuery.trim() && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-4 px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Setel Ulang Pencarian
                </button>
              )}
            </div>
          )}

        </motion.div>
      )}
      </AnimatePresence>

      {/* Detail Laporan Modal overlay */}
      {selectedVisit && (
        <div className="fixed inset-0 bg-[#0b1c30]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl border border-gray-100 relative animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] custom-scrollbar">
            
            <button
              onClick={() => setSelectedVisit(null)}
              className="absolute top-5 right-5 p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
              <div className="p-2 bg-teal-50 rounded-xl text-[#00685f]">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-[#0b1c30] text-base">Bukti Hasil Kunjungan Rumah</h4>
                <p className="text-[10px] text-[#00685f] font-black uppercase tracking-wider mt-0.5">
                  No Dokumen: {selectedVisit.reportNumber}
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-xs">
              
              {/* Student Metadata Card */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 border border-[#bcc9c6]/25 rounded-2xl">
                <div>
                  <span className="block text-[10px] text-gray-400 font-extrabold uppercase tracking-wide">Nama Siswa:</span>
                  <span className="font-extrabold text-[#0b1c30] text-sm block mt-0.5">{selectedVisit.studentName}</span>
                  <span className="text-[10px] text-gray-500 font-semibold block">NISN: {selectedVisit.studentNis || '-'} | Kelas {selectedVisit.studentClass || '-'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-extrabold uppercase tracking-wide">Wali yang Ditemui:</span>
                  <span className="font-extrabold text-[#0b1c30] text-sm block mt-0.5">{selectedVisit.parentNameMet}</span>
                  <span className="text-[10px] text-gray-500 font-semibold block">Kabupaten Semarang</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[10px] text-gray-400 font-extrabold uppercase tracking-wide">Alamat Kunjungan:</span>
                  <span className="font-semibold text-gray-700 block mt-0.5 leading-relaxed">{selectedVisit.address}</span>
                </div>
              </div>

              {/* Home Visit Details */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <span className="text-gray-400 font-extrabold block uppercase text-[9px] tracking-wide">Tanggal Kunjungan:</span>
                    <span className="font-bold text-gray-800 block mt-1">{selectedVisit.date}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-extrabold block uppercase text-[9px] tracking-wide">Bidang Bimbingan:</span>
                    <span className="font-bold text-[#00685f] block mt-1">
                      {selectedVisit.bidangBimbingan ? `Bidang ${selectedVisit.bidangBimbingan}` : 'Bidang Pribadi'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-extrabold block uppercase text-[9px] tracking-wide">Petugas Pelaksana BK:</span>
                    <span className="font-bold text-gray-800 block mt-1">{selectedVisit.counselorName}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[#0b1c30] font-black block uppercase text-[9px] tracking-wider">Maksud / Permasalahan:</span>
                  <p className="bg-gray-50/70 p-3 rounded-xl border border-gray-200/50 leading-relaxed text-gray-700 font-medium whitespace-pre-line">
                    {selectedVisit.purpose}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[#0b1c30] font-black block uppercase text-[9px] tracking-wider">Hasil Temuan Masalah:</span>
                  <p className="bg-gray-50/70 p-3 rounded-xl border border-gray-200/50 leading-relaxed text-gray-700 font-medium whitespace-pre-line">
                    {selectedVisit.result}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[#0b1c30] font-black block uppercase text-[9px] tracking-wider">Kesepakatan / Solusi Tindak Lanjut:</span>
                  <p className="bg-gray-50/70 p-3 rounded-xl border border-gray-200/50 leading-relaxed text-gray-700 font-medium whitespace-pre-line">
                    {selectedVisit.agreement}
                  </p>
                </div>

                {/* Photo Documentation attached display */}
                {selectedVisit.photoUrl && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[#0b1c30] font-black block uppercase text-[9px] tracking-wider flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-[#00685f]" />
                        Lampiran Foto Bukti Lapangan:
                      </span>
                      {selectedVisit.driveViewUrl && (
                        <a
                          href={selectedVisit.driveViewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-[#00685f] hover:underline font-bold flex items-center gap-1"
                        >
                          Buka di Google Drive ↗
                        </a>
                      )}
                    </div>
                    <div className="relative aspect-video max-w-sm rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                      <img
                        src={selectedVisit.photoUrl}
                        alt="Bukti Home Visit"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                )}

                {/* Signatures display */}
                {(selectedVisit.parentSignature || selectedVisit.counselorSignature) && (
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                    {selectedVisit.parentSignature && (
                      <div className="space-y-1">
                        <span className="text-gray-400 font-extrabold block uppercase text-[9px] tracking-wide">
                          TTD Orang Tua / Wali:
                        </span>
                        <div className="border border-gray-200 rounded-xl bg-white p-2 flex justify-center h-20">
                          <img
                            src={selectedVisit.parentSignature}
                            alt="Tanda Tangan Wali"
                            className="h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    )}
                    {selectedVisit.counselorSignature && (
                      <div className="space-y-1">
                        <span className="text-gray-400 font-extrabold block uppercase text-[9px] tracking-wide">
                          TTD Guru BK / Konselor:
                        </span>
                        <div className="border border-gray-200 rounded-xl bg-white p-2 flex justify-center h-20">
                          <img
                            src={selectedVisit.counselorSignature}
                            alt="Tanda Tangan Guru"
                            className="h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action trigger button inside detail */}
              <div className="flex gap-2.5 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setSelectedVisit(null)}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-[#3d4947] hover:bg-gray-50 font-bold text-xs cursor-pointer"
                >
                  Tutup Rincian
                </button>
                <button
                  onClick={() => handleDownloadPDF(selectedVisit)}
                  className="flex-1 py-2 bg-[#00685f] text-white hover:bg-[#005049] rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Rapor Bukti (PDF)</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
