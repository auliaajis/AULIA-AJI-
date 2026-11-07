import { useState, useMemo } from 'react';
import {
  FileBarChart,
  Calendar,
  Filter,
  Download,
  Printer,
  Copy,
  Check,
  Search,
  Users,
  AlertTriangle,
  HeartHandshake,
  CheckCircle2,
  Clock,
  Brain,
  Mail,
  Home,
  Sparkles,
  ChevronRight,
  BarChart3,
  TrendingUp,
  FileSpreadsheet,
  Award,
  BookOpen,
  Layers,
  Target,
  ShieldAlert,
  Settings
} from 'lucide-react';
import { Student, ViolationRecord, CounselingService, Counselor, StudentAchievement, BKComponentType } from '../types';
import { 
  downloadPeriodicReportPDF, 
  downloadRekapHomeVisitPDF, 
  downloadRekapPelanggaranPDF, 
  downloadRekapLayananPDF, 
  downloadRekapSiswaKritisPDF 
} from '../utils/pdfGenerator';
import { loadSchoolData } from '../utils/schoolConfig';
import { BK_COMPONENTS_DATA, getBKComponentForService, getComponentColorConfig, getPilarBadge } from '../utils/bkKomprehensif';
import BehavioralDiagnosisModal from './BehavioralDiagnosisModal';
import EmailNotificationModal from './EmailNotificationModal';
import PageHeaderBanner from './PageHeaderBanner';
import { RiwayatLayananView } from './RiwayatLayananView';
import RekapSemesterView from './RekapSemesterView';

interface LaporanRekapViewProps {
  students: Student[];
  services: CounselingService[];
  violations: ViolationRecord[];
  achievements?: StudentAchievement[];
  homeVisits?: any[];
  activeCounselor: Counselor;
  onNavigateToForm?: (form: string, studentId?: string) => void;
  onNavigateToStudioPdf?: () => void;
}

export default function LaporanRekapView({
  students,
  services,
  violations,
  achievements = [],
  homeVisits = [],
  activeCounselor,
  onNavigateToForm,
  onNavigateToStudioPdf
}: LaporanRekapViewProps) {
  // Date filters - default to current month range
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedClass, setSelectedClass] = useState<string>('semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'ringkasan' | 'siswa-kritis' | 'riwayat-konseling' | 'pelanggaran-alpa' | 'home-visit' | 'rekap-semester'>('ringkasan');

  // Copy text state
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Modals
  const [diagnosisStudentData, setDiagnosisStudentData] = useState<{
    name: string;
    class: string;
    nis?: string;
    netPoints: number;
    alpaCount: number;
  } | null>(null);
  const [emailModalData, setEmailModalData] = useState<any | null>(null);

  // Class options derived from students list
  const availableClasses = useMemo(() => {
    const classesSet = new Set<string>();
    students.forEach((s) => {
      if (s.class) classesSet.add(s.class.trim().toUpperCase());
    });
    return Array.from(classesSet).sort();
  }, [students]);

  // Preset Date Handlers
  const handleSetPreset = (preset: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_semester' | 'this_year') => {
    const curr = new Date();
    if (preset === 'today') {
      const d = curr.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'this_week') {
      const first = curr.getDate() - curr.getDay() + 1; // Monday
      const monday = new Date(curr.setDate(first)).toISOString().split('T')[0];
      setStartDate(monday);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      setStartDate(firstDayOfMonth);
      setEndDate(todayStr);
    } else if (preset === 'last_month') {
      const prevMonthFirst = new Date(curr.getFullYear(), curr.getMonth() - 1, 1).toISOString().split('T')[0];
      const prevMonthLast = new Date(curr.getFullYear(), curr.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(prevMonthFirst);
      setEndDate(prevMonthLast);
    } else if (preset === 'this_semester') {
      // Semester 1 (Jul-Dec) or Semester 2 (Jan-Jun)
      const month = curr.getMonth(); // 0-11
      const startM = month >= 6 ? 6 : 0;
      const semStart = new Date(curr.getFullYear(), startM, 1).toISOString().split('T')[0];
      setStartDate(semStart);
      setEndDate(todayStr);
    } else if (preset === 'this_year') {
      const yearStart = `${curr.getFullYear()}-01-01`;
      setStartDate(yearStart);
      setEndDate(todayStr);
    }
  };

  // Helper date checker
  const isDateInPeriod = (dateString?: string) => {
    if (!dateString) return false;
    // Format YYYY-MM-DD comparison
    const target = dateString.substring(0, 10);
    return target >= startDate && target <= endDate;
  };

  // 1. Filtered Services in Period
  const periodServices = useMemo(() => {
    return services.filter((srv) => {
      const matchesDate = isDateInPeriod(srv.date);
      const matchesClass =
        selectedClass === 'semua' ||
        srv.students.some((st) => st.class.toUpperCase() === selectedClass.toUpperCase());
      const matchesSearch =
        !searchTerm ||
        String(srv.problem || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(srv.serviceType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        srv.students.some((st) => st && String(st.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesDate && matchesClass && matchesSearch;
    });
  }, [services, startDate, endDate, selectedClass, searchTerm]);

  // 2. Filtered Violations in Period
  const periodViolations = useMemo(() => {
    return violations.filter((v) => {
      const matchesDate = isDateInPeriod(v.date);
      const matchesClass = selectedClass === 'semua' || v.studentClass.toUpperCase() === selectedClass.toUpperCase();
      const matchesSearch =
        !searchTerm ||
        v.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.category.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesDate && matchesClass && matchesSearch;
    });
  }, [violations, startDate, endDate, selectedClass, searchTerm]);

  // 3. Filtered Home Visits in Period
  const periodHomeVisits = useMemo(() => {
    return homeVisits.filter((h) => {
      const matchesDate = isDateInPeriod(h.date);
      const matchesClass = selectedClass === 'semua' || (h.studentClass && h.studentClass.toUpperCase() === selectedClass.toUpperCase());
      return matchesDate && matchesClass;
    });
  }, [homeVisits, startDate, endDate, selectedClass]);

  // 4. Critical & High Attention Students (Filtered by Class & Period records or overall high points)
  const criticalStudentsList = useMemo(() => {
    // Fetch all historical attendance logs using loadSchoolData to calculate cumulative total Alfa from the beginning
    const allAttendanceHistory: any[] = loadSchoolData<any[]>('bk_attendance_history', [], activeCounselor?.schoolId);

    return students
      .filter((st) => {
        const matchesClass = selectedClass === 'semua' || st.class.toUpperCase() === selectedClass.toUpperCase();
        if (!matchesClass) return false;

        const netPoints = Math.max(0, st.violationPoints - (st.achievementPoints || 0));

        // Calculate cumulative Alfa from beginning of attendance records
        const alfaDates = new Set<string>();
        allAttendanceHistory.forEach((attRec: any) => {
          if (Array.isArray(attRec.records)) {
            attRec.records.forEach((r: any) => {
              const matchId = r.studentId === st.id;
              const matchName = r.studentName && st.name && r.studentName.trim().toLowerCase() === st.name.trim().toLowerCase();
              if ((matchId || matchName) && r.status === 'A') {
                alfaDates.add(attRec.date || `att-${Math.random()}`);
              }
            });
          }
        });

        // Also check all violations across all time for this student with category alpa/tanpa keterangan
        const allTimeStudentViolations = violations.filter(v => v.studentId === st.id || (v.studentName && v.studentName.trim().toLowerCase() === st.name.trim().toLowerCase()));
        allTimeStudentViolations.forEach((v: any) => {
          const cat = (v.category || '').toLowerCase();
          if (cat.includes('alpa') || cat.includes('tanpa keterangan') || cat.includes('mangkir') || cat.includes('bolos') || cat.includes('kehadiran')) {
            alfaDates.add(v.date || `viol-${v.id}`);
          }
        });

        const totalCumulativeAlfa = alfaDates.size;

        // Condition for Critical or High Attention:
        // Net points >= 20 OR cumulative total alpa >= 2 OR total violation points >= 20 OR has period violations
        const stPeriodViolations = periodViolations.filter((v) => v.studentId === st.id);
        const isHighRisk = netPoints >= 20 || totalCumulativeAlfa >= 2 || stPeriodViolations.length >= 1 || st.violationPoints >= 20;
        
        if (!isHighRisk) return false;

        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          return (
            String(st.name || '').toLowerCase().includes(q) ||
            String(st.class || '').toLowerCase().includes(q) ||
            String(st.nis ?? '').toLowerCase().includes(q)
          );
        }

        return true;
      })
      .map((st) => {
        const stPeriodViolations = periodViolations.filter((v) => v.studentId === st.id);
        const stPeriodServices = periodServices.filter((s) => s.students.some((pst) => pst.id === st.id));
        const netPoints = Math.max(0, st.violationPoints - (st.achievementPoints || 0));
        
        // Calculate cumulative Alfa from beginning of attendance records
        const alfaDates = new Set<string>();
        allAttendanceHistory.forEach((attRec: any) => {
          if (Array.isArray(attRec.records)) {
            attRec.records.forEach((r: any) => {
              const matchId = r.studentId === st.id;
              const matchName = r.studentName && st.name && r.studentName.trim().toLowerCase() === st.name.trim().toLowerCase();
              if ((matchId || matchName) && r.status === 'A') {
                alfaDates.add(attRec.date || `att-${Math.random()}`);
              }
            });
          }
        });

        const allTimeStudentViolations = violations.filter(v => v.studentId === st.id || (v.studentName && v.studentName.trim().toLowerCase() === st.name.trim().toLowerCase()));
        allTimeStudentViolations.forEach((v: any) => {
          const cat = (v.category || '').toLowerCase();
          if (cat.includes('alpa') || cat.includes('tanpa keterangan') || cat.includes('mangkir') || cat.includes('bolos') || cat.includes('kehadiran')) {
            alfaDates.add(v.date || `viol-${v.id}`);
          }
        });

        const totalCumulativeAlfa = alfaDates.size;

        let riskLevel: 'Kritis' | 'Tinggi' | 'Sedang' = 'Sedang';
        if (netPoints >= 50 || totalCumulativeAlfa >= 5) riskLevel = 'Kritis';
        else if (netPoints >= 25 || totalCumulativeAlfa >= 3) riskLevel = 'Tinggi';

        return {
          student: st,
          netPoints,
          alpaCount: totalCumulativeAlfa,
          riskLevel,
          periodViolationsCount: stPeriodViolations.length,
          periodServicesCount: stPeriodServices.length,
          latestViolation: stPeriodViolations[0]?.category || (allTimeStudentViolations[0]?.category || '-')
        };
      })
      .sort((a, b) => b.netPoints - a.netPoints);
  }, [students, periodViolations, periodServices, violations, selectedClass, searchTerm]);

  // Statistical Summaries for Executive Summary
  const stats = useMemo(() => {
    const totalServices = periodServices.length;
    const completedServices = periodServices.filter((s) => s.status === 'Selesai').length;
    const scheduledServices = periodServices.filter((s) => s.status === 'Terjadwal').length;

    const totalViolationsCount = periodViolations.length;
    const totalViolationPoints = periodViolations.reduce((sum, v) => sum + (v.pointsAdded || 0), 0);

    const individualCount = periodServices.filter((s) => s.serviceType.toLowerCase().includes('individual') || s.targetType === 'Individu').length;
    const groupCount = periodServices.filter((s) => s.serviceType.toLowerCase().includes('kelompok') || s.targetType === 'Kelompok').length;
    const classicalCount = periodServices.filter((s) => s.serviceType.toLowerCase().includes('klasikal') || s.targetType === 'Klasikal').length;

    // 4 Pillars of Comprehensive BK aggregation
    const pilarStats = BK_COMPONENTS_DATA.map((comp) => {
      const pilarServices = periodServices.filter(
        (s) => (s.bkComponent || getBKComponentForService(s.serviceType)) === comp.id
      );
      return {
        ...comp,
        count: pilarServices.length,
        percentage: totalServices > 0 ? Math.round((pilarServices.length / totalServices) * 100) : 0,
        completedCount: pilarServices.filter((s) => s.status === 'Selesai').length,
      };
    });

    const totalHomeVisitsCount = periodHomeVisits.length;

    // Unique students served
    const uniqueStudentsServed = new Set<string>();
    periodServices.forEach((s) => {
      s.students.forEach((st) => uniqueStudentsServed.add(st.id));
    });

    return {
      totalServices,
      completedServices,
      scheduledServices,
      totalViolationsCount,
      totalViolationPoints,
      individualCount,
      groupCount,
      classicalCount,
      pilarStats,
      totalHomeVisitsCount,
      uniqueStudentsCount: uniqueStudentsServed.size,
      criticalStudentsCount: criticalStudentsList.length
    };
  }, [periodServices, periodViolations, periodHomeVisits, criticalStudentsList]);

  // Formatted date string for display
  const formattedDateRange = useMemo(() => {
    const formatIndo = (dStr: string) => {
      if (!dStr) return '';
      const [y, m, d] = dStr.split('-');
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
    };

    return `${formatIndo(startDate)} s.d. ${formatIndo(endDate)}`;
  }, [startDate, endDate]);

  // PDF Export Trigger
  const handleExportPDF = () => {
    if (activeTab === 'home-visit') {
      downloadRekapHomeVisitPDF({
        startDate,
        endDate,
        selectedClass,
        homeVisits: periodHomeVisits,
        activeCounselor
      });
    } else if (activeTab === 'pelanggaran-alpa') {
      downloadRekapPelanggaranPDF({
        startDate,
        endDate,
        selectedClass,
        violations: periodViolations,
        activeCounselor
      });
    } else if (activeTab === 'riwayat-konseling') {
      downloadRekapLayananPDF({
        startDate,
        endDate,
        selectedClass,
        services: periodServices,
        activeCounselor
      });
    } else if (activeTab === 'siswa-kritis') {
      downloadRekapSiswaKritisPDF({
        startDate,
        endDate,
        selectedClass,
        criticalStudentsList,
        activeCounselor
      });
    } else {
      downloadPeriodicReportPDF({
        startDate,
        endDate,
        selectedClass,
        periodServices,
        periodViolations,
        criticalStudentsList,
        stats,
        activeCounselor
      });
    }
  };

  // Copy Plain Text Report for WhatsApp/Official Email
  const handleCopyTextReport = () => {
    const text = `*LAPORAN REKAPITULASI BIMBINGAN KONSELING (BK)*
Periode: ${formattedDateRange}
Kelas: ${selectedClass === 'semua' ? 'Semua Kelas' : selectedClass}
Guru Pembimbing: ${activeCounselor.name} (${activeCounselor.role})

📊 *RINGKASAN STATISTIK*:
• Total Sesi Konseling: ${stats.totalServices} Sesi (${stats.completedServices} Selesai, ${stats.scheduledServices} Terjadwal)
• Siswa Terlayani: ${stats.uniqueStudentsCount} Orang
• Sesi Individual: ${stats.individualCount} | Kelompok: ${stats.groupCount} | Klasikal: ${stats.classicalCount}
• Total Catatan Pelanggaran: ${stats.totalViolationsCount} Kasus (Total Bobot: ${stats.totalViolationPoints})
• Kunjungan Rumah (Home Visit): ${stats.totalHomeVisitsCount} Kali
• Siswa Status Kritis/Perhatian Khusus: ${stats.criticalStudentsCount} Orang

⚠️ *DAFTAR SISWA MEMERLUKAN PERHATIAN KHUSUS/KRITIS*:
${
  criticalStudentsList.length === 0
    ? '- Tidak ada siswa yang mencapai ambang batas kritis pada periode ini.'
    : criticalStudentsList
        .slice(0, 10)
        .map(
          (item, idx) =>
            `${idx + 1}. ${item.student.name} (${item.student.class}) - Bobot Net: ${item.netPoints} | Status Risiko: ${item.riskLevel}`
        )
        .join('\n')
}

📝 *RINGKASAN SESI KONSELING TERBARU*:
${
  periodServices.length === 0
    ? '- Belum ada rekam konseling pada periode ini.'
    : periodServices
        .slice(0, 5)
        .map(
          (srv, idx) =>
            `${idx + 1}. [${srv.date}] ${srv.students.map((s) => `${s.name} (${s.class})`).join(', ')} - Tipe: ${srv.serviceType} | Topik: ${srv.problem}`
        )
        .join('\n')
}

Laporan lengkap dapat diunduh melalui sistem Aplikasi BK Sekolah.`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // CSV Export Trigger
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `LAPORAN REKAP PERIODE BK (${formattedDateRange})\n\n`;
    csvContent += 'NO,TANGGAL,TIPE LAYANAN,NAMA SISWA,KELAS,TOPIK / PERMASALAHAN,STATUS,DESKRIPSI\n';

    periodServices.forEach((srv, index) => {
      const studentNames = srv.students.map((s) => `${s.name}`).join('; ');
      const studentClasses = srv.students.map((s) => `${s.class}`).join('; ');
      const desc = (srv.description || '').replace(/"/g, '""');
      const prob = (srv.problem || '').replace(/"/g, '""');

      csvContent += `"${index + 1}","${srv.date}","${srv.serviceType}","${studentNames}","${studentClasses}","${prob}","${srv.status}","${desc}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Rekap_BK_${startDate}_s.d_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-[100px]">
      {/* Top Header Title & Actions */}
      <PageHeaderBanner
        category="Laporan & Pengaturan"
        title="Rekap Laporan Konseling & Kedisiplinan"
        description={`Analisis terintegrasi periode ${formattedDateRange} untuk pelaporan evaluasi berkala, rapat dewan guru, dan pengawasan dinas.`}
        icon={<FileBarChart className="w-5 h-5" />}
        badge="Modul Resmi Dinas"
        workflowHint="1. Tentukan Rentang Periode / Preset Cepat › 2. Pilih Tab Kategori Data › 3. Salin Ringkasan atau Cetak PDF Resmi"
        stats={[
          { label: 'Sesi Layanan', value: stats.totalServices },
          { label: 'Siswa Terlayani', value: stats.uniqueStudentsCount },
          { label: 'Total Pelanggaran', value: stats.totalViolationsCount },
          { label: 'Siswa Kritis', value: stats.criticalStudentsCount, color: stats.criticalStudentsCount > 0 ? 'text-rose-600' : 'text-emerald-700' }
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('rekap-semester')}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-black transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-97 ${
                activeTab === 'rekap-semester'
                  ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-500'
                  : 'bg-gradient-to-r from-teal-700 to-[#00685f] hover:from-teal-800 hover:to-[#005049] text-white'
              }`}
              title="Buat rekapitulasi otomatis per semester (Ganjil/Genap)"
            >
              <Calendar className="w-4 h-4 text-amber-300" />
              <span>Rekap Semester</span>
              <span className="px-1.5 py-0.5 text-[9px] bg-amber-400 text-amber-950 font-black rounded-full">Baru</span>
            </button>

            {onNavigateToStudioPdf && (
              <button
                onClick={onNavigateToStudioPdf}
                className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-97"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>Studio PDF Maker</span>
              </button>
            )}

            <button
              onClick={handleCopyTextReport}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
              title="Salin ringkasan ke format teks WhatsApp"
            >
              {copiedSummary ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSummary ? 'Tersalin!' : 'Salin Text'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-200"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-97"
              title="Unduh dokumen PDF standar sesuai modul rekapitulasi yang aktif"
            >
              <Printer className="w-4 h-4" />
              <span>
                {activeTab === 'home-visit' && 'Cetak Rekap Home Visit'}
                {activeTab === 'pelanggaran-alpa' && 'Cetak Rekap Pelanggaran'}
                {activeTab === 'riwayat-konseling' && 'Cetak Rekap Layanan BK'}
                {activeTab === 'siswa-kritis' && 'Cetak Rekap Siswa Kritis'}
                {activeTab === 'ringkasan' && 'Cetak Laporan Lengkap'}
              </span>
            </button>
          </div>
        }
      />

      {/* Feature Banner: Studio PDF Maker Recommendation */}
      {onNavigateToStudioPdf && (
        <div className="bg-gradient-to-r from-teal-900 via-[#00685f] to-teal-800 text-white p-4 sm:p-5 rounded-2xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black">Butuh Rekap PDF Format Resmi Standar Dinas?</h4>
                <span className="px-2 py-0.5 bg-amber-400 text-amber-950 text-[10px] font-extrabold rounded-full">Baru</span>
              </div>
              <p className="text-xs text-teal-100 mt-0.5 max-w-2xl font-medium">
                Gunakan <strong>Studio PDF Maker</strong> untuk kustomisasi ukuran kertas (A4/F4), kop surat dinas ganda, nomor dokumen, filter 4 bidang & 4 pilar, serta lembar pengesahan kepala sekolah.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToStudioPdf}
            className="px-4 py-2 bg-white hover:bg-teal-50 text-[#00685f] rounded-xl text-xs font-black shadow-xs whitespace-nowrap transition-all cursor-pointer active:scale-97 shrink-0"
          >
            Buka Studio PDF Maker &rarr;
          </button>
        </div>
      )}

      {/* Filter Toolbar: Date Range, Presets & Class Filter */}
      <div className="bg-white p-5 rounded-2xl border border-[#bcc9c6]/30 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#0b1c30]">
            <Filter className="w-4 h-4 text-[#00685f]" />
            <span>Filter Rentang Waktu & Kelas</span>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Preset:</span>
            <button
              onClick={() => handleSetPreset('this_month')}
              className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-[#00685f] rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              Bulan Ini
            </button>
            <button
              onClick={() => handleSetPreset('last_month')}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              Bulan Lalu
            </button>
            <button
              onClick={() => handleSetPreset('this_semester')}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              Semester Ini
            </button>
            <button
              onClick={() => handleSetPreset('this_year')}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              Tahun Ini
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Start Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">
              Mulai Tanggal
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">
              Selesai Tanggal
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
              />
            </div>
          </div>

          {/* Class Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">
              Filter Kelas
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
            >
              <option value="semua">Semua Kelas</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Kelas {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Search Term */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">
              Cari Nama / Topik
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Kata kunci..."
                className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content View Switcher Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-gray-100 rounded-2xl border border-gray-200/80 w-fit flex-wrap">
        <button
          onClick={() => setActiveTab('ringkasan')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'ringkasan' ? 'bg-[#00685f] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Ringkasan Statistik</span>
        </button>

        <button
          onClick={() => setActiveTab('siswa-kritis')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'siswa-kritis' ? 'bg-[#00685f] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Daftar Siswa Perhatian Khusus / Kritis ({stats.criticalStudentsCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('riwayat-konseling')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'riwayat-konseling' ? 'bg-[#00685f] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          <span>Riwayat Layanan ({services.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pelanggaran-alpa')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'pelanggaran-alpa' ? 'bg-[#00685f] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Catatan Pelanggaran & Disiplin ({stats.totalViolationsCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('home-visit')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'home-visit' ? 'bg-[#00685f] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Rekap Home Visit ({periodHomeVisits.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rekap-semester')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'rekap-semester'
              ? 'bg-[#00685f] text-white shadow-sm'
              : 'text-[#00685f] bg-teal-50 hover:bg-teal-100 font-black'
          }`}
        >
          <Calendar className="w-4 h-4 text-amber-500" />
          <span>Rekap Semester</span>
          <span className="px-1.5 py-0.2 bg-amber-400 text-amber-950 text-[9px] font-black rounded-full">Baru</span>
        </button>
      </div>

      {/* SECTION 1: RINGKASAN STATISTIK & EKSEKUTIF */}
      {activeTab === 'ringkasan' && (
        <div className="space-y-6">
          {/* Summary KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Sesi Konseling */}
            <div className="bg-white p-5 rounded-2xl border border-[#bcc9c6]/30 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                  Total Sesi Layanan BK
                </span>
                <div className="p-2 bg-teal-50 rounded-xl text-[#00685f]">
                  <HeartHandshake className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-[#0b1c30] mt-2">{stats.totalServices}</p>
              <div className="mt-2 text-[11px] text-[#3d4947] font-semibold flex items-center gap-2">
                <span className="text-emerald-700 font-bold">{stats.completedServices} Selesai</span>
                <span>•</span>
                <span className="text-amber-700 font-bold">{stats.scheduledServices} Terjadwal</span>
              </div>
            </div>

            {/* Siswa Terlayani */}
            <div className="bg-white p-5 rounded-2xl border border-[#bcc9c6]/30 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                  Siswa Terlayani BK
                </span>
                <div className="p-2 bg-blue-50 rounded-xl text-blue-700">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-[#0b1c30] mt-2">{stats.uniqueStudentsCount}</p>
              <p className="text-[11px] text-[#3d4947] font-semibold mt-2">Siswa berbeda mendapatkan pendampingan</p>
            </div>

            {/* Siswa Status Kritis / Perhatian Khusus */}
            <div className="bg-white p-5 rounded-2xl border border-[#bcc9c6]/30 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">
                  Siswa Kritis / Perhatian
                </span>
                <div className="p-2 bg-amber-50 rounded-xl text-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-amber-900 mt-2">{stats.criticalStudentsCount}</p>
              <p className="text-[11px] text-[#3d4947] font-semibold mt-2">Diperlukan intervensi & panggil ortu</p>
            </div>

            {/* Total Pelanggaran Catatan */}
            <div className="bg-white p-5 rounded-2xl border border-[#bcc9c6]/30 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                  Catatan Pelanggaran
                </span>
                <div className="p-2 bg-red-50 rounded-xl text-red-700">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-[#0b1c30] mt-2">{stats.totalViolationsCount}</p>
              <p className="text-[11px] text-[#3d4947] font-semibold mt-2">
                Akumulasi {stats.totalViolationPoints} bobot pembinaan
              </p>
            </div>
          </div>

          {/* 4 Pillars of Comprehensive BK Section */}
          <div className="bg-white p-6 rounded-2xl border border-[#bcc9c6]/30 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#00685f]" />
                  <span>Rekapitulasi 4 Komponen BK Komprehensif (Kurikulum Merdeka)</span>
                </h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  Distribusi proporsi pelaksanaan layanan berdasarkan 4 pilar standar bimbingan dan konseling.
                </p>
              </div>
              <span className="text-[11px] font-extrabold text-[#00685f] bg-[#00685f]/10 px-3 py-1 rounded-full w-fit">
                Total {stats.totalServices} Layanan Terlaksana
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.pilarStats.map((pilar) => {
                const colorConfig = getComponentColorConfig(pilar.id);
                return (
                  <div
                    key={pilar.id}
                    className={`p-4 rounded-2xl border transition-all ${colorConfig.lightBg} ${colorConfig.border}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${colorConfig.text} bg-white/80 border ${colorConfig.border}`}>
                        Pilar {pilar.pilarNumber}
                      </span>
                      <span className={`text-xs font-black ${colorConfig.text}`}>
                        {pilar.percentage}%
                      </span>
                    </div>

                    <h4 className="font-black text-[#0b1c30] text-xs leading-snug mb-1">
                      {pilar.name}
                    </h4>
                    <p className="text-[10px] text-gray-600 line-clamp-2 mb-3">
                      {pilar.definition}
                    </p>

                    <div className="flex items-end justify-between pt-2 border-t border-gray-200/60">
                      <div>
                        <div className="text-xl font-black text-[#0b1c30]">
                          {pilar.count} <span className="text-[10px] font-bold text-gray-500">Sesi</span>
                        </div>
                        <div className="text-[9px] font-bold text-gray-500">
                          {pilar.completedCount} selesai
                        </div>
                      </div>
                      <div className="w-16 bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#00685f] h-full rounded-full transition-all duration-500"
                          style={{ width: `${pilar.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Breakdown Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Panel 1: Service Type Distribution */}
            <div className="bg-white p-6 rounded-2xl border border-[#bcc9c6]/30 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#00685f]" />
                  <span>Distribusi Jenis Layanan BK</span>
                </h3>
                <span className="text-xs text-gray-400 font-bold">Periode Terpilih</span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-[#0b1c30]">Konseling Individual</span>
                    <span className="text-[#00685f]">{stats.individualCount} Sesi</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#00685f] h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.totalServices > 0 ? (stats.individualCount / stats.totalServices) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-[#0b1c30]">Konseling Kelompok / Teman Sebaya</span>
                    <span className="text-blue-700">{stats.groupCount} Sesi</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.totalServices > 0 ? (stats.groupCount / stats.totalServices) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-[#0b1c30]">Bimbingan Klasikal / Lintas Kelas</span>
                    <span className="text-purple-700">{stats.classicalCount} Sesi</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-600 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.totalServices > 0 ? (stats.classicalCount / stats.totalServices) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 font-medium">
                <p className="font-bold text-[#0b1c30] mb-0.5">💡 Catatan Evaluasi Guru Pembimbing:</p>
                <p>
                  Sesi konseling individual tetap menjadi intervensi terbanyak. Dianjurkan untuk meningkatkan frekuensi bimbingan klasikal pencegahan.
                </p>
              </div>
            </div>

            {/* Panel 2: Home Visits & Special Interventions Summary */}
            <div className="bg-white p-6 rounded-2xl border border-[#bcc9c6]/30 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2">
                    <Home className="w-4 h-4 text-[#00685f]" />
                    <span>Layanan Tambahan & Kunjungan Rumah</span>
                  </h3>
                  <span className="text-xs text-gray-400 font-bold">Kolaborasi Wali Kelas</span>
                </div>

                <div className="grid grid-cols-2 gap-3 my-4">
                  <div className="p-4 bg-teal-50/70 rounded-xl border border-teal-200 text-center">
                    <span className="text-[10px] font-bold text-teal-800 uppercase">Kunjungan Rumah</span>
                    <p className="text-2xl font-extrabold text-[#00685f] mt-1">{stats.totalHomeVisitsCount}</p>
                    <span className="text-[10px] text-teal-700 font-semibold">Tercatat di Sistem</span>
                  </div>

                  <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-200 text-center">
                    <span className="text-[10px] font-bold text-purple-800 uppercase">Guru Konselor Aktif</span>
                    <p className="text-2xl font-extrabold text-purple-900 mt-1">1</p>
                    <span className="text-[10px] text-purple-700 font-semibold">{activeCounselor.name}</span>
                  </div>
                </div>
              </div>

              {/* Call to action for Critical List */}
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-xs text-amber-900">Perlu Perhatian Segera</h4>
                  <p className="text-[11px] text-amber-800 font-medium">
                    Terdapat {stats.criticalStudentsCount} siswa dalam rentang periode ini yang disarankan dibuatkan Surat Perjanjian atau Diagnosa AI.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('siswa-kritis')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-all shrink-0 cursor-pointer"
                >
                  Lihat Daftar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: DAFTAR SISWA MEMERLUKAN PERHATIAN KHUSUS / KRITIS */}
      {activeTab === 'siswa-kritis' && (
        <div className="bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-xs overflow-hidden space-y-0">
          <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-base text-amber-950 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Daftar Siswa Memerlukan Perhatian Khusus & Status Kritis</span>
              </h3>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                Siswa dengan akumulasi bobot tinggi, akumulasi total alpa dari awal absen, atau riwayat pelanggaran.
              </p>
            </div>
            <span className="px-3 py-1 bg-amber-200 text-amber-900 font-extrabold text-xs rounded-full border border-amber-300">
              {criticalStudentsList.length} Siswa Terdeteksi
            </span>
          </div>

          {criticalStudentsList.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="font-bold text-sm text-[#0b1c30]">
                Tidak Ada Siswa Status Kritis Pada Periode & Filter Terpilih
              </p>
              <p className="text-xs text-gray-500">
                Seluruh siswa berada dalam batas aman pembinaan disiplin.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[#0b1c30] font-extrabold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5 text-center w-12">No</th>
                    <th className="p-3.5">Nama Siswa</th>
                    <th className="p-3.5">Kelas</th>
                    <th className="p-3.5 text-center">Bobot Net</th>
                    <th className="p-3.5 text-center font-extrabold" title="Akumulasi total alfa dihitung dari awal seluruh rekaman absensi">Total Alpa (Awal Absen)</th>
                    <th className="p-3.5">Tingkat Risiko</th>
                    <th className="p-3.5">Kasus Terakhir</th>
                    <th className="p-3.5 text-center">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {criticalStudentsList.map((item, idx) => {
                    const { student, netPoints, alpaCount, riskLevel, latestViolation } = item;
                    return (
                      <tr key={student.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="p-3.5 text-center font-bold text-gray-500">{idx + 1}</td>
                        <td className="p-3.5">
                          <p className="font-bold text-[#0b1c30]">{student.name}</p>
                          <p className="text-[10px] text-gray-500 font-medium">NIS: {student.nis || '-'}</p>
                        </td>
                        <td className="p-3.5 font-bold text-gray-700">{student.class}</td>
                        <td className="p-3.5 text-center font-black text-red-600 text-sm">
                          {netPoints}
                        </td>
                        <td className="p-3.5 text-center font-extrabold text-amber-700">
                          {alpaCount > 0 ? `${alpaCount}x` : '-'}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${
                              riskLevel === 'Kritis'
                                ? 'bg-red-100 text-red-800 border-red-300'
                                : riskLevel === 'Tinggi'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-blue-100 text-blue-800 border-blue-300'
                            }`}
                          >
                            {riskLevel}
                          </span>
                        </td>
                        <td className="p-3.5 font-medium text-gray-700 max-w-xs truncate" title={latestViolation}>
                          {latestViolation}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Gemini AI Diagnosis */}
                            <button
                              onClick={() =>
                                setDiagnosisStudentData({
                                  name: student.name,
                                  class: student.class,
                                  nis: student.nis,
                                  netPoints,
                                  alpaCount
                                })
                              }
                              className="px-2.5 py-1.5 bg-gradient-to-r from-[#0b1c30] to-[#00685f] text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs hover:opacity-90"
                              title="Diagnosa AI Gemini"
                            >
                              <Brain className="w-3.5 h-3.5 text-teal-300" />
                              <span className="hidden sm:inline">Diagnosa AI</span>
                            </button>

                            {/* Email Draft Modal */}
                            <button
                              onClick={() =>
                                setEmailModalData({
                                  studentName: student.name,
                                  studentClass: student.class,
                                  studentNis: student.nis,
                                  netPoints,
                                  alpaCount,
                                  riskLevel
                                })
                              }
                              className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg transition-colors cursor-pointer"
                              title="Kirim Email Notifikasi Orang Tua / Wali Kelas"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: RIWAYAT LAYANAN BK LENGKAP & EXPORT PDF */}
      {activeTab === 'riwayat-konseling' && (
        <RiwayatLayananView
          services={services}
          students={students}
          activeCounselor={activeCounselor}
          onNavigateToForm={onNavigateToForm}
        />
      )}

      {/* SECTION 4: CATATAN PELANGGARAN & DISIPLIN */}
      {activeTab === 'pelanggaran-alpa' && (
        <div className="bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#00685f]" />
                <span>Catatan Pelanggaran Periode {formattedDateRange}</span>
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Daftar riwayat kedisiplinan dan bobot pembinaan siswa yang tercatat.
              </p>
            </div>
            <span className="px-3 py-1 bg-red-100 text-red-800 font-extrabold text-xs rounded-full">
              {periodViolations.length} Kasus
            </span>
          </div>

          {periodViolations.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="font-bold text-sm text-[#0b1c30]">Tidak Ada Catatan Pelanggaran Pada Periode Ini</p>
              <p className="text-xs text-gray-500">Kondisi kedisiplinan siswa sangat kondusif.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[#0b1c30] font-extrabold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5 text-center w-12">No</th>
                    <th className="p-3.5">Tanggal</th>
                    <th className="p-3.5">Nama Siswa & Kelas</th>
                    <th className="p-3.5">Kategori & Nama Pelanggaran</th>
                    <th className="p-3.5 text-center">Bobot</th>
                    <th className="p-3.5">Catatan Restitusi / Tindak Lanjut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {periodViolations.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5 text-center font-bold text-gray-500">{idx + 1}</td>
                      <td className="p-3.5 font-bold text-[#0b1c30] whitespace-nowrap">{v.date}</td>
                      <td className="p-3.5">
                        <p className="font-bold text-[#0b1c30]">{v.studentName}</p>
                        <p className="text-[10px] text-gray-500 font-medium">Kelas: {v.studentClass}</p>
                      </td>
                      <td className="p-3.5">
                        <span className="text-[10px] bg-red-50 text-red-700 font-extrabold px-2 py-0.5 rounded mr-1">
                          {v.category}
                        </span>
                        <p className="font-bold text-[#0b1c30] mt-0.5">{v.notes || v.category}</p>
                      </td>
                      <td className="p-3.5 text-center font-black text-red-600">{v.pointsAdded}</td>
                      <td className="p-3.5 font-medium text-gray-700">{v.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 5: REKAPITULASI KUNJUNGAN RUMAH (HOME VISIT) */}
      {activeTab === 'home-visit' && (
        <div className="bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2">
                <Home className="w-5 h-5 text-[#00685f]" />
                <span>Buku Register Kunjungan Rumah (Home Visit) Periode {formattedDateRange}</span>
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Rekapitulasi pelaksanaan kunjungan rumah ke tempat tinggal peserta didik dan kesepakatan orang tua/wali.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-teal-100 text-[#00685f] font-extrabold text-xs rounded-full">
                {periodHomeVisits.length} Kunjungan Terlaksana
              </span>
            </div>
          </div>

          {periodHomeVisits.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Home className="w-12 h-12 text-gray-400 mx-auto" />
              <p className="font-bold text-sm text-[#0b1c30]">Belum Ada Agenda Kunjungan Rumah Pada Periode Ini</p>
              <p className="text-xs text-gray-500">Kunjungan rumah yang dicatat pada menu Home Visit akan terangkum otomatis di sini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f0f4f3] border-b border-gray-200 text-[#0b1c30] font-extrabold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5 text-center w-12">No</th>
                    <th className="p-3.5">No. Laporan</th>
                    <th className="p-3.5">Tanggal</th>
                    <th className="p-3.5">Nama Siswa & Kelas</th>
                    <th className="p-3.5">Wali yang Ditemui</th>
                    <th className="p-3.5">Alamat Kunjungan</th>
                    <th className="p-3.5">Maksud / Pokok Masalah</th>
                    <th className="p-3.5">Hasil Temuan & Kesepakatan RTL</th>
                    <th className="p-3.5 text-center">Petugas BK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {periodHomeVisits.map((hv, idx) => (
                    <tr key={hv.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5 text-center font-bold text-gray-500">{idx + 1}</td>
                      <td className="p-3.5 font-bold text-[#00685f] whitespace-nowrap">{hv.reportNumber || `HV-${idx + 1}`}</td>
                      <td className="p-3.5 font-bold text-[#0b1c30] whitespace-nowrap">{hv.date || hv.visitDate || '-'}</td>
                      <td className="p-3.5">
                        <p className="font-bold text-[#0b1c30]">{hv.studentName}</p>
                        <p className="text-[10px] text-gray-500 font-medium">Kelas: {hv.studentClass} | NIS: {hv.studentNis || '-'}</p>
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-gray-800 block">{hv.parentNameMet || hv.parentName || 'Orang Tua / Wali'}</span>
                      </td>
                      <td className="p-3.5 max-w-xs">
                        <p className="text-[11px] text-gray-600 line-clamp-2">{hv.address || '-'}</p>
                      </td>
                      <td className="p-3.5 max-w-xs">
                        <span className="text-[10px] bg-teal-50 text-[#00685f] font-extrabold px-1.5 py-0.5 rounded mr-1">
                          Bidang {hv.bidangBimbingan || 'Pribadi'}
                        </span>
                        <p className="font-bold text-[#0b1c30] mt-0.5 line-clamp-2">{hv.purpose || hv.reason || '-'}</p>
                      </td>
                      <td className="p-3.5 max-w-xs">
                        <p className="font-medium text-gray-700 line-clamp-2">{hv.agreement || hv.result || '-'}</p>
                      </td>
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span className="text-[10px] font-bold text-gray-600">{hv.counselorName || 'Guru BK'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 6: REKAP OTOMATIS PER SEMESTER */}
      {activeTab === 'rekap-semester' && (
        <RekapSemesterView
          services={services}
          activeCounselor={activeCounselor}
          students={students}
          onBack={() => setActiveTab('ringkasan')}
        />
      )}

      {diagnosisStudentData && (
        <BehavioralDiagnosisModal
          studentName={diagnosisStudentData.name}
          studentClass={diagnosisStudentData.class}
          studentNis={diagnosisStudentData.nis}
          netPoints={diagnosisStudentData.netPoints}
          alpaCount={diagnosisStudentData.alpaCount}
          onClose={() => setDiagnosisStudentData(null)}
          onOpenEmailModal={(draftData) => setEmailModalData(draftData)}
        />
      )}

      {/* Email Notification Modal */}
      {emailModalData && (
        <EmailNotificationModal
          studentName={emailModalData.studentName}
          studentClass={emailModalData.studentClass}
          studentNis={emailModalData.studentNis}
          netPoints={emailModalData.netPoints}
          alpaCount={emailModalData.alpaCount || 0}
          followUpPlan={emailModalData.followUpPlan}
          riskLevel={emailModalData.riskLevel}
          onClose={() => setEmailModalData(null)}
        />
      )}
    </div>
  );
}
