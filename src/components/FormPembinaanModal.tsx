import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  UserCheck,
  Calendar,
  Sparkles,
  CheckCircle2,
  HeartHandshake,
  Save,
  ArrowRight,
  ArrowLeft,
  Clock,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { ViolationRecord, Counselor, Student } from '../types';
import { formatCardDate } from '../utils/dateFormatter';
import {
  getRujukanCategoryLabel,
  getRujukanPiketNotes,
  getRujukanReporterName,
  getRujukanSpecificBehaviors,
} from '../utils/rujukanHelper';
import { showToast } from '../utils/toast';

export interface PembinaanSubmitPayload {
  violation: ViolationRecord;
  pembinaanDate: string;
  pembinaanKronologi: string;
  pembinaanResult: string;
  pembinaanFollowUpPlan: string;
  pembinaanStatus: 'Proses' | 'Selesai';
  scheduleCounseling: boolean;
}

interface FormPembinaanModalProps {
  violation: ViolationRecord | null;
  student?: Student | null;
  activeCounselor: Counselor;
  onClose: () => void;
  onSubmit: (payload: PembinaanSubmitPayload) => void;
}

const KRONOLOGI_TEMPLATES = [
  {
    id: 'stabilkan',
    label: '1. Stabilkan Identitas',
    text: 'Stabilkan Identitas: Siswa diajak berdialog tenang di ruang BK untuk menyadari bahwa setiap orang pernah berbuat keliru dan kini fokus pada pemulihan diri.',
  },
  {
    id: 'validasi',
    label: '2. Validasi Kebutuhan',
    text: 'Validasi Kebutuhan: Konselor menggali alasan di balik perilaku siswa untuk memahami kebutuhan dasar (rasa diterima/kebebasan/perhatian) secara empatik.',
  },
  {
    id: 'keyakinan',
    label: '3. Keyakinan & Restitusi',
    text: 'Menanyakan Keyakinan: Siswa menghubungkan tindakannya dengan keyakinan kelas/sekolah yang disepakati serta merumuskan solusi restitusi mandiri.',
  },
  {
    id: 'glasser',
    label: '4. Sebab-Akibat & Refleksi',
    text: 'Refleksi Sebab-Akibat & Glasser: Siswa mengevaluasi dampak perilaku terhadap diri sendiri dan teman, lalu menyepakati langkah perbaikan konkret.',
  },
];

export default function FormPembinaanModal({
  violation,
  student,
  activeCounselor,
  onClose,
  onSubmit,
}: FormPembinaanModalProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [studentConfirmed, setStudentConfirmed] = useState(true);
  const [pembinaanDate, setPembinaanDate] = useState(todayStr);
  const [pembinaanKronologi, setPembinaanKronologi] = useState('');
  const [pembinaanResult, setPembinaanResult] = useState('');
  const [pembinaanFollowUpPlan, setPembinaanFollowUpPlan] = useState('');
  const [pembinaanStatus, setPembinaanStatus] = useState<'Proses' | 'Selesai'>('Proses');
  const [scheduleCounseling, setScheduleCounseling] = useState(false);

  useEffect(() => {
    if (!violation) return;
    setStep(1);
    setStudentConfirmed(true);
    setPembinaanDate(violation.pembinaanDate || new Date().toISOString().slice(0, 10));
    setPembinaanKronologi(violation.pembinaanKronologi || '');
    setPembinaanResult(violation.pembinaanResult || violation.handlingProgress || '');
    setPembinaanFollowUpPlan(violation.pembinaanFollowUpPlan || violation.restitutionAgreement || '');
    setPembinaanStatus(
      violation.pembinaanStatus === 'Selesai' || violation.restitutionStatus === 'Selesai / Dipantau'
        ? 'Selesai'
        : 'Proses'
    );
    setScheduleCounseling(false);
  }, [violation]);

  if (!violation) return null;

  const reporterName = getRujukanReporterName(violation);
  const formattedDate = formatCardDate(violation.date) || violation.date || '-';
  const categoryLabel = getRujukanCategoryLabel(violation);
  const behaviorChips = getRujukanSpecificBehaviors(violation);
  const piketNotes = getRujukanPiketNotes(violation);
  const resolvedNis = student?.nis || violation.nis || '-';

  const handleApplyTemplate = (templateText: string) => {
    setPembinaanKronologi((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return `- ${templateText}`;
      if (trimmed.includes(templateText)) return prev;
      return `${trimmed}\n- ${templateText}`;
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentConfirmed) {
      showToast('Centang konfirmasi siswa pada Langkah 1 terlebih dahulu.', 'error');
      setStep(1);
      return;
    }
    if (!pembinaanDate) {
      showToast('Tanggal pembinaan wajib diisi.', 'error');
      setStep(1);
      return;
    }
    if (!pembinaanKronologi.trim()) {
      showToast('Isi kronologi & pendekatan Segitiga Restitusi pada Langkah 2.', 'error');
      setStep(2);
      return;
    }
    if (!pembinaanResult.trim()) {
      showToast('Isi hasil pembinaan pada Langkah 3.', 'error');
      setStep(3);
      return;
    }

    onSubmit({
      violation,
      pembinaanDate,
      pembinaanKronologi: pembinaanKronologi.trim(),
      pembinaanResult: pembinaanResult.trim(),
      pembinaanFollowUpPlan: pembinaanFollowUpPlan.trim() || 'Pemantauan berkala di kelas & komunikasi wali kelas.',
      pembinaanStatus,
      scheduleCounseling,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-[#0b1c30]/65 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-2xl border border-[#bcc9c6]/50 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Bar */}
        <div className="bg-[#00685f] text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/15 px-2 py-0.5 rounded-md">
                Form Pembinaan 3 Langkah
              </span>
              {violation.ticketId && (
                <span className="text-[10px] font-mono bg-white/15 px-2 py-0.5 rounded-md">
                  #{violation.ticketId}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-extrabold truncate mt-1">
              Tindak Lanjut Pembinaan: {violation.studentName} ({violation.studentClass})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
            title="Tutup Form Pembinaan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-5">
          {/* READ-ONLY HEADER ATAS (TIDAK BISA DIEDIT) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-2 select-none">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Data Rujukan Piket (Read-Only / Tidak Dapat Diedit)</span>
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                Terkunci
              </span>
            </div>

            <p className="text-xs sm:text-[13px] font-semibold text-[#0b1c30] leading-relaxed bg-white p-3 rounded-xl border border-slate-200/80">
              <span className="text-slate-500">Dirujuk dari:</span>{' '}
              <strong className="text-[#00685f]">{reporterName}</strong>{' '}
              <span className="text-slate-400">-</span>{' '}
              <span className="text-slate-500">Tanggal:</span>{' '}
              <strong>{formattedDate}</strong>{' '}
              <span className="text-slate-400">-</span>{' '}
              <span className="text-slate-500">Kategori:</span>{' '}
              <strong className="text-rose-700">{categoryLabel}</strong>{' '}
              <span className="text-slate-400">-</span>{' '}
              <span className="text-slate-500">Perilaku:</span>{' '}
              <strong>{behaviorChips.join(', ')}</strong>{' '}
              <span className="text-slate-400">-</span>{' '}
              <span className="text-slate-500">Catatan Piket:</span>{' '}
              <strong className="text-slate-800">{piketNotes}</strong>
            </p>
          </div>

          {/* 3-Step Indicator Bar */}
          <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1.5 rounded-2xl border border-[#bcc9c6]/30">
            {[
              { num: 1 as const, label: '1. Konfirmasi Siswa' },
              { num: 2 as const, label: '2. Kronologi & Restitusi' },
              { num: 3 as const, label: '3. Hasil & Tindak Lanjut' },
            ].map((item) => {
              const active = step === item.num;
              const done = step > item.num;
              return (
                <button
                  key={item.num}
                  type="button"
                  onClick={() => setStep(item.num)}
                  className={`py-2 px-2.5 rounded-xl text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    active
                      ? 'bg-[#00685f] text-white shadow-xs'
                      : done
                      ? 'bg-emerald-50 text-[#00685f] border border-emerald-200'
                      : 'text-[#3d4947] hover:bg-gray-200/60'
                  }`}
                >
                  {done && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* LANGKAH 1: Konfirmasi Siswa + Tanggal Pembinaan */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#f8faf9] border border-[#bcc9c6]/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-[#00685f] uppercase tracking-wider">
                  <UserCheck className="w-4 h-4" />
                  <span>Langkah 1: Konfirmasi Siswa &amp; Tanggal Pembinaan</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-gray-200">
                  <div>
                    <span className="text-[11px] font-bold text-gray-500 block">Nama Siswa</span>
                    <span className="text-sm font-extrabold text-[#0b1c30]">{violation.studentName}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-gray-500 block">Kelas</span>
                    <span className="text-sm font-extrabold text-[#00685f]">{violation.studentClass}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-gray-500 block">NIS / ID Tiket</span>
                    <span className="text-xs font-mono font-bold text-gray-700">
                      {resolvedNis} {violation.ticketId ? `• #${violation.ticketId}` : ''}
                    </span>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-[#00685f]/25 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={studentConfirmed}
                    onChange={(e) => setStudentConfirmed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[#00685f] rounded border-gray-300 focus:ring-[#00685f] cursor-pointer"
                  />
                  <span className="text-xs font-bold text-[#0b1c30] leading-snug">
                    Saya mengonfirmasi identitas siswa di atas sudah sesuai untuk dilakukan pembinaan oleh{' '}
                    <span className="text-[#00685f]">{activeCounselor?.name || 'Guru BK'}</span>.
                  </span>
                </label>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0b1c30] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#00685f]" />
                    <span>Tanggal Pembinaan (Otomatis Hari Ini)</span>
                  </label>
                  <input
                    type="date"
                    value={pembinaanDate}
                    onChange={(e) => setPembinaanDate(e.target.value)}
                    required
                    className="w-full sm:w-64 bg-white border border-[#bcc9c6]/60 rounded-xl px-3.5 py-2.5 text-sm font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer"
                >
                  <span>Lanjut ke Langkah 2</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* LANGKAH 2: Kronologi & Pendekatan Segitiga Restitusi + 4 Template Kronologi */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#f8faf9] border border-[#bcc9c6]/40 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#00685f] uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" />
                    <span>Langkah 2: Kronologi &amp; Pendekatan Segitiga Restitusi</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#00685f] bg-white px-2.5 py-0.5 rounded-lg border border-[#00685f]/20">
                    Klik Template untuk Mengisi Cepat
                  </span>
                </div>

                {/* 4 Tombol Template Kronologi */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-[#3d4947]">Template Kronologi (4 Pilihan):</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {KRONOLOGI_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleApplyTemplate(tpl.text)}
                        className="px-3 py-2 bg-white hover:bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/30 rounded-xl text-xs font-extrabold text-left transition-all cursor-pointer shadow-2xs flex items-center gap-2"
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span>{tpl.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0b1c30] block">
                    Uraian Kronologi &amp; Dialog Segitiga Restitusi <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={pembinaanKronologi}
                    onChange={(e) => setPembinaanKronologi(e.target.value)}
                    placeholder="Tuliskan hasil klarifikasi kronologi bersama siswa dan dialog Segitiga Restitusi (atau klik tombol template di atas)..."
                    className="w-full bg-white border border-[#bcc9c6]/60 rounded-xl p-3.5 text-xs sm:text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f] leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#0b1c30] rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer"
                >
                  <span>Lanjut ke Langkah 3</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* LANGKAH 3: Hasil Pembinaan + Rencana Tindak Lanjut + Status + Checkbox Konseling + Simpan Pembinaan */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#f8faf9] border border-[#bcc9c6]/40 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2 text-xs font-extrabold text-[#00685f] uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Langkah 3: Hasil Pembinaan &amp; Rencana Tindak Lanjut</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0b1c30] block">
                    Hasil Pembinaan <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={pembinaanResult}
                    onChange={(e) => setPembinaanResult(e.target.value)}
                    placeholder="Contoh: Siswa memahami dampak perilakunya, menyampaikan permohonan maaf, dan berkomitmen menjaga ketertiban..."
                    className="w-full bg-white border border-[#bcc9c6]/60 rounded-xl p-3 text-xs sm:text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0b1c30] block">
                    Rencana Tindak Lanjut
                  </label>
                  <textarea
                    rows={2}
                    value={pembinaanFollowUpPlan}
                    onChange={(e) => setPembinaanFollowUpPlan(e.target.value)}
                    placeholder="Contoh: Pemantauan 2 minggu bersama Wali Kelas, atau komunikasi lanjutan dengan orang tua..."
                    className="w-full bg-white border border-[#bcc9c6]/60 rounded-xl p-3 text-xs sm:text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>

                {/* Status: Proses / Selesai */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0b1c30] block">
                    Status Pembinaan
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPembinaanStatus('Proses')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        pembinaanStatus === 'Proses'
                          ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/50 text-amber-950'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="text-xs font-black block">Proses</span>
                        <span className="text-[10px] opacity-80 block">Masih dalam pemantauan / lanjutan</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPembinaanStatus('Selesai')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        pembinaanStatus === 'Selesai'
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/40 text-emerald-950'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-xs font-black block">Selesai</span>
                        <span className="text-[10px] opacity-80 block">Pembinaan &amp; restitusi tuntas</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Checkbox Langsung Jadwalkan Sesi Layanan Konseling */}
                <label className="flex items-start gap-3 p-3.5 rounded-xl bg-teal-50/80 border border-teal-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleCounseling}
                    onChange={(e) => setScheduleCounseling(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[#00685f] rounded border-gray-300 focus:ring-[#00685f] cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-extrabold text-[#0b1c30] flex items-center gap-1.5">
                      <HeartHandshake className="w-4 h-4 text-[#00685f]" />
                      <span>Langsung Jadwalkan Sesi Layanan Konseling</span>
                    </span>
                    <span className="text-[11px] text-[#3d4947] block mt-0.5 leading-snug">
                      Buka form penjadwalan Layanan Konseling dengan data siswa &amp; topik pembinaan ini terisi otomatis setelah pembinaan disimpan.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#0b1c30] rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Langkah 2</span>
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-sm font-extrabold shadow-sm transition-all cursor-pointer active:scale-98"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Pembinaan</span>
                </button>
              </div>
            </div>
          )}

          {/* Tulisan kecil regulasi Permendikbudristek 46/2023 di bawah form */}
          <div className="pt-3 border-t border-gray-100 flex items-start gap-2 text-[11px] text-[#3d4947] leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-[#00685f] shrink-0 mt-0.5" />
            <p>
              Sesuai Permendikbudristek 46/2023, BK tidak memberikan sanksi. BK melakukan pembinaan, konseling, dan restitusi atas rujukan dari Piket / Kesiswaan.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
