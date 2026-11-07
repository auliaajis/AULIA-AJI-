import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Sliders,
  Download,
  Printer,
  Copy,
  Check,
  Calendar,
  Layers,
  Sparkles,
  Users,
  ShieldAlert,
  HeartHandshake,
  Award,
  BookOpen,
  FileCheck,
  CheckCircle2,
  Settings,
  ChevronRight,
  Eye,
  RefreshCw,
  Home,
  Info,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Student, 
  ViolationRecord, 
  CounselingService, 
  Counselor, 
  StudentAchievement,
  BidangBimbinganType,
  BKComponentType 
} from '../types';
import { 
  StudioPdfConfig, 
  StudioPdfTemplateType, 
  generateStudioPdf, 
  formatIndoDate 
} from '../utils/studioPdfGenerator';
import { getSchoolConfig } from '../utils/schoolConfig';
import { BK_COMPONENTS_DATA, BIDANG_BIMBINGAN_OPTIONS, getBKComponentForService } from '../utils/bkKomprehensif';
import { showToast } from '../utils/toast';
import KabupatenLogo from './KabupatenLogo';
import SchoolLogo from './SchoolLogo';

interface StudioPdfMakerViewProps {
  students: Student[];
  services: CounselingService[];
  violations: ViolationRecord[];
  achievements?: StudentAchievement[];
  homeVisits?: any[];
  activeCounselor: Counselor;
  allCounselors?: Counselor[];
  onNavigateToTab?: (tab: string) => void;
}

export default function StudioPdfMakerView({
  students,
  services,
  violations,
  achievements = [],
  homeVisits = [],
  activeCounselor,
  allCounselors = [],
  onNavigateToTab
}: StudioPdfMakerViewProps) {
  const schoolConfig = getSchoolConfig(activeCounselor?.schoolId);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  // Load Summons from localStorage
  const summons = useMemo(() => {
    try {
      const activeSchoolId = activeCounselor?.schoolId || 'sch_20320123';
      const stored = localStorage.getItem(`bk_summons_${activeSchoolId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, [activeCounselor]);

  // Main Studio Configuration State
  const [config, setConfig] = useState<StudioPdfConfig>(() => {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const isSemester1 = currentMonth >= 7 && currentMonth <= 12;
    const semesterLabel = isSemester1 ? 'Ganjil' : 'Genap';
    const academicYear = isSemester1 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

    return {
      templateId: 'jurnal-agenda',
      paperSize: 'A4',
      orientation: 'landscape',
      margin: 'standard',
      
      startDate: firstDayOfMonth,
      endDate: todayStr,
      dateRangeLabel: `Bulan ${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
      selectedClass: 'semua',
      selectedCounselorId: 'semua',
      selectedBidang: 'semua',
      selectedPilar: 'semua',
      selectedStatus: 'semua',
      
      showLetterhead: true,
      showDoubleLine: true,
      showDocumentNumber: true,
      customDocNumber: `421.3/BK-SMP/${currentYear}`,
      customDocTitle: 'REKAPITULASI AGENDA & JURNAL LAYANAN BK',
      customDocSubtitle: `Tahun Ajaran ${academicYear} (Semester ${semesterLabel})`,
      showExecutiveSummary: true,
      showAnalysisEvaluation: true,
      customEvaluationNotes: 
        `1. Pelaksanaan layanan bimbingan dan konseling berjalan sesuai dengan Program Kerja BK dan 4 Pilar Layanan Komprehensif.\n` +
        `2. Pembinaan preventif dan kuratif dikoordinasikan secara berkala dengan Wali Kelas dan Orang Tua/Wali Murid.\n` +
        `3. Rekomendasi tindak lanjut diarahkan pada pendampingan intensif siswa dengan tingkat pelanggaran sedang/tinggi serta penguatan potensi bakat minat.`,
      showStudentNisn: true,
      showProblemDescription: true,
      showFollowUpRtl: true,
      showSignatures: true,
      
      titimangsaCity: 'Susukan',
      titimangsaDate: formatIndoDate(todayStr),
      headmasterName: schoolConfig.principalName || 'Drs. H. Sukardi, M.Pd.',
      headmasterNip: schoolConfig.principalNip || 'NIP. 19680512 199412 1 001',
      headmasterTitle: 'Mengetahui,\nKepala Sekolah',
      counselorName: activeCounselor.name || 'Aulia Aji Sasongko, S.Pd.',
      counselorNip: activeCounselor.nip && activeCounselor.nip !== '-' ? activeCounselor.nip : 'NIP. 19931231 202221 1 002',
      counselorTitle: 'Guru Pembimbing BK / Koordinator',
      
      primaryColorHex: '#00685f'
    };
  });

  // Active Tab for Control Panel
  const [activeSettingsTab, setActiveSettingsTab] = useState<'template' | 'filter' | 'layout' | 'signatures'>('template');
  const [copiedText, setCopiedText] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Derive unique classes from student dataset
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.class) set.add(s.class.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [students]);

  // Handle Preset Time Ranges
  const handleApplyDatePreset = (preset: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_semester' | 'this_year') => {
    const curr = new Date();
    if (preset === 'today') {
      const d = curr.toISOString().split('T')[0];
      setConfig(prev => ({
        ...prev,
        startDate: d,
        endDate: d,
        dateRangeLabel: `Hari Ini (${formatIndoDate(d)})`
      }));
    } else if (preset === 'this_week') {
      const first = curr.getDate() - curr.getDay() + 1; // Monday
      const monday = new Date(curr.setDate(first)).toISOString().split('T')[0];
      setConfig(prev => ({
        ...prev,
        startDate: monday,
        endDate: todayStr,
        dateRangeLabel: `Minggu Ini (${formatIndoDate(monday)} s.d. ${formatIndoDate(todayStr)})`
      }));
    } else if (preset === 'this_month') {
      setConfig(prev => ({
        ...prev,
        startDate: firstDayOfMonth,
        endDate: todayStr,
        dateRangeLabel: `Bulan ${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`
      }));
    } else if (preset === 'last_month') {
      const prevMonthFirst = new Date(curr.getFullYear(), curr.getMonth() - 1, 1).toISOString().split('T')[0];
      const prevMonthLast = new Date(curr.getFullYear(), curr.getMonth(), 0).toISOString().split('T')[0];
      const monthName = new Date(curr.getFullYear(), curr.getMonth() - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      setConfig(prev => ({
        ...prev,
        startDate: prevMonthFirst,
        endDate: prevMonthLast,
        dateRangeLabel: `Bulan Lalu (${monthName})`
      }));
    } else if (preset === 'this_semester') {
      const month = curr.getMonth(); // 0-11
      const startM = month >= 6 ? 6 : 0;
      const semStart = new Date(curr.getFullYear(), startM, 1).toISOString().split('T')[0];
      const semLabel = month >= 6 ? 'Semester Ganjil' : 'Semester Genap';
      setConfig(prev => ({
        ...prev,
        startDate: semStart,
        endDate: todayStr,
        dateRangeLabel: `${semLabel} ${curr.getFullYear()}`
      }));
    } else if (preset === 'this_year') {
      const yearStart = `${curr.getFullYear()}-01-01`;
      setConfig(prev => ({
        ...prev,
        startDate: yearStart,
        endDate: todayStr,
        dateRangeLabel: `Tahun Kalender ${curr.getFullYear()}`
      }));
    }
  };

  // Handle Template Selection & Automatic Setup of Title/Orientation/Evaluation Notes
  const handleSelectTemplate = (templateId: StudioPdfTemplateType) => {
    let customDocTitle = '';
    let customDocSubtitle = '';
    let customEvaluationNotes = '';
    let orientation: 'portrait' | 'landscape' = 'landscape';
    
    switch (templateId) {
      case 'jurnal-agenda':
        customDocTitle = 'REKAPITULASI AGENDA & JURNAL LAYANAN BK';
        customDocSubtitle = 'Tahun Ajaran 2025/2026 (Semester Genap)';
        customEvaluationNotes = `1. Seluruh sesi layanan bimbingan individual, kelompok, dan bimbingan klasikal terlaksana sesuai RPLBK terprogram.\n2. Rencana tindak lanjut layanan difokuskan pada pemantauan berkala hasil konseling dan koordinasi berlanjut bersama Wali Kelas.`;
        orientation = 'landscape';
        break;
      case 'rekap-bidang-pilar':
        customDocTitle = 'REKAPITULASI 4 BIDANG & 4 PILAR LAYANAN BK KOMPREHENSIF';
        customDocSubtitle = 'Pemetaan Beban Kerja Berdasarkan Standar POP BK Kemendikbudristek';
        customEvaluationNotes = `1. Distribusi layanan mencakup Bidang Pribadi, Sosial, Belajar, dan Karir secara proporsional dan akuntabel.\n2. Komponen Layanan Dasar dan Layanan Responsif mendominasi kebutuhan bimbingan siswa pada periode ini.`;
        orientation = 'landscape';
        break;
      case 'register-kasus':
        customDocTitle = 'BUKU REGISTER PELANGGARAN & PENANGANAN DISIPLIN SISWA';
        customDocSubtitle = 'Rekapitulasi Catatan Ketertiban & Rekam Jejak Pembinaan Disiplin Siswa';
        customEvaluationNotes = `1. Kasus pelanggaran tata tertib didominasi oleh kedisiplinan waktu kehadiran dan kelengkapan atribut sekolah.\n2. Pembinaan preventif dan konseling individual telah diberikan secara kolaboratif bersama Wali Kelas dan Guru Piket.`;
        orientation = 'landscape';
        break;
      case 'rekap-homevisit-panggilan':
        customDocTitle = 'REKAPITULASI KUNJUNGAN RUMAH & PEMANGGILAN ORANG TUA';
        customDocSubtitle = 'Dokumentasi Kolaborasi Tri Pusat Pendidikan & Penanganan Kasus Siswa';
        customEvaluationNotes = `1. Kunjungan rumah (Home Visit) dan pemanggilan orang tua terlaksana dengan kesepakatan tertulis yang transparan.\n2. Pemantauan perkembangan komitmen belajar dan perilaku siswa di rumah terus dipantau secara berkesinambungan.`;
        orientation = 'portrait';
        break;
      case 'rekap-prestasi':
        customDocTitle = 'BUKU CATATAN PRESTASI & APRESIASI SISWA';
        customDocSubtitle = 'Rekapitulasi Kejuaraan, Capaian Bakat Minat & Poin Penghargaan Positif';
        customEvaluationNotes = `1. Pencapaian prestasi akademik dan non-akademik siswa mengalami peningkatan positif pada periode ini.\n2. Pemberian poin reward positif terbukti efektif memotivasi iklim kompetisi sehat dan penguatan karakter terpuji.`;
        orientation = 'portrait';
        break;
      case 'laporan-periodik':
        customDocTitle = 'LAPORAN PERIODIK EVALUASI & AKUNTABILITAS BIMBINGAN KONSELING';
        customDocSubtitle = 'Laporan Akuntabilitas Kinerja Guru BK Kepada Kepala Sekolah & Pengawas';
        customEvaluationNotes = `1. Program BK Komprehensif berjalan efektif dengan tingkat ketercapaian program di atas target yang ditetapkan.\n2. Layanan kolaboratif dengan orang tua, wali kelas, dan penanganan disiplin terintegrasi dengan harmonis.`;
        orientation = 'portrait';
        break;
      case 'matriks-kustom':
        customDocTitle = 'MATRIKS REKAPITULASI DATA SISWA BINAAN BK';
        customDocSubtitle = 'Peta Profil Peserta Didik, Riwayat Layanan, dan Indeks Kedisiplinan';
        customEvaluationNotes = `1. Peta pembinaan siswa binaan terkelola dengan database poin ketertiban dan histori layanan yang transparan.\n2. Siswa dalam kategori perhatian khusus telah terjadwal untuk sesi konseling berkala.`;
        orientation = 'portrait';
        break;
    }

    setConfig(prev => ({
      ...prev,
      templateId,
      customDocTitle,
      customDocSubtitle,
      customEvaluationNotes,
      orientation
    }));
  };

  // Filtered dataset for live preview
  const previewServices = useMemo(() => {
    return services.filter(s => {
      if (config.startDate && s.date < config.startDate) return false;
      if (config.endDate && s.date > config.endDate) return false;
      if (config.selectedStatus !== 'semua' && s.status !== config.selectedStatus) return false;
      if (config.selectedBidang !== 'semua') {
        const sBidang = s.bidangBimbingan || s.specificDetails?.bidangBimbingan || 'Pribadi';
        if (sBidang !== config.selectedBidang) return false;
      }
      if (config.selectedPilar !== 'semua') {
        const pilar = s.bkComponent || getBKComponentForService(s.serviceType);
        if (pilar !== config.selectedPilar) return false;
      }
      if (config.selectedClass !== 'semua') {
        const hasClass = s.students.some(st => (st.class || '').trim().toUpperCase() === config.selectedClass.trim().toUpperCase());
        if (!hasClass) return false;
      }
      if (config.selectedCounselorId !== 'semua' && s.counselorId && s.counselorId !== config.selectedCounselorId) {
        return false;
      }
      return true;
    });
  }, [services, config]);

  const previewViolations = useMemo(() => {
    return violations.filter(v => {
      if (config.startDate && v.date < config.startDate) return false;
      if (config.endDate && v.date > config.endDate) return false;
      if (config.selectedClass !== 'semua' && (v.studentClass || '').trim().toUpperCase() !== config.selectedClass.trim().toUpperCase()) {
        return false;
      }
      if (config.selectedStatus !== 'semua') {
        if (config.selectedStatus === 'Selesai' && v.handledBy === 'Belum Ditangani') return false;
        if (config.selectedStatus === 'Terjadwal' && v.handledBy !== 'Belum Ditangani') return false;
      }
      return true;
    });
  }, [violations, config]);

  const previewAchievements = useMemo(() => {
    return (achievements || []).filter(a => {
      if (config.startDate && a.date < config.startDate) return false;
      if (config.endDate && a.date > config.endDate) return false;
      if (config.selectedClass !== 'semua' && (a.studentClass || '').trim().toUpperCase() !== config.selectedClass.trim().toUpperCase()) {
        return false;
      }
      return true;
    });
  }, [achievements, config]);

  const previewHomeVisits = useMemo(() => {
    return (homeVisits || []).filter(h => {
      if (config.startDate && h.date < config.startDate) return false;
      if (config.endDate && h.date > config.endDate) return false;
      if (config.selectedClass !== 'semua' && (h.studentClass || '').trim().toUpperCase() !== config.selectedClass.trim().toUpperCase()) {
        return false;
      }
      return true;
    });
  }, [homeVisits, config]);

  const previewSummons = useMemo(() => {
    return (summons || []).filter((s: any) => {
      const sDate = s.date || s.summonDate;
      if (config.startDate && sDate && sDate < config.startDate) return false;
      if (config.endDate && sDate && sDate > config.endDate) return false;
      if (config.selectedClass !== 'semua' && (s.studentClass || '').trim().toUpperCase() !== config.selectedClass.trim().toUpperCase()) {
        return false;
      }
      return true;
    });
  }, [summons, config]);

  const previewCombinedHomeVisitPanggilan = useMemo(() => {
    return [
      ...previewHomeVisits.map(h => ({
        type: 'Home Visit',
        date: h.date,
        time: h.time || '10:00',
        studentName: h.studentName,
        studentClass: h.studentClass,
        targetPerson: h.parentName || 'Orang Tua / Wali',
        address: h.address || '-',
        reason: h.reason || h.background || '-',
        result: h.result || h.agreement || '-',
        officer: h.counselorName || 'Guru BK'
      })),
      ...previewSummons.map(s => ({
        type: 'Panggilan Ortu',
        date: s.date || s.summonDate,
        time: s.time || s.summonTime || '09:00',
        studentName: s.studentName,
        studentClass: s.studentClass,
        targetPerson: s.parentName || 'Orang Tua / Wali',
        address: 'Ruang BK',
        reason: s.agenda || s.customAgenda || '-',
        result: s.attendanceDetails?.counselingSummary || s.status || 'Terkirim',
        officer: s.counselorName || 'Guru BK'
      }))
    ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [previewHomeVisits, previewSummons]);

  // Execute PDF Download
  const handleDownloadPdf = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        generateStudioPdf(config, {
          students,
          services,
          violations,
          achievements,
          homeVisits,
          summons,
          allCounselors,
          activeCounselor
        }, { download: true });
      } catch (err) {
        console.error('Error generating Studio PDF:', err);
        showToast('Gagal memproses dokumen PDF. Periksa konfigurasi data.', 'error');
      } finally {
        setIsGenerating(false);
      }
    }, 150);
  };

  // Print Document directly via PDF Window
  const handlePrintPdf = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const doc = generateStudioPdf(config, {
          students,
          services,
          violations,
          achievements,
          homeVisits,
          summons,
          allCounselors,
          activeCounselor
        }, { download: false });

        const blobUrl = doc.output('bloburl');
        const printWindow = window.open(blobUrl, '_blank');
        if (printWindow) {
          printWindow.focus();
        } else {
          doc.autoPrint();
          doc.output('dataurlnewwindow');
        }
      } catch (err) {
        console.error('Print error:', err);
        showToast('Gagal membuka jendela cetak.', 'error');
      } finally {
        setIsGenerating(false);
      }
    }, 150);
  };

  // Copy Summary text for WhatsApp/Official Message
  const handleCopyTextSummary = () => {
    const text = 
      `*LAPORAN ADMINISTRASI BIMBINGAN & KONSELING*\n` +
      `*${schoolConfig.schoolName}*\n` +
      `-----------------------------------------\n` +
      `📄 Dokumen: ${config.customDocTitle}\n` +
      `📅 Periode: ${config.dateRangeLabel || `${config.startDate} s.d. ${config.endDate}`}\n` +
      `👥 Sasaran Kelas: ${config.selectedClass === 'semua' ? 'Semua Kelas' : config.selectedClass}\n` +
      `-----------------------------------------\n` +
      `📊 *RINGKASAN DATA:*\n` +
      `• Total Sesi Layanan BK: ${previewServices.length} Sesi\n` +
      `• Catatan Kasus/Pelanggaran: ${previewViolations.length} Kasus\n` +
      `• Kunjungan Rumah (Home Visit): ${previewHomeVisits.length} Kali\n` +
      `• Catatan Prestasi Siswa: ${previewAchievements.length} Siswa\n` +
      `-----------------------------------------\n` +
      `Koordinator BK: ${config.counselorName}\n` +
      `NIP. ${config.counselorNip}\n` +
      `Dibuat melalui SIKAP-BK Studio PDF Maker`;

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    showToast('📋 Ringkasan laporan dinas berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopiedText(false), 3000);
  };

  const templatesList: { id: StudioPdfTemplateType; title: string; desc: string; icon: any; badge: string }[] = [
    {
      id: 'jurnal-agenda',
      title: 'Buku Agenda & Jurnal Layanan',
      desc: 'Format Buku Agenda Kerja BK Resmi (Klasikal, Kelompok, Individual, Bimbingan)',
      icon: BookOpen,
      badge: 'Format SOP Dinas'
    },
    {
      id: 'rekap-bidang-pilar',
      title: 'Rekap 4 Bidang & 4 Pilar BK',
      desc: 'Matriks komprehensif Pribadi, Sosial, Belajar, Karir x Layanan Dasar, Responsif, Peminatan',
      icon: Layers,
      badge: 'Kurikulum Merdeka'
    },
    {
      id: 'register-kasus',
      title: 'Buku Register Pelanggaran Siswa',
      desc: 'Rekapitulasi catatan kasus tata tertib, pembinaan, wali kelas & bobot poin',
      icon: ShieldAlert,
      badge: 'Kedisiplinan'
    },
    {
      id: 'rekap-homevisit-panggilan',
      title: 'Rekap Home Visit & Panggilan Ortu',
      desc: 'Agenda terpadu kunjungan ke rumah wali dan hasil berita acara temu ortu',
      icon: Home,
      badge: 'Kolaborasi Wali'
    },
    {
      id: 'rekap-prestasi',
      title: 'Buku Prestasi & Apresiasi Siswa',
      desc: 'Rekam jejak penghargaan, kejuaraan, dan bobot reward positif peserta didik',
      icon: Award,
      badge: 'Apresiasi'
    },
    {
      id: 'laporan-periodik',
      title: 'Laporan Periodik Komprehensif',
      desc: 'Laporan bulanan / semesteran lengkap dengan analisis capaian & tindak lanjut',
      icon: FileCheck,
      badge: 'Akuntabilitas'
    },
    {
      id: 'matriks-kustom',
      title: 'Matriks Data Siswa Binaan',
      desc: 'Daftar nama siswa lengkap dengan NISN, status poin, dan frekuensi bimbingan',
      icon: Users,
      badge: 'Data Induk'
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#00685f] to-[#0b1c30] text-white p-6 sm:p-7 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white/5 skew-x-12 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-xs rounded-full text-xs font-bold text-teal-100 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Studio PDF Maker Standar Dinas Pendidikan</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Studio Pembuat Dokumen Rekap PDF
            </h1>
            <p className="text-sm text-teal-100/90 font-medium max-w-2xl mt-1 leading-relaxed">
              Sesuaikan kop dinas, ukuran kertas (A4 / F4 Folio), filter bidang bimbingan, 
              kolom tabel, dan lembar pengesahan resmi secara fleksibel, rapi, dan presisi.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleCopyTextSummary}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer backdrop-blur-xs active:scale-97"
              title="Salin ringkasan pesan WA"
            >
              {copiedText ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copiedText ? 'Tersalin' : 'Salin Pesan'}</span>
            </button>

            <button
              onClick={handlePrintPdf}
              disabled={isGenerating}
              className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer backdrop-blur-xs active:scale-97 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="px-5 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-[#0b1c30] rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-97 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Unduh Dokumen PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Left Control Panel & Right Live Preview Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Controls & Settings (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-xs overflow-hidden">
          
          {/* Settings Sub-Tab Navigation */}
          <div className="flex border-b border-gray-100 bg-[#f8faf9] p-1.5 gap-1 overflow-x-auto">
            {[
              { id: 'template', label: '1. Template', icon: BookOpen },
              { id: 'filter', label: '2. Filter Data', icon: Sliders },
              { id: 'layout', label: '3. Tata Letak', icon: Layers },
              { id: 'signatures', label: '4. Pengesahan', icon: FileCheck },
            ].map(tab => {
              const isActive = activeSettingsTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSettingsTab(tab.id as any)}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-[#00685f] shadow-xs border border-gray-200/60'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Settings Tab Content */}
          <div className="p-4 sm:p-5 space-y-4 max-h-[680px] overflow-y-auto custom-scrollbar">
            
            {/* TAB 1: TEMPLATE SELECTION */}
            {activeSettingsTab === 'template' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-extrabold text-[#0b1c30] uppercase tracking-wider block mb-2">
                    Pilih Format Dokumen Standar Dinas:
                  </label>
                  <div className="space-y-2">
                    {templatesList.map(tmpl => {
                      const isSelected = config.templateId === tmpl.id;
                      const Icon = tmpl.icon;
                      return (
                        <div
                          key={tmpl.id}
                          onClick={() => handleSelectTemplate(tmpl.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                            isSelected
                              ? 'bg-teal-50/70 border-[#00685f] ring-2 ring-[#00685f]/20 shadow-xs'
                              : 'bg-white border-gray-200/80 hover:border-gray-300 hover:bg-gray-50/50'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-[#00685f] text-white' : 'bg-gray-100 text-gray-600'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-[#0b1c30]">{tmpl.title}</h4>
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-[#00685f]/15 text-[#00685f]' : 'bg-gray-100 text-gray-500'}`}>
                                  {tmpl.badge}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{tmpl.desc}</p>
                            </div>
                          </div>
                          <div className="shrink-0 pt-0.5">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#00685f] bg-[#00685f] text-white' : 'border-gray-300'}`}>
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Title & Subtitle */}
                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Judul Utama Dokumen
                    </label>
                    <input
                      type="text"
                      value={config.customDocTitle}
                      onChange={e => setConfig(prev => ({ ...prev, customDocTitle: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Sub-Judul / Tahun Ajaran
                    </label>
                    <input
                      type="text"
                      value={config.customDocSubtitle}
                      onChange={e => setConfig(prev => ({ ...prev, customDocSubtitle: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Nomor Dokumen Administrasi
                    </label>
                    <input
                      type="text"
                      value={config.customDocNumber}
                      onChange={e => setConfig(prev => ({ ...prev, customDocNumber: e.target.value }))}
                      placeholder="Contoh: 421.3/BK-SMP/2026"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-700 focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: FILTER & PERIODE */}
            {activeSettingsTab === 'filter' && (
              <div className="space-y-4">
                {/* Date Quick Presets */}
                <div>
                  <label className="text-xs font-extrabold text-[#0b1c30] uppercase tracking-wider block mb-1.5">
                    Preset Waktu Cepat
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'today', label: 'Hari Ini' },
                      { id: 'this_week', label: 'Minggu Ini' },
                      { id: 'this_month', label: 'Bulan Ini' },
                      { id: 'last_month', label: 'Bulan Lalu' },
                      { id: 'this_semester', label: 'Semester Ini' },
                      { id: 'this_year', label: 'Tahun Ini' },
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleApplyDatePreset(p.id as any)}
                        className="py-1.5 px-2 bg-gray-100 hover:bg-[#00685f]/10 hover:text-[#00685f] rounded-lg text-[11px] font-bold text-gray-700 transition-colors cursor-pointer text-center"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Pickers */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Dari Tanggal</label>
                    <input
                      type="date"
                      value={config.startDate}
                      onChange={e => setConfig(prev => ({ ...prev, startDate: e.target.value, dateRangeLabel: '' }))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Sampai Tanggal</label>
                    <input
                      type="date"
                      value={config.endDate}
                      onChange={e => setConfig(prev => ({ ...prev, endDate: e.target.value, dateRangeLabel: '' }))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                    />
                  </div>
                </div>

                {/* Filter Kelas */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Filter Kelas Sasaran</label>
                  <select
                    value={config.selectedClass}
                    onChange={e => setConfig(prev => ({ ...prev, selectedClass: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                  >
                    <option value="semua">Semua Kelas (Seluruh Siswa)</option>
                    {availableClasses.map(c => (
                      <option key={c} value={c}>Kelas {c}</option>
                    ))}
                  </select>
                </div>

                {/* Filter 4 Bidang Bimbingan */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Filter 4 Bidang Bimbingan</label>
                  <select
                    value={config.selectedBidang}
                    onChange={e => setConfig(prev => ({ ...prev, selectedBidang: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                  >
                    <option value="semua">Semua Bidang Bimbingan</option>
                    {BIDANG_BIMBINGAN_OPTIONS.map(b => (
                      <option key={b.value} value={b.value}>Bidang {b.label}</option>
                    ))}
                  </select>
                </div>

                {/* Filter 4 Pilar Komponen BK */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Filter 4 Pilar Komponen BK</label>
                  <select
                    value={config.selectedPilar}
                    onChange={e => setConfig(prev => ({ ...prev, selectedPilar: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                  >
                    <option value="semua">Semua 4 Pilar Komponen</option>
                    {BK_COMPONENTS_DATA.map(p => (
                      <option key={p.id} value={p.id}>Pilar {p.pilarNumber}: {p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Filter Guru BK */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Filter Guru Pembimbing BK</label>
                  <select
                    value={config.selectedCounselorId}
                    onChange={e => setConfig(prev => ({ ...prev, selectedCounselorId: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                  >
                    <option value="semua">Semua Guru Pembimbing BK</option>
                    {(allCounselors.length > 0 ? allCounselors : [activeCounselor]).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.role || 'Guru BK'})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* TAB 3: TATA LETAK & KERTAS */}
            {activeSettingsTab === 'layout' && (
              <div className="space-y-4">
                {/* Paper Size & Orientation */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Ukuran Kertas</label>
                    <select
                      value={config.paperSize}
                      onChange={e => setConfig(prev => ({ ...prev, paperSize: e.target.value as any }))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                    >
                      <option value="A4">A4 (210 x 297 mm)</option>
                      <option value="F4">F4 / Folio (215 x 330 mm)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Orientasi</label>
                    <select
                      value={config.orientation}
                      onChange={e => setConfig(prev => ({ ...prev, orientation: e.target.value as any }))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                    >
                      <option value="portrait">Portrait (Tegak)</option>
                      <option value="landscape">Landscape (Mendatar)</option>
                    </select>
                  </div>
                </div>

                {/* Margin */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Margin Dokumen</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'compact', label: 'Rapat (10mm)' },
                      { id: 'standard', label: 'Standar (15mm)' },
                      { id: 'spacious', label: 'Lebar (20mm)' },
                    ].map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, margin: m.id as any }))}
                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          config.margin === m.id
                            ? 'bg-[#00685f] text-white shadow-xs'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggleable Sections */}
                <div className="pt-2 border-t border-gray-100 space-y-2.5">
                  <label className="text-xs font-extrabold text-[#0b1c30] uppercase tracking-wider block">
                    Elemen Dokumen Kedinasan
                  </label>

                  {[
                    { key: 'showLetterhead', label: 'Kop Surat Dinas Resmi (Logo & Alamat)' },
                    { key: 'showDoubleLine', label: 'Garis Ganda Kop (Tebal & Tipis Dinas)' },
                    { key: 'showDocumentNumber', label: 'Nomor Dokumen Administrasi' },
                    { key: 'showExecutiveSummary', label: 'Kotak Ikhtisar & Statistik Ringkas' },
                    { key: 'showAnalysisEvaluation', label: 'Bagian Analisis, Evaluasi & Rencana Tindak Lanjut' },
                    { key: 'showSignatures', label: 'Lembar Tanda Tangan Mengetahui Kepala Sekolah' },
                  ].map(item => {
                    const isChecked = (config as any)[item.key];
                    return (
                      <label key={item.key} className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => setConfig(prev => ({ ...prev, [item.key]: e.target.checked }))}
                          className="w-4 h-4 rounded text-[#00685f] focus:ring-[#00685f]"
                        />
                        <span className="text-xs font-semibold text-gray-700">{item.label}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Custom Evaluation Notes */}
                {config.showAnalysisEvaluation && (
                  <div className="pt-2 border-t border-gray-100">
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Catatan Evaluasi & RTL Kustom
                    </label>
                    <textarea
                      rows={3}
                      value={config.customEvaluationNotes}
                      onChange={e => setConfig(prev => ({ ...prev, customEvaluationNotes: e.target.value }))}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-normal text-gray-800 focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PENGESAHAN & TANDA TANGAN */}
            {activeSettingsTab === 'signatures' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                  <span className="text-[11px] font-extrabold text-gray-700 uppercase">Titimangsa & Pejabat Penandatangan</span>
                  <button
                    type="button"
                    onClick={() => {
                      const sc = getSchoolConfig();
                      setConfig(prev => ({
                        ...prev,
                        titimangsaCity: sc.schoolAddress?.includes('Semarang') ? 'Susukan' : 'Kota / Kabupaten',
                        titimangsaDate: formatIndoDate(new Date().toISOString().split('T')[0]),
                        headmasterName: sc.principalName,
                        headmasterNip: sc.principalNip.startsWith('NIP') ? sc.principalNip : `NIP. ${sc.principalNip}`,
                        counselorName: activeCounselor.name,
                        counselorNip: activeCounselor.nip.startsWith('NIP') ? activeCounselor.nip : `NIP. ${activeCounselor.nip}`,
                      }));
                      showToast('Data penandatangan disinkronkan dengan data sistem.', 'success');
                    }}
                    className="text-[10px] font-bold text-[#00685f] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sinkronkan Identitas</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Kota Titimangsa</label>
                    <input
                      type="text"
                      value={config.titimangsaCity}
                      onChange={e => setConfig(prev => ({ ...prev, titimangsaCity: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Tanggal Titimangsa</label>
                    <input
                      type="text"
                      value={config.titimangsaDate}
                      onChange={e => setConfig(prev => ({ ...prev, titimangsaDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Headmaster Data */}
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2">
                  <span className="text-[11px] font-extrabold text-[#00685f] uppercase block">
                    1. Pejabat Mengetahui (Kepala Sekolah)
                  </span>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">Jabatan / Baris Judul</label>
                    <input
                      type="text"
                      value={config.headmasterTitle}
                      onChange={e => setConfig(prev => ({ ...prev, headmasterTitle: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold"
                      placeholder="Mengetahui, Kepala Sekolah"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">Nama Kepala Sekolah</label>
                    <input
                      type="text"
                      value={config.headmasterName}
                      onChange={e => setConfig(prev => ({ ...prev, headmasterName: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">NIP Kepala Sekolah</label>
                    <input
                      type="text"
                      value={config.headmasterNip}
                      onChange={e => setConfig(prev => ({ ...prev, headmasterNip: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Counselor Data */}
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2">
                  <span className="text-[11px] font-extrabold text-[#00685f] uppercase block">
                    2. Guru Pembimbing BK
                  </span>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">Jabatan / Baris Judul</label>
                    <input
                      type="text"
                      value={config.counselorTitle}
                      onChange={e => setConfig(prev => ({ ...prev, counselorTitle: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold"
                      placeholder="Guru Pembimbing BK / Koordinator"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">Nama Guru BK</label>
                    <input
                      type="text"
                      value={config.counselorName}
                      onChange={e => setConfig(prev => ({ ...prev, counselorName: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">NIP Guru BK</label>
                    <input
                      type="text"
                      value={config.counselorNip}
                      onChange={e => setConfig(prev => ({ ...prev, counselorNip: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Quick Action Footer in Control Panel */}
          <div className="p-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-gray-500">
              {config.paperSize} • {config.orientation === 'landscape' ? 'Landscape' : 'Portrait'}
            </span>
            <button
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-97 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh PDF Sekarang</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Interactive Document Preview (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#00685f]" />
              <h3 className="text-sm font-black text-[#0b1c30]">
                Live Document Preview (Pratonton Standar Dinas)
              </h3>
            </div>
            <span className="text-[11px] font-extrabold px-2.5 py-0.5 bg-teal-50 text-[#00685f] rounded-full border border-teal-200/50">
              {config.paperSize} Kedinasan
            </span>
          </div>

          {/* Realistic Paper Simulation Box */}
          <div className="bg-[#525659] p-4 sm:p-6 rounded-2xl shadow-inner overflow-x-auto">
            <div 
              className={`bg-white text-[#0b1c30] mx-auto shadow-2xl p-6 sm:p-8 rounded-xs transition-all duration-300 ${
                config.orientation === 'landscape' ? 'max-w-[840px] min-h-[540px]' : 'max-w-[560px] min-h-[700px]'
              }`}
              style={{ fontFamily: 'Times New Roman, serif' }}
            >
              {/* KOP SURAT DINAS SIMULATION WITH LOGOS */}
              {config.showLetterhead && (
                <div className="border-b-2 border-black pb-2 mb-4 relative">
                  <div className="flex items-center justify-between gap-2 sm:gap-4">
                    {/* Left: Logo Kabupaten */}
                    <div className="w-12 sm:w-16 shrink-0 flex items-center justify-center">
                      <KabupatenLogo size={50} className="shadow-xs bg-white border border-gray-100" />
                    </div>

                    {/* Center: Kop Text */}
                    <div className="flex-1 text-center min-w-0">
                      <div className="text-[9.5px] sm:text-[11px] font-bold tracking-wide uppercase leading-tight text-gray-800">
                        {schoolConfig.governmentName}
                      </div>
                      <div className="text-[9.5px] sm:text-[11px] font-bold tracking-wide uppercase leading-tight text-gray-800">
                        {schoolConfig.departmentName}
                      </div>
                      <div className="text-xs sm:text-base font-black tracking-wider uppercase leading-tight text-[#00685f] my-0.5">
                        {schoolConfig.schoolName}
                      </div>
                      <div className="text-[8.5px] sm:text-[9.5px] font-normal text-gray-600 leading-tight">
                        {schoolConfig.schoolAddress}
                      </div>
                    </div>

                    {/* Right: Logo Sekolah */}
                    <div className="w-12 sm:w-16 shrink-0 flex items-center justify-center">
                      <SchoolLogo size={50} className="shadow-xs" />
                    </div>
                  </div>

                  {config.showDoubleLine && (
                    <div className="mt-2 pt-[1px] border-b border-black" />
                  )}
                </div>
              )}

              {/* DOCUMENT TITLE */}
              <div className="text-center my-3">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#0b1c30]">
                  {config.customDocTitle}
                </h2>
                {config.customDocSubtitle && (
                  <p className="text-[10px] font-bold text-[#00685f] mt-0.5">
                    {config.customDocSubtitle}
                  </p>
                )}
                <div className="text-[9px] font-sans text-gray-600 mt-1 flex items-center justify-center gap-2 flex-wrap">
                  {config.showDocumentNumber && config.customDocNumber && (
                    <span>No: {config.customDocNumber}</span>
                  )}
                  <span>•</span>
                  <span>{config.dateRangeLabel || `Periode: ${config.startDate} s.d. ${config.endDate}`}</span>
                  <span>•</span>
                  <span>Kelas: {config.selectedClass === 'semua' ? 'Semua Kelas' : config.selectedClass}</span>
                </div>
              </div>

              {/* EXECUTIVE SUMMARY BOX */}
              {config.showExecutiveSummary && (
                <div className="my-3 p-2.5 bg-gray-50 border border-gray-300 rounded text-[9px] font-sans">
                  <div className="font-bold text-[#00685f] mb-1.5 uppercase tracking-wider">
                    Ikhtisar Eksekutif Pelaksanaan BK:
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-1 bg-white border border-gray-200 rounded">
                      <div className="text-[8px] text-gray-500">Layanan BK</div>
                      <div className="font-bold text-xs text-[#00685f]">{previewServices.length} Sesi</div>
                    </div>
                    <div className="p-1 bg-white border border-gray-200 rounded">
                      <div className="text-[8px] text-gray-500">Kasus / Disiplin</div>
                      <div className="font-bold text-xs text-rose-600">{previewViolations.length} Kasus</div>
                    </div>
                    <div className="p-1 bg-white border border-gray-200 rounded">
                      <div className="text-[8px] text-gray-500">Home Visit</div>
                      <div className="font-bold text-xs text-amber-600">{previewHomeVisits.length} Kali</div>
                    </div>
                    <div className="p-1 bg-white border border-gray-200 rounded">
                      <div className="text-[8px] text-gray-500">Prestasi</div>
                      <div className="font-bold text-xs text-purple-600">{previewAchievements.length} Siswa</div>
                    </div>
                  </div>
                </div>
              )}

              {/* DEDICATED TABLE SIMULATION PER TEMPLATE */}
              <div className="my-3 overflow-x-auto">
                {/* 1. JURNAL & AGENDA HARIAN BK */}
                {config.templateId === 'jurnal-agenda' && (
                  <table className="w-full border-collapse border border-gray-400 text-[8.5px] font-sans">
                    <thead>
                      <tr className="bg-[#00685f] text-white font-bold">
                        <th className="border border-gray-400 p-1 text-center w-6">No</th>
                        <th className="border border-gray-400 p-1 text-left">Tanggal & Jam</th>
                        <th className="border border-gray-400 p-1 text-left">Nama Siswa / Sasaran</th>
                        <th className="border border-gray-400 p-1 text-center">Kelas</th>
                        <th className="border border-gray-400 p-1 text-left">Bidang & Jenis Layanan</th>
                        <th className="border border-gray-400 p-1 text-left">Masalah / Topik Bimbingan</th>
                        <th className="border border-gray-400 p-1 text-left">Hasil & Rencana Tindak Lanjut (RTL)</th>
                        <th className="border border-gray-400 p-1 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewServices.slice(0, 8).map((srv, idx) => (
                        <tr key={srv.id} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="border border-gray-300 p-1 text-center">{idx + 1}</td>
                          <td className="border border-gray-300 p-1 whitespace-nowrap">{srv.date}<br/><span className="text-gray-500 text-[7.5px]">{srv.startTime || '08:00'}</span></td>
                          <td className="border border-gray-300 p-1 font-semibold">{srv.students.map(st => st.name).join(', ')}</td>
                          <td className="border border-gray-300 p-1 text-center">{srv.students[0]?.class || '-'}</td>
                          <td className="border border-gray-300 p-1">
                            <span className="font-bold text-[#00685f]">[{srv.bidangBimbingan || 'Pribadi'}]</span><br/>{srv.serviceType}
                          </td>
                          <td className="border border-gray-300 p-1 text-gray-700 truncate max-w-[120px]">{srv.problem || '-'}</td>
                          <td className="border border-gray-300 p-1 text-gray-700 truncate max-w-[120px]">{srv.followUp || srv.output || '-'}</td>
                          <td className="border border-gray-300 p-1 text-center font-bold text-emerald-700">{srv.status}</td>
                        </tr>
                      ))}
                      {previewServices.length === 0 && (
                        <tr>
                          <td colSpan={8} className="border border-gray-300 p-3 text-center text-gray-400 italic">
                            Tidak ada catatan agenda layanan BK pada filter yang dipilih.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* 2. REKAPITULASI 4 BIDANG & 4 PILAR POP BK */}
                {config.templateId === 'rekap-bidang-pilar' && (
                  <div className="space-y-3">
                    <div className="font-bold text-[9px] text-[#00685f] uppercase tracking-wider">
                      Matriks Distribusi 4 Bidang x 4 Komponen Pilar BK (POP BK):
                    </div>
                    <table className="w-full border-collapse border border-gray-400 text-[8.5px] font-sans">
                      <thead>
                        <tr className="bg-[#00685f] text-white font-bold">
                          <th className="border border-gray-400 p-1 text-left">4 Komponen Pilar Layanan</th>
                          <th className="border border-gray-400 p-1 text-center">Bidang Pribadi</th>
                          <th className="border border-gray-400 p-1 text-center">Bidang Sosial</th>
                          <th className="border border-gray-400 p-1 text-center">Bidang Belajar</th>
                          <th className="border border-gray-400 p-1 text-center">Bidang Karir</th>
                          <th className="border border-gray-400 p-1 text-center font-bold">Total Sesi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { id: 'layanan_dasar', name: '1. Layanan Dasar' },
                          { id: 'layanan_responsif', name: '2. Layanan Responsif' },
                          { id: 'perencanaan_individual', name: '3. Perencanaan Individual' },
                          { id: 'dukungan_sistem', name: '4. Dukungan Sistem' },
                        ].map((pilar, pIdx) => {
                          const pServices = previewServices.filter(srvItem => (srvItem.bkComponent || getBKComponentForService(srvItem.serviceType)) === pilar.id);
                          const countPribadi = pServices.filter(srvItem => (srvItem.bidangBimbingan || 'Pribadi') === 'Pribadi').length;
                          const countSosial = pServices.filter(srvItem => (srvItem.bidangBimbingan || '') === 'Sosial').length;
                          const countBelajar = pServices.filter(srvItem => (srvItem.bidangBimbingan || '') === 'Belajar').length;
                          const countKarir = pServices.filter(srvItem => (srvItem.bidangBimbingan || '') === 'Karir' || (srvItem.bidangBimbingan || '') === 'Karier').length;
                          return (
                            <tr key={pilar.id} className={pIdx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                              <td className="border border-gray-300 p-1 font-semibold">{pilar.name}</td>
                              <td className="border border-gray-300 p-1 text-center">{countPribadi}</td>
                              <td className="border border-gray-300 p-1 text-center">{countSosial}</td>
                              <td className="border border-gray-300 p-1 text-center">{countBelajar}</td>
                              <td className="border border-gray-300 p-1 text-center">{countKarir}</td>
                              <td className="border border-gray-300 p-1 text-center font-bold text-[#00685f]">{pServices.length}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 3. REGISTER PELANGGARAN & DISIPLIN */}
                {config.templateId === 'register-kasus' && (
                  <table className="w-full border-collapse border border-gray-400 text-[8.5px] font-sans">
                    <thead>
                      <tr className="bg-[#00685f] text-white font-bold">
                        <th className="border border-gray-400 p-1 text-center w-6">No</th>
                        <th className="border border-gray-400 p-1 text-left">Tanggal</th>
                        <th className="border border-gray-400 p-1 text-left">Nama Siswa</th>
                        <th className="border border-gray-400 p-1 text-center">Kelas</th>
                        <th className="border border-gray-400 p-1 text-left">Bentuk Pelanggaran Tata Tertib</th>
                        <th className="border border-gray-400 p-1 text-center">Poin (+)</th>
                        <th className="border border-gray-400 p-1 text-left">Guru / Pelapor</th>
                        <th className="border border-gray-400 p-1 text-left">Sanksi / Pembinaan</th>
                        <th className="border border-gray-400 p-1 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewViolations.slice(0, 8).map((v, idx) => (
                        <tr key={v.id} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="border border-gray-300 p-1 text-center">{idx + 1}</td>
                          <td className="border border-gray-300 p-1 whitespace-nowrap">{v.date}</td>
                          <td className="border border-gray-300 p-1 font-semibold">{v.studentName}</td>
                          <td className="border border-gray-300 p-1 text-center">{v.studentClass}</td>
                          <td className="border border-gray-300 p-1 font-medium text-rose-700">{v.category}</td>
                          <td className="border border-gray-300 p-1 text-center font-bold text-rose-600">+{v.pointsAdded}</td>
                          <td className="border border-gray-300 p-1 text-gray-700">{v.reportedBy || 'Guru Piket'}</td>
                          <td className="border border-gray-300 p-1 text-gray-700 truncate max-w-[110px]">{v.handlingProgress || v.notes || 'Pembinaan BK'}</td>
                          <td className="border border-gray-300 p-1 text-center font-semibold text-emerald-700">
                            {v.handledBy !== 'Belum Ditangani' ? 'Ditangani' : 'Menunggu'}
                          </td>
                        </tr>
                      ))}
                      {previewViolations.length === 0 && (
                        <tr>
                          <td colSpan={9} className="border border-gray-300 p-3 text-center text-gray-400 italic">
                            Tidak ada data register pelanggaran siswa pada filter yang dipilih.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* 4. REKAP HOME VISIT & PANGGILAN ORANG TUA */}
                {config.templateId === 'rekap-homevisit-panggilan' && (
                  <table className="w-full border-collapse border border-gray-400 text-[8.5px] font-sans">
                    <thead>
                      <tr className="bg-[#00685f] text-white font-bold">
                        <th className="border border-gray-400 p-1 text-center w-6">No</th>
                        <th className="border border-gray-400 p-1 text-left">Jenis Agenda</th>
                        <th className="border border-gray-400 p-1 text-left">Tanggal & Jam</th>
                        <th className="border border-gray-400 p-1 text-left">Nama Siswa</th>
                        <th className="border border-gray-400 p-1 text-center">Kelas</th>
                        <th className="border border-gray-400 p-1 text-left">Orang Tua / Sasaran</th>
                        <th className="border border-gray-400 p-1 text-left">Tujuan & Pokok Masalah</th>
                        <th className="border border-gray-400 p-1 text-left">Hasil Temu & Kesepakatan RTL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewCombinedHomeVisitPanggilan.slice(0, 8).map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="border border-gray-300 p-1 text-center">{idx + 1}</td>
                          <td className="border border-gray-300 p-1 font-bold">
                            <span className={item.type === 'Home Visit' ? 'text-amber-700' : 'text-[#00685f]'}>
                              {item.type}
                            </span>
                          </td>
                          <td className="border border-gray-300 p-1 whitespace-nowrap">{item.date}<br/><span className="text-gray-500 text-[7.5px]">{item.time}</span></td>
                          <td className="border border-gray-300 p-1 font-semibold">{item.studentName}</td>
                          <td className="border border-gray-300 p-1 text-center">{item.studentClass}</td>
                          <td className="border border-gray-300 p-1">{item.targetPerson}</td>
                          <td className="border border-gray-300 p-1 text-gray-700 truncate max-w-[120px]">{item.reason}</td>
                          <td className="border border-gray-300 p-1 text-gray-700 truncate max-w-[120px]">{item.result}</td>
                        </tr>
                      ))}
                      {previewCombinedHomeVisitPanggilan.length === 0 && (
                        <tr>
                          <td colSpan={8} className="border border-gray-300 p-3 text-center text-gray-400 italic">
                            Tidak ada catatan Kunjungan Rumah maupun Panggilan Orang Tua pada filter ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* 5. REKAP APRESIASI & PRESTASI SISWA */}
                {config.templateId === 'rekap-prestasi' && (
                  <table className="w-full border-collapse border border-gray-400 text-[8.5px] font-sans">
                    <thead>
                      <tr className="bg-[#00685f] text-white font-bold">
                        <th className="border border-gray-400 p-1 text-center w-6">No</th>
                        <th className="border border-gray-400 p-1 text-left">Tanggal</th>
                        <th className="border border-gray-400 p-1 text-left">Nama Siswa</th>
                        <th className="border border-gray-400 p-1 text-center">Kelas</th>
                        <th className="border border-gray-400 p-1 text-left">Nama Kejuaraan / Prestasi Positif</th>
                        <th className="border border-gray-400 p-1 text-left">Kategori</th>
                        <th className="border border-gray-400 p-1 text-center">Reward Poin</th>
                        <th className="border border-gray-400 p-1 text-left">Pencatat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewAchievements.slice(0, 8).map((a, idx) => (
                        <tr key={a.id} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="border border-gray-300 p-1 text-center">{idx + 1}</td>
                          <td className="border border-gray-300 p-1 whitespace-nowrap">{a.date}</td>
                          <td className="border border-gray-300 p-1 font-semibold">{a.studentName}</td>
                          <td className="border border-gray-300 p-1 text-center">{a.studentClass}</td>
                          <td className="border border-gray-300 p-1 font-semibold text-[#00685f]">{a.achievementName}</td>
                          <td className="border border-gray-300 p-1 text-gray-600">{a.category || 'Prestasi'}</td>
                          <td className="border border-gray-300 p-1 text-center font-bold text-emerald-600">+{a.pointsReward}</td>
                          <td className="border border-gray-300 p-1 text-gray-700">{a.recordedBy || 'Guru BK'}</td>
                        </tr>
                      ))}
                      {previewAchievements.length === 0 && (
                        <tr>
                          <td colSpan={8} className="border border-gray-300 p-3 text-center text-gray-400 italic">
                            Tidak ada catatan prestasi/apresiasi siswa pada filter yang dipilih.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* 6. LAPORAN PERIODIK KOMPREHENSIF */}
                {config.templateId === 'laporan-periodik' && (
                  <div className="space-y-4">
                    <div>
                      <div className="font-bold text-[9px] text-[#00685f] mb-1 uppercase tracking-wider">
                        A. Rekapitulasi Sesi Layanan BK ({previewServices.length} Sesi):
                      </div>
                      <table className="w-full border-collapse border border-gray-400 text-[8px] font-sans">
                        <thead>
                          <tr className="bg-[#00685f] text-white font-bold">
                            <th className="border border-gray-400 p-0.5 text-center w-5">No</th>
                            <th className="border border-gray-400 p-0.5 text-left">Tanggal</th>
                            <th className="border border-gray-400 p-0.5 text-left">Nama Siswa</th>
                            <th className="border border-gray-400 p-0.5 text-center">Kelas</th>
                            <th className="border border-gray-400 p-0.5 text-left">Bidang / Jenis Layanan</th>
                            <th className="border border-gray-400 p-0.5 text-left">Masalah & RTL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewServices.slice(0, 4).map((srvItem, idx) => (
                            <tr key={srvItem.id} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                              <td className="border border-gray-300 p-0.5 text-center">{idx + 1}</td>
                              <td className="border border-gray-300 p-0.5">{srvItem.date}</td>
                              <td className="border border-gray-300 p-0.5 font-semibold">{srvItem.students.map(st => st.name).join(', ')}</td>
                              <td className="border border-gray-300 p-0.5 text-center">{srvItem.students[0]?.class || '-'}</td>
                              <td className="border border-gray-300 p-0.5">[{srvItem.bidangBimbingan || 'Pribadi'}] {srvItem.serviceType}</td>
                              <td className="border border-gray-300 p-0.5 text-gray-700 truncate max-w-[120px]">{srvItem.problem || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <div className="font-bold text-[9px] text-rose-700 mb-1 uppercase tracking-wider">
                        B. Rekapitulasi Pelanggaran & Disiplin Siswa ({previewViolations.length} Kasus):
                      </div>
                      <table className="w-full border-collapse border border-gray-400 text-[8px] font-sans">
                        <thead>
                          <tr className="bg-rose-800 text-white font-bold">
                            <th className="border border-gray-400 p-0.5 text-center w-5">No</th>
                            <th className="border border-gray-400 p-0.5 text-left">Tanggal</th>
                            <th className="border border-gray-400 p-0.5 text-left">Nama Siswa</th>
                            <th className="border border-gray-400 p-0.5 text-center">Kelas</th>
                            <th className="border border-gray-400 p-0.5 text-left">Bentuk Pelanggaran</th>
                            <th className="border border-gray-400 p-0.5 text-center">Poin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewViolations.slice(0, 4).map((v, idx) => (
                            <tr key={v.id} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                              <td className="border border-gray-300 p-0.5 text-center">{idx + 1}</td>
                              <td className="border border-gray-300 p-0.5">{v.date}</td>
                              <td className="border border-gray-300 p-0.5 font-semibold">{v.studentName}</td>
                              <td className="border border-gray-300 p-0.5 text-center">{v.studentClass}</td>
                              <td className="border border-gray-300 p-0.5 text-rose-700 font-medium">{v.category}</td>
                              <td className="border border-gray-300 p-0.5 text-center font-bold text-rose-600">+{v.pointsAdded}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 7. MATRIKS REKAP KUSTOM */}
                {config.templateId === 'matriks-kustom' && (
                  <table className="w-full border-collapse border border-gray-400 text-[8.5px] font-sans">
                    <thead>
                      <tr className="bg-[#00685f] text-white font-bold">
                        <th className="border border-gray-400 p-1 text-center w-6">No</th>
                        <th className="border border-gray-400 p-1 text-left">NIS/NISN</th>
                        <th className="border border-gray-400 p-1 text-left">Nama Siswa</th>
                        <th className="border border-gray-400 p-1 text-center">Kelas</th>
                        <th className="border border-gray-400 p-1 text-center">L/P</th>
                        <th className="border border-gray-400 p-1 text-center">Poin Pelanggaran</th>
                        <th className="border border-gray-400 p-1 text-center">Sesi Layanan BK</th>
                        <th className="border border-gray-400 p-1 text-center">Status Binaan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.slice(0, 8).map((st, idx) => {
                        const vPoints = previewViolations
                          .filter(v => v.studentId === st.id || v.studentName === st.name)
                          .reduce((sum, v) => sum + (v.pointsAdded || 0), 0);
                        const sCount = previewServices.filter(srvItem => srvItem.students.some(sSt => sSt.id === st.id || sSt.name === st.name)).length;
                        return (
                          <tr key={st.id} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 p-1 text-center">{idx + 1}</td>
                            <td className="border border-gray-300 p-1 font-mono text-[7.5px]">{st.nisn || st.nis || '-'}</td>
                            <td className="border border-gray-300 p-1 font-semibold">{st.name}</td>
                            <td className="border border-gray-300 p-1 text-center">{st.class}</td>
                            <td className="border border-gray-300 p-1 text-center">{st.gender || '-'}</td>
                            <td className="border border-gray-300 p-1 text-center font-bold text-rose-600">{vPoints}</td>
                            <td className="border border-gray-300 p-1 text-center font-bold text-[#00685f]">{sCount} kali</td>
                            <td className="border border-gray-300 p-1 text-center font-semibold">
                              {vPoints > 50 ? (
                                <span className="text-red-700 bg-red-50 px-1 rounded">Perhatian Khusus</span>
                              ) : (
                                <span className="text-emerald-700">Terbina Baik</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                <p className="text-[8px] font-sans text-gray-400 italic text-right mt-1.5">
                  * Pratinjau interaktif disesuaikan dengan template standar dinas. File PDF hasil unduhan memuat seluruh data lengkap.
                </p>
              </div>

              {/* EVALUATION & RTL SECTION */}
              {config.showAnalysisEvaluation && (
                <div className="my-3 p-2 bg-gray-50/80 border border-gray-200 rounded text-[8.5px] font-sans">
                  <div className="font-bold text-[#00685f] mb-1">Evaluasi & Rencana Tindak Lanjut (RTL):</div>
                  <div className="text-gray-700 whitespace-pre-line leading-relaxed">
                    {config.customEvaluationNotes}
                  </div>
                </div>
              )}

              {/* SIGNATURE SECTION - PARALLEL & SYMMETRIC */}
              {config.showSignatures && (
                <div className="mt-6 pt-2 font-sans text-[9px] grid grid-cols-2 text-center items-start">
                  {/* Left Column: Kepala Sekolah */}
                  <div className="flex flex-col items-center justify-between min-h-[130px]">
                    <div className="w-full">
                      <div className="text-gray-700 font-semibold leading-tight">Mengetahui,</div>
                      <div className="font-bold text-gray-800 whitespace-pre-line leading-tight mt-0.5">
                        {config.headmasterTitle ? config.headmasterTitle.replace(/^Mengetahui,?\s*/i, '').trim() || 'Kepala Sekolah' : 'Kepala Sekolah'}
                      </div>
                    </div>
                    <div className="w-full pt-10">
                      <div className="font-bold text-[#0b1c30] underline leading-tight">
                        {config.headmasterName || schoolConfig.principalName}
                      </div>
                      <div className="text-gray-600 font-mono text-[8.5px] mt-0.5">
                        {config.headmasterNip ? (config.headmasterNip.startsWith('NIP') ? config.headmasterNip : `NIP. ${config.headmasterNip}`) : `NIP. ${schoolConfig.principalNip}`}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Guru Pembimbing BK */}
                  <div className="flex flex-col items-center justify-between min-h-[130px]">
                    <div className="w-full">
                      <div className="text-gray-700 leading-tight">
                        {config.titimangsaCity || 'Susukan'}, {config.titimangsaDate || formatIndoDate(new Date().toISOString().split('T')[0])}
                      </div>
                      <div className="font-bold text-gray-800 whitespace-pre-line leading-tight mt-0.5">
                        {config.counselorTitle || 'Guru Pembimbing BK / Koordinator'}
                      </div>
                    </div>
                    <div className="w-full pt-10">
                      <div className="font-bold text-[#0b1c30] underline leading-tight">
                        {config.counselorName || activeCounselor.name}
                      </div>
                      <div className="text-gray-600 font-mono text-[8.5px] mt-0.5">
                        {config.counselorNip ? (config.counselorNip.startsWith('NIP') ? config.counselorNip : `NIP. ${config.counselorNip}`) : `NIP. ${activeCounselor.nip}`}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
