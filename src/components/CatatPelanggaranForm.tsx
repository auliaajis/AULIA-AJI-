import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, ViolationRecord, Counselor, BKServiceType, BKComponentType } from '../types';
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
  X,
  FileText,
  Edit3,
  Trash2,
  Users,
  ChevronDown,
  SlidersHorizontal as Sliders,
  HeartHandshake,
  Sparkles,
  Calendar,
  Clock,
  ArrowRight
} from 'lucide-react';
import { downloadViolationPDF } from '../utils/pdfGenerator';
import { sendAutomatedEmail, createGmailDraft, triggerBackgroundAutoSync } from '../utils/googleSync';
import { getNormalizedClassKey, defaultWaliKelasList } from '../utils/classNormalizer';
import StudentCombobox from './StudentCombobox';
import { showToast } from '../utils/toast';
import {
  ViolationCategory,
  ViolationOption,
  getSchoolViolationCategories
} from '../utils/violationRulesConfig';

interface CatatPelanggaranFormProps {
  students: Student[];
  violations: ViolationRecord[];
  activeCounselor: Counselor;
  preSelectedStudentId?: string;
  onSaveViolation: (record: Omit<ViolationRecord, 'id' | 'ticketId'>) => void;
  onUpdateViolation?: (record: ViolationRecord) => void;
  onDeleteViolation?: (id: string) => void;
  onUpdateStudent?: (student: Student) => void;
  onDeleteStudent?: (id: string) => void;
  onCreateFollowUpCounseling?: (data: {
    students: Student[];
    problem: string;
    description: string;
    bkComponent?: BKComponentType;
    serviceType?: BKServiceType;
    targetType?: 'Individu' | 'Kelompok' | 'Klasikal';
    status?: 'Terjadwal' | 'Selesai' | 'Dibatalkan';
    violationContext?: {
      category: string;
      pointsAdded: number;
      date: string;
      notes?: string;
      ticketId?: string;
      violationId?: string;
    };
  }) => void;
  onCancel: () => void;
}

export default function CatatPelanggaranForm({
  students,
  violations,
  activeCounselor,
  preSelectedStudentId,
  onSaveViolation,
  onUpdateViolation,
  onDeleteViolation,
  onUpdateStudent,
  onDeleteStudent,
  onCreateFollowUpCounseling,
  onCancel,
}: CatatPelanggaranFormProps) {
  // Tab switcher & search states
  const [activeTab, setActiveTab] = useState<'input' | 'arsip'>('input');
  const [archiveSearch, setArchiveSearch] = useState('');

  // Sesi Layanan Konseling Tindak Lanjut Otomatis State
  const [autoCreateCounseling, setAutoCreateCounseling] = useState(false);
  const [showFollowUpPromptModal, setShowFollowUpPromptModal] = useState(false);
  const [followUpPromptData, setFollowUpPromptData] = useState<{
    students: Student[];
    category: string;
    pointsAdded: number;
    date: string;
    time: string;
    location: string;
    notes: string;
    handledBy: string;
  } | null>(null);
  const [selectedFollowUpServiceType, setSelectedFollowUpServiceType] = useState<BKServiceType>(
    'Layanan Konseling Perorangan (Individual)'
  );
  const [selectedFollowUpStatus, setSelectedFollowUpStatus] = useState<'Terjadwal' | 'Selesai'>('Terjadwal');

  // Editing Violation Modal state
  const [editingViolation, setEditingViolation] = useState<ViolationRecord | null>(null);

  // Student Quick Detail / Edit Modal state
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentClass, setEditStudentClass] = useState('');
  const [editStudentNis, setEditStudentNis] = useState('');

  // Date range filter states for archive list
  const [archiveStartDate, setArchiveStartDate] = useState('');
  const [archiveEndDate, setArchiveEndDate] = useState('');

  // Filtered violation records for archive list
  const filteredViolations = useMemo(() => {
    if (!Array.isArray(violations)) return [];
    const q = archiveSearch.toLowerCase().trim();
    return violations.filter(v => {
      if (!v) return false;
      const matchesQuery = !q || (
        String(v.studentName || '').toLowerCase().includes(q) ||
        String(v.studentClass || '').toLowerCase().includes(q) ||
        String(v.category || '').toLowerCase().includes(q) ||
        String(v.ticketId || '').toLowerCase().includes(q)
      );
      if (!matchesQuery) return false;

      if (archiveStartDate) {
        const vDate = String(v.date || '').slice(0, 10);
        if (vDate && vDate < archiveStartDate) return false;
      }
      if (archiveEndDate) {
        const vDate = String(v.date || '').slice(0, 10);
        if (vDate && vDate > archiveEndDate) return false;
      }

      return true;
    });
  }, [violations, archiveSearch, archiveStartDate, archiveEndDate]);

  // Autocomplete student query & class filter state
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedSearchClass, setSelectedSearchClass] = useState('Semua Kelas');
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const selectedStudent = selectedStudents[0] || null;
  const [showDropdown, setShowDropdown] = useState(false);

  // Available classes list from students
  const availableClassesList = useMemo(() => {
    if (!students || students.length === 0) return [];
    return Array.from(new Set(students.map((s) => s.class))).sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true })
    );
  }, [students]);

  const [currentCategories, setCurrentCategories] = useState<ViolationCategory[]>(() => {
    return getSchoolViolationCategories();
  });

  useEffect(() => {
    const handleRulesChanged = () => {
      setCurrentCategories(getSchoolViolationCategories());
    };
    window.addEventListener('bk_violation_rules_changed', handleRulesChanged);
    window.addEventListener('bk_school_changed', handleRulesChanged);
    window.addEventListener('storage', handleRulesChanged);
    return () => {
      window.removeEventListener('bk_violation_rules_changed', handleRulesChanged);
      window.removeEventListener('bk_school_changed', handleRulesChanged);
      window.removeEventListener('storage', handleRulesChanged);
    };
  }, []);

  // Bulk student selector state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFilterClass, setBulkFilterClass] = useState('Semua Kelas');
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);

  const bulkFilteredStudents = useMemo(() => {
    let list = students || [];
    if (bulkFilterClass !== 'Semua Kelas') {
      list = list.filter((s) => s.class === bulkFilterClass);
    }
    const q = bulkSearchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (s) =>
          String(s.name || '').toLowerCase().includes(q) ||
          String(s.nis || '').toLowerCase().includes(q) ||
          String(s.class || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, bulkFilterClass, bulkSearchQuery]);

  const toggleBulkSelectStudent = (id: string) => {
    setBulkSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllBulk = () => {
    const visibleIds = bulkFilteredStudents.map((s) => s.id);
    const newSet = new Set([...bulkSelectedIds, ...visibleIds]);
    setBulkSelectedIds(Array.from(newSet));
  };

  const handleDeselectAllBulk = () => {
    const visibleIds = new Set(bulkFilteredStudents.map((s) => s.id));
    setBulkSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
  };

  const handleApplyBulkSelection = () => {
    const selectedObjects = students.filter((s) => bulkSelectedIds.includes(s.id));
    setSelectedStudents(selectedObjects);
    setShowBulkModal(false);
    showToast(`${selectedObjects.length} siswa berhasil dipilih`, 'success');
  };

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
  const [notifyWaliOption, setNotifyWaliOption] = useState<'send' | 'save_only'>('send');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [emailData, setEmailData] = useState<{
    to: string;
    subject: string;
    body: string;
    triggerPoints: number;
    severity: 'TAHAP I' | 'TAHAP II (SIAGA)' | 'TAHAP III (KRITIS)';
  } | null>(null);

  // Verification Proof Photo states & camera setup
  const [showOptionalFields, setShowOptionalFields] = useState(false);
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
    const categoryObj = currentCategories.find(c => c.id === selectedCategory);
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
  }, [selectedCategory, selectedOptionId, customViolationLabel, currentCategories]);

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
        return JSON.parse(saved) as { class: string; name: string; email: string; phone?: string }[];
      } catch (e) {
        return defaultWaliKelasList;
      }
    }
    return defaultWaliKelasList;
  }, []);

  const currentWaliKelas = useMemo(() => {
    if (!selectedStudent) return null;
    
    const studentClassKey = getNormalizedClassKey(selectedStudent.class);
    
    // Find matching wali kelas using robust normalizer
    const found = waliKelasConfig.find(item => 
      getNormalizedClassKey(item.class) === studentClassKey
    );
    
    if (found) return found;

    // Default presets matching our predefined ones if not configured
    const cleanClass = selectedStudent.class.trim().replace(/kelas\s*/i, '').trim();
    const classCode = cleanClass.toLowerCase().replace(/\s+/g, '');
    const defaultPhones: Record<string, string> = {
      '7a': '081234567801', '7b': '081234567802', '7c': '081234567803', '7d': '081234567804', '7e': '081234567805', '7f': '081234567806',
      '8a': '081234567807', '8b': '081234567808', '8c': '081234567809', '8d': '081234567810', '8e': '081234567811', '8f': '081234567812', '8g': '081234567813',
      '9a': '081234567814', '9b': '081234567815', '9c': '081234567816', '9d': '081234567817', '9e': '081234567818', '9f': '081234567819', '9g': '081234567820'
    };
    return {
      class: selectedStudent.class,
      name: 'Wali Kelas ' + cleanClass,
      email: `wali.kelas.${classCode}@smpn2susukan.sch.id`,
      phone: defaultPhones[classCode] || '081234567800'
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
        if (!selectedStudents.some((item) => item.id === found.id)) {
          setSelectedStudents([found]);
        }
        setStudentQuery(found.name);
      }
    }
  }, [preSelectedStudentId, students]);

  // Handle selected violation/appreciation category points dynamically based on detailed selections
  useEffect(() => {
    if (!selectedCategory) {
      setPointsAdded(0);
      setSelectedOptionId('');
      setCustomViolationLabel('');
      return;
    }
    
    const categoryObj = currentCategories.find(c => c.id === selectedCategory);
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
  }, [selectedCategory, selectedOptionId, currentCategories]);

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
    let list = students || [];

    // Filter by class if selected
    if (selectedSearchClass && selectedSearchClass !== 'Semua Kelas') {
      list = list.filter((s) => s.class === selectedSearchClass);
    }

    // Filter by search query if typed
    const q = studentQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s &&
          (String(s.name || '').toLowerCase().includes(q) ||
            String(s.nis || '').toLowerCase().includes(q) ||
            String(s.class || '').toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [studentQuery, selectedSearchClass, students]);

  const handleSelectSuggestion = (student: Student) => {
    if (selectedStudents.some((item) => item.id === student.id)) {
      alert('Siswa ini sudah terpilih!');
    } else {
      setSelectedStudents([...selectedStudents, student]);
    }
    setStudentQuery('');
    setShowDropdown(false);
  };

  // Compute points threshold escalation details
  const currentPoints = selectedStudent ? selectedStudent.violationPoints : 0;
  const projectedPoints = currentPoints + pointsAdded;
  const isEscalating = projectedPoints >= 75;

  // Central Post-Save Handler (automatically offers follow-up counseling session)
  const proceedPostSave = (data: {
    students: Student[];
    category: string;
    pointsAdded: number;
    date: string;
    time: string;
    location: string;
    notes: string;
    handledBy: string;
  }) => {
    triggerBackgroundAutoSync();

    if (autoCreateCounseling && onCreateFollowUpCounseling) {
      showToast('Laporan pelanggaran tersimpan! Membuka formulir Layanan Konseling...', 'success');
      onCreateFollowUpCounseling({
        students: data.students,
        problem: `Tindak Lanjut Pembinaan Disiplin: ${data.category}`,
        description: `Sesi tindak lanjut layanan konseling dan restitusi disiplin positif atas pelanggaran "${data.category}" (${data.date}). Catatan kejadian: ${data.notes || '-'}`,
        bkComponent: 'Layanan Responsif',
        serviceType:
          data.students.length > 1
            ? 'Layanan Konseling Kelompok'
            : 'Layanan Konseling Perorangan (Individual)',
        targetType: data.students.length > 1 ? 'Kelompok' : 'Individu',
        status: 'Terjadwal',
        violationContext: {
          category: data.category,
          pointsAdded: data.pointsAdded,
          date: data.date,
          notes: data.notes,
        },
      });
    } else {
      // Open interactive Follow-Up Counseling Offer Modal
      showToast('✅ Catatan pelanggaran siswa berhasil disimpan ke database!', 'success');
      setFollowUpPromptData(data);
      setSelectedFollowUpServiceType(
        data.students.length > 1
          ? 'Layanan Konseling Kelompok'
          : 'Layanan Konseling Perorangan (Individual)'
      );
      setSelectedFollowUpStatus('Terjadwal');
      setShowFollowUpPromptModal(true);
    }
  };

  const handleSaveWithoutSending = () => {
    if (selectedStudents.length === 0) return;
    const student = selectedStudents[0];
    showToast(`✅ Catatan pelanggaran ${student.name} berhasil disimpan!`, 'success');
    onSaveViolation({
      studentId: student.id,
      studentName: student.name,
      studentClass: student.class,
      category: violationCategory,
      pointsAdded,
      date: incidentDate,
      time: incidentTime,
      location: incidentLocation || 'Lokal Sekolah',
      reportedBy: activeCounselor.name,
      notes,
      handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy,
      handlingProgress: handlingProgress || (handledBy === 'Belum Ditangani' ? 'Teguran persuasif & pembinaan tingkat kelas oleh Wali Kelas.' : handlingProgress),
      proofPhotoUrl,
      proofPhotoName,
    });
    setShowEmailModal(false);
    proceedPostSave({
      students: [student],
      category: violationCategory,
      pointsAdded,
      date: incidentDate,
      time: incidentTime,
      location: incidentLocation || 'Lokal Sekolah',
      notes,
      handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy,
    });
  };

  const handleCreateDraft = async () => {
    if (!selectedStudent || !emailData) return;
    setIsCreatingDraft(true);
    try {
      const draftRes = await createGmailDraft(emailData.to, emailData.subject, emailData.body);
      alert(draftRes.message);
    } catch (err: any) {
      console.error('Email drafting exception:', err);
      alert('Terjadi kesalahan sistem saat mencoba menyimpan draf email otomatis.');
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const handleConfirmEmailAndSave = async () => {
    if (!selectedStudent || !emailData) return;
    setIsSendingEmail(true);
    
    try {
      const emailRes = await sendAutomatedEmail(emailData.to, emailData.subject, emailData.body);
      if (emailRes.success) {
        showToast(emailRes.message, 'success');
      } else {
        alert(emailRes.message);
      }
    } catch (err: any) {
      console.error('Email sending exception:', err);
      alert('Terjadi kesalahan sistem saat mencoba mengirimkan email otomatis.');
    } finally {
      setIsSendingEmail(false);
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
      proofPhotoUrl,
      proofPhotoName,
    });
    setShowEmailModal(false);
    proceedPostSave({
      students: [selectedStudent],
      category: violationCategory,
      pointsAdded,
      date: incidentDate,
      time: incidentTime,
      location: incidentLocation || 'Lokal Sekolah',
      notes,
      handledBy,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudents.length === 0) {
      alert('Pilih minimal satu siswa terlebih dahulu!');
      return;
    }
    if (!violationCategory) {
      alert('Pilih jenis kategori pelanggaran!');
      return;
    }
    if (selectedStudents.length === 1) {
      const student = selectedStudents[0];
      const classCode = student.class.toLowerCase().replace(/kelas\s*/g, '').replace(/\s+/g, '');
      const waliEmail = currentWaliKelas?.email || `wali.kelas.${classCode}@smpn2susukan.sch.id`;
      const waliName = currentWaliKelas?.name || `Bapak/Ibu Wali Kelas ${student.class}`;

      if (projectedPoints >= emailThreshold) {
        if (notifyWaliOption === 'save_only') {
          // Save directly without opening email/WA modal
          onSaveViolation({
            studentId: student.id,
            studentName: student.name,
            studentClass: student.class,
            category: violationCategory,
            pointsAdded,
            date: incidentDate,
            time: incidentTime,
            location: incidentLocation || 'Lokal Sekolah',
            reportedBy: activeCounselor.name,
            notes,
            handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy,
            handlingProgress: handlingProgress || (handledBy === 'Belum Ditangani' ? 'Teguran persuasif & pembinaan tingkat kelas oleh Wali Kelas.' : handlingProgress),
            proofPhotoUrl,
            proofPhotoName,
          });
          proceedPostSave({
            students: [student],
            category: violationCategory,
            pointsAdded,
            date: incidentDate,
            time: incidentTime,
            location: incidentLocation || 'Lokal Sekolah',
            notes,
            handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy,
          });
          return;
        }

        // Trigger automatic email notice to Homeroom Teacher (Wali Kelas)
        let severityLevel: 'TAHAP I' | 'TAHAP II (SIAGA)' | 'TAHAP III (KRITIS)' = 'TAHAP I';
        let actionRecommendation = '';
        
        if (projectedPoints >= 75) {
          severityLevel = 'TAHAP III (KRITIS)';
          actionRecommendation = 'Sesuai prinsip disiplin positif Permendikbudristek 46/2023, siswa ini memerlukan penanganan khusus terpadu. Kasus beralih dari layanan dasar BK ke Sidang Pemulihan Karakter bersama Wali Kelas, Dewan Guru, serta koordinasi langsung dengan Kepala Sekolah untuk tindakan restoratif kolaboratif.';
        } else if (projectedPoints >= 50) {
          severityLevel = 'TAHAP II (SIAGA)';
          actionRecommendation = 'Siswa menyentuh tingkat eskalasi siaga (Bobot >= 50). Guru BK dan Wali Kelas wajib segera mengagendakan Dialog Pemulihan bersama Orang Tua guna menyusun rencana pendampingan karakter kolaboratif.';
        } else {
          severityLevel = 'TAHAP I';
          actionRecommendation = `Siswa menyentuh tingkat eskalasi awal (Bobot >= ${emailThreshold}). Sebagai Wali Kelas, mohon fasilitasi bimbingan persuasif di kelas dan diskusi reflektif bersama siswa.`;
        }

        const existingStudentViolations = violations.filter(v => v.studentId === student.id);
        let violationsListText = '';
        if (existingStudentViolations.length > 0) {
          violationsListText = existingStudentViolations.map((v, i) => `${i + 1}. Tanggal: ${v.date} - ${v.category} (Bobot: ${v.pointsAdded})`).join('\n');
        } else {
          violationsListText = '(Belum ada riwayat pembinaan sebelumnya)';
        }
        const newViolationIndex = existingStudentViolations.length + 1;
        const newViolationText = `${newViolationIndex}. Tanggal: ${incidentDate} (Baru) - ${violationCategory} (Bobot: ${pointsAdded})`;

        setEmailData({
          to: waliEmail,
          subject: `[KONSULTASI BK] Eskalasi Dukungan Karakter Siswa: ${student.name} (${student.class})`,
          body: `Yth. ${waliName},

Melalui surat elektronik otomatis ini, kami mengirimkan laporan eskalasi pendampingan terkait anak asuh Anda di kelas:

- Nama: ${student.name}
- NISN: ${student.nis}
- Kelas: ${student.class}

Rincian Catatan Perilaku Siswa:
${violationsListText}
${newViolationText}

Dengan penambahan catatan terbaru ini, indeks akumulasi eskalasi pembinaan siswa kini berada pada tingkat: ${projectedPoints} (Bobot).

Terkait tindak lanjut dialog pemulihan karakter siswa tersebut, silakan koordinasi lebih lanjut dengan Guru BK.

Hormat kami,
Layanan Konseling & Pembinaan Karakter Siswa
SMP Negeri 2 Susukan`,
          triggerPoints: projectedPoints,
          severity: severityLevel,
        });

        setShowEmailModal(true);
      } else {
        // Small accumulation: solved inside class by Wali Kelas, no automatic email dialog required
        onSaveViolation({
          studentId: student.id,
          studentName: student.name,
          studentClass: student.class,
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
        proceedPostSave({
          students: [student],
          category: violationCategory,
          pointsAdded,
          date: incidentDate,
          time: incidentTime,
          location: incidentLocation || 'Lokal Sekolah',
          notes,
          handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy,
        });
      }
    } else {
      // Multiple students selected: save directly for each in a loop
      selectedStudents.forEach((student) => {
        onSaveViolation({
          studentId: student.id,
          studentName: student.name,
          studentClass: student.class,
          category: violationCategory,
          pointsAdded,
          date: incidentDate,
          time: incidentTime,
          location: incidentLocation || 'Lokal Sekolah',
          reportedBy: activeCounselor.name,
          notes,
          handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy,
          handlingProgress: handlingProgress || (handledBy === 'Belum Ditangani' ? 'Teguran persuasif & pembinaan tingkat kelas oleh Wali Kelas.' : 'Tercatat dalam penanganan kelompok.'),
          proofPhotoUrl,
          proofPhotoName,
        });
      });

      proceedPostSave({
        students: selectedStudents,
        category: violationCategory,
        pointsAdded,
        date: incidentDate,
        time: incidentTime,
        location: incidentLocation || 'Lokal Sekolah',
        notes,
        handledBy: handledBy === 'Belum Ditangani' ? 'Wali Kelas' : handledBy,
      });
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
          Disiplin Positif & Restitusi
        </button>
        <ChevronRight className="w-3 h-3 text-[#bcc9c6]" />
        <span className="text-[#00685f] font-bold">
          {activeTab === 'input' ? 'Catat Pembinaan & Restitusi' : 'Arsip Pendampingan Perilaku & Restitusi'}
        </span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#00685f] tracking-tight">
            {activeTab === 'input' ? 'Formulir Refleksi & Restitusi Perilaku' : 'Arsip Kasus Perilaku & Restitusi'}
          </h2>
          <p className="text-sm text-[#3d4947]/70 font-semibold mt-1">
            {activeTab === 'input'
              ? 'Mendokumentasikan refleksi perilaku secara objektif sesuai Permendikbudristek 46/2023 untuk mendukung pemulihan karakter siswa.'
              : 'Daftar rekam perkembangan perilaku dan upaya pembinaan karakter terintegrasi.'}
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
          Catat Pembinaan & Restitusi
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
          Arsip Pendampingan Perilaku & Restitusi ({violations?.length || 0})
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
                  Arsip Laporan Pemulihan Perilaku
                </h3>
                <p className="text-xs text-[#3d4947]/70 font-semibold mt-0.5">
                  Unduh dokumen pendukung bimbingan dan restitusi dalam format PDF resmi.
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

          {/* Date-Range Picker & Quick Filter Bar */}
          <div className="p-3.5 sm:px-6 bg-[#f8faf9] border-b border-[#bcc9c6]/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-[#00685f] flex items-center gap-1.5 text-xs">
                <Calendar className="w-4 h-4" />
                <span>Filter Periode Tanggal:</span>
              </span>

              {/* Start Date */}
              <div className="flex items-center gap-1.5 bg-white border border-[#bcc9c6]/50 rounded-xl px-2.5 py-1 shadow-2xs">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Dari:</span>
                <input
                  type="date"
                  value={archiveStartDate}
                  onChange={(e) => setArchiveStartDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#0b1c30] focus:outline-none cursor-pointer"
                />
              </div>

              <span className="text-gray-400 font-bold text-xs">s/d</span>

              {/* End Date */}
              <div className="flex items-center gap-1.5 bg-white border border-[#bcc9c6]/50 rounded-xl px-2.5 py-1 shadow-2xs">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Sampai:</span>
                <input
                  type="date"
                  value={archiveEndDate}
                  onChange={(e) => setArchiveEndDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#0b1c30] focus:outline-none cursor-pointer"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1 ml-1">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    setArchiveStartDate(today);
                    setArchiveEndDate(today);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-teal-50 border border-gray-200 text-gray-700 hover:text-[#00685f] transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    setArchiveStartDate(d.toISOString().slice(0, 10));
                    setArchiveEndDate(new Date().toISOString().slice(0, 10));
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-teal-50 border border-gray-200 text-gray-700 hover:text-[#00685f] transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 30);
                    setArchiveStartDate(d.toISOString().slice(0, 10));
                    setArchiveEndDate(new Date().toISOString().slice(0, 10));
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-teal-50 border border-gray-200 text-gray-700 hover:text-[#00685f] transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  30 Hari
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                    setArchiveStartDate(firstDay);
                    setArchiveEndDate(new Date().toISOString().slice(0, 10));
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-teal-50 border border-gray-200 text-gray-700 hover:text-[#00685f] transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  Bulan Ini
                </button>
                {(archiveStartDate || archiveEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setArchiveStartDate('');
                      setArchiveEndDate('');
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-all cursor-pointer shadow-2xs"
                  >
                    Reset Tanggal ✕
                  </button>
                )}
              </div>
            </div>

            <div className="text-[11px] text-gray-600 font-semibold">
              Menampilkan <strong className="text-[#00685f]">{filteredViolations.length}</strong> dari {violations?.length || 0} catatan
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
                  <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-[10px]">Bobot</th>
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
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => {
                            const st = students.find(s => s.id === v.studentId || s.name === v.studentName);
                            if (st) {
                              setSelectedStudentForEdit(st);
                              setEditStudentName(st.name);
                              setEditStudentClass(st.class);
                              setEditStudentNis(st.nis);
                            } else {
                              alert(`Siswa ${v.studentName} (${v.studentClass})`);
                            }
                          }}
                          className="font-extrabold text-[#0b1c30] hover:text-[#00685f] hover:underline cursor-pointer text-left block"
                          title="Klik untuk melihat / edit profil siswa"
                        >
                          {v.studentName}
                        </button>
                      </td>
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
                        <div className="flex items-center justify-center gap-1.5">
                          {onCreateFollowUpCounseling && (
                            <button
                              type="button"
                              onClick={() => {
                                const st = students.find((s) => s.id === v.studentId || s.name === v.studentName);
                                const studentObj: Student = st || {
                                  id: v.studentId,
                                  name: v.studentName,
                                  class: v.studentClass,
                                  nis: '-',
                                  gender: 'L',
                                  violationPoints: v.pointsAdded,
                                  bkServicesCount: 0,
                                  initials: (v.studentName || 'S').slice(0, 2).toUpperCase(),
                                };
                                onCreateFollowUpCounseling({
                                  students: [studentObj],
                                  problem: `Tindak Lanjut Pembinaan Disiplin: ${v.category}`,
                                  description: `Sesi tindak lanjut layanan konseling dan restitusi disiplin positif atas pelanggaran "${v.category}" (${v.date}). Tiket: #${v.ticketId || v.id}. Catatan kejadian: ${v.notes || '-'}`,
                                  serviceType: 'Layanan Konseling Perorangan (Individual)',
                                  targetType: 'Individu',
                                  status: 'Terjadwal',
                                  violationContext: {
                                    category: v.category,
                                    pointsAdded: v.pointsAdded,
                                    date: v.date,
                                    notes: v.notes,
                                    ticketId: v.ticketId,
                                    violationId: v.id,
                                  },
                                });
                              }}
                              className="px-2.5 py-1.5 bg-emerald-50 text-[#00685f] hover:bg-[#00685f] hover:text-white rounded-lg font-bold text-[11px] transition-all cursor-pointer shadow-2xs border border-emerald-300 flex items-center gap-1 active:scale-97"
                              title="Tindak lanjuti pelanggaran ini melalui Sesi Layanan Konseling BK"
                            >
                              <HeartHandshake className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Tindak Lanjut</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => downloadViolationPDF(v)}
                            className="p-1.5 bg-[#ba1a1a]/10 text-[#ba1a1a] hover:bg-[#ba1a1a] hover:text-white rounded-lg font-bold transition-all cursor-pointer shadow-xs"
                            title="Unduh Bukti Pelanggaran PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => setEditingViolation(v)}
                            className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg font-bold transition-all cursor-pointer shadow-xs border border-blue-200"
                            title="Edit Catatan Pelanggaran Ini"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {onDeleteViolation && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Apakah Anda yakin ingin menghapus catatan pelanggaran "${v.category}" untuk ${v.studentName}? Bobot siswa akan otomatis dikurangi kembali.`)) {
                                  onDeleteViolation(v.id);
                                }
                              }}
                              className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg font-bold transition-all cursor-pointer shadow-xs border border-red-200"
                              title="Hapus Catatan Pelanggaran Ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
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
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 bg-[#ffdad6] text-[#ba1a1a]">
                  <Gavel className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0b1c30]">
                    Detail Pembinaan & Restitusi Karakter
                  </h3>
                  <p className="text-xs text-[#3d4947]/70 font-semibold">
                    Mohon lengkapi seluruh kolom yang tersedia di bawah sesuai pedoman disiplin positif.
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
                {/* Student Combobox & Autocomplete Selector with Bulk Mode */}
                <div className="space-y-3 relative md:col-span-2 bg-[#f8faf9] p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                    <div>
                      <label className="text-xs font-black text-[#0b1c30] flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#00685f]" />
                        <span>Pilih Siswa Terlibat (Bisa Pilih Banyak Siswa Sekaligus)</span>
                      </label>
                      <p className="text-[11px] text-gray-500 font-semibold mt-0.5">
                        Ketik nama untuk menambah satu-satu, atau klik tombol di sebelah kanan untuk memilih kelompok/kelas sekaligus.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setBulkSelectedIds(selectedStudents.map((s) => s.id));
                        setShowBulkModal(true);
                      }}
                      className="px-3.5 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs shrink-0 active:scale-97"
                    >
                      <Users className="w-4 h-4" />
                      <span>⚡ Pilih Banyak Siswa Sekaligus</span>
                    </button>
                  </div>

                  <StudentCombobox
                    students={students}
                    selectedStudentId={selectedStudents[selectedStudents.length - 1]?.id}
                    onSelectStudent={(st) => {
                      if (st) {
                        if (!selectedStudents.some((s) => s.id === st.id)) {
                          setSelectedStudents((prev) => [...prev, st]);
                          showToast(`+ ${st.name} (${st.class}) ditambahkan`, 'success');
                        } else {
                          showToast(`${st.name} sudah ada di daftar terpilih`, 'info');
                        }
                      }
                    }}
                    placeholder="Ketik Nama, NIS, NISN, atau Kelas untuk menambah siswa..."
                    required={selectedStudents.length === 0}
                  />

                  {/* Selected students display */}
                  {selectedStudents.length > 0 && (
                    <div className="pt-2 space-y-2 border-t border-[#bcc9c6]/30">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-[#0b1c30] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#00685f]"></span>
                          Daftar Siswa Terlibat ({selectedStudents.length} Orang):
                        </span>
                        {selectedStudents.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setSelectedStudents([])}
                            className="text-[10px] font-black text-red-600 hover:underline cursor-pointer"
                          >
                            Kosongkan Semua ({selectedStudents.length})
                          </button>
                        )}
                      </div>

                      {selectedStudents.length > 1 && (
                        <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-[#00685f]">
                          <span className="flex items-center gap-2">
                            <Users className="w-4 h-4 shrink-0" />
                            <span>
                              <strong>Mode Kolektif Aktif:</strong> Pelanggaran & bobot pembinaan (+{pointsAdded}) ini akan langsung dicatat secara individual untuk seluruh <strong>{selectedStudents.length} siswa</strong> di atas sekaligus dalam satu kali klik.
                            </span>
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                        {selectedStudents.map((student) => (
                          <div
                            key={student.id}
                            className="px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold shadow-2xs bg-white border-[#00685f]/30 text-[#0b1c30]"
                          >
                            <span className="w-2 h-2 rounded-full bg-[#00685f] shrink-0"></span>
                            <span>
                              {student.name} <span className="text-[#00685f] font-mono">({student.class})</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudents(selectedStudents.filter((s) => s.id !== student.id));
                              }}
                              className="p-0.5 rounded-full hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors cursor-pointer ml-1"
                              title="Hapus siswa ini dari daftar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 1. Kategori Pelanggaran (Main Category Selection) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
                    <span>Kategori Bimbingan Perilaku (Keyakinan Sekolah)</span>
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
                    <option value="">Pilih Kategori Perilaku...</option>
                    {currentCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Pilihan Pelanggaran Spesifik (Specific Violation Options) */}
                {selectedCategory && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200 md:col-span-2">
                    <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                      <ChevronRight className="w-4.5 h-4.5 text-[#00685f]" />
                      <span>Bentuk Rekonstruksi & Refleksi Perilaku</span>
                    </label>
                    <select
                      value={selectedOptionId}
                      onChange={(e) => setSelectedOptionId(e.target.value)}
                      required
                      className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
                    >
                      <option value="">Pilih Bentuk Perilaku Indisipliner...</option>
                      {currentCategories.find(c => c.id === selectedCategory)?.options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} (Bobot: {opt.points})
                        </option>
                      ))}
                      <option value="other">Lainnya (Refleksi Kustom & Tentukan Bobot)</option>
                    </select>
                  </div>
                )}

                {/* 3. Custom / Manual inputs for Custom Violation and Points */}
                {selectedCategory && selectedOptionId === 'other' && (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-orange-50/50 rounded-2xl border border-orange-200/60 animate-in slide-in-from-top-2 duration-300">
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-orange-800">
                        Deskripsi Perilaku Khusus
                      </label>
                      <input
                        type="text"
                        value={customViolationLabel}
                        onChange={(e) => setCustomViolationLabel(e.target.value)}
                        placeholder="Contoh: Perilaku yang butuh pendampingan khusus..."
                        required
                        className="w-full bg-white border border-orange-300/65 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-orange-800">
                        Bobot Pembinaan (Dukungan)
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
                      Bobot Pendampingan Perilaku Baru:
                    </p>
                    <h4 className="text-sm font-extrabold mt-1 text-[#ba1a1a]">
                      Bobot +{pointsAdded}
                    </h4>
                  </div>
                  <div className="hidden sm:block h-10 w-[1px] bg-[#bcc9c6]/40"></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-[#3d4947] uppercase tracking-wider opacity-80">
                      Akumulasi Bobot Pendampingan:
                    </p>
                    <h4 className="text-sm font-extrabold text-[#0b1c30] mt-1">
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
                      Eskalasi Pendampingan Terdeteksi!
                    </h5>
                    <p className="text-xs text-[#93000a] opacity-90 mt-1 leading-relaxed font-semibold">
                      Akumulasi bobot pembinaan siswa mencapai batas peringatan otomatis ({projectedPoints}). Sesuai Permendikbudristek 46/2023, Guru BK direkomendasikan menjadwalkan ruang dialog pemulihan karakter (restorative justice) bersama orang tua/wali murid.
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

              {/* PPKSP Permendikbudristek 46/2023 Advisory Notice */}
              {selectedCategory && (selectedCategory.includes('ppksp') || selectedCategory.includes('berat') || selectedCategory.includes('kriminal')) && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 animate-in fade-in duration-200">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="text-xs font-black text-rose-950">
                      Isu Perlindungan Anak & Ranah TPPK (Permendikbudristek No. 46/2023)
                    </h5>
                    <p className="text-[11px] text-rose-800 leading-relaxed font-medium">
                      Kasus ini tergolong ke dalam indikasi tindak kekerasan satuan pendidikan. Utamakan pemulihan fisik & psikis korban, jaga kerahasiaan identitas, libatkan Tim TPPK sekolah, dan berlakukan sanksi edukatif-rehabilitatif bagi pelaku anak sesuai Sistem Peradilan Pidana Anak (SPPA).
                    </p>
                  </div>
                </div>
              )}

              {/* Catatan Kejadian & Bantuan Segitiga Restitusi (Kurikulum Merdeka) */}
              <div className="space-y-2.5 p-4.5 bg-[#f8faf9] rounded-2xl border border-[#bcc9c6]/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-extrabold text-[#0b1c30] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#00685f]" />
                    <span>Catatan Kronologi & Pendekatan Segitiga Restitusi</span>
                  </label>
                  <span className="text-[10px] text-gray-500 font-bold bg-white px-2 py-0.5 rounded-full border border-gray-200">
                    Format Panduan BK Kurikulum Merdeka
                  </span>
                </div>

                {/* Quick-fill Restitusi buttons */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="font-bold text-gray-400 uppercase">Bantuan Tuturan Restitusi:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = 'Siswa diajak berdialog tenang untuk menstabilkan identitas: menyadari setiap manusia pernah khilaf dan fokus pada perbaikan diri.';
                      setNotes(prev => prev ? `${prev}\n- ${snippet}` : `- ${snippet}`);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-teal-50 text-[#00685f] border border-teal-200 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    1. Stabilkan Identitas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = 'Validasi tindakan: menelusuri alasan di balik perilaku siswa guna memahami kebutuhan dasar (kasih sayang/kebebasan/pengakuan) yang ingin ia penuhi.';
                      setNotes(prev => prev ? `${prev}\n- ${snippet}` : `- ${snippet}`);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-teal-50 text-[#00685f] border border-teal-200 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    2. Validasi Kebutuhan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = 'Menanyakan keyakinan: siswa menghubungkan tindakannya dengan keyakinan kelas yang disepakati dan menyusun komitmen restitusi mandiri.';
                      setNotes(prev => prev ? `${prev}\n- ${snippet}` : `- ${snippet}`);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-teal-50 text-[#00685f] border border-teal-200 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    3. Keyakinan & Solusi Restitusi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = 'Pemetaan Sebab-Akibat (Lampiran 1 BSKAP): Peristiwa diidentifikasi secara objektif, siswa memetakan dampak terhadap diri & lingkungan, serta menyepakati perjanjian solusi konsekuensi.';
                      setNotes(prev => prev ? `${prev}\n- ${snippet}` : `- ${snippet}`);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    4. Sebab-Akibat (Lamp 1)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = 'Refleksi Glasser 1965 (Lampiran 3 BSKAP): Konselor membantu siswa mengevaluasi diri ("Apakah perilaku ini membantumu?"), merumuskan strategi konkrit, dan menyepakati komitmen tindak lanjut.';
                      setNotes(prev => prev ? `${prev}\n- ${snippet}` : `- ${snippet}`);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    5. Refleksi Glasser (Lamp 3)
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tuliskan catatan kejadian kronologis, respon siswa, dan komitmen restitusi perbaikan perilaku..."
                  className="w-full bg-white border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-xs text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-2xs font-medium"
                />
              </div>

              {/* Progressive Disclosure: Collapsible Section for Optional Monitoring & Photo Evidence */}
              <div className="border border-[#bcc9c6]/30 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => setShowOptionalFields(!showOptionalFields)}
                  className="w-full px-5 py-3.5 flex items-center justify-between bg-[#f8faf9] hover:bg-gray-100/70 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Sliders className="w-4 h-4 text-[#00685f]" />
                    <div>
                      <h4 className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                        Monitoring Lanjutan & Bukti Foto (Opsional)
                      </h4>
                      <p className="text-[11px] text-gray-500 font-semibold mt-0.5">
                        {showOptionalFields
                          ? 'Klik untuk menyembunyikan kolom pendukung'
                          : 'Status penanganan wali kelas/guru BK dan lampiran foto bukti fisik kejadian'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(handledBy !== 'Belum Ditangani' || proofPhotoUrl) && (
                      <span className="text-[10px] bg-[#00685f]/10 text-[#00685f] font-bold px-2 py-0.5 rounded-full">
                        Terisi
                      </span>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                        showOptionalFields ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {showOptionalFields && (
                  <div className="p-6 space-y-6 border-t border-[#bcc9c6]/20 bg-white animate-in slide-in-from-top-2 duration-200">
                    {/* Monitoring Penanganan Wali Kelas / Guru BK */}
                    <div className="p-4 bg-[#eff4ff]/50 rounded-xl border border-blue-100 space-y-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0b1c30] flex items-center gap-2">
                        <span className="w-1.5 h-3.5 bg-blue-600 rounded-full"></span>
                        Monitoring Penanganan Kasus
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[#0b1c30]">
                            Status Penanganan
                          </label>
                          <select
                            value={handledBy}
                            onChange={(e) => setHandledBy(e.target.value as any)}
                            className="w-full bg-white border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-2xs"
                          >
                            <option value="Belum Ditangani">Belum Ditangani / Dalam Proses</option>
                            <option value="Wali Kelas">Sudah Ditangani Wali Kelas</option>
                            <option value="Guru BK">Sudah Ditangani Guru BK</option>
                            <option value="Wali Kelas & Guru BK">Sudah Ditangani Wali Kelas & Guru BK</option>
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
                                : 'Contoh: Pemberian surat peringatan, pembinaan...'
                            }
                            required={handledBy !== 'Belum Ditangani'}
                            className={`w-full border rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-2xs ${
                              handledBy === 'Belum Ditangani'
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                : 'bg-white text-[#0b1c30] border-[#bcc9c6]/40'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Foto Bukti Pelanggaran (Kamera HP / Upload File) */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-[#00685f]" />
                        <span>Bukti Foto Kejadian / Fisik (Opsional)</span>
                      </label>
                      <p className="text-[11px] text-gray-500 font-semibold">
                        Ambil foto langsung melalui kamera HP/laptop Anda atau unggah file foto dari penyimpanan.
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
                                className="flex flex-col items-center justify-center p-4 border border-dashed border-[#bcc9c6]/60 bg-[#f8f9ff] rounded-xl hover:bg-gray-50 hover:border-[#00685f]/80 transition-all cursor-pointer text-center"
                              >
                                <Camera className="w-5 h-5 text-[#00685f] mb-1" />
                                <span className="text-[11px] font-bold text-[#0b1c30]">Gunakan Kamera</span>
                              </button>

                              <label className="flex flex-col items-center justify-center p-4 border border-dashed border-[#bcc9c6]/60 bg-[#f8f9ff] rounded-xl hover:bg-gray-50 hover:border-[#00685f]/80 transition-all cursor-pointer text-center">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleProofFileChange}
                                  className="sr-only"
                                />
                                <ImageIcon className="w-5 h-5 text-[#6b38d4] mb-1" />
                                <span className="text-[11px] font-bold text-[#0b1c30]">Unggah Foto</span>
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Pilihan Notifikasi Wali Kelas / Orang Tua bila bobot melebihi ketentuan */}
              {projectedPoints >= emailThreshold && (
                <div className="p-4 bg-amber-50/90 border border-amber-200/80 rounded-2xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4.5 h-4.5 text-amber-700" />
                    <span className="text-xs font-extrabold text-amber-950 uppercase tracking-wide">
                      Opsi Pengiriman Notifikasi (Bobot: {projectedPoints} &ge; Ketentuan {emailThreshold})
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900/90 font-medium leading-relaxed">
                    Karena bobot pembinaan siswa telah melebihi ketentuan ({emailThreshold} bobot), Anda dapat memilih apakah ingin mengirim notifikasi Email & WA ke Wali Kelas/Orang Tua atau <strong>tetap mencatat di sistem saja tanpa kirim pesan</strong>.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      notifyWaliOption === 'send'
                        ? 'bg-white border-[#00685f] ring-1 ring-[#00685f] shadow-xs text-[#00685f]'
                        : 'bg-amber-100/50 border-amber-200 text-gray-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="notifyWaliOption"
                        value="send"
                        checked={notifyWaliOption === 'send'}
                        onChange={() => setNotifyWaliOption('send')}
                        className="mt-0.5 text-[#00685f] focus:ring-[#00685f]"
                      />
                      <div>
                        <span className="text-xs font-extrabold block text-gray-900">
                          Kirim Notifikasi (Email & WhatsApp)
                        </span>
                        <span className="text-[10px] text-gray-600 font-semibold leading-tight block mt-0.5">
                          Tampilkan pratinjau draf & kirim pesan ke Wali Kelas untuk koordinasi.
                        </span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      notifyWaliOption === 'save_only'
                        ? 'bg-white border-purple-600 ring-1 ring-purple-600 shadow-xs text-purple-900'
                        : 'bg-amber-100/50 border-amber-200 text-gray-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="notifyWaliOption"
                        value="save_only"
                        checked={notifyWaliOption === 'save_only'}
                        onChange={() => setNotifyWaliOption('save_only')}
                        className="mt-0.5 text-purple-600 focus:ring-purple-600"
                      />
                      <div>
                        <span className="text-xs font-extrabold block text-purple-950">
                          Tetap Catat di Sistem Saja (Tanpa Kirim Email / WA)
                        </span>
                        <span className="text-[10px] text-gray-600 font-semibold leading-tight block mt-0.5">
                          Laporan tersimpan resmi di rekam jejak BK tanpa pengiriman notifikasi.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Opsi Otomatis Tindak Lanjut Layanan Konseling */}
              <div className="p-4 bg-gradient-to-r from-teal-50/80 to-emerald-50/80 border border-teal-200/80 rounded-2xl flex items-start gap-3.5 transition-all">
                <input
                  type="checkbox"
                  id="autoCreateCounselingCheckbox"
                  checked={autoCreateCounseling}
                  onChange={(e) => setAutoCreateCounseling(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[#00685f] rounded border-gray-300 focus:ring-[#00685f] cursor-pointer"
                />
                <label htmlFor="autoCreateCounselingCheckbox" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-[#00685f]" />
                    <span className="text-xs font-extrabold text-[#0b1c30]">
                      Langsung Jadwalkan Sesi Layanan Konseling Setelah Disimpan
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00685f] text-white">
                      Rekomendasi Restitusi
                    </span>
                  </div>
                  <p className="text-[11px] text-[#3d4947] font-medium leading-relaxed mt-1">
                    Jika dicentang, sistem akan langsung membuka formulir <strong>Tambah Layanan Konseling</strong> dengan data siswa, deskripsi pelanggaran, dan topik pembinaan yang sudah terisi otomatis untuk mempermudah tindak lanjut bimbingan.
                  </p>
                </label>
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
                  <span>Simpan Laporan Restitusi & Pembinaan</span>
                </button>
              </div>
            </form>
          </div>

          {/* Auxiliary Help Tips cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-[#825100]/5 border border-[#825100]/25 rounded-2xl flex gap-3">
              <Lightbulb className="w-5 h-5 text-[#825100] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#3d4947] font-semibold leading-relaxed">
                Penerapan Segitiga Restitusi sesuai Permendikbudristek 46/2023 berfokus pada pemulihan karakter siswa agar menyadari kesalahan, memperbaiki dampaknya, dan kembali ke kelompoknya dengan karakter yang lebih kuat.
              </p>
            </div>

            <div className="p-4 bg-[#00685f]/5 border border-[#00685f]/25 rounded-2xl flex gap-3">
              <Info className="w-5 h-5 text-[#00685f] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#3d4947] font-semibold leading-relaxed">
                Sistem pengarsipan ini bersifat rahasia. Sesuai asas kerahasiaan konseling, rekam perkembangan karakter hanya diakses oleh guru BK, wali kelas, dan pimpinan sekolah demi kelancaran pendampingan.
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
                    Batas Eskalasi Pembinaan Terlampaui ({emailData.triggerPoints} Bobot)
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
                      {activeCounselor.email || 'admin.bk@smpn2susukan.sch.id'} <span className="text-gray-400">&lt;Sistem BK Otomatis: {activeCounselor.name}&gt;</span>
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

              {/* Real Action Links for dispatch */}
              <div className="p-4 bg-teal-50/80 border border-teal-200/60 rounded-xl space-y-2.5">
                <span className="text-xs font-extrabold text-teal-900 uppercase tracking-wider block">
                  ⚡ Opsi Pengiriman Langsung Wali Kelas (Operasional):
                </span>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={`mailto:${emailData.to}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`}
                    className="flex-1 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-sm text-center flex items-center justify-center gap-2 hover:no-underline transition-all active:scale-97"
                    title="Buka aplikasi email Anda (Gmail/Outlook) dengan isi pesan terisi otomatis"
                  >
                    <Mail className="w-4 h-4 shrink-0" />
                    <span>Kirim via Email Client</span>
                  </a>
                  
                  <button
                    type="button"
                    onClick={handleCreateDraft}
                    disabled={isCreatingDraft}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm text-center flex items-center justify-center gap-2 transition-all active:scale-97 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Simpan draf surat pemberitahuan ini langsung di folder Draf (Drafts) akun Gmail terhubung Anda"
                  >
                    {isCreatingDraft ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></span>
                    ) : (
                      <FileText className="w-4 h-4 shrink-0" />
                    )}
                    <span>{isCreatingDraft ? 'Menyimpan...' : 'Simpan Draf ke Gmail'}</span>
                  </button>

                  {currentWaliKelas?.phone && (
                    <a
                      href={`https://api.whatsapp.com/send?phone=${
                        currentWaliKelas.phone.startsWith('0') 
                          ? '62' + currentWaliKelas.phone.slice(1) 
                          : currentWaliKelas.phone
                      }&text=${encodeURIComponent(
                        `Yth. Wali Kelas *${selectedStudent?.class}* (${currentWaliKelas.name}),\n\nKami menginfokan perkembangan kedisiplinan siswa:\n` +
                        `- Nama: *${selectedStudent?.name}*\n` +
                        `- NISN: *${selectedStudent?.nis}*\n` +
                        `- Total Bobot Pembinaan: *${emailData.triggerPoints} (Siaga/Kritis)*\n` +
                        `- Status: *${emailData.severity}*\n\n` +
                        `Rekomendasi Tindakan:\n${
                          emailData.severity === 'TAHAP III (KRITIS)' 
                            ? 'Kasus segera diproses Sidang Dewan Guru.' 
                            : emailData.severity === 'TAHAP II (SIAGA)' 
                              ? 'Mohon jadwalkan Panggilan Orang Tua ke sekolah.' 
                              : 'Mohon berikan pembinaan kelas persuasif.'
                        }\n\n` +
                        `Detail draf surat elektronik resmi telah kami siapkan di unit BK. Terima kasih.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm text-center flex items-center justify-center gap-2 hover:no-underline transition-all active:scale-97"
                      title="Kirim pesan rincian singkat kesiswaan via WhatsApp otomatis ke Wali Kelas"
                    >
                      <span className="font-bold text-[10px] bg-white/20 px-1 py-0.5 rounded shrink-0">WA</span>
                      <span>Kirim via WhatsApp Wali Kelas</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Status Notice Indicator */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200/50 rounded-xl flex gap-2.5 items-start">
                <Info className="w-4.5 h-4.5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-800 font-semibold leading-relaxed">
                  <strong>Informasi Alur PPKSP:</strong> Sesuai Permendikbudristek 46/2023, tingginya bobot pembinaan ({emailData.triggerPoints}) memicu alur komunikasi kolaboratif ini secara otomatis demi pemulihan perilaku siswa. Gunakan tombol <strong>Simpan Draf ke Gmail</strong> untuk menyimpan rancangan diskusi ke folder draf Anda, atau gunakan opsi lainnya untuk mengirimkan langsung.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-2.5 justify-end items-center">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Batal / Perbaiki Data
              </button>

              <button
                type="button"
                onClick={handleSaveWithoutSending}
                className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                title="Simpan laporan ke sistem tanpa mengirimkan email/WA"
              >
                <Save className="w-3.5 h-3.5 text-purple-700" />
                <span>Simpan Saja (Tanpa Kirim Email/WA)</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmEmailAndSave}
                disabled={isSendingEmail}
                className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-97 flex items-center gap-2 cursor-pointer ${
                  isSendingEmail 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-[#00685f] hover:bg-[#005049]'
                }`}
              >
                {isSendingEmail ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isSendingEmail ? 'Mengirim Email...' : 'Kirim Notifikasi & Simpan Laporan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT VIOLATION MODAL */}
      {editingViolation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-red-600" />
                  <span>Edit Catatan Pelanggaran Siswa</span>
                </h3>
                <p className="text-[11px] text-gray-500 font-semibold">
                  Tiket: {editingViolation.ticketId} • Siswa: {editingViolation.studentName} ({editingViolation.studentClass})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingViolation(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Kategori Pelanggaran</label>
                <input
                  type="text"
                  value={editingViolation.category}
                  onChange={(e) => setEditingViolation({ ...editingViolation, category: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Bobot Pelanggaran (+)</label>
                  <input
                    type="number"
                    value={editingViolation.pointsAdded}
                    onChange={(e) => setEditingViolation({ ...editingViolation, pointsAdded: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Ditangani Oleh</label>
                  <select
                    value={editingViolation.handledBy || 'Guru BK'}
                    onChange={(e) => setEditingViolation({ ...editingViolation, handledBy: e.target.value as any })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="Belum Ditangani">Belum Ditangani</option>
                    <option value="Wali Kelas">Wali Kelas</option>
                    <option value="Guru BK">Guru BK</option>
                    <option value="Wali Kelas & Guru BK">Wali Kelas & Guru BK</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Progres Penanganan / Restitusi</label>
                <textarea
                  rows={2}
                  value={editingViolation.handlingProgress || ''}
                  onChange={(e) => setEditingViolation({ ...editingViolation, handlingProgress: e.target.value })}
                  placeholder="Catatan penanganan..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Catatan / Detail Kasus</label>
                <textarea
                  rows={2}
                  value={editingViolation.notes || ''}
                  onChange={(e) => setEditingViolation({ ...editingViolation, notes: e.target.value })}
                  placeholder="Detail peristiwa..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setEditingViolation(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onUpdateViolation && editingViolation) {
                    onUpdateViolation(editingViolation);
                    setEditingViolation(null);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer shadow-sm"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚡ MODAL PILIH BANYAK SISWA SEKALIGUS (BULK STUDENT SELECTOR) */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-gray-200 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#00685f]/10 rounded-xl text-[#00685f] shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#0b1c30]">
                    ⚡ Input Kolektif / Pilih Beberapa Siswa Sekaligus
                  </h3>
                  <p className="text-xs text-gray-500 font-semibold">
                    Tandai siswa yang terlibat dalam kejadian yang sama untuk mencatat pelanggaran sekaligus secara efisien.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#0b1c30]">Filter Berdasarkan Kelas</label>
                <select
                  value={bulkFilterClass}
                  onChange={(e) => setBulkFilterClass(e.target.value)}
                  className="w-full bg-[#f8faf9] border border-[#bcc9c6]/50 rounded-xl px-3 py-2 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                >
                  <option value="Semua Kelas">Semua Kelas ({students.length} Siswa)</option>
                  {availableClassesList.map((cls) => (
                    <option key={cls} value={cls}>
                      Kelas {cls} ({students.filter((s) => s.class === cls).length} Siswa)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#0b1c30]">Cari Nama / NIS Siswa</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={bulkSearchQuery}
                    onChange={(e) => setBulkSearchQuery(e.target.value)}
                    placeholder="Ketik nama atau NIS..."
                    className="w-full bg-[#f8faf9] border border-[#bcc9c6]/50 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                  {bulkSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setBulkSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Selection actions bar */}
            <div className="flex items-center justify-between text-xs font-extrabold bg-[#e6f4f1]/60 px-3.5 py-2 rounded-xl border border-[#00685f]/20 shrink-0">
              <div className="text-[#00685f] flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>
                  Terpilih: <strong>{bulkSelectedIds.length}</strong> dari {students.length} Siswa
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllBulk}
                  className="px-2.5 py-1 bg-white hover:bg-[#00685f] hover:text-white text-[#00685f] border border-[#00685f]/30 rounded-lg text-[11px] transition-all cursor-pointer shadow-2xs"
                >
                  Pilih Semua (sesuai filter)
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllBulk}
                  className="px-2.5 py-1 bg-white hover:bg-red-500 hover:text-white text-red-600 border border-red-200 rounded-lg text-[11px] transition-all cursor-pointer shadow-2xs"
                >
                  Batal Pilih (sesuai filter)
                </button>
              </div>
            </div>

            {/* Scrollable Student List */}
            <div className="flex-1 overflow-y-auto pr-1 border border-gray-200 rounded-xl divide-y divide-gray-100 min-h-[220px]">
              {bulkFilteredStudents.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs italic">
                  Tidak ada siswa yang ditemukan sesuai filter
                </div>
              ) : (
                bulkFilteredStudents.map((st) => {
                  const isChecked = bulkSelectedIds.includes(st.id);
                  return (
                    <div
                      key={st.id}
                      onClick={() => toggleBulkSelectStudent(st.id)}
                      className={`p-3 flex items-center justify-between hover:bg-[#e6f4f1]/40 transition-colors cursor-pointer ${
                        isChecked ? 'bg-[#e6f4f1]/80 font-extrabold' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent div onClick
                          className="w-4 h-4 text-[#00685f] rounded border-gray-300 focus:ring-[#00685f] cursor-pointer"
                        />
                        <div className="w-8 h-8 rounded-full bg-[#00685f] text-white flex items-center justify-center text-xs font-black shrink-0 overflow-hidden shadow-2xs">
                          {st.avatarUrl ? (
                            <img src={st.avatarUrl} alt={st.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span>{st.initials}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0b1c30] truncate">{st.name}</p>
                          <p className="text-[10px] text-gray-500 font-semibold">
                            NIS: {st.nis} &bull; Kelas {st.class}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-md">
                          {st.class}
                        </span>
                        {st.violationPoints > 0 && (
                          <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold rounded-md">
                            {st.violationPoints} Bobot
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-500 font-semibold">
                {bulkSelectedIds.length} siswa akan ditambahkan ke form laporan.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkSelection}
                  className="px-5 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:scale-97"
                >
                  Selesai & Terapkan ({bulkSelectedIds.length} Siswa)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK STUDENT EDIT MODAL */}
      {selectedStudentForEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-[#0b1c30]">Profil & Edit Data Siswa</h3>
                <p className="text-[11px] text-gray-500">
                  Ubah data atau hapus siswa langsung dari arsip pendampingan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForEdit(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Kelas</label>
                  <input
                    type="text"
                    value={editStudentClass}
                    onChange={(e) => setEditStudentClass(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">NIS / NISN</label>
                  <input
                    type="text"
                    value={editStudentNis}
                    onChange={(e) => setEditStudentNis(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs space-y-1">
                <p className="font-bold text-gray-700">Ringkasan Bobot Karakter Siswa:</p>
                <p className="text-red-600 font-extrabold">Total Bobot Pelanggaran: {selectedStudentForEdit.violationPoints} Bobot</p>
                <p className="text-emerald-600 font-extrabold">Total Bobot Apresiasi: +{selectedStudentForEdit.achievementPoints || 0} Bobot</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              {onDeleteStudent && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Apakah Anda yakin ingin menghapus data siswa ${selectedStudentForEdit.name} dari sistem?`)) {
                      onDeleteStudent(selectedStudentForEdit.id);
                      setSelectedStudentForEdit(null);
                    }
                  }}
                  className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Siswa</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setSelectedStudentForEdit(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
                >
                  Tutup
                </button>
                {onUpdateStudent && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateStudent({
                        ...selectedStudentForEdit,
                        name: editStudentName,
                        class: editStudentClass,
                        nis: editStudentNis,
                      });
                      setSelectedStudentForEdit(null);
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#00685f] hover:bg-[#005049] rounded-xl cursor-pointer shadow-sm"
                  >
                    Simpan Perubahan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / DIALOG TAWARAN TINDAK LANJUT LAYANAN KONSELING BK */}
      {showFollowUpPromptModal && followUpPromptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-[#bcc9c6]/40 max-w-xl w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#00685f] shadow-xs flex-shrink-0">
                  <HeartHandshake className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Tersimpan Resmi
                    </span>
                    <span className="text-[10px] font-bold text-gray-500">Restitusi BK</span>
                  </div>
                  <h3 className="text-lg font-extrabold text-[#0b1c30] mt-0.5">
                    Laporan Pelanggaran Berhasil Disimpan!
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFollowUpPromptModal(false);
                  setFollowUpPromptData(null);
                  onCancel();
                }}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Context Card */}
            <div className="bg-[#f8faf9] border border-[#bcc9c6]/40 rounded-2xl p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#bcc9c6]/20 pb-2">
                <div className="text-xs font-bold text-[#0b1c30]">
                  Siswa:{' '}
                  <span className="text-[#00685f]">
                    {followUpPromptData.students.map((s) => s.name).join(', ')} (
                    {followUpPromptData.students.map((s) => s.class).join(', ')})
                  </span>
                </div>
                <div className="text-[10px] font-extrabold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                  +{followUpPromptData.pointsAdded} Bobot
                </div>
              </div>
              <p className="text-xs text-[#3d4947] font-semibold">
                Kategori:{' '}
                <span className="text-gray-900 font-extrabold">{followUpPromptData.category}</span>
              </p>
              {followUpPromptData.notes && (
                <p className="text-[11px] text-gray-600 bg-white p-2.5 rounded-xl border border-gray-200/70 italic">
                  "{followUpPromptData.notes}"
                </p>
              )}
            </div>

            {/* Question & Service Type Selector */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#0b1c30]">
                Apakah Anda ingin langsung membuat sesi <strong>Layanan Konseling</strong> tindak lanjut untuk siswa ini?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    Jenis Layanan BK:
                  </label>
                  <select
                    value={selectedFollowUpServiceType}
                    onChange={(e) => setSelectedFollowUpServiceType(e.target.value as BKServiceType)}
                    className="w-full bg-white border border-[#bcc9c6]/60 rounded-xl px-3 py-2 text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#00685f]"
                  >
                    <option value="Layanan Konseling Perorangan (Individual)">
                      Konseling Perorangan (Individual)
                    </option>
                    <option value="Layanan Bimbingan Kelompok">Bimbingan Kelompok</option>
                    <option value="Layanan Konseling Kelompok">Konseling Kelompok</option>
                    <option value="Layanan Mediasi">Layanan Mediasi</option>
                    <option value="Layanan Konsultasi">Layanan Konsultasi</option>
                    <option value="Layanan Advokasi">Layanan Advokasi</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    Status Awal Sesi:
                  </label>
                  <select
                    value={selectedFollowUpStatus}
                    onChange={(e) => setSelectedFollowUpStatus(e.target.value as 'Terjadwal' | 'Selesai')}
                    className="w-full bg-white border border-[#bcc9c6]/60 rounded-xl px-3 py-2 text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#00685f]"
                  >
                    <option value="Terjadwal">Jadwalkan Sesi Konseling (Terjadwal)</option>
                    <option value="Selesai">Langsung Catat Hasil Selesai (Selesai)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-[#bcc9c6]/30">
              <button
                type="button"
                onClick={() => {
                  showToast('✅ Catatan pelanggaran tersimpan rapi di dashboard.', 'info');
                  setShowFollowUpPromptModal(false);
                  setFollowUpPromptData(null);
                  onCancel();
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
              >
                Selesai (Kembali ke Dashboard)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onCreateFollowUpCounseling && followUpPromptData) {
                    const isMultiple = followUpPromptData.students.length > 1;
                    onCreateFollowUpCounseling({
                      students: followUpPromptData.students,
                      problem: `Tindak Lanjut Pembinaan Disiplin: ${followUpPromptData.category}`,
                      description: `Sesi tindak lanjut layanan konseling dan restitusi disiplin positif atas pelanggaran "${followUpPromptData.category}" (${followUpPromptData.date}). Catatan kejadian: ${followUpPromptData.notes || '-'}`,
                      serviceType: selectedFollowUpServiceType,
                      targetType: isMultiple ? 'Kelompok' : 'Individu',
                      status: selectedFollowUpStatus,
                      violationContext: {
                        category: followUpPromptData.category,
                        pointsAdded: followUpPromptData.pointsAdded,
                        date: followUpPromptData.date,
                        notes: followUpPromptData.notes,
                      },
                    });
                    setShowFollowUpPromptModal(false);
                    setFollowUpPromptData(null);
                  }
                }}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-extrabold text-white bg-[#00685f] hover:bg-[#005049] rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <HeartHandshake className="w-4 h-4" />
                <span>Buat Sesi Layanan Konseling</span>
                <ArrowRight className="w-3.5 h-3.5" />
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
