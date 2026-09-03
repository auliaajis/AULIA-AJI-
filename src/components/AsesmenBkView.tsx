import React, { useState, useMemo } from 'react';
import { showToast } from '../utils/toast';
import {
  FileText,
  CheckCircle2,
  BarChart3,
  BookOpen,
  Plus,
  Download,
  Search,
  Sparkles,
  HelpCircle,
  Brain,
  Printer,
  ChevronRight,
  ChevronDown,
  Compass,
  Users,
  MessageSquare,
  Bot,
  Zap,
  RefreshCw,
  Lightbulb,
  ShieldCheck,
  Target,
  HeartHandshake,
  Activity,
  Layers,
  Send,
  AlertCircle,
  Share2,
  Link,
  QrCode,
  UserCheck,
  Trash2,
  Eye,
  X,
  Check,
  ExternalLink,
  Edit3,
  Copy
} from 'lucide-react';
import { Student } from '../types';
import {
  ASPEK_PERKEMBANGAN_LIST,
  SAMPLE_AKPD_QUESTIONS,
  PRESET_MODUL_AJAR_LIST,
  ModulAjarRpl,
  AkpdQuestion
} from '../data/asesmenData';
import { getSchoolConfig } from '../utils/schoolConfig';
import jsPDF from 'jspdf';

export interface AkpdStudentSubmission {
  studentId: string;
  studentName: string;
  submittedAt: string;
  selectedItems: Record<string, boolean>; // item.id -> boolean
}

export interface AkpdClassSession {
  classId: string;
  status: 'draft' | 'spread' | 'completed';
  spreadDate?: string;
  submissions: AkpdStudentSubmission[];
}

interface AsesmenBkViewProps {
  students: Student[];
  onNavigateToForm?: (form: string) => void;
}

export default function AsesmenBkView({ students, onNavigateToForm }: AsesmenBkViewProps) {
  const [activeTab, setActiveTab] = useState<'akpd' | 'capaian' | 'atl' | 'modul' | 'ai-script'>('akpd');
  const [selectedClass, setSelectedClass] = useState<string>('7A');
  const [selectedFase, setSelectedFase] = useState<'Fase D' | 'Fase E' | 'Fase F'>('Fase D');
  const [searchQuery, setSearchQuery] = useState('');

  // AKPD Class Sessions State (persisted in localStorage)
  const [akpdSessions, setAkpdSessions] = useState<Record<string, AkpdClassSession>>(() => {
    const saved = localStorage.getItem('bk_akpd_class_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {}
    }
    return {};
  });

  // Modals & Forms State for AKPD
  const [showSpreadModal, setShowSpreadModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showRespondenModal, setShowRespondenModal] = useState(false);
  const [showStudentFillModal, setShowStudentFillModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Manual Entry Form State
  const [entryStudentName, setEntryStudentName] = useState('');
  const [entrySelectedItems, setEntrySelectedItems] = useState<Record<string, boolean>>({});

  // Student Fill Form State (Simulator)
  const [studentFillName, setStudentFillName] = useState('');
  const [studentFillSelectedItems, setStudentFillSelectedItems] = useState<Record<string, boolean>>({});

  // AI AKPD Counselor Analysis State
  const [isAnalyzingAkpd, setIsAnalyzingAkpd] = useState(false);
  const [akpdAiAnalysis, setAkpdAiAnalysis] = useState<{
    summary: string;
    rootCauses: string[];
    recommendations: string[];
    actionPlan: string[];
  } | null>(null);

  // Modul Ajar RPL List State
  const [modulList, setModulList] = useState<ModulAjarRpl[]>(PRESET_MODUL_AJAR_LIST);
  const [selectedModul, setSelectedModul] = useState<ModulAjarRpl | null>(PRESET_MODUL_AJAR_LIST[0]);
  const [showModulModal, setShowModulModal] = useState(false);
  const [modulSubTab, setModulSubTab] = useState<'rpl' | 'materi' | 'lkpd' | 'ppt'>('rpl');
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // AI RPL Generator Form State
  const [aiTopic, setAiTopic] = useState('');
  const [aiBidang, setAiBidang] = useState<'Pribadi' | 'Sosial' | 'Belajar' | 'Karir'>('Pribadi');
  const [aiFase, setAiFase] = useState<'Fase D (SMP)' | 'Fase E (SMA 10)' | 'Fase F (SMA 11-12)'>('Fase D (SMP)');
  const [aiAspek, setAiAspek] = useState('SKKPD-3');
  const [aiAlokasi, setAiAlokasi] = useState('2 x 45 Menit');
  const [aiMetode, setAiMetode] = useState('Experiential Learning & Diskusi Interaktif');
  const [isGeneratingRpl, setIsGeneratingRpl] = useState(false);

  // AI Konseling Script State
  const [scriptServiceType, setScriptServiceType] = useState('Konseling Individu');
  const [scriptStudentName, setScriptStudentName] = useState('Ahmad Subagja');
  const [scriptProblem, setScriptProblem] = useState('Kesulitan mengendalikan emosi saat dikritik teman dan sering membolos pelajaran ke-3');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<{
    opening: string;
    coreExploration: string;
    empathyPhrases: string[];
    solutionCoaching: string;
    closingCommitment: string;
  } | null>(null);

  // VAK Learning Style Simulator State
  const [vScore, setVScore] = useState(45);
  const [aScore, setAScore] = useState(30);
  const [kScore, setKScore] = useState(25);
  const [vakDiagnose, setVakDiagnose] = useState<{
    dominantStyle: string;
    characteristics: string[];
    learningStrategies: string[];
    teacherTips: string;
  } | null>(null);
  const [isDiagnosingVak, setIsDiagnosingVak] = useState(false);

  const schoolConfig = getSchoolConfig();

  // Save AKPD sessions helper
  const updateAkpdSessions = (updater: (prev: Record<string, AkpdClassSession>) => Record<string, AkpdClassSession>) => {
    setAkpdSessions((prev) => {
      const updated = updater(prev);
      localStorage.setItem('bk_akpd_class_sessions', JSON.stringify(updated));
      return updated;
    });
  };

  // Class list extracted from students or fallback standard
  const availableClasses = useMemo(() => {
    const classesFromStudents = Array.from(new Set(students.map((s) => s.class))).sort();
    return classesFromStudents.length > 0 ? classesFromStudents : ['7A', '7B', '8A', '8B', '9A', '9B'];
  }, [students]);

  // Current Class Session Data
  const currentClassSession = akpdSessions[selectedClass] || {
    classId: selectedClass,
    status: 'draft',
    submissions: []
  };
  const currentSubmissions = currentClassSession.submissions || [];
  const totalResponding = currentSubmissions.length;

  // AKPD Analysis Calculations strictly based on student submissions data
  const akpdStats = useMemo(() => {
    if (totalResponding === 0) {
      const sortedQuestions = SAMPLE_AKPD_QUESTIONS.map((q) => ({
        ...q,
        countSelected: 0,
        percentage: 0,
        totalResponding: 0,
        score: 0,
      }));
      return {
        avgPribadi: 0,
        avgSosial: 0,
        avgBelajar: 0,
        avgKarir: 0,
        totalResponding: 0,
        topPriority: [],
        allSorted: sortedQuestions,
      };
    }

    let sumPribadi = 0, countPribadi = 0;
    let sumSosial = 0, countSosial = 0;
    let sumBelajar = 0, countBelajar = 0;
    let sumKarir = 0, countKarir = 0;

    const sortedQuestions = SAMPLE_AKPD_QUESTIONS.map((q) => {
      const countSelected = currentSubmissions.filter((s) => s.selectedItems[q.id]).length;
      const percentage = Math.round((countSelected / totalResponding) * 100);

      if (q.bidang === 'Pribadi') { sumPribadi += percentage; countPribadi++; }
      if (q.bidang === 'Sosial') { sumSosial += percentage; countSosial++; }
      if (q.bidang === 'Belajar') { sumBelajar += percentage; countBelajar++; }
      if (q.bidang === 'Karir') { sumKarir += percentage; countKarir++; }

      return {
        ...q,
        countSelected,
        percentage,
        totalResponding,
        score: percentage,
      };
    }).sort((a, b) => b.percentage - a.percentage || b.countSelected - a.countSelected);

    const avgPribadi = countPribadi ? Math.round(sumPribadi / countPribadi) : 0;
    const avgSosial = countSosial ? Math.round(sumSosial / countSosial) : 0;
    const avgBelajar = countBelajar ? Math.round(sumBelajar / countBelajar) : 0;
    const avgKarir = countKarir ? Math.round(sumKarir / countKarir) : 0;

    return {
      avgPribadi,
      avgSosial,
      avgBelajar,
      avgKarir,
      totalResponding,
      topPriority: sortedQuestions.slice(0, 5),
      allSorted: sortedQuestions,
    };
  }, [currentSubmissions, totalResponding]);

  // Handler: Sebar Instrumen (Activate Session)
  const handleSpreadClass = (classId: string) => {
    const now = new Date().toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    updateAkpdSessions((prev) => ({
      ...prev,
      [classId]: {
        classId,
        status: 'spread',
        spreadDate: now,
        submissions: prev[classId]?.submissions || []
      }
    }));
  };

  // Handler: Reset Class Session
  const handleResetClass = (classId: string) => {
    if (confirm(`Apakah Anda yakin ingin mereset seluruh data instrumen AKPD Kelas ${classId}?`)) {
      updateAkpdSessions((prev) => ({
        ...prev,
        [classId]: {
          classId,
          status: 'draft',
          submissions: []
        }
      }));
      setAkpdAiAnalysis(null);
    }
  };

  // Handler: Generate Class Simulation (30 Students)
  const handleSimulateClassSubmissions = (classId: string) => {
    const now = new Date().toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const classStudents = students.filter((s) => s.class === classId);
    const mockNames = [
      'Ahmad Subagja', 'Aisyah Putri', 'Bagas Prasetyo', 'Bunga Citra', 'Cahyo Utomo',
      'Dewi Lestari', 'Eko Raharjo', 'Fani Indah', 'Gilang Ramadhan', 'Hani Syakira',
      'Irfan Maulana', 'Juli Astuti', 'Kiki Firmansyah', 'Lina Marlina', 'Maman Suherman',
      'Nadia Safitri', 'Oki Setiawan', 'Putri Ayu', 'Qori Amelia', 'Rizky Febrian',
      'Siti Nurhaliza', 'Taufik Hidayat', 'Umar Farooq', 'Vina Panduwinata', 'Wawan Setiawan',
      'Xena Warrior', 'Yudi Latif', 'Zahra Annisa', 'Budi Santoso', 'Rani Permata'
    ];

    const count = Math.max(classStudents.length, 30);
    const generated: AkpdStudentSubmission[] = [];

    for (let i = 0; i < count; i++) {
      const studentName = classStudents[i]?.name || mockNames[i % mockNames.length];
      const studentId = classStudents[i]?.id || `sim-${i + 1}`;

      const items: Record<string, boolean> = {};
      if (i % 4 !== 1) items['akpd-3'] = true; // 75% Prokrastinasi
      if (i % 3 !== 2) items['akpd-13'] = true; // 66% Bakat Minat
      if (i % 2 === 0) items['akpd-1'] = true; // 50% PD
      if (i % 2 === 1) items['akpd-9'] = true; // 50% Gaya Belajar
      if (i % 3 === 0) items['akpd-11'] = true; // 33% Gadget
      if (i % 5 === 1) items['akpd-6'] = true; // 20% Bullying
      if (i % 4 === 0) items['akpd-14'] = true; // 25% SMA/SMK
      if (i % 5 === 3) items['akpd-2'] = true; // Emosi
      if (i % 6 === 2) items['akpd-5'] = true; // Pertemanan

      generated.push({
        studentId,
        studentName,
        submittedAt: now,
        selectedItems: items
      });
    }

    updateAkpdSessions((prev) => ({
      ...prev,
      [classId]: {
        classId,
        status: 'spread',
        spreadDate: now,
        submissions: generated
      }
    }));
    setShowSpreadModal(false);
  };

  // Handler: Save Manual Student Entry
  const handleSaveStudentEntry = (customName?: string, customSelectedItems?: Record<string, boolean>) => {
    const nameToSave = customName !== undefined ? customName : entryStudentName;
    const itemsToSave = customSelectedItems !== undefined ? customSelectedItems : entrySelectedItems;

    if (!nameToSave.trim()) {
      alert('Silakan masukkan nama siswa.');
      return;
    }

    const now = new Date().toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const newSub: AkpdStudentSubmission = {
      studentId: `m-${Date.now()}`,
      studentName: nameToSave.trim(),
      submittedAt: now,
      selectedItems: itemsToSave
    };

    updateAkpdSessions((prev) => {
      const current = prev[selectedClass] || { classId: selectedClass, status: 'spread', submissions: [] };
      const filtered = current.submissions.filter((s) => s.studentName.toLowerCase() !== nameToSave.trim().toLowerCase());
      return {
        ...prev,
        [selectedClass]: {
          ...current,
          status: 'spread',
          submissions: [newSub, ...filtered]
        }
      };
    });

    setEntryStudentName('');
    setEntrySelectedItems({});
    setShowEntryModal(false);
  };

  // Handler: Submit Student Fill Simulator
  const handleSaveStudentFill = () => {
    if (!studentFillName.trim()) {
      alert('Silakan masukkan nama Anda (siswa).');
      return;
    }

    const now = new Date().toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const newSub: AkpdStudentSubmission = {
      studentId: `sfill-${Date.now()}`,
      studentName: studentFillName.trim(),
      submittedAt: now,
      selectedItems: studentFillSelectedItems
    };

    updateAkpdSessions((prev) => {
      const current = prev[selectedClass] || { classId: selectedClass, status: 'spread', submissions: [] };
      return {
        ...prev,
        [selectedClass]: {
          ...current,
          status: 'spread',
          submissions: [newSub, ...current.submissions]
        }
      };
    });

    setStudentFillName('');
    setStudentFillSelectedItems({});
    setShowStudentFillModal(false);
    alert(`Terima kasih, ${newSub.studentName}! Hasil AKPD Anda telah tersimpan dan terhitung otomatis.`);
  };

  // Handler: Delete Single Submission
  const handleDeleteSubmission = (classId: string, subId: string) => {
    if (confirm('Hapus respon siswa ini dari pengolahan AKPD?')) {
      updateAkpdSessions((prev) => {
        const current = prev[classId];
        if (!current) return prev;
        return {
          ...prev,
          [classId]: {
            ...current,
            submissions: current.submissions.filter((s) => s.studentId !== subId)
          }
        };
      });
    }
  };

  // Trigger AI AKPD Analysis
  const handleAnalyzeAkpdAi = async () => {
    setIsAnalyzingAkpd(true);
    try {
      const res = await fetch('/api/gemini/analyze-akpd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: selectedClass,
          stats: akpdStats,
          topItems: akpdStats.topPriority,
        }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        setAkpdAiAnalysis(data.analysis);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzingAkpd(false);
    }
  };

  // Trigger AI RPL Generation
  const handleGenerateRplAi = async () => {
    if (!aiTopic.trim()) {
      alert('Silakan masukkan topik layanan BK terlebih dahulu.');
      return;
    }
    setIsGeneratingRpl(true);
    try {
      const res = await fetch('/api/gemini/generate-rpl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic,
          bidang: aiBidang,
          fase: aiFase,
          aspek: aiAspek,
          alokasi: aiAlokasi,
          metode: aiMetode,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const newRpl: ModulAjarRpl = {
          id: `rpl-ai-${Date.now()}`,
          ...data.data,
        };
        setModulList([newRpl, ...modulList]);
        setSelectedModul(newRpl);
        setShowModulModal(false);
        setAiTopic('');
      }
    } catch (e) {
      console.error(e);
      alert('Gagal membuat RPL AI. Menggunakan Draf Template Standar.');
    } finally {
      setIsGeneratingRpl(false);
    }
  };

  // Trigger AI Script Generation
  const handleGenerateScriptAi = async () => {
    setIsGeneratingScript(true);
    try {
      const res = await fetch('/api/gemini/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: scriptServiceType,
          studentName: scriptStudentName,
          studentProblem: scriptProblem,
        }),
      });
      const data = await res.json();
      if (data.success && data.script) {
        setGeneratedScript(data.script);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Trigger VAK AI Diagnosis
  const handleDiagnoseVakAi = async () => {
    setIsDiagnosingVak(true);
    try {
      const res = await fetch('/api/gemini/diagnose-vak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visualScore: vScore,
          auditoryScore: aScore,
          kinestheticScore: kScore,
          studentName: 'Sampel Siswa',
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setVakDiagnose(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDiagnosingVak(false);
    }
  };

  // Export AKPD PDF Report
  const exportAkpdPdf = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const sc = getSchoolConfig();

    // Kop Surat
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text((sc.governmentName || 'PEMERINTAH KABUPATEN SEMARANG').toUpperCase(), 105, 15, { align: 'center' });
    doc.text((sc.departmentName || 'DINAS PENDIDIKAN').toUpperCase(), 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text(sc.schoolName.toUpperCase(), 105, 26, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(sc.schoolAddress, 105, 31, { align: 'center' });

    // Lines
    doc.setLineWidth(0.8);
    doc.line(15, 35, 195, 35);
    doc.setLineWidth(0.2);
    doc.line(15, 36, 195, 36);

    // Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('LAPORAN HASIL ANALISIS ANGKET KEBUTUHAN PESERTA DIDIK (AKPD)', 105, 45, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`KELAS: ${selectedClass} | TAHUN AJARAN 2025/2026`, 105, 50, { align: 'center' });

    // Summary Box
    doc.setFillColor(245, 247, 250);
    doc.rect(15, 56, 180, 28, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(15, 56, 180, 28, 'D');

    doc.setFontSize(10);
    doc.setFont('Helvetica', 'bold');
    doc.text('PERSENTASE KEBUTUHAN LAYANAN PER BIDANG:', 20, 62);

    doc.setFont('Helvetica', 'normal');
    doc.text(`1. Bidang Pribadi  : ${akpdStats.avgPribadi}%`, 25, 68);
    doc.text(`2. Bidang Sosial   : ${akpdStats.avgSosial}%`, 25, 74);
    doc.text(`3. Bidang Belajar  : ${akpdStats.avgBelajar}%`, 110, 68);
    doc.text(`4. Bidang Karir    : ${akpdStats.avgKarir}%`, 110, 74);

    // Top Priorities Table Header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('5 ITEM MASALAH PRIORITAS UTAMA HASIL AKPD:', 15, 92);

    let y = 98;
    doc.setFillColor(0, 104, 95);
    doc.rect(15, y, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('No', 18, y + 5.5);
    doc.text('Kode', 28, y + 5.5);
    doc.text('Butir Pertanyaan AKPD', 45, y + 5.5);
    doc.text('Pilihan', 145, y + 5.5);
    doc.text('Bidang', 170, y + 5.5);

    y += 8;
    doc.setTextColor(0, 0, 0);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);

    akpdStats.topPriority.forEach((item, idx) => {
      const splitText = doc.splitTextToSize(item.question, 95);
      const rowHeight = Math.max(10, splitText.length * 4.5 + 3);

      if (y + rowHeight > 275) {
        doc.addPage();
        y = 25;
      }

      const isEven = idx % 2 === 0;
      if (isEven) {
        doc.setFillColor(248, 249, 250);
        doc.rect(15, y, 180, rowHeight, 'F');
      }

      doc.text(`${idx + 1}.`, 18, y + 5);
      doc.text(item.code, 28, y + 5);
      doc.text(splitText, 45, y + 5);
      doc.text(`${item.score}%`, 147, y + 5);
      doc.text(item.bidang, 170, y + 5);

      y += rowHeight;
    });

    // Signature Area
    y += 10;
    if (y + 40 > 275) {
      doc.addPage();
      y = 25;
    }
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    doc.text(`Semarang, ${dateStr}`, 135, y);
    doc.text(`Kepala ${sc.schoolName},`, 20, y + 5);
    doc.text('Guru Bimbingan Konseling,', 135, y + 5);

    doc.setFont('Helvetica', 'bold');
    doc.text(sc.principalName, 20, y + 28);
    doc.text('Guru BK, S.Pd.', 135, y + 28);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`NIP. ${sc.principalNip}`, 20, y + 33);
    doc.text('NIP. 19850412 201001 2 018', 135, y + 33);

    doc.save(`Laporan_AKPD_Kelas_${selectedClass}_${sc.schoolName.replace(/\s+/g, '_')}.pdf`);
  };

  // Copy Helper Functions
  const showNotification = (msg: string) => {
    showToast(msg, 'success');
    setCopyToast(msg);
    setTimeout(() => setCopyToast(null), 3500);
  };

  const handleCopyNotebookLm = () => {
    if (!selectedModul?.pptOutline?.notebookLmPrompt) return;
    navigator.clipboard.writeText(selectedModul.pptOutline.notebookLmPrompt);
    showNotification('Prompt NotebookLM berhasil disalin ke clipboard!');
  };

  const handleCopyMateriLkpd = () => {
    if (!selectedModul) return;
    const materiText = selectedModul.materiBimbingan
      ? `=== MATERI LAYANAN BIMBINGAN: ${selectedModul.title} ===\n\nRingkasan:\n${selectedModul.materiBimbingan.ringkasanMateri}\n\nPoin Utama:\n${selectedModul.materiBimbingan.poinMateri.map(p => `- ${p}`).join('\n')}\n\nStudi Kasus:\n${selectedModul.materiBimbingan.studiKasus}\n\nTips Praktis:\n${selectedModul.materiBimbingan.tipsPraktis.map(t => `- ${t}`).join('\n')}`
      : '';
    const lkpdText = selectedModul.lkpd
      ? `\n\n=== LEMBAR KERJA PESERTA DIDIK (LKPD) ===\nJudul: ${selectedModul.lkpd.judulLkpd}\nInstruksi: ${selectedModul.lkpd.instruksi}\n\nPertanyaan Refleksi:\n${selectedModul.lkpd.pertanyaanRefleksi.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nKomitmen Aksi:\n${selectedModul.lkpd.lembarAksiNyata}\n\nRubrik Penilaian: ${selectedModul.lkpd.rubrikPenilaian}`
      : '';

    navigator.clipboard.writeText(`${materiText}${lkpdText}`);
    showNotification('Materi Layanan & LKPD berhasil disalin!');
  };

  const handleCopyPptOutline = () => {
    if (!selectedModul?.pptOutline) return;
    const slidesText = selectedModul.pptOutline.slides.map(s => `SLIDE ${s.slideNo}: ${s.title}\nPoin-Poin:\n${s.bulletPoints.map(b => `- ${b}`).join('\n')}\nCatatan Guru: ${s.speakerNotes}`).join('\n\n');
    navigator.clipboard.writeText(`=== OUTLINE PRESENTASI SLIDE / CANVA ===\nJudul: ${selectedModul.pptOutline.slideJudul}\n\n${slidesText}`);
    showNotification('Outline Slide PPT berhasil disalin!');
  };

  // Export RPL Modul Ajar PDF (Paket Lengkap)
  const exportModulPdf = (modul: ModulAjarRpl) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const sc = getSchoolConfig();

    const addKopSurat = () => {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text((sc.governmentName || 'PEMERINTAH KABUPATEN SEMARANG').toUpperCase(), 105, 14, { align: 'center' });
      doc.text((sc.departmentName || 'DINAS PENDIDIKAN').toUpperCase(), 105, 18, { align: 'center' });
      doc.setFontSize(13);
      doc.text(sc.schoolName.toUpperCase(), 105, 24, { align: 'center' });
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(sc.schoolAddress, 105, 29, { align: 'center' });

      doc.setLineWidth(0.8);
      doc.line(15, 32, 195, 32);
      doc.setLineWidth(0.2);
      doc.line(15, 33, 195, 33);
    };

    addKopSurat();

    // Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('MODUL AJAR / RENCANA PELAKSANAAN LAYANAN (RPL) BK', 105, 41, { align: 'center' });
    doc.setFontSize(10);
    doc.text('KURIKULUM MERDEKA', 105, 46, { align: 'center' });

    let y = 54;

    // Identitas Table
    doc.setFillColor(240, 248, 246);
    doc.rect(15, y, 180, 26, 'F');
    doc.setDrawColor(0, 104, 95);
    doc.rect(15, y, 180, 26, 'D');

    doc.setFontSize(9);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Topik Layanan : ${modul.title}`, 18, y + 6);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Satuan Pendidikan : ${sc.schoolName}`, 18, y + 11);
    doc.text(`Fase / Kelas : ${modul.fase}`, 18, y + 16);
    doc.text(`Bidang Layanan : ${modul.bidang}`, 18, y + 21);

    doc.text(`Alokasi Waktu : ${modul.alokasiWaktu}`, 115, y + 11);
    doc.text(`Aspek SKKPD : ${modul.aspekCode} (${modul.aspekName})`, 115, y + 16);
    doc.text(`Metode : ${modul.metode}`, 115, y + 21);

    y += 32;

    // Komponen Inti
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('A. CAPAIAN & TUJUAN LAYANAN', 15, y);
    y += 5;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    const tPengenalan = doc.splitTextToSize(`1. Tahap Pengenalan (Kognitif): ${modul.tujuanPengenalan}`, 175);
    doc.text(tPengenalan, 18, y);
    y += tPengenalan.length * 4.5;

    const tAkomodasi = doc.splitTextToSize(`2. Tahap Akomodasi (Afektif): ${modul.tujuanAkomodasi}`, 175);
    doc.text(tAkomodasi, 18, y);
    y += tAkomodasi.length * 4.5;

    const tTindakan = doc.splitTextToSize(`3. Tahap Tindakan (Psikomotorik): ${modul.tujuanTindakan}`, 175);
    doc.text(tTindakan, 18, y);
    y += tTindakan.length * 4.5 + 4;

    // Langkah Kegiatan
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('B. LANGKAH-LANGKAH KEGIATAN LAYANAN', 15, y);
    y += 5;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('1. Tahap Pendahuluan / Awal:', 18, y);
    y += 4.5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    modul.langkahPendahuluan.forEach((lp) => {
      const split = doc.splitTextToSize(`• ${lp}`, 170);
      doc.text(split, 22, y);
      y += split.length * 4;
    });

    y += 2;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('2. Tahap Inti (Experiential Learning):', 18, y);
    y += 4.5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    modul.langkahInti.forEach((li) => {
      const split = doc.splitTextToSize(`• ${li}`, 170);
      doc.text(split, 22, y);
      y += split.length * 4;
    });

    y += 2;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('3. Tahap Penutup:', 18, y);
    y += 4.5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    modul.langkahPenutup.forEach((lp) => {
      const split = doc.splitTextToSize(`• ${lp}`, 170);
      doc.text(split, 22, y);
      y += split.length * 4;
    });

    y += 5;
    // Evaluasi
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('C. EVALUASI DAN TINDAK LANJUT', 15, y);
    y += 5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    const splitEvProses = doc.splitTextToSize(`1. Evaluasi Proses: ${modul.evaluasiProses.join('; ')}`, 175);
    doc.text(splitEvProses, 18, y);
    y += splitEvProses.length * 4.5;

    const splitEvHasil = doc.splitTextToSize(`2. Evaluasi Hasil : ${modul.evaluasiHasil.join('; ')}`, 175);
    doc.text(splitEvHasil, 18, y);
    y += splitEvHasil.length * 4.5;

    // Signature Area
    y += 10;
    if (y + 35 > 275) {
      doc.addPage();
      y = 20;
    }

    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFontSize(9);
    doc.text(`Mengetahui,`, 20, y);
    doc.text(`Semarang, ${dateStr}`, 135, y);
    doc.text(`Kepala ${sc.schoolName},`, 20, y + 4);
    doc.text('Guru Bimbingan Konseling,', 135, y + 4);

    doc.setFont('Helvetica', 'bold');
    doc.text(sc.principalName, 20, y + 22);
    doc.text('Guru BK, S.Pd.', 135, y + 22);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`NIP. ${sc.principalNip}`, 20, y + 26);
    doc.text('NIP. 19850412 201001 2 018', 135, y + 26);

    // LAMPIRAN 1: MATERI LAYANAN
    if (modul.materiBimbingan) {
      doc.addPage();
      addKopSurat();
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('LAMPIRAN 1: MATERI LAYANAN BIMBINGAN (BAHAN BACAAN GURU & SISWA)', 105, 41, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`TOPIK: ${modul.title.toUpperCase()}`, 105, 46, { align: 'center' });

      y = 54;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('1. Ringkasan & Konsep Dasar:', 15, y);
      y += 5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      const splitRingkasan = doc.splitTextToSize(modul.materiBimbingan.ringkasanMateri, 175);
      doc.text(splitRingkasan, 18, y);
      y += splitRingkasan.length * 4.5 + 4;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('2. Poin-Poin Penting Pembahasan:', 15, y);
      y += 5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      modul.materiBimbingan.poinMateri.forEach((pm) => {
        const splitPm = doc.splitTextToSize(`• ${pm}`, 170);
        doc.text(splitPm, 18, y);
        y += splitPm.length * 4.5;
      });
      y += 3;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('3. Studi Kasus Imersif:', 15, y);
      y += 5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      const splitSk = doc.splitTextToSize(modul.materiBimbingan.studiKasus, 175);
      doc.text(splitSk, 18, y);
      y += splitSk.length * 4.5 + 4;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('4. Tips Praktis & Strategi Aksi:', 15, y);
      y += 5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      modul.materiBimbingan.tipsPraktis.forEach((tp) => {
        const splitTp = doc.splitTextToSize(`✔ ${tp}`, 170);
        doc.text(splitTp, 18, y);
        y += splitTp.length * 4.5;
      });
    }

    // LAMPIRAN 2: LKPD
    if (modul.lkpd) {
      doc.addPage();
      addKopSurat();
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('LAMPIRAN 2: LEMBAR KERJA PESERTA DIDIK (LKPD)', 105, 41, { align: 'center' });
      doc.setFontSize(9.5);
      doc.text(modul.lkpd.judulLkpd.toUpperCase(), 105, 46, { align: 'center' });

      y = 54;
      // Header Siswa
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y, 180, 16, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(15, y, 180, 16, 'D');
      doc.setFontSize(8.5);
      doc.setFont('Helvetica', 'normal');
      doc.text('Nama Lengkap Siswa : ...........................................................', 18, y + 6);
      doc.text('Kelas / No. Absen   : ..................... / .........', 18, y + 11);
      doc.text('Hari / Tanggal       : ...........................................', 115, y + 6);

      y += 22;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('A. PETUNJUK PENGERJAAN:', 15, y);
      y += 4.5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      const splitInst = doc.splitTextToSize(modul.lkpd.instruksi, 175);
      doc.text(splitInst, 18, y);
      y += splitInst.length * 4.5 + 4;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('B. PERTANYAAN REFLEKSI MANDIRI:', 15, y);
      y += 5;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      modul.lkpd.pertanyaanRefleksi.forEach((pr, idx) => {
        const splitPr = doc.splitTextToSize(`${idx + 1}. ${pr}`, 175);
        doc.text(splitPr, 18, y);
        y += splitPr.length * 4.5 + 1;
        // Blank lines for student response
        doc.setDrawColor(220, 220, 220);
        doc.line(18, y + 4, 190, y + 4);
        doc.line(18, y + 9, 190, y + 9);
        y += 14;
      });

      y += 2;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('C. LEMBAR KOMITMEN & AKSI NYATA:', 15, y);
      y += 5;
      doc.setFillColor(250, 250, 245);
      doc.rect(15, y, 180, 18, 'F');
      doc.rect(15, y, 180, 18, 'D');
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      const splitAksi = doc.splitTextToSize(modul.lkpd.lembarAksiNyata, 172);
      doc.text(splitAksi, 18, y + 5);

      y += 24;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Rubrik Penilaian Guru:', 15, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(modul.lkpd.rubrikPenilaian, 45, y);
    }

    // LAMPIRAN 3: PPT & NOTEBOOKLM
    if (modul.pptOutline) {
      doc.addPage();
      addKopSurat();
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('LAMPIRAN 3: OUTLINE SLIDE PRESENTASI & NOTEBOOKLM PROMPT', 105, 41, { align: 'center' });
      doc.setFontSize(9.5);
      doc.text(`MEDIA PRESENTASI: ${modul.pptOutline.slideJudul.toUpperCase()}`, 105, 46, { align: 'center' });

      y = 54;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('1. Structure Slide Presentation (PPT / Canva):', 15, y);
      y += 6;

      modul.pptOutline.slides.forEach((sl) => {
        if (y + 25 > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFillColor(240, 245, 250);
        doc.rect(15, y, 180, 6, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(`SLIDE ${sl.slideNo}: ${sl.title}`, 18, y + 4.5);
        y += 8;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        sl.bulletPoints.forEach((bp) => {
          const splitBp = doc.splitTextToSize(`• ${bp}`, 170);
          doc.text(splitBp, 20, y);
          y += splitBp.length * 4;
        });

        doc.setFont('Helvetica', 'italic');
        doc.text(`Catatan Guru (Speaker Notes): ${sl.speakerNotes}`, 20, y);
        y += 6;
      });

      y += 4;
      if (y + 30 < 270) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text('2. Prompt Sumber notebookLM (Google AI Audio Podcast):', 15, y);
        y += 5;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        const splitNblm = doc.splitTextToSize(modul.pptOutline.notebookLmPrompt, 175);
        doc.text(splitNblm, 18, y);
      }
    }

    doc.save(`Paket_Lengkap_RPL_BK_${modul.title.slice(0, 20).replace(/\s+/g, '_')}_${sc.schoolName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#00685f] via-[#008378] to-[#0b1c30] text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-200 text-xs font-bold uppercase tracking-widest mb-1">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>Kurikulum Merdeka Bimbingan Konseling & Gemini AI Assistant</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Asesmen BK & Perangkat Layanan</span>
              <span className="px-2.5 py-0.5 bg-amber-400 text-gray-900 rounded-full text-[10px] font-black uppercase tracking-wider">
                Fitur AI Active
              </span>
            </h2>
            <p className="text-teal-100/90 text-xs sm:text-sm font-medium mt-1 max-w-2xl leading-relaxed">
              Pusat pengelolaan AKPD, Capaian Layanan (CL) per Fase, Alur Tujuan Layanan (ATL), Generator RPL BK Otomatis, dan AI Skrip Konseling Empatik untuk {schoolConfig.schoolName}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20">
            <button
              onClick={() => setShowModulModal(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-gray-900 rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Bot className="w-4 h-4" />
              <span>⚡ Generator RPL AI</span>
            </button>
            <button
              onClick={() => setActiveTab('ai-script')}
              className="px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Skrip Konseling AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Sub-Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-[#bcc9c6]/30 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('akpd')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'akpd'
              ? 'bg-[#00685f] text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>AKPD & AI Konselor</span>
        </button>

        <button
          onClick={() => setActiveTab('capaian')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'capaian'
              ? 'bg-[#00685f] text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Capaian Layanan (CL) per Fase</span>
        </button>

        <button
          onClick={() => setActiveTab('atl')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'atl'
              ? 'bg-[#00685f] text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Alur Tujuan Layanan (ATL)</span>
        </button>

        <button
          onClick={() => setActiveTab('modul')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'modul'
              ? 'bg-[#00685f] text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Modul Ajar / RPL BK</span>
        </button>

        <button
          onClick={() => setActiveTab('ai-script')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'ai-script'
              ? 'bg-[#00685f] text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Bot className="w-4 h-4 text-amber-500" />
          <span>Panduan Konseling AI</span>
        </button>
      </div>

      {/* TAB 1: AKPD (Angket Kebutuhan Peserta Didik) + AI Konselor */}
      {activeTab === 'akpd' && (
        <div className="space-y-6">
          {/* Top Controls & Class Selector */}
          <div className="bg-white p-5 rounded-2xl border border-[#bcc9c6]/30 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider shrink-0">
                Pilih Kelas Target AKPD:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {availableClasses.map((cls) => {
                  const session = akpdSessions[cls];
                  const respCount = session?.submissions?.length || 0;
                  const isSpread = session?.status === 'spread' && respCount > 0;

                  return (
                    <button
                      key={cls}
                      onClick={() => {
                        setSelectedClass(cls);
                        setAkpdAiAnalysis(null);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedClass === cls
                          ? 'bg-[#00685f] text-white shadow-xs'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>Kelas {cls}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                          selectedClass === cls
                            ? 'bg-white/20 text-white'
                            : isSpread
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {respCount > 0 ? `${respCount} Siswa` : 'Belum Disebar'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
              <button
                onClick={() => setShowSpreadModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Sebar Instrumen Online</span>
              </button>

              <button
                onClick={() => {
                  setEntryStudentName('');
                  setEntrySelectedItems({});
                  setShowEntryModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-[#00685f] border border-teal-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Input Jawaban Siswa</span>
              </button>

              {totalResponding > 0 && (
                <button
                  onClick={() => setShowRespondenModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Users className="w-4 h-4 text-gray-500" />
                  <span>Detail Responden ({totalResponding})</span>
                </button>
              )}

              <button
                onClick={handleAnalyzeAkpdAi}
                disabled={isAnalyzingAkpd || totalResponding === 0}
                title={totalResponding === 0 ? 'Sebar & kumpulkan respon siswa terlebih dahulu untuk menganalisis' : 'Analisis AI'}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs cursor-pointer disabled:opacity-40"
              >
                {isAnalyzingAkpd ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menganalisis...</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-3.5 h-3.5 text-amber-300" />
                    <span>Analisis AI Konselor</span>
                  </>
                )}
              </button>

              <button
                onClick={exportAkpdPdf}
                disabled={totalResponding === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-40"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak PDF</span>
              </button>

              {totalResponding > 0 && (
                <button
                  onClick={() => handleResetClass(selectedClass)}
                  title="Reset Data Kelas Ini"
                  className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Status Bar Banner */}
          <div className="bg-teal-50/80 border border-teal-200/80 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${totalResponding > 0 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                {totalResponding > 0 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </div>
              <div>
                <span className="font-extrabold text-[#0b1c30] text-xs block">
                  Status AKPD Kelas {selectedClass}:{' '}
                  <span className={totalResponding > 0 ? 'text-emerald-700 font-black' : 'text-amber-700 font-black'}>
                    {totalResponding > 0 ? `Aktif (${totalResponding} Respon Siswa Terkumpul)` : 'Belum Ada Data Jawaban Siswa'}
                  </span>
                </span>
                <p className="text-gray-600 font-medium text-[11px] mt-0.5">
                  {totalResponding > 0
                    ? `Data kebutuhan dan 5 item masalah prioritas dihitung secara otomatis dari ${totalResponding} siswa.`
                    : 'Masalah prioritas tidak ditampilkan secara acak. Sebar instrumen online atau input jawaban untuk memunculkan analisis otomatis.'}
                </p>
              </div>
            </div>

            {totalResponding === 0 && (
              <button
                onClick={() => handleSimulateClassSubmissions(selectedClass)}
                className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>⚡ Isi Otomatis 30 Siswa (Simulasi)</span>
              </button>
            )}
          </div>

          {/* EMPTY STATE: Before instrument spread / filled */}
          {totalResponding === 0 ? (
            <div className="bg-white rounded-3xl border border-[#bcc9c6]/30 p-8 text-center space-y-6 shadow-xs">
              <div className="w-16 h-16 bg-teal-50 text-[#00685f] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <Send className="w-8 h-8 text-[#00685f]" />
              </div>

              <div className="max-w-xl mx-auto space-y-2">
                <h3 className="text-lg font-black text-[#0b1c30]">
                  Instrumen AKPD Kelas {selectedClass} Belum Disebar / Belum Ada Respon
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                  Masalah prioritas bimbingan konseling dan persentase kebutuhan bidang layanan baru akan dihitung secara otomatis berdasarkan respon nyata siswa. Silakan pilih metode pengumpulan data berikut:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto pt-2">
                <div
                  onClick={() => setShowSpreadModal(true)}
                  className="p-5 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/40 hover:bg-teal-50 transition-all cursor-pointer text-left space-y-3 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#00685f] text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Share2 className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#00685f]">1. Sebar Tautan Online</h4>
                    <p className="text-[11px] text-gray-600 mt-1">
                      Bagikan link instrumen digital / QR code ke grup WhatsApp kelas agar siswa mengisi langsung dari HP.
                    </p>
                  </div>
                  <span className="inline-flex items-center text-[11px] font-bold text-[#00685f]">
                    Buka Link & QR Code <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </span>
                </div>

                <div
                  onClick={() => {
                    setEntryStudentName('');
                    setEntrySelectedItems({});
                    setShowEntryModal(true);
                  }}
                  className="p-5 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 hover:bg-gray-100/80 transition-all cursor-pointer text-left space-y-3 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-800 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Edit3 className="w-5 h-5 text-teal-300" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-gray-800">2. Input Manual Hasil Fisik</h4>
                    <p className="text-[11px] text-gray-600 mt-1">
                      Masukkan data secara manual per siswa apabila menggunakan instrumen cetak/kertas di kelas.
                    </p>
                  </div>
                  <span className="inline-flex items-center text-[11px] font-bold text-gray-800">
                    Input Jawaban Siswa <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </span>
                </div>

                <div
                  onClick={() => handleSimulateClassSubmissions(selectedClass)}
                  className="p-5 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 hover:bg-amber-50 transition-all cursor-pointer text-left space-y-3 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-amber-900">3. Simulasi Respon (30 Siswa)</h4>
                    <p className="text-[11px] text-gray-600 mt-1">
                      Sistem akan membangkitkan 30 data siswa sampel secara acak terstruktur untuk pengujian instan.
                    </p>
                  </div>
                  <span className="inline-flex items-center text-[11px] font-bold text-amber-800">
                    Generasi 30 Siswa Instant <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* DATA ACTIVE STATE: Calculated Percentages & Real Top Priority Issues */
            <>
              {/* 4 Bidang Layanan Needs Percentage Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-teal-100 shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-full bg-[#00685f]"></div>
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                    Bidang Pribadi
                  </p>
                  <h3 className="text-2xl font-black text-[#0b1c30] mt-1">
                    {akpdStats.avgPribadi}%
                  </h3>
                  <p className="text-xs text-gray-500 font-semibold mt-1">
                    Rata-rata Kebutuhan ({totalResponding} Siswa)
                  </p>
                  <div className="w-full bg-gray-100 h-2 rounded-full mt-3 overflow-hidden">
                    <div
                      className="bg-[#00685f] h-full rounded-full transition-all duration-500"
                      style={{ width: `${akpdStats.avgPribadi}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-full bg-indigo-600"></div>
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                    Bidang Sosial
                  </p>
                  <h3 className="text-2xl font-black text-[#0b1c30] mt-1">
                    {akpdStats.avgSosial}%
                  </h3>
                  <p className="text-xs text-gray-500 font-semibold mt-1">
                    Rata-rata Kebutuhan ({totalResponding} Siswa)
                  </p>
                  <div className="w-full bg-gray-100 h-2 rounded-full mt-3 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${akpdStats.avgSosial}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-full bg-amber-500"></div>
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                    Bidang Belajar
                  </p>
                  <h3 className="text-2xl font-black text-[#0b1c30] mt-1">
                    {akpdStats.avgBelajar}%
                  </h3>
                  <p className="text-xs text-gray-500 font-semibold mt-1">
                    Rata-rata Kebutuhan ({totalResponding} Siswa)
                  </p>
                  <div className="w-full bg-gray-100 h-2 rounded-full mt-3 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${akpdStats.avgBelajar}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-full bg-purple-600"></div>
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                    Bidang Karir
                  </p>
                  <h3 className="text-2xl font-black text-[#0b1c30] mt-1">
                    {akpdStats.avgKarir}%
                  </h3>
                  <p className="text-xs text-gray-500 font-semibold mt-1">
                    Rata-rata Kebutuhan ({totalResponding} Siswa)
                  </p>
                  <div className="w-full bg-gray-100 h-2 rounded-full mt-3 overflow-hidden">
                    <div
                      className="bg-purple-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${akpdStats.avgKarir}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* AI Counselor Insights Output Card (if generated) */}
              {akpdAiAnalysis && (
                <div className="p-6 bg-gradient-to-br from-teal-900 via-[#005049] to-[#0b1c30] text-white rounded-3xl shadow-lg border border-teal-500/30 space-y-5 animate-in slide-in-from-bottom duration-300">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-400 text-gray-900 rounded-xl">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white">
                          Diagnostik & Rekomendasi AI Konselor (Kelas {selectedClass})
                        </h3>
                        <p className="text-xs text-teal-200">
                          Analisis otomatis oleh Gemini 3.6 Flash berdasarkan instrumen AKPD ({totalResponding} Respon Siswa)
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAkpdAiAnalysis(null)}
                      className="text-xs font-bold text-teal-200 hover:text-white"
                    >
                      Tutup
                    </button>
                  </div>

                  <div className="space-y-4 text-xs leading-relaxed">
                    <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15">
                      <h4 className="font-extrabold text-amber-300 uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        Ringkasan Kebutuhan Kelas:
                      </h4>
                      <p className="text-teal-50 font-medium">{akpdAiAnalysis.summary}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                        <h4 className="font-extrabold text-teal-200 uppercase tracking-wider text-[11px] flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                          Akar Masalah Utama:
                        </h4>
                        <ul className="space-y-1.5 text-gray-200">
                          {akpdAiAnalysis.rootCauses.map((rc, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-amber-400 font-bold">•</span>
                              <span>{rc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                        <h4 className="font-extrabold text-teal-200 uppercase tracking-wider text-[11px] flex items-center gap-1">
                          <Lightbulb className="w-4 h-4 text-yellow-300" />
                          Rekomendasi Layanan BK:
                        </h4>
                        <ul className="space-y-1.5 text-gray-200">
                          {akpdAiAnalysis.recommendations.map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-teal-300 font-bold">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                        <h4 className="font-extrabold text-teal-200 uppercase tracking-wider text-[11px] flex items-center gap-1">
                          <Target className="w-4 h-4 text-emerald-400" />
                          Rencana Aksi Mingguan:
                        </h4>
                        <ul className="space-y-1.5 text-gray-200">
                          {akpdAiAnalysis.actionPlan.map((ap, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-emerald-400 font-bold">•</span>
                              <span>{ap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Top 5 Priority Problems & Recommended Topics */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-xs p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-[#0b1c30]">
                        5 Item Masalah Prioritas Utama (AKPD Kelas {selectedClass})
                      </h3>
                      <p className="text-xs text-gray-500">
                        Otomatis dihitung berdasarkan data {totalResponding} siswa responden
                      </p>
                    </div>
                    <span className="text-[10px] bg-red-50 text-red-600 font-extrabold px-2.5 py-1 rounded-full border border-red-200">
                      Prioritas Tinggi
                    </span>
                  </div>

                  <div className="space-y-3">
                    {akpdStats.topPriority.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-teal-50/30 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <span className="w-6 h-6 rounded-full bg-[#00685f] text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-2 py-0.2 bg-gray-200 text-gray-700 rounded">
                                {item.code}
                              </span>
                              <span className="text-[10px] font-extrabold text-[#00685f]">
                                Bidang {item.bidang}
                              </span>
                              <span className="text-[10px] font-bold text-gray-500">
                                ({item.countSelected} dari {totalResponding} siswa)
                              </span>
                            </div>
                            <p className="text-xs font-bold text-[#0b1c30] mt-1">
                              {item.question}
                            </p>
                            <p className="text-[11px] text-gray-600 font-medium mt-1">
                              💡 Rekomendasi RPL: <span className="font-bold text-[#00685f]">{item.rekomendasiTopik}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end">
                          <span className="text-base font-black text-[#00685f]">{item.percentage}%</span>
                          <button
                            onClick={() => {
                              setAiTopic(item.rekomendasiTopik);
                              setAiBidang(item.bidang as any);
                              setShowModulModal(true);
                            }}
                            className="mt-1 text-[10px] font-extrabold text-[#00685f] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>Buat RPL AI</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Action Box */}
                <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl border border-teal-200 p-6 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-[#00685f] text-white flex items-center justify-center mb-3">
                      <Sparkles className="w-5 h-5 text-amber-300" />
                    </div>
                    <h3 className="text-base font-extrabold text-[#00685f]">
                      Program BK Berbasis Data AKPD Nyata
                    </h3>
                    <p className="text-xs text-gray-600 leading-relaxed mt-2">
                      Hasil AKPD kelas {selectedClass} dari {totalResponding} siswa menunjukkan kebutuhan tertinggi pada bidang{' '}
                      <strong className="text-[#00685f]">
                        {akpdStats.avgPribadi >= akpdStats.avgBelajar ? 'Pribadi & Sosial' : 'Belajar & Karir'}
                      </strong>
                      . Masalah terbanyak:{' '}
                      <em className="font-bold text-gray-800">
                        "{akpdStats.topPriority[0]?.question}"
                      </em>{' '}
                      ({akpdStats.topPriority[0]?.percentage}% siswa).
                    </p>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-teal-200">
                    <button
                      onClick={() => {
                        setAiTopic(akpdStats.topPriority[0]?.rekomendasiTopik || 'Pengembangan Potensi Diri');
                        setShowModulModal(true);
                      }}
                      className="w-full py-2.5 px-4 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Bot className="w-4 h-4 text-amber-300" />
                      <span>Susun RPL AI untuk Masalah Utama ({akpdStats.topPriority[0]?.code})</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: Capaian Layanan (CL) per Fase */}
      {activeTab === 'capaian' && (
        <div className="space-y-6">
          {/* Fase Selector & Search */}
          <div className="bg-white p-5 rounded-2xl border border-[#bcc9c6]/30 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Pilih Fase Kurikulum:
              </span>
              <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl">
                {(['Fase D', 'Fase E', 'Fase F'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setSelectedFase(f)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      selectedFase === f ? 'bg-[#00685f] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {f} {f === 'Fase D' ? '(SMP/MTs)' : f === 'Fase E' ? '(SMA Kls 10)' : '(SMA Kls 11-12)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari aspek perkembangan..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
              />
            </div>
          </div>

          {/* 10 Aspek SKKPD Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ASPEK_PERKEMBANGAN_LIST.filter(
              (asp) =>
                !searchQuery ||
                asp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                asp.description.toLowerCase().includes(searchQuery.toLowerCase())
            ).map((asp) => {
              const capaian =
                selectedFase === 'Fase D'
                  ? asp.capaianFaseD
                  : selectedFase === 'Fase E'
                  ? asp.capaianFaseE
                  : asp.capaianFaseF;

              return (
                <div
                  key={asp.id}
                  className="bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-xs p-5 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black bg-[#00685f]/10 text-[#00685f] px-2.5 py-1 rounded-lg">
                        {asp.code}
                      </span>
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                        {selectedFase}
                      </span>
                    </div>

                    <h4 className="text-base font-black text-[#0b1c30]">{asp.name}</h4>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{asp.description}</p>

                    {/* 3 Internalisasi Nilai Steps */}
                    <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                      <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                        <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-0.5">
                          1. Pengenalan (Kognitif)
                        </span>
                        <p className="text-xs font-semibold text-gray-800">{capaian.pengenalan}</p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100">
                        <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block mb-0.5">
                          2. Akomodasi (Afektif)
                        </span>
                        <p className="text-xs font-semibold text-gray-800">{capaian.akomodasi}</p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-100">
                        <span className="text-[10px] font-extrabold text-[#00685f] uppercase tracking-wider block mb-0.5">
                          3. Tindakan (Psikomotorik)
                        </span>
                        <p className="text-xs font-semibold text-gray-800">{capaian.tindakan}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setAiTopic(asp.name);
                      setAiAspek(asp.code);
                      setShowModulModal(true);
                    }}
                    className="w-full py-2 bg-teal-50 hover:bg-teal-100 text-[#00685f] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Bot className="w-3.5 h-3.5 text-amber-500" />
                    <span>Rancang RPL AI untuk Aspek Ini</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Alur Tujuan Layanan (ATL) */}
      {activeTab === 'atl' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-[#bcc9c6]/30 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-[#0b1c30]">
                  Pemetaan Alur Tujuan Layanan (ATL) BK {selectedFase}
                </h3>
                <p className="text-xs text-gray-500">
                  Kerangka kerja operasional penyusunan program BK tahunan dan semesteran
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowModulModal(true)}
                  className="px-3.5 py-2 bg-[#00685f] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-[#005049] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat ATL / RPL Baru AI</span>
                </button>
              </div>
            </div>

            {/* ATL Matrix Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#00685f] text-white font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Aspek SKKPD</th>
                    <th className="p-3">Bidang</th>
                    <th className="p-3">Tujuan Layanan (Pengenalan - Akomodasi - Tindakan)</th>
                    <th className="p-3">Strategi Layanan</th>
                    <th className="p-3 text-center">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {ASPEK_PERKEMBANGAN_LIST.slice(0, 6).map((asp, idx) => (
                    <tr key={asp.id} className="hover:bg-gray-50/80">
                      <td className="p-3 font-bold text-[#0b1c30] whitespace-nowrap">
                        <span className="block text-[10px] text-[#00685f] font-black">{asp.code}</span>
                        {asp.name}
                      </td>
                      <td className="p-3 font-semibold text-gray-700">
                        <span className="px-2 py-0.5 rounded bg-teal-50 text-[#00685f] font-bold text-[10px]">
                          {idx % 2 === 0 ? 'Pribadi' : 'Sosial'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-800 font-medium">
                        <p>• {asp.capaianFaseD.pengenalan}</p>
                        <p>• {asp.capaianFaseD.tindakan}</p>
                      </td>
                      <td className="p-3 font-bold text-[#00685f]">
                        {idx % 2 === 0 ? 'Bimbingan Klasikal' : 'Konseling Kelompok'}
                      </td>
                      <td className="p-3 text-center font-bold text-gray-600">2 JP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Modul Ajar / RPL BK Kurikulum Merdeka */}
      {activeTab === 'modul' && (
        <div className="space-y-6">
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-black text-[#0b1c30]">
                Modul Ajar & RPL Layanan BK
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">
                Koleksi RPL BK Kurikulum Merdeka atau rancang RPL baru berfasilitas AI Gemini.
              </p>
            </div>

            <button
              onClick={() => setShowModulModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-[#00685f] to-teal-700 hover:from-[#005049] hover:to-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Bot className="w-4 h-4 text-amber-300" />
              <span>⚡ Buat RPL BK Baru dengan AI</span>
            </button>
          </div>

          {/* List & Detail Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Preset List */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                Daftar Modul RPL Tersedia ({modulList.length})
              </span>
              {modulList.map((m) => {
                const isSelected = selectedModul?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedModul(m)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50/80 border-[#00685f] shadow-xs'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-teal-100 text-[#00685f]">
                        {m.bidang}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">{m.fase}</span>
                    </div>

                    <h4 className="text-xs font-black text-[#0b1c30] line-clamp-2">
                      {m.title}
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-1 font-medium">
                      ⏱ {m.alokasiWaktu} | {m.aspekCode}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Right: Selected Modul Full Detail Preview */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-xs p-6 space-y-6 relative">
              {copyToast && (
                <div className="absolute top-4 right-4 z-20 bg-[#00685f] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>{copyToast}</span>
                </div>
              )}

              {selectedModul ? (
                <>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black bg-[#00685f] text-white px-2.5 py-1 rounded-lg uppercase tracking-wider">
                          {selectedModul.bidang} • {selectedModul.fase}
                        </span>
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg">
                          Paket Lengkap + Materi + LKPD + PPT
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-[#0b1c30] mt-2">
                        {selectedModul.title}
                      </h3>
                      <p className="text-xs text-gray-500 font-semibold mt-0.5">
                        {schoolConfig.schoolName} | Aspek SKKPD: {selectedModul.aspekCode} ({selectedModul.aspekName})
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        onClick={() => exportModulPdf(selectedModul)}
                        className="px-3.5 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        title="Unduh Paket Lengkap RPL, Materi, LKPD, dan PPT dalam 1 File PDF"
                      >
                        <Download className="w-4 h-4" />
                        <span>Unduh PDF Lengkap</span>
                      </button>

                      {selectedModul.pptOutline?.notebookLmPrompt && (
                        <button
                          onClick={handleCopyNotebookLm}
                          className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Salin Prompt untuk notebookLM Google AI"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          <span>NotebookLM Prompt</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sub-Tab Navigation for Modul Details */}
                  <div className="flex items-center gap-1.5 p-1.5 bg-gray-100 rounded-xl overflow-x-auto text-xs font-bold">
                    <button
                      onClick={() => setModulSubTab('rpl')}
                      className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        modulSubTab === 'rpl'
                          ? 'bg-[#00685f] text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>1. RPL Utama</span>
                    </button>

                    <button
                      onClick={() => setModulSubTab('materi')}
                      className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        modulSubTab === 'materi'
                          ? 'bg-[#00685f] text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>2. Materi Layanan</span>
                    </button>

                    <button
                      onClick={() => setModulSubTab('lkpd')}
                      className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        modulSubTab === 'lkpd'
                          ? 'bg-[#00685f] text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>3. LKPD Siswa</span>
                    </button>

                    <button
                      onClick={() => setModulSubTab('ppt')}
                      className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        modulSubTab === 'ppt'
                          ? 'bg-[#00685f] text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>4. PPT & NotebookLM</span>
                    </button>
                  </div>

                  {/* SUB-TAB 1: RPL UTAMA */}
                  {modulSubTab === 'rpl' && (
                    <div className="space-y-4 text-xs animate-in fade-in duration-200">
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Alokasi Waktu:</span>
                          <p className="font-bold text-gray-800">{selectedModul.alokasiWaktu}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Metode Layanan:</span>
                          <p className="font-bold text-gray-800">{selectedModul.metode}</p>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Profil Pelajar Pancasila:</span>
                          <p className="font-bold text-[#00685f]">
                            {selectedModul.profilPancasila?.join(', ')}
                          </p>
                        </div>
                      </div>

                      {/* Tujuan Layanan */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-[#0b1c30] uppercase tracking-wider text-[11px]">
                          🎯 Capaian & Tujuan Layanan:
                        </h4>
                        <div className="p-3 rounded-xl bg-teal-50/50 border border-teal-100 space-y-1.5">
                          <p className="text-gray-800">
                            <strong className="text-[#00685f]">1. Pengenalan:</strong> {selectedModul.tujuanPengenalan}
                          </p>
                          <p className="text-gray-800">
                            <strong className="text-[#00685f]">2. Akomodasi:</strong> {selectedModul.tujuanAkomodasi}
                          </p>
                          <p className="text-gray-800">
                            <strong className="text-[#00685f]">3. Tindakan:</strong> {selectedModul.tujuanTindakan}
                          </p>
                        </div>
                      </div>

                      {/* Langkah Kegiatan */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-[#0b1c30] uppercase tracking-wider text-[11px]">
                          🚀 Langkah-Langkah Kegiatan Layanan:
                        </h4>
                        <div className="space-y-2">
                          <div className="p-3 bg-gray-50 rounded-xl">
                            <span className="font-bold text-[#00685f] block mb-1">A. Pendahuluan</span>
                            <ul className="list-disc pl-4 space-y-1 text-gray-700">
                              {selectedModul.langkahPendahuluan.map((l, i) => (
                                <li key={i}>{l}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="p-3 bg-gray-50 rounded-xl">
                            <span className="font-bold text-[#00685f] block mb-1">B. Tahap Inti Experiential Learning</span>
                            <ul className="list-disc pl-4 space-y-1 text-gray-700">
                              {selectedModul.langkahInti.map((l, i) => (
                                <li key={i}>{l}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="p-3 bg-gray-50 rounded-xl">
                            <span className="font-bold text-[#00685f] block mb-1">C. Penutup</span>
                            <ul className="list-disc pl-4 space-y-1 text-gray-700">
                              {selectedModul.langkahPenutup.map((l, i) => (
                                <li key={i}>{l}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Evaluasi */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-[#0b1c30] uppercase tracking-wider text-[11px]">
                          📝 Evaluasi & Tindak Lanjut:
                        </h4>
                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                          <div>
                            <span className="font-bold text-gray-800 block">Evaluasi Proses:</span>
                            <ul className="list-disc pl-4 text-gray-600">
                              {selectedModul.evaluasiProses.map((ep, i) => (
                                <li key={i}>{ep}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="font-bold text-gray-800 block">Evaluasi Hasil:</span>
                            <ul className="list-disc pl-4 text-gray-600">
                              {selectedModul.evaluasiHasil.map((eh, i) => (
                                <li key={i}>{eh}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 2: MATERI LAYANAN */}
                  {modulSubTab === 'materi' && (
                    <div className="space-y-4 text-xs animate-in fade-in duration-200">
                      <div className="flex justify-between items-center bg-teal-50/60 p-3 rounded-xl border border-teal-100">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-[#00685f]" />
                          <span className="font-bold text-[#00685f]">Materi Layanan Bimbingan (Bahan Bacaan Siswa & Guru)</span>
                        </div>
                        <button
                          onClick={handleCopyMateriLkpd}
                          className="px-2.5 py-1 bg-[#00685f] text-white rounded-lg font-bold text-[11px] hover:bg-[#005049] transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Salin Teks Materi</span>
                        </button>
                      </div>

                      {selectedModul.materiBimbingan ? (
                        <>
                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                            <h4 className="font-extrabold text-[#0b1c30] text-xs flex items-center gap-1.5">
                              <span>📖 Ringkasan & Konsep Dasar</span>
                            </h4>
                            <p className="text-gray-700 leading-relaxed font-medium">
                              {selectedModul.materiBimbingan.ringkasanMateri}
                            </p>
                          </div>

                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                            <h4 className="font-extrabold text-[#0b1c30] text-xs">
                              📌 Poin-Poin Penting Pembahasan
                            </h4>
                            <div className="grid grid-cols-1 gap-2">
                              {selectedModul.materiBimbingan.poinMateri.map((pm, idx) => (
                                <div key={idx} className="p-2.5 bg-white rounded-lg border border-gray-200 flex items-start gap-2">
                                  <span className="w-5 h-5 rounded-full bg-teal-100 text-[#00685f] font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <span className="text-gray-800 font-medium">{pm}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/60 space-y-2">
                            <h4 className="font-extrabold text-amber-900 text-xs flex items-center gap-1.5">
                              <Lightbulb className="w-4 h-4 text-amber-600" />
                              <span>🔍 Studi Kasus Imersif</span>
                            </h4>
                            <p className="text-amber-900/90 leading-relaxed font-medium italic bg-white/70 p-3 rounded-lg border border-amber-200/50">
                              "{selectedModul.materiBimbingan.studiKasus}"
                            </p>
                          </div>

                          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/60 space-y-2">
                            <h4 className="font-extrabold text-emerald-900 text-xs flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>💡 Tips Praktis & Strategi Aksi</span>
                            </h4>
                            <ul className="space-y-1.5">
                              {selectedModul.materiBimbingan.tipsPraktis.map((tp, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-emerald-900 font-medium">
                                  <span className="text-emerald-600 font-bold">✔</span>
                                  <span>{tp}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </>
                      ) : (
                        <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-xl">
                          Materi bimbingan belum tersedia untuk modul ini.
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-TAB 3: LKPD SISWA */}
                  {modulSubTab === 'lkpd' && (
                    <div className="space-y-4 text-xs animate-in fade-in duration-200">
                      <div className="flex justify-between items-center bg-teal-50/60 p-3 rounded-xl border border-teal-100">
                        <div className="flex items-center gap-2">
                          <Edit3 className="w-4 h-4 text-[#00685f]" />
                          <span className="font-bold text-[#00685f]">Lembar Kerja Peserta Didik (LKPD) Siswa</span>
                        </div>
                        <button
                          onClick={handleCopyMateriLkpd}
                          className="px-2.5 py-1 bg-[#00685f] text-white rounded-lg font-bold text-[11px] hover:bg-[#005049] transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Salin LKPD</span>
                        </button>
                      </div>

                      {selectedModul.lkpd ? (
                        <>
                          <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-3 shadow-2xs">
                            <div className="border-b border-gray-100 pb-2">
                              <h4 className="font-black text-[#0b1c30] text-sm text-center">
                                {selectedModul.lkpd.judulLkpd}
                              </h4>
                              <p className="text-[11px] text-gray-500 text-center font-medium mt-0.5">
                                Petunjuk: {selectedModul.lkpd.instruksi}
                              </p>
                            </div>

                            <div className="space-y-3 pt-2">
                              <h5 className="font-bold text-[#00685f] text-xs uppercase tracking-wider">
                                ✍️ Pertanyaan Refleksi Mandiri:
                              </h5>
                              <div className="space-y-2.5">
                                {selectedModul.lkpd.pertanyaanRefleksi.map((pr, idx) => (
                                  <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2">
                                    <p className="font-bold text-gray-800">
                                      {idx + 1}. {pr}
                                    </p>
                                    <div className="p-2 bg-white rounded-lg border border-dashed border-gray-300 text-gray-400 italic text-[11px]">
                                      [ Kolom Jawaban Refleksi Siswa ]
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100 space-y-1">
                              <h5 className="font-bold text-[#00685f] text-xs">
                                🎯 Lembar Komitmen & Aksi Nyata Siswa:
                              </h5>
                              <p className="text-gray-700 font-medium">
                                {selectedModul.lkpd.lembarAksiNyata}
                              </p>
                            </div>

                            <div className="p-3 bg-gray-100 rounded-xl space-y-1">
                              <h5 className="font-bold text-gray-700 text-[11px] uppercase">
                                📊 Rubrik Penilaian Guru BK:
                              </h5>
                              <p className="text-gray-600 font-medium text-[11px]">
                                {selectedModul.lkpd.rubrikPenilaian}
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-xl">
                          LKPD belum tersedia untuk modul ini.
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-TAB 4: PPT & NOTEBOOKLM */}
                  {modulSubTab === 'ppt' && (
                    <div className="space-y-4 text-xs animate-in fade-in duration-200">
                      {/* NotebookLM Box */}
                      {selectedModul.pptOutline?.notebookLmPrompt && (
                        <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl shadow-md space-y-3">
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                              <span className="font-black text-sm tracking-wide text-amber-200">
                                Integrasi NotebookLM (Google AI Audio Podcast)
                              </span>
                            </div>
                            <button
                              onClick={handleCopyNotebookLm}
                              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-purple-950 font-black rounded-xl transition-all shadow-sm flex items-center gap-1.5 text-xs cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin Prompt NotebookLM</span>
                            </button>
                          </div>

                          <p className="text-[11px] text-purple-100 leading-relaxed font-medium">
                            Salin prompt materi di bawah ini, buka <a href="https://notebooklm.google.com" target="_blank" rel="noreferrer" className="underline text-amber-200 hover:text-white font-bold inline-flex items-center gap-0.5">notebooklm.google.com <ExternalLink className="w-3 h-3" /></a>, paste sebagai sumber teks baru, lalu klik "Generate Audio Overview" untuk menghasilkan rekaman diskusi/podcast interaktif antar AI!
                          </p>

                          <div className="p-3 bg-black/40 rounded-xl border border-purple-400/30 font-mono text-[11px] text-purple-200 max-h-28 overflow-y-auto leading-relaxed">
                            {selectedModul.pptOutline.notebookLmPrompt}
                          </div>
                        </div>
                      )}

                      {/* PPT Slide Outline */}
                      {selectedModul.pptOutline ? (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <h4 className="font-bold text-[#0b1c30] text-xs uppercase tracking-wider flex items-center gap-1.5">
                              <Layers className="w-4 h-4 text-[#00685f]" />
                              <span>Outline Slide Presentasi ({selectedModul.pptOutline.slides.length} Slide)</span>
                            </h4>
                            <button
                              onClick={handleCopyPptOutline}
                              className="px-2.5 py-1 bg-[#00685f] text-white rounded-lg font-bold text-[11px] hover:bg-[#005049] transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Salin Outline PPT</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedModul.pptOutline.slides.map((sl) => (
                              <div key={sl.slideNo} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="px-2 py-0.5 bg-[#00685f] text-white font-black text-[10px] rounded">
                                      SLIDE {sl.slideNo}
                                    </span>
                                    <h5 className="font-bold text-[#0b1c30] text-xs line-clamp-1">
                                      {sl.title}
                                    </h5>
                                  </div>
                                  <ul className="list-disc pl-4 space-y-1 text-gray-700 text-[11px]">
                                    {sl.bulletPoints.map((bp, i) => (
                                      <li key={i}>{bp}</li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="p-2 bg-amber-50 rounded-lg border border-amber-200/60 text-[10px] text-amber-900 font-medium italic mt-2">
                                  <strong>Catatan Guru:</strong> {sl.speakerNotes}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-xl">
                          Outline slide presentasi belum tersedia untuk modul ini.
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-12 text-center text-gray-400">Pilih modul dari daftar di sebelah kiri.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AI Script Generator Konseling Empatik */}
      {activeTab === 'ai-script' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-[#bcc9c6]/30 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-[#00685f] font-black text-sm uppercase tracking-wider">
              <Bot className="w-5 h-5 text-amber-500" />
              <span>Generator Skrip Konseling AI</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Dapatkan draf panduan komunikasi empatik & konseling BK berbasis kecerdasan buatan Gemini untuk menghadapi berbagai kasus siswa.
            </p>

            <div className="space-y-3 text-xs font-semibold">
              <div>
                <label className="text-gray-700 block mb-1 font-bold">Jenis Layanan BK:</label>
                <select
                  value={scriptServiceType}
                  onChange={(e) => setScriptServiceType(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-xl font-bold bg-gray-50"
                >
                  <option value="Konseling Individu">Konseling Individu</option>
                  <option value="Konseling Kelompok">Konseling Kelompok</option>
                  <option value="Bimbingan Klasikal">Bimbingan Klasikal</option>
                  <option value="Home Visit (Kunjungan Rumah)">Home Visit (Kunjungan Rumah)</option>
                  <option value="Konferensi Kasus">Konferensi Kasus dengan Ortu</option>
                </select>
              </div>

              <div>
                <label className="text-gray-700 block mb-1 font-bold">Nama Siswa / Subjek:</label>
                <input
                  type="text"
                  value={scriptStudentName}
                  onChange={(e) => setScriptStudentName(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-xl font-bold bg-gray-50"
                />
              </div>

              <div>
                <label className="text-gray-700 block mb-1 font-bold">Deskripsi Permasalahan Siswa:</label>
                <textarea
                  rows={4}
                  value={scriptProblem}
                  onChange={(e) => setScriptProblem(e.target.value)}
                  placeholder="Contoh: Sering terlambat, menyendiri di kelas, atau kecanduan game online..."
                  className="w-full p-2.5 border border-gray-200 rounded-xl font-medium bg-gray-50 focus:ring-2 focus:ring-[#00685f] outline-none"
                />
              </div>

              <button
                onClick={handleGenerateScriptAi}
                disabled={isGeneratingScript}
                className="w-full py-3 bg-gradient-to-r from-[#00685f] to-teal-700 hover:from-[#005049] hover:to-teal-800 text-white rounded-xl font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingScript ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Merancang Skrip Empatik...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Hasilkan Skrip Konseling Empatik</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-[#bcc9c6]/30 shadow-xs space-y-4">
            {generatedScript ? (
              <div className="space-y-4 animate-in fade-in duration-300 text-xs">
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-[#00685f] uppercase tracking-wider block">
                      Panduan Skrip Dialog Konselor
                    </span>
                    <h3 className="text-base font-black text-[#0b1c30] mt-0.5">
                      {scriptServiceType} — {scriptStudentName}
                    </h3>
                  </div>
                  <button
                    onClick={() => setGeneratedScript(null)}
                    className="text-gray-400 hover:text-gray-600 font-bold text-xs"
                  >
                    Reset
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <span className="font-extrabold text-[#00685f] block mb-1">1. Tahap Pembukaan & Building Rapport (Penciptaan Suasana)</span>
                    <p className="text-gray-800 font-medium italic">"{generatedScript.opening}"</p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <span className="font-extrabold text-[#00685f] block mb-1">2. Kalimat Empati & Refleksi Perasaan</span>
                    <ul className="list-disc pl-4 space-y-1 text-gray-800 font-medium italic">
                      {generatedScript.empathyPhrases.map((phrase, idx) => (
                        <li key={idx}>"{phrase}"</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <span className="font-extrabold text-[#00685f] block mb-1">3. Eksplorasi Masalah Secara Terbuka</span>
                    <p className="text-gray-800 font-medium italic">"{generatedScript.coreExploration}"</p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <span className="font-extrabold text-[#00685f] block mb-1">4. Pertanyaan Coaching Solusi (Solution-Focused)</span>
                    <p className="text-gray-800 font-medium italic">"{generatedScript.solutionCoaching}"</p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <span className="font-extrabold text-[#00685f] block mb-1">5. Penguatan Komitmen & Penutup</span>
                    <p className="text-gray-800 font-medium italic">"{generatedScript.closingCommitment}"</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-3xl space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#00685f] flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-[#0b1c30]">
                  Belum Ada Skrip Konseling Di-generate
                </h4>
                <p className="text-xs text-gray-400 max-w-sm">
                  Isikan nama siswa dan ringkasan masalah di panel sebelah kiri, lalu klik <strong>Hasilkan Skrip Konseling Empatik</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal AI Generator RPL / Modul Ajar BK */}
      {showModulModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full space-y-5 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-[#00685f]">
                <Bot className="w-6 h-6 text-amber-500" />
                <h3 className="text-lg font-black text-[#0b1c30]">
                  AI Modul Ajar / RPL BK Generator
                </h3>
              </div>
              <button
                onClick={() => setShowModulModal(false)}
                className="text-gray-400 hover:text-gray-600 font-black text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Topik Layanan BK yang Ingin Dibuatkan:
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="Contoh: Mengelola Stres Menjelang Ujian / Cegah Cyberbullying..."
                  className="w-full p-3 border border-gray-200 rounded-2xl font-semibold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] text-gray-400 font-bold">Ide Cepat:</span>
                  {[
                    'Manajemen Gadget & Game Online',
                    'Resiliensi Belajar & Anti Prokrastinasi',
                    'Stop Bullying & Pertemanan Sehat',
                    'Eksplorasi Karir Abad 21',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAiTopic(preset)}
                      className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 text-[#00685f] rounded-lg text-[10px] font-bold"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Bidang Layanan:</label>
                  <select
                    value={aiBidang}
                    onChange={(e) => setAiBidang(e.target.value as any)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl font-bold"
                  >
                    <option value="Pribadi">Pribadi</option>
                    <option value="Sosial">Sosial</option>
                    <option value="Belajar">Belajar</option>
                    <option value="Karir">Karir</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Fase Target:</label>
                  <select
                    value={aiFase}
                    onChange={(e) => setAiFase(e.target.value as any)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl font-bold"
                  >
                    <option value="Fase D (SMP)">Fase D (SMP/MTs)</option>
                    <option value="Fase E (SMA 10)">Fase E (SMA/SMK 10)</option>
                    <option value="Fase F (SMA 11-12)">Fase F (SMA/SMK 11-12)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Kode Aspek SKKPD:</label>
                  <select
                    value={aiAspek}
                    onChange={(e) => setAiAspek(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl font-bold"
                  >
                    <option value="SKKPD-1">SKKPD-1 Landasan Perilaku Etis</option>
                    <option value="SKKPD-2">SKKPD-2 Perilaku Keagamaan</option>
                    <option value="SKKPD-3">SKKPD-3 Kematangan Emosi</option>
                    <option value="SKKPD-4">SKKPD-4 Kematangan Intelektual</option>
                    <option value="SKKPD-5">SKKPD-5 Kesadaran Tanggung Jawab Sosial</option>
                    <option value="SKKPD-7">SKKPD-7 Pengembangan Diri</option>
                    <option value="SKKPD-9">SKKPD-9 Kematangan Karir</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Alokasi Waktu:</label>
                  <input
                    type="text"
                    value={aiAlokasi}
                    onChange={(e) => setAiAlokasi(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowModulModal(false)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                onClick={handleGenerateRplAi}
                disabled={isGeneratingRpl}
                className="px-5 py-2.5 bg-gradient-to-r from-[#00685f] to-teal-700 hover:from-[#005049] hover:to-teal-800 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingRpl ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>AI Merancang RPL...</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4 text-amber-300" />
                    <span>Hasilkan RPL dengan Gemini AI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Sebar Instrumen AKPD Online */}
      {showSpreadModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-[#00685f]">
                <Share2 className="w-5 h-5 text-[#00685f]" />
                <h3 className="text-base font-black text-[#0b1c30]">
                  Sebar Instrumen AKPD Digital (Kelas {selectedClass})
                </h3>
              </div>
              <button
                onClick={() => setShowSpreadModal(false)}
                className="text-gray-400 hover:text-gray-600 font-black text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-gray-600 font-medium">
                Bagikan tautan ini kepada peserta didik di Kelas <strong className="text-[#00685f]">{selectedClass}</strong> untuk mengisi angket AKPD secara mandiri dari smartphone / laptop masing-masing:
              </p>

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-gray-700 truncate select-all">
                  https://bk-asesmen.belajar.id/akpd/kelas-{selectedClass.toLowerCase()}
                </span>
                <button
                  onClick={() => {
                    handleSpreadClass(selectedClass);
                    alert('Tautan form AKPD Kelas ' + selectedClass + ' berhasil disalin!');
                  }}
                  className="px-3 py-1.5 bg-[#00685f] text-white font-bold rounded-xl text-[11px] shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Link</span>
                </button>
              </div>

              <div className="bg-teal-50 border border-teal-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-[#00685f] font-bold text-xs">
                  <QrCode className="w-4 h-4" />
                  <span>Pratinjau & Akses Form Langsung</span>
                </div>
                <p className="text-[11px] text-gray-600">
                  Anda dapat membuka tampilan angket siswa secara langsung untuk menguji pengisian atau mengisi bersama siswa di kelas.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      handleSpreadClass(selectedClass);
                      setShowSpreadModal(false);
                      setShowStudentFillModal(true);
                    }}
                    className="w-full py-2 bg-[#00685f] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Buka Tampilan Form Siswa</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-gray-500 text-[11px]">
                <span>Ingin langsung mencoba visualisasi data?</span>
                <button
                  onClick={() => {
                    setShowSpreadModal(false);
                    handleSimulateClassSubmissions(selectedClass);
                  }}
                  className="text-amber-600 font-extrabold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Zap className="w-3 h-3" />
                  <span>Simulasi 30 Siswa Instant</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  handleSpreadClass(selectedClass);
                  setShowSpreadModal(false);
                }}
                className="px-5 py-2 bg-[#00685f] text-white font-extrabold text-xs rounded-xl cursor-pointer"
              >
                Selesai / Simpan Status Disebar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Manual Input Jawaban Siswa (Kertas / Physical Entry) */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl border border-gray-200 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-[#00685f]">
                <Plus className="w-5 h-5 text-[#00685f]" />
                <h3 className="text-base font-black text-[#0b1c30]">
                  Input Lembar Jawaban Siswa (Kelas {selectedClass})
                </h3>
              </div>
              <button
                onClick={() => setShowEntryModal(false)}
                className="text-gray-400 hover:text-gray-600 font-black text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Nama Lengkap Peserta Didik:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={entryStudentName}
                    onChange={(e) => setEntryStudentName(e.target.value)}
                    placeholder="Contoh: Ahmad Rizky / Fitriani..."
                    className="w-full p-2.5 border border-gray-200 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  />
                  <select
                    onChange={(e) => {
                      if (e.target.value) setEntryStudentName(e.target.value);
                    }}
                    className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-600"
                  >
                    <option value="">-- Pilih Siswa Kelas --</option>
                    {students.filter(s => s.class === selectedClass).map((st) => (
                      <option key={st.id} value={st.name}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-extrabold text-[#00685f] block mb-2">
                  Centang Butir Masalah yang Dipilih / Diinginkan Siswa:
                </label>

                <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
                  {(['Pribadi', 'Sosial', 'Belajar', 'Karir'] as const).map((bidang) => {
                    const questions = SAMPLE_AKPD_QUESTIONS.filter((q) => q.bidang === bidang);
                    return (
                      <div key={bidang} className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/80 space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-[#00685f] block">
                          Bidang {bidang}
                        </span>
                        <div className="space-y-2">
                          {questions.map((q) => (
                            <label
                              key={q.id}
                              className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-gray-200/60 hover:bg-teal-50/40 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={!!entrySelectedItems[q.id]}
                                onChange={(e) =>
                                  setEntrySelectedItems((prev) => ({
                                    ...prev,
                                    [q.id]: e.target.checked,
                                  }))
                                }
                                className="mt-0.5 rounded text-[#00685f] focus:ring-[#00685f]"
                              />
                              <div className="text-[11px]">
                                <span className="font-extrabold text-[#00685f] mr-1.5">[{q.code}]</span>
                                <span className="font-bold text-gray-800">{q.question}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowEntryModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (!entryStudentName.trim()) {
                    alert('Mohon masukkan nama peserta didik!');
                    return;
                  }
                  handleSaveStudentEntry(entryStudentName, entrySelectedItems);
                  setShowEntryModal(false);
                }}
                className="px-5 py-2 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold rounded-xl text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan Jawaban Siswa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Detail Responden Kelas */}
      {showRespondenModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-[#00685f]">
                <Users className="w-5 h-5 text-[#00685f]" />
                <h3 className="text-base font-black text-[#0b1c30]">
                  Daftar Responden AKPD (Kelas {selectedClass} - {totalResponding} Siswa)
                </h3>
              </div>
              <button
                onClick={() => setShowRespondenModal(false)}
                className="text-gray-400 hover:text-gray-600 font-black text-sm"
              >
                ✕
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 font-extrabold text-[11px] sticky top-0">
                  <tr>
                    <th className="p-3 rounded-l-xl">No</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">Waktu Pengisian</th>
                    <th className="p-3 text-center">Masalah Centang</th>
                    <th className="p-3 text-right rounded-r-xl">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentSubmissions.map((sub, idx) => {
                    const checkedCount = Object.values(sub.selectedItems || {}).filter(Boolean).length;
                    return (
                      <tr key={sub.studentId || idx} className="hover:bg-teal-50/30">
                        <td className="p-3 font-bold text-gray-500">{idx + 1}</td>
                        <td className="p-3 font-extrabold text-[#0b1c30]">{sub.studentName}</td>
                        <td className="p-3 text-gray-500 text-[11px]">
                          {new Date(sub.submittedAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3 text-center font-bold text-[#00685f]">
                          <span className="px-2 py-0.5 bg-teal-50 rounded-lg border border-teal-200">
                            {checkedCount} Item
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteSubmission(selectedClass, sub.studentId)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                            title="Hapus Respon Ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-100 text-xs">
              <button
                onClick={() => handleResetClass(selectedClass)}
                className="text-red-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset / Hapus Semua Respon Kelas {selectedClass}</span>
              </button>

              <button
                onClick={() => setShowRespondenModal(false)}
                className="px-5 py-2 bg-[#00685f] text-white font-extrabold rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Interactive Student Form Fill Simulation */}
      {showStudentFillModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl border border-gray-200 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-[#00685f]">
                <Send className="w-5 h-5 text-[#00685f]" />
                <div>
                  <h3 className="text-base font-black text-[#0b1c30]">
                    Form Angket Kebutuhan Peserta Didik (AKPD)
                  </h3>
                  <p className="text-[11px] text-gray-500 font-semibold">
                    Tampilan Form Digital Siswa - Kelas {selectedClass}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowStudentFillModal(false)}
                className="text-gray-400 hover:text-gray-600 font-black text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-teal-50/60 p-4 rounded-2xl border border-teal-200">
                <p className="text-gray-700 leading-relaxed font-medium">
                  Petunjuk Pengisian: Bacalah setiap pernyataan di bawah ini secara teliti. Centanglah pernyataan yang <strong>sesuai dengan kondisi, masalah, atau kebutuhan yang sedang kamu alami saat ini</strong>.
                </p>
              </div>

              <div>
                <label className="font-bold text-gray-800 block mb-1">Nama Siswa Pengisi:</label>
                <input
                  type="text"
                  value={entryStudentName}
                  onChange={(e) => setEntryStudentName(e.target.value)}
                  placeholder="Masukkan nama lengkap siswa..."
                  className="w-full p-2.5 border border-gray-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                />
              </div>

              <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
                {SAMPLE_AKPD_QUESTIONS.map((q, idx) => (
                  <label
                    key={q.id}
                    className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                      entrySelectedItems[q.id]
                        ? 'bg-teal-50/80 border-[#00685f] shadow-xs'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!entrySelectedItems[q.id]}
                      onChange={(e) =>
                        setEntrySelectedItems((prev) => ({
                          ...prev,
                          [q.id]: e.target.checked,
                        }))
                      }
                      className="mt-1 w-4 h-4 text-[#00685f] rounded focus:ring-[#00685f]"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black px-2 py-0.2 bg-gray-100 text-gray-700 rounded">
                          {q.code}
                        </span>
                        <span className="text-[10px] font-extrabold text-[#00685f]">
                          Bidang {q.bidang}
                        </span>
                      </div>
                      <p className="font-bold text-gray-800 text-xs mt-1">{q.question}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowStudentFillModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>

              <button
                onClick={() => {
                  if (!entryStudentName.trim()) {
                    alert('Mohon masukkan nama siswa terlebih dahulu!');
                    return;
                  }
                  handleSaveStudentEntry(entryStudentName, entrySelectedItems);
                  setShowStudentFillModal(false);
                  setEntryStudentName('');
                  setEntrySelectedItems({});
                }}
                className="px-6 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold rounded-xl text-xs shadow-md cursor-pointer flex items-center gap-2"
              >
                <Send className="w-4 h-4 text-amber-300" />
                <span>Kirim Jawaban Angket Siswa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
