import React, { useMemo, useState } from 'react';
import { ViolationRecord } from '../types';
import { Search, Copy, Check, ShieldCheck, Inbox } from 'lucide-react';
import { isRealNonDummyViolation } from '../utils/purgeDummyData';
import { isPiketReferralViolation } from './CatatPelanggaranForm';
import RujukanCard from './RujukanCard';
import {
  getPiketLinkUrl,
  getRujukanCategoryLabel,
  getRujukanItemStatus,
  getRujukanReporterName,
  getRujukanSpecificBehaviors,
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
}

export default function RujukanPiketView({
  violations = [],
  initialSearch = '',
  onTindakLanjuti,
  onNavigateToProfile,
  onOpenArsip,
}: RujukanPiketViewProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<RujukanStatusTab>('Semua');
  const [onlyPiketSource, setOnlyPiketSource] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const realViolations = useMemo(
    () => (violations || []).filter((v) => v && v.isDeleted !== true && isRealNonDummyViolation(v)),
    [violations]
  );

  const piketOnlyCount = useMemo(
    () => realViolations.filter((v) => isPiketReferralViolation(v)).length,
    [realViolations]
  );

  const baseList = useMemo(() => {
    const src = onlyPiketSource
      ? realViolations.filter((v) => isPiketReferralViolation(v))
      : realViolations;
    return sortRujukanList(src);
  }, [realViolations, onlyPiketSource]);

  const counts = useMemo(() => {
    let baru = 0;
    let ditindak = 0;
    let selesai = 0;
    baseList.forEach((v) => {
      const st = getRujukanItemStatus(v);
      if (st === 'Baru') baru++;
      else if (st === 'Sudah Ditindaklanjuti') ditindak++;
      else selesai++;
    });
    return {
      Semua: baseList.length,
      Baru: baru,
      'Sudah Ditindaklanjuti': ditindak,
      Selesai: selesai,
    };
  }, [baseList]);

  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return baseList.filter((v) => {
      if (statusFilter !== 'Semua' && getRujukanItemStatus(v) !== statusFilter) {
        return false;
      }
      if (!q) return true;
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
  }, [baseList, statusFilter, searchTerm]);

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

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-[#bcc9c6]/45 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#00685f] bg-[#e6f4f1] px-2.5 py-0.5 rounded-lg border border-[#00685f]/20">
              Alur Pembinaan BK
            </span>
            {counts.Baru > 0 && (
              <span className="text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-0.5 rounded-full">
                {counts.Baru} Rujukan Baru Belum Dibina
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0b1c30] tracking-tight">
            Rujukan dari Piket
          </h2>
          <p className="text-xs sm:text-sm text-[#3d4947]">
            Daftar rujukan perilaku dari Guru Piket / Kesiswaan untuk ditindaklanjuti melalui pembinaan, konseling, dan Segitiga Restitusi.
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

      {/* Search & Filter Container */}
      <div className="bg-white rounded-2xl border border-[#bcc9c6]/45 p-4 sm:p-5 shadow-2xs space-y-3.5">
        {/* Baris Pencarian Utama yang Selalu Terlihat */}
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

        {/* Filter Status: [Semua] [Baru] [Sudah Ditindaklanjuti] [Selesai] */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl border border-[#bcc9c6]/30">
            {(['Semua', 'Baru', 'Sudah Ditindaklanjuti', 'Selesai'] as RujukanStatusTab[]).map((tab) => {
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

          {piketOnlyCount > 0 && piketOnlyCount < realViolations.length && (
            <button
              type="button"
              onClick={() => setOnlyPiketSource((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                onlyPiketSource
                  ? 'bg-[#e6f4f1] text-[#00685f] border-[#00685f]/30'
                  : 'bg-white text-[#3d4947] border-gray-200 hover:bg-gray-50'
              }`}
            >
              {onlyPiketSource ? 'Hanya Link Piket (Aktif)' : `Tampilkan Khusus Link Piket (${piketOnlyCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Daftar Kartu Rujukan */}
      {filteredList.length > 0 ? (
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
              : 'Belum ada rujukan yang sesuai status ini. Bagikan Link Piket ke Guru Piket untuk menerima rujukan baru.'}
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
