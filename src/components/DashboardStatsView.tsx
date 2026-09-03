import React, { useState, useMemo } from 'react';
import { CounselingService, ViolationRecord, StudentAchievement } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line
} from 'recharts';
import {
  HeartHandshake,
  AlertTriangle,
  Award,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  Activity,
  Layers,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';

export interface DashboardStatsViewProps {
  services: CounselingService[];
  violations: ViolationRecord[];
  achievements?: StudentAchievement[];
  onNavigateToTab?: (tab: string, searchQuery?: string) => void;
  className?: string;
}

type TimeRangeOption = '6months' | 'year' | '3months';
type ActiveChartTab = 'all' | 'counseling' | 'violations' | 'achievements';

const MONTH_NAMES_IND = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
];

export default function DashboardStatsView({
  services = [],
  violations = [],
  achievements = [],
  onNavigateToTab,
  className = ''
}: DashboardStatsViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('6months');
  const [activeTab, setActiveTab] = useState<ActiveChartTab>('all');

  // Generate monthly time-series dataset based on selected time range
  const { chartData, metricsSummary } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let monthCount = 6;
    if (timeRange === '3months') monthCount = 3;
    if (timeRange === 'year') monthCount = 12;

    const monthsList: { year: number; month: number; label: string; key: string }[] = [];

    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      const monthLabel = `${MONTH_NAMES_IND[m]} ${y !== currentYear ? `'${String(y).slice(-2)}` : ''}`;

      monthsList.push({
        year: y,
        month: m,
        label: monthLabel,
        key: monthKey
      });
    }

    // Map counts to months
    let totalServicesCount = 0;
    let totalViolationsCount = 0;
    let totalAchievementsCount = 0;

    const data = monthsList.map(({ label, key }) => {
      // Counseling services in this month
      const monthServices = services.filter((s) => s.date && s.date.startsWith(key));
      const counselingCount = monthServices.length;

      // Counseling by type
      const individualCount = monthServices.filter((s) => s.targetType === 'Individu' || s.serviceType?.includes('Individual') || s.serviceType?.includes('Perorangan')).length;
      const groupCount = monthServices.filter((s) => s.targetType === 'Kelompok' || s.serviceType?.includes('Kelompok')).length;
      const classicalCount = monthServices.filter((s) => s.targetType === 'Klasikal' || s.serviceType?.includes('Klasikal') || s.serviceType?.includes('Orientasi') || s.serviceType?.includes('Informasi')).length;

      // Violations in this month
      const monthViolations = violations.filter((v) => v.date && v.date.startsWith(key));
      const violationCount = monthViolations.length;
      const violationWeight = monthViolations.reduce((acc, curr) => acc + (curr.pointsAdded || 0), 0);

      // Achievements in this month
      const monthAchievements = achievements.filter((a) => a.date && a.date.startsWith(key));
      const achievementCount = monthAchievements.length;
      const achievementReward = monthAchievements.reduce((acc, curr) => acc + (curr.pointsReward || 0), 0);

      totalServicesCount += counselingCount;
      totalViolationsCount += violationCount;
      totalAchievementsCount += achievementCount;

      return {
        key,
        month: label,
        counseling: counselingCount,
        individualCounseling: individualCount,
        groupCounseling: groupCount,
        classicalCounseling: classicalCount,
        violations: violationCount,
        violationWeight,
        achievements: achievementCount,
        achievementReward,
        // Net balance indicator (Apresiasi - Violations)
        balanceNet: achievementCount - violationCount
      };
    });

    // Calculate growth percentages comparing current month vs previous month
    const defaultItem = { key: '', month: '', counseling: 0, individualCounseling: 0, groupCounseling: 0, classicalCounseling: 0, violations: 0, violationWeight: 0, achievements: 0, achievementReward: 0, balanceNet: 0 };
    const latestMonth = data[data.length - 1] || defaultItem;
    const prevMonth = data[data.length - 2] || defaultItem;

    const calcGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const counselingGrowth = calcGrowth(latestMonth.counseling, prevMonth.counseling);
    const violationGrowth = calcGrowth(latestMonth.violations, prevMonth.violations);
    const achievementGrowth = calcGrowth(latestMonth.achievements, prevMonth.achievements);

    return {
      chartData: data,
      metricsSummary: {
        totalServices: totalServicesCount,
        totalViolations: totalViolationsCount,
        totalAchievements: totalAchievementsCount,
        counselingGrowth,
        violationGrowth,
        achievementGrowth,
        latestMonthName: latestMonth.month
      }
    };
  }, [services, violations, achievements, timeRange]);

  // Custom Recharts Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0b1c30] text-white p-3.5 rounded-xl shadow-xl border border-emerald-500/30 text-xs backdrop-blur-md max-w-xs z-50">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <span className="font-extrabold text-amber-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              {label}
            </span>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-teal-200">
              Data Rekapitulasi
            </span>
          </div>

          <div className="space-y-2">
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color || entry.fill }}
                  />
                  <span className="text-gray-200 font-medium">{entry.name}:</span>
                </div>
                <span className="font-black text-white">{entry.value} {entry.unit || ''}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs p-4 sm:p-6 space-y-6 ${className}`}>
      {/* 🟢 TOP HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-[#00685f]/10 text-[#00685f] text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <BarChart3 className="w-3 h-3 text-[#00685f]" />
              Visualisasi Tren BK & Restitusi
            </span>
            <span className="text-[11px] text-gray-500 font-medium">
              Analitik Layanan, Kedisiplinan & Prestasi Siswa
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-[#0b1c30] tracking-tight flex items-center gap-2">
            Ikhtisar Grafik Tren Administrasi BK
          </h2>
        </div>

        {/* Time Range Selector & View Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Range */}
          <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200/80">
            {[
              { id: '3months', label: '3 Bulan' },
              { id: '6months', label: '6 Bulan' },
              { id: 'year', label: '1 Tahun' }
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTimeRange(opt.id as TimeRangeOption)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timeRange === opt.id
                    ? 'bg-[#00685f] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Chart Type Tabs */}
          <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200/80">
            {[
              { id: 'all', label: 'Semua Tren', icon: Layers },
              { id: 'counseling', label: 'Konseling', icon: HeartHandshake },
              { id: 'violations', label: 'Pelanggaran', icon: AlertTriangle },
              { id: 'achievements', label: 'Apresiasi', icon: Award }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as ActiveChartTab)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-white text-[#0b1c30] shadow-xs border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 📊 SUMMARY CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Sesi Konseling */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => onNavigateToTab?.('layanan-bk')}
          className="bg-gradient-to-br from-teal-50/80 to-emerald-50/40 p-4 rounded-xl border border-teal-200/80 shadow-2xs hover:shadow-xs transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#00685f] flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4 text-[#00685f]" />
              Sesi Konseling BK
            </span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
              metricsSummary.counselingGrowth >= 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}>
              {metricsSummary.counselingGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {metricsSummary.counselingGrowth >= 0 ? `+${metricsSummary.counselingGrowth}%` : `${metricsSummary.counselingGrowth}%`}
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-[#0b1c30]">{metricsSummary.totalServices}</span>
              <span className="text-xs text-gray-600 font-bold ml-1">Layanan</span>
            </div>
            <span className="text-[10px] text-teal-800 font-semibold group-hover:underline flex items-center gap-0.5">
              Lihat Detail <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1 font-medium">
            Total sesi bimbingan & konseling dalam rentang waktu terdaftar.
          </p>
        </motion.div>

        {/* Card 2: Catatan Kedisiplinan / Pelanggaran */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => onNavigateToTab?.('pelanggaran-disiplin')}
          className="bg-gradient-to-br from-rose-50/80 to-amber-50/40 p-4 rounded-xl border border-rose-200/80 shadow-2xs hover:shadow-xs transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-rose-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Catatan Kedisiplinan
            </span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
              metricsSummary.violationGrowth <= 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}>
              {metricsSummary.violationGrowth > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {metricsSummary.violationGrowth > 0 ? `+${metricsSummary.violationGrowth}%` : `${metricsSummary.violationGrowth}%`}
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-rose-900">{metricsSummary.totalViolations}</span>
              <span className="text-xs text-gray-600 font-bold ml-1">Kasus</span>
            </div>
            <span className="text-[10px] text-rose-700 font-semibold group-hover:underline flex items-center gap-0.5">
              Lihat Detail <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1 font-medium">
            Kasus pelanggaran yang sedang ditangani dengan restitusi.
          </p>
        </motion.div>

        {/* Card 3: Apresiasi & Prestasi Siswa */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => onNavigateToTab?.('apresiasi-siswa')}
          className="bg-gradient-to-br from-purple-50/80 to-indigo-50/40 p-4 rounded-xl border border-purple-200/80 shadow-2xs hover:shadow-xs transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-purple-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-purple-600" />
              Apresiasi & Prestasi
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 flex items-center gap-0.5">
              <Sparkles className="w-3 h-3 text-purple-600" />
              Kredit Positif
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-purple-900">{metricsSummary.totalAchievements}</span>
              <span className="text-xs text-gray-600 font-bold ml-1">Catatan</span>
            </div>
            <span className="text-[10px] text-purple-700 font-semibold group-hover:underline flex items-center gap-0.5">
              Lihat Detail <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1 font-medium">
            Pencapaian kebaikan & prestasi positif siswa terdata.
          </p>
        </motion.div>

        {/* Card 4: Status Keseimbangan (Balance Ratio) */}
        <div className="bg-gradient-to-br from-amber-50/80 to-teal-50/30 p-4 rounded-xl border border-amber-200/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-amber-600" />
              Indikator Perilaku
            </span>
            <span className="text-[10px] font-bold text-gray-500">
              Bulan {metricsSummary.latestMonthName}
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-[#0b1c30]">
                {metricsSummary.totalAchievements >= metricsSummary.totalViolations ? 'Positif' : 'Perlu Atensi'}
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-amber-300 text-amber-900">
              Apresiasi vs Kasus
            </span>
          </div>
          <p className="text-[10px] text-gray-600 mt-1 font-medium leading-tight">
            {metricsSummary.totalAchievements >= metricsSummary.totalViolations
              ? '✨ Tren positif: Catatan apresiasi seimbang atau melampaui jumlah kasus kedisiplinan.'
              : '⚠️ Pengawasan: Diperlukan dorongan bimbingan suportif untuk meningkatkan perilaku positif.'}
          </p>
        </div>
      </div>

      {/* 📈 MAIN RECHARTS GRAPH VISUALIZATION */}
      <div className="bg-[#f8faf9] p-4 sm:p-5 rounded-2xl border border-[#bcc9c6]/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-extrabold text-[#0b1c30] flex items-center gap-2">
              <span>
                {activeTab === 'all' && 'Grafik Perbandingan: Konseling, Pelanggaran & Apresiasi'}
                {activeTab === 'counseling' && 'Grafik Volume Sesi Bimbingan & Konseling BK'}
                {activeTab === 'violations' && 'Grafik Tren Kasus Kedisiplinan & Bobot Pembinaan'}
                {activeTab === 'achievements' && 'Grafik Perkembangan Apresiasi & Prestasi Positif'}
              </span>
            </h3>
            <p className="text-[11px] text-gray-500 font-medium">
              Sumbu mendatar menunjukkan periode bulan, sumbu tegak menunjukkan jumlah kejadian.
            </p>
          </div>

          {/* Quick Info Badge */}
          <div className="text-[11px] text-[#00685f] bg-[#00685f]/10 font-bold px-3 py-1 rounded-xl flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Arahkan kursor / sentuh titik grafik untuk detail angka</span>
          </div>
        </div>

        {/* Chart Canvas Box */}
        <div className="w-full h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 'all' ? (
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCounseling" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00685f" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#00685f" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorViolations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10, fontWeight: 700 }} />

                <Area type="monotone" dataKey="counseling" name="Sesi Konseling BK" stroke="#00685f" strokeWidth={3} fillOpacity={1} fill="url(#colorCounseling)" />
                <Bar dataKey="violations" name="Kasus Disiplin" fill="#e11d48" radius={[6, 6, 0, 0]} barSize={22} />
                <Line type="monotone" dataKey="achievements" name="Apresiasi & Prestasi" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
              </ComposedChart>
            ) : activeTab === 'counseling' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10, fontWeight: 700 }} />

                <Bar dataKey="individualCounseling" name="Konseling Perorangan" stackId="a" fill="#00685f" radius={[0, 0, 0, 0]} barSize={28} />
                <Bar dataKey="groupCounseling" name="Bimbingan Kelompok" stackId="a" fill="#0d9488" radius={[0, 0, 0, 0]} />
                <Bar dataKey="classicalCounseling" name="Bimbingan Klasikal" stackId="a" fill="#34d399" radius={[6, 6, 0, 0]} />
              </BarChart>
            ) : activeTab === 'violations' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorViolGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10, fontWeight: 700 }} />

                <Area type="monotone" dataKey="violations" name="Jumlah Kasus Disiplin" stroke="#e11d48" strokeWidth={3} fillOpacity={1} fill="url(#colorViolGrad)" />
                <Line type="monotone" dataKey="violationWeight" name="Total Bobot Pembinaan" stroke="#9f1239" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 4 }} />
              </AreaChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10, fontWeight: 700 }} />

                <Bar dataKey="achievements" name="Catatan Prestasi & Apresiasi" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
