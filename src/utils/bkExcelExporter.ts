import * as XLSX from 'xlsx';
import { CounselingService, ProgramEvaluation, RencanaTahunanData } from '../types';
import {
  STANDARD_EVALUATION_BIDANG,
  formatTanggalIndonesia,
  getEffectiveServiceEvalScore,
  getSemesterFromDate,
  getTahunAjaranFromDate,
  mapServiceToEvaluationBidang,
} from './evaluationHelpers';
import { showToast } from './toast';

export function exportBKProgramToExcel(params: {
  tahunAjaran: string;
  semester?: 'Ganjil' | 'Genap' | 'Semua';
  rencanaTahunan: RencanaTahunanData;
  services: CounselingService[];
  serviceEvaluations: ProgramEvaluation[];
  programEvaluations: ProgramEvaluation[];
}) {
  const {
    tahunAjaran,
    semester = 'Semua',
    rencanaTahunan,
    services,
    serviceEvaluations,
    programEvaluations,
  } = params;

  const filteredServices = (services || []).filter((s) => {
    if (getTahunAjaranFromDate(s.date) !== tahunAjaran) return false;
    if (semester === 'Ganjil' || semester === 'Genap') {
      return getSemesterFromDate(s.date) === semester;
    }
    return true;
  });

  const realCount: Record<string, number> = {
    'Layanan Dasar': 0,
    'Layanan Responsif': 0,
    'Perencanaan Individual': 0,
    'Dukungan Sistem': 0,
  };
  filteredServices.forEach((s) => {
    const b = mapServiceToEvaluationBidang(s);
    realCount[b] = (realCount[b] || 0) + 1;
  });

  const divisor = semester === 'Ganjil' || semester === 'Genap' ? 2 : 1;
  const targetMap: Record<string, number> = {
    'Layanan Dasar': Math.max(1, Math.round(rencanaTahunan.targetLayananDasar / divisor)),
    'Layanan Responsif': Math.max(1, Math.round(rencanaTahunan.targetLayananResponsif / divisor)),
    'Perencanaan Individual': Math.max(1, Math.round(rencanaTahunan.targetPerencanaanIndividual / divisor)),
    'Dukungan Sistem': Math.max(1, Math.round(rencanaTahunan.targetDukunganSistem / divisor)),
  };

  // Sheet 1: Target vs Realisasi 4 Bidang
  const targetVsRealisasiRows = STANDARD_EVALUATION_BIDANG.map((b) => {
    const target = targetMap[b] || 0;
    const realisasi = realCount[b] || 0;
    const pct = target > 0 ? Math.round((realisasi / target) * 100) : 0;
    return {
      Bidang: b,
      'Tahun Ajaran': tahunAjaran,
      Semester: semester,
      Target: target,
      Realisasi: realisasi,
      'Capaian (%)': `${pct}%`,
      Status: pct >= 100 ? 'Tercapai' : 'Belum',
    };
  });

  // Sheet 2: Rencana Program Tahunan
  const rencanaRows = [
    { Parameter: 'Tahun Ajaran', Nilai: rencanaTahunan.tahunAjaran },
    { Parameter: 'Jam BK / Minggu / Kelas', Nilai: rencanaTahunan.jamPerMinggu },
    { Parameter: 'Jumlah Kelas', Nilai: rencanaTahunan.jumlahKelas },
    { Parameter: 'Fokus Utama', Nilai: rencanaTahunan.fokusUtama },
    { Parameter: 'Minggu Efektif (52 - 14 Libur/Ujian)', Nilai: rencanaTahunan.mingguEfektif },
    { Parameter: 'Pertemuan per Kelas / Tahun', Nilai: rencanaTahunan.pertemuanPerKelas },
    { Parameter: 'Total Klasikal / Tahun', Nilai: rencanaTahunan.totalKlasikal },
    { Parameter: 'Total Klasikal / Semester', Nilai: rencanaTahunan.perSemester },
    { Parameter: 'Target Realistis 90% Klasikal', Nilai: rencanaTahunan.targetRealistis90 },
    { Parameter: 'Target Layanan Dasar', Nilai: rencanaTahunan.targetLayananDasar },
    { Parameter: 'Target Layanan Responsif', Nilai: rencanaTahunan.targetLayananResponsif },
    { Parameter: 'Target Perencanaan Individual', Nilai: rencanaTahunan.targetPerencanaanIndividual },
    { Parameter: 'Target Dukungan Sistem', Nilai: rencanaTahunan.targetDukunganSistem },
    { Parameter: 'Total Target Tahunan', Nilai: rencanaTahunan.totalTarget },
    { Parameter: 'Peringatan Beban (>400)', Nilai: rencanaTahunan.isOverloaded ? 'Terlalu tinggi untuk 1 guru BK' : 'Realistis' },
    { Parameter: 'Catatan Strategis AI', Nilai: rencanaTahunan.aiNote },
  ];

  // Sheet 3: Evaluasi Program BK
  const progRows = (programEvaluations || [])
    .filter((e) => e.evaluationScope === 'program')
    .map((e) => ({
      'Nama Program': e.namaProgram,
      Semester: e.semester || '-',
      'Tahun Ajaran': e.tahunAjaran || '-',
      Tanggal: formatTanggalIndonesia(e.tanggal),
      'Layanan Dinilai': e.programMetrics?.evaluatedServicesCount ?? e.realisasi ?? 0,
      'Rata 6 Skor': Number(e.nilai || 0).toFixed(2),
      'Hasil Ringkas': e.hasil || '-',
      'Rencana Lanjutkan': e.rencanaPerbaikan?.lanjutkan || '-',
      'Rencana Ubah': e.rencanaPerbaikan?.ubah || '-',
      'Butuh Dukungan': e.rencanaPerbaikan?.butuhDukungan || '-',
    }));

  // Sheet 4: Evaluasi Layanan
  const layRows = (serviceEvaluations || [])
    .filter(
      (e) =>
        e.evaluationScope !== 'program' &&
        e.evaluationScope !== 'kebutuhan-awal' &&
        e.evaluationScope !== 'rencana-tahunan'
    )
    .map((e) => ({
      Tanggal: formatTanggalIndonesia(e.tanggal),
      Siswa: e.namaProgram || '-',
      Kelas: e.kelas || '-',
      Bidang: e.bidang || '-',
      'Jenis Masalah': e.jenisMasalah || '-',
      Teknik: e.teknikDipakai || '-',
      'Rata Skor': getEffectiveServiceEvalScore(e).toFixed(2),
      'Status Tindak Lanjut': e.statusTindakLanjut || '-',
      'Jadwal Tindak Lanjut': formatTanggalIndonesia(e.tanggalTindakLanjut),
      'Penanggung Jawab': e.penanggungJawabTindakLanjut || '-',
    }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(targetVsRealisasiRows), 'Target vs Realisasi');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rencanaRows), 'Rencana Tahunan');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(progRows.length > 0 ? progRows : [{ Info: 'Belum ada dokumen Evaluasi Program BK' }]),
    'Evaluasi Program'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(layRows.length > 0 ? layRows : [{ Info: 'Belum ada dokumen Evaluasi Layanan' }]),
    'Evaluasi Layanan'
  );

  const safeTa = tahunAjaran.replace(/[^0-9]/g, '');
  XLSX.writeFile(wb, `Laporan_BK_Program_Evaluasi_${safeTa}.xlsx`);
  showToast('File Excel (.xlsx) Program & Evaluasi BK berhasil diunduh!', 'success');
}
