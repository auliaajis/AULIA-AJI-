import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  BarChart3,
  Calendar,
  Layers,
  Plus,
  HeartHandshake,
  ArrowUpRight,
  Info,
  TrendingUp,
  Sparkles,
  SlidersHorizontal,
  Check
} from 'lucide-react';
import { CounselingService } from '../types';

interface GrafikLayananBulananCardProps {
  services: CounselingService[];
  onNavigateToForm?: (form: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

type TimeRangeMode = '3months' | '6months' | 'year';
type ChartDisplayMode = 'stacked' | 'grouped';

// Standard BK Service Categories & Theme Colors (Clean Teal & Slate Palette)
export const SERVICE_CATEGORIES = [
  { key: 'individual', label: 'Konseling Individual', color: '#00685f', desc: 'Konseling tatap muka 1-on-1' },
  { key: 'bimbinganKelompok', label: 'Bimbingan Kelompok', color: '#0284c7', desc: 'Dinamika kelompok 4-8 siswa' },
  { key: 'klasikal', label: 'Bimbingan Klasikal', color: '#10b981', desc: 'Layanan terpadu 1 rombel kelas' },
  { key: 'konselingKelompok', label: 'Konseling Kelompok', color: '#6366f1', desc: 'Konseling kuratif kelompok kecil' },
  { key: 'konsultasi', label: 'Konsultasi & Mediasi', color: '#f59e0b', desc: 'Konsultasi ortu/guru & mediasi damai' },
  { key: 'homeVisit', label: 'Kunjungan Rumah', color: '#8b5cf6', desc: 'Home visit pendampingan keluarga' },
  { key: 'referralLainnya', label: 'Alih Tangan / Lainnya', color: '#64748b', desc: 'Konferensi kasus & rujukan ahli' }
];

const MONTH_NAMES_IND = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_SHORT_IND = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
];

// Helper to normalize and categorize service type
function categorizeService(service: CounselingService): string {
  const typeStr = (service.serviceType || '').toLowerCase();
  const targetStr = (service.targetType || '').toLowerCase();
  const titleStr = (service.problem || '').toLowerCase();
  const combined = `${typeStr} ${targetStr} ${titleStr}`;

  if (combined.includes('home visit') || combined.includes('kunjungan rumah')) {
    return 'homeVisit';
  }
  if (combined.includes('mediasi') || combined.includes('konsultasi') || combined.includes('advokasi')) {
    return 'konsultasi';
  }
  if (combined.includes('konferensi') || combined.includes('alih tangan') || combined.includes('referral') || combined.includes('rujukan')) {
    return 'referralLainnya';
  }
  if (combined.includes('konseling kelompok')) {
    return 'konselingKelompok';
  }
  if (combined.includes('bimbingan kelompok')) {
    return 'bimbinganKelompok';
  }
  if (combined.includes('klasikal') || combined.includes('orientasi') || combined.includes('informasi') || combined.includes('konten')) {
    return 'klasikal';
  }
  if (combined.includes('individu') || combined.includes('perorangan') || combined.includes('pribadi')) {
    return 'individual';
  }
  // Default fallback based on targetType
  if (targetStr === 'klasikal') return 'klasikal';
  if (targetStr === 'kelompok') return 'bimbinganKelompok';
  return 'individual';
}

export default function GrafikLayananBulananCard({
  services = [],
  onNavigateToForm,
  onNavigateToTab
}: GrafikLayananBulananCardProps) {
  const [timeRange, setTimeRange] = useState<TimeRangeMode>('6months');
  const [displayMode, setDisplayMode] = useState<ChartDisplayMode>('stacked');
  const [activeCategories, setActiveCategories] = useState<Record<string, boolean>>({
    individual: true,
    bimbinganKelompok: true,
    klasikal: true,
    konselingKelompok: true,
    konsultasi: true,
    homeVisit: true,
    referralLainnya: true
  });

  const toggleCategory = (key: string) => {
    setActiveCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Build month slots
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const monthlyDataset = useMemo(() => {
    let monthCount = 6;
    if (timeRange === '3months') monthCount = 3;
    if (timeRange === 'year') monthCount = 12;

    const slots: { year: number; month: number; label: string; fullLabel: string; key: string }[] = [];

    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      const shortLabel = `${MONTH_SHORT_IND[m]} ${y !== currentYear ? `'${String(y).slice(-2)}` : ''}`;
      const fullLabel = `${MONTH_NAMES_IND[m]} ${y}`;

      slots.push({
        year: y,
        month: m,
        label: shortLabel,
        fullLabel,
        key: monthKey
      });
    }

    return slots.map(slot => {
      // Find all services in this month
      const monthServices = services.filter(s => {
        if (!s.date) return false;
        const clean = String(s.date).trim();
        if (clean.startsWith(slot.key)) return true;
        const d = new Date(clean);
        if (!isNaN(d.getTime())) {
          return d.getFullYear() === slot.year && d.getMonth() === slot.month;
        }
        return false;
      });

      const counts: Record<string, number> = {
        individual: 0,
        bimbinganKelompok: 0,
        klasikal: 0,
        konselingKelompok: 0,
        konsultasi: 0,
        homeVisit: 0,
        referralLainnya: 0
      };

      monthServices.forEach(srv => {
        const cat = categorizeService(srv);
        counts[cat] = (counts[cat] || 0) + 1;
      });

      const total = Object.values(counts).reduce((acc, curr) => acc + curr, 0);

      return {
        month: slot.label,
        fullMonth: slot.fullLabel,
        monthKey: slot.key,
        total,
        ...counts
      };
    });
  }, [services, timeRange, currentYear, currentMonth]);

  // Aggregate statistics across current time window
  const summaryStats = useMemo(() => {
    let grandTotal = 0;
    const catTotals: Record<string, number> = {
      individual: 0,
      bimbinganKelompok: 0,
      klasikal: 0,
      konselingKelompok: 0,
      konsultasi: 0,
      homeVisit: 0,
      referralLainnya: 0
    };

    monthlyDataset.forEach(row => {
      grandTotal += row.total;
      SERVICE_CATEGORIES.forEach(c => {
        catTotals[c.key] += (row as any)[c.key] || 0;
      });
    });

    const averagePerMonth = monthlyDataset.length > 0 ? (grandTotal / monthlyDataset.length).toFixed(1) : '0';

    // Find most dominant service type
    const sortedCats = [...SERVICE_CATEGORIES].sort((a, b) => catTotals[b.key] - catTotals[a.key]);
    const topCategory = sortedCats[0];
    const topCategoryCount = catTotals[topCategory.key] || 0;
    const topCategoryPercent = grandTotal > 0 ? Math.round((topCategoryCount / grandTotal) * 100) : 0;

    // Trend compare (last month vs previous)
    const lastMonth = monthlyDataset[monthlyDataset.length - 1]?.total || 0;
    const secondLastMonth = monthlyDataset[monthlyDataset.length - 2]?.total || 0;
    const growth = lastMonth - secondLastMonth;

    return {
      grandTotal,
      averagePerMonth,
      catTotals,
      topCategory,
      topCategoryCount,
      topCategoryPercent,
      growth,
      lastMonth
    };
  }, [monthlyDataset]);

  // Custom Recharts Tooltip
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const rowData = payload[0]?.payload;
      const monthTotal = rowData?.total || 0;

      return (
        <div className="bg-[#0b1c30] text-white p-3.5 rounded-xl shadow-2xl border border-white/10 text-xs backdrop-blur-md min-w-[210px] z-50">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/15">
            <span className="font-extrabold text-[#e6f4f1] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#00685f]" />
              {rowData?.fullMonth || label}
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#00685f] text-white">
              Total {monthTotal} Sesi
            </span>
          </div>

          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => {
              if (entry.value === 0) return null;
              const percent = monthTotal > 0 ? Math.round((entry.value / monthTotal) * 100) : 0;
              return (
                <div key={`tooltip-${index}`} className="flex items-center justify-between gap-3 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-gray-300 truncate">{entry.name}:</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-black text-white">{entry.value}</span>
                    <span className="text-[10px] text-gray-400 font-semibold">({percent}%)</span>
                  </div>
                </div>
              );
            })}
            {monthTotal === 0 && (
              <p className="text-[11px] text-gray-400 italic py-1">Belum ada sesi bimbingan terdata.</p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xs border border-[#bcc9c6]/30 overflow-hidden transition-all duration-200">
      {/* Header Container */}
      <div className="p-5 sm:p-6 border-b border-[#bcc9c6]/20 bg-gradient-to-r from-white via-[#fcfdfd] to-[#f6f9f8]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#00685f]/10 text-[#00685f] border border-[#00685f]/20 flex items-center justify-center shrink-0 mt-0.5">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-[#0b1c30]">
                  Grafik Batang Bulanan Jenis Layanan BK
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#00685f]/10 text-[#00685f] border border-[#00685f]/20">
                  Recharts Visualizer
                </span>
              </div>
              <p className="text-xs text-[#3d4947]/75 font-semibold mt-1">
                Distribusi penyelenggaraan konseling individual, kelompok, klasikal, konsultasi, dan tindak lanjut per bulan.
              </p>
            </div>
          </div>

          {/* Action & Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap self-start lg:self-center">
            {/* Range Toggle */}
            <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200/80">
              <button
                type="button"
                onClick={() => setTimeRange('3months')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timeRange === '3months'
                    ? 'bg-[#00685f] text-white shadow-2xs'
                    : 'text-[#3d4947] hover:text-[#0b1c30]'
                }`}
              >
                3 Bulan
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('6months')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timeRange === '6months'
                    ? 'bg-[#00685f] text-white shadow-2xs'
                    : 'text-[#3d4947] hover:text-[#0b1c30]'
                }`}
              >
                6 Bulan
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('year')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timeRange === 'year'
                    ? 'bg-[#00685f] text-white shadow-2xs'
                    : 'text-[#3d4947] hover:text-[#0b1c30]'
                }`}
              >
                1 Tahun
              </button>
            </div>

            {/* Display Mode: Stacked vs Grouped */}
            <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200/80">
              <button
                type="button"
                onClick={() => setDisplayMode('stacked')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  displayMode === 'stacked'
                    ? 'bg-[#00685f] text-white shadow-2xs'
                    : 'text-[#3d4947] hover:text-[#0b1c30]'
                }`}
                title="Tampilkan grafik bertumpuk (komposisi proporsi)"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Tumpuk</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('grouped')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  displayMode === 'grouped'
                    ? 'bg-[#00685f] text-white shadow-2xs'
                    : 'text-[#3d4947] hover:text-[#0b1c30]'
                }`}
                title="Tampilkan grafik batang berdampingan per jenis"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Berdampingan</span>
              </button>
            </div>

            {/* Direct Action Link to Log Service */}
            {onNavigateToForm && (
              <button
                type="button"
                onClick={() => onNavigateToForm('tambah-layanan')}
                className="px-3.5 py-1.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 active:scale-97"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Catat Layanan</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Summary Highlight Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#bcc9c6]/20">
          <div className="p-3 bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/25">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Total Layanan ({timeRange === 'year' ? '12 Bln' : timeRange === '6months' ? '6 Bln' : '3 Bln'})
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-[#0b1c30]">{summaryStats.grandTotal}</span>
              <span className="text-[11px] text-gray-500 font-semibold">Sesi</span>
            </div>
          </div>

          <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-200/60">
            <span className="text-[10px] font-bold text-[#00685f] uppercase tracking-wider block">
              Layanan Paling Dominan
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm font-black text-[#0b1c30] truncate" title={summaryStats.topCategory.label}>
                {summaryStats.topCategory.label}
              </span>
              <span className="text-[11px] text-[#00685f] font-bold shrink-0">
                ({summaryStats.topCategoryPercent}%)
              </span>
            </div>
          </div>

          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/60">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
              Rata-rata Bulanan
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-blue-950">{summaryStats.averagePerMonth}</span>
              <span className="text-[11px] text-blue-800 font-semibold">Sesi / bln</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/60">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
              Aktivitas Bulan Terakhir
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-emerald-950">{summaryStats.lastMonth}</span>
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${summaryStats.growth >= 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'}`}>
                {summaryStats.growth >= 0 ? `+${summaryStats.growth}` : summaryStats.growth} vs lalu
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Bar Chart Canvas */}
      <div className="p-5 sm:p-6 space-y-5">
        <div className="w-full h-72 sm:h-84">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyDataset}
              margin={{ top: 15, right: 15, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomBarTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 14, fontWeight: 700 }}
                iconType="circle"
              />

              {SERVICE_CATEGORIES.map((cat, idx) => {
                if (!activeCategories[cat.key]) return null;
                const isFirst = idx === 0;
                const isLast = idx === SERVICE_CATEGORIES.length - 1;

                return (
                  <Bar
                    key={cat.key}
                    dataKey={cat.key}
                    name={cat.label}
                    fill={cat.color}
                    stackId={displayMode === 'stacked' ? 'a' : undefined}
                    barSize={displayMode === 'stacked' ? 28 : 10}
                    radius={
                      displayMode === 'stacked'
                        ? isLast
                          ? [4, 4, 0, 0]
                          : [0, 0, 0, 0]
                        : [4, 4, 0, 0]
                    }
                  />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Filters & Legend Chips */}
        <div className="pt-2 border-t border-[#bcc9c6]/20">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
              Filter / Tampilkan Jenis Layanan pada Grafik:
            </span>
            <span className="text-[10px] text-gray-400 font-semibold hidden sm:inline">
              Klik chip untuk sembunyikan/tampilkan batang
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {SERVICE_CATEGORIES.map(cat => {
              const isEnabled = activeCategories[cat.key];
              const count = summaryStats.catTotals[cat.key] || 0;

              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => toggleCategory(cat.key)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border active:scale-97 ${
                    isEnabled
                      ? 'bg-white shadow-2xs border-gray-200/90 text-[#0b1c30]'
                      : 'bg-gray-100/70 text-gray-400 border-gray-200/50 line-through'
                  }`}
                  title={`${cat.desc} - Total ${count} sesi`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: isEnabled ? cat.color : '#cbd5e1' }}
                  />
                  <span>{cat.label}</span>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-gray-100 text-gray-700 ml-0.5">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Note with Navigation */}
        <div className="p-3 bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-[#00685f] shrink-0" />
            <span className="text-[#3d4947] font-semibold">
              Data layanan terhubung secara otomatis dengan buku konseling digital dan rekapitulasi berkala.
            </span>
          </div>
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('laporan-rekap')}
              className="text-[#00685f] hover:text-[#005049] font-extrabold flex items-center gap-1 hover:underline cursor-pointer shrink-0"
            >
              <span>Buka Laporan Rekap BK</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
