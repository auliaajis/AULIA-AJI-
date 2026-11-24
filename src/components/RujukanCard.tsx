import React from 'react';
import { ViolationRecord } from '../types';
import { Clock, MapPin, UserCheck, ArrowRight, FileText } from 'lucide-react';
import { formatCardDateTime } from '../utils/dateFormatter';
import { isPiketReferralViolation } from './CatatPelanggaranForm';
import {
  getRujukanCategoryLabel,
  getRujukanItemStatus,
  getRujukanPiketNotes,
  getRujukanReporterName,
  getRujukanSpecificBehaviors,
} from '../utils/rujukanHelper';

interface RujukanCardProps {
  violation: ViolationRecord;
  onTindakLanjuti: (violation: ViolationRecord) => void;
  onOpenProfile?: (studentIdOrName: string) => void;
  compact?: boolean;
}

const CATEGORY_BADGE_MAP: Record<string, string> = {
  Perundungan: 'bg-rose-50 text-rose-800 border-rose-200',
  'Kekerasan Fisik': 'bg-red-50 text-red-800 border-red-200',
  'Kekerasan Seksual': 'bg-purple-50 text-purple-800 border-purple-200',
  Diskriminasi: 'bg-orange-50 text-orange-800 border-orange-200',
  Kedisiplinan: 'bg-amber-50 text-amber-900 border-amber-200',
  'Integritas Akademik': 'bg-sky-50 text-sky-800 border-sky-200',
};

export default function RujukanCard({
  violation,
  onTindakLanjuti,
  onOpenProfile,
  compact = false,
}: RujukanCardProps) {
  const status = getRujukanItemStatus(violation);
  const categoryLabel = getRujukanCategoryLabel(violation);
  const behaviors = getRujukanSpecificBehaviors(violation);
  const reporter = getRujukanReporterName(violation);
  const isPiket = isPiketReferralViolation(violation);
  const notes = getRujukanPiketNotes(violation);
  const lokasi = String(violation.location || '').trim() || 'Lingkungan Sekolah';
  const waktu = formatCardDateTime(violation.date, violation.time);

  const statusBadgeClass =
    status === 'Baru'
      ? 'bg-rose-50 text-rose-800 border-rose-200'
      : status === 'Sudah Ditindaklanjuti'
      ? 'bg-amber-50 text-amber-900 border-amber-200'
      : 'bg-emerald-50 text-emerald-800 border-emerald-200';

  const statusDotClass =
    status === 'Baru'
      ? 'bg-rose-500'
      : status === 'Sudah Ditindaklanjuti'
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  const categoryClass =
    CATEGORY_BADGE_MAP[categoryLabel] || 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <div className="bg-white border border-[#bcc9c6]/45 hover:border-[#00685f]/50 rounded-2xl p-4 sm:p-4.5 shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
      <div className="min-w-0 flex-1 space-y-2">
        {/* Baris 1: Nama Siswa + Kelas + Status */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenProfile ? (
            <button
              type="button"
              onClick={() => onOpenProfile(violation.studentId || violation.studentName)}
              className="text-sm sm:text-base font-extrabold text-[#0b1c30] hover:text-[#00685f] hover:underline cursor-pointer text-left"
              title="Lihat Profil Siswa"
            >
              {violation.studentName || 'Siswa'}
            </button>
          ) : (
            <h3 className="text-sm sm:text-base font-extrabold text-[#0b1c30]">
              {violation.studentName || 'Siswa'}
            </h3>
          )}

          <span className="px-2 py-0.5 rounded-lg bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/20 text-[11px] font-extrabold">
            Kelas {violation.studentClass || '-'}
          </span>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[11px] font-extrabold ${statusBadgeClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`} />
            <span>{status}</span>
          </span>

          {!isPiket && (
            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
              Data Lama
            </span>
          )}
        </div>

        {/* Baris 2: Kategori + Perilaku Spesifik Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`px-2.5 py-1 rounded-xl border text-[11px] font-extrabold ${categoryClass}`}
          >
            {categoryLabel}
          </span>
          {behaviors.map((chip, idx) => (
            <span
              key={`${chip}-${idx}`}
              className="px-2.5 py-1 rounded-xl bg-[#f8faf9] text-[#0b1c30] border border-[#bcc9c6]/60 text-[11px] font-semibold"
            >
              {chip}
            </span>
          ))}
        </div>

        {/* Catatan Singkat jika ada dan tidak compact */}
        {!compact && notes !== '-' && (
          <p className="text-xs text-[#3d4947] bg-[#f8faf9] border border-gray-200/70 rounded-xl px-3 py-1.5 line-clamp-2 flex items-start gap-1.5">
            <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
            <span>{notes}</span>
          </p>
        )}

        {/* Baris 3: Dilaporkan oleh + Waktu + Lokasi */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#3d4947]">
          <span className="inline-flex items-center gap-1 font-semibold text-[#0b1c30]">
            <UserCheck className="w-3.5 h-3.5 text-[#00685f]" />
            <span>Dilaporkan oleh {reporter}</span>
          </span>
          <span className="text-gray-300">•</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#00685f]" />
            <span>{waktu}</span>
          </span>
          <span className="text-gray-300">•</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#00685f]" />
            <span>{lokasi}</span>
          </span>
        </div>
      </div>

      {/* Tombol [Tindak Lanjuti] */}
      <div className="flex items-center sm:justify-end shrink-0">
        <button
          type="button"
          onClick={() => onTindakLanjuti(violation)}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer active:scale-98 shadow-2xs ${
            status === 'Selesai'
              ? 'bg-emerald-50 hover:bg-[#00685f] text-[#00685f] hover:text-white border border-emerald-200'
              : 'bg-[#00685f] hover:bg-[#005049] text-white'
          }`}
        >
          <span>{status === 'Selesai' ? 'Lihat / Tindak Lanjuti' : 'Tindak Lanjuti'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
