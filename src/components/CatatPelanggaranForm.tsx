import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Filter,
  Mail,
  Send,
  CheckCircle,
  Camera,
  ImageIcon,
  AlertCircle,
  X
} from 'lucide-react';
import { downloadViolationPDF } from '../utils/pdfGenerator';

interface ViolationOption {
  id: string;
  label: string;
  points: number;
}

interface ViolationCategory {
  id: string;
  name: string;
  options: ViolationOption[];
}

const VIOLATION_CATEGORIES: ViolationCategory[] = [
  {
    id: 'kedisiplinan',
    name: 'Kedisiplinan & Ketertiban',
    options: [
      { id: 'k1', label: 'Terlambat masuk sekolah', points: 5 },
      { id: 'k2', label: 'Membolos pelajaran / meninggalkan kelas tanpa izin', points: 15 },
      { id: 'k3', label: 'Membolos sekolah / tidak masuk tanpa keterangan (alpa)', points: 20 },
      { id: 'k4', label: 'Keluar lingkungan sekolah saat jam istirahat / pelajaran tanpa izin', points: 10 },
      { id: 'k5', label: 'Membawa gawai / smartphone non-edukasi tanpa izin guru', points: 15 },
      { id: 'k6', label: 'Tidak mengikuti upacara bendera hari Senin / kegiatan wajib', points: 10 },
      { id: 'k7', label: 'Membawa barang yang mengganggu ketertiban (mainan, kartu, dll)', points: 10 },
    ]
  },
  {
    id: 'kerapian',
    name: 'Kerapian & Atribut Seragam',
    options: [
      { id: 'a1', label: 'Seragam tidak lengkap / tidak sesuai hari / atribut tidak ada', points: 5 },
      { id: 'a2', label: 'Pakaian dikeluarkan / tidak rapi / tidak memakai ikat pinggang hitam', points: 5 },
      { id: 'a3', label: 'Rambut gondrong / dicat / potongan tidak rapi (siswa putra)', points: 10 },
      { id: 'a4', label: 'Memakai perhiasan berlebihan / aksesoris tidak pantas ke sekolah', points: 5 },
      { id: 'a5', label: 'Kuku panjang / dicat warna-warni', points: 5 },
      { id: 'a6', label: 'Menggunakan sepatu atau kaos kaki tidak sesuai ketentuan', points: 5 },
      { id: 'a7', label: 'Menggunakan make-up / kosmetik berlebihan', points: 5 },
    ]
  },
  {
    id: 'perilaku',
    name: 'Perilaku & Etika / Karakter',
    options: [
      { id: 'p1', label: 'Tidak sopan / menentang / berkata kasar kepada Guru atau Staf sekolah', points: 25 },
      { id: 'p2', label: 'Membuat kegaduhan / mengganggu jalannya proses pembelajaran', points: 10 },
      { id: 'p3', label: 'Merusak fasilitas / sarana prasarana sekolah secara sengaja', points: 30 },
      { id: 'p4', label: 'Melakukan perundungan verbal (bullying), ejekan SARA, atau intimidasi', points: 25 },
      { id: 'p5', label: 'Berpacaran berlebihan atau berdua-duaan di tempat sepi lingkungan sekolah', points: 20 },
      { id: 'p6', label: 'Mencoret-coret meja, dinding, kursi, atau buku perpustakaan (vandalism)', points: 10 },
      { id: 'p7', label: 'Membawa / mengonsumsi rokok elektrik (vape) / rokok biasa di luar sekolah memakai seragam', points: 30 },
    ]
  },
  {
    id: 'akademik',
    name: 'Akademik & Integritas',
    options: [
      { id: 'ak1', label: 'Menyontek saat ujian harian, tengah semester, atau akhir semester', points: 25 },
      { id: 'ak2', label: 'Melakukan plagiasi / menyalin tugas atau PR teman', points: 10 },
      { id: 'ak3', label: 'Tidak mengerjakan tugas / pekerjaan rumah (PR) berulang kali', points: 10 },
      { id: 'ak4', label: 'Memalsukan tanda tangan orang tua, wali kelas, atau guru mata pelajaran', points: 30 },
      { id: 'ak5', label: 'Mengubah nilai rapor / lembar jawaban secara ilegal', points: 50 },
    ]
  },
  {
    id: 'berat',
    name: 'Pelanggaran Berat & Hukum',
    options: [
      { id: 'b1', label: 'Melakukan perundungan fisik (physical bullying) atau kekerasan', points: 50 },
      { id: 'b2', label: 'Melakukan pemalakan / pemerasan uang atau barang kepada teman', points: 40 },
      { id: 'b3', label: 'Membawa, menyimpan, atau menghisap rokok di lingkungan sekolah', points: 50 },
      { id: 'b4', label: 'Membawa, menyimpan, atau menyebarkan konten pornografi', points: 75 },
      { id: 'b5', label: 'Membawa senjata tajam, senjata api, atau barang berbahaya lainnya', points: 100 },
      { id: 'b6', label: 'Terlibat pencurian barang milik sekolah, guru, karyawan, atau sesama siswa', points: 75 },
      { id: 'b7', label: 'Membawa, mengonsumsi, atau mengedarkan narkoba, miras, atau obat terlarang', points: 100 },
      { id: 'b8', label: 'Terlibat perkelahian massal (tawuran) antar kelas atau antar sekolah', points: 100 },
    ]
  }
];

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
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [customViolationLabel, setCustomViolationLabel] = useState<string>('');
  const [pointsAdded, setPointsAdded] = useState(0);
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [handledBy, setHandledBy] = useState<'Belum Ditangani' | 'Wali Kelas' | 'Guru BK' | 'Wali Kelas & Guru BK'>('Belum Ditangani');
  const [handlingProgress, setHandlingProgress] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState<{
    to: string;
    subject: string;
    body: string;
    triggerPoints: number;
    severity: 'TAHAP I' | 'TAHAP II (SIAGA)' | 'TAHAP III (KRITIS)';
  } | null>(null);

  // Verification Proof Photo states & camera setup
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string | undefined>(undefined);
  const [proofPhotoName, setProofPhotoName] = useState<string | undefined>(undefined);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Auto clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async () => {
    setShowCamera(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Gagal mengakses kamera. Pastikan izin kamera diberikan.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setProofPhotoUrl(dataUrl);
        setProofPhotoName(`Kamera_${new Date().toISOString().slice(0,10)}_${Math.floor(Math.random() * 1000)}.jpg`);
        stopCamera();
      }
    } catch (err) {
      console.error('Capture error:', err);
      setCameraError('Gagal mengambil gambar dari kamera.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setProofPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setProofPhotoUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Derived violation category string matching existing fields
  const violationCategory = useMemo(() => {
    const categoryObj = VIOLATION_CATEGORIES.find(c => c.id === selectedCategory);
    const optionObj = categoryObj?.options.find(o => o.id === selectedOptionId);
    
    if (categoryObj) {
      if (selectedOptionId === 'other') {
        return `${categoryObj.name}: ${customViolationLabel.trim() || 'Pelanggaran Lainnya'}`;
      } else if (optionObj) {
        return `${categoryObj.name}: ${optionObj.label}`;
      } else {
        return categoryObj.name;
      }
    }
    return '';
  }, [selectedCategory, selectedOptionId, customViolationLabel]);

  // Auto Ticket ID generation
  const ticketId = useMemo(() => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    const year = new Date().getFullYear();
    return `PLG-${year}-${randomNum}`;
  }, []);

  // Load wali kelas config from localStorage
  const waliKelasConfig = useMemo(() => {
    const saved = localStorage.getItem('bk_walikelas_config');
    if (saved) {
      try {
        return JSON.parse(saved) as { class: string; name: string; email: string }[];
      } catch (e) {
        return [];
      }
    }
    return [];
  }, []);

  const currentWaliKelas = useMemo(() => {
    if (!selectedStudent) return null;
    
    // Normalize student class name (e.g. "Kelas 8A" -> "8A", "Kelas 7A" -> "7A")
    const sClass = selectedStudent.class.trim();
    const cleanClass = sClass.replace(/kelas\s*/i, '').trim();
    
    // Find exact match or normalized match
    const found = waliKelasConfig.find(item => 
      item.class.trim().toLowerCase() === sClass.toLowerCase() ||
      item.class.trim().toLowerCase() === cleanClass.toLowerCase() ||
      item.class.trim().toLowerCase().replace(/kelas\s*/i, '').trim() === cleanClass.toLowerCase()
    );
    
    if (found) return found;

    // Default presets matching our predefined ones if not configured
    const classCode = cleanClass.toLowerCase().replace(/\s+/g, '');
    return {
      class: sClass,
      name: 'Wali Kelas ' + cleanClass,
      email: `wali.kelas.${classCode}@smpn2susukan.sch.id`
    };
  }, [selectedStudent, waliKelasConfig]);

  const emailThreshold = useMemo(() => {
    const saved = localStorage.getItem('bk_email_threshold');
    if (saved) {
      const parsed = parseInt(saved);
      if (!isNaN(parsed)) return parsed;
    }
    return 20; // default to 20
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

  // Handle selected violation category points dynamically based on detailed selections
  useEffect(() => {
    if (!selectedCategory) {
      setPointsAdded(0);
      setSelectedOptionId('');
      setCustomViolationLabel('');
      return;
    }
    
    const categoryObj = VIOLATION_CATEGORIES.find(c => c.id === selectedCategory);
    if (!categoryObj) return;

    if (selectedOptionId === 'other') {
      // Set a default pointsAdded value if currently 0
      if (pointsAdded <= 0) {
        setPointsAdded(5);
      }
    } else {
      const optionObj = categoryObj.options.find(o => o.id === selectedOptionId);
      if (optionObj) {
        setPointsAdded(optionObj.points);
      } else {
        setPointsAdded(0);
      }
    }
  }, [selectedCategory, selectedOptionId]);

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

  const handleConfirmEmailAndSave = () => {
    if (!selectedStudent) return;
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
      proofPhotoUrl,
      proofPhotoName,
    });
    setShowEmailModal(false);
  };

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

    const classCode = selectedStudent.class.toLowerCase().replace(/kelas\s*/g, '').replace(/\s+/g, '');
    const waliEmail = currentWaliKelas?.email || `wali.kelas.${classCode}@smpn2susukan.sch.id`;
    const waliName = currentWaliKelas?.name || `Bapak/Ibu Wali Kelas ${selectedStudent.class}`;

    if (projectedPoints >= emailThreshold) {
      // Trigger automatic email notice to Homeroom Teacher (Wali Kelas)
      let severityLevel: 'TAHAP I' | 'TAHAP II (SIAGA)' | 'TAHAP III (KRITIS)' = 'TAHAP I';
      let actionRecommendation = '';
      
      if (projectedPoints >= 75) {
        severityLevel = 'TAHAP III (KRITIS)';
        actionRecommendation = 'Berdasarkan Peraturan Tata Tertib Sekolah, siswa ini telah melebihi batas 75 poin. Kasus WAJIB beralih dari Guru BK ke Sidang Dewan Guru, dewan kehormatan sekolah, serta koordinasi langsung dengan Kepala Sekolah untuk tindak lanjut skorsing berat / penyerahan kembali ke orang tua.';
      } else if (projectedPoints >= 50) {
        severityLevel = 'TAHAP II (SIAGA)';
        actionRecommendation = 'Siswa telah menyentuh batas 50 poin pelanggaran. Guru BK dan Wali Kelas wajib segera mengagendakan Panggilan Orang Tua ke-I ke sekolah guna penandatanganan kontrak perilaku tertulis bermeterai.';
      } else {
        severityLevel = 'TAHAP I';
        actionRecommendation = `Siswa menyentuh akumulasi >= ${emailThreshold} poin. Sebagai Wali Kelas, mohon jadwalkan pembinaan persuasif langsung tingkat kelas, diskusi internal bersama siswa, serta catat dalam jurnal wali kelas.`;
      }

      setEmailData({
        to: waliEmail,
        subject: `[ALERTI BK] Akumulasi Poin Pelanggaran Tinggi: ${selectedStudent.name} (${selectedStudent.class}) mencapai ${projectedPoints} Poin`,
        body: `Yth. ${waliName},

Melalui surat elektronik sistem BK otomatis ini, kami memberitahukan bahwa salah satu siswa bimbingan Anda di kelas:

- Nama: ${selectedStudent.name}
- NISN: ${selectedStudent.nis}
- Kelas: ${selectedStudent.class}

Telah dilaporkan melakukan pelanggaran kedisiplinan terbaru:
"${violationCategory}" (+${pointsAdded} Poin) pada ${incidentDate} pukul ${incidentTime} WIB.

Dengan demikian, akumulasi poin pelanggaran siswa kini telah menyentuh: ${projectedPoints} POIN (Ambang batas eskalasi: ${severityLevel}).

REKOMENDASI TINDAKAN:
${actionRecommendation}

Mohon segera berkoordinasi dengan Guru BK pengampu untuk menyelaraskan pembinaan siswa yang bersangkutan.

Hormat kami,
Unit Administrasi BK & Layanan Kesiswaan
SMP Negeri 2 Susukan`,
        triggerPoints: projectedPoints,
        severity: severityLevel,
      });

      setShowEmailModal(true);
    } else {
      // Small accumulation: solved inside class by Wali Kelas, no automatic email dialog required
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
        handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy, // Auto mark as resolved by Homeroom Teacher as points are low
        handlingProgress: handledBy === 'Belum Ditangani' ? 'Teguran persuasif & pembinaan tingkat kelas oleh Wali Kelas.' : handlingProgress,
        proofPhotoUrl,
        proofPhotoName,
      });
      alert(`Laporan berhasil disimpan. Karena akumulasi masih rendah (${projectedPoints} Poin), kasus cukup diselesaikan oleh Wali Kelas.`);
    }
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
                        {v.proofPhotoUrl && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <img
                              src={v.proofPhotoUrl}
                              alt="Bukti Foto"
                              className="w-7 h-7 rounded object-cover border border-gray-200 shadow-xs"
                              referrerPolicy="no-referrer"
                            />
                            <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">Foto Bukti</span>
                          </div>
                        )}
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

                {/* 1. Kategori Pelanggaran (Main Category Selection) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
                    <span>Kategori Utama Pelanggaran</span>
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setSelectedOptionId('');
                      setCustomViolationLabel('');
                    }}
                    required
                    className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
                  >
                    <option value="">Pilih Kategori Utama...</option>
                    {VIOLATION_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Pilihan Pelanggaran Spesifik (Specific Violation Options) */}
                {selectedCategory && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                    <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                      <ChevronRight className="w-4.5 h-4.5 text-[#00685f]" />
                      <span>Bentuk / Pilihan Pelanggaran Spesifik</span>
                    </label>
                    <select
                      value={selectedOptionId}
                      onChange={(e) => setSelectedOptionId(e.target.value)}
                      required
                      className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
                    >
                      <option value="">Pilih Bentuk Pelanggaran...</option>
                      {VIOLATION_CATEGORIES.find(c => c.id === selectedCategory)?.options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} ({opt.points} Poin)
                        </option>
                      ))}
                      <option value="other">Pelanggaran Lainnya (Tulis Manual &amp; Tentukan Poin)</option>
                    </select>
                  </div>
                )}

                {/* 3. Custom / Manual inputs for Custom Violation and Points */}
                {selectedCategory && selectedOptionId === 'other' && (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-orange-50/50 rounded-2xl border border-orange-200/60 animate-in slide-in-from-top-2 duration-300">
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-orange-800">
                        Nama / Deskripsi Pelanggaran Kustom
                      </label>
                      <input
                        type="text"
                        value={customViolationLabel}
                        onChange={(e) => setCustomViolationLabel(e.target.value)}
                        placeholder="Contoh: Menggambar graffiti tidak senonoh di perpustakaan..."
                        required
                        className="w-full bg-white border border-orange-300/65 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-orange-800">
                        Bobot Poin Pelanggaran
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={pointsAdded}
                        onChange={(e) => setPointsAdded(Math.max(1, parseInt(e.target.value) || 0))}
                        required
                        className="w-full bg-white border border-orange-300/65 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs"
                      />
                    </div>
                  </div>
                )}
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

              {/* Foto Bukti Pelanggaran (Kamera HP / Upload File) */}
              <div className="space-y-2 border-t border-[#bcc9c6]/10 pt-4">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-[#00685f]" />
                  <span>Bukti Foto Kejadian / Fisik (Opsional)</span>
                </label>
                <p className="text-[11px] text-gray-500 leading-normal font-semibold">
                  Ambil foto langsung sebagai bukti valid menggunakan kamera HP/laptop Anda atau unggah file foto dari penyimpanan.
                </p>

                {proofPhotoUrl ? (
                  <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 p-3 max-w-sm text-center">
                    <img
                      src={proofPhotoUrl}
                      alt="Bukti Foto Pelanggaran"
                      className="max-h-48 mx-auto object-contain rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                    <p className="text-[10px] text-gray-500 truncate mt-2 font-bold">
                      {proofPhotoName}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setProofPhotoUrl(undefined);
                        setProofPhotoName(undefined);
                      }}
                      className="absolute top-2.5 right-2.5 bg-red-600 text-white hover:bg-red-700 p-1.5 rounded-full shadow-md cursor-pointer transition-colors"
                      title="Hapus Foto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="max-w-md">
                    {showCamera ? (
                      <div className="relative bg-black rounded-xl overflow-hidden border border-gray-300">
                        {cameraError ? (
                          <div className="p-4 text-center text-xs text-red-600 font-semibold">
                            <AlertCircle className="w-6 h-6 mx-auto text-red-600 mb-1" />
                            <p>{cameraError}</p>
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="mt-2 px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-[10px] cursor-pointer"
                            >
                              Tutup Kamera
                            </button>
                          </div>
                        ) : (
                          <>
                            <video
                              ref={videoRef}
                              playsInline
                              className="w-full h-56 object-cover"
                            />
                            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-2 px-4">
                              <button
                                type="button"
                                onClick={capturePhoto}
                                className="bg-[#00685f] hover:bg-[#005049] text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                              >
                                <Camera className="w-4 h-4" /> Ambil Foto
                              </button>
                              <button
                                type="button"
                                onClick={stopCamera}
                                className="bg-gray-800/80 hover:bg-gray-900 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-md cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="flex flex-col items-center justify-center p-5 border border-dashed border-[#bcc9c6]/60 bg-[#f8f9ff] rounded-xl hover:bg-gray-50 hover:border-[#00685f]/80 transition-all cursor-pointer text-center"
                        >
                          <Camera className="w-6 h-6 text-[#00685f] mb-1.5" />
                          <span className="text-xs font-bold text-[#0b1c30]">Gunakan Kamera</span>
                        </button>

                        <label className="flex flex-col items-center justify-center p-5 border border-dashed border-[#bcc9c6]/60 bg-[#f8f9ff] rounded-xl hover:bg-gray-50 hover:border-[#00685f]/80 transition-all cursor-pointer text-center">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProofFileChange}
                            className="sr-only"
                          />
                          <ImageIcon className="w-6 h-6 text-[#6b38d4] mb-1.5" />
                          <span className="text-xs font-bold text-[#0b1c30]">Unggah Foto</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
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

      {/* AUTOMATED EMAIL NOTIFICATION SIMULATOR MODAL */}
      {showEmailModal && emailData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#00685f] to-[#004e47] px-6 py-4.5 text-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <Mail className="w-5 h-5 text-teal-200 animate-pulse" />
                <div>
                  <h3 className="text-sm font-extrabold tracking-tight uppercase">
                    Notifikasi Email BK Otomatis Terpicu!
                  </h3>
                  <p className="text-[10px] text-teal-100 font-semibold opacity-90">
                    Batas Poin Akumulasi Tinggi Terlampaui ({emailData.triggerPoints} Poin)
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                emailData.severity === 'TAHAP III (KRITIS)' 
                  ? 'bg-red-500/20 text-red-100 border-red-400' 
                  : emailData.severity === 'TAHAP II (SIAGA)' 
                    ? 'bg-amber-500/20 text-amber-100 border-amber-400'
                    : 'bg-teal-500/20 text-teal-100 border-teal-400'
              }`}>
                {emailData.severity}
              </span>
            </div>

            {/* Email Client Layout Container */}
            <div className="p-6 space-y-4 bg-[#f8f9ff]">
              <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs space-y-3">
                {/* Meta Fields */}
                <div className="grid grid-cols-1 gap-2 text-xs border-b border-gray-100 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                    <span className="font-bold text-gray-500 w-16">Dari:</span>
                    <span className="font-mono text-gray-800 bg-gray-100 px-2 py-0.5 rounded border border-gray-200/60 text-[11px] inline-block font-semibold">
                      bk.smpn2susukan@sch.id <span className="text-gray-400">&lt;Sistem BK Otomatis&gt;</span>
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                    <span className="font-bold text-gray-500 w-16">Kepada:</span>
                    <span className="font-mono text-[#00685f] bg-teal-50 px-2 py-0.5 rounded border border-teal-100 text-[11px] inline-block font-extrabold">
                      {emailData.to} <span className="text-teal-600/70">&lt;Wali Kelas Siswa&gt;</span>
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 pt-1">
                    <span className="font-bold text-gray-500 w-16 flex-shrink-0">Subjek:</span>
                    <span className="font-extrabold text-gray-900 leading-snug">
                      {emailData.subject}
                    </span>
                  </div>
                </div>

                {/* Email Body text content container */}
                <div className="space-y-1 bg-gray-50 rounded-lg p-3.5 border border-gray-100">
                  <pre className="font-sans text-xs text-gray-700 whitespace-pre-wrap leading-relaxed select-text">
                    {emailData.body}
                  </pre>
                </div>
              </div>

              {/* Status Notice Indicator */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200/50 rounded-xl flex gap-2.5 items-start">
                <Info className="w-4.5 h-4.5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-800 font-semibold leading-relaxed">
                  <strong>Informasi Log:</strong> Berdasarkan peraturan kesiswaan, akumulasi poin siswa yang tinggi ({emailData.triggerPoints} Poin) secara otomatis memicu pengiriman surat pemberitahuan kesiswaan ini ke Wali Kelas untuk memastikan kolaborasi penanganan berkelanjutan.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3.5 justify-end">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="px-4.5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Batal / Perbaiki Data
              </button>
              <button
                type="button"
                onClick={handleConfirmEmailAndSave}
                className="px-6 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-97 flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim Notifikasi &amp; Simpan Pelanggaran</span>
              </button>
            </div>
          </div>
        </div>
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
