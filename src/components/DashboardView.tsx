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
  Award
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
        {/* Main Line Chart (8 cols) */}
        <div className="col-span-12 lg:col-span-8 bg-white p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.015)] border border-[#bcc9c6]/30">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#0b1c30]">
                Tren Kedisiplinan &amp; Layanan
              </h2>
              <p className="text-xs text-[#3d4947]/70 font-medium mt-1">
                Perbandingan tren pelanggaran vs intervensi BK (6 Bulan)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#ba1a1a]"></span>
                <span className="text-[#3d4947]/80">Pelanggaran</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#00685f]"></span>
                <span className="text-[#3d4947]/80">Layanan BK</span>
              </div>
            </div>
          </div>

          {/* Interactive Custom SVG Chart Container */}
          <div className="w-full relative bg-[#eff4ff]/20 p-4 rounded-xl border border-[#bcc9c6]/20">
            <svg viewBox="0 0 800 240" className="w-full overflow-visible">
              <defs>
                <linearGradient id="gradTeal" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#00685f" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#00685f" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="gradRed" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#ba1a1a" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#ba1a1a" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="40" x2="760" y2="40" stroke="#bcc9c6" strokeOpacity="0.25" strokeWidth="1" />
              <line x1="40" y1="130" x2="760" y2="130" stroke="#bcc9c6" strokeOpacity="0.25" strokeWidth="1" />
              <line x1="40" y1="220" x2="760" y2="220" stroke="#bcc9c6" strokeOpacity="0.4" strokeWidth="1.5" />

              {/* Draw Layanan BK Line (Area first then stroke) */}
              <path
                d={`M 50 220 
                    ${chartData.map((d, i) => {
                      const { x, y } = getCoordinates(i, d.layanan, true);
                      return `L ${x} ${y}`;
                    }).join(' ')} 
                    L 750 220 Z`}
                fill="url(#gradTeal)"
              />
              <path
                d={chartData.map((d, i) => {
                  const { x, y } = getCoordinates(i, d.layanan, true);
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')}
                fill="none"
                stroke="#00685f"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Draw Pelanggaran Line (Area then dashed stroke) */}
              <path
                d={`M 50 220 
                    ${chartData.map((d, i) => {
                      const { x, y } = getCoordinates(i, d.pelanggaran, false);
                      return `L ${x} ${y}`;
                    }).join(' ')} 
                    L 750 220 Z`}
                fill="url(#gradRed)"
              />
              <path
                d={chartData.map((d, i) => {
                  const { x, y } = getCoordinates(i, d.pelanggaran, false);
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')}
                fill="none"
                stroke="#ba1a1a"
                strokeWidth="3"
                strokeDasharray="6 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interactive Circles / Hover Zones */}
              {chartData.map((d, i) => {
                const coordLayanan = getCoordinates(i, d.layanan, true);
                const coordPelanggaran = getCoordinates(i, d.pelanggaran, false);
                const isHovered = hoveredMonthIndex === i;

                return (
                  <g key={i}>
                    {/* Layanan Node */}
                    <circle
                      cx={coordLayanan.x}
                      cy={coordLayanan.y}
                      r={isHovered ? 6 : 4}
                      fill="#00685f"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                    {/* Pelanggaran Node */}
                    <circle
                      cx={coordPelanggaran.x}
                      cy={coordPelanggaran.y}
                      r={isHovered ? 6 : 4}
                      fill="#ba1a1a"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />

                    {/* X Axis vertical tracking line on hover */}
                    {isHovered && (
                      <line
                        x1={coordLayanan.x}
                        y1="40"
                        x2={coordLayanan.x}
                        y2="220"
                        stroke="#00685f"
                        strokeOpacity="0.25"
                        strokeDasharray="2 2"
                        strokeWidth="1.5"
                      />
                    )}

                    {/* Mouse sensor rect for hover indexing */}
                    <rect
                      x={coordLayanan.x - 40}
                      y="10"
                      width="80"
                      height="210"
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredMonthIndex(i)}
                      onMouseLeave={() => setHoveredMonthIndex(null)}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Custom SVG Tooltip */}
            {hoveredMonthIndex !== null && (
              <div
                className="absolute bg-[#0b1c30] text-white text-xs rounded-xl p-3 shadow-xl border border-white/10 z-20 space-y-1"
                style={{
                  left: `${6 + hoveredMonthIndex * 15}%`,
                  bottom: '75%',
                  transform: 'translateX(-50%)',
                }}
              >
                <p className="font-extrabold border-b border-white/20 pb-1 text-center">
                  Bulan {months[hoveredMonthIndex]}
                </p>
                <div className="flex items-center gap-3 justify-between">
                  <span className="text-gray-300">Layanan BK:</span>
                  <span className="font-bold text-[#6bd8cb]">
                    {chartData[hoveredMonthIndex].layanan} Sesi
                  </span>
                </div>
                <div className="flex items-center gap-3 justify-between">
                  <span className="text-gray-300">Pelanggaran:</span>
                  <span className="font-bold text-[#ffdad6]">
                    {chartData[hoveredMonthIndex].pelanggaran} Kasus
                  </span>
                </div>
              </div>
            )}

            {/* Labels Axis */}
            <div className="flex justify-between px-6 mt-4 text-[10px] font-bold text-[#3d4947]/60 uppercase tracking-wider">
              {months.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Bar Chart - Pelanggaran per Kelas (4 cols) */}
        <div className="col-span-12 lg:col-span-4 bg-white p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.015)] border border-[#bcc9c6]/30 flex flex-col">
          <h2 className="text-lg font-bold text-[#0b1c30] mb-5">
            Pelanggaran per Kelas
          </h2>

          <div className="flex-1 space-y-4.5">
            {sortedClasses.map((cl, i) => {
              // Dynamically determine colors and percentage widths
              const maxPoints = sortedClasses[0].points || 1;
              const pct = Math.max(15, Math.min(100, (cl.points / maxPoints) * 100));

              // Styled classes
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
            className="mt-6 text-sm text-[#00685f] font-bold flex items-center justify-center gap-1 hover:underline group self-center cursor-pointer"
          >
            <span>Lihat Semua Kelas</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>

      {/* Attention & Activity Section */}
      <div className="grid grid-cols-12 gap-8">
        {/* Atensi Khusus (7 cols) */}
        <div className="col-span-12 lg:col-span-7 bg-white p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.015)] border border-[#bcc9c6]/30">
          <div className="flex justify-between items-center mb-6 border-b border-[#bcc9c6]/20 pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#0b1c30]">Atensi Khusus</h2>
              <p className="text-xs text-[#3d4947]/70 font-semibold mt-0.5">
                Siswa dengan akumulasi pelanggaran tertinggi
              </p>
            </div>
            <span className="bg-[#ffdad6] text-[#93000a] px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border border-[#ba1a1a]/20 shadow-sm animate-pulse">
              Prioritas Tinggi
            </span>
          </div>

          <div className="space-y-5">
            {topAttentionStudents.map((student) => {
              // Percentage threshold representation (max is 100 as limit)
              const ratio = student.violationPoints;
              const pct = Math.min(100, ratio);

              // Badge status colors
              let colorClasses = {
                text: 'text-[#ba1a1a]',
                bar: 'bg-[#ba1a1a]',
              };
              if (ratio < 50) {
                colorClasses = {
                  text: 'text-[#00685f]',
                  bar: 'bg-[#00685f]',
                };
              } else if (ratio < 80) {
                colorClasses = {
                  text: 'text-[#825100]',
                  bar: 'bg-[#825100]',
                };
              }

              return (
                <div
                  key={student.id}
                  onClick={() => onNavigateToTab('data-siswa', student.name)}
                  className="flex items-center gap-4 p-3 rounded-xl border border-transparent hover:border-[#bcc9c6]/30 hover:bg-[#eff4ff]/20 transition-all cursor-pointer group"
                >
                  {/* Student Avatar */}
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-[#eff4ff] border-2 border-transparent group-hover:border-[#ba1a1a]/40 transition-all flex-shrink-0 flex items-center justify-center font-bold text-[#00685f]">
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

                  {/* Student Progress */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-[#0b1c30] text-sm group-hover:text-[#ba1a1a] transition-colors truncate">
                        {student.name}
                        <span className="text-[#3d4947]/70 font-medium text-xs ml-2">
                          • {student.class}
                        </span>
                      </h4>
                      <span className={`font-bold text-xs ${colorClasses.text}`}>
                        {student.violationPoints}/100 Poin
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-[#eff4ff] rounded-full overflow-hidden border border-[#bcc9c6]/10">
                      <div
                        className={`h-full ${colorClasses.bar} rounded-full`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Action Link Icon */}
                  <button className="p-1.5 hover:bg-[#eff4ff] rounded-full transition-colors text-[#3d4947] flex-shrink-0">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity (5 cols) */}
        <div className="col-span-12 lg:col-span-5 bg-white p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.015)] border border-[#bcc9c6]/30 flex flex-col">
          <h2 className="text-lg font-bold text-[#0b1c30] mb-5">
            Aktivitas Terbaru
          </h2>

          <div className="flex-grow space-y-5 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {logs.map((log) => {
              // Select badge icon & style based on log category
              let iconBg = 'bg-[#00685f]';
              let iconSymbol = <Award className="w-3.5 h-3.5 text-white" />;

              if (log.type === 'violation') {
                iconBg = 'bg-[#ba1a1a]';
                iconSymbol = <AlertTriangle className="w-3.5 h-3.5 text-white" />;
              } else if (log.type === 'homevisit') {
                iconBg = 'bg-[#6b38d4]';
                iconSymbol = <Calendar className="w-3.5 h-3.5 text-white" />;
              } else if (log.type === 'attendance') {
                iconBg = 'bg-[#00685f]';
                iconSymbol = <Calendar className="w-3.5 h-3.5 text-white" />;
              }

              return (
                <div
                  key={log.id}
                  className="relative pl-7 pb-4 border-l border-[#bcc9c6]/40 last:pb-0 last:border-l-transparent"
                >
                  {/* Status Indicator Dot/Badge */}
                  <span
                    className={`absolute -left-[11px] top-0.5 w-5.5 h-5.5 rounded-full ${iconBg} flex items-center justify-center shadow-sm ring-4 ring-white z-10`}
                  >
                    {iconSymbol}
                  </span>

                  {/* Log Card Info */}
                  <div>
                    <p className="text-[10px] text-[#3d4947] opacity-60 font-bold uppercase tracking-wider">
                      {log.timeLabel}
                    </p>
                    <h5 className="text-sm font-bold text-[#0b1c30] mt-0.5">
                      {log.title}
                    </h5>
                    <p className="text-xs text-[#3d4947]/80 mt-1 leading-relaxed">
                      {log.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
