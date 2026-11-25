import React, { useMemo, useState } from 'react';
import { ViolationRecord } from '../types';
import {
  Search,
  Copy,
  Check,
  ShieldCheck,
  Inbox,
  CheckCheck,
  Archive,
  ChevronDown,
  ChevronRight,
  Layers,
  List,
} from 'lucide-react';
import { isRealNonDummyViolation } from '../utils/purgeDummyData';
import { isAttendanceViolation } from './CatatPelanggaranForm';
import RujukanCard from './RujukanCard';
import {
  formatCompactRujukanDate,
  getPiketLinkUrl,
  getRujukanCategoryLabel,
  getRujukanItemStatus,
  getRujukanReporterName,
  getRujukanSpecificBehaviors,
  getViolationSortMs,
  isDataLamaViolation,
  isRujukanBaruPiket,
  RujukanStatusTab,
  sortRujukanList,
} from '../utils/rujukanHelper';
import { showToast } from '../utils/toast';

interface RujukanPiketViewProps {
  violations: ViolationRecord[];
  initialSearch?: string;
  onTindakLanjuti: (violation: ViolationRecord) => void;
  onNavigateToProfile?: (studentIdOrName: string) => void;
  onOpenArsip?: () => void;
  onBulkMarkAlpaDone?: (items: ViolationRecord[]) => Promise<void> | void;
  onArchiveAllDataLama?: (items: ViolationRecord[]) => Promise<void> | void;
}

interface StudentReferralGroup {
  key: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  items: ViolationRecord[];
  baruCount: number;
  isAllDataLama: boolean;
  isAllArchived: boolean;
  summaryText: string;
  latestDateText: string;
  latestMs: number;
}

export default function RujukanPiketView({
  violations = [],
  initialSearch = '',
  onTindakLanjuti,
  onNavigateToProfile,
  onOpenArsip,
  onBulkMarkAlpaDone,
  onArchiveAllDataLama,
}: RujukanPiketViewProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<RujukanStatusTab>('Semua');
  const [onlyPiketSource, setOnlyPiketSource] = useState(false);
  const [groupByStudent, setGroupByStudent] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'alpa' | 'archive' | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const realViolations = useMemo(
    () => (violations || []).filter((v) => v && v.isDeleted !== true && isRealNonDummyViolation(v)),
    [violations]
  );

  // Rujukan aktif (belum diarsipkan dari halaman Rujukan)
  const activeReferrals = useMemo(
    () => realViolations.filter((v) => !v.archivedFromRujukan),
    [realViolations]
  );

  // Semua Data Lama (termasuk Absensi Harian / input BK lama, tetap tampil di tab Data Lama)
  const dataLamaList = useMemo(
    () => realViolations.filter((v) => isDataLamaViolation(v)),
    [realViolations]
  );

  const piketOnlyCount = useMemo(
    () => activeReferrals.filter((v) => isRujukanBaruPiket(v)).length,
    [activeReferrals]
  );

  const unfinishedAlpaLamaItems = useMemo(
    () =>
      realViolations.filter(
        (v) =>
          isDataLamaViolation(v) &&
          isAttendanceViolation(v) &&
          getRujukanItemStatus(v) !== 'Selesai'
      ),
    [realViolations]
  );

  const unarchivedDataLamaItems = useMemo(
    () => realViolations.filter((v) => isDataLamaViolation(v) && !v.archivedFromRujukan),
    [realViolations]
  );

  const baseActiveList = useMemo(() => {
    const src = onlyPiketSource
      ? activeReferrals.filter((v) => isRujukanBaruPiket(v))
      : activeReferrals;
    return sortRujukanList(src);
  }, [activeReferrals, onlyPiketSource]);

  const sortedDataLamaList = useMemo(() => sortRujukanList(dataLamaList), [dataLamaList]);

  const counts = useMemo(() => {
    let baru = 0;
    let ditindak = 0;
    let selesai = 0;
    baseActiveList.forEach((v) => {
      const st = getRujukanItemStatus(v);
      if (st === 'Baru') baru++;
      else if (st === 'Sudah Ditindaklanjuti') ditindak++;
      else selesai++;
    });
    return {
      Semua: baseActiveList.length,
      Baru: baru,
      'Sudah Ditindaklanjuti': ditindak,
      Selesai: selesai,
      'Data Lama': sortedDataLamaList.length,
    };
  }, [baseActiveList, sortedDataLamaList]);

  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const sourceList =
      statusFilter === 'Data Lama'
        ? sortedDataLamaList
        : baseActiveList.filter((v) =>
            statusFilter === 'Semua' ? true : getRujukanItemStatus(v) === statusFilter
          );

    if (!q) return sourceList;

    return sourceList.filter((v) => {
      const name = String(v.studentName || '').toLowerCase();
      const cls = String(v.studentClass || '').toLowerCase();
      const nis = String(v.nis || '').toLowerCase();
      const cat = getRujukanCategoryLabel(v).toLowerCase();
      const rawCat = String(v.category || '').toLowerCase();
      const chips = getRujukanSpecificBehaviors(v).join(' ').toLowerCase();
      const reporter = getRujukanReporterName(v).toLowerCase();
      const loc = String(v.location || '').toLowerCase();
      return (
        name.includes(q) ||
        cls.includes(q) ||
        nis.includes(q) ||
        cat.includes(q) ||
        rawCat.includes(q) ||
        chips.includes(q) ||
        reporter.includes(q) ||
        loc.includes(q)
      );
    });
  }, [baseActiveList, sortedDataLamaList, statusFilter, searchTerm]);

  // Kelompokkan berdasarkan Siswa
  const studentGroups = useMemo<StudentReferralGroup[]>(() => {
    const map = new Map<string, ViolationRecord[]>();

    filteredList.forEach((v) => {
      const sId = String(v.studentId || '').trim();
      const sName = String(v.studentName || 'Siswa').trim().toLowerCase();
      const sClass = String(v.studentClass || '').trim().toLowerCase();
      const key = sId && sId !== 'manual' ? `id:${sId}` : `nc:${sName}__${sClass}`;
      const existing = map.get(key);
      if (existing) {
        existing.push(v);
      } else {
        map.set(key, [v]);
      }
    });

    const groups: StudentReferralGroup[] = [];

    map.forEach((rawItems, key) => {
      const items = rawItems.slice().sort((a, b) => getViolationSortMs(b) - getViolationSortMs(a));
      const latest = items[0];
      const baruCount = items.filter((it) => getRujukanItemStatus(it) === 'Baru').length;
      const isAllDataLama = items.every((it) => isDataLamaViolation(it));
      const isAllArchived = items.every((it) => Boolean(it.archivedFromRujukan));

      // Ringkasan kategori/perilaku siswa, contoh: "3x Alpa" atau "2x Kedisiplinan"
      const behaviorCounts = new Map<string, number>();
      const catCounts = new Map<string, number>();
      items.forEach((it) => {
        const firstBehavior = getRujukanSpecificBehaviors(it)[0] || getRujukanCategoryLabel(it);
        const cat = getRujukanCategoryLabel(it);
        behaviorCounts.set(firstBehavior, (behaviorCounts.get(firstBehavior) || 0) + 1);
        catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
      });

      let summaryText = `${items.length}x Rujukan`;
      if (behaviorCounts.size === 1) {
        const onlyBeh = Array.from(behaviorCounts.keys())[0];
        summaryText = `${items.length}x ${onlyBeh}`;
      } else if (catCounts.size === 1) {
        const onlyCat = Array.from(catCounts.keys())[0];
        summaryText = `${items.length}x ${onlyCat}`;
      } else {
        const topBehaviors = Array.from(behaviorCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([label, cnt]) => `${cnt}x ${label}`);
        summaryText = topBehaviors.join(', ');
      }

      groups.push({
        key,
        studentId: latest.studentId || '',
        studentName: latest.studentName || 'Siswa',
        studentClass: latest.studentClass || '',
        items,
        baruCount,
        isAllDataLama,
        isAllArchived,
        summaryText,
        latestDateText: formatCompactRujukanDate(latest.date),
        latestMs: getViolationSortMs(latest),
      });
    });

    return groups.sort((a, b) => {
      const aHasBaru = a.baruCount > 0 ? 0 : 1;
      const bHasBaru = b.baruCount > 0 ? 0 : 1;
      if (aHasBaru !== bHasBaru) return aHasBaru - bHasBaru;
      return b.latestMs - a.latestMs;
    });
  }, [filteredList]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopyLinkPiket = async () => {
    const url = getPiketLinkUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      showToast('Link Piket berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedLink(true);
      showToast('Link Piket berhasil disalin!', 'success');
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleConfirmBulk = async () => {
    if (!confirmAction) return;
    setIsBulkProcessing(true);
    try {
      if (confirmAction === 'alpa' && onBulkMarkAlpaDone) {
        await onBulkMarkAlpaDone(unfinishedAlpaLamaItems);
      } else if (confirmAction === 'archive' && onArchiveAllDataLama) {
        await onArchiveAllDataLama(unarchivedDataLamaItems);
      }
      setConfirmAction(null);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-10">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-[#bcc9c6]/45 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#00685f] bg-[#e6f4f1] px-2.5 py-0.5 rounded-lg border border-[#00685f]/20">
              Alur Pembinaan BK
            </span>
            {counts.Baru > 0 && (
              <span className="text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-0.5 rounded-full">
                {counts.Baru} Baru Belum Dibina
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0b1c30] tracking-tight">
            Rujukan dari Piket
          </h2>
          <p className="text-xs sm:text-sm text-[#3d4947]">
            Daftar rujukan perilaku dari Guru Piket yang dikelompokkan per siswa. Data lama &amp; absensi dipisahkan di filter Data Lama.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyLinkPiket}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#e6f4f1] hover:bg-[#00685f] text-[#00685f] hover:text-white border border-[#00685f]/25 text-xs font-extrabold transition-all cursor-pointer shadow-2xs"
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'Link Tersalin' : 'Salin Link Piket'}</span>
          </button>
          {onOpenArsip && (
            <button
              type="button"
              onClick={onOpenArsip}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-[#0b1c30] border border-[#bcc9c6]/60 text-xs font-bold transition-all cursor-pointer"
            >
              <span>Arsip Pembinaan</span>
            </button>
          )}
        </div>
      </div>

      {/* Search, Filter Tabs & Grouping Toggle */}
      <div className="bg-white rounded-2xl border border-[#bcc9c6]/45 p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="relative">
          <Search className="w-4 h-4 text-[#00685f] absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Cari Nama Siswa, Kelas, Kategori, Perilaku Spesifik, atau Nama Guru Piket..."
            className="w-full bg-[#f8faf9] border border-[#bcc9c6]/60 focus:border-[#00685f] focus:bg-white rounded-xl pl-10 pr-20 py-2.5 text-sm font-semibold text-[#0b1c30] focus:outline-none transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 px-2.5 py-1 rounded-lg bg-gray-200/80 hover:bg-gray-300 text-[11px] font-bold text-gray-700 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        {/* Filter Tabs: [Semua] [Baru] [Sudah Ditindaklanjuti] [Selesai] [Data Lama] */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl border border-[#bcc9c6]/30">
            {(
              ['Semua', 'Baru', 'Sudah Ditindaklanjuti', 'Selesai', 'Data Lama'] as RujukanStatusTab[]
            ).map((tab) => {
              const active = statusFilter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#00685f] text-white shadow-xs'
                      : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-gray-200/50'
                  }`}
                >
                  <span>{tab}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-white text-[#3d4947]'
                    }`}
                  >
                    {counts[tab]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {statusFilter !== 'Data Lama' &&
              piketOnlyCount > 0 &&
              piketOnlyCount < activeReferrals.length && (
                <button
                  type="button"
                  onClick={() => setOnlyPiketSource((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    onlyPiketSource
                      ? 'bg-[#e6f4f1] text-[#00685f] border-[#00685f]/30'
                      : 'bg-white text-[#3d4947] border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {onlyPiketSource
                    ? 'Khusus Link Piket (Aktif)'
                    : `Khusus Link Piket (${piketOnlyCount})`}
                </button>
              )}

            {/* Toggle Pengelompokan Siswa vs Daftar Lengkap */}
            <div className="inline-flex items-center bg-gray-100 p-1 rounded-xl border border-[#bcc9c6]/30">
              <button
                type="button"
                onClick={() => setGroupByStudent(true)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                  groupByStudent ? 'bg-white text-[#00685f] shadow-2xs' : 'text-[#3d4947]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Per Siswa</span>
              </button>
              <button
                type="button"
                onClick={() => setGroupByStudent(false)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                  !groupByStudent ? 'bg-white text-[#00685f] shadow-2xs' : 'text-[#3d4947]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Semua Kartu</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tombol Pembersihan / Penandaan Massal Data Lama */}
        {(unfinishedAlpaLamaItems.length > 0 || unarchivedDataLamaItems.length > 0) && (
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[#3d4947]">
                Rapikan Data Lama / Alpa Absensi:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {unfinishedAlpaLamaItems.length > 0 && onBulkMarkAlpaDone && (
                  <button
                    type="button"
                    disabled={isBulkProcessing}
                    onClick={() => setConfirmAction('alpa')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>
                      Tandai Semua Alpa Lama Sudah Dibina ({unfinishedAlpaLamaItems.length})
                    </span>
                  </button>
                )}

                {unarchivedDataLamaItems.length > 0 && onArchiveAllDataLama && (
                  <button
                    type="button"
                    disabled={isBulkProcessing}
                    onClick={() => setConfirmAction('archive')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Arsipkan Semua Data Lama ({unarchivedDataLamaItems.length})</span>
                  </button>
                )}
              </div>
            </div>

            {confirmAction && (
              <div className="rounded-xl bg-[#f8faf9] border border-[#00685f]/30 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <p className="text-xs font-semibold text-[#0b1c30]">
                  {confirmAction === 'alpa'
                    ? `Tandai ${unfinishedAlpaLamaItems.length} catatan Alpa / Absensi lama sebagai Selesai dibina? Data tetap tersimpan aman di riwayat.`
                    : `Arsipkan ${unarchivedDataLamaItems.length} data lama agar halaman Rujukan bersih? Semua data tetap aman & bisa dilihat kapan saja di tab Data Lama atau Arsip Pembinaan.`}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isBulkProcessing}
                    onClick={() => setConfirmAction(null)}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 text-[#3d4947] border border-gray-300 text-xs font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isBulkProcessing}
                    onClick={handleConfirmBulk}
                    className="px-3.5 py-1.5 rounded-lg bg-[#00685f] hover:bg-[#005049] text-white text-xs font-extrabold cursor-pointer disabled:opacity-60"
                  >
                    {isBulkProcessing ? 'Menyimpan...' : 'Ya, Terapkan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Daftar Rujukan */}
      {filteredList.length > 0 ? (
        groupByStudent ? (
          <div className="bg-white rounded-2xl border border-[#bcc9c6]/45 shadow-2xs overflow-hidden divide-y divide-slate-100">
            {studentGroups.map((group) => {
              const isExpanded = Boolean(expandedKeys[group.key]);
              return (
                <div key={group.key} className="bg-white">
                  <button
                    type="button"
                    onClick={() => toggleExpand(group.key)}
                    className="w-full px-4 py-3.5 sm:px-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 text-left hover:bg-[#f8faf9] transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
                      <span className="font-extrabold text-[#0b1c30] truncate">
                        {group.studentName}
                        {group.studentClass ? ` - ${group.studentClass}` : ''}
                      </span>
                      <span className="text-slate-300 hidden sm:inline">|</span>
                      <span className="font-bold text-[#00685f] bg-[#e6f4f1] px-2 py-0.5 rounded-lg text-[11px] sm:text-xs">
                        {group.summaryText}
                      </span>
                      <span className="text-slate-300 hidden sm:inline">|</span>
                      <span className="text-xs font-medium text-[#3d4947]">
                        Terakhir {group.latestDateText}
                      </span>

                      {group.baruCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-black">
                          {group.baruCount} Baru
                        </span>
                      )}
                      {group.isAllDataLama && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                          Data Lama
                        </span>
                      )}
                      {group.isAllArchived && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
                          Diarsipkan
                        </span>
                      )}
                    </div>

                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 text-xs font-extrabold text-[#00685f] shrink-0">
                      <span>{isExpanded ? 'Tutup' : 'Lihat'}</span>
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 sm:px-5 bg-[#f8faf9] border-t border-slate-100 space-y-2.5">
                      {group.items.map((v) => (
                        <RujukanCard
                          key={v.id}
                          violation={v}
                          onTindakLanjuti={onTindakLanjuti}
                          onOpenProfile={onNavigateToProfile}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredList.map((v) => (
              <RujukanCard
                key={v.id}
                violation={v}
                onTindakLanjuti={onTindakLanjuti}
                onOpenProfile={onNavigateToProfile}
              />
            ))}
          </div>
        )
      ) : (
        <div className="bg-white rounded-2xl border border-[#bcc9c6]/45 p-10 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-[#e6f4f1] text-[#00685f] flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-[#0b1c30]">
            Tidak ada rujukan pada filter ini
          </h3>
          <p className="text-xs text-[#3d4947] max-w-md mx-auto">
            {searchTerm
              ? `Tidak ditemukan rujukan dengan kata kunci "${searchTerm}".`
              : statusFilter === 'Data Lama'
              ? 'Belum ada data pelanggaran lama yang tersimpan.'
              : 'Belum ada rujukan aktif pada status ini. Bagikan Link Piket ke Guru Piket atau buka tab Data Lama untuk melihat riwayat lama.'}
          </p>
          {(searchTerm || statusFilter !== 'Semua' || onlyPiketSource) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('Semua');
                setOnlyPiketSource(false);
              }}
              className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold cursor-pointer"
            >
              Tampilkan Semua Rujukan
            </button>
          )}
        </div>
      )}

      {/* Catatan Regulasi */}
      <div className="bg-[#f8faf9] border border-[#bcc9c6]/40 rounded-2xl p-3.5 flex items-start gap-2 text-xs text-[#3d4947]">
        <ShieldCheck className="w-4 h-4 text-[#00685f] shrink-0 mt-0.5" />
        <p>
          Sesuai Permendikbudristek 46/2023, BK tidak memberikan sanksi. BK melakukan pembinaan, konseling, dan restitusi atas rujukan dari Piket / Kesiswaan.
        </p>
      </div>
    </div>
  );
}
