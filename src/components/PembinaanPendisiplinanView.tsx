import React, { useState, useEffect, useMemo } from 'react';
import {
  Student,
  Counselor,
  ViolationRecord,
  ClassAttendanceRecord,
  SuratPerjanjianRecord,
  KontrakPerilakuRecord,
  JurnalPembinaanDisiplinRecord,
  KomitmenRtlRecord
} from '../types';
import {
  Gavel,
  FileText,
  Search,
  Plus,
  Trash2,
  Save,
  Download,
  CheckCircle,
  AlertCircle,
  User,
  Users,
  Calendar,
  X,
  ShieldCheck,
  Award,
  RefreshCw,
  Sparkles,
  Filter,
  Check,
  BookOpen,
  Target,
  Bot,
  MapPin,
  Clock,
  Briefcase,
  Phone,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Settings
} from 'lucide-react';
import {
  downloadAgreementPDF,
  downloadBehaviorContractPDF,
  downloadJurnalPembinaanPDF,
  downloadKomitmenRtlPDF,
  formatIndonesianDate
} from '../utils/pdfGenerator';
import { fetchDisciplineFormAi, DisciplineFormType } from '../utils/geminiDisciplineAi';
import { autoPushToJournal } from '../utils/journalAutoLink';
import { registerDeletedId } from '../utils/deletionTracker';
import { saveBulkToFirestore, saveSchoolData, loadSchoolData, deleteFromFirestore, saveToFirestore } from '../utils/firestoreSync';
import { DisciplineConfigModal } from './DisciplineConfigModal';
import { getDisciplineConfig, DisciplineConfig } from '../utils/disciplineConfig';
import { showToast } from '../utils/toast';
import PageHeaderBanner from './PageHeaderBanner';

interface PembinaanPendisiplinanViewProps {
  students: Student[];
  violations?: ViolationRecord[];
  activeCounselor: Counselor;
  onNavigateToTab?: (tab: string, query?: string) => void;
}

export default function PembinaanPendisiplinanView({
  students,
  violations = [],
  activeCounselor,
  onNavigateToTab
}: PembinaanPendisiplinanViewProps) {
  // 4 Core Tabs (Pemanggilan Ortu removed as it is already present in Layanan BK)
  const [activeTab, setActiveTab] = useState<'perjanjian' | 'kontrak' | 'jurnal-pembinaan' | 'komitmen-rtl'>('perjanjian');

  // Discipline Configuration & UI State
  const [disciplineConfig, setDisciplineConfig] = useState<DisciplineConfig>(() => getDisciplineConfig());
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [isRecommendationsExpanded, setIsRecommendationsExpanded] = useState<boolean>(false);

  // AI Generation State
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [aiActiveSource, setAiActiveSource] = useState<string | null>(null);

  // Persistence list state for Surat Perjanjian
  const [perjanjianList, setPerjanjianList] = useState<SuratPerjanjianRecord[]>(() => {
    return loadSchoolData('bk_surat_perjanjian_list', []);
  });

  // Persistence list state for Kontrak Perilaku
  const [kontrakList, setKontrakList] = useState<KontrakPerilakuRecord[]>(() => {
    return loadSchoolData('bk_kontrak_perilaku_list', []);
  });

  // Persistence list state for Jurnal Pembinaan Disiplin BK
  const [jurnalList, setJurnalList] = useState<JurnalPembinaanDisiplinRecord[]>(() => {
    return loadSchoolData('bk_jurnal_pembinaan_disiplin_list', []);
  });

  // Persistence list state for Lembar Komitmen & RTL
  const [komitmenList, setKomitmenList] = useState<KomitmenRtlRecord[]>(() => {
    return loadSchoolData('bk_komitmen_rtl_list', []);
  });

  // LocalStorage Realtime Persist
  useEffect(() => {
    saveSchoolData('bk_surat_perjanjian_list', perjanjianList);
  }, [perjanjianList]);

  useEffect(() => {
    saveSchoolData('bk_kontrak_perilaku_list', kontrakList);
  }, [kontrakList]);

  useEffect(() => {
    saveSchoolData('bk_jurnal_pembinaan_disiplin_list', jurnalList);
  }, [jurnalList]);

  useEffect(() => {
    saveSchoolData('bk_komitmen_rtl_list', komitmenList);
  }, [komitmenList]);

  // Realtime subscriber for remote changes
  useEffect(() => {
    const handleRealtimeUpdate = (e: any) => {
      const key = e.detail?.key;
      const data = e.detail?.data;
      if (key === 'bk_surat_perjanjian_list') {
        if (Array.isArray(data)) setPerjanjianList(data);
        else {
          setPerjanjianList(loadSchoolData('bk_surat_perjanjian_list', []));
        }
      } else if (key === 'bk_kontrak_perilaku_list') {
        if (Array.isArray(data)) setKontrakList(data);
        else {
          setKontrakList(loadSchoolData('bk_kontrak_perilaku_list', []));
        }
      } else if (key === 'bk_jurnal_pembinaan_disiplin_list') {
        if (Array.isArray(data)) setJurnalList(data);
        else {
          setJurnalList(loadSchoolData('bk_jurnal_pembinaan_disiplin_list', []));
        }
      } else if (key === 'bk_komitmen_rtl_list') {
        if (Array.isArray(data)) setKomitmenList(data);
        else {
          setKomitmenList(loadSchoolData('bk_komitmen_rtl_list', []));
        }
      }
    };

    window.addEventListener('bk_realtime_sync', handleRealtimeUpdate);
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('bk_')) {
        handleRealtimeUpdate({ detail: { key: e.key } });
      }
    });

    return () => {
      window.removeEventListener('bk_realtime_sync', handleRealtimeUpdate);
    };
  }, []);

  // --- AUTOMATED SINKRONISASI DATA ABSENSI ALPA & RESTITUSI ---
  const studentDisciplineAnalytics = useMemo(() => {
    let attRecords: ClassAttendanceRecord[] = [];
    try {
      const saved = localStorage.getItem('bk_attendance_history');
      if (saved) attRecords = JSON.parse(saved);
    } catch (e) {}

    let parentNamesMap: Record<string, string> = {};
    try {
      const savedSummons = localStorage.getItem('bk_parent_summons');
      if (savedSummons) {
        const list = JSON.parse(savedSummons);
        list.forEach((ps: any) => {
          if (ps.studentId && ps.parentName) parentNamesMap[ps.studentId] = ps.parentName;
        });
      }
      const savedHomeVisits = localStorage.getItem('bk_home_visits');
      if (savedHomeVisits) {
        const list = JSON.parse(savedHomeVisits);
        list.forEach((hv: any) => {
          if (hv.studentId && hv.parentNameMet) parentNamesMap[hv.studentId] = hv.parentNameMet;
        });
      }
    } catch (e) {}

    return students.map((st) => {
      const alpaEntries: { date: string; notes?: string }[] = [];
      attRecords.forEach((att) => {
        if (att.records) {
          const match = att.records.find(
            (r) =>
              r.studentId === st.id ||
              (r.studentName.toLowerCase() === st.name.toLowerCase() && att.class === st.class) ||
              (r.nis && r.nis === st.nis)
          );
          if (match && match.status === 'A') {
            alpaEntries.push({ date: att.date, notes: match.notes });
          }
        }
      });

      const stViolations = violations.filter(
        (v) =>
          v.studentId === st.id ||
          (v.studentName.toLowerCase() === st.name.toLowerCase() && v.studentClass === st.class)
      );

      const alpaCount = alpaEntries.length;
      const violationCount = stViolations.length;
      const points = st.violationPoints || stViolations.reduce((acc, v) => acc + (v.pointsAdded || 0), 0);
      const knownParentName = parentNamesMap[st.id] || '';

      const isAlpaEligible = alpaCount >= (disciplineConfig.minAlpaCount || 1);
      const isViolationEligible = violationCount > 0 || points >= (disciplineConfig.minViolationPoints || 1);
      const isRecommendedForPembinaan = isAlpaEligible || isViolationEligible;

      return {
        student: st,
        alpaCount,
        alpaEntries,
        stViolations,
        violationCount,
        points,
        knownParentName,
        isAlpaEligible,
        isViolationEligible,
        isRecommendedForPembinaan
      };
    });
  }, [students, violations, disciplineConfig]);

  // Recommended students list
  const recommendedStudentsList = useMemo(() => {
    return studentDisciplineAnalytics
      .filter((item) => item.isRecommendedForPembinaan)
      .sort((a, b) => b.alpaCount * 2 + b.points - (a.alpaCount * 2 + a.points));
  }, [studentDisciplineAnalytics]);

  // Unique classes for filtering
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.class) set.add(s.class);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [students]);

  // Filter & Search states for Student Selector
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [studentCategoryFilter, setStudentCategoryFilter] = useState<'all' | 'recommended' | 'alpa' | 'restitusi'>('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // FIX: Allow searching ALL students across the entire school!
  const filteredStudentOptions = useMemo(() => {
    return studentDisciplineAnalytics.filter((item) => {
      // Category Filter
      if (studentCategoryFilter === 'recommended' && !item.isRecommendedForPembinaan) return false;
      if (studentCategoryFilter === 'alpa' && !item.isAlpaEligible) return false;
      if (studentCategoryFilter === 'restitusi' && !item.isViolationEligible) return false;

      // Class Filter
      if (selectedClassFilter !== 'ALL' && item.student.class !== selectedClassFilter) return false;

      // Text Search Filter (Name, Class, NIS/NISN)
      if (!studentSearchQuery.trim()) return true;
      const q = studentSearchQuery.toLowerCase().trim();
      return (
        String(item.student?.name || '').toLowerCase().includes(q) ||
        String(item.student?.class || '').toLowerCase().includes(q) ||
        String(item.student?.nis ?? '').toLowerCase().includes(q) ||
        String(item.student?.nisn ?? '').toLowerCase().includes(q)
      );
    });
  }, [studentDisciplineAnalytics, studentCategoryFilter, selectedClassFilter, studentSearchQuery]);

  // --- FORM SURAT PERJANJIAN STATE ---
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    recommendedStudentsList[0]?.student.id || students[0]?.id || ''
  );
  const [letterNumber, setLetterNumber] = useState<string>(`SP-${new Date().getFullYear()}/${String(perjanjianList.length + 1).padStart(3, '0')}`);
  const [spDate, setSpDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [parentName, setParentName] = useState<string>('');
  const [parentJob, setParentJob] = useState<string>('Wiraswasta / Pekerja Swasta');
  const [parentPhone, setParentPhone] = useState<string>('');
  const [spWitnessHomeroom, setSpWitnessHomeroom] = useState<string>('');
  const [violationSummary, setViolationSummary] = useState<string>('');
  const [agreementPoints, setAgreementPoints] = useState<string[]>([
    'Hadir di sekolah tepat waktu sesuai jadwal paling lambat pukul 06.45 WIB.',
    'Mematuhi seluruh tata tertib sekolah dan arahan guru.',
    'Mengenakan seragam sekolah rapi dan atribut lengkap setiap hari belajar.'
  ]);
  const [newPointInput, setNewPointInput] = useState<string>('');
  const [consequences, setConsequences] = useState<string>('Menerima sanksi pembinaan terstruktur, skorsing sementara, dan evaluasi khusus apabila melanggar perjanjian ini.');

  // --- FORM KONTRAK PERILAKU STATE ---
  const [kpStudentId, setKpStudentId] = useState<string>(
    recommendedStudentsList[0]?.student.id || students[0]?.id || ''
  );
  const [kpContractNumber, setKpContractNumber] = useState<string>(`KP-${new Date().getFullYear()}/${String(kontrakList.length + 1).padStart(3, '0')}`);
  const [kpStartDate, setKpStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [kpEndDate, setKpEndDate] = useState<string>(new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10));
  const [kpWitnessHomeroom, setKpWitnessHomeroom] = useState<string>('');
  const [targetBehavior, setTargetBehavior] = useState<string>('');
  const [positiveBehaviors, setPositiveBehaviors] = useState<string[]>([
    'Mengumpulkan tugas harian tepat waktu sesuai instruksi guru mata pelajaran',
    'Menjaga sikap sopan santun kepada guru dan saling menghargai sesama teman',
    'Meminta verifikasi tanda tangan pada kartu kontrol presensi harian'
  ]);
  const [newKpBehavior, setNewKpBehavior] = useState<string>('');
  const [rewards, setRewards] = useState<string>('Piagam Penghargaan Karakter Disiplin & Pemulihan -10 Bobot Poin Pelanggaran');
  const [sanctions, setSanctions] = useState<string>('Tugas restitusi kebersihan area lingkungan sekolah selama 30 menit setelah jam pulang');
  const [reviewPeriod, setReviewPeriod] = useState<string>('2 Minggu');

  // --- FORM JURNAL PEMBINAAN DISIPLIN BK STATE ---
  const [jrnStudentId, setJrnStudentId] = useState<string>(
    recommendedStudentsList[0]?.student.id || students[0]?.id || ''
  );
  const [jrnNumber, setJrnNumber] = useState<string>(`JRN-${new Date().getFullYear()}/${String(jurnalList.length + 1).padStart(3, '0')}`);
  const [jrnDate, setJrnDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [jrnLocation, setJrnLocation] = useState<string>('Ruang Bimbingan & Konseling BK');
  const [jrnCounselingType, setJrnCounselingType] = useState<string>('Konseling Restoratif Individu');
  const [jrnProblem, setJrnProblem] = useState<string>('');
  const [jrnCounselingApproach, setJrnCounselingApproach] = useState<string>('Konseling Restoratif & Solution-Focused Brief Therapy (SFBT)');
  const [jrnRestitutionAgreement, setJrnRestitutionAgreement] = useState<string>('');
  const [jrnEvaluationPlan, setJrnEvaluationPlan] = useState<string>('Pemantauan mingguan selama 14 hari melalui lembar kontrol karakter.');
  const [jrnStatus, setJrnStatus] = useState<'Proses Pembinaan' | 'Selesai / Teratasi'>('Proses Pembinaan');

  // --- FORM LEMBAR KOMITMEN & RTL STATE ---
  const [rtlStudentId, setRtlStudentId] = useState<string>(
    recommendedStudentsList[0]?.student.id || students[0]?.id || ''
  );
  const [rtlNumber, setRtlNumber] = useState<string>(`RTL-${new Date().getFullYear()}/${String(komitmenList.length + 1).padStart(3, '0')}`);
  const [rtlDate, setRtlDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rtlReviewDate, setRtlReviewDate] = useState<string>(new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10));
  const [rtlPersonalCommitment, setRtlPersonalCommitment] = useState<string>('');
  const [rtlActionSteps, setRtlActionSteps] = useState<string[]>([
    'Tidur malam lebih awal paling lambat pukul 21.30 WIB untuk menghindari bangun kesiangan.',
    'Menyiapkan seragam dan perlengkapan sekolah sejak malam hari.',
    'Melaporkan kehadiran harian kepada Wali Kelas setiap pagi.'
  ]);
  const [rtlNewActionInput, setRtlNewActionInput] = useState<string>('');
  const [rtlSuccessIndicators, setRtlSuccessIndicators] = useState<string>('Kehadiran 100% tepat waktu tanpa Alpa dan keterlambatan selama 2 minggu berturut-turut.');
  const [rtlSupportNeeded, setRtlSupportNeeded] = useState<string>('Dukungan pengingat positif dari orang tua di rumah dan bimbingan mingguan dari Guru BK.');

  // Auto-select initial student
  useEffect(() => {
    if (students.length > 0) {
      const initialStudent = recommendedStudentsList[0] || studentDisciplineAnalytics[0];
      if (initialStudent) {
        if (!selectedStudentId) {
          setSelectedStudentId(initialStudent.student.id);
          autoSyncDisciplineData(initialStudent, 'perjanjian');
        }
        if (!kpStudentId) {
          setKpStudentId(initialStudent.student.id);
          autoSyncDisciplineData(initialStudent, 'kontrak');
        }
        if (!jrnStudentId) {
          setJrnStudentId(initialStudent.student.id);
        }
        if (!rtlStudentId) {
          setRtlStudentId(initialStudent.student.id);
        }
      }
    }
  }, [students, recommendedStudentsList]);

  // Active student analytics per form tab
  const currentSpAnalytics = useMemo(() => {
    return studentDisciplineAnalytics.find((item) => item.student.id === selectedStudentId) || studentDisciplineAnalytics[0];
  }, [studentDisciplineAnalytics, selectedStudentId]);

  const currentKpAnalytics = useMemo(() => {
    return studentDisciplineAnalytics.find((item) => item.student.id === kpStudentId) || studentDisciplineAnalytics[0];
  }, [studentDisciplineAnalytics, kpStudentId]);

  const currentJrnAnalytics = useMemo(() => {
    return studentDisciplineAnalytics.find((item) => item.student.id === jrnStudentId) || studentDisciplineAnalytics[0];
  }, [studentDisciplineAnalytics, jrnStudentId]);

  const currentRtlAnalytics = useMemo(() => {
    return studentDisciplineAnalytics.find((item) => item.student.id === rtlStudentId) || studentDisciplineAnalytics[0];
  }, [studentDisciplineAnalytics, rtlStudentId]);

  // SMART AUTO-SYNC DATA DISIPLIN SISWA (AUTO-FILL)
  const autoSyncDisciplineData = (studentAnalytics: typeof studentDisciplineAnalytics[0], mode: DisciplineFormType) => {
    if (!studentAnalytics) return;
    const { student, alpaCount, alpaEntries, stViolations, points, knownParentName } = studentAnalytics;

    if (knownParentName) {
      setParentName(knownParentName);
    }

    const parts: string[] = [];
    if (alpaCount > 0) {
      const datesStr = alpaEntries.map((a) => a.date).join(', ');
      parts.push(`Terdata Alpa / Tanpa Keterangan sebanyak ${alpaCount}x pada absensi (${datesStr})`);
    }
    if (stViolations.length > 0) {
      const catsStr = Array.from(new Set(stViolations.map((v) => v.category))).join(', ');
      parts.push(`tercatat ${stViolations.length} pelanggaran kedisiplinan (${catsStr})`);
    }
    if (points > 0) {
      parts.push(`dengan akumulasi ${points} poin pelanggaran`);
    }

    const generatedSummary = parts.length > 0
      ? parts.join(' serta ') + '.'
      : 'Pembinaan rutinitas kedisiplinan dan pembentukan karakter positif siswa.';

    const generatedPoints: string[] = [];
    if (alpaCount > 0) {
      generatedPoints.push('Hadir di sekolah tepat waktu setiap hari belajar paling lambat pukul 06.45 WIB.');
      generatedPoints.push('Menyerahkan surat izin resmi dari orang tua/wali atau surat dokter jika berhalangan hadir.');
    }
    if (stViolations.length > 0 || points > 0) {
      generatedPoints.push('Mematuhi seluruh aturan tata tertib sekolah serta menggunakan seragam dan atribut lengkap.');
      generatedPoints.push('Menjaga sikap, kerapian, dan sopan santun kepada seluruh guru, staf, dan sesama siswa.');
    }
    generatedPoints.push('Bersedia mengikuti program pembinaan disiplin positif dan restitusi dari Guru Bimbingan & Konseling.');

    if (mode === 'perjanjian') {
      setSelectedStudentId(student.id);
      setViolationSummary(generatedSummary);
      setAgreementPoints(generatedPoints);
    } else if (mode === 'kontrak') {
      setKpStudentId(student.id);
      setTargetBehavior(`Meningkatkan persentase kehadiran sekolah 100% tanpa Alpa dan disiplin ${alpaCount > 0 ? 'absensi harian' : 'tata tertib sekolah'}.`);
      setPositiveBehaviors(generatedPoints);
    } else if (mode === 'jurnal-pembinaan') {
      setJrnStudentId(student.id);
      setJrnProblem(generatedSummary);
      setJrnRestitutionAgreement(`Siswa ${student.name} mengakui kekurangannya dan berkomitmen hadir tepat waktu serta melengkapi catatan tugas.`);
    } else if (mode === 'komitmen-rtl') {
      setRtlStudentId(student.id);
      setRtlPersonalCommitment(`Saya ${student.name} berjanji dengan kesadaran penuh untuk merubah kebiasaan indisiplin dan menjadi siswa yang berkarakter baik.`);
      setRtlActionSteps(generatedPoints);
    }
  };

  // HANDLER TRIGGER BANTUAN AI BK
  const handleTriggerFormAi = async (targetFormType: DisciplineFormType) => {
    let currentAnalytics = currentSpAnalytics;
    if (targetFormType === 'kontrak') currentAnalytics = currentKpAnalytics;
    else if (targetFormType === 'jurnal-pembinaan') currentAnalytics = currentJrnAnalytics;
    else if (targetFormType === 'komitmen-rtl') currentAnalytics = currentRtlAnalytics;

    if (!currentAnalytics?.student) {
      alert('Pilih siswa terlebih dahulu!');
      return;
    }

    setIsAiGenerating(true);
    setAiActiveSource(null);

    try {
      const res = await fetchDisciplineFormAi({
        formType: targetFormType,
        studentName: currentAnalytics.student.name,
        studentClass: currentAnalytics.student.class,
        alpaCount: currentAnalytics.alpaCount,
        violationCount: currentAnalytics.violationCount,
        netPoints: currentAnalytics.points,
        violationsSummary: currentAnalytics.stViolations.map((v) => `${v.category}: ${v.notes || ''}`).join(', ')
      });

      if (res.success && res.data) {
        setAiActiveSource(res.source === 'gemini' ? 'Gemini 3.8 Flash AI Engine' : 'Sistem Cerdas Konseling BK');

        if (targetFormType === 'perjanjian') {
          if (res.data.violationSummary) setViolationSummary(res.data.violationSummary);
          if (res.data.agreementPoints) setAgreementPoints(res.data.agreementPoints);
          if (res.data.consequences) setConsequences(res.data.consequences);
        } else if (targetFormType === 'kontrak') {
          if (res.data.targetBehavior) setTargetBehavior(res.data.targetBehavior);
          if (res.data.agreedPositiveBehaviors) setPositiveBehaviors(res.data.agreedPositiveBehaviors);
          if (res.data.rewards) setRewards(res.data.rewards);
          if (res.data.sanctions) setSanctions(res.data.sanctions);
        } else if (targetFormType === 'jurnal-pembinaan') {
          if (res.data.problemDescription) setJrnProblem(res.data.problemDescription);
          if (res.data.counselingApproach) setJrnCounselingApproach(res.data.counselingApproach);
          if (res.data.restitutionAgreement) setJrnRestitutionAgreement(res.data.restitutionAgreement);
          if (res.data.evaluationPlan) setJrnEvaluationPlan(res.data.evaluationPlan);
        } else if (targetFormType === 'komitmen-rtl') {
          if (res.data.personalCommitment) setRtlPersonalCommitment(res.data.personalCommitment);
          if (res.data.actionSteps) setRtlActionSteps(res.data.actionSteps);
          if (res.data.successIndicators) setRtlSuccessIndicators(res.data.successIndicators);
          if (res.data.supportNeeded) setRtlSupportNeeded(res.data.supportNeeded);
        }
      }
    } catch (err) {
      console.error('Error generating AI assistance:', err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSelectStudentOption = (item: typeof studentDisciplineAnalytics[0]) => {
    autoSyncDisciplineData(item, activeTab);
    setIsDropdownOpen(false);
    setStudentSearchQuery('');
    showToast(`Data ${item.student.name} disinkronkan ke formulir!`, 'success');
    if (disciplineConfig.autoScrollOnSelect) {
      setTimeout(() => {
        const el = document.getElementById('discipline-form-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleSwitchTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    const tabTitles: Record<string, string> = {
      'perjanjian': 'Surat Perjanjian Siswa',
      'kontrak': 'Kontrak Perilaku Siswa',
      'jurnal-pembinaan': 'Jurnal Pembinaan BK',
      'komitmen-rtl': 'Komitmen & RTL Siswa'
    };
    showToast(`Beralih ke: ${tabTitles[tab] || tab}`, 'info');
    if (disciplineConfig.autoScrollOnSelect) {
      setTimeout(() => {
        const el = document.getElementById('discipline-form-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  };

  const currentActiveStudent = useMemo(() => {
    if (activeTab === 'perjanjian') return currentSpAnalytics?.student;
    if (activeTab === 'kontrak') return currentKpAnalytics?.student;
    if (activeTab === 'jurnal-pembinaan') return currentJrnAnalytics?.student;
    if (activeTab === 'komitmen-rtl') return currentRtlAnalytics?.student;
    return null;
  }, [activeTab, currentSpAnalytics, currentKpAnalytics, currentJrnAnalytics, currentRtlAnalytics]);

  const currentActiveCount = useMemo(() => {
    if (activeTab === 'perjanjian') return perjanjianList.length;
    if (activeTab === 'kontrak') return kontrakList.length;
    if (activeTab === 'jurnal-pembinaan') return jurnalList.length;
    if (activeTab === 'komitmen-rtl') return komitmenList.length;
    return 0;
  }, [activeTab, perjanjianList.length, kontrakList.length, jurnalList.length, komitmenList.length]);

  // Submissions
  const handleSubmitPerjanjian = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSpAnalytics?.student) {
      alert('Pilih siswa terlebih dahulu.');
      return;
    }
    const newRecord: SuratPerjanjianRecord = {
      id: `sp-${Date.now()}`,
      type: 'perjanjian',
      letterNumber,
      date: spDate,
      studentId: currentSpAnalytics.student.id,
      studentName: currentSpAnalytics.student.name,
      studentClass: currentSpAnalytics.student.class,
      studentNis: currentSpAnalytics.student.nis,
      parentName: parentName || 'Orang Tua / Wali',
      parentJob,
      parentPhone,
      witnessHomeroomTeacher: spWitnessHomeroom,
      violationSummary: violationSummary || 'Catatan kedisiplinan & restitusi karakter.',
      agreementPoints,
      consequences,
      status: 'Aktif',
      counselorName: activeCounselor.name,
      createdAt: new Date().toISOString()
    };
    setPerjanjianList([newRecord, ...perjanjianList]);
    saveToFirestore('bk_surat_perjanjian_list', newRecord);
    
    // Auto push to Jurnal Harian
    autoPushToJournal({
      sourceType: 'service',
      date: spDate,
      startTime: '09:00',
      endTime: '10:00',
      activityType: 'Kasus Mendesak',
      title: `Penyusunan Surat Perjanjian Siswa - No: ${letterNumber}`,
      description: `Pembuatan Surat Perjanjian Disiplin & Restitusi Karakter siswa ${currentSpAnalytics.student.name} (${currentSpAnalytics.student.class}) bersama Ortu/Wali (${parentName || 'Wali'}). Ringkasan: ${violationSummary || '-'}. Poin Kesepakatan: ${agreementPoints.slice(0, 2).join('; ')}`,
      target: `${currentSpAnalytics.student.name} (${currentSpAnalytics.student.class}) & Ortu (${parentName || 'Wali'})`,
      status: 'Selesai',
      counselorId: activeCounselor.id
    });

    alert(`Surat Perjanjian (${currentSpAnalytics.student.name}) berhasil disimpan!`);
    setLetterNumber(`SP-${new Date().getFullYear()}/${String(perjanjianList.length + 2).padStart(3, '0')}`);
  };

  const handleSubmitKontrak = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentKpAnalytics?.student) {
      alert('Pilih siswa terlebih dahulu.');
      return;
    }
    const newRecord: KontrakPerilakuRecord = {
      id: `kp-${Date.now()}`,
      type: 'kontrak',
      contractNumber: kpContractNumber,
      startDate: kpStartDate,
      endDate: kpEndDate,
      studentId: currentKpAnalytics.student.id,
      studentName: currentKpAnalytics.student.name,
      studentClass: currentKpAnalytics.student.class,
      studentNis: currentKpAnalytics.student.nis,
      witnessHomeroomTeacher: kpWitnessHomeroom,
      targetBehavior: targetBehavior || 'Perilaku sasaran pengembangan diri positif',
      agreedPositiveBehaviors: positiveBehaviors,
      rewards,
      sanctions,
      reviewPeriod,
      evaluator: activeCounselor.name,
      status: 'Aktif',
      counselorName: activeCounselor.name,
      createdAt: new Date().toISOString()
    };
    setKontrakList([newRecord, ...kontrakList]);
    saveToFirestore('bk_kontrak_perilaku_list', newRecord);

    // Auto push to Jurnal Harian
    autoPushToJournal({
      sourceType: 'service',
      date: kpStartDate,
      startTime: '08:30',
      endTime: '09:30',
      activityType: 'Kasus Mendesak',
      title: `Penyusunan Kontrak Perilaku - No: ${kpContractNumber}`,
      description: `Kontrak Perilaku Pengembangan Diri Positif siswa ${currentKpAnalytics.student.name} (${currentKpAnalytics.student.class}). Target Perilaku: ${targetBehavior}. Periode: ${kpStartDate} s/d ${kpEndDate}. Saksi Wali Kelas: ${kpWitnessHomeroom || '-'}`,
      target: `${currentKpAnalytics.student.name} (${currentKpAnalytics.student.class})`,
      status: 'Dalam Proses',
      counselorId: activeCounselor.id
    });

    alert(`Kontrak Perilaku (${currentKpAnalytics.student.name}) berhasil disimpan!`);
    setKpContractNumber(`KP-${new Date().getFullYear()}/${String(kontrakList.length + 2).padStart(3, '0')}`);
  };

  const handleSubmitJurnal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentJrnAnalytics?.student) {
      alert('Pilih siswa terlebih dahulu.');
      return;
    }
    const newRecord: JurnalPembinaanDisiplinRecord = {
      id: `jrn-${Date.now()}`,
      journalNumber: jrnNumber,
      date: jrnDate,
      studentId: currentJrnAnalytics.student.id,
      studentName: currentJrnAnalytics.student.name,
      studentClass: currentJrnAnalytics.student.class,
      studentNis: currentJrnAnalytics.student.nis,
      location: jrnLocation,
      counselingType: jrnCounselingType,
      problemDescription: jrnProblem,
      counselingApproach: jrnCounselingApproach,
      restitutionAgreement: jrnRestitutionAgreement,
      evaluationPlan: jrnEvaluationPlan,
      counselorName: activeCounselor.name,
      status: jrnStatus,
      createdAt: new Date().toISOString()
    };
    setJurnalList([newRecord, ...jurnalList]);
    saveToFirestore('bk_jurnal_pembinaan_disiplin_list', newRecord);

    // Auto push to Jurnal Harian
    autoPushToJournal({
      sourceType: 'service',
      date: jrnDate,
      startTime: '10:00',
      endTime: '11:00',
      activityType: 'Kasus Mendesak',
      title: `Pembinaan BK (${jrnCounselingType}) - No: ${jrnNumber}`,
      description: `Bimbingan & Pendampingan Karakter ${currentJrnAnalytics.student.name} (${currentJrnAnalytics.student.class}). Pendekatan: ${jrnCounselingApproach}. Deskripsi: ${jrnProblem}. Kesepakatan Restitusi: ${jrnRestitutionAgreement}`,
      target: `${currentJrnAnalytics.student.name} (${currentJrnAnalytics.student.class})`,
      status: jrnStatus === 'Selesai / Teratasi' ? 'Selesai' : 'Dalam Proses',
      counselorId: activeCounselor.id
    });

    alert(`Jurnal Pembinaan BK (${currentJrnAnalytics.student.name}) berhasil disimpan!`);
    setJrnNumber(`JRN-${new Date().getFullYear()}/${String(jurnalList.length + 2).padStart(3, '0')}`);
  };

  const handleSubmitRtl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRtlAnalytics?.student) {
      alert('Pilih siswa terlebih dahulu.');
      return;
    }
    const newRecord: KomitmenRtlRecord = {
      id: `rtl-${Date.now()}`,
      commitmentNumber: rtlNumber,
      date: rtlDate,
      studentId: currentRtlAnalytics.student.id,
      studentName: currentRtlAnalytics.student.name,
      studentClass: currentRtlAnalytics.student.class,
      studentNis: currentRtlAnalytics.student.nis,
      personalCommitment: rtlPersonalCommitment,
      actionSteps: rtlActionSteps,
      successIndicators: rtlSuccessIndicators,
      supportNeeded: rtlSupportNeeded,
      reviewDate: rtlReviewDate,
      counselorName: activeCounselor.name,
      createdAt: new Date().toISOString()
    };
    setKomitmenList([newRecord, ...komitmenList]);
    saveToFirestore('bk_komitmen_rtl_list', newRecord);

    // Auto push to Jurnal Harian
    autoPushToJournal({
      sourceType: 'service',
      date: rtlDate,
      startTime: '11:00',
      endTime: '11:45',
      activityType: 'Kasus Mendesak',
      title: `Penyusunan Lembar Komitmen & RTL - No: ${rtlNumber}`,
      description: `Lembar Komitmen Diri & Rencana Tindak Lanjut ${currentRtlAnalytics.student.name} (${currentRtlAnalytics.student.class}). Komitmen Diri: ${rtlPersonalCommitment}. Evaluasi Berikutnya: ${rtlReviewDate}`,
      target: `${currentRtlAnalytics.student.name} (${currentRtlAnalytics.student.class})`,
      status: 'Dalam Proses',
      counselorId: activeCounselor.id
    });

    alert(`Lembar Komitmen & RTL (${currentRtlAnalytics.student.name}) berhasil disimpan!`);
    setRtlNumber(`RTL-${new Date().getFullYear()}/${String(komitmenList.length + 2).padStart(3, '0')}`);
  };

  // Helper render to render student selector header for any active form
  const renderStudentSelectorSection = (
    currentAnalytics: typeof studentDisciplineAnalytics[0] | undefined,
    formType: DisciplineFormType
  ) => {
    const totalStudentsCount = students.length;
    const recCount = recommendedStudentsList.length;
    const alpaTotalCount = studentDisciplineAnalytics.filter((s) => s.isAlpaEligible).length;
    const violationTotalCount = studentDisciplineAnalytics.filter((s) => s.isViolationEligible).length;

    return (
      <div className="p-5 bg-gradient-to-br from-[#e6f4f1]/80 via-white to-gray-50 rounded-2xl border border-[#00685f]/20 space-y-4">
        {/* Current Active Selected Student Display Banner */}
        {currentAnalytics?.student ? (
          <div className="p-4 bg-white rounded-xl border border-[#00685f]/30 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#00685f] text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                {currentAnalytics.student.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-[#0b1c30]">{currentAnalytics.student.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-[#00685f]">
                    Kelas {currentAnalytics.student.class}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    NISN: {currentAnalytics.student.nis}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {currentAnalytics.alpaCount > 0 ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-100 text-rose-800 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{currentAnalytics.alpaCount}x Alpa Absensi</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                      ✓ Kehadiran Baik
                    </span>
                  )}

                  {currentAnalytics.points > 0 ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                      <Gavel className="w-3 h-3" />
                      <span>{currentAnalytics.points} Poin Pelanggaran</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                      0 Poin Pelanggaran
                    </span>
                  )}

                  {currentAnalytics.knownParentName && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200/60">
                      Ortu: {currentAnalytics.knownParentName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => autoSyncDisciplineData(currentAnalytics, formType)}
                className="px-3 py-1.5 bg-[#e6f4f1] hover:bg-teal-100 text-[#00685f] border border-[#00685f]/30 font-extrabold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                title="Muat Ulang & Sinkronkan Data Otomatis"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Auto-Sync Data</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="px-3 py-1.5 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Cari / Ganti Siswa</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-bold flex items-center justify-between">
            <span>Belum ada siswa dipilih. Silakan ketik nama atau pilih dari daftar.</span>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(true)}
              className="px-3 py-1 bg-[#00685f] text-white font-bold rounded-md"
            >
              Pilih Siswa
            </button>
          </div>
        )}

        {/* SEARCH BAR & CATEGORY/CLASS FILTERS */}
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            {/* Search Input Box */}
            <div className="md:col-span-8 relative">
              <input
                type="text"
                value={studentSearchQuery}
                onChange={(e) => {
                  setStudentSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Cari siswa seluruh sekolah (Ketik Nama, NISN, atau Kelas)..."
                className="w-full bg-white border border-[#bcc9c6] rounded-xl pl-10 pr-10 py-2.5 text-xs font-extrabold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f] shadow-2xs"
              />
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#00685f]" />
              {studentSearchQuery && (
                <button
                  type="button"
                  onClick={() => setStudentSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Class Dropdown Filter */}
            <div className="md:col-span-4 relative">
              <select
                value={selectedClassFilter}
                onChange={(e) => {
                  setSelectedClassFilter(e.target.value);
                  setIsDropdownOpen(true);
                }}
                className="w-full bg-white border border-[#bcc9c6] rounded-xl px-3 py-2.5 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f] cursor-pointer"
              >
                <option value="ALL">Semua Kelas ({totalStudentsCount} Siswa)</option>
                {classOptions.filter((c) => c !== 'ALL').map((c) => (
                  <option key={c} value={c}>
                    Kelas {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#00685f]" /> Filter:
            </span>

            <button
              type="button"
              onClick={() => {
                setStudentCategoryFilter('all');
                setIsDropdownOpen(true);
              }}
              className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                studentCategoryFilter === 'all'
                  ? 'bg-[#00685f] text-white shadow-2xs'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              Semua Siswa ({totalStudentsCount})
            </button>

            <button
              type="button"
              onClick={() => {
                setStudentCategoryFilter('recommended');
                setIsDropdownOpen(true);
              }}
              className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                studentCategoryFilter === 'recommended'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Rekomendasi Pembinaan ({recCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStudentCategoryFilter('alpa');
                setIsDropdownOpen(true);
              }}
              className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                studentCategoryFilter === 'alpa'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              <span>Memiliki Alpa ({alpaTotalCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStudentCategoryFilter('restitusi');
                setIsDropdownOpen(true);
              }}
              className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                studentCategoryFilter === 'restitusi'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
              }`}
            >
              <Gavel className="w-3 h-3" />
              <span>Ada Pelanggaran ({violationTotalCount})</span>
            </button>
          </div>

          {/* Autocomplete Dropdown List */}
          {isDropdownOpen && (
            <div className="bg-white border border-[#bcc9c6] rounded-xl shadow-xl z-30 max-h-72 overflow-y-auto custom-scrollbar divide-y divide-gray-100 mt-2">
              <div className="p-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-[11px] text-gray-600 font-bold sticky top-0 bg-gray-50 z-10">
                <span>
                  Menampilkan {filteredStudentOptions.length} siswa {selectedClassFilter !== 'ALL' ? `Kelas ${selectedClassFilter}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(false)}
                  className="text-[#00685f] hover:underline cursor-pointer text-[10px] font-black uppercase"
                >
                  Tutup Daftar ✕
                </button>
              </div>

              {filteredStudentOptions.length > 0 ? (
                filteredStudentOptions.map((item) => {
                  let isSelected = false;
                  if (formType === 'perjanjian') isSelected = item.student.id === selectedStudentId;
                  else if (formType === 'kontrak') isSelected = item.student.id === kpStudentId;
                  else if (formType === 'jurnal-pembinaan') isSelected = item.student.id === jrnStudentId;
                  else if (formType === 'komitmen-rtl') isSelected = item.student.id === rtlStudentId;

                  return (
                    <div
                      key={item.student.id}
                      onClick={() => handleSelectStudentOption(item)}
                      className={`p-3 hover:bg-[#e6f4f1]/60 cursor-pointer flex items-center justify-between transition-colors ${
                        isSelected ? 'bg-[#e6f4f1] font-bold border-l-4 border-l-[#00685f]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#00685f]/10 text-[#00685f] flex items-center justify-center font-black text-xs shrink-0">
                          {item.student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#0b1c30] flex items-center gap-2">
                            <span>{item.student.name}</span>
                            <span className="text-[10px] font-extrabold text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded">
                              Kelas {item.student.class}
                            </span>
                            {isSelected && (
                              <span className="text-[9px] bg-[#00685f] text-white font-extrabold px-1.5 py-0.2 rounded">
                                Sedang Dipilih
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-gray-500 font-medium">
                            NISN: {item.student.nis || '-'} {item.knownParentName ? `| Ortu: ${item.knownParentName}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.alpaCount > 0 && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                            Alpa {item.alpaCount}x
                          </span>
                        )}
                        {item.points > 0 && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            {item.points} Poin
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-[#00685f] hover:underline ml-1">
                          Pilih
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-gray-500 font-bold space-y-1">
                  <p>Tidak ada siswa ditemukan sesuai pencarian/filter.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentSearchQuery('');
                      setStudentCategoryFilter('all');
                      setSelectedClassFilter('ALL');
                    }}
                    className="text-[#00685f] hover:underline text-[11px] font-extrabold"
                  >
                    Reset Filter Pencarian
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Purpose & Workflow Header Banner */}
      <PageHeaderBanner
        category="Layanan & Bimbingan"
        title="Pusat Instrumen Pembinaan Disiplin & Restitusi"
        description="Penerbitan surat resmi pembinaan (Surat Perjanjian Siswa, Kontrak Perilaku, Jurnal Pembinaan BK, & Lembar Komitmen RTL) otomatis terhubung ke rekap absensi dan AI."
        icon={<Gavel className="w-5 h-5" />}
        badge="SMP Negeri 2 Susukan"
        workflowHint="1. Pilih Tab Format Surat › 2. Pilih Siswa Siaga / Cari Nama Siswa › 3. Review Formulir / Bantuan AI › 4. Simpan & Unduh Dokumen PDF"
        stats={[
          { label: 'Siswa Siaga Pembinaan', value: `${recommendedStudentsList.length} Siswa`, color: recommendedStudentsList.length > 0 ? 'text-amber-700' : 'text-[#00685f]' },
          { label: 'Total Arsip Surat', value: perjanjianList.length + kontrakList.length + jurnalList.length + komitmenList.length },
          { label: 'Siswa Aktif di Form', value: currentActiveStudent ? currentActiveStudent.name.split(' ').slice(0, 2).join(' ') : 'Belum Dipilih', color: currentActiveStudent ? 'text-[#00685f]' : 'text-gray-400' }
        ]}
        actions={
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#0b1c30] rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-gray-300/80 cursor-pointer active:scale-97 shadow-2xs"
            title="Atur ambang batas alpa, format nomor surat, dan template"
          >
            <Settings className="w-4 h-4 text-[#00685f]" />
            <span>Konfigurasi Disiplin</span>
          </button>
        }
      />

      {/* 2. Primary Tab Switcher (Segmented pill container following user rules) */}
      <div className="bg-gray-100 p-1.5 rounded-2xl border border-gray-200/80 shadow-2xs">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => handleSwitchTab('perjanjian')}
            className={`flex-1 min-w-[150px] px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'perjanjian'
                ? 'bg-[#00685f] text-white shadow-sm ring-1 ring-[#00685f]/30'
                : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-white/60'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Surat Perjanjian</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeTab === 'perjanjian' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
            }`}>
              {perjanjianList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab('kontrak')}
            className={`flex-1 min-w-[150px] px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'kontrak'
                ? 'bg-[#00685f] text-white shadow-sm ring-1 ring-[#00685f]/30'
                : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-white/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Kontrak Perilaku</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeTab === 'kontrak' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
            }`}>
              {kontrakList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab('jurnal-pembinaan')}
            className={`flex-1 min-w-[160px] px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'jurnal-pembinaan'
                ? 'bg-[#00685f] text-white shadow-sm ring-1 ring-[#00685f]/30'
                : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-white/60'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Jurnal Pembinaan BK</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeTab === 'jurnal-pembinaan' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
            }`}>
              {jurnalList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab('komitmen-rtl')}
            className={`flex-1 min-w-[150px] px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'komitmen-rtl'
                ? 'bg-[#00685f] text-white shadow-sm ring-1 ring-[#00685f]/30'
                : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-white/60'
            }`}
          >
            <Target className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Komitmen & RTL</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeTab === 'komitmen-rtl' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
            }`}>
              {komitmenList.length}
            </span>
          </button>
        </div>
      </div>

      {/* 3. Real-Time Active Status Banner: Immediately visible confirmation */}
      <div className="bg-[#e6f4f1] border border-[#00685f]/30 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#00685f] text-white flex items-center justify-center font-black shadow-sm shrink-0">
              {activeTab === 'perjanjian' && <FileText className="w-5 h-5" />}
              {activeTab === 'kontrak' && <ShieldCheck className="w-5 h-5" />}
              {activeTab === 'jurnal-pembinaan' && <BookOpen className="w-5 h-5" />}
              {activeTab === 'komitmen-rtl' && <Target className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#00685f] text-white">
                  Fitur Aktif
                </span>
                <h2 className="text-sm sm:text-base font-extrabold text-[#0b1c30]">
                  {activeTab === 'perjanjian' && 'Form Surat Perjanjian Pembinaan Siswa'}
                  {activeTab === 'kontrak' && 'Form Kontrak Perilaku & Restitusi Siswa'}
                  {activeTab === 'jurnal-pembinaan' && 'Jurnal Catatan Pembinaan Harian BK'}
                  {activeTab === 'komitmen-rtl' && 'Lembar Komitmen & Rencana Tindak Lanjut'}
                </h2>
              </div>
              <p className="text-xs text-[#3d4947] mt-1 font-semibold flex items-center gap-2 flex-wrap">
                <span>Siswa Aktif:</span>
                {currentActiveStudent ? (
                  <span className="bg-white px-2.5 py-0.5 rounded-lg border border-[#00685f]/30 text-[#00685f] font-black inline-flex items-center gap-1.5 shadow-2xs">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{currentActiveStudent.name} (Kelas {currentActiveStudent.class})</span>
                  </span>
                ) : (
                  <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 font-bold">
                    Belum ada siswa dipilih
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <button
              type="button"
              onClick={() => {
                document.getElementById('discipline-form-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex-1 sm:flex-initial px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-97"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Isi Form Ini ↓</span>
            </button>
            <button
              type="button"
              onClick={() => {
                document.getElementById('discipline-history-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3.5 py-2 bg-white hover:bg-gray-50 text-[#0b1c30] text-xs font-bold rounded-xl border border-gray-300 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Arsip ({currentActiveCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Streamlined Rekomendasi Siswa: Collapsible & Quick 1-Tap Chips */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-[#bcc9c6]/30 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black shrink-0">
              <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-[#0b1c30] flex items-center gap-2">
                <span>Rekomendasi Siswa Perlu Pembinaan</span>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {recommendedStudentsList.length} Siswa Terdeteksi
                </span>
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Siswa dengan Alpa ≥{disciplineConfig.minAlpaCount || 1}x atau Pelanggaran ≥{disciplineConfig.minViolationPoints || 1} poin
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRecommendationsExpanded(!isRecommendationsExpanded)}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#00685f] hover:bg-[#e6f4f1] px-3 py-1.5 rounded-lg border border-[#00685f]/20 transition-all cursor-pointer"
            >
              <span>{isRecommendationsExpanded ? 'Tampilan Ringkas' : 'Lihat Semua Kartu'}</span>
              {isRecommendationsExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Quick Horizontal Student Chips (Always visible, clean, doesn't push form down) */}
        {recommendedStudentsList.length === 0 ? (
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Seluruh siswa saat ini dalam kondisi kedisiplinan baik (bebas Alpa & catatan pelanggaran).</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Quick 1-tap horizontal pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                Pilih Cepat:
              </span>
              {recommendedStudentsList.slice(0, 10).map((item) => {
                const isSelected = currentActiveStudent?.id === item.student.id;
                return (
                  <button
                    key={item.student.id}
                    type="button"
                    onClick={() => handleSelectStudentOption(item)}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                      isSelected
                        ? 'bg-[#00685f] text-white border-[#00685f] shadow-xs'
                        : 'bg-[#f8faf9] text-[#0b1c30] border-gray-200 hover:border-[#00685f]/50 hover:bg-[#e6f4f1]/50'
                    }`}
                  >
                    <span>{item.student.name}</span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {item.student.class}
                    </span>
                    {item.alpaCount > 0 && (
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                        isSelected ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {item.alpaCount}x Alpa
                      </span>
                    )}
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </button>
                );
              })}
            </div>

            {/* Expanded Detailed Grid Cards (Shown when expanded) */}
            {isRecommendationsExpanded && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-gray-100 animate-in fade-in duration-200">
                {recommendedStudentsList.map((item) => {
                  const isSelected = currentActiveStudent?.id === item.student.id;
                  return (
                    <div
                      key={item.student.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-[#e6f4f1] border-[#00685f] shadow-2xs'
                          : 'bg-[#f8faf9] border-[#bcc9c6]/30 hover:border-[#00685f]/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-black text-[#0b1c30]">{item.student.name}</h4>
                          <p className="text-[10px] text-gray-500 font-bold">
                            Kelas {item.student.class} | NISN: {item.student.nis || '-'}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="text-[9px] bg-[#00685f] text-white font-extrabold px-1.5 py-0.5 rounded">
                            Terpilih
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.alpaCount > 0 && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>Alpa: {item.alpaCount}x</span>
                          </span>
                        )}
                        {item.points > 0 && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 flex items-center gap-1">
                            <Gavel className="w-3 h-3" />
                            <span>{item.points} Poin Pelanggaran</span>
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectStudentOption(item)}
                        className={`w-full py-1.5 px-3 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 mt-1 ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#00685f] hover:bg-[#005049] text-white'
                        }`}
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>{isSelected ? '✓ Sedang Aktif di Form' : 'Pilih & Sinkronkan'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. AI Assistant Banner (Controlled by Config) */}
      {disciplineConfig.showAiBanner && (
        <div className="bg-gradient-to-r from-teal-900 via-[#0b1c30] to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-teal-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-black shrink-0 border border-teal-400/30">
              <Sparkles className="w-5 h-5 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
            </div>
            <div>
              <h3 className="text-xs font-black text-white flex items-center gap-2">
                <span>Asisten AI Khusus Bimbingan & Konseling</span>
                {aiActiveSource && (
                  <span className="text-[9px] bg-teal-500/30 text-teal-200 border border-teal-400/30 px-2 py-0.5 rounded-full">
                    {aiActiveSource}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-gray-300 font-medium">
                Analisis otomatis rekam medis karakter ({activeTab.toUpperCase()}) & hasilkan draf instrumen konseling BK standar.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleTriggerFormAi(activeTab)}
            disabled={isAiGenerating}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 shrink-0"
          >
            {isAiGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memproses Rekomendasi AI BK...</span>
              </>
            ) : (
              <>
                <Bot className="w-4 h-4 text-slate-950" />
                <span>✨ Generasi Draf AI BK ({activeTab.toUpperCase()})</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 1: FORM SURAT PERJANJIAN SISWA */}
      {/* ============================================================ */}
      {activeTab === 'perjanjian' && (
        <div className="space-y-6">
          <form id="discipline-form-section" onSubmit={handleSubmitPerjanjian} className="bg-white p-6 sm:p-8 rounded-2xl shadow-xs border border-[#bcc9c6]/30 space-y-6 scroll-mt-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#bcc9c6]/20">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#00685f] flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#0b1c30]">
                    Form Surat Perjanjian Pembinaan Disiplin Siswa
                  </h2>
                  <p className="text-xs text-gray-500 font-semibold">
                    Format resmi ikrar janji siswa, orang tua, wali kelas, dan guru BK sesuai standar instrumen sekolah
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono font-extrabold px-3 py-1 bg-teal-50 text-[#00685f] rounded-lg border border-teal-200">
                {letterNumber}
              </span>
            </div>

            {/* Student Search & Selection Section */}
            {renderStudentSelectorSection(currentSpAnalytics, 'perjanjian')}

            {/* FORM INPUT FIELDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#00685f]" />
                  <span>Tanggal Surat Perjanjian</span>
                </label>
                <input
                  type="date"
                  value={spDate}
                  onChange={(e) => setSpDate(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#00685f]" />
                  <span>Nama Orang Tua / Wali Siswa</span>
                </label>
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="Nama lengkap Orang Tua / Wali..."
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-[#00685f]" />
                  <span>Pekerjaan Orang Tua / Wali</span>
                </label>
                <input
                  type="text"
                  value={parentJob}
                  onChange={(e) => setParentJob(e.target.value)}
                  placeholder="Misal: Wiraswasta, PNS, Karyawan..."
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-[#00685f]" />
                  <span>No. WhatsApp / Telp Orang Tua</span>
                </label>
                <input
                  type="text"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#00685f]" />
                  <span>Wali Kelas / Saksi Pihak Sekolah</span>
                </label>
                <input
                  type="text"
                  value={spWitnessHomeroom}
                  onChange={(e) => setSpWitnessHomeroom(e.target.value)}
                  placeholder="Nama Wali Kelas pendamping..."
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                />
              </div>
            </div>

            {/* Violation Summary */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Latar Belakang / Ringkasan Kasus Indisiplin</span>
              </label>
              <textarea
                value={violationSummary}
                onChange={(e) => setViolationSummary(e.target.value)}
                rows={2}
                placeholder="Rincian Alpa/Pelanggaran poin siswa yang melatarbelakangi surat perjanjian ini..."
                className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-3 text-xs font-medium text-[#0b1c30]"
              />
            </div>

            {/* Agreement Points List */}
            <div className="space-y-3 p-4 bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/30">
              <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#00685f]" />
                <span>Poin-Poin Kesepakatan & Ikrar Perjanjian Siswa</span>
              </label>

              <div className="space-y-2">
                {agreementPoints.map((point, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-[#bcc9c6]/30 text-xs">
                    <span className="w-5 h-5 rounded-full bg-teal-50 text-[#00685f] font-black text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={point}
                      onChange={(e) => {
                        const updated = [...agreementPoints];
                        updated[idx] = e.target.value;
                        setAgreementPoints(updated);
                      }}
                      className="flex-1 bg-transparent border-none text-xs font-medium text-[#0b1c30] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setAgreementPoints(agreementPoints.filter((_, i) => i !== idx))}
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newPointInput}
                  onChange={(e) => setNewPointInput(e.target.value)}
                  placeholder="Tambah butir komitmen baru..."
                  className="flex-1 bg-white border border-[#bcc9c6]/40 rounded-lg px-3 py-2 text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newPointInput.trim()) {
                      setAgreementPoints([...agreementPoints, newPointInput.trim()]);
                      setNewPointInput('');
                    }
                  }}
                  className="px-3.5 py-2 bg-[#00685f] text-white text-xs font-bold rounded-lg hover:bg-[#005049] transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Poin</span>
                </button>
              </div>
            </div>

            {/* Consequences */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                <Gavel className="w-4 h-4 text-rose-600" />
                <span>Sanksi Logis / Konsekuensi Pembinaan Apabila Terlanggar</span>
              </label>
              <textarea
                value={consequences}
                onChange={(e) => setConsequences(e.target.value)}
                rows={2}
                placeholder="Konsekuensi terukur jika siswa mengulangi tindakan indisiplin..."
                className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-3 text-xs font-medium text-[#0b1c30]"
              />
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-3 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Surat Perjanjian Siswa</span>
              </button>
            </div>
          </form>

          {/* LIST SAVED SURAT PERJANJIAN */}
          <div id="discipline-history-section" className="bg-white p-6 rounded-2xl shadow-xs border border-[#bcc9c6]/30 space-y-4 scroll-mt-6">
            <h3 className="text-sm font-extrabold text-[#0b1c30] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#00685f]" />
              <span>Arsip Surat Perjanjian Terbit ({perjanjianList.length})</span>
            </h3>

            <div className="space-y-3">
              {perjanjianList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#00685f]">{item.letterNumber}</span>
                      <span className="text-[10px] text-gray-400">•</span>
                      <span className="text-xs font-bold text-[#0b1c30]">{item.studentName} ({item.studentClass})</span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-full">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 font-medium line-clamp-1">{item.violationSummary}</p>
                    <p className="text-[10px] text-gray-400">
                      Orang Tua: {item.parentName} | Konselor: {item.counselorName} | {formatIndonesianDate(item.date)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadAgreementPDF(item, activeCounselor)}
                      className="px-3 py-1.5 bg-[#00685f] hover:bg-[#005049] text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Cetak PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Hapus Surat Perjanjian ${item.letterNumber}?`)) {
                          registerDeletedId(item.id);
                          deleteFromFirestore('bk_surat_perjanjian_list', item.id);
                          setPerjanjianList(perjanjianList.filter((p) => p.id !== item.id));
                        }
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: KONTRAK PERILAKU POSITIF SISWA */}
      {/* ============================================================ */}
      {activeTab === 'kontrak' && (
        <div className="space-y-6">
          <form id="discipline-form-section" onSubmit={handleSubmitKontrak} className="bg-white p-6 sm:p-8 rounded-2xl shadow-xs border border-[#bcc9c6]/30 space-y-6 scroll-mt-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#bcc9c6]/20">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#00685f] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#0b1c30]">
                    Form Kontrak Perilaku Positif Siswa (Behavior Contract)
                  </h2>
                  <p className="text-xs text-gray-500 font-semibold">
                    Instrumen modifikasi perilaku terstruktur dengan target pencapaian & penguatan positif (rewards)
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono font-extrabold px-3 py-1 bg-teal-50 text-[#00685f] rounded-lg border border-teal-200">
                {kpContractNumber}
              </span>
            </div>

            {/* Student Search & Selection Section */}
            {renderStudentSelectorSection(currentKpAnalytics, 'kontrak')}

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#00685f]" />
                  <span>Tanggal Mulai Kontrak</span>
                </label>
                <input
                  type="date"
                  value={kpStartDate}
                  onChange={(e) => setKpStartDate(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#00685f]" />
                  <span>Tanggal Selesai Kontrak</span>
                </label>
                <input
                  type="date"
                  value={kpEndDate}
                  onChange={(e) => setKpEndDate(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#00685f]" />
                  <span>Periode Evaluasi / Review</span>
                </label>
                <select
                  value={reviewPeriod}
                  onChange={(e) => setReviewPeriod(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                >
                  <option value="1 Minggu">1 Minggu (Mingguan)</option>
                  <option value="2 Minggu">2 Minggu (Standard BK)</option>
                  <option value="1 Bulan">1 Bulan (Intensif)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#00685f]" />
                  <span>Wali Kelas / Saksi Evaluator</span>
                </label>
                <input
                  type="text"
                  value={kpWitnessHomeroom}
                  onChange={(e) => setKpWitnessHomeroom(e.target.value)}
                  placeholder="Nama Wali Kelas..."
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                />
              </div>
            </div>

            {/* Target Behavior Goal */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                <Target className="w-4 h-4 text-teal-600" />
                <span>Target Perilaku Sasaran (Behavior Goal)</span>
              </label>
              <textarea
                value={targetBehavior}
                onChange={(e) => setTargetBehavior(e.target.value)}
                rows={2}
                placeholder="Rincian perilaku positif yang hendak dicapai selama masa kontrak..."
                className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-3 text-xs font-medium text-[#0b1c30]"
              />
            </div>

            {/* Positive Behaviors List */}
            <div className="space-y-3 p-4 bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/30">
              <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Daftar Perilaku Positif yang Disepakati</span>
              </label>

              <div className="space-y-2">
                {positiveBehaviors.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-[#bcc9c6]/30 text-xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 font-black text-[10px] flex items-center justify-center shrink-0">
                      ✓
                    </span>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const updated = [...positiveBehaviors];
                        updated[idx] = e.target.value;
                        setPositiveBehaviors(updated);
                      }}
                      className="flex-1 bg-transparent border-none text-xs font-medium text-[#0b1c30] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setPositiveBehaviors(positiveBehaviors.filter((_, i) => i !== idx))}
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newKpBehavior}
                  onChange={(e) => setNewKpBehavior(e.target.value)}
                  placeholder="Tambah butir perilaku target baru..."
                  className="flex-1 bg-white border border-[#bcc9c6]/40 rounded-lg px-3 py-2 text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newKpBehavior.trim()) {
                      setPositiveBehaviors([...positiveBehaviors, newKpBehavior.trim()]);
                      setNewKpBehavior('');
                    }
                  }}
                  className="px-3.5 py-2 bg-[#00685f] text-white text-xs font-bold rounded-lg hover:bg-[#005049] transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Butir</span>
                </button>
              </div>
            </div>

            {/* Rewards & Sanctions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-600" />
                  <span>Penguatan Positif / Reward (Apresiasi Jika Berhasil)</span>
                </label>
                <textarea
                  value={rewards}
                  onChange={(e) => setRewards(e.target.value)}
                  rows={2}
                  placeholder="Penghargaan atau apresiasi bagi siswa..."
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-3 text-xs font-medium text-[#0b1c30]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Gavel className="w-4 h-4 text-rose-600" />
                  <span>Sanksi Restitusi (Konsekuensi Jika Gagal)</span>
                </label>
                <textarea
                  value={sanctions}
                  onChange={(e) => setSanctions(e.target.value)}
                  rows={2}
                  placeholder="Konsekuensi terukur jika target tidak terpenuhi..."
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-3 text-xs font-medium text-[#0b1c30]"
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-3 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Kontrak Perilaku Positif</span>
              </button>
            </div>
          </form>

          {/* LIST SAVED KONTRAK PERILAKU */}
          <div id="discipline-history-section" className="bg-white p-6 rounded-2xl shadow-xs border border-[#bcc9c6]/30 space-y-4 scroll-mt-6">
            <h3 className="text-sm font-extrabold text-[#0b1c30] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00685f]" />
              <span>Arsip Kontrak Perilaku Terbit ({kontrakList.length})</span>
            </h3>

            <div className="space-y-3">
              {kontrakList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#00685f]">{item.contractNumber}</span>
                      <span className="text-[10px] text-gray-400">•</span>
                      <span className="text-xs font-bold text-[#0b1c30]">{item.studentName} ({item.studentClass})</span>
                      <span className="text-[9px] bg-teal-100 text-teal-800 font-black px-2 py-0.5 rounded-full">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 font-medium line-clamp-1">{item.targetBehavior}</p>
                    <p className="text-[10px] text-gray-400">
                      Periode: {formatIndonesianDate(item.startDate)} s.d {formatIndonesianDate(item.endDate)} ({item.reviewPeriod})
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadBehaviorContractPDF(item, activeCounselor)}
                      className="px-3 py-1.5 bg-[#00685f] hover:bg-[#005049] text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Cetak PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Hapus Kontrak Perilaku ${item.contractNumber}?`)) {
                          registerDeletedId(item.id);
                          deleteFromFirestore('bk_kontrak_perilaku_list', item.id);
                          setKontrakList(kontrakList.filter((k) => k.id !== item.id));
                        }
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: JURNAL PEMBINAAN DISIPLIN & RESTITUSI BK */}
      {/* ============================================================ */}
      {activeTab === 'jurnal-pembinaan' && (
        <div className="space-y-6">
          <form id="discipline-form-section" onSubmit={handleSubmitJurnal} className="bg-white p-6 sm:p-8 rounded-2xl shadow-xs border border-[#bcc9c6]/30 space-y-6 scroll-mt-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#bcc9c6]/20">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#00685f] flex items-center justify-center font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#0b1c30]">
                    Form Jurnal Pembinaan Disiplin & Restitusi BK
                  </h2>
                  <p className="text-xs text-gray-500 font-semibold">
                    Instrumen pencatatan proses layanan konseling kedisiplinan, pendekatan masalah, dan evaluasi perubahan
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono font-extrabold px-3 py-1 bg-teal-50 text-[#00685f] rounded-lg border border-teal-200">
                {jrnNumber}
              </span>
            </div>

            {/* Student Search & Selection Section */}
            {renderStudentSelectorSection(currentJrnAnalytics, 'jurnal-pembinaan')}

            {/* Fields Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#00685f]" />
                  <span>Tanggal Layanan Pembinaan</span>
                </label>
                <input
                  type="date"
                  value={jrnDate}
                  onChange={(e) => setJrnDate(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#00685f]" />
                  <span>Lokasi Konseling BK</span>
                </label>
                <input
                  type="text"
                  value={jrnLocation}
                  onChange={(e) => setJrnLocation(e.target.value)}
                  placeholder="Misal: Ruang Konseling BK..."
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#00685f]" />
                  <span>Jenis Layanan BK</span>
                </label>
                <select
                  value={jrnCounselingType}
                  onChange={(e) => setJrnCounselingType(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                >
                  <option value="Konseling Restoratif Individu">Konseling Restoratif Individu</option>
                  <option value="Konseling Kelompok Disiplin">Konseling Kelompok Disiplin</option>
                  <option value="Bimbingan Karakter & Modifikasi Perilaku">Bimbingan Karakter & Modifikasi Perilaku</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#00685f]" />
                  <span>Status Pembinaan</span>
                </label>
                <select
                  value={jrnStatus}
                  onChange={(e) => setJrnStatus(e.target.value as any)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                >
                  <option value="Proses Pembinaan">Proses Pembinaan</option>
                  <option value="Selesai / Teratasi">Selesai / Teratasi</option>
                </select>
              </div>
            </div>

            {/* Problem Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>1. Deskripsi Permasalahan / Rekam Indisiplin</span>
              </label>
              <textarea
                value={jrnProblem}
                onChange={(e) => setJrnProblem(e.target.value)}
                rows={2}
                placeholder="Gambaran umum faktor penyebab dan gejala indisiplin..."
                className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-3 text-xs font-medium text-[#0b1c30]"
              />
            </div>

            {/* Counseling Approach */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#00685f]" />
                <span>2. Pendekatan Konseling BK & Strategi Restitusi</span>
              </label>
              <textarea
                value={jrnCounselingApproach}
                onChange={(e) => setJrnCounselingApproach(e.target.value)}
                rows={2}
                placeholder="Pendekatan yang digunakan (Restoratif, Solution-Focused, Reality Therapy, dll)..."
                className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-3 text-xs font-medium text-[#0b1c30]"
              />
            </div>

            {/* Restitution Agreement */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>3. Kesepakatan & Solusi Restitusi Disiplin</span>
              </label>
              <textarea
                value={jrnRestitutionAgreement}
                onChange={(e) => setJrnRestitutionAgreement(e.target.value)}
                rows={2}
                placeholder="Bentuk perbaikan atau kompensasi positif yang disepakati siswa..."
                className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-3 text-xs font-medium text-[#0b1c30]"
              />
            </div>

            {/* Evaluation Plan */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>4. Rencana Evaluasi & Monitoring Berkala</span>
              </label>
              <textarea
                value={jrnEvaluationPlan}
                onChange={(e) => setJrnEvaluationPlan(e.target.value)}
                rows={2}
                placeholder="Rencana jadwal pemantauan perkembangan sikap..."
                className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-3 text-xs font-medium text-[#0b1c30]"
              />
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-3 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Jurnal Pembinaan BK</span>
              </button>
            </div>
          </form>

          {/* LIST SAVED JURNAL PEMBINAAN */}
          <div id="discipline-history-section" className="bg-white p-6 rounded-2xl shadow-xs border border-[#bcc9c6]/30 space-y-4 scroll-mt-6">
            <h3 className="text-sm font-extrabold text-[#0b1c30] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#00685f]" />
              <span>Arsip Jurnal Pembinaan BK Terbit ({jurnalList.length})</span>
            </h3>

            <div className="space-y-3">
              {jurnalList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#00685f]">{item.journalNumber}</span>
                      <span className="text-[10px] text-gray-400">•</span>
                      <span className="text-xs font-bold text-[#0b1c30]">{item.studentName} ({item.studentClass})</span>
                      <span className="text-[9px] bg-blue-100 text-blue-800 font-black px-2 py-0.5 rounded-full">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 font-medium line-clamp-1">{item.problemDescription}</p>
                    <p className="text-[10px] text-gray-400">
                      Lokasi: {item.location || 'Ruang BK'} | Konselor: {item.counselorName} | {formatIndonesianDate(item.date)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadJurnalPembinaanPDF(item)}
                      className="px-3 py-1.5 bg-[#00685f] hover:bg-[#005049] text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Cetak PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Hapus Jurnal Pembinaan ${item.journalNumber}?`)) {
                          registerDeletedId(item.id);
                          deleteFromFirestore('bk_jurnal_pembinaan_disiplin_list', item.id);
                          setJurnalList(jurnalList.filter((j) => j.id !== item.id));
                        }
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: LEMBAR KOMITMEN & RENCANA TINDAK LANJUT (RTL) */}
      {/* ============================================================ */}
      {activeTab === 'komitmen-rtl' && (
        <div className="space-y-6">
          <form id="discipline-form-section" onSubmit={handleSubmitRtl} className="bg-white p-6 sm:p-8 rounded-2xl shadow-xs border border-[#bcc9c6]/30 space-y-6 scroll-mt-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#bcc9c6]/20">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#00685f] flex items-center justify-center font-bold">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#0b1c30]">
                    Form Lembar Komitmen & Rencana Tindak Lanjut (RTL)
                  </h2>
                  <p className="text-xs text-gray-500 font-semibold">
                    Instrumen refleksi kesadaran diri siswa, komitmen perbaikan, dan aksi nyata terukur
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono font-extrabold px-3 py-1 bg-teal-50 text-[#00685f] rounded-lg border border-teal-200">
                {rtlNumber}
              </span>
            </div>

            {/* Student Search & Selection Section */}
            {renderStudentSelectorSection(currentRtlAnalytics, 'komitmen-rtl')}

            {/* Form Fields Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#00685f]" />
                  <span>Tanggal Pernyataan Komitmen</span>
                </label>
                <input
                  type="date"
                  value={rtlDate}
                  onChange={(e) => setRtlDate(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#00685f]" />
                  <span>Tanggal Evaluasi Ulang (Review RTL)</span>
                </label>
                <input
                  type="date"
                  value={rtlReviewDate}
                  onChange={(e) => setRtlReviewDate(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30]"
                />
              </div>
            </div>

            {/* Personal Commitment */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-teal-600" />
                <span>Pernyataan Komitmen Pribadi Siswa</span>
              </label>
              <textarea
                value={rtlPersonalCommitment}
                onChange={(e) => setRtlPersonalCommitment(e.target.value)}
                rows={2}
                placeholder="Pernyataan kesadaran diri dan janji perbaikan dari siswa bersangkutan..."
                className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-3 text-xs font-medium text-[#0b1c30]"
              />
            </div>

            {/* Action Steps List */}
            <div className="space-y-3 p-4 bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/30">
              <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[#00685f]" />
                <span>Langkah-Langkah Aksi Nyata (Action Steps RTL)</span>
              </label>

              <div className="space-y-2">
                {rtlActionSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-[#bcc9c6]/30 text-xs">
                    <span className="w-5 h-5 rounded-full bg-teal-50 text-[#00685f] font-black text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={step}
                      onChange={(e) => {
                        const updated = [...rtlActionSteps];
                        updated[idx] = e.target.value;
                        setRtlActionSteps(updated);
                      }}
                      className="flex-1 bg-transparent border-none text-xs font-medium text-[#0b1c30] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setRtlActionSteps(rtlActionSteps.filter((_, i) => i !== idx))}
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={rtlNewActionInput}
                  onChange={(e) => setRtlNewActionInput(e.target.value)}
                  placeholder="Tambah langkah aksi nyata baru..."
                  className="flex-1 bg-white border border-[#bcc9c6]/40 rounded-lg px-3 py-2 text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (rtlNewActionInput.trim()) {
                      setRtlActionSteps([...rtlActionSteps, rtlNewActionInput.trim()]);
                      setRtlNewActionInput('');
                    }
                  }}
                  className="px-3.5 py-2 bg-[#00685f] text-white text-xs font-bold rounded-lg hover:bg-[#005049] transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Langkah</span>
                </button>
              </div>
            </div>

            {/* Success Indicators & Support Needed */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Indikator Keberhasilan Terukur</span>
                </label>
                <textarea
                  value={rtlSuccessIndicators}
                  onChange={(e) => setRtlSuccessIndicators(e.target.value)}
                  rows={2}
                  placeholder="Ukuran perubahan sikap yang diharapkan..."
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-3 text-xs font-medium text-[#0b1c30]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#00685f]" />
                  <span>Dukungan yang Dibutuhkan</span>
                </label>
                <textarea
                  value={rtlSupportNeeded}
                  onChange={(e) => setRtlSupportNeeded(e.target.value)}
                  rows={2}
                  placeholder="Dukungan dari Orang Tua, Guru Mapel, Wali Kelas, atau Konselor..."
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-3 text-xs font-medium text-[#0b1c30]"
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-3 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Lembar Komitmen & RTL</span>
              </button>
            </div>
          </form>

          {/* LIST SAVED LEMBAR KOMITMEN & RTL */}
          <div id="discipline-history-section" className="bg-white p-6 rounded-2xl shadow-xs border border-[#bcc9c6]/30 space-y-4 scroll-mt-6">
            <h3 className="text-sm font-extrabold text-[#0b1c30] flex items-center gap-2">
              <Target className="w-4 h-4 text-[#00685f]" />
              <span>Arsip Lembar Komitmen & RTL Terbit ({komitmenList.length})</span>
            </h3>

            <div className="space-y-3">
              {komitmenList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#00685f]">{item.commitmentNumber}</span>
                      <span className="text-[10px] text-gray-400">•</span>
                      <span className="text-xs font-bold text-[#0b1c30]">{item.studentName} ({item.studentClass})</span>
                    </div>
                    <p className="text-[11px] text-gray-600 font-medium line-clamp-1">"{item.personalCommitment}"</p>
                    <p className="text-[10px] text-gray-400">
                      Tanggal Komitmen: {formatIndonesianDate(item.date)} | Review: {formatIndonesianDate(item.reviewDate || item.date)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadKomitmenRtlPDF(item)}
                      className="px-3 py-1.5 bg-[#00685f] hover:bg-[#005049] text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Cetak PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Hapus Lembar Komitmen ${item.commitmentNumber}?`)) {
                          registerDeletedId(item.id);
                          deleteFromFirestore('bk_komitmen_rtl_list', item.id);
                          setKomitmenList(komitmenList.filter((k) => k.id !== item.id));
                        }
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfigurasi Fitur Pendisiplinan */}
      <DisciplineConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onConfigSaved={(updatedCfg) => {
          setDisciplineConfig(updatedCfg);
        }}
      />
    </div>
  );
}
