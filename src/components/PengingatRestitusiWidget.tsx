import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, ShieldAlert } from 'lucide-react';
import { ViolationRecord } from '../types';
import { getViolationRestitutionStatus } from './CatatPelanggaranForm';

interface PengingatRestitusiWidgetProps {
  violations: ViolationRecord[];
  isPrivacyMode?: boolean;
  onNavigateToTab: (tab: string, searchQuery?: string) => void;
}

export default function PengingatRestitusiWidget({
  violations = [],
  isPrivacyMode = false,
  onNavigateToTab,
}: PengingatRestitusiWidgetProps) {
  // Siswa yang statusnya Proses Restitusi dan sudah lewat 7 hari dari tanggal dicatat, belum selesai
  const overdueRestitutions = useMemo(() => {
    if (!Array.isArray(violations)) return [];
    const now = new Date();

    return violations
      .filter((v) => {
        if (!v) return false;
        const status = getViolationRestitutionStatus(v);
        if (status !== 'Proses Restitusi') return false;

        const dateStr = String(v.date || '').slice(0, 10);
        if (!dateStr) return false;
        const recordDate = new Date(dateStr);
        if (isNaN(recordDate.getTime())) return false;

        const diffMs = now.getTime() - recordDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return diffDays >= 7;
      })
      .map((v) => {
        const dateStr = String(v.date || '').slice(0, 10);
        const recordDate = new Date(dateStr);
        const diffMs = now.getTime() - recordDate.getTime();
        const diffDays = Math.max(7, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        return {
          violation: v,
          diffDays,
        };
      })
      .sort((a, b) => b.diffDays - a.diffDays);
  }, [violations]);

  if (overdueRestitutions.length === 0) {
    return (
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 sm:p-4.5 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-700 text-white text-[10px] font-black rounded-md uppercase tracking-wider">
                Pengingat Restitusi
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-black text-emerald-950 mt-0.5">
              Semua restitusi aman, tidak ada yang terlambat.
            </h4>
            <p className="text-xs text-emerald-800 font-medium mt-0.5">
              Seluruh kesepakatan pemulihan perilaku siswa berjalan sesuai rentang jadwal pemantauan.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50/80 border border-red-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
      {/* Header Pengingat Restitusi */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-red-200/70 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <AlertCircle className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black rounded-md uppercase tracking-wider">
                Perhatian Khusus
              </span>
              <span className="text-xs font-bold text-red-800">
                Lewat Batas Waktu 7 Hari
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-red-950 mt-0.5">
              Pengingat Restitusi
            </h3>
          </div>
        </div>

        <span className="px-3 py-1 bg-white text-red-700 border border-red-200 rounded-xl text-xs font-black shadow-2xs self-start sm:self-auto">
          {overdueRestitutions.length} Kasus Perlu Ditindaklanjuti
        </span>
      </div>

      {/* Daftar Siswa: Format Nama - Kasus - Sudah X hari - Tombol [Lihat] */}
      <div className="space-y-2">
        {overdueRestitutions.map((item, idx) => {
          const studentLabel = isPrivacyMode
            ? `Siswa ${idx + 1} (${item.violation.studentClass || '-'})`
            : `${item.violation.studentName} (${item.violation.studentClass || '-'})`;
          const kasusLabel = item.violation.category || 'Pelanggaran Perilaku';

          return (
            <div
              key={item.violation.id || idx}
              className="bg-white border border-red-200/90 rounded-xl p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs hover:border-red-300 transition-all"
            >
              <div className="flex items-center flex-wrap gap-2 text-xs">
                <span className="font-extrabold text-[#0b1c30]">
                  {studentLabel}
                </span>
                <span className="text-gray-300 font-bold">-</span>
                <span className="font-bold text-gray-700">
                  {kasusLabel}
                </span>
                <span className="text-gray-300 font-bold">-</span>
                <span className="px-2 py-0.5 bg-red-100 text-red-800 font-black text-[11px] rounded-md">
                  Sudah {item.diffDays} hari
                </span>
              </div>

              <button
                type="button"
                onClick={() => onNavigateToTab('profil-siswa', item.violation.studentId || item.violation.studentName)}
                className="self-end sm:self-auto px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
              >
                <span>Lihat</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
