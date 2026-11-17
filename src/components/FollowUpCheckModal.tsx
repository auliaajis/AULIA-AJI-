import React, { useState } from 'react';
import { Activity, CheckCircle2, Clock, Save, TrendingUp, X } from 'lucide-react';
import { EvaluationFollowUpStatus, ProgramEvaluation } from '../types';
import {
  EVALUATION_FOLLOWUP_STATUS_OPTIONS,
  computeBaselineKondisiAwal,
  computeFollowUpDelta,
  formatTanggalIndonesia,
  getDaysSinceDate,
} from '../utils/evaluationHelpers';

interface FollowUpCheckModalProps {
  isOpen: boolean;
  evaluation: ProgramEvaluation | null;
  studentDisplayName?: string;
  onClose: () => void;
  onSave: (updatedEvaluation: ProgramEvaluation) => void;
}

export default function FollowUpCheckModal({
  isOpen,
  evaluation,
  studentDisplayName,
  onClose,
  onSave,
}: FollowUpCheckModalProps) {
  const existingCheck = evaluation?.followUpCheck;
  const [skorSekarang, setSkorSekarang] = useState<number>(
    existingCheck?.skorPerubahanSekarang ?? 4
  );
  const [masalahBerulang, setMasalahBerulang] = useState<boolean>(
    existingCheck?.masalahBerulang ?? false
  );
  const [statusTindakLanjut, setStatusTindakLanjut] = useState<EvaluationFollowUpStatus>(
    evaluation?.statusTindakLanjut &&
      EVALUATION_FOLLOWUP_STATUS_OPTIONS.includes(evaluation.statusTindakLanjut as any)
      ? evaluation.statusTindakLanjut
      : masalahBerulang
        ? 'Sedang Berjalan'
        : 'Selesai'
  );
  const [catatan, setCatatan] = useState<string>(existingCheck?.catatan || '');

  if (!isOpen || !evaluation) return null;

  const baselineScore =
    evaluation.baseline?.skorKondisiAwal ?? computeBaselineKondisiAwal(evaluation.baseline);
  const delta = computeFollowUpDelta(evaluation.baseline, skorSekarang);
  const daysElapsed = getDaysSinceDate(evaluation.tanggal);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nowIso = new Date().toISOString();
    const updated: ProgramEvaluation = {
      ...evaluation,
      statusTindakLanjut,
      followUpCheck: {
        skorPerubahanSekarang: skorSekarang,
        masalahBerulang,
        delta,
        checkedAt: nowIso,
        catatan: catatan.trim(),
      },
      updatedAt: nowIso,
    };
    onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-[75] bg-[#0b1c30]/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl border border-[#bcc9c6]/50 shadow-xl overflow-hidden">
        <div className="px-5 py-4 bg-[#f8faf9] border-b border-[#bcc9c6]/40 flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-[#e6f4f1] px-2.5 py-0.5 rounded-lg">
              <Clock className="w-3 h-3" />
              <span>Cek Follow-up Pasca 14 Hari ({daysElapsed} hari berlalu)</span>
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-[#0b1c30] mt-1">
              {studentDisplayName || evaluation.namaProgram}
            </h2>
            <p className="text-xs text-[#3d4947]">
              {evaluation.jenisMasalah || 'Layanan BK'} &middot; {formatTanggalIndonesia(evaluation.tanggal)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#3d4947] hover:bg-gray-200/70 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Baseline Reference */}
          <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/40 grid grid-cols-3 gap-2 text-xs tabular-nums">
            <div>
              <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                Baseline Kondisi Awal
              </span>
              <span className="text-sm font-extrabold text-[#0b1c30]">{baselineScore.toFixed(2)} / 5</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                Skor Follow-up Ini
              </span>
              <span className="text-sm font-extrabold text-[#00685f]">{skorSekarang}.00 / 5</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                Delta Perubahan
              </span>
              <span
                className={`text-sm font-extrabold inline-flex items-center gap-1 ${
                  delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-amber-600'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)}</span>
              </span>
            </div>
          </div>

          {/* Skor Perubahan Sekarang (1-5) */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-[#0b1c30]">
              Skor Perubahan Sekarang (1 – 5)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { v: 1, l: '1 · Memburuk' },
                { v: 2, l: '2 · Tetap' },
                { v: 3, l: '3 · Mulai Baik' },
                { v: 4, l: '4 · Membaik' },
                { v: 5, l: '5 · Tuntas' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setSkorSekarang(opt.v)}
                  className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer text-center ${
                    skorSekarang === opt.v
                      ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                      : 'bg-white text-[#0b1c30] border-[#bcc9c6]/60 hover:bg-[#f8faf9]'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {/* Masalah Berulang? */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-[#0b1c30]">
              Apakah Masalah Berulang?
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setMasalahBerulang(false);
                  if (statusTindakLanjut === 'Belum Dikerjakan') setStatusTindakLanjut('Selesai');
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  !masalahBerulang
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-[#0b1c30] border-[#bcc9c6]/60 hover:bg-gray-50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Tidak Berulang</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMasalahBerulang(true);
                  if (statusTindakLanjut === 'Selesai') setStatusTindakLanjut('Sedang Berjalan');
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  masalahBerulang
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-[#0b1c30] border-[#bcc9c6]/60 hover:bg-gray-50'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Ya, Berulang</span>
              </button>
            </div>
          </div>

          {/* Status Tindak Lanjut */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-[#0b1c30]">
              Status Tindak Lanjut Terbaru
            </label>
            <div className="grid grid-cols-2 gap-2">
              {EVALUATION_FOLLOWUP_STATUS_OPTIONS.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusTindakLanjut(st)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    statusTindakLanjut === st
                      ? 'bg-[#0b1c30] text-white border-[#0b1c30]'
                      : 'bg-white text-[#3d4947] border-[#bcc9c6]/60 hover:bg-gray-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Catatan Singkat */}
          <div>
            <label className="block text-xs font-bold text-[#0b1c30] mb-1">
              Catatan Perkembangan (Opsional)
            </label>
            <textarea
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Ringkasan kondisi siswa saat dicek ulang setelah 14 hari..."
              className="w-full px-3.5 py-2 rounded-xl border border-[#bcc9c6]/60 text-xs sm:text-sm text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#bcc9c6]/60 text-xs font-bold text-[#3d4947] hover:bg-gray-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Hasil Follow-up</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
