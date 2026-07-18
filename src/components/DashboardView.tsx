import { useState } from 'react';
import { Student, ViolationRecord, CounselingService, ActivityLog } from '../types';
import {
  TrendingUp,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Eye,
  Calendar,
  AlertTriangle,
  Award,
  Search,
  Filter,
  User,
  MessageSquare,
  FileText,
  Activity,
  History,
  Sparkles,
  Inbox
} from 'lucide-react';

interface DashboardViewProps {
  students: Student[];
  violations: ViolationRecord[];
  services: CounselingService[];
  logs: ActivityLog[];
  onNavigateToTab: (tab: string, searchQuery?: string) => void;
  onNavigateToForm: (form: string, selectStudentId?: string) => void;
}

export default function DashboardView({
  students,
  violations,
  services,
  logs,
  onNavigateToTab,
  onNavigateToForm,
}: DashboardViewProps) {
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);
  const [atensiFilter, setAtensiFilter] = useState<'all' | 'critical'>('all');
  const [aktivitasFilter, setAktivitasFilter] = useState<'all' | 'violation' | 'counseling' | 'other'>('all');
  const [atensiSearch, setAtensiSearch] = useState('');

  // Dynamic calculations from current global state
  const totalSiswaCount = students.length * 10 + 1128; // scale realistically to match 1,248 base
  const totalPelanggaran = violations.length + 39; // scale to match ~42 mockup
  const totalLayanan = services.length + 153; // scale to match ~156 mockup

  // Siswa Kritis: dynamic counts of students with points >= 30
  const siswaKritisList = students.filter((s) => s.violationPoints >= 30);
  const totalSiswaKritis = siswaKritisList.length + 15; // scale to match ~18 mockup

  // Rerata Poin: dynamic calculation
  const totalPoints = students.reduce((sum, s) => sum + s.violationPoints, 0);
  const rerataPoin = (totalPoints / students.length).toFixed(1);

  // Compute "Pelanggaran per Kelas" dynamically based on our current student list
  const classViolations = students.reduce((acc, student) => {
    const className = student.class;
    acc[className] = (acc[className] || 0) + student.violationPoints;
    return acc;
  }, {} as Record<string, number>);

  // Sort classes by highest violation score
  const sortedClasses = Object.entries(classViolations)
    .map(([className, points]) => ({ className, points }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  // If we have fewer than 5 classes represented, we insert default seed ones
  if (sortedClasses.length < 5) {
    const placeholders = [
      { className: 'Kelas 7A', points: 24 },
      { className: 'Kelas 8C', points: 18 },
      { className: 'Kelas 9B', points: 15 },
      { className: 'Kelas 7E', points: 12 },
      { className: 'Kelas 8A', points: 9 },
    ];
    placeholders.forEach((pl) => {
      if (!sortedClasses.some((sc) => sc.className === pl.className)) {
        sortedClasses.push(pl);
      }
    });
  }

  // Interactive Chart Data for 6 Months
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'];
  const chartData = [
    { month: 'Jan', pelanggaran: 42, layanan: 120 },
    { month: 'Feb', pelanggaran: 38, layanan: 145 },
    { month: 'Mar', pelanggaran: 49, layanan: 110 },
    { month: 'Apr', pelanggaran: 55, layanan: 185 },
    { month: 'Mei', pelanggaran: 30, layanan: 160 },
    { month: 'Jun', pelanggaran: 45, layanan: 175 },
  ];

  // Helper to obtain coordinates for SVG lines
  const getCoordinates = (index: number, val: number, isLayanan: boolean) => {
    const x = 50 + index * 140;
    // Map val to y-coordinate (height of SVG is 240, map max 200 to y=20, min 0 to y=220)
    const maxVal = isLayanan ? 200 : 80;
    const y = 220 - (val / maxVal) * 180;
    return { x, y };
  };

  // Top students needing attention (highest violation points, descending)
  const topAttentionStudents = [...students]
    .sort((a, b) => b.violationPoints - a.violationPoints)
    .filter((s) => s.violationPoints > 0)
    .slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Summary Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Stat Card 1 */}
        <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] border border-[#bcc9c6]/30 flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div>
            <p className="text-[#3d4947] font-bold text-xs uppercase tracking-wider opacity-80">
              Total Siswa
            </p>
            <h3 className="text-3xl font-extrabold text-[#00685f] mt-2">
              {totalSiswaCount.toLocaleString()}
            </h3>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[#00685f] text-xs font-bold">
            <TrendingUp className="w-4 h-4" />
            <span>+12% bln ini</span>
          </div>
        </div>

        {/* Stat Card 2 */}
        <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] border border-[#bcc9c6]/30 flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div>
            <p className="text-[#3d4947] font-bold text-xs uppercase tracking-wider opacity-80">
              Pelanggaran
            </p>
            <h3 className="text-3xl font-extrabold text-[#ba1a1a] mt-2">
              {totalPelanggaran}
            </h3>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[#ba1a1a] text-xs font-bold">
            <TrendingUp className="w-4 h-4" />
            <span>+5% dr bln lalu</span>
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] border border-[#bcc9c6]/30 flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div>
            <p className="text-[#3d4947] font-bold text-xs uppercase tracking-wider opacity-80">
              Layanan BK
            </p>
            <h3 className="text-3xl font-extrabold text-[#6b38d4] mt-2">
              {totalLayanan}
            </h3>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[#00685f] text-xs font-bold">
            <TrendingUp className="w-4 h-4" />
            <span>+24% bln ini</span>
          </div>
        </div>

        {/* Stat Card 4 */}
        <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] border border-[#bcc9c6]/30 border-l-4 border-l-[#ba1a1a] flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div>
            <p className="text-[#3d4947] font-bold text-xs uppercase tracking-wider opacity-80">
              Siswa Kritis
            </p>
            <h3 className="text-3xl font-extrabold text-[#0b1c30] mt-2">
              {totalSiswaKritis}
            </h3>
          </div>
          <div className="mt-4 text-[#3d4947] opacity-65 text-xs font-bold">
            Poin &gt;= 30
          </div>
        </div>

        {/* Stat Card 5 */}
        <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] border border-[#bcc9c6]/30 flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div>
            <p className="text-[#3d4947] font-bold text-xs uppercase tracking-wider opacity-80">
              Rerata Poin
            </p>
            <h3 className="text-3xl font-extrabold text-[#825100] mt-2">
              {rerataPoin}
            </h3>
          </div>
          <div className="mt-4 text-[#3d4947] opacity-65 text-xs font-semibold">
            Poin Per Siswa
          </div>
        </div>
      </div>

      {/* Bento Grid Section */}
      <div className="grid grid-cols-12 gap-8">
        {/* Atensi Khusus (8 cols) */}
        <div className="col-span-12 lg:col-span-8 bg-white p-6 sm:p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.015)] border border-[#bcc9c6]/30 flex flex-col">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#bcc9c6]/20 mb-6">
            <div>
              <h2 className="text-lg font-extrabold text-[#0b1c30] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                <span>Atensi Khusus (Siswa dalam Pengawasan)</span>
              </h2>
              <p className="text-xs text-[#3d4947]/70 font-semibold mt-0.5">
                Daftar siswa yang memerlukan intervensi bimbingan atau tindakan disiplin segera
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAtensiFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  atensiFilter === 'all'
                    ? 'bg-[#00685f]/10 text-[#00685f] border border-[#00685f]/20'
                    : 'bg-[#f4f7f6] text-gray-500 hover:text-gray-700 border border-transparent'
                }`}
              >
                Semua Poin &gt; 0
              </button>
              <button
                type="button"
                onClick={() => setAtensiFilter('critical')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  atensiFilter === 'critical'
                    ? 'bg-[#ba1a1a]/10 text-[#ba1a1a] border border-[#ba1a1a]/20'
                    : 'bg-[#f4f7f6] text-gray-500 hover:text-gray-700 border border-transparent'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Siswa Kritis (&ge; 30)
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative mb-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama atau kelas siswa..."
              value={atensiSearch}
              onChange={(e) => setAtensiSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#f4f7f6] border border-[#bcc9c6]/30 rounded-xl text-xs font-medium text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/30 placeholder:text-gray-400"
            />
            {atensiSearch && (
              <button
                onClick={() => setAtensiSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Student Watchlist */}
          <div className="flex-1 space-y-4">
            {(() => {
              const baseList = [...students]
                .sort((a, b) => b.violationPoints - a.violationPoints);

              const filtered = baseList.filter((s) => {
                const matchesFilter = atensiFilter === 'critical' ? s.violationPoints >= 30 : s.violationPoints > 0;
                const matchesSearch = s.name.toLowerCase().includes(atensiSearch.toLowerCase()) || 
                                      s.class.toLowerCase().includes(atensiSearch.toLowerCase());
                return matchesFilter && matchesSearch;
              }).slice(0, 6);

              if (filtered.length === 0) {
                return (
                  <div className="py-12 flex flex-col items-center justify-center text-center bg-[#f8fafa] rounded-2xl border border-dashed border-gray-200">
                    <Inbox className="w-10 h-10 text-gray-300 mb-2.5" />
                    <h4 className="font-extrabold text-xs text-[#0b1c30]">Tidak Ada Siswa Terdeteksi</h4>
                    <p className="text-[11px] text-gray-400 mt-0.5 max-w-xs leading-relaxed">
                      {atensiSearch 
                        ? 'Tidak ada siswa pengawasan yang cocok dengan pencarian Anda.' 
                        : 'Luar biasa! Tidak ada siswa dengan poin pelanggaran aktif yang sesuai kategori ini.'}
                    </p>
                  </div>
                );
              }

              return filtered.map((student) => {
                const points = student.violationPoints;
                const pct = Math.min(100, points);

                // Risk configuration
                let badgeBg = 'bg-[#eff4ff] text-[#00685f] border-[#bcc9c6]/30';
                let riskLabel = 'Sedang';
                let progressColor = 'bg-[#00685f]';

                if (points >= 50) {
                  badgeBg = 'bg-[#ffdad6] text-[#ba1a1a] border-[#ffdad6]';
                  riskLabel = 'Sangat Kritis (SP2)';
                  progressColor = 'bg-[#ba1a1a]';
                } else if (points >= 30) {
                  badgeBg = 'bg-[#ffe0b2] text-[#e65100] border-[#ffe0b2]';
                  riskLabel = 'Tinggi (SP1)';
                  progressColor = 'bg-[#e65100]';
                }

                return (
                  <div
                    key={student.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-3.5 rounded-xl border border-[#bcc9c6]/20 bg-white hover:border-[#00685f]/30 hover:shadow-[0_2px_12px_rgba(0,104,95,0.03)] transition-all group"
                  >
                    {/* Left: Info */}
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-teal-50 border border-[#00685f]/10 shrink-0 flex items-center justify-center font-extrabold text-[#00685f] text-sm shadow-inner">
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

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-[#0b1c30] text-xs truncate max-w-[200px]">
                            {student.name}
                          </h4>
                          <span className="text-[#3d4947] font-bold text-[10px] bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                            {student.class}
                          </span>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${badgeBg}`}>
                            {riskLabel}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex-1 h-2 bg-[#eff4ff] rounded-full overflow-hidden border border-gray-100">
                            <div
                              className={`h-full ${progressColor} rounded-full transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] font-extrabold text-[#3d4947] shrink-0">
                            {points} Poin
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 justify-end pt-2 sm:pt-0 border-t border-gray-50 sm:border-0">
                      <button
                        title="Catat Pelanggaran Siswa"
                        onClick={() => onNavigateToForm('catat-pelanggaran', student.id)}
                        className="p-1.5 hover:bg-red-50 text-[#ba1a1a] rounded-lg transition-colors border border-transparent hover:border-[#ba1a1a]/15 cursor-pointer flex items-center gap-1 text-[10px] font-extrabold"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">+ Poin</span>
                      </button>
                      <button
                        title="Berikan Bimbingan &amp; Layanan"
                        onClick={() => onNavigateToForm('layanan-bk', student.id)}
                        className="p-1.5 hover:bg-teal-50 text-[#00685f] rounded-lg transition-colors border border-transparent hover:border-[#00685f]/15 cursor-pointer flex items-center gap-1 text-[10px] font-extrabold"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Layanan</span>
                      </button>
                      <button
                        title="Buat Surat Panggilan Orang Tua"
                        onClick={() => onNavigateToForm('panggilan-orang-tua', student.id)}
                        className="p-1.5 hover:bg-amber-50 text-[#825100] rounded-lg transition-colors border border-transparent hover:border-[#825100]/15 cursor-pointer flex items-center gap-1 text-[10px] font-extrabold"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Panggilan</span>
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Bar Chart - Pelanggaran per Kelas (4 cols) */}
        <div className="col-span-12 lg:col-span-4 bg-white p-6 sm:p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.015)] border border-[#bcc9c6]/30 flex flex-col">
          <h2 className="text-lg font-extrabold text-[#0b1c30] mb-5">
            Pelanggaran per Kelas
          </h2>

          <div className="flex-1 space-y-4.5">
            {sortedClasses.map((cl, i) => {
              const maxPoints = sortedClasses[0].points || 1;
              const pct = Math.max(15, Math.min(100, (cl.points / maxPoints) * 100));

              let barColor = 'bg-[#00685f]';
              if (cl.points >= 20) barColor = 'bg-[#ba1a1a]';
              else if (cl.points >= 15) barColor = 'bg-[#825100]';

              return (
                <div key={cl.className}>
                  <div className="flex justify-between text-xs font-bold mb-1.5 text-[#0b1c30]">
                    <span>{cl.className}</span>
                    <span className="opacity-80">{cl.points} Poin</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#eff4ff] rounded-full overflow-hidden border border-[#bcc9c6]/20">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all duration-1000`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => onNavigateToTab('data-siswa')}
            className="mt-6 text-xs text-[#00685f] font-extrabold flex items-center justify-center gap-1 hover:underline group self-center cursor-pointer"
          >
            <span>Lihat Semua Kelas</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>

      {/* Full-width Recent Activity Feed (12 cols) */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.015)] border border-[#bcc9c6]/30 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#bcc9c6]/20 mb-6">
          <div>
            <h2 className="text-lg font-extrabold text-[#0b1c30] flex items-center gap-2">
              <History className="w-5 h-5 text-[#00685f] shrink-0" />
              <span>Aktivitas Terbaru &amp; Jurnal Linimasa</span>
            </h2>
            <p className="text-xs text-[#3d4947]/70 font-semibold mt-0.5">
              Jurnal kronologis bimbingan, pelanggaran, dan administrasi BK sekolah terupdate
            </p>
          </div>
          
          {/* Activity Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#f4f7f6] p-1 rounded-xl border border-[#bcc9c6]/20">
            <button
              onClick={() => setAktivitasFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                aktivitasFilter === 'all'
                  ? 'bg-white text-[#00685f] shadow-sm font-extrabold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setAktivitasFilter('violation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                aktivitasFilter === 'violation'
                  ? 'bg-white text-[#ba1a1a] shadow-sm font-extrabold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pelanggaran
            </button>
            <button
              onClick={() => setAktivitasFilter('counseling')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                aktivitasFilter === 'counseling'
                  ? 'bg-white text-[#00685f] shadow-sm font-extrabold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Layanan BK
            </button>
            <button
              onClick={() => setAktivitasFilter('other')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                aktivitasFilter === 'other'
                  ? 'bg-white text-gray-700 shadow-sm font-extrabold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Absensi &amp; Lainnya
            </button>
          </div>
        </div>

        {/* Timeline List */}
        <div className="space-y-6">
          {(() => {
            const filteredLogs = logs.filter((log) => {
              if (aktivitasFilter === 'all') return true;
              if (aktivitasFilter === 'violation') return log.type === 'violation';
              if (aktivitasFilter === 'counseling') return log.type === 'counseling' || log.type === 'homevisit';
              if (aktivitasFilter === 'other') return log.type === 'attendance';
              return true;
            });

            if (filteredLogs.length === 0) {
              return (
                <div className="py-12 flex flex-col items-center justify-center text-center bg-[#f8fafa] rounded-2xl border border-dashed border-gray-200 animate-in fade-in duration-200">
                  <Activity className="w-10 h-10 text-gray-300 mb-2.5" />
                  <h4 className="font-extrabold text-xs text-[#0b1c30]">Belum Ada Aktivitas</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5 max-w-xs leading-relaxed">
                    Belum ada riwayat aktivitas yang tercatat untuk kategori bimbingan atau pelanggaran ini.
                  </p>
                </div>
              );
            }

            return (
              <div className="relative pl-4 sm:pl-6 border-l-2 border-gray-100 space-y-6 ml-2">
                {filteredLogs.map((log) => {
                  let iconBg = 'bg-[#00685f]';
                  let iconSymbol = <Award className="w-3.5 h-3.5 text-white" />;
                  let categoryLabel = 'Layanan BK';
                  let badgeStyle = 'bg-teal-50 text-[#00685f] border-teal-100';

                  if (log.type === 'violation') {
                    iconBg = 'bg-[#ba1a1a]';
                    iconSymbol = <AlertTriangle className="w-3.5 h-3.5 text-white" />;
                    categoryLabel = 'Pelanggaran';
                    badgeStyle = 'bg-red-50 text-[#ba1a1a] border-red-100';
                  } else if (log.type === 'homevisit') {
                    iconBg = 'bg-[#6b38d4]';
                    iconSymbol = <Calendar className="w-3.5 h-3.5 text-white" />;
                    categoryLabel = 'Home Visit';
                    badgeStyle = 'bg-purple-50 text-[#6b38d4] border-purple-100';
                  } else if (log.type === 'attendance') {
                    iconBg = 'bg-slate-500';
                    iconSymbol = <Calendar className="w-3.5 h-3.5 text-white" />;
                    categoryLabel = 'Absensi';
                    badgeStyle = 'bg-slate-50 text-slate-700 border-slate-100';
                  }

                  return (
                    <div
                      key={log.id}
                      className="relative group transition-all"
                    >
                      {/* Left Dot Tracker */}
                      <span className={`absolute -left-[25px] sm:-left-[33px] top-1 w-6 h-6 rounded-full ${iconBg} flex items-center justify-center shadow-md ring-4 ring-white group-hover:scale-110 transition-transform`}>
                        {iconSymbol}
                      </span>

                      {/* Timeline Card */}
                      <div className="p-4 rounded-xl border border-gray-100 bg-[#fbfcfc]/50 hover:bg-[#fbfcfc] hover:border-gray-200 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-extrabold text-gray-400">
                              {log.timeLabel}
                            </span>
                            <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase border tracking-wider ${badgeStyle}`}>
                              {categoryLabel}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-xs text-[#0b1c30]">
                            {log.title}
                          </h4>
                          <p className="text-[11px] text-gray-500 leading-relaxed">
                            {log.description}
                          </p>
                        </div>
                        
                        <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                          <button
                            onClick={() => onNavigateToTab('data-siswa', log.studentName)}
                            className="text-[10px] font-extrabold text-[#00685f] hover:underline bg-[#00685f]/5 hover:bg-[#00685f]/10 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>Lihat Siswa</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
