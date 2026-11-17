import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  Copy,
  FileSpreadsheet,
  Printer,
  Save,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import {
  CounselingService,
  Counselor,
  FokusUtamaTahunan,
  ProgramEvaluation,
  RencanaTahunanData,
} from '../types';
import {
  BIDANG_HEX_COLORS,
  FOKUS_UTAMA_TAHUNAN_OPTIONS,
  STANDARD_EVALUATION_BIDANG,
  buildRencanaTahunanPlanId,
  calculateRencanaTahunanDraft,
  getPreviousTahunAjaran,
  getTahunAjaranFromDate,
  mapServiceToEvaluationBidang,
} from '../utils/evaluationHelpers';
import { getActiveSchoolId, getSchoolConfig } from '../utils/schoolConfig';
import { downloadKepsekReportPDF } from '../utils/evaluationPdfGenerator';
import { exportBKProgramToExcel } from '../utils/bkExcelExporter';
import { showToast } from '../utils/toast';

interface RencanaTahunanCardProps {
  tahunAjaran: string;
  programEvaluations: ProgramEvaluation[];
  serviceEvaluations: ProgramEvaluation[];
  services: CounselingService[];
  activeCounselor: Counselor;
  onSaveEvaluation: (evaluation: ProgramEvaluation) => void;
}

export default function RencanaTahunanCard({
  tahunAjaran,
  programEvaluations,
  serviceEvaluations,
  services,
  activeCounselor,
  onSaveEvaluation,
}: RencanaTahunanCardProps) {
  const activeSchoolId = getActiveSchoolId();

  const existingSavedPlan = useMemo(() => {
    return (programEvaluations || []).find(
      (e) =>
        e.evaluationScope === 'rencana-tahunan' &&
        (e.tahunAjaran === tahunAjaran || e.rencanaTahunan?.tahunAjaran === tahunAjaran) &&
        e.rencanaTahunan
    );
  }, [programEvaluations, tahunAjaran]);

  const [draft, setDraft] = useState<RencanaTahunanData>(() => {
    if (existingSavedPlan?.rencanaTahunan) {
      return existingSavedPlan.rencanaTahunan;
    }
    return calculateRencanaTahunanDraft({
      tahunAjaran,
      jamPerMinggu: 1,
      jumlahKelas: 7,
      fokusUtama: 'Meningkatkan Motivasi Belajar',
    });
  });

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Sync when user switches Tahun Ajaran filter or saved data loads
  useEffect(() => {
    if (existingSavedPlan?.rencanaTahunan) {
      setDraft(existingSavedPlan.rencanaTahunan);
    } else {
      setDraft(
        calculateRencanaTahunanDraft({
          tahunAjaran,
          jamPerMinggu: 1,
          jumlahKelas: 7,
          fokusUtama: 'Meningkatkan Motivasi Belajar',
        })
      );
    }
  }, [tahunAjaran, existingSavedPlan]);

  // Real-time recalculation when Jam, Jumlah Kelas, or Fokus changes
  const handleRecalcField = (patch: {
    jamPerMinggu?: number;
    jumlahKelas?: number;
    fokusUtama?: FokusUtamaTahunan;
  }) => {
    const nextJam = patch.jamPerMinggu ?? draft.jamPerMinggu;
    const nextKelas = patch.jumlahKelas ?? draft.jumlahKelas;
    const nextFokus = patch.fokusUtama ?? draft.fokusUtama;
    const recalculated = calculateRencanaTahunanDraft({
      tahunAjaran,
      jamPerMinggu: nextJam,
      jumlahKelas: nextKelas,
      fokusUtama: nextFokus,
    });
    setDraft(recalculated);
  };

  // Manual edits on the 4 bidang targets
  const handleBidangTargetChange = (
    key:
      | 'targetLayananDasar'
      | 'targetLayananResponsif'
      | 'targetPerencanaanIndividual'
      | 'targetDukunganSistem',
    rawVal: string
  ) => {
    const val = Math.max(0, Math.round(Number(rawVal) || 0));
    setDraft((prev) => {
      const updated = { ...prev, [key]: val };
      const totalTarget =
        updated.targetLayananDasar +
        updated.targetLayananResponsif +
        updated.targetPerencanaanIndividual +
        updated.targetDukunganSistem;
      return {
        ...updated,
        totalTarget,
        isOverloaded: totalTarget > 400,
      };
    });
  };

  const handleGenerateWithAi = async () => {
    setIsGeneratingAi(true);
    try {
      const resp = await fetch('/api/gemini/rencana-tahunan-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tahunAjaran,
          jamPerMinggu: draft.jamPerMinggu,
          jumlahKelas: draft.jumlahKelas,
          fokusUtama: draft.fokusUtama,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data?.draft) {
          setDraft(data.draft);
          showToast('Draf target & catatan strategi AI siap ditinjau!', 'success');
          return;
        }
      }
      const localDraft = calculateRencanaTahunanDraft({
        tahunAjaran,
        jamPerMinggu: draft.jamPerMinggu,
        jumlahKelas: draft.jumlahKelas,
        fokusUtama: draft.fokusUtama,
      });
      setDraft(localDraft);
      showToast('Draf kalkulasi rencana tahunan diperbarui!', 'success');
    } catch {
      const localDraft = calculateRencanaTahunanDraft({
        tahunAjaran,
        jamPerMinggu: draft.jamPerMinggu,
        jumlahKelas: draft.jumlahKelas,
        fokusUtama: draft.fokusUtama,
      });
      setDraft(localDraft);
      showToast('Draf kalkulasi lokal berhasil dibuat.', 'info');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopyLastYear = () => {
    const prevTa = getPreviousTahunAjaran(tahunAjaran);
    const prevPlan = (programEvaluations || []).find(
      (e) =>
        e.evaluationScope === 'rencana-tahunan' &&
        (e.tahunAjaran === prevTa || e.rencanaTahunan?.tahunAjaran === prevTa) &&
        e.rencanaTahunan
    );
    if (prevPlan?.rencanaTahunan) {
      setDraft({
        ...prevPlan.rencanaTahunan,
        tahunAjaran,
        updatedAt: new Date().toISOString(),
      });
      showToast(`Pengaturan & target berhasil disalin dari Tahun Ajaran ${prevTa}!`, 'success');
    } else {
      const defaultPrev = calculateRencanaTahunanDraft({
        tahunAjaran,
        jamPerMinggu: 1,
        jumlahKelas: 7,
        fokusUtama: draft.fokusUtama,
      });
      setDraft(defaultPrev);
      showToast(
        `Arsip ${prevTa} belum tersedia — menerapkan standar kalkulasi tahun sebelumnya (1 jam, 7 kelas).`,
        'info'
      );
    }
  };

  const handleSavePlan = () => {
    const cfg = getSchoolConfig(activeSchoolId);
    const nowIso = new Date().toISOString();
    const totalTarget =
      draft.targetLayananDasar +
      draft.targetLayananResponsif +
      draft.targetPerencanaanIndividual +
      draft.targetDukunganSistem;

    const cleanRencana: RencanaTahunanData = {
      ...draft,
      tahunAjaran,
      totalTarget,
      isOverloaded: totalTarget > 400,
      updatedAt: nowIso,
    };

    const doc: ProgramEvaluation = {
      id: buildRencanaTahunanPlanId(activeSchoolId, tahunAjaran),
      serviceId: '',
      bidang: 'Semua Bidang (4 Pilar BK)',
      namaProgram: `Rencana Program Tahunan BK ${tahunAjaran}`,
      kelas: `${draft.jumlahKelas} Kelas`,
      target: totalTarget,
      realisasi: 0,
      kondisiAwal: `Jam BK ${draft.jamPerMinggu}/minggu × ${draft.jumlahKelas} kelas • Fokus: ${draft.fokusUtama}`,
      kondisiSetelah: cleanRencana.aiNote,
      hasil: `Target Tahunan: Dasar ${draft.targetLayananDasar}, Responsif ${draft.targetLayananResponsif}, Perencanaan ${draft.targetPerencanaanIndividual}, Dukungan ${draft.targetDukunganSistem} (Total ${totalTarget}).`,
      kendala: cleanRencana.isOverloaded ? 'Beban melebihi 400 layanan/tahun untuk 1 guru BK' : '',
      tindakLanjut: cleanRencana.aiNote,
      tanggalTindakLanjut: '',
      statusTindakLanjut: 'Sedang Berjalan',
      nilai: 0,
      feedbackSiswaNilai: 0,
      feedbackSiswaKomentar: '',
      feedbackWaliNama: '',
      feedbackWaliKomentar: '',
      buktiFoto: [],
      tanggal: nowIso.slice(0, 10),
      createdBy: activeCounselor.name || 'Guru BK',
      guruBk: activeCounselor.name || 'Guru BK',
      tahunAjaran,
      schoolId: activeSchoolId,
      schoolName: cfg.schoolName || 'SMP N 2 Susukan',
      counselorId: activeCounselor.id,
      evaluationScope: 'rencana-tahunan',
      rencanaTahunan: cleanRencana,
      createdAt: existingSavedPlan?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    onSaveEvaluation(doc);
    showToast(`Rencana Program Tahunan ${tahunAjaran} tersimpan!`, 'success');
  };

  // Real-time progress realization for Tahun Ajaran
  const realizationByBidang = useMemo(() => {
    const map: Record<string, number> = {
      'Layanan Dasar': 0,
      'Layanan Responsif': 0,
      'Perencanaan Individual': 0,
      'Dukungan Sistem': 0,
    };
    (services || []).forEach((s) => {
      if (getTahunAjaranFromDate(s.date) !== tahunAjaran) return;
      const b = mapServiceToEvaluationBidang(s);
      map[b] = (map[b] || 0) + 1;
    });
    return map;
  }, [services, tahunAjaran]);

  const bidangTargetList = [
    {
      bidang: STANDARD_EVALUATION_BIDANG[0], // Layanan Dasar
      key: 'targetLayananDasar' as const,
      value: draft.targetLayananDasar,
      formula: `Target realistis 90% (${draft.totalKlasikal} × 90%)`,
    },
    {
      bidang: STANDARD_EVALUATION_BIDANG[1], // Layanan Responsif
      key: 'targetLayananResponsif' as const,
      value: draft.targetLayananResponsif,
      formula: 'Estimasi 2–3 kasus/minggu × 36 minggu',
    },
    {
      bidang: STANDARD_EVALUATION_BIDANG[2], // Perencanaan Individual
      key: 'targetPerencanaanIndividual' as const,
      value: draft.targetPerencanaanIndividual,
      formula: `2 sesi/kelas × ${draft.jumlahKelas} kelas × 2 sem`,
    },
    {
      bidang: STANDARD_EVALUATION_BIDANG[3], // Dukungan Sistem
      key: 'targetDukunganSistem' as const,
      value: draft.targetDukunganSistem,
      formula: '2 kegiatan/bulan × 12 bulan',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#bcc9c6]/60 shadow-2xs p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#e6f4f1] text-[#00685f] flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-[#e6f4f1] px-2 py-0.5 rounded-md">
                Rencana Program Tahunan · Kalkulasi AI
              </span>
              {existingSavedPlan ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3 h-3" />
                  Tersimpan ({tahunAjaran})
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  Draf Otomatis (Belum Disimpan)
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-[#0b1c30] mt-1">
              Target Tahunan &amp; Kalkulasi Beban Kerja Guru BK ({tahunAjaran})
            </h3>
            <p className="text-xs text-[#3d4947]">
              Tanpa survei atau asesmen awal — cukup atur jam BK, jumlah kelas, dan fokus utama agar AI menghitung target realistis.
            </p>
          </div>
        </div>

        {/* Action Toolbar: AI, Copy Last Year, Save, Export PDF Kepsek, Export Excel */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isGeneratingAi}
            onClick={handleGenerateWithAi}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isGeneratingAi ? 'Menyusun...' : 'Buatkan Draf dengan AI'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLastYear}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#0b1c30] text-xs font-bold cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Salin dari Tahun Lalu</span>
          </button>

          <button
            type="button"
            onClick={handleSavePlan}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold cursor-pointer shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan</span>
          </button>
        </div>
      </div>

      {/* Row 1: Only 3 Simple Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50">
          <label className="block text-[11px] font-extrabold text-[#0b1c30] mb-1">
            Jam BK per Minggu per Kelas
          </label>
          <input
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={draft.jamPerMinggu}
            onChange={(e) => handleRecalcField({ jamPerMinggu: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f] tabular-nums"
          />
          <p className="text-[10px] text-[#3d4947] mt-1">Default: 1 jam/minggu/kelas</p>
        </div>

        <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50">
          <label className="block text-[11px] font-extrabold text-[#0b1c30] mb-1">
            Jumlah Kelas Binaan
          </label>
          <input
            type="number"
            min={1}
            max={40}
            value={draft.jumlahKelas}
            onChange={(e) => handleRecalcField({ jumlahKelas: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f] tabular-nums"
          />
          <p className="text-[10px] text-[#3d4947] mt-1">Default: 7 kelas</p>
        </div>

        <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50">
          <label className="block text-[11px] font-extrabold text-[#0b1c30] mb-1">
            Fokus Utama Tahun Ini (Pilih 1)
          </label>
          <select
            value={draft.fokusUtama}
            onChange={(e) =>
              handleRecalcField({ fokusUtama: e.target.value as FokusUtamaTahunan })
            }
            className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs sm:text-sm font-bold text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
          >
            {FOKUS_UTAMA_TAHUNAN_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-[#3d4947] mt-1">Menentukan strategi AI tahunan</p>
        </div>
      </div>

      {/* Row 2: Transparent AI Calculation Breakdown */}
      <div className="p-3.5 rounded-xl bg-[#e6f4f1]/60 border border-[#00685f]/25 space-y-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] block">
          Cara Hitung Otomatis AI
        </span>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs tabular-nums">
          <div className="bg-white px-3 py-2 rounded-xl border border-[#bcc9c6]/40">
            <span className="text-[10px] font-bold text-[#3d4947] block">Minggu Efektif</span>
            <span className="font-extrabold text-[#0b1c30]">
              {draft.mingguEfektif} minggu
            </span>
            <span className="block text-[10px] text-[#3d4947]">(52 - 14 libur/ujian)</span>
          </div>
          <div className="bg-white px-3 py-2 rounded-xl border border-[#bcc9c6]/40">
            <span className="text-[10px] font-bold text-[#3d4947] block">Pertemuan / Kelas</span>
            <span className="font-extrabold text-[#0b1c30]">
              {draft.pertemuanPerKelas} / tahun
            </span>
            <span className="block text-[10px] text-[#3d4947]">
              ({draft.jamPerMinggu} jam × {draft.mingguEfektif} minggu)
            </span>
          </div>
          <div className="bg-white px-3 py-2 rounded-xl border border-[#bcc9c6]/40">
            <span className="text-[10px] font-bold text-[#3d4947] block">Total Klasikal</span>
            <span className="font-extrabold text-[#0b1c30]">
              {draft.totalKlasikal} / tahun
            </span>
            <span className="block text-[10px] text-[#3d4947]">
              (Per Semester = {draft.perSemester})
            </span>
          </div>
          <div className="bg-white px-3 py-2 rounded-xl border border-[#00685f]/40">
            <span className="text-[10px] font-bold text-[#00685f] block">Target Realistis 90%</span>
            <span className="font-extrabold text-[#00685f]">
              {draft.targetRealistis90} sesi
            </span>
            <span className="block text-[10px] text-[#3d4947]">
              ({draft.totalKlasikal} × 90%)
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Editable 4 Bidang Draft Targets + Total & Overload Warning */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-[#0b1c30]">
            Draf Target per Bidang (Boleh Diubah Langsung):
          </span>
          <div className="flex items-center gap-2 tabular-nums">
            <span className="text-xs font-extrabold text-[#0b1c30] bg-gray-100 px-3 py-1 rounded-xl">
              Total Target: {draft.totalTarget} Layanan / Tahun
            </span>
            {draft.isOverloaded && (
              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-3 py-1 rounded-xl">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                Terlalu tinggi untuk 1 guru BK
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
          {bidangTargetList.map((item) => {
            const hex = BIDANG_HEX_COLORS[item.bidang];
            const real = realizationByBidang[item.bidang] || 0;
            const pct = item.value > 0 ? Math.min(100, Math.round((real / item.value) * 100)) : 0;
            return (
              <div
                key={item.bidang}
                className="p-3 rounded-xl border bg-white space-y-2"
                style={{ borderColor: `${hex}55` }}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className="text-xs font-extrabold truncate"
                    style={{ color: hex }}
                  >
                    {item.bidang}
                  </span>
                  <span className="text-[10px] font-bold text-[#3d4947] shrink-0">
                    Realisasi: {real} ({pct}%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={item.value}
                    onChange={(e) => handleBidangTargetChange(item.key, e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-[#f8faf9] text-sm font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                  />
                  <span className="text-[11px] font-bold text-[#3d4947] shrink-0">sesi/thn</span>
                </div>
                <p className="text-[10px] text-[#3d4947] leading-snug">{item.formula}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 4: AI Note + 1-Click Export Kepsek PDF & Excel */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1 flex-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Catatan Strategis AI ({draft.fokusUtama})
          </span>
          <p className="text-xs text-[#0b1c30] leading-relaxed font-medium">{draft.aiNote}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              downloadKepsekReportPDF({
                tahunAjaran,
                rencanaTahunan: draft,
                services,
                serviceEvaluations,
                programEvaluations,
                activeCounselor,
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0b1c30] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export PDF untuk Kepala Sekolah</span>
          </button>

          <button
            type="button"
            onClick={() =>
              exportBKProgramToExcel({
                tahunAjaran,
                rencanaTahunan: draft,
                services,
                serviceEvaluations,
                programEvaluations,
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
