import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { Student, ViolationRecord, CounselingService, Counselor, StudentAchievement } from '../types';
import { addToGoogleCalendar } from '../utils/calendarSync';
import {
  UserPlus,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  PlusCircle,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  BookOpen,
  User,
  HeartHandshake,
  UserCheck,
  Upload,
  FileSpreadsheet,
  Download,
  Mail,
  Award,
  Sparkles,
  ThumbsUp,
  CheckCircle2,
  Printer,
  Brain
} from 'lucide-react';
import { downloadViolationPDF, downloadServicePDF, downloadStudentRecapPDF, getSchoolConfig } from '../utils/pdfGenerator';
import { APPRECIATION_TEMPLATES, AppreciationCategory, AppreciationOption } from '../data/appreciationTemplates';
import { getNormalizedClassKey, defaultWaliKelasList } from '../utils/classNormalizer';
import BehavioralDiagnosisModal from './BehavioralDiagnosisModal';
import EmailNotificationModal from './EmailNotificationModal';

interface DataSiswaViewProps {
  students: Student[];
  violations: ViolationRecord[];
  services: CounselingService[];
  achievements?: StudentAchievement[];
  onSaveAchievement?: (achievement: Omit<StudentAchievement, 'id'>) => void;
  onDeleteViolation?: (id: string) => void;
  onUpdateViolation?: (updated: ViolationRecord) => void;
  onDeleteService?: (id: string) => void;
  onUpdateService?: (updated: CounselingService) => void;
  onDeleteAchievement?: (id: string) => void;
  onUpdateAchievement?: (updated: any) => void;
  activeCounselor: Counselor;
  onAddStudent: (student: Omit<Student, 'id' | 'initials'>) => void;
  onUpdateStudent?: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onClearAllStudents?: () => void;
  onNavigateToForm: (form: string, selectStudentId: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function DataSiswaView({
  students,
  violations,
  services,
  achievements = [],
  onSaveAchievement,
  onDeleteViolation,
  onUpdateViolation,
  onDeleteService,
  onUpdateService,
  onDeleteAchievement,
  onUpdateAchievement,
  activeCounselor,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onClearAllStudents,
  onNavigateToForm,
  searchQuery,
  setSearchQuery,
}: DataSiswaViewProps) {
  // Filters & Sorting state
  const [filterClass, setFilterClass] = useState('Semua Kelas');
  const [filterGender, setFilterGender] = useState<'Semua' | 'L' | 'P'>('Semua');
  const [filterDisciplineStatus, setFilterDisciplineStatus] = useState<'semua' | 'prima' | 'pendampingan' | 'kritis' | 'apresiasi'>('semua');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'points-desc' | 'achievements-desc' | 'services-desc'>('name-asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Virtual scroll & continuous scroll state (no pagination per request)
  const [isVirtualScroll, setIsVirtualScroll] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setImportText(text);
      }
    };
    reader.readAsText(file);
  };

  // Bulk import parser
  const [bypassClassCheck, setBypassClassCheck] = useState(true);

  const parsedImportStudents = useMemo(() => {
    if (!importText.trim()) return [];
    const lines = importText.split(/\r?\n/);
    const result: Array<{ nis: string; name: string; class: string; gender: 'L' | 'P'; error?: string }> = [];
    
    // Auto-generate a sequential NISN base to avoid completely empty values
    let autoNisCounter = 26000001 + Math.floor(Math.random() * 10000);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip headers
      const lineLower = line.toLowerCase();
      if (
        (lineLower.includes('nis') && lineLower.includes('nama')) ||
        lineLower.includes('nama siswa') ||
        lineLower.includes('nama,kelas')
      ) {
        continue;
      }

      // Detect separator: tab, semicolon, or comma
      let cols: string[] = [];
      if (line.includes('\t')) {
        cols = line.split('\t');
      } else if (line.includes(';')) {
        cols = line.split(';');
      } else if (line.includes(',')) {
        cols = line.split(',');
      } else {
        // Space separated line, e.g. "9056 STEVIE GABRILLIA ELFINA 12A P"
        cols = line.split(/\s+/);
      }

      // Filter empty columns and trim
      cols = cols.map(c => c.trim()).filter(Boolean);
      if (cols.length === 0) continue;

      let nis = '';
      let name = '';
      let rawClass = '';
      let rawGender = '';

      if (cols.length === 1) {
        name = cols[0];
        nis = String(autoNisCounter++);
        rawClass = '7A';
        rawGender = 'L';
      } else {
        // Check if first col is pure NISN digits
        const isFirstColNis = /^\d+$/.test(cols[0]) && cols[0].length >= 3;
        
        if (isFirstColNis) {
          nis = cols[0];
          // Rest of cols: [1..len-1]
          const rest = cols.slice(1);
          // Check if last token is Gender (L/P)
          const lastToken = rest[rest.length - 1]?.toUpperCase() || '';
          if (lastToken === 'L' || lastToken === 'P' || lastToken.includes('PEREMPUAN') || lastToken.includes('LAKI')) {
            rawGender = lastToken;
            rest.pop();
          } else {
            rawGender = 'L';
          }
          // Check if new last token is Class (e.g. 12A, 12B, 7A, 8B, Kelas 7A)
          const newLastToken = rest[rest.length - 1] || '';
          if (/^(\d+|kelas|[A-Z])/.test(newLastToken) || /\d/.test(newLastToken)) {
            rawClass = newLastToken;
            rest.pop();
          } else {
            rawClass = '7A';
          }
          name = rest.join(' ');
        } else {
          // First col is name or text
          nis = String(autoNisCounter++);
          // Check if last token is Gender
          const lastToken = cols[cols.length - 1]?.toUpperCase() || '';
          if (lastToken === 'L' || lastToken === 'P' || lastToken.includes('PEREMPUAN') || lastToken.includes('LAKI')) {
            rawGender = lastToken;
            cols.pop();
          } else {
            rawGender = 'L';
          }
          // Check if new last token is Class
          const newLastToken = cols[cols.length - 1] || '';
          if (/^(\d+|kelas|[A-Z])/.test(newLastToken) || /\d/.test(newLastToken)) {
            rawClass = newLastToken;
            cols.pop();
          } else {
            rawClass = '7A';
          }
          name = cols.join(' ');
        }
      }

      // Clean rawClass (e.g. "Kelas 12B" -> "12B")
      let cleanClass = rawClass.trim();
      if (!cleanClass) cleanClass = '7A';

      if (!name.trim()) {
        result.push({ nis, name: '', class: cleanClass, gender: 'L', error: 'Nama kosong atau tidak terbaca' });
        continue;
      }

      // Map gender
      let gender: 'L' | 'P' = 'L';
      const gLower = rawGender.toLowerCase();
      if (gLower === 'p' || gLower.includes('perempuan') || gLower.includes('female') || gLower === 'w' || gLower.includes('wanita')) {
        gender = 'P';
      }

      // Validate class matches counselor's ampu classes (if enabled)
      if (!bypassClassCheck && activeCounselor && activeCounselor.allowedClasses && activeCounselor.allowedClasses.length > 0) {
        const cleanRaw = cleanClass.replace(/kelas\s+/i, '').replace(/\s+/g, '').toUpperCase();
        const isAllowed = activeCounselor.allowedClasses.some(allowed => {
          const cleanAllowed = allowed.replace(/kelas\s+/i, '').replace(/\s+/g, '').toUpperCase();
          return cleanRaw === cleanAllowed;
        });

        if (!isAllowed) {
          result.push({
            nis,
            name: name.trim(),
            class: cleanClass,
            gender,
            error: `Bukan kelas ampu Anda (Batas: ${activeCounselor.allowedClasses.join(', ')})`
          });
          continue;
        }
      }

      result.push({
        nis,
        name: name.trim(),
        class: cleanClass,
        gender
      });
    }

    return result;
  }, [importText, activeCounselor, bypassClassCheck]);

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validStudents = parsedImportStudents.filter((s) => !s.error);
    if (validStudents.length === 0) {
      alert('Tidak ada data siswa valid untuk diimpor!');
      return;
    }

    // Call onAddStudent for each
    validStudents.forEach((st) => {
      onAddStudent({
        nis: st.nis,
        name: st.name,
        class: st.class,
        gender: st.gender,
        violationPoints: 0,
        bkServicesCount: 0,
      });
    });

    alert(`Berhasil mengimpor ${validStudents.length} siswa ke dalam database!`);
    setImportText('');
    setShowImportModal(false);
  };

  const handleDownloadCSV = () => {
    const csvRows: string[][] = [];

    // Header row
    csvRows.push([
      'No',
      'NISN',
      'Nama Siswa',
      'Kelas',
      'Gender',
      'Total Poin Pelanggaran',
      'Poin Apresiasi',
      'Total Sesi Layanan BK',
      'ID Tiket Pelanggaran',
      'Kategori Pelanggaran',
      'Poin Pelanggaran',
      'Tanggal Pelanggaran',
      'Waktu Pelanggaran',
      'Lokasi Pelanggaran',
      'Catatan Pelanggaran',
      'Status Penanganan'
    ]);

    let counter = 1;

    filteredStudents.forEach((student) => {
      const studentViolations = violations.filter((v) => v.studentId === student.id);
      const studentAchievements = achievements?.filter((a) => a.studentId === student.id) || [];
      const totalAchievementPoints = studentAchievements.reduce((sum, a) => sum + a.pointsReward, 0);

      if (studentViolations.length === 0) {
        csvRows.push([
          String(counter++),
          student.nis,
          student.name,
          student.class,
          student.gender === 'L' ? 'Laki-laki' : 'Perempuan',
          String(student.violationPoints),
          String(totalAchievementPoints),
          String(student.bkServicesCount),
          '-',
          '-',
          '0',
          '-',
          '-',
          '-',
          'Tidak ada catatan pelanggaran',
          '-'
        ]);
      } else {
        studentViolations.forEach((v) => {
          csvRows.push([
            String(counter++),
            student.nis,
            student.name,
            student.class,
            student.gender === 'L' ? 'Laki-laki' : 'Perempuan',
            String(student.violationPoints),
            String(totalAchievementPoints),
            String(student.bkServicesCount),
            v.ticketId || v.id,
            v.category,
            String(v.pointsAdded),
            v.date,
            v.time || '-',
            v.location || '-',
            v.notes || '-',
            v.handledBy || 'Belum Ditangani'
          ]);
        });
      }
    });

    const escapeCSV = (field: string) => {
      if (!field) return '""';
      const clean = field.replace(/"/g, '""');
      return `"${clean}"`;
    };

    const csvContent = '\uFEFF' + csvRows.map(row => row.map(escapeCSV).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const classContext = filterClass === 'Semua Kelas' ? 'Semua_Kelas' : filterClass.replace(/\s+/g, '_');
    link.setAttribute('download', `Data_Siswa_dan_Pelanggaran_${classContext}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [showDossierModal, setShowDossierModal] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [printStudent, setPrintStudent] = useState<Student | null>(null);
  const [editingViolation, setEditingViolation] = useState<ViolationRecord | null>(null);
  const [editingService, setEditingService] = useState<CounselingService | null>(null);
  const [editingAchievement, setEditingAchievement] = useState<StudentAchievement | null>(null);
  const [activeDossierTab, setActiveDossierTab] = useState<'riwayat' | 'apresiasi' | 'rekomendasi'>('riwayat');

  // AI Gemini Behavioral Diagnosis & Email Notification Modals
  const [diagnosisStudent, setDiagnosisStudent] = useState<Student | null>(null);
  const [emailDraftData, setEmailDraftData] = useState<any | null>(null);

  // Compute print details for printStudent
  const printData = useMemo(() => {
    if (!printStudent) return null;
    const studentViolations = violations.filter((v) => v.studentId === printStudent.id);
    const studentServices = services.filter((s) => s.students.some((st) => st.id === printStudent.id));
    const studentAchievements = achievements.filter((a) => a.studentId === printStudent.id);
    return {
      studentViolations,
      studentServices,
      studentAchievements,
    };
  }, [printStudent, violations, services, achievements]);

  // Achievement form state
  const [achName, setAchName] = useState('');
  const [achPoints, setAchPoints] = useState(10);
  const [achCategory, setAchCategory] = useState<string>('Sosial');
  const [achNotes, setAchNotes] = useState('');
  const [achExtraNotes, setAchExtraNotes] = useState('');
  const [achTemplateId, setAchTemplateId] = useState<string>('');

  const handleTemplateChange = (templateId: string) => {
    setAchTemplateId(templateId);
    if (!templateId) {
      setAchName('');
      setAchPoints(10);
      return;
    }
    
    // Find option across categories
    for (const cat of APPRECIATION_TEMPLATES) {
      const opt = cat.options.find(o => o.id === templateId);
      if (opt) {
        setAchName(opt.label);
        setAchPoints(opt.points);
        setAchCategory(cat.id);
        break;
      }
    }
  };

  // Reset tab on modal change
  useEffect(() => {
    if (showDossierModal) {
      setActiveDossierTab('riwayat');
      // Reset form too
      setAchName('');
      setAchPoints(10);
      setAchCategory('Sosial');
      setAchNotes('');
      setAchExtraNotes('');
      setAchTemplateId('');
    }
  }, [showDossierModal]);

  // Counseling Recommendation Engine
  const recommendation = useMemo(() => {
    if (!showDossierModal) return null;

    // Get specific student violations
    const sViolations = violations.filter((v) => v.studentId === showDossierModal.id);
    const netPoints = Math.max(0, showDossierModal.violationPoints - (showDossierModal.achievementPoints || 0));

    // Categorize violations
    const counts = {
      perilaku: 0,
      kedisiplinan: 0,
      kerapihan: 0,
      kehadiran: 0,
    };

    sViolations.forEach(v => {
      const cat = v.category.toLowerCase();
      if (cat.includes('perilaku') || cat.includes('sikap') || cat.includes('moral') || cat.includes('kelakuan') || cat.includes('perkelahian') || cat.includes('bullying')) {
        counts.perilaku++;
      } else if (cat.includes('terlambat') || cat.includes('disiplin') || cat.includes('kedisiplinan')) {
        counts.kedisiplinan++;
      } else if (cat.includes('rambut') || cat.includes('seragam') || cat.includes('kerapihan') || cat.includes('pakaian')) {
        counts.kerapihan++;
      } else if (cat.includes('alfa') || cat.includes('bolos') || cat.includes('absen') || cat.includes('kehadiran')) {
        counts.kehadiran++;
      }
    });

    const totalViolations = sViolations.length;

    if (totalViolations === 0) {
      return {
        title: "Pendekatan Preventif & Pengembangan Karakter",
        method: "Bimbingan Klasikal / Layanan Informasi",
        technique: "Positive Reinforcement (Penguatan Positif)",
        description: "Siswa memiliki rekam jejak perilaku yang bersih dan prima. Sangat direkomendasikan untuk dilibatkan dalam program peer-support (mediator sebaya) atau diberikan peran kepemimpinan guna menginspirasi murid-murid lainnya di kelas.",
        duration: "Berkala / Rutin Bulanan",
        steps: [
          "Berikan apresiasi verbal di depan kelas atau melalui Wali Kelas.",
          "Libatkan dalam pelatihan kepemimpinan siswa atau pengurus OSIS.",
          "Jadikan role-model dalam kampanye disiplin positif sekolah."
        ]
      };
    }

    if (counts.perilaku >= 2) {
      return {
        title: "Intervensi Perilaku Sosial / Hubungan Interpersonal",
        method: "Layanan Konseling Individu",
        technique: "Konseling Behavioristik (Kontrak Perilaku / Self-Management)",
        description: "Siswa terdeteksi melakukan pelanggaran aspek sosial/moral berulang kali. Direkomendasikan melakukan Kontrak Perilaku tertulis secara suportif demi melatih regulasi emosi dan menetapkan konsekuensi positif jika komitmen tercapai.",
        duration: "Tindak lanjut dalam waktu 3 hari kedepan",
        steps: [
          "Panggil siswa secara ramah dan buat rasa aman (unconditional positive regard).",
          "Ajak siswa mengidentifikasi pemicu utama perilaku tersebut (antecedent).",
          "Terapkan kontrak perilaku tertulis dengan target harian sederhana.",
          "Lakukan evaluasi singkat bersama Wali Kelas setiap akhir pekan."
        ]
      };
    }

    if (counts.kerapihan >= 2) {
      return {
        title: "Pembinaan Kerapihan & Disiplin Diri",
        method: "Edukasi Segitiga Restitusi Sekolah",
        technique: "Reality Therapy (Terapi Realitas - Evaluasi WDEP)",
        description: "Siswa berulang kali melanggar aturan kerapihan fisik. Gunakan pendekatan Segitiga Restitusi untuk menuntun siswa menyadari nilai-nilai keyakinan kelas yang ia percayai, serta menyusun rencana perbaikan kerapihan secara mandiri.",
        duration: "Tindak lanjut dalam waktu 5 hari kedepan",
        steps: [
          "Lakukan Stabilize the Identity (Menstabilkan Identitas) - 'Semua orang pernah salah'.",
          "Lakukan Validate the Misbehavior (Validasi Tindakan yang Salah) - 'Kamu pasti punya alasan'.",
          "Lakukan Seek the Belief (Menanyakan Keyakinan Kelas) - 'Apa keyakinan kelas kita?'.",
          "Bantu siswa menyusun solusi konkret tanpa unsur kekerasan atau paksaan fisik."
        ]
      };
    }

    if (counts.kehadiran >= 2 || counts.kedisiplinan >= 2) {
      return {
        title: "Intervensi Presensi & Kedisiplinan Waktu",
        method: "Konseling Individual & Kunjungan Rumah (Home Visit)",
        technique: "Rational Emotive Behavior Therapy (REBT) / Analisis Kognitif",
        description: "Siswa terhambat masalah kedisiplinan absensi/keterlambatan. Pendekatan REBT direkomendasikan untuk membongkar distorsi kognitif (misal: menganggap terlambat adalah hal sepele) dan menyelaraskan penanganan bersama keluarga di rumah.",
        duration: "Tindak lanjut dalam waktu 2 hari kedepan (Segera)",
        steps: [
          "Lakukan asesmen apakah ada faktor luar (ekonomi, jarak rumah, kendala transportasi).",
          "Gunakan konfrontasi lembut REBT untuk menyadarkan dampak jangka panjang ketidakdisiplinan.",
          "Koordinasikan jadwal Home Visit resmi jika absensi berlanjut tanpa keterangan.",
          "Buat kesepakatan tertulis yang diketahui Orang Tua/Wali."
        ]
      };
    }

    if (netPoints >= 75) {
      return {
        title: "Penanganan Kasus Tingkat Kritis",
        method: "Konferensi Kasus (Case Conference)",
        technique: "Solution-Focused Brief Counseling (SFBC) Terpadu",
        description: "Siswa menyentuh tingkat akumulasi poin kritis. Wajib dilakukan pertemuan formal khusus yang melibatkan Guru BK, Kepala Sekolah, Wali Kelas, dan Orang Tua untuk menegaskan konsekuensi pembinaan dan penandatanganan pakta integritas di atas materai.",
        duration: "Segera (Dalam waktu 24-48 jam)",
        steps: [
          "Sampaikan undangan resmi pemanggilan Orang Tua III.",
          "Paparkan rekam jejak digital pelanggaran secara obyektif tanpa menuduh.",
          "Fokus pada pencarian solusi bersahabat melalui metode SFBC.",
          "Sahkan surat perjanjian akhir berkekuatan hukum sekolah."
        ]
      };
    }

    if (netPoints >= 40) {
      return {
        title: "Pembinaan Kelompok & Resonansi Sosial",
        method: "Layanan Bimbingan / Konseling Kelompok",
        technique: "Gestalt (Teknik Kursi Kosong / Dialog Eksperensial)",
        description: "Siswa berada di area kerentanan sedang. Sesi Konseling Kelompok bersama 3-5 siswa dengan masalah sejenis sangat efektif untuk memicu refleksi diri melalui dinamika kelompok dan mengurangi rasa defensif terhadap bimbingan.",
        duration: "Tindak lanjut dalam waktu 7 hari kedepan",
        steps: [
          "Kumpulkan siswa dalam kelompok kecil homogen (kasus serupa).",
          "Gunakan skenario refleksi interaktif agar siswa saling berbagi cerita.",
          "Gunakan eksperimen Gestalt untuk melatih empati terhadap pihak yang dirugikan.",
          "Akhiri dengan komitmen bersama untuk saling memantau perubahan positif teman sekelompok."
        ]
      };
    }

    // Default Fallback
    return {
      title: "Pendekatan Konseling Humanistik Awal",
      method: "Layanan Konseling Perorangan Suportif",
      technique: "Client-Centered Therapy (Aceptance & Warmth)",
      description: "Lakukan wawancara konseling interpersonal ringan yang menekankan kehangatan dan rasa diterima. Bantu siswa memahami bahwa bimbingan konseling adalah ruang aman yang ramah untuk bertumbuh, bukan tempat penghakiman.",
      duration: "Tindak lanjut dalam waktu 5 hari kedepan",
      steps: [
        "Sambut siswa dengan senyuman dan jabat tangan hangat.",
        "Mulai percakapan dengan topik kesukaan/hobi siswa (ice-breaking).",
        "Dengarkan secara aktif kisah siswa tanpa melakukan interupsi menghakimi.",
        "Umpan balik pemahaman empati untuk menumbuhkan rasa dipercaya oleh siswa."
      ]
    };
  }, [showDossierModal, violations]);

  // Student specific history
  const currentStudent = useMemo(() => {
    if (!showDossierModal) return null;
    return students.find((s) => s.id === showDossierModal.id) || showDossierModal;
  }, [students, showDossierModal]);

  const studentViolations = useMemo(() => {
    if (!currentStudent) return [];
    return violations.filter((v) => v.studentId === currentStudent.id);
  }, [currentStudent, violations]);

  const studentServices = useMemo(() => {
    if (!currentStudent) return [];
    return services.filter((s) => s.students.some((st) => st.id === currentStudent.id));
  }, [currentStudent, services]);

  const studentAchievements = useMemo(() => {
    if (!currentStudent) return [];
    return achievements.filter((a) => a.studentId === currentStudent.id);
  }, [currentStudent, achievements]);

  // Add student form state
  const [newNis, setNewNis] = useState('');
  const [newName, setNewName] = useState('');
  
  const initialAddClass = useMemo(() => {
    if (activeCounselor && activeCounselor.allowedClasses && activeCounselor.allowedClasses.length > 0) {
      const first = activeCounselor.allowedClasses[0];
      return first.startsWith('Kelas ') ? first : `Kelas ${first}`;
    }
    return 'Kelas 7A';
  }, [activeCounselor]);

  const [newClass, setNewClass] = useState(initialAddClass);
  const [newGender, setNewGender] = useState<'L' | 'P'>('L');

  // Load wali kelas config from localStorage to dynamically resolve email addresses
  const waliKelasConfig = useMemo(() => {
    const saved = localStorage.getItem('bk_walikelas_config');
    if (saved) {
      try {
        return JSON.parse(saved) as { class: string; name: string; email: string }[];
      } catch (e) {
        return defaultWaliKelasList;
      }
    }
    return defaultWaliKelasList;
  }, []);

  const getWaliKelasEmail = (className: string) => {
    if (!className) return '';
    const studentClassKey = getNormalizedClassKey(className);
    
    const found = waliKelasConfig.find(item => 
      getNormalizedClassKey(item.class) === studentClassKey
    );
    
    if (found) return found.email;

    // fallback
    const cleanClass = className.trim().replace(/kelas\s*/i, '').trim();
    const classCode = cleanClass.toLowerCase().replace(/\s+/g, '');
    return `wali.kelas.${classCode}@smpn2susukan.sch.id`;
  };

  useEffect(() => {
    setNewClass(initialAddClass);
  }, [initialAddClass]);

  // Dynamic lists of unique classes represented in current student database
  const classesList = useMemo(() => {
    const set = new Set(students.map((s) => s.class));
    return ['Semua Kelas', ...Array.from(set)].sort();
  }, [students]);

  // Top Summary Statistics
  const studentStats = useMemo(() => {
    let totalL = 0;
    let totalP = 0;
    let primaCount = 0;
    let pendampinganCount = 0;
    let kritisCount = 0;
    let berprestasiCount = 0;

    students.forEach((s) => {
      if (s.gender === 'L') totalL++;
      if (s.gender === 'P') totalP++;

      const rewardPoints = s.achievementPoints || 0;
      const netPoints = Math.max(0, s.violationPoints - rewardPoints);

      if (rewardPoints > 0) berprestasiCount++;

      if (netPoints >= 50) {
        kritisCount++;
      } else if (netPoints > 0) {
        pendampinganCount++;
      } else {
        primaCount++;
      }
    });

    return {
      total: students.length,
      totalL,
      totalP,
      primaCount,
      pendampinganCount,
      kritisCount,
      berprestasiCount,
    };
  }, [students]);

  // Filter & Search Logic
  const filteredStudents = useMemo(() => {
    if (!Array.isArray(students)) return [];
    const q = (searchQuery || '').toLowerCase().trim();

    return students
      .filter((student) => {
        if (!student) return false;
        
        const sName = String(student.name || '').toLowerCase();
        const sNis = String(student.nis || '').toLowerCase();
        const sClass = String(student.class || '').toLowerCase();

        const matchSearch = !q || sName.includes(q) || sNis.includes(q) || sClass.includes(q);
        const matchClass = filterClass === 'Semua Kelas' || student.class === filterClass;
        const matchGender = filterGender === 'Semua' || student.gender === filterGender;

        const rewardPoints = student.achievementPoints || 0;
        const netPoints = Math.max(0, student.violationPoints - rewardPoints);

        let matchDiscipline = true;
        if (filterDisciplineStatus === 'prima') {
          matchDiscipline = netPoints === 0;
        } else if (filterDisciplineStatus === 'pendampingan') {
          matchDiscipline = netPoints >= 1 && netPoints < 50;
        } else if (filterDisciplineStatus === 'kritis') {
          matchDiscipline = netPoints >= 50;
        } else if (filterDisciplineStatus === 'apresiasi') {
          matchDiscipline = rewardPoints > 0;
        }

        return matchSearch && matchClass && matchGender && matchDiscipline;
      })
      .sort((a, b) => {
        const aNet = Math.max(0, a.violationPoints - (a.achievementPoints || 0));
        const bNet = Math.max(0, b.violationPoints - (b.achievementPoints || 0));

        if (sortBy === 'name-asc') return a.name.localeCompare(b.name, 'id');
        if (sortBy === 'name-desc') return b.name.localeCompare(a.name, 'id');
        if (sortBy === 'points-desc') return bNet - aNet;
        if (sortBy === 'achievements-desc') return (b.achievementPoints || 0) - (a.achievementPoints || 0);
        if (sortBy === 'services-desc') return b.bkServicesCount - a.bkServicesCount;
        return 0;
      });
  }, [students, searchQuery, filterClass, filterGender, filterDisciplineStatus, sortBy]);

  // Handle printing class recap PDF
  const handlePrintClassRecap = () => {
    if (filteredStudents.length === 0) {
      alert('Tidak ada data siswa terfilter untuk dicetak.');
      return;
    }
    const schoolConfig = getSchoolConfig();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
    // Header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(11, 28, 48);
    doc.text(schoolConfig.schoolName.toUpperCase(), 14, 15);
    
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'normal');
    doc.text(`REKAPITULASI DATA DISIPLIN DAN BIMBINGAN SISWA (${filterClass})`, 14, 21);
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')} | Total: ${filteredStudents.length} Siswa`, 14, 26);

    // Line divider
    doc.setDrawColor(0, 104, 95);
    doc.setLineWidth(0.5);
    doc.line(14, 28, 283, 28);

    function drawTableHeader(y: number) {
      doc.setFillColor(0, 104, 95);
      doc.rect(14, y - 5, 269, 7, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('No', 16, y);
      doc.text('NISN', 26, y);
      doc.text('Nama Siswa', 52, y);
      doc.text('Kelas', 115, y);
      doc.text('L/P', 135, y);
      doc.text('Poin Kotor', 150, y);
      doc.text('Apresiasi', 172, y);
      doc.text('Poin Aktif', 195, y);
      doc.text('Status Disiplin', 220, y);
      doc.text('Sesi BK', 260, y);
    }

    let startY = 35;
    drawTableHeader(startY);

    let currentY = startY + 6;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);

    filteredStudents.forEach((student, index) => {
      if (currentY > 175) {
        doc.addPage('a4', 'landscape');
        drawTableHeader(20);
        currentY = 26;
      }
      const rawPoints = student.violationPoints;
      const rewardPoints = student.achievementPoints || 0;
      const netPoints = Math.max(0, rawPoints - rewardPoints);

      let statusStr = 'Kondisi Prima';
      if (netPoints >= 100) statusStr = 'Sidang Dewan Guru';
      else if (netPoints >= 50) statusStr = 'Eskalasi BK';
      else if (netPoints > 0) statusStr = 'Pendampingan';

      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, currentY - 4, 269, 6, 'F');
      }

      doc.text(String(index + 1), 16, currentY);
      doc.text(student.nis, 26, currentY);
      const splitName = doc.splitTextToSize(student.name, 58);
      doc.text(splitName[0], 52, currentY);
      doc.text(student.class, 115, currentY);
      doc.text(student.gender, 135, currentY);
      doc.text(String(rawPoints), 150, currentY);
      doc.text(String(rewardPoints), 172, currentY);
      doc.text(String(netPoints), 195, currentY);
      doc.text(statusStr, 220, currentY);
      doc.text(String(student.bkServicesCount), 260, currentY);

      currentY += 6;
    });

    currentY += 10;
    if (currentY > 170) {
      doc.addPage('a4', 'landscape');
      currentY = 30;
    }

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Mengetahui,', 220, currentY);
    doc.text('Guru Bimbingan & Konseling', 220, currentY + 4);
    doc.setFont('Helvetica', 'bold');
    doc.text(activeCounselor.name, 220, currentY + 22);
    doc.setFont('Helvetica', 'normal');
    doc.text(`NIP. ${activeCounselor.nip || '-'}`, 220, currentY + 26);

    doc.save(`Rekapitulasi_BK_${filterClass.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Pagination bounds
  const totalItems = filteredStudents.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStudents, currentPage]);

  // Virtual Scroll Calculations
  const rowHeight = 72; // Average height of row in px
  const viewportHeight = 450; // Visible window height
  const buffer = 5;

  const virtualBounds = useMemo(() => {
    if (!isVirtualScroll) {
      return { startIndex: 0, endIndex: totalItems, visibleStudents: paginatedStudents, topSpacerHeight: 0, bottomSpacerHeight: 0 };
    }
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
    const endIndex = Math.min(totalItems, Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer);
    const visibleStudents = filteredStudents.slice(startIndex, endIndex);
    const topSpacerHeight = startIndex * rowHeight;
    const bottomSpacerHeight = Math.max(0, (totalItems - endIndex) * rowHeight);
    return { startIndex, endIndex, visibleStudents, topSpacerHeight, bottomSpacerHeight };
  }, [isVirtualScroll, scrollTop, filteredStudents, totalItems, paginatedStudents]);

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNis || !newName) {
      alert('Nis dan Nama Siswa harus diisi!');
      return;
    }
    // Perform trigger
    onAddStudent({
      nis: newNis,
      name: newName,
      class: newClass,
      gender: newGender,
      violationPoints: 0,
      bkServicesCount: 0,
    });
    // Reset state
    setNewNis('');
    setNewName('');
    setNewClass(initialAddClass);
    setNewGender('L');
    setShowAddModal(false);
    alert('Siswa berhasil ditambahkan ke database!');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Dossier Student detail view modal overlay */}
      {showDossierModal && currentStudent && (
        <div className="fixed inset-0 bg-[#0b1c30]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative border border-[#bcc9c6]/40 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowDossierModal(null)}
              className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            <div className="flex items-center gap-4 border-b border-[#bcc9c6]/20 pb-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-[#eff4ff] border border-[#00685f]/20 flex items-center justify-center font-extrabold text-2xl text-[#00685f] overflow-hidden flex-shrink-0 shadow-sm">
                {currentStudent.avatarUrl ? (
                  <img
                    src={currentStudent.avatarUrl}
                    alt={currentStudent.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{currentStudent.initials}</span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0b1c30]">
                  {currentStudent.name}
                </h3>
                <p className="text-xs text-[#3d4947] font-semibold opacity-75">
                  NISN: {currentStudent.nis} | Kelas: {currentStudent.class}
                </p>
                <p className="text-[10px] bg-[#eff4ff] text-[#00685f] font-bold px-2 py-0.5 rounded-full inline-block mt-1">
                  Gender: {currentStudent.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setDiagnosisStudent(currentStudent)}
                    className="px-2.5 py-1 bg-gradient-to-r from-[#0b1c30] to-[#00685f] text-white text-[10px] font-bold rounded-lg hover:opacity-90 transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Brain className="w-3 h-3 text-teal-300" />
                    <span>Diagnosa AI Gemini</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEmailDraftData({
                        studentName: currentStudent.name,
                        studentClass: currentStudent.class,
                        studentNis: currentStudent.nis,
                        netPoints: Math.max(0, currentStudent.violationPoints - (currentStudent.achievementPoints || 0)),
                        riskLevel: currentStudent.violationPoints >= 50 ? 'Kritis' : currentStudent.violationPoints >= 25 ? 'Perhatian Khusus' : 'Sedang'
                      })
                    }
                    className="px-2.5 py-1 bg-amber-600 text-white text-[10px] font-bold rounded-lg hover:bg-amber-700 transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Mail className="w-3 h-3" />
                    <span>Email Wali Kelas</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Dossier Navigation Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
              <button
                type="button"
                onClick={() => setActiveDossierTab('riwayat')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeDossierTab === 'riwayat'
                    ? 'bg-white text-[#0b1c30] shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Riwayat & Apresiasi</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDossierTab('rekomendasi')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeDossierTab === 'rekomendasi'
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-gray-500 hover:text-violet-600'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Rekomendasi Tindak Lanjut</span>
              </button>
            </div>

            {/* Student Dossier Tabs Body */}
            {activeDossierTab === 'riwayat' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Student Score Overview */}
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="bg-[#ffdad6]/20 border border-[#ba1a1a]/20 p-4 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-[#ba1a1a]/80 tracking-wider">
                      Bobot Pembinaan Aktif
                    </p>
                    <p className="text-2xl font-extrabold text-[#ba1a1a] mt-1">
                      {currentStudent.violationPoints} (Bobot)
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1 font-medium">
                      Batas eskalasi khusus: 100
                    </p>
                  </div>
                  <div className="bg-[#f4fffc] border border-[#00685f]/20 p-4 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-[#00685f]/80 tracking-wider">
                      Keterlibatan Konseling
                    </p>
                    <p className="text-2xl font-extrabold text-[#00685f] mt-1">
                      {currentStudent.bkServicesCount} Sesi
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1 font-medium">
                      Bimbingan & Konseling
                    </p>
                  </div>
                </div>

            {/* Timeline Alur Eskalasi & Notifikasi Wali Kelas */}
            <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200/60 pb-2.5">
                <h4 className="text-xs font-extrabold text-[#0b1c30] uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-[#00685f]" />
                  <span>Timeline & Alur Eskalasi Penanganan</span>
                </h4>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                  currentStudent.violationPoints <= 20 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                    : currentStudent.violationPoints <= 50 
                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : currentStudent.violationPoints <= 75 
                        ? 'bg-purple-50 text-purple-700 border-purple-100'
                        : 'bg-red-50 text-red-700 border-red-100'
                }`}>
                  {currentStudent.violationPoints <= 20 ? 'Pembinaan Wali Kelas' :
                   currentStudent.violationPoints <= 50 ? 'Eskalasi Guru BK' :
                   currentStudent.violationPoints <= 75 ? 'Sidang Dewan Guru' :
                   'Diserahkan Kepala Sekolah'}
                </span>
              </div>

              {/* Vertical Stepper Timeline */}
              <div className="space-y-4 relative pl-1.5">
                {/* Step 1: Wali Kelas */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                      currentStudent.violationPoints >= 0 ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-200 text-gray-400'
                    }`}>
                      1
                    </div>
                    <div className="w-0.5 h-10 bg-gray-200"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-gray-800 flex justify-between items-center">
                      <span>Tahap I: Wali Kelas (Bobot 0 - 20)</span>
                      {currentStudent.violationPoints > 20 ? (
                        <span className="text-[10px] font-bold text-emerald-600">Terlewati</span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">Aktif</span>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-500 font-semibold leading-relaxed mt-0.5">
                      Fokus pada pembinaan persuasif, dialog pemulihan awal, dan refleksi perilaku tingkat kelas oleh Wali Kelas.
                    </p>
                  </div>
                </div>

                {/* Step 2: Guru BK & Wali Kelas */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                      currentStudent.violationPoints > 20 ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-200 text-gray-400'
                    }`}>
                      2
                    </div>
                    <div className="w-0.5 h-10 bg-gray-200"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-gray-800 flex justify-between items-center">
                      <span>Tahap II: Kolaborasi Wali Kelas & Guru BK (Bobot 21 - 50)</span>
                      {currentStudent.violationPoints > 50 ? (
                        <span className="text-[10px] font-bold text-emerald-600">Terlewati</span>
                      ) : currentStudent.violationPoints > 20 ? (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-100">Aktif</span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400">Belum Aktif</span>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-500 font-semibold leading-relaxed mt-0.5">
                      Guru BK mendampingi Wali Kelas melakukan bimbingan restoratif intensif. Koordinasi bersama orang tua/wali murid (Tahap I).
                    </p>
                  </div>
                </div>

                {/* Step 3: Dewan Guru */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                      currentStudent.violationPoints > 50 ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-200 text-gray-400'
                    }`}>
                      3
                    </div>
                    <div className="w-0.5 h-10 bg-gray-200"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-gray-800 flex justify-between items-center">
                      <span>Tahap III: Dewan Guru & Dialog Pemulihan (Bobot 51 - 75)</span>
                      {currentStudent.violationPoints > 75 ? (
                        <span className="text-[10px] font-bold text-emerald-600">Terlewati</span>
                      ) : currentStudent.violationPoints > 50 ? (
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-100">Aktif</span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400">Belum Aktif</span>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-500 font-semibold leading-relaxed mt-0.5">
                      Pertemuan terpadu bersama Wali Kelas, Guru BK, Dewan Guru, dan Komite Sekolah untuk menyepakati rencana pemulihan karakter strategis.
                    </p>
                  </div>
                </div>

                {/* Step 4: Kepala Sekolah */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                      currentStudent.violationPoints > 75 ? 'bg-red-600 text-white shadow-sm' : 'bg-gray-200 text-gray-400'
                    }`}>
                      4
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-gray-800 flex justify-between items-center">
                      <span>Tahap IV: Kepala Sekolah (Bobot &gt; 75)</span>
                      {currentStudent.violationPoints > 75 ? (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-100">Dukungan Khusus</span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400">Belum Aktif</span>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-500 font-semibold leading-relaxed mt-0.5">
                      Layanan intervensi khusus dan rujukan penanganan restoratif terpadu yang disahkan langsung oleh Kepala Sekolah.
                    </p>
                  </div>
                </div>
              </div>

              {/* Notifikasi Email Logs */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 space-y-2 text-xs font-semibold">
                <div className="flex items-center gap-1.5 text-gray-800 font-bold border-b border-gray-100 pb-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  <span>Notifikasi Email Sistem Otomatis</span>
                </div>

                <div className="space-y-2 text-[10px] leading-relaxed text-gray-600">
                  {currentStudent.violationPoints >= 20 ? (
                    <div className="p-2 bg-yellow-50 rounded border border-yellow-100 space-y-0.5">
                      <div className="flex items-center justify-between text-yellow-800 font-bold">
                        <span>📧 EMAIL DISPATCHED</span>
                        <span>TAHAP I</span>
                      </div>
                      <p className="text-gray-700">Notifikasi Peringatan Terkirim Ke:</p>
                      <p className="font-mono text-gray-800 font-bold bg-white/70 px-1.5 py-0.5 rounded border border-yellow-200/40 inline-block">
                        {getWaliKelasEmail(currentStudent.class)}
                      </p>
                      <p className="text-gray-400 text-[9px] font-medium italic mt-1">Siswa telah menyentuh akumulasi &gt;= 20 poin. Wali Kelas berkewajiban memulai pembinaan tingkat kelas.</p>
                    </div>
                  ) : null}

                  {currentStudent.violationPoints >= 50 ? (
                    <div className="p-2 bg-orange-50 rounded border border-orange-100 space-y-0.5">
                      <div className="flex items-center justify-between text-orange-800 font-bold">
                        <span>📧 EMAIL DISPATCHED</span>
                        <span>TAHAP II (SIAGA)</span>
                      </div>
                      <p className="text-gray-700">Notifikasi Sidang Konseling Terkirim Ke:</p>
                      <p className="font-mono text-gray-800 font-bold bg-white/70 px-1.5 py-0.5 rounded border border-orange-200/40 inline-block">
                        {getWaliKelasEmail(currentStudent.class)}
                      </p>
                      <p className="text-gray-400 text-[9px] font-medium italic mt-1">Siswa telah menyentuh akumulasi &gt;= 50 bobot. Guru BK & Wali kelas wajib menjadwalkan Panggilan Orang Tua I.</p>
                    </div>
                  ) : null}

                  {currentStudent.violationPoints >= 75 ? (
                    <div className="p-2 bg-red-50 rounded border border-red-100 space-y-0.5">
                      <div className="flex items-center justify-between text-red-800 font-bold">
                        <span>📧 EMAIL DISPATCHED</span>
                        <span>TAHAP III (KRITIS)</span>
                      </div>
                      <p className="text-gray-700">Notifikasi Sidang Dewan Guru Terkirim Ke:</p>
                      <p className="font-mono text-gray-800 font-bold bg-white/70 px-1.5 py-0.5 rounded border border-red-200/40 inline-block">
                        {getWaliKelasEmail(currentStudent.class)}
                      </p>
                      <p className="text-gray-400 text-[9px] font-medium italic mt-1">Siswa telah menyentuh akumulasi &gt;= 75 bobot. Penanganan resmi beralih ke Sidang Dewan Guru & Kepala Sekolah.</p>
                    </div>
                  ) : null}

                  {currentStudent.violationPoints < 20 ? (
                    <div className="text-center py-4 bg-gray-100/50 rounded-xl text-gray-400 italic">
                      Akumulasi bobot bimbingan masih di bawah batas peringatan otomatis (20 Bobot). Belum ada email notifikasi terkirim.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Riwayat Pelanggaran & Layanan List */}
            <div className="mb-6 pt-4 border-t border-[#bcc9c6]/20 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
                  Riwayat Pembinaan Perilaku ({studentViolations.length})
                </h4>
                {studentViolations.length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {studentViolations.map((v) => (
                      <div key={v.id} className="bg-red-50/50 border border-[#ba1a1a]/15 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-[#ba1a1a] truncate">{v.category}</p>
                          <p className="text-[10px] text-gray-500 font-semibold">{v.date} &bull; Bobot: {v.pointsAdded} &bull; {v.location}</p>
                          <p className="text-[10px] text-gray-600 line-clamp-1 italic mt-0.5">"{v.notes}"</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => setEditingViolation(v)}
                            className="p-1.5 bg-[#00685f]/10 hover:bg-[#00685f] text-[#00685f] hover:text-white rounded-lg transition-all cursor-pointer shadow-sm"
                            title="Edit Catatan"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteViolation && (
                            <button
                              onClick={() => onDeleteViolation(v.id)}
                              className="p-1.5 bg-red-100 hover:bg-red-600 text-red-700 hover:text-white rounded-lg transition-all cursor-pointer shadow-sm"
                              title="Hapus Catatan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => downloadViolationPDF(v)}
                            className="p-1.5 bg-[#ba1a1a]/10 hover:bg-[#ba1a1a] text-[#ba1a1a] hover:text-white rounded-lg transition-all cursor-pointer shadow-sm"
                            title="Unduh Dokumen Pembinaan PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-400 font-medium italic bg-gray-50 p-2.5 rounded-xl text-center">Siswa ini tidak memiliki catatan pembinaan perilaku khusus.</p>
                )}
              </div>

              {/* INTEGRATED POIN APRESIASI SECTION WITH TEMPLATE-BASED SELECTION */}
              <div className="bg-emerald-50/40 rounded-2xl border border-emerald-500/20 p-4.5 space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2.5">
                  <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-600 animate-pulse" />
                    <span>Apresiasi & Kredit Karakter Positif</span>
                  </h4>
                  <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Akumulasi: +{currentStudent.achievementPoints || 0} Kredit
                  </span>
                </div>

                {/* List of achievements */}
                {studentAchievements.length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {studentAchievements.map((a) => (
                      <div key={a.id} className="bg-white/80 border border-emerald-500/10 rounded-xl p-2 text-xs flex items-center justify-between gap-3 shadow-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-emerald-800 truncate">{a.achievementName}</p>
                          <p className="text-[9px] text-gray-500 font-semibold">{a.date} &bull; Dicatat oleh {a.recordedBy}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[11px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-500/10">
                            +{a.pointsReward} Kredit
                          </span>
                          <button
                            onClick={() => setEditingAchievement(a)}
                            className="p-1.5 bg-[#00685f]/10 hover:bg-[#00685f] text-[#00685f] hover:text-white rounded-lg transition-all cursor-pointer shadow-sm"
                            title="Edit Catatan"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteAchievement && (
                            <button
                              onClick={() => onDeleteAchievement(a.id)}
                              className="p-1.5 bg-red-100 hover:bg-red-600 text-red-700 hover:text-white rounded-lg transition-all cursor-pointer shadow-sm"
                              title="Hapus Catatan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-emerald-700/70 font-medium italic bg-emerald-500/5 p-2 rounded-xl text-center border border-dashed border-emerald-500/15">
                    Siswa ini belum memiliki catatan kredit apresiasi karakter.
                  </p>
                )}

                {/* Form to log new appreciation */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!achName.trim()) {
                      alert('Silakan isi atau pilih nama pencapaian siswa!');
                      return;
                    }
                    if (onSaveAchievement) {
                      onSaveAchievement({
                        studentId: currentStudent.id,
                        studentName: currentStudent.name,
                        studentClass: currentStudent.class,
                        achievementName: achName.trim(),
                        category: achCategory,
                        pointsReward: achPoints,
                        date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
                        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                        recordedBy: activeCounselor ? activeCounselor.name : 'Guru BK',
                        notes: achNotes.trim(),
                        extraNotes: achExtraNotes.trim(),
                      });
                      // Reset form
                      setAchName('');
                      setAchPoints(10);
                      setAchCategory('Sosial');
                      setAchNotes('');
                      setAchExtraNotes('');
                      setAchTemplateId('');
                      alert('Kredit Apresiasi Karakter berhasil ditambahkan dan mendukung pemulihan perilaku!');
                    }
                  }}
                  className="space-y-3 bg-white p-3 rounded-xl border border-emerald-500/10"
                >
                  <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                    ➕ Berikan Apresiasi / Kredit Karakter Positif Baru:
                  </p>
                  
                  {/* Category select */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Kategori</label>
                      <select
                        value={achCategory}
                        onChange={(e) => {
                          const cat = e.target.value;
                          setAchCategory(cat);
                          setAchTemplateId('');
                          setAchName('');
                          setAchPoints(10);
                        }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="Akademik">Akademik</option>
                        <option value="Olahraga & Seni">Olahraga & Seni</option>
                        <option value="Kedisiplinan">Kedisiplinan</option>
                        <option value="Sosial">Sosial / Kepedulian</option>
                        <option value="Keagamaan">Keagamaan</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Pilih Template</label>
                      <select
                        value={achTemplateId}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="">-- Kustom / Ketik Sendiri --</option>
                        {APPRECIATION_TEMPLATES.find(c => c.id === achCategory)?.options.map(opt => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label.length > 32 ? opt.label.slice(0, 32) + '...' : opt.label} (+{opt.points} K)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Manual entry / Name */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase">Nama Pencapaian / Aksi Positif</label>
                    <input
                      type="text"
                      value={achName}
                      onChange={(e) => {
                        setAchName(e.target.value);
                        setAchTemplateId(''); // switch to custom
                      }}
                      placeholder="Pilih template di atas atau ketik pencapaian kustom..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Points slider & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase">
                        <span>Kredit Karakter</span>
                        <span className="text-emerald-600 font-extrabold">+{achPoints} Kredit</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="5"
                        value={achPoints}
                        onChange={(e) => setAchPoints(Number(e.target.value))}
                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 mt-1.5"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Konteks / Catatan Ringkas</label>
                      <input
                        type="text"
                        value={achNotes}
                        onChange={(e) => setAchNotes(e.target.value)}
                        placeholder="Konteks tambahan (opsional)..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Additional Notes Field */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase block">Keterangan Tambahan / Catatan Khusus Guru</label>
                    <textarea
                      rows={2}
                      value={achExtraNotes}
                      onChange={(e) => setAchExtraNotes(e.target.value)}
                      placeholder="Masukkan detail tambahan, saksi, dewan juri, tempat pencapaian, atau catatan khusus pembinaan lainnya..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-97"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Simpan & Kurangi Poin Pelanggaran</span>
                  </button>
                </form>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-[#00685f]" />
                  Riwayat Layanan BK ({studentServices.length})
                </h4>
                {studentServices.length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {studentServices.map((s) => (
                      <div key={s.id} className="bg-teal-50/30 border border-[#00685f]/15 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-[#00685f] truncate">{s.serviceType}</p>
                          <p className="text-[10px] text-gray-500 font-semibold">{s.date} &bull; {s.startTime} WIB</p>
                          <p className="text-[10px] text-[#0b1c30] font-medium truncate mt-0.5">{s.problem}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => addToGoogleCalendar(s)}
                            className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg transition-all cursor-pointer shadow-2xs text-[10px] font-extrabold flex items-center gap-1"
                            title="Tambah Sesi ini ke Google Calendar"
                          >
                            <span>+ Kalender</span>
                          </button>
                          <button
                            onClick={() => setEditingService(s)}
                            className="p-1.5 bg-[#00685f]/10 hover:bg-[#00685f] text-[#00685f] hover:text-white rounded-lg transition-all cursor-pointer shadow-sm"
                            title="Edit Catatan"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteService && (
                            <button
                              onClick={() => onDeleteService(s.id)}
                              className="p-1.5 bg-red-100 hover:bg-red-600 text-red-700 hover:text-white rounded-lg transition-all cursor-pointer shadow-sm"
                              title="Hapus Catatan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => downloadServicePDF(s)}
                            className="p-1.5 bg-[#00685f]/10 hover:bg-[#00685f] text-[#00685f] hover:text-white rounded-lg transition-all cursor-pointer shadow-sm"
                            title="Unduh Bukti Layanan BK PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-400 font-medium italic bg-gray-50 p-2.5 rounded-xl text-center">Siswa ini belum pernah terlibat dalam bimbingan konseling.</p>
                )}
              </div>
            </div>

            {/* Download Recap PDF & Print-friendly Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => downloadStudentRecapPDF(currentStudent, studentViolations, studentServices, studentAchievements)}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-md hover:shadow-lg active:scale-97 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintStudent(currentStudent)}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-extrabold transition-all shadow-md hover:shadow-lg active:scale-97 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-teal-700" />
                <span>Cetak Profil (Print)</span>
              </button>
            </div>

            {/* Inner actions */}
            <div className="flex gap-3 pt-3 border-t border-[#bcc9c6]/20">
              <button
                onClick={() => {
                  onNavigateToForm('pelanggaran', currentStudent.id);
                  setShowDossierModal(null);
                }}
                className="flex-grow flex items-center justify-center gap-2 py-2.5 px-4 bg-[#ba1a1a] hover:bg-[#ba1a1a]/90 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-97 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                Catat Pelanggaran
              </button>
              <button
                onClick={() => {
                  onNavigateToForm('tambah-layanan', currentStudent.id);
                  setShowDossierModal(null);
                }}
                className="flex-grow flex items-center justify-center gap-2 py-2.5 px-4 bg-[#6b38d4] hover:bg-[#6b38d4]/90 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-97 cursor-pointer"
              >
                <HeartHandshake className="w-4 h-4" />
                Bimbingan Layanan
              </button>
            </div>
          </div>
        )}



        {/* Rekomendasi Tab View */}
        {activeDossierTab === 'rekomendasi' && recommendation && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Recommendation Main Dashboard */}
            <div className="bg-gradient-to-br from-violet-600/10 to-indigo-600/5 border border-violet-500/20 rounded-2xl p-4.5 space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-violet-600 rounded-xl text-white shadow-md flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <span className="text-[9px] font-extrabold uppercase bg-violet-100 text-violet-800 px-2 py-0.5 rounded border border-violet-200 tracking-wider">
                    Hasil Analitik Kasus & Diagnosis
                  </span>
                  <h4 className="text-sm font-extrabold text-violet-900 mt-0.5">
                    {recommendation.title}
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-white/70 p-3 rounded-xl border border-violet-500/10">
                <div>
                  <span className="text-[9px] text-gray-400 uppercase font-bold block">Rekomendasi Layanan</span>
                  <span className="font-extrabold text-violet-900">{recommendation.method}</span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-400 uppercase font-bold block">Teknik Terapi Pendekatan</span>
                  <span className="font-extrabold text-indigo-900">{recommendation.technique}</span>
                </div>
              </div>

              <div className="text-xs space-y-1">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase">Rasional Klinis Guru BK:</span>
                <p className="text-[#3d4947] font-semibold leading-relaxed bg-white/40 p-3 rounded-xl border border-gray-200/50 italic">
                  "{recommendation.description}"
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-extrabold text-violet-800 bg-violet-100/60 p-2.5 rounded-xl border border-violet-200">
                <span className="flex h-2 w-2 rounded-full bg-violet-600 animate-ping"></span>
                <span>Target Eksekusi Tindakan:</span>
                <span className="text-violet-950 underline decoration-amber-500 decoration-2">{recommendation.duration}</span>
              </div>
            </div>

            {/* Recommended Practical Steps List */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <h5 className="text-xs font-extrabold text-[#0b1c30] uppercase tracking-wider border-b border-gray-100 pb-2">
                Langkah Kerja Bimbingan (Panduan Praktis Konselor)
              </h5>
              <div className="space-y-3">
                {recommendation.steps.map((step, idx) => (
                  <div key={idx} className="flex gap-3 items-start group">
                    <input
                      type="checkbox"
                      id={`step-${idx}`}
                      className="w-4.5 h-4.5 mt-0.5 text-violet-600 border-gray-300 rounded focus:ring-violet-500 accent-violet-600 cursor-pointer"
                    />
                    <label htmlFor={`step-${idx}`} className="text-xs font-semibold text-gray-700 leading-relaxed cursor-pointer select-none group-hover:text-violet-800 transition-colors">
                      <span className="font-bold text-violet-600 mr-1">Langkah {idx + 1}:</span>
                      {step}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 italic mt-2.5 text-center bg-gray-50 p-2 rounded-xl">
                Centang langkah di atas untuk mempermudah Anda melacak tahapan konseling yang telah sukses dikerjakan.
              </p>
            </div>
          </div>
        )}
          </div>
        </div>
      )}

      {/* Add student Modal overlay */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#0b1c30]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleAddSubmit}
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative border border-[#bcc9c6]/40 animate-in zoom-in-95 duration-200 space-y-4"
          >
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            <div className="border-b border-[#bcc9c6]/20 pb-3">
              <h3 className="text-lg font-bold text-[#0b1c30]">
                Tambah Data Siswa Baru
              </h3>
              <p className="text-xs text-[#3d4947] opacity-75">
                Silakan isi data diri siswa di bawah dengan benar.
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0b1c30]">NISN Siswa</label>
              <input
                type="text"
                value={newNis}
                onChange={(e) => setNewNis(e.target.value.replace(/\D/g, ''))}
                placeholder="Misal: 21221005"
                maxLength={10}
                required
                className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0b1c30]">Nama Lengkap</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nama lengkap siswa"
                required
                className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0b1c30]">Kelas</label>
                <select
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 cursor-pointer"
                >
                  {activeCounselor && activeCounselor.allowedClasses && activeCounselor.allowedClasses.length > 0 ? (
                    activeCounselor.allowedClasses.map((cls) => {
                      const optVal = cls.startsWith('Kelas ') ? cls : `Kelas ${cls}`;
                      return (
                        <option key={optVal} value={optVal}>
                          {optVal}
                        </option>
                      );
                    })
                  ) : (
                    [
                      'Kelas 7A', 'Kelas 7B', 'Kelas 7C', 'Kelas 7D', 'Kelas 7F',
                      'Kelas 8A', 'Kelas 8B', 'Kelas 8C', 'Kelas 8D', 'Kelas 8E', 'Kelas 8F', 'Kelas 8G',
                      'Kelas 9A', 'Kelas 9B', 'Kelas 9C', 'Kelas 9D', 'Kelas 9E', 'Kelas 9F', 'Kelas 9G'
                    ].map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0b1c30]">Gender</label>
                <div className="flex bg-[#eff4ff] p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setNewGender('L')}
                    className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                      newGender === 'L'
                        ? 'bg-white text-[#00685f] shadow-sm'
                        : 'text-[#3d4947] hover:text-[#00685f]'
                    }`}
                  >
                    Laki-laki
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewGender('P')}
                    className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                      newGender === 'P'
                        ? 'bg-white text-[#00685f] shadow-sm'
                        : 'text-[#3d4947] hover:text-[#00685f]'
                    }`}
                  >
                    Perempuan
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3 border-t border-[#bcc9c6]/20">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-97 cursor-pointer"
              >
                Simpan Siswa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Import Modal overlay */}
      {showImportModal && (
        <div className="fixed inset-0 bg-[#0b1c30]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleImportSubmit}
            className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative border border-[#bcc9c6]/40 animate-in zoom-in-95 duration-200 space-y-4"
          >
            <button
              type="button"
              onClick={() => {
                setShowImportModal(false);
                setImportText('');
              }}
              className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            
            <div className="border-b border-[#bcc9c6]/20 pb-3">
              <h3 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#00685f]" />
                <span>Impor Massal Data Siswa</span>
              </h3>
              <p className="text-xs text-[#3d4947] opacity-75">
                Salin baris data dari file <strong>Excel / Google Sheets</strong> Anda (kolom: NISN, Nama, Kelas, Gender) dan tempel di bawah ini, atau tulis format CSV.
              </p>
            </div>

            {/* Instruction Banner */}
            <div className="bg-[#eff4ff] p-3.5 rounded-xl border border-[#00685f]/15 text-xs text-[#0b1c30] space-y-1">
              <p className="font-extrabold text-[#00685f] uppercase tracking-wider text-[10px]">Panduan Format Impor:</p>
              <p className="leading-relaxed font-semibold">
                Setiap baris berisi: <code className="bg-white/80 px-1 py-0.5 rounded font-mono border border-gray-200">NISN, Nama Siswa, Kelas, Gender (L/P)</code>
              </p>
              <p className="leading-relaxed opacity-85">
                <em>Contoh copy-paste langsung dari Excel:</em>
              </p>
              <pre className="bg-white/90 p-2 rounded-lg font-mono text-[10px] text-gray-600 border border-gray-100 overflow-x-auto leading-normal">
{`21221001\tAhmad Fauzi\tKelas 7A\tL
21221002\tSiti Nurhaliza\tKelas 7E\tP`}
              </pre>
            </div>

            {/* File Attachment Dropzone & Textarea Input */}
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileChange(file);
                }}
                className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                  isDragging
                    ? 'border-[#00685f] bg-[#00685f]/5'
                    : 'border-[#bcc9c6]/60 hover:border-[#00685f]/40 bg-[#f8f9ff]'
                }`}
              >
                <input
                  type="file"
                  id="file-attachment-input"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileChange(file);
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="file-attachment-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="p-2.5 bg-white rounded-full shadow-sm text-[#00685f]">
                    <Upload className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0b1c30]">
                      Unggah Lampiran File (.csv atau .txt)
                    </p>
                    <p className="text-[10px] text-[#3d4947] opacity-70 mt-0.5">
                      Klik untuk memilih file atau seret file ke sini
                    </p>
                  </div>
                </label>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0b1c30] block uppercase tracking-wider">
                    Data Siswa (Tersalin / Terbaca dari File)
                  </label>
                  {importText && (
                    <button
                      type="button"
                      onClick={() => setImportText('')}
                      className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                    >
                      Bersihkan
                    </button>
                  )}
                </div>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Format: NISN, Nama Siswa, Kelas, Gender&#10;Contoh: 21221001, Ahmad Fauzi, Kelas 7A, L&#10;Atau cukup: Nama Siswa, Kelas, Gender (NISN akan diisi otomatis)"
                  rows={6}
                  required
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 leading-relaxed"
                />
              </div>
            </div>

            {/* Parser Live Preview */}
            {parsedImportStudents.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#0b1c30]">
                    Pratinjau Hasil Pembacaan ({parsedImportStudents.filter((s) => !s.error).length} valid dari {parsedImportStudents.length} baris)
                  </span>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  <table className="w-full text-[11px] text-left border-collapse bg-gray-50/50">
                    <thead className="bg-gray-100 sticky top-0 text-gray-700 font-bold border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2">NISN</th>
                        <th className="px-3 py-2">Nama Siswa</th>
                        <th className="px-3 py-2">Kelas</th>
                        <th className="px-3 py-2 text-center">L/P</th>
                        <th className="px-3 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {parsedImportStudents.map((st, idx) => (
                        <tr key={idx} className={st.error ? 'bg-red-50/50' : ''}>
                          <td className="px-3 py-1.5 font-mono text-gray-600">{st.nis || '-'}</td>
                          <td className="px-3 py-1.5 font-bold text-gray-800">{st.name || '-'}</td>
                          <td className="px-3 py-1.5 text-gray-600">{st.class}</td>
                          <td className="px-3 py-1.5 text-center font-bold text-gray-600">{st.gender}</td>
                          <td className="px-3 py-1.5 text-right font-medium">
                            {st.error ? (
                              <span className="text-red-600 text-[10px]" title={st.error}>⚠️ Gagal</span>
                            ) : (
                              <span className="text-emerald-600 text-[10px] flex items-center justify-end gap-0.5">✅ Siap</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="pt-4 flex gap-3 border-t border-[#bcc9c6]/20">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportText('');
                }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={parsedImportStudents.filter((s) => !s.error).length === 0}
                className="flex-1 py-2.5 bg-[#00685f] hover:bg-[#005049] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-97 cursor-pointer"
              >
                Impor Sekarang ({parsedImportStudents.filter((s) => !s.error).length} Siswa)
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <span>Data Siswa</span>
            <span className="text-xs bg-[#00685f]/10 text-[#00685f] px-2.5 py-1 rounded-full font-bold">
              {students.length} Terdata
            </span>
          </h2>
          <p className="text-sm text-[#3d4947]/70 font-semibold mt-0.5">
            Manajemen data profil, pelaporan insiden, dan rekam jejak bimbingan siswa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          {onClearAllStudents && students.length > 0 && (
            <button
              onClick={() => {
                if (
                  confirm(
                    'PENTING: Apakah Anda yakin ingin menghapus SELURUH data siswa (termasuk semua data sampel, riwayat pelanggaran, dan konseling) untuk memulai database baru yang kosong?\n\nTindakan ini tidak dapat dibatalkan.'
                  )
                ) {
                  onClearAllStudents();
                  alert('Seluruh data berhasil dibersihkan! Database sekarang kosong dan siap diisi data siswa asli.');
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold transition-all active:scale-97 cursor-pointer"
              title="Kosongkan Database Siswa"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              <span>Kosongkan Database</span>
            </button>
          )}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-[#00685f]/30 hover:bg-[#00685f]/5 text-[#00685f] rounded-xl text-xs font-bold transition-all active:scale-97 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Impor Excel/CSV</span>
          </button>
          <button
            onClick={handlePrintClassRecap}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Cetak rekapitulasi data disiplin seluruh siswa kelas terfilter ke dokumen PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Rekap Kelas (PDF)</span>
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2.5 border border-indigo-200 hover:bg-indigo-50/60 text-indigo-600 rounded-xl text-xs font-bold transition-all active:scale-97 cursor-pointer"
            title="Unduh data siswa terfilter beserta catatan pelanggarannya ke file CSV"
          >
            <Download className="w-4 h-4" />
            <span>Unduh CSV</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg active:scale-97 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-3.5 rounded-2xl border border-[#bcc9c6]/30 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold uppercase text-gray-500 tracking-wider">Total Siswa</span>
            <span className="p-1.5 bg-[#f8f9ff] text-[#00685f] rounded-lg">
              <User className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-extrabold text-[#0b1c30]">{studentStats.total}</h3>
            <span className="text-[10px] text-gray-500 font-bold">L: {studentStats.totalL} | P: {studentStats.totalP}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#bcc9c6]/30 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider">Kondisi Prima</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-extrabold text-emerald-700">{studentStats.primaCount}</h3>
            <span className="text-[10px] text-emerald-600 font-bold">0 Poin Aktif</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#bcc9c6]/30 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold uppercase text-amber-700 tracking-wider">Pendampingan</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-extrabold text-amber-700">{studentStats.pendampinganCount}</h3>
            <span className="text-[10px] text-amber-600 font-bold">1 - 49 Poin</span>
          </div>
        </div>

        <div 
          onClick={() => {
            setFilterDisciplineStatus('kritis');
            setCurrentPage(1);
          }}
          className="bg-white p-3.5 rounded-2xl border border-red-200 shadow-xs flex flex-col justify-between cursor-pointer hover:border-red-400 transition-colors"
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold uppercase text-red-700 tracking-wider">Area Kritis</span>
            <span className="p-1.5 bg-red-50 text-red-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-extrabold text-red-700">{studentStats.kritisCount}</h3>
            <span className="text-[10px] text-red-600 font-bold">≥50 Poin (Klik Filter)</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#bcc9c6]/30 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold uppercase text-purple-700 tracking-wider">Apresiasi</span>
            <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-extrabold text-purple-700">{studentStats.berprestasiCount}</h3>
            <span className="text-[10px] text-purple-600 font-bold">Memiliki Kredit</span>
          </div>
        </div>
      </div>

      {/* Filters & Control Panel */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#bcc9c6]/30 space-y-3">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama atau NISN siswa..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-8 py-2 bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl text-xs font-semibold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Class Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#3d4947] uppercase tracking-wider">
                Kelas:
              </span>
              <select
                value={filterClass}
                onChange={(e) => {
                  setFilterClass(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl text-xs font-semibold py-1.5 px-3 text-[#0b1c30] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#00685f]/50"
              >
                {classesList.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#3d4947] uppercase tracking-wider">
                Gender:
              </span>
              <div className="flex bg-[#f8f9ff] border border-[#bcc9c6]/30 rounded-xl p-0.5">
                {(['Semua', 'L', 'P'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => {
                      setFilterGender(g);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      filterGender === g
                        ? 'bg-white text-[#00685f] shadow-xs'
                        : 'text-[#3d4947] hover:text-[#00685f]'
                    }`}
                  >
                    {g === 'Semua' ? 'Semua' : g}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#3d4947] uppercase tracking-wider">
                Urutkan:
              </span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl text-xs font-semibold py-1.5 px-3 text-[#0b1c30] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#00685f]/50"
              >
                <option value="name-asc">Nama (A - Z)</option>
                <option value="name-desc">Nama (Z - A)</option>
                <option value="points-desc">Poin Disiplin (Tertinggi)</option>
                <option value="achievements-desc">Apresiasi (Tertinggi)</option>
                <option value="services-desc">Sesi BK (Terbanyak)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="pt-2 border-t border-[#bcc9c6]/20 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mr-1">Status Disiplin:</span>
            {[
              { id: 'semua', label: 'Semua Status' },
              { id: 'prima', label: '🟢 Prima (0 Bobot)' },
              { id: 'pendampingan', label: '🟡 Pendampingan (1-49)' },
              { id: 'kritis', label: '🔴 Kritis (≥50)' },
              { id: 'apresiasi', label: '🏆 Berprestasi' },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => {
                  setFilterDisciplineStatus(chip.id as any);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterDisciplineStatus === chip.id
                    ? 'bg-[#00685f] text-white shadow-xs'
                    : 'bg-[#f8f9ff] text-[#3d4947] border border-[#bcc9c6]/30 hover:bg-[#00685f]/5'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <motion.span
              key={filteredStudents.length}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="text-[11px] font-bold text-[#00685f] bg-teal-50 border border-teal-200/70 px-2.5 py-1 rounded-xl"
            >
              {filteredStudents.length} Siswa Ditemukan
            </motion.span>

            {(filterClass !== 'Semua Kelas' || filterGender !== 'Semua' || filterDisciplineStatus !== 'semua' || searchQuery) && (
              <button
                onClick={() => {
                  setFilterClass('Semua Kelas');
                  setFilterGender('Semua');
                  setFilterDisciplineStatus('semua');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="text-xs font-bold text-[#ba1a1a] hover:underline cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid List Table (Desktop & Tablet) & Mobile Card Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#bcc9c6]/30 overflow-hidden">
        {/* Mobile View: Card Grid (<640px) */}
        <div className="block sm:hidden p-3 space-y-3">
          <AnimatePresence mode="popLayout">
            {virtualBounds.visibleStudents.length > 0 ? (
              virtualBounds.visibleStudents.map((student, index) => {
                const rawPoints = student.violationPoints || 0;
                const rewardPoints = student.achievementPoints || 0;
                const netPoints = Math.max(0, rawPoints - rewardPoints);

                const isHighRisk = rawPoints >= 50 || netPoints >= 50;
                const isWarning = rawPoints >= 20 || netPoints >= 20;

                let cardBg = 'bg-white border-gray-200';
                if (isHighRisk) {
                  cardBg = 'bg-rose-50/70 border-rose-200 shadow-2xs';
                } else if (isWarning) {
                  cardBg = 'bg-amber-50/60 border-amber-200 shadow-2xs';
                }

                return (
                  <motion.div
                    key={student.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ scale: 1.01 }}
                    className={`p-3.5 rounded-2xl border transition-colors space-y-3 ${cardBg}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                          isHighRisk ? 'bg-rose-700 text-white' : isWarning ? 'bg-amber-600 text-white' : 'bg-teal-100 text-[#00685f]'
                        }`}>
                          {student.avatarUrl ? (
                            <img src={student.avatarUrl} alt={student.name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                          ) : (
                            <span>{student.initials}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-xs text-[#0b1c30] truncate">{student.name}</h4>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5 font-bold">
                            <span>NIS: {student.nis || '-'}</span>
                            <span>•</span>
                            <span className="px-1.5 py-0.2 bg-gray-200 text-gray-800 rounded font-black">{student.class}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border inline-block ${
                          isHighRisk ? 'bg-rose-100 text-rose-900 border-rose-300' : isWarning ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {netPoints} Poin
                        </span>
                      </div>
                    </div>

                    {/* 1-Click Mobile Actions (Min 44px Touch Targets) */}
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-gray-200/60">
                      <button
                        onClick={() => onNavigateToForm('tambah-layanan', student.id)}
                        className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-extrabold transition-all cursor-pointer shadow-2xs min-h-[44px]"
                        title="Konseling BK"
                      >
                        <HeartHandshake className="w-4 h-4" />
                        <span>Konseling</span>
                      </button>

                      <button
                        onClick={() => onNavigateToForm('panggilan-ortu', student.name)}
                        className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[11px] font-extrabold transition-all cursor-pointer shadow-2xs min-h-[44px]"
                        title="Panggil Ortu"
                      >
                        <Mail className="w-4 h-4" />
                        <span>Panggil</span>
                      </button>

                      <button
                        onClick={() => setShowDossierModal(student)}
                        className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-[11px] font-extrabold transition-all cursor-pointer shadow-2xs min-h-[44px]"
                        title="Dossier"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Dossier</span>
                      </button>
                    </div>

                    {/* Secondary Quick Actions */}
                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                      <span className="font-semibold text-[10px]">Aksi Tambahan:</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingStudent(student)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Edit Profil"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            const sViolations = violations.filter((v) => v.studentId === student.id);
                            const sServices = services.filter((s) => s.students.some((st) => st.id === student.id));
                            downloadStudentRecapPDF(student, sViolations, sServices);
                          }}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Rapor BK PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onNavigateToForm('pelanggaran', student.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Catat Pelanggaran"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setDiagnosisStudent(student)}
                          className="p-2 text-teal-700 hover:bg-teal-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Diagnosa AI"
                        >
                          <Brain className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`Hapus data ${student.name}?`)) {
                              onDeleteStudent(student.id);
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <motion.div
                key="empty-mobile"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="p-6 text-center text-xs text-gray-500 font-bold"
              >
                Tidak ada data siswa ditemukan.
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop View: Full Table (>=640px) */}
        <div 
          ref={tableContainerRef}
          onScroll={handleScroll}
          className="hidden sm:block overflow-x-auto max-h-[600px] overflow-y-auto"
        >
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[#f8f9ff] border-b border-[#bcc9c6]/30 sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3.5 font-bold text-[#3d4947] uppercase text-xs">No</th>
                <th className="px-5 py-3.5 font-bold text-[#3d4947] uppercase text-xs">NISN</th>
                <th className="px-5 py-3.5 font-bold text-[#3d4947] uppercase text-xs">Nama Siswa</th>
                <th className="px-5 py-3.5 font-bold text-[#3d4947] uppercase text-xs">Kelas</th>
                <th className="px-5 py-3.5 font-bold text-[#3d4947] uppercase text-xs">Gender</th>
                <th className="px-5 py-3.5 font-bold text-[#3d4947] uppercase text-xs">Status Disiplin</th>
                <th className="px-5 py-3.5 font-bold text-[#3d4947] uppercase text-xs text-center">Sesi BK</th>
                <th className="px-5 py-3.5 font-bold text-[#3d4947] uppercase text-xs text-center">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bcc9c6]/20 relative">
              <AnimatePresence mode="popLayout" initial={false}>
                {virtualBounds.visibleStudents.length > 0 ? (
                  virtualBounds.visibleStudents.map((student, index) => {
                    const globalIndex = isVirtualScroll 
                      ? virtualBounds.startIndex + index + 1 
                      : (currentPage - 1) * itemsPerPage + index + 1;
                  const rawPoints = student.violationPoints;
                  const rewardPoints = student.achievementPoints || 0;
                  const netPoints = Math.max(0, rawPoints - rewardPoints);

                  const isExceedThreshold = rawPoints >= 30 || netPoints >= 30;
                  const isCriticalThreshold = rawPoints >= 50 || netPoints >= 50;

                  // Render status label & badge
                  let pointBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  let statusText = 'Kondisi Prima';
                  if (netPoints >= 100) {
                    pointBadge = 'bg-red-600 text-white border-red-700 font-black shadow-xs';
                    statusText = 'Sidang Dewan Guru';
                  } else if (netPoints >= 50) {
                    pointBadge = 'bg-red-100 text-red-800 border-red-300 font-extrabold animate-pulse';
                    statusText = 'Eskalasi BK (Kritis)';
                  } else if (netPoints >= 30) {
                    pointBadge = 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold';
                    statusText = 'Batas Bobot Siaga';
                  } else if (netPoints > 0) {
                    pointBadge = 'bg-yellow-50 text-yellow-800 border-yellow-200';
                    statusText = 'Pendampingan';
                  }

                  // Red/Yellow highlight row background for risk level indicators
                  let rowStyleClass = 'hover:bg-[#f8f9ff] transition-colors group';
                  if (rawPoints >= 50 || netPoints >= 50) {
                    rowStyleClass = 'bg-rose-50/50 hover:bg-rose-100/70 transition-colors group border-l-4 border-l-rose-500 shadow-2xs';
                  } else if (rawPoints >= 20 || netPoints >= 20) {
                    rowStyleClass = 'bg-amber-50/40 hover:bg-amber-100/60 transition-colors group border-l-4 border-l-amber-400 shadow-2xs';
                  }

                  return (
                    <motion.tr
                      key={student.id}
                      layout
                      initial={{ opacity: 0, scale: 0.98, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98, y: -6 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className={rowStyleClass}
                    >
                      <td className="px-5 py-4 text-gray-500 font-semibold text-xs">
                        {globalIndex}
                      </td>
                      <td className="px-5 py-4 font-bold text-gray-700 text-xs">
                        {student.nis}
                      </td>
                      <td className="px-5 py-4 font-bold text-[#0b1c30]">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${isExceedThreshold ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-[#eff4ff] text-[#00685f]'} flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0 shadow-2xs`}>
                            {student.avatarUrl ? (
                              <img
                                src={student.avatarUrl}
                                alt={student.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span>{student.initials}</span>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`truncate max-w-[180px] text-xs font-bold ${isExceedThreshold ? 'text-rose-950 font-extrabold' : 'text-[#0b1c30]'}`}>
                                {student.name}
                              </span>
                              {isExceedThreshold && (
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 text-[9px] font-extrabold rounded-md flex items-center gap-1 shadow-2xs">
                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                  <span>PERINGATAN DINI</span>
                                </span>
                              )}
                            </div>
                            {isExceedThreshold && (
                              <span className="text-[10px] text-rose-800 font-bold mt-0.5">
                                ⚠️ Melampaui Ambang Batas ({rawPoints} Bobot)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-gray-600 text-xs">
                        {student.class}
                      </td>
                      <td className="px-5 py-4 font-semibold text-gray-500 text-xs">
                        {student.gender}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${pointBadge} w-fit`}
                            >
                              {netPoints} Bobot ({statusText})
                            </span>
                          </div>
                          {rewardPoints > 0 && (
                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-0.5 w-fit">
                              <Award className="w-3 h-3 text-emerald-500" />
                              <span>+{rewardPoints} Apresiasi</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-gray-700 text-xs">
                        <span className="inline-block bg-gray-100 px-2.5 py-1 rounded-lg text-gray-700">
                          {student.bkServicesCount} Sesi
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-center gap-1.5 min-w-[220px]">
                          {/* 🟢 1-Click Action 1: Konseling BK */}
                          <button
                            onClick={() => onNavigateToForm('tambah-layanan', student.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                            title="🟢 Membuka form layanan BK / Konseling"
                          >
                            <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Konseling BK</span>
                          </button>

                          {/* 🟡 1-Click Action 2: Panggil Ortu */}
                          <button
                            onClick={() => onNavigateToForm('panggilan-ortu', student.name)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                            title="🟡 Mengarahkan ke pembuat surat panggilan ortu"
                          >
                            <Mail className="w-3.5 h-3.5 text-amber-600" />
                            <span>Panggil Ortu</span>
                          </button>

                          {/* 🔴 1-Click Action 3: Dossier & Rekam Jejak */}
                          <button
                            onClick={() => setShowDossierModal(student)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                            title="🔴 Melihat rekapitulasi bobot & rekam jejak"
                          >
                            <Eye className="w-3.5 h-3.5 text-rose-600" />
                            <span>Dossier</span>
                          </button>

                          {/* Secondary Utility Icons */}
                          <div className="flex items-center gap-1 pl-1 border-l border-gray-200">
                            <button
                              onClick={() => setEditingStudent(student)}
                              className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                              title="Edit Profil Siswa"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                const sViolations = violations.filter((v) => v.studentId === student.id);
                                const sServices = services.filter((s) => s.students.some((st) => st.id === student.id));
                                downloadStudentRecapPDF(student, sViolations, sServices);
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                              title="Unduh Rekap Rapor BK PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onNavigateToForm('pelanggaran', student.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              title="Catat Pelanggaran / Pembinaan"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setDiagnosisStudent(student)}
                              className="p-1 text-teal-700 hover:bg-teal-50 rounded-md transition-colors cursor-pointer"
                              title="Diagnosa Perilaku AI Gemini"
                            >
                              <Brain className="w-3.5 h-3.5" />
                            </button>

                            {/* Email Notification */}
                            <button
                              onClick={() =>
                                setEmailDraftData({
                                  studentName: student.name,
                                  studentClass: student.class,
                                  studentNis: student.nis,
                                  netPoints: Math.max(0, student.violationPoints - (student.achievementPoints || 0)),
                                  riskLevel: student.violationPoints >= 50 ? 'Kritis' : student.violationPoints >= 25 ? 'Perhatian Khusus' : 'Sedang'
                                })
                              }
                              className="p-1 text-amber-700 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                              title="Kirim Email Notifikasi (Ortu & Wali Kelas)"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Entry */}
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Apakah Anda yakin ingin menghapus data siswa ${student.name}? Semua riwayat pelanggaran dan konseling akan dihapus.`
                                  )
                                ) {
                                  onDeleteStudent(student.id);
                                  alert('Data siswa berhasil terhapus.');
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-[#ba1a1a] hover:bg-[#ba1a1a]/10 rounded-md transition-colors cursor-pointer"
                              title="Hapus Siswa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              ) : (
                /* Empty state */
                <motion.tr
                  key="empty-table-state"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-xs mx-auto space-y-3">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <Search className="w-8 h-8 text-gray-400" />
                      </div>
                      <h4 className="font-bold text-[#0b1c30] text-base">
                        Data Tidak Ditemukan
                      </h4>
                      <p className="text-xs text-[#3d4947]/70 font-semibold leading-relaxed">
                        Kami tidak dapat menemukan data siswa dengan kata kunci atau filter tersebut. Coba reset pencarian Anda.
                      </p>
                      <button
                        onClick={() => {
                          setFilterClass('Semua Kelas');
                          setFilterGender('Semua');
                          setSearchQuery('');
                          setCurrentPage(1);
                        }}
                        className="px-4 py-2 border border-[#00685f] text-[#00685f] rounded-xl text-xs font-bold hover:bg-[#00685f]/5 transition-colors cursor-pointer"
                      >
                        Reset Semua Filter
                      </button>
                    </div>
                  </td>
                </motion.tr>
              )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Status Bar Continuous Scroll */}
        <div className="p-4 bg-[#f8f9ff] border-t border-[#bcc9c6]/30 flex items-center justify-between">
          <span className="text-xs font-bold text-[#00685f] flex items-center gap-1.5">
            <span>📜 List Terbuka Lengkap (Scroll Tanpa Halaman):</span>
            <span className="text-gray-700 font-extrabold">Menampilkan {totalItems} siswa</span>
          </span>
          <span className="text-[10px] bg-[#00685f]/10 text-[#00685f] px-3 py-1 rounded-full font-black uppercase">
            Pencarian & Gulir Aktif
          </span>
        </div>
      </div>

      {/* MODAL EDIT PROFIL SISWA */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden border border-[#bcc9c6]/30 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-5 border-b border-[#bcc9c6]/20 bg-[#f8f9ff] flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-[#0b1c30] text-base flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-[#00685f]" />
                  <span>Edit Profil Siswa</span>
                </h3>
                <p className="text-xs text-[#3d4947]/70 font-semibold mt-0.5">
                  Perbarui NISN, nama, kelas, atau gender siswa
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-1.5 hover:bg-gray-200 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onUpdateStudent && editingStudent) {
                  onUpdateStudent(editingStudent);
                  alert(`Data siswa ${editingStudent.name} berhasil diperbarui!`);
                }
                setEditingStudent(null);
              }}
              className="p-6 space-y-4 text-xs"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  NIS / NISN
                </label>
                <input
                  type="text"
                  required
                  value={editingStudent.nis}
                  onChange={(e) => setEditingStudent({ ...editingStudent, nis: e.target.value })}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Nama Lengkap Siswa
                </label>
                <input
                  type="text"
                  required
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Kelas
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStudent.class}
                    onChange={(e) => setEditingStudent({ ...editingStudent, class: e.target.value })}
                    className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Jenis Kelamin
                  </label>
                  <select
                    value={editingStudent.gender}
                    onChange={(e) => setEditingStudent({ ...editingStudent, gender: e.target.value as 'L' | 'P' })}
                    className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f] cursor-pointer"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-[#bcc9c6]/20">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT PELANGGARAN */}
      {editingViolation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden border border-[#bcc9c6]/30 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-[#bcc9c6]/20 bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-[#0b1c30] text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#ba1a1a]" />
                  <span>Edit Catatan Pelanggaran</span>
                </h3>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">
                  Siswa: {editingViolation.studentName} ({editingViolation.studentClass})
                </p>
              </div>
              <button
                onClick={() => setEditingViolation(null)}
                className="p-1.5 hover:bg-gray-200 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onUpdateViolation) {
                  onUpdateViolation(editingViolation);
                }
                setEditingViolation(null);
                alert('Catatan pelanggaran berhasil diperbarui.');
              }}
              className="p-6 space-y-4 overflow-y-auto flex-1 text-xs"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Kategori Pelanggaran</label>
                  <input
                    type="text"
                    required
                    value={editingViolation.category}
                    onChange={(e) => setEditingViolation({ ...editingViolation, category: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Bobot Pelanggaran</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editingViolation.pointsAdded}
                    onChange={(e) => setEditingViolation({ ...editingViolation, pointsAdded: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={editingViolation.date}
                    onChange={(e) => setEditingViolation({ ...editingViolation, date: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Waktu</label>
                  <input
                    type="time"
                    required
                    value={editingViolation.time}
                    onChange={(e) => setEditingViolation({ ...editingViolation, time: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Lokasi</label>
                  <input
                    type="text"
                    required
                    value={editingViolation.location}
                    onChange={(e) => setEditingViolation({ ...editingViolation, location: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Pelapor (Guru / Staff)</label>
                  <input
                    type="text"
                    required
                    value={editingViolation.reportedBy}
                    onChange={(e) => setEditingViolation({ ...editingViolation, reportedBy: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Keterangan Kejadian</label>
                <textarea
                  rows={2}
                  required
                  value={editingViolation.notes}
                  onChange={(e) => setEditingViolation({ ...editingViolation, notes: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Pihak yang Menangani</label>
                  <select
                    value={editingViolation.handledBy || 'Belum Ditangani'}
                    onChange={(e) => setEditingViolation({ 
                      ...editingViolation, 
                      handledBy: e.target.value as any 
                    })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f] cursor-pointer"
                  >
                    <option value="Belum Ditangani">Belum Ditangani</option>
                    <option value="Wali Kelas">Wali Kelas</option>
                    <option value="Guru BK">Guru BK</option>
                    <option value="Wali Kelas & Guru BK">Wali Kelas & Guru BK</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Progress Penanganan</label>
                  <input
                    type="text"
                    placeholder="Siswa dipanggil, diberikan nasihat, dsb..."
                    value={editingViolation.handlingProgress || ''}
                    onChange={(e) => setEditingViolation({ ...editingViolation, handlingProgress: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#bcc9c6]/20">
                <button
                  type="button"
                  onClick={() => setEditingViolation(null)}
                  className="flex-1 py-2.5 px-4 border border-gray-300 hover:bg-gray-50 text-gray-700 font-extrabold rounded-xl transition-all active:scale-97 cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold rounded-xl transition-all shadow-md active:scale-97 cursor-pointer text-center"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT LAYANAN BK */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden border border-[#bcc9c6]/30 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-[#bcc9c6]/20 bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-[#0b1c30] text-lg flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-[#00685f]" />
                  <span>Edit Rekam Layanan BK</span>
                </h3>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">
                  Arsip Sesi Bimbingan & Konseling
                </p>
              </div>
              <button
                onClick={() => setEditingService(null)}
                className="p-1.5 hover:bg-gray-200 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onUpdateService) {
                  onUpdateService(editingService);
                }
                setEditingService(null);
                alert('Data layanan BK berhasil diperbarui.');
              }}
              className="p-6 space-y-4 overflow-y-auto flex-1 text-xs"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Jenis Layanan BK</label>
                <select
                  value={editingService.serviceType}
                  onChange={(e) => setEditingService({ ...editingService, serviceType: e.target.value as any })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f] cursor-pointer"
                >
                  <option value="Layanan Orientasi">Layanan Orientasi</option>
                  <option value="Layanan Informasi">Layanan Informasi</option>
                  <option value="Layanan Penempatan dan Penyaluran">Layanan Penempatan dan Penyaluran</option>
                  <option value="Layanan Penguasaan Konten">Layanan Penguasaan Konten</option>
                  <option value="Layanan Konseling Perorangan (Individual)">Layanan Konseling Perorangan (Individual)</option>
                  <option value="Layanan Bimbingan Kelompok">Layanan Bimbingan Kelompok</option>
                  <option value="Layanan Konseling Kelompok">Layanan Konseling Kelompok</option>
                  <option value="Layanan Konsultasi">Layanan Konsultasi</option>
                  <option value="Layanan Mediasi">Layanan Mediasi</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={editingService.date}
                    onChange={(e) => setEditingService({ ...editingService, date: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Waktu Mulai</label>
                  <input
                    type="time"
                    required
                    value={editingService.startTime}
                    onChange={(e) => setEditingService({ ...editingService, startTime: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Waktu Selesai</label>
                  <input
                    type="time"
                    required
                    value={editingService.endTime}
                    onChange={(e) => setEditingService({ ...editingService, endTime: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Pokok Masalah / Pembahasan</label>
                <input
                  type="text"
                  required
                  value={editingService.problem}
                  onChange={(e) => setEditingService({ ...editingService, problem: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Deskripsi Kasus & Analisis</label>
                <textarea
                  rows={2}
                  required
                  value={editingService.description}
                  onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Status Kasus</label>
                  <select
                    value={editingService.status}
                    onChange={(e) => setEditingService({ ...editingService, status: e.target.value as any })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f] cursor-pointer"
                  >
                    <option value="Terjadwal">Terjadwal</option>
                    <option value="Selesai">Selesai</option>
                    <option value="Dibatalkan">Dibatalkan</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Rencana Tindak Lanjut</label>
                  <input
                    type="text"
                    required
                    value={editingService.followUp}
                    onChange={(e) => setEditingService({ ...editingService, followUp: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Hasil Akhir / Kesepakatan (Output)</label>
                <textarea
                  rows={2}
                  required
                  value={editingService.output}
                  onChange={(e) => setEditingService({ ...editingService, output: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#bcc9c6]/20">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="flex-1 py-2.5 px-4 border border-gray-300 hover:bg-gray-50 text-gray-700 font-extrabold rounded-xl transition-all active:scale-97 cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold rounded-xl transition-all shadow-md active:scale-97 cursor-pointer text-center"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT POIN APRESIASI */}
      {editingAchievement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden border border-[#bcc9c6]/30 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-[#bcc9c6]/20 bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-[#0b1c30] text-lg flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <span>Edit Bobot Apresiasi Siswa</span>
                </h3>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">
                  Siswa: {editingAchievement.studentName} ({editingAchievement.studentClass})
                </p>
              </div>
              <button
                onClick={() => setEditingAchievement(null)}
                className="p-1.5 hover:bg-gray-200 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onUpdateAchievement) {
                  onUpdateAchievement(editingAchievement);
                }
                setEditingAchievement(null);
                alert('Bobot apresiasi berhasil diperbarui.');
              }}
              className="p-6 space-y-4 overflow-y-auto flex-1 text-xs"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Kategori</label>
                  <select
                    value={editingAchievement.category}
                    onChange={(e) => setEditingAchievement({ ...editingAchievement, category: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="Akademik">Akademik</option>
                    <option value="Olahraga & Seni">Olahraga & Seni</option>
                    <option value="Kedisiplinan">Kedisiplinan</option>
                    <option value="Sosial">Sosial / Kepedulian</option>
                    <option value="Keagamaan">Keagamaan</option>
                    <option value="Kebersihan">Kebersihan & Lingkungan</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Bobot Apresiasi</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editingAchievement.pointsReward}
                    onChange={(e) => setEditingAchievement({ ...editingAchievement, pointsReward: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Nama Pencapaian / Aksi Positif</label>
                <input
                  type="text"
                  required
                  value={editingAchievement.achievementName}
                  onChange={(e) => setEditingAchievement({ ...editingAchievement, achievementName: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Tanggal</label>
                  <input
                    type="text"
                    required
                    value={editingAchievement.date}
                    onChange={(e) => setEditingAchievement({ ...editingAchievement, date: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Dicatat Oleh</label>
                  <input
                    type="text"
                    required
                    value={editingAchievement.recordedBy}
                    onChange={(e) => setEditingAchievement({ ...editingAchievement, recordedBy: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Konteks / Catatan Ringkas</label>
                <input
                  type="text"
                  value={editingAchievement.notes || ''}
                  onChange={(e) => setEditingAchievement({ ...editingAchievement, notes: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Keterangan Tambahan / Catatan Khusus Guru</label>
                <textarea
                  rows={2}
                  value={editingAchievement.extraNotes || ''}
                  onChange={(e) => setEditingAchievement({ ...editingAchievement, extraNotes: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#bcc9c6]/20">
                <button
                  type="button"
                  onClick={() => setEditingAchievement(null)}
                  className="flex-1 py-2.5 px-4 border border-gray-300 hover:bg-gray-50 text-gray-700 font-extrabold rounded-xl transition-all active:scale-97 cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all shadow-md active:scale-97 cursor-pointer text-center"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print-friendly Student Profile Preview Overlay */}
      {printStudent && printData && (
        <div className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-6 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0 print:overflow-visible print:z-0">
          <div className="bg-white rounded-none sm:rounded-2xl w-full max-w-4xl shadow-2xl relative border border-gray-200 flex flex-col max-h-screen sm:max-h-[95vh] overflow-hidden print:max-h-none print:h-auto print:overflow-visible print:border-none print:shadow-none print:p-0">
            
            {/* Top Toolbar (no-print) */}
            <div className="bg-gray-100 border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4 no-print flex-shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-teal-700" />
                <div>
                  <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider">
                    Pratinjau Cetak Profil Siswa
                  </h3>
                  <p className="text-[10px] text-gray-500 font-semibold leading-relaxed">
                    Dokumen siap cetak. Gunakan tombol di kanan atau tekan Ctrl+P untuk mencetak melalui peramban.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer hover:shadow active:scale-97"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Sekarang (Print)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintStudent(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-97"
                >
                  <X className="w-4 h-4" />
                  <span>Tutup</span>
                </button>
              </div>
            </div>

            {/* Scrollable Printable Sheet Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-50 print:bg-white print:p-0 print:overflow-visible">
              
              {/* Paper Sheet Simulation */}
              <div 
                id="print-profile-area" 
                className="bg-white p-8 max-w-[210mm] min-h-[297mm] mx-auto shadow-md border border-gray-200 font-sans text-gray-900 leading-normal print:shadow-none print:border-none print:p-0"
              >
                {/* Print Stylesheet Injector */}
                <style dangerouslySetInnerHTML={{ __html: `
                  @media print {
                    body {
                      background: white !important;
                      color: black !important;
                    }
                    /* Hide everything except root wrapper */
                    body > *:not(#root) {
                      display: none !important;
                    }
                    /* Reset wrappers to let contents flow full-height without truncation */
                    #root, #root > div, main, .max-w-7xl, .lg\\:pl-64, .mt-16 {
                      display: block !important;
                      padding: 0 !important;
                      margin: 0 !important;
                      width: 100% !important;
                      max-width: 100% !important;
                      position: static !important;
                      transform: none !important;
                      box-shadow: none !important;
                      border: none !important;
                    }
                    /* Hide sidebar, header, and other controls */
                    header, aside, sidebar, nav, button, .no-print, .no-print-wrapper {
                      display: none !important;
                      height: 0 !important;
                      padding: 0 !important;
                      margin: 0 !important;
                    }
                    #print-profile-area {
                      display: block !important;
                      width: 100% !important;
                      padding: 0px !important;
                      margin: 0px !important;
                      border: none !important;
                      box-shadow: none !important;
                      position: static !important;
                    }
                    /* Ensure tables render correct black-ink borders in print */
                    table {
                      border-collapse: collapse !important;
                      width: 100% !important;
                    }
                    th, td {
                      border: 1px solid #000000 !important;
                      padding: 6px 8px !important;
                      text-align: left !important;
                      color: #000000 !important;
                    }
                    th {
                      background-color: #f0f0f0 !important;
                      font-weight: bold !important;
                    }
                    /* Standard print utilities */
                    .flex { display: flex !important; }
                    .grid { display: grid !important; }
                    .justify-between { justify-content: space-between !important; }
                    .items-center { align-items: center !important; }
                    .gap-4 { gap: 1rem !important; }
                    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                  }
                `}} />

                {/* FORMAL KOP SURAT (Letterhead) */}
                <div className="border-b-4 border-double border-black pb-4 mb-6 text-center relative flex flex-row items-center justify-between gap-4">
                  {/* Left Logo (Government Shield / Placeholder) */}
                  <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center border border-black/10 rounded-sm">
                    <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  </div>

                  {/* Letterhead Text */}
                  <div className="flex-1 text-center">
                    <h4 className="text-xs font-bold uppercase tracking-wider leading-tight">
                      PEMERINTAH KABUPATEN SEMARANG
                    </h4>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider leading-tight">
                      DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA
                    </h4>
                    <h2 className="text-base font-extrabold uppercase tracking-wide leading-tight mt-0.5">
                      {getSchoolConfig().schoolName}
                    </h2>
                    <p className="text-[9px] font-semibold text-gray-600 mt-1">
                      {getSchoolConfig().schoolAddress}
                    </p>
                  </div>

                  {/* Right Logo (School Badge Placeholder) */}
                  <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center border border-black/10 rounded-sm">
                    <svg className="w-12 h-12 text-teal-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                </div>

                {/* DOCUMENT TITLE */}
                <div className="text-center mb-6">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-black underline">
                    DOKUMEN REKAPITULASI & PROFIL PERKEMBANGAN SISWA
                  </h3>
                  <p className="text-[9px] text-gray-500 font-extrabold uppercase tracking-widest mt-0.5">
                    Sifat: Rahasia Internal Bimbingan Konseling (BK)
                  </p>
                </div>

                {/* STUDENT BIODATA GRID */}
                <div className="grid grid-cols-2 gap-4 border border-black p-4 rounded-lg mb-6 text-xs">
                  <div className="space-y-1.5">
                    <div className="flex">
                      <span className="w-24 font-bold text-gray-500">Nama Siswa</span>
                      <span className="mr-2">:</span>
                      <span className="font-extrabold text-gray-900 uppercase">{printStudent.name}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 font-bold text-gray-500">NISN / NIS</span>
                      <span className="mr-2">:</span>
                      <span className="font-semibold text-gray-900">{printStudent.nis}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 font-bold text-gray-500">Kelas / Rombel</span>
                      <span className="mr-2">:</span>
                      <span className="font-bold text-gray-900">{printStudent.class}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 font-bold text-gray-500">Jenis Kelamin</span>
                      <span className="mr-2">:</span>
                      <span className="font-semibold text-gray-900">
                        {printStudent.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 border-l border-gray-200 pl-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-500">Bobot Pelanggaran</span>
                      <span className="font-extrabold text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded">
                        {printStudent.violationPoints} Bobot
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-500">Bobot Apresiasi</span>
                      <span className="font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded">
                        +{printStudent.achievementPoints || 0} Bobot
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-500">Net Akumulasi Bobot</span>
                      <span className={`font-extrabold px-2.5 py-0.5 rounded border ${
                        Math.max(0, printStudent.violationPoints - (printStudent.achievementPoints || 0)) > 50
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : 'bg-teal-50 text-teal-800 border-teal-200'
                      }`}>
                        {Math.max(0, printStudent.violationPoints - (printStudent.achievementPoints || 0))} Bobot
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-500">Eskalasi Status</span>
                      <span className="font-extrabold text-[#00685f]">
                        {printStudent.violationPoints <= 20 ? 'Level I (Pembinaan Wali Kelas)' :
                         printStudent.violationPoints <= 50 ? 'Level II (Eskalasi Guru BK)' :
                         printStudent.violationPoints <= 75 ? 'Level III (Sidang Dewan Guru)' :
                         'Level IV (Tindakan Tegas Kepala Sekolah)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECTION I: STUDENT ACHIEVEMENT RECORDS */}
                <div className="mb-6">
                  <h4 className="text-[11px] font-extrabold text-black uppercase tracking-wider mb-2 border-b border-black pb-1">
                    I. RIWAYAT PRESTASI & BOBOT APRESIASI POSITIF ({printData.studentAchievements.length})
                  </h4>
                  {printData.studentAchievements.length > 0 ? (
                    <table className="w-full text-[10px] border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100 text-gray-800 font-bold border-b border-gray-300">
                          <th className="border border-gray-300 px-2 py-1.5 text-center w-8">No</th>
                          <th className="border border-gray-300 px-2 py-1.5 w-24">Tanggal</th>
                          <th className="border border-gray-300 px-2 py-1.5">Nama Prestasi / Aksi Positif</th>
                          <th className="border border-gray-300 px-2 py-1.5 w-24 text-center">Bobot</th>
                          <th className="border border-gray-300 px-2 py-1.5">Pencatat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printData.studentAchievements.map((a, index) => (
                          <tr key={a.id} className="border-b border-gray-200">
                            <td className="border border-gray-300 px-2 py-1.5 text-center">{index + 1}</td>
                            <td className="border border-gray-300 px-2 py-1.5 font-medium">{a.date}</td>
                            <td className="border border-gray-300 px-2 py-1.5 font-bold text-teal-800">
                              {a.achievementName}
                              {a.notes && <p className="text-[9px] text-gray-500 font-normal italic mt-0.5">"{a.notes}"</p>}
                            </td>
                            <td className="border border-gray-300 px-2 py-1.5 text-center font-extrabold text-emerald-600">+{a.pointsReward}</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-gray-600">{a.recordedBy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-[10px] text-gray-500 italic bg-gray-50 p-3 rounded text-center border border-dashed border-gray-300">
                      Nihil - Belum ada riwayat prestasi atau pencatatan bobot apresiasi positif.
                    </p>
                  )}
                </div>

                {/* SECTION II: VIOLATION HISTORY */}
                <div className="mb-6">
                  <h4 className="text-[11px] font-extrabold text-black uppercase tracking-wider mb-2 border-b border-black pb-1">
                    II. RIWAYAT PELANGGARAN & INDISIPLIN ({printData.studentViolations.length})
                  </h4>
                  {printData.studentViolations.length > 0 ? (
                    <table className="w-full text-[10px] border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100 text-gray-800 font-bold border-b border-gray-300">
                          <th className="border border-gray-300 px-2 py-1.5 text-center w-8">No</th>
                          <th className="border border-gray-300 px-2 py-1.5 w-24">Tanggal</th>
                          <th className="border border-gray-300 px-2 py-1.5">Pelanggaran</th>
                          <th className="border border-gray-300 px-2 py-1.5 w-20 text-center">Bobot</th>
                          <th className="border border-gray-300 px-2 py-1.5">Catatan Kasus / Tempat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printData.studentViolations.map((v, index) => (
                          <tr key={v.id} className="border-b border-gray-200">
                            <td className="border border-gray-300 px-2 py-1.5 text-center">{index + 1}</td>
                            <td className="border border-gray-300 px-2 py-1.5 font-medium">{v.date}</td>
                            <td className="border border-gray-300 px-2 py-1.5 font-bold text-red-800">{v.category}</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-center font-extrabold text-red-600">{v.pointsAdded}</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-gray-700">
                              <span className="font-semibold">{v.notes || '-'}</span>
                              <p className="text-[9px] text-gray-500 italic mt-0.5">Lokasi: {v.location || 'Lingkungan Sekolah'}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-[10px] text-gray-500 italic bg-gray-50 p-3 rounded text-center border border-dashed border-gray-300">
                      Nihil - Siswa ini memiliki rekam jejak kedisiplinan yang bersih (tidak ada catatan pelanggaran).
                    </p>
                  )}
                </div>

                {/* SECTION III: COUNSELING SERVICES */}
                <div className="mb-6">
                  <h4 className="text-[11px] font-extrabold text-black uppercase tracking-wider mb-2 border-b border-black pb-1">
                    III. RIWAYAT KETERLIBATAN BIMBINGAN & KONSELING ({printData.studentServices.length})
                  </h4>
                  {printData.studentServices.length > 0 ? (
                    <table className="w-full text-[10px] border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100 text-gray-800 font-bold border-b border-gray-300">
                          <th className="border border-gray-300 px-2 py-1.5 text-center w-8">No</th>
                          <th className="border border-gray-300 px-2 py-1.5 w-24">Tanggal</th>
                          <th className="border border-gray-300 px-2 py-1.5 w-48">Jenis Layanan</th>
                          <th className="border border-gray-300 px-2 py-1.5">Fokus Permasalahan / Solusi BK</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printData.studentServices.map((s, index) => (
                          <tr key={s.id} className="border-b border-gray-200">
                            <td className="border border-gray-300 px-2 py-1.5 text-center">{index + 1}</td>
                            <td className="border border-gray-300 px-2 py-1.5 font-medium">{s.date}</td>
                            <td className="border border-gray-300 px-2 py-1.5 font-bold text-teal-800">{s.serviceType}</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-gray-700">
                              <span className="font-semibold block text-gray-900">{s.problem}</span>
                              <p className="text-[9px] text-gray-500 mt-0.5">Hasil/Tindak Lanjut: {s.followUp}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-[10px] text-gray-500 italic bg-gray-50 p-3 rounded text-center border border-dashed border-gray-300">
                      Nihil - Siswa belum memiliki riwayat bimbingan konseling personal di sekolah.
                    </p>
                  )}
                </div>

                {/* SECTION IV: COUNSELOR RECOMMENDATIONS */}
                <div className="border border-black p-4 rounded-lg mb-8 text-xs">
                  <h4 className="font-bold text-black uppercase mb-1.5">
                    IV. REKOMENDASI DAN TINDAK LANJUT GURU BK:
                  </h4>
                  <div className="space-y-1 text-gray-700 leading-relaxed font-medium">
                    {printStudent.violationPoints === 0 ? (
                      <p>Siswa menunjukkan sikap, kedisiplinan, dan budi pekerti yang sangat baik serta patut diteladani. Disarankan untuk mempertahankan prestasi karakter ini dan terus berpartisipasi dalam program-program apresiasi positif di sekolah.</p>
                    ) : printStudent.violationPoints <= 20 ? (
                      <p>Rekomendasi Tahap I: Siswa berada dalam rentang pembinaan ringan. Wali kelas direkomendasikan melakukan bimbingan intensif persuasif secara mandiri di kelas, mengamati perubahan harian, dan memperbanyak ruang apresiasi bagi aksi positif siswa.</p>
                    ) : printStudent.violationPoints <= 50 ? (
                      <p>Rekomendasi Tahap II (Siaga): Kolaborasi wali kelas dan Guru BK wajib ditingkatkan. Perlu dipanggil Orang Tua/Wali (Panggilan I) untuk merancang komitmen tertulis bersama demi memulihkan motivasi kedisiplinan siswa di sekolah.</p>
                    ) : printStudent.violationPoints <= 75 ? (
                      <p>Rekomendasi Tahap III (Sidang Dewan Guru): Eskalasi ke Sidang Kasus BK yang melibatkan Dewan Guru dan Komite Sekolah. Pemanggilan Orang Tua II wajib segera diselenggarakan untuk menegaskan sanksi mengikat dan penugasan khusus pembinaan.</p>
                    ) : (
                      <p>Rekomendasi Tahap IV (Tindakan Kritis): Penanganan diserahkan penuh kepada Kepala Sekolah. Diperlukan tindakan tegas terukur, pengembalian sementara siswa kepada Orang Tua/Wali, atau komitmen bermeterai keras di hadapan jajaran pimpinan sekolah.</p>
                    )}
                    <div className="mt-3 border-t border-gray-200 pt-2 flex flex-col gap-1 text-[10px] text-gray-500 italic">
                      <span>* Catatan: Catatan profil ini dicetak langsung dari sistem digital Portal BK {getSchoolConfig().schoolName}.</span>
                      <span>* Sifat dokumen: Rahasia, hanya digunakan untuk pembinaan internal dewan guru dan kepentingan orang tua wali siswa.</span>
                    </div>
                  </div>
                </div>

                {/* SIGNATURE AREA */}
                <div className="grid grid-cols-2 gap-4 text-xs mt-12 pt-4">
                  <div className="text-center">
                    <p className="font-semibold text-gray-600 mb-14">Orang Tua / Wali Siswa,</p>
                    <div className="w-40 border-b border-black mx-auto"></div>
                    <p className="text-[10px] text-gray-400 mt-1">Nama Jelas & Tanda Tangan</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-600 mb-14">
                      Guru Bimbingan Konseling (BK),
                    </p>
                    <p className="font-bold uppercase text-gray-900 underline">
                      {activeCounselor ? activeCounselor.name : 'Guru BK'}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      NIP: {activeCounselor && activeCounselor.nip ? activeCounselor.nip : '...........................'}
                    </p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* Behavioral Diagnosis Modal (Gemini AI) */}
      {diagnosisStudent && (
        <BehavioralDiagnosisModal
          studentName={diagnosisStudent.name}
          studentClass={diagnosisStudent.class}
          studentNis={diagnosisStudent.nis}
          netPoints={Math.max(0, diagnosisStudent.violationPoints - (diagnosisStudent.achievementPoints || 0))}
          alpaCount={0}
          violations={violations.filter((v) => v.studentId === diagnosisStudent.id)}
          services={services.filter((s) => s.students.some((st) => st.id === diagnosisStudent.id))}
          achievements={achievements.filter((a) => a.studentId === diagnosisStudent.id)}
          onClose={() => setDiagnosisStudent(null)}
          onOpenEmailModal={(draftData) => setEmailDraftData(draftData)}
        />
      )}

      {/* Email Notification Modal */}
      {emailDraftData && (
        <EmailNotificationModal
          studentName={emailDraftData.studentName}
          studentClass={emailDraftData.studentClass}
          studentNis={emailDraftData.studentNis}
          netPoints={emailDraftData.netPoints}
          alpaCount={emailDraftData.alpaCount || 0}
          followUpPlan={emailDraftData.followUpPlan}
          riskLevel={emailDraftData.riskLevel}
          onClose={() => setEmailDraftData(null)}
        />
      )}

    </div>
  );
}
