import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Calendar,
  UserCheck,
  Target,
  Brain,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import {
  EvaluationJenisMasalah,
  EvaluationTeknikType,
  EvaluationTujuanType,
  ServiceEvaluationBaseline,
  ServiceHomeVisitDetails,
  ServiceIndividualDetails,
  ServiceKelompokParticipant,
  ServiceMediasiDetails,
  ServiceKlasikalDetails,
  ServiceObservasiWawancaraReferalDetails,
  ServiceStandardBlokD,
} from '../types';
import {
  EVALUATION_JENIS_MASALAH,
  EVALUATION_TEKNIK_OPTIONS,
  EVALUATION_TUJUAN_OPTIONS,
  formatTanggalIndonesia,
  mapJenisMasalahToBidang,
} from '../utils/evaluationHelpers';

export interface StandardizedBlokBState {
  jenisMasalah: EvaluationJenisMasalah;
  alasanMasalahLainnya: string;
  tujuanLayanan: EvaluationTujuanType;
  teknik: EvaluationTeknikType;
  baseline: ServiceEvaluationBaseline;
}

export interface StandardizedBlokDState extends ServiceStandardBlokD {}

export type StandardizedServiceFormKind =
  | 'kelompok'
  | 'mediasi'
  | 'klasikal'
  | 'observasi-wawancara-referal'
  | 'individual'
  | 'home-visit';

export function getDefaultBlokDState(counselorName?: string): StandardizedBlokDState {
  const targetDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const iso14 = targetDate.toISOString().slice(0, 10);
  return {
    kesepakatan: '',
    tindakLanjutApa: '',
    tindakLanjutTanggal: iso14,
    penanggungJawab: counselorName || 'Guru BK',
    statusTindakLanjut: 'Belum Dikerjakan',
  };
}

export async function requestContextualServiceFormAi(payload: {
  formKind: StandardizedServiceFormKind;
  mode: 'polish' | 'recommendation';
  draftText?: string;
  blokB: StandardizedBlokBState;
  blokC: {
    individual?: ServiceIndividualDetails;
    homeVisit?: ServiceHomeVisitDetails;
    kelompokParticipants?: ServiceKelompokParticipant[];
    mediasi?: ServiceMediasiDetails;
    klasikal?: ServiceKlasikalDetails;
    observasiWawancaraReferal?: ServiceObservasiWawancaraReferalDetails;
  };
  blokD: {
    apa?: string;
    tanggal?: string;
    penanggungJawab?: string;
  };
  layananKeBerapa?: number;
  sasaranLabel?: string;
}): Promise<{ text: string; source: 'gemini' | 'fallback' }> {
  try {
    const resp = await fetch('/api/gemini/polish-service-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data?.text) {
        return { text: String(data.text), source: data.source || 'gemini' };
      }
    }
  } catch {
    // Fallback below
  }
  return {
    text: buildLocalContextAwareRecommendation(payload),
    source: 'fallback',
  };
}

export function buildLocalContextAwareRecommendation(payload: {
  formKind: StandardizedServiceFormKind;
  mode?: 'polish' | 'recommendation';
  draftText?: string;
  blokB: Partial<StandardizedBlokBState>;
  blokC?: {
    individual?: ServiceIndividualDetails;
    homeVisit?: ServiceHomeVisitDetails;
    kelompokParticipants?: ServiceKelompokParticipant[];
    mediasi?: ServiceMediasiDetails;
    klasikal?: ServiceKlasikalDetails;
    observasiWawancaraReferal?: ServiceObservasiWawancaraReferalDetails;
  };
  blokD?: {
    apa?: string;
    tanggal?: string;
    penanggungJawab?: string;
  };
  layananKeBerapa?: number;
  sasaranLabel?: string;
}): string {
  const {
    formKind,
    mode = 'recommendation',
    draftText = '',
    blokB = {},
    blokC = {},
    blokD = {},
    layananKeBerapa = 1,
    sasaranLabel = 'Siswa',
  } = payload;

  const masalah =
    blokB.jenisMasalah === 'Lainnya' && blokB.alasanMasalahLainnya
      ? `Lainnya (${blokB.alasanMasalahLainnya})`
      : blokB.jenisMasalah || 'Lainnya';
  const tujuan = blokB.tujuanLayanan || 'Mengubah Perilaku';
  const teknik = blokB.teknik || 'Konseling Individual';
  const baseline = blokB.baseline || { keparahan: 3, frekuensi: 3, motivasiAwal: 3, baselineDariIngatan: true };
  const tglLabel = blokD.tanggal ? formatTanggalIndonesia(blokD.tanggal) : '14 hari lagi';

  if (mode === 'polish') {
    const cleaned = String(draftText || '').trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      return `Catatan ${teknik} terkait masalah ${masalah} (tujuan: ${tujuan}) untuk ${sasaranLabel} pada layanan ke-${layananKeBerapa}.`;
    }
    const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    return capitalized.endsWith('.') ? capitalized : `${capitalized}.`;
  }

  if (formKind === 'individual') {
    const ind = blokC.individual;
    const hasil = ind?.hasilKategori || 'Komitmen Perubahan';
    const highSeverity = Number(baseline.keparahan) >= 4 || Number(baseline.frekuensi) >= 4;
    return `Konseling Individual ke-${layananKeBerapa} untuk ${sasaranLabel} terkait "${masalah}" (tujuan "${tujuan}", baseline keparahan ${baseline.keparahan}/5, motivasi awal ${baseline.motivasiAwal}/5) menghasilkan capaian "${hasil}". ${
      highSeverity
        ? 'Karena tingkat keparahan/frekuensi awal tinggi, prioritaskan monitoring komitmen harian dan evaluasi ulang progres dalam 7–14 hari.'
        : 'Pertahankan penguatan positif agar komitmen perilaku konsisten diterapkan di kelas.'
    } Tindak lanjut: ${blokD.apa || 'review komitmen siswa'} (${tglLabel}).`;
  }

  if (formKind === 'home-visit') {
    const hv = blokC.homeVisit;
    const statusKunjungan = hv?.statusKunjungan || 'Berhasil Ditemui';
    const pihak = hv?.yangDitemui || 'Orang Tua/Wali';
    if (statusKunjungan !== 'Berhasil Ditemui') {
      return `Home Visit ke-${layananKeBerapa} untuk ${sasaranLabel} (${masalah}) berstatus "${statusKunjungan}". Segera koordinasikan dengan Wali Kelas dan jadwalkan kontak telepon / kunjungan ulang serta siapkan langkah lanjutan (${blokD.apa || 'penjadwalan ulang'}) pada ${tglLabel}.`;
    }
    return `Home Visit ke-${layananKeBerapa} untuk ${sasaranLabel} (${masalah}) berhasil menemui ${pihak}${
      hv?.namaOrtu ? ` (${hv.namaOrtu})` : ''
    }. Fokus tindak lanjut: sinkronkan pemantauan kebiasaan di rumah bersama keluarga dan pantau perubahan di sekolah (${blokD.apa || 'koordinasi orang tua & wali kelas'}) pada ${tglLabel}.`;
  }

  if (formKind === 'kelompok') {
    const participants = blokC.kelompokParticipants || [];
    const dominan = participants.filter((p) => p.peran === 'Dominan').map((p) => p.nama).filter(Boolean);
    const pendiam = participants
      .filter((p) => p.peran === 'Pendiam' || p.peran === 'Pasif' || Number(p.keterbukaan || 5) <= 2)
      .map((p) => `${p.nama || 'Peserta'} (${p.peran})`)
      .filter(Boolean);

    const balanceNote =
      pendiam.length > 0 && dominan.length > 0
        ? `Ketimpangan peran terlihat: ${dominan.join(', ')} dominan sedangkan ${pendiam.join(', ')} pendiam/pasif. Sesi berikutnya beri ${pendiam.map((n) => n.split(' (')[0]).join(', ')} giliran bicara pertama dan batasi porsi bicara ${dominan.join(', ')}.`
        : pendiam.length > 0
          ? `Peserta ${pendiam.join(', ')} masih pendiam/kurang terbuka; gunakan pertanyaan pemantik berpasangan di sesi berikutnya.`
          : dominan.length > 0
            ? `${dominan.join(', ')} dominan dalam kelompok; terapkan aturan giliran merata (round-robin).`
            : `Dinamika ${participants.length || 'seluruh'} peserta cukup berimbang; lanjutkan evaluasi komitmen tiap siswa.`;

    return `Konseling Kelompok ke-${layananKeBerapa} untuk masalah "${masalah}" (tujuan "${tujuan}", baseline keparahan ${baseline.keparahan}/5): ${balanceNote} Tindak lanjut: ${blokD.apa || 'review komitmen kelompok'} (${tglLabel}).`;
  }

  if (formKind === 'mediasi') {
    const m = blokC.mediasi;
    const p1 = m?.pihak1Nama || 'Pihak 1';
    const p2 = m?.pihak2Nama || 'Pihak 2';
    if (m?.statusMediasi === 'Tidak Sepakat') {
      return `Mediasi masalah "${masalah}" antara ${p1} dan ${p2} (titik konflik: "${m.titikKonflikUtama || '-'}") berakhir Tidak Sepakat karena "${m.alasanTidakSepakat || 'perbedaan versi'}". Rekomendasi: jeda pendinginan dan jadwalkan mediasi ulang dengan melibatkan Wali Kelas sesuai rencana (${m.rencanaBerikutnya || blokD.apa || 'mediasi ulang'}) pada ${tglLabel}.`;
    }
    const sepakatText = m?.kesepakatanBersama || blokD.apa || '-';
    const oneSided =
      sepakatText !== '-' && p2 && !sepakatText.toLowerCase().includes(p2.toLowerCase().split(' ')[0]);
    return `Mediasi masalah "${masalah}" antara ${p1} & ${p2} mencapai status Sepakat ("${sepakatText}"). Evaluasi keadilan kedua pihak: ${
      oneSided
        ? `perhatikan agar kesepakatan tidak berat sebelah atau hanya menguntungkan ${p1} sementara ${p2} sekadar mengalah.`
        : `hak dan kewajiban kedua pihak tercatat seimbang.`
    } Jadwalkan cek kepatuhan pada ${tglLabel}.`;
  }

  if (formKind === 'klasikal') {
    const k = blokC.klasikal;
    const dinamika = k?.dinamikaKelas || 'Campuran';
    return `Layanan Bimbingan Klasikal kelas ${k?.kelas || sasaranLabel} (${k?.jumlahHadir || '-'}/${k?.totalSiswa || '-'} siswa hadir) topik "${k?.topikKlasikal || masalah}" menunjukkan dinamika kelas ${dinamika} (respon: "${k?.responSiswa || '-'}"). Fokus tindak lanjut diarahkan pada pengelolaan dinamika kelas—bukan menilai keterbukaan satu individu—melalui ${blokD.apa || 'penguatan klasikal lanjutan'} pada ${tglLabel}.`;
  }

  const owr = blokC.observasiWawancaraReferal;
  if (owr?.subJenis === 'Referal') {
    return `Rujukan ini adalah tindakan profesional, bukan kegagalan. Kasus "${masalah}" untuk ${sasaranLabel} (baseline keparahan ${baseline.keparahan}/5) dirujuk ke ${owr.dirujukKe || 'Psikolog'} karena "${owr.alasanDirujuk || '-'}" (status: ${owr.statusRujukan || 'Menunggu'}). Kawal tindak lanjut ${blokD.apa || 'koordinasi perkembangan rujukan'} pada ${tglLabel}.`;
  }
  const needCounseling = Number(baseline.keparahan) >= 4 || Number(baseline.frekuensi) >= 4;
  return `Hasil ${owr?.subJenis || 'Observasi'} terkait "${masalah}" (${owr?.subJenis === 'Wawancara' ? `narasumber ${owr.diwawancarai || 'Siswa'}` : `pengamatan ${owr?.yangDiamati || '-'}`}) menunjukkan data asesmen ${
    needCounseling
      ? 'sudah cukup mengindikasikan kebutuhan mendesak untuk segera dilanjut ke Konseling Individual/Kelompok'
      : 'memadai untuk pemetaan awal dan pemantauan rutin bersama wali kelas'
  } (${tglLabel}).`;
}

// ============================================================================
// BLOK A: IDENTITAS STANDAR (Sama persis template Konseling Individual)
// ============================================================================
export const StandardBlokAIdentitas: React.FC<{
  sasaranLabel: string;
  sasaranSubLabel: string;
  counselorName: string;
  counselorNip?: string;
  date: string;
  onDateChange: (val: string) => void;
  time: string;
  onTimeChange: (val: string) => void;
  tempat: string;
  onTempatChange: (val: string) => void;
  pertemuanKe: number;
  onPertemuanKeChange: (val: number) => void;
  sifatLayanan?: 'Baru' | 'Lanjutan';
  onSifatLayananChange?: (val: 'Baru' | 'Lanjutan') => void;
  extraBadge?: string;
}> = ({
  sasaranLabel,
  sasaranSubLabel,
  counselorName,
  counselorNip = '-',
  date,
  onDateChange,
  time,
  onTimeChange,
  tempat,
  onTempatChange,
  pertemuanKe,
  onPertemuanKeChange,
  sifatLayanan = 'Baru',
  onSifatLayananChange,
  extraBadge,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-[#f8faf9]/70">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-teal-100 text-[#00685f] font-black flex items-center justify-center text-sm shadow-2xs">
            A
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                Blok A - Identitas Layanan
              </h4>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                Otomatis & Terstandar
              </span>
              {extraBadge && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {extraBadge}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
              {sasaranLabel} • {formatTanggalIndonesia(date)} • {tempat}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 bg-[#f8faf9] rounded-xl border border-gray-200/80">
            <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
              Sasaran / Peserta Layanan:
            </span>
            <p className="text-xs sm:text-sm font-black text-[#0b1c30]">{sasaranLabel || 'Belum dipilih'}</p>
            <p className="text-[11px] text-gray-500 font-semibold mt-0.5">{sasaranSubLabel}</p>
          </div>

          <div className="p-3.5 bg-[#f8faf9] rounded-xl border border-gray-200/80">
            <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
              Guru BK / Konselor:
            </span>
            <p className="text-xs sm:text-sm font-black text-[#0b1c30]">{counselorName}</p>
            <p className="text-[11px] text-gray-500 font-semibold mt-0.5">NIP: {counselorNip || '-'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-white rounded-xl border border-gray-200/80">
            <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
              Tanggal Layanan ({formatTanggalIndonesia(date)}):
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
            />
          </div>

          <div className="p-3 bg-white rounded-xl border border-gray-200/80">
            <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
              Jam Mulai:
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => onTimeChange(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
            />
          </div>

          <div className="p-3 bg-white rounded-xl border border-gray-200/80">
            <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
              Tempat Pelaksanaan:
            </label>
            <input
              type="text"
              value={tempat}
              onChange={(e) => onTempatChange(e.target.value)}
              placeholder="Ruang BK / Kelas"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
            />
          </div>

          <div className="p-3 bg-white rounded-xl border border-gray-200/80">
            <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
              Layanan Ke- & Sifat:
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={pertemuanKe}
                onChange={(e) => onPertemuanKeChange(Number(e.target.value))}
                className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    Ke-{n}
                  </option>
                ))}
              </select>
              {onSifatLayananChange && (
                <select
                  value={sifatLayanan}
                  onChange={(e) => onSifatLayananChange(e.target.value as 'Baru' | 'Lanjutan')}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                >
                  <option value="Baru">Baru</option>
                  <option value="Lanjutan">Lanjutan</option>
                </select>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// BLOK B: KONTEKS & BASELINE RETROSPEKTIF STANDAR (Identik di semua form)
// ============================================================================
export const StandardBlokBKonteks: React.FC<{
  value: StandardizedBlokBState;
  onChange: (next: StandardizedBlokBState) => void;
  lockedTeknik?: boolean;
}> = ({ value, onChange, lockedTeknik = false }) => {
  const autoBidang = mapJenisMasalahToBidang(value.jenisMasalah);

  const renderScoreButtons = (
    field: 'keparahan' | 'frekuensi' | 'motivasiAwal',
    label: string,
    hint: string
  ) => (
    <div className="p-3 bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-black text-[#0b1c30]">{label}</span>
        <span className="text-[11px] font-black text-[#00685f]">{value.baseline[field]}/5</span>
      </div>
      <p className="text-[10px] text-gray-500 font-medium mb-2">{hint}</p>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((num) => {
          const active = value.baseline[field] === num;
          return (
            <button
              key={num}
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  baseline: {
                    ...value.baseline,
                    [field]: num,
                    baselineDariIngatan: true,
                  },
                })
              }
              className={`py-1.5 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                active
                  ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-[#f8faf9]/70">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 font-black flex items-center justify-center text-sm shadow-2xs">
            B
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                Blok B - Konteks Masalah, Tujuan, Teknik & Baseline Awal
              </h4>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Bidang: {autoBidang}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
              Daftar terstandar untuk sinkronisasi otomatis ke Evaluasi Layanan & Evaluasi Program BK.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* 1. Jenis Masalah (Exact 9 items) */}
        <div>
          <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
            1. Jenis Masalah (Pilih 1 Kategori Resmi):
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {EVALUATION_JENIS_MASALAH.map((item) => {
              const selected = value.jenisMasalah === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      jenisMasalah: item,
                      alasanMasalahLainnya: item === 'Lainnya' ? value.alasanMasalahLainnya : '',
                    })
                  }
                  className={`px-3 py-2 rounded-xl border text-xs font-black text-left transition-all cursor-pointer ${
                    selected
                      ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                      : 'bg-gray-50 text-[#0b1c30] border-gray-200 hover:border-[#00685f]/50'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          {value.jenisMasalah === 'Lainnya' && (
            <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
              <label className="text-[11px] font-black text-amber-900 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                Alasan memilih "Lainnya" (Wajib isi 1 kalimat):
              </label>
              <input
                type="text"
                value={value.alasanMasalahLainnya}
                onChange={(e) => onChange({ ...value, alasanMasalahLainnya: e.target.value })}
                placeholder="Contoh: Siswa mengalami kejenuhan ekstrem karena perubahan jadwal belajar di rumah."
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
              />
            </div>
          )}
        </div>

        {/* 2. Tujuan Layanan (Exact 5 items) & 3. Teknik (Exact 8 items) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
              2. Tujuan Layanan:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {EVALUATION_TUJUAN_OPTIONS.map((tujuan) => {
                const selected = value.tujuanLayanan === tujuan;
                return (
                  <button
                    key={tujuan}
                    type="button"
                    onClick={() => onChange({ ...value, tujuanLayanan: tujuan })}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                      selected
                        ? 'bg-[#00685f] text-white border-[#00685f]'
                        : 'bg-gray-50 text-[#0b1c30] border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {tujuan}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                3. Teknik Layanan:
              </label>
              {lockedTeknik && (
                <span className="text-[10px] font-bold text-[#00685f] bg-teal-50 px-2 py-0.5 rounded-md">
                  Sesuai sub-jenis aktif
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {EVALUATION_TEKNIK_OPTIONS.map((tek) => {
                const selected = value.teknik === tek;
                return (
                  <button
                    key={tek}
                    type="button"
                    disabled={lockedTeknik}
                    onClick={() => onChange({ ...value, teknik: tek })}
                    className={`px-2.5 py-2 rounded-xl border text-xs font-bold text-left transition-all ${
                      lockedTeknik ? 'cursor-not-allowed opacity-85' : 'cursor-pointer'
                    } ${
                      selected
                        ? 'bg-[#00685f] text-white border-[#00685f]'
                        : 'bg-gray-50 text-[#0b1c30] border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {tek}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. Baseline Retrospektif 3 Skor */}
        <div className="p-3.5 bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/40 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h5 className="text-xs font-black text-[#0b1c30] flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#00685f]" />
                4. Baseline Retrospektif Kondisi Awal (Skala 1–5)
              </h5>
              <p className="text-[11px] text-gray-500 font-medium">
                Catat kondisi SEBELUM layanan diberikan sebagai pembanding progres 14 hari.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[10px] font-black text-amber-800">
              baselineDariIngatan: true
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {renderScoreButtons('keparahan', 'Keparahan Awal', '1 = Sangat ringan • 5 = Sangat berat')}
            {renderScoreButtons('frekuensi', 'Frekuensi Masalah', '1 = Jarang sekali • 5 = Hampir tiap hari')}
            {renderScoreButtons('motivasiAwal', 'Motivasi Awal', '1 = Sangat rendah • 5 = Sangat kooperatif')}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// BLOK D: KESEPAKATAN + TINDAK LANJUT & AI KONTEKSTUAL STANDAR
// ============================================================================
export const StandardBlokDTindakLanjut: React.FC<{
  value: StandardizedBlokDState;
  onChange: (next: StandardizedBlokDState) => void;
  aiRecommendation: string;
  isGeneratingAi?: boolean;
  onGenerateAiRecommendation: () => void;
  extraAgreementReadonlyHint?: string;
}> = ({
  value,
  onChange,
  aiRecommendation,
  isGeneratingAi = false,
  onGenerateAiRecommendation,
  extraAgreementReadonlyHint,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-[#f8faf9]/70">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm shadow-2xs">
            D
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                Blok D - Kesepakatan & Rencana Tindak Lanjut
              </h4>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Status awal: {value.statusTindakLanjut}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
              Terhubung otomatis dengan pengingat tindak lanjut 14 hari & pop-up Evaluasi Layanan (Blok E).
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div>
          <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
            Kesepakatan Layanan:
          </label>
          {extraAgreementReadonlyHint && (
            <p className="text-[11px] text-teal-700 font-semibold mb-1.5">{extraAgreementReadonlyHint}</p>
          )}
          <textarea
            rows={2}
            value={value.kesepakatan}
            onChange={(e) => onChange({ ...value, kesepakatan: e.target.value })}
            placeholder="Tuliskan komitmen / kesepakatan konkret yang disetujui dari sesi layanan ini..."
            className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="text-[11px] font-black text-[#0b1c30] uppercase tracking-wider flex items-center gap-1 mb-1">
              <ClipboardList className="w-3.5 h-3.5 text-[#00685f]" />
              Apa yang Ditindaklanjuti:
            </label>
            <input
              type="text"
              value={value.tindakLanjutApa}
              onChange={(e) => onChange({ ...value, tindakLanjutApa: e.target.value })}
              placeholder="Contoh: Cek kehadiran & evaluasi komitmen..."
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
            />
          </div>

          <div>
            <label className="text-[11px] font-black text-[#0b1c30] uppercase tracking-wider flex items-center gap-1 mb-1">
              <Calendar className="w-3.5 h-3.5 text-[#00685f]" />
              Tanggal Follow-up ({formatTanggalIndonesia(value.tindakLanjutTanggal)}):
            </label>
            <input
              type="date"
              value={value.tindakLanjutTanggal}
              onChange={(e) => onChange({ ...value, tindakLanjutTanggal: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
            />
          </div>

          <div>
            <label className="text-[11px] font-black text-[#0b1c30] uppercase tracking-wider flex items-center gap-1 mb-1">
              <UserCheck className="w-3.5 h-3.5 text-[#00685f]" />
              Penanggung Jawab:
            </label>
            <input
              type="text"
              value={value.penanggungJawab}
              onChange={(e) => onChange({ ...value, penanggungJawab: e.target.value })}
              placeholder="Guru BK / Wali Kelas"
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
            />
          </div>
        </div>

        {/* AI Kontekstual Otomatis */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 via-purple-50/60 to-teal-50 border border-indigo-200 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-700" />
              <span className="text-xs font-black text-indigo-950">
                Rekomendasi AI Kontekstual (Blok B + Blok C + Blok D)
              </span>
            </div>
            <button
              type="button"
              disabled={isGeneratingAi}
              onClick={onGenerateAiRecommendation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00685f] hover:bg-[#005049] disabled:opacity-60 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              {isGeneratingAi ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{isGeneratingAi ? 'Menganalisis...' : 'Perbarui Rekomendasi Cerdas'}</span>
            </button>
          </div>
          <p className="text-xs text-[#0b1c30] leading-relaxed font-semibold bg-white/80 p-3 rounded-xl border border-indigo-100">
            {aiRecommendation}
          </p>
        </div>

        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            Blok E otomatis aktif: Setelah menekan Simpan, pop-up Evaluasi Layanan langsung muncul untuk menilai layanan ini.
          </span>
        </div>
      </div>
    </div>
  );
};
