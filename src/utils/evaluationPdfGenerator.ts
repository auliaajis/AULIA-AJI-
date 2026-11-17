import { jsPDF } from 'jspdf';
import { CounselingService, Counselor, ProgramEvaluation, RencanaTahunanData, Student, BKJournalEntry } from '../types';
import { drawLetterhead, finalizeAndSavePdf, getActiveCounselorSigner } from './pdfGenerator';
import { getSchoolConfig } from './schoolConfig';
import {
  EVALUATION_6_SCORES_META,
  STANDARD_EVALUATION_BIDANG,
  computeBaselineKondisiAwal,
  computeEvaluationPercentage,
  computeProgramFromServiceEvaluations,
  formatTanggalIndonesia,
  getEffectiveServiceEvalScore,
  getNormalizedEvidenceList,
  getSemesterFromDate,
  getTahunAjaranFromDate,
  hasRealStakeholderVoices,
  isServiceEvalFollowUpCompleted,
  isUncollectedPlaceholderText,
  mapServiceToEvaluationBidang,
  normalizeBidangTab,
} from './evaluationHelpers';

const NAVY_DARK: [number, number, number] = [11, 28, 48]; // #0b1c30
const TEAL_PRIMARY: [number, number, number] = [0, 104, 95]; // #00685f
const SLATE_TEXT: [number, number, number] = [61, 73, 71]; // #3d4947
const BORDER_GRAY: [number, number, number] = [188, 201, 198];
const SOFT_BG: [number, number, number] = [245, 248, 247];

function formatIndoDateShort(dateStr?: string): string {
  return formatTanggalIndonesia(dateStr);
}

function formatIndoDateLong(dateStr?: string): string {
  return formatTanggalIndonesia(dateStr);
}

function applyPageFooters(doc: jsPDF, schoolName: string, docTitle: string) {
  const totalPages = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
    doc.setLineWidth(0.25);
    doc.line(15, pageHeight - 14, pageWidth - 15, pageHeight - 14);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 112, 110);
    doc.text(`${docTitle} • ${schoolName}`, 15, pageHeight - 9.5);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - 15, pageHeight - 9.5, { align: 'right' });
  }
}

function drawSignatureBlock(
  doc: jsPDF,
  startY: number,
  activeCounselor?: Counselor
): number {
  const config = getSchoolConfig();
  const signer = getActiveCounselorSigner(activeCounselor);
  const todayStr = formatIndoDateLong(new Date().toISOString().slice(0, 10));
  const city = (config.schoolAddress || '').split(',')[0]?.trim() || 'Susukan';

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);

  doc.text('Mengetahui,', 25, startY);
  doc.text(`${city}, ${todayStr}`, 132, startY);

  doc.setFont('Helvetica', 'bold');
  doc.text('Kepala Sekolah,', 25, startY + 5);
  doc.text('Guru Bimbingan & Konseling,', 132, startY + 5);

  doc.setDrawColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  doc.setLineWidth(0.3);

  doc.text(config.principalName || 'Kepala Sekolah', 25, startY + 25);
  doc.line(25, startY + 26, 85, startY + 26);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`NIP. ${config.principalNip && config.principalNip !== '-' ? config.principalNip : '-'}`, 25, startY + 30.5);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(signer.name, 132, startY + 25);
  doc.line(132, startY + 26, 192, startY + 26);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`NIP. ${signer.nip}`, 132, startY + 30.5);

  return startY + 35;
}

export interface GlobalEvaluationPdfParams {
  evaluations: ProgramEvaluation[];
  serviceEvaluations?: ProgramEvaluation[];
  services: CounselingService[];
  students: Student[];
  journals: BKJournalEntry[];
  activeCounselor?: Counselor;
  semesterFilter: string;
  tahunAjaranFilter: string;
  classFilter: string;
}

/**
 * Generates the comprehensive multi-page Global Evaluation PDF Report
 * grounded strictly in real data from services, students, daily_journals, program_evaluations, and service_evaluations.
 */
export function downloadGlobalEvaluationPDF(params: GlobalEvaluationPdfParams) {
  const {
    evaluations: rawProgramEvaluations,
    serviceEvaluations: rawServiceEvaluations = [],
    services,
    students,
    journals,
    activeCounselor,
    semesterFilter,
    tahunAjaranFilter,
    classFilter,
  } = params;

  const kebutuhanPlans = rawProgramEvaluations.filter(
    (item) => item && item.evaluationScope === 'kebutuhan-awal'
  );
  const evalMap = new Map<string, ProgramEvaluation>();
  [...rawProgramEvaluations, ...rawServiceEvaluations].forEach((item) => {
    if (item && item.id && item.evaluationScope !== 'kebutuhan-awal') {
      evalMap.set(item.id, item);
    }
  });
  const evaluations = Array.from(evalMap.values());
  const programDocs = evaluations.filter((e) => e.evaluationScope === 'program');
  const latestProgramDoc = programDocs[0] || null;
  const latestKebutuhanDoc = kebutuhanPlans[0] || null;

  const config = getSchoolConfig();
  const signer = getActiveCounselorSigner(activeCounselor);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 15;
  const contentWidth = pageWidth - marginX * 2;
  let y = 15;

  const ensureSpace = (needed: number, headerSubtitle?: string) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      doc.setFillColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
      doc.rect(marginX, 11, contentWidth, 6.5, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(
        headerSubtitle || 'LAPORAN EVALUASI PROGRAM BIMBINGAN DAN KONSELING',
        marginX + 3,
        15.4
      );
      doc.text(config.schoolName || 'SMP N 2 Susukan', pageWidth - marginX - 3, 15.4, { align: 'right' });
      y = 24;
    }
  };

  // ==================== HALAMAN 1: KOP & RINGKASAN GLOBAL ====================
  drawLetterhead(doc, NAVY_DARK);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  doc.text('LAPORAN EVALUASI PROGRAM BIMBINGAN DAN KONSELING', pageWidth / 2, 43, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(SLATE_TEXT[0], SLATE_TEXT[1], SLATE_TEXT[2]);
  const periodLabel = `Semester: ${semesterFilter === 'Semua' ? 'Semua Semester' : semesterFilter}  •  Tahun Ajaran: ${
    tahunAjaranFilter === 'Semua' ? 'Semua Tahun Ajaran' : tahunAjaranFilter
  }  •  Kelas: ${classFilter === 'Semua' ? 'Semua Kelas' : classFilter}`;
  doc.text(periodLabel, pageWidth / 2, 48.5, { align: 'center' });
  doc.text(`Guru BK / Koordinator: ${signer.name} (NIP. ${signer.nip})`, pageWidth / 2, 53.5, { align: 'center' });

  y = 60;

  // Compute metrics STRICTLY from Evaluasi Layanan (services only used to count Sudah vs Belum Dievaluasi)
  const totalServices = services.length;
  const totalStudents = students.length;
  const totalJournals = journals.length;
  const evalServiceIds = new Set(
    rawServiceEvaluations.map((e) => String(e.serviceId || '')).filter(Boolean)
  );
  const evaluatedSrvCount = services.filter((s) => evalServiceIds.has(s.id)).length;
  const unevaluatedSrvCount = Math.max(0, totalServices - evaluatedSrvCount);

  const effectiveServiceEvals =
    rawServiceEvaluations.length > 0
      ? rawServiceEvaluations
      : evaluations.filter((e) => e.evaluationScope !== 'program');

  const avg6ScoresList = effectiveServiceEvals
    .map((e) => getEffectiveServiceEvalScore(e))
    .filter((v) => v > 0);
  const avgScore =
    avg6ScoresList.length > 0
      ? (avg6ScoresList.reduce((sum, v) => sum + v, 0) / avg6ScoresList.length).toFixed(2)
      : '0.00';

  const deltas = effectiveServiceEvals
    .map((e) => e.followUpCheck?.delta)
    .filter((d): d is number => typeof d === 'number');
  const avgDeltaStr =
    deltas.length > 0
      ? `${(deltas.reduce((a, b) => a + b, 0) / deltas.length) >= 0 ? '+' : ''}${(
          deltas.reduce((a, b) => a + b, 0) / deltas.length
        ).toFixed(2)}`
      : 'Belum Dicek';

  const completedRtlCount = effectiveServiceEvals.filter((e) => isServiceEvalFollowUpCompleted(e)).length;
  const pctRtlDone =
    effectiveServiceEvals.length > 0
      ? Math.round((completedRtlCount / effectiveServiceEvals.length) * 100)
      : 0;

  const activeFollowUps = effectiveServiceEvals.filter((e) => !isServiceEvalFollowUpCompleted(e));

  const progAgg = computeProgramFromServiceEvaluations({
    services,
    serviceEvaluations: effectiveServiceEvals,
    semester: semesterFilter === 'Ganjil' || semesterFilter === 'Genap' ? semesterFilter : 'Ganjil',
    tahunAjaran: tahunAjaranFilter === 'Semua' ? '2026/2027' : tahunAjaranFilter,
    classFilter,
    activeCounselor,
  });

  // KPI Grid (3x2)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  doc.text('A. RINGKASAN GLOBAL BERBASIS EVALUASI LAYANAN', marginX, y);
  y += 3.5;

  const kpiCards = [
    { label: 'Layanan Real (Dinilai vs Belum)', value: `${totalServices} (${evaluatedSrvCount} / ${unevaluatedSrvCount})` },
    { label: 'Siswa & Jurnal Harian', value: `${totalStudents} Siswa • ${totalJournals} Jnl` },
    { label: 'Rata-rata 6 Skor Layanan', value: `${avgScore} / 5.0` },
    { label: 'Delta Baseline -> Follow-up', value: avgDeltaStr },
    { label: '% Tindak Lanjut Selesai', value: `${pctRtlDone}%` },
    { label: 'RTL Belum Selesai', value: `${activeFollowUps.length} Layanan` },
  ];

  const cardW = (contentWidth - 8) / 3;
  const cardH = 14.5;
  kpiCards.forEach((card, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const cx = marginX + col * (cardW + 4);
    const cy = y + row * (cardH + 3);

    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
    doc.setLineWidth(0.25);
    doc.roundedRect(cx, cy, cardW, cardH, 1.5, 1.5, 'FD');

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(SLATE_TEXT[0], SLATE_TEXT[1], SLATE_TEXT[2]);
    doc.text(card.label, cx + 3, cy + 5.2);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
    doc.text(card.value, cx + 3, cy + 11.4);
  });

  y += 2 * (cardH + 3) + 4;

  // Table 4 Bidang Summary
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  doc.text('B. REKAPITULASI CAPAIAN 4 BIDANG PROGRAM BK', marginX, y);
  y += 3;

  const colWidths4B = [10, 56, 26, 28, 30, 30]; // sum = 180
  const drawTableHeader = (headers: string[], widths: number[], startY: number) => {
    doc.setFillColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
    doc.rect(marginX, startY, widths.reduce((a, b) => a + b, 0), 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    let tx = marginX;
    headers.forEach((h, i) => {
      doc.text(h, tx + 2.5, startY + 5.3);
      tx += widths[i];
    });
    return startY + 8;
  };

  y = drawTableHeader(
    ['No', 'Bidang Program BK', 'Layanan Real', 'Evaluasi', 'Ketercapaian', 'Rata Nilai'],
    colWidths4B,
    y
  );

  const bidangSummary = STANDARD_EVALUATION_BIDANG.map((bidang) => {
    const bServices = services.filter((s) => mapServiceToEvaluationBidang(s) === bidang);
    const pcts: number[] = [];
    const scores: number[] = [];
    let evalCount = 0;

    evaluations.forEach((ev) => {
      const matchedSub = Array.isArray(ev.bidangList)
        ? ev.bidangList.find((item) => normalizeBidangTab(item.bidang) === bidang)
        : undefined;

      if (matchedSub) {
        evalCount += 1;
        const p = computeEvaluationPercentage(matchedSub.realisasi, matchedSub.target);
        if (p !== null) pcts.push(p);
        if (Number(matchedSub.nilai) > 0) scores.push(Number(matchedSub.nilai));
      } else if (
        (!Array.isArray(ev.bidangList) || ev.bidangList.length === 0) &&
        normalizeBidangTab(ev.bidang) === bidang
      ) {
        evalCount += 1;
        const p = computeEvaluationPercentage(ev.realisasi, ev.target);
        if (p !== null) pcts.push(p);
        if (Number(ev.nilai) > 0) scores.push(Number(ev.nilai));
      }
    });

    const avgPct =
      pcts.length > 0
        ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
        : bServices.length > 0
          ? Math.round((bServices.filter((s) => s.status === 'Selesai').length / bServices.length) * 100)
          : 0;
    const avgVal =
      scores.length > 0
        ? (scores.reduce((sum, v) => sum + v, 0) / scores.length).toFixed(1)
        : '-';
    return {
      bidang,
      serviceCount: bServices.length,
      evalCount,
      avgPct,
      avgVal,
    };
  });

  bidangSummary.forEach((row, idx) => {
    const rowH = 7.5;
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 249);
      doc.rect(marginX, y, contentWidth, rowH, 'F');
    }
    doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
    doc.setLineWidth(0.2);
    let rx = marginX;
    const cells = [
      String(idx + 1),
      row.bidang,
      `${row.serviceCount} Sesi`,
      `${row.evalCount} Dok`,
      `${row.avgPct}%`,
      row.avgVal === '-' ? '-' : `${row.avgVal} / 5`,
    ];
    doc.setFont('Helvetica', idx === 0 ? 'bold' : 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
    cells.forEach((val, ci) => {
      doc.rect(rx, y, colWidths4B[ci], rowH, 'D');
      doc.setFont('Helvetica', ci === 1 || ci === 4 ? 'bold' : 'normal');
      doc.text(val, rx + 2.5, y + 5);
      rx += colWidths4B[ci];
    });
    y += rowH;
  });

  y += 7;

  // Bar Chart Ketercapaian 4 Bidang (Vector drawn cleanly)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  doc.text('C. GRAFIK PERSENTASE KETERCAPAIAN PER BIDANG (%)', marginX, y);
  y += 3;

  const chartBoxH = 44;
  doc.setFillColor(252, 253, 253);
  doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
  doc.setLineWidth(0.25);
  doc.rect(marginX, y, contentWidth, chartBoxH, 'FD');

  const chartBaseY = y + 32;
  const maxBarH = 22;
  // Horizontal grid lines
  [0, 50, 100].forEach((pctTick) => {
    const gy = chartBaseY - (pctTick / 100) * maxBarH;
    doc.setDrawColor(225, 232, 230);
    doc.setLineWidth(0.15);
    doc.line(marginX + 14, gy, pageWidth - marginX - 6, gy);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 130, 128);
    doc.text(`${pctTick}%`, marginX + 12, gy + 1.5, { align: 'right' });
  });

  const barColors: [number, number, number][] = [
    [0, 104, 95],   // Teal
    [217, 119, 6],  // Amber
    [29, 78, 216],  // Blue
    [124, 58, 237], // Purple
  ];
  const barSlotW = (contentWidth - 24) / 4;
  bidangSummary.forEach((b, idx) => {
    const clampedPct = Math.max(0, Math.min(100, b.avgPct));
    const barH = Math.max(1.5, (clampedPct / 100) * maxBarH);
    const bx = marginX + 20 + idx * barSlotW;
    const bw = 20;
    const by = chartBaseY - barH;

    const c = barColors[idx % barColors.length];
    doc.setFillColor(c[0], c[1], c[2]);
    doc.rect(bx, by, bw, barH, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
    doc.text(`${b.avgPct}%`, bx + bw / 2, by - 1.5, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(SLATE_TEXT[0], SLATE_TEXT[1], SLATE_TEXT[2]);
    const shortLabel =
      b.bidang === 'Perencanaan Individual' ? 'Perenc. Individual' : b.bidang;
    doc.text(shortLabel, bx + bw / 2, chartBaseY + 5, { align: 'center' });
    doc.setFontSize(6.5);
    doc.text(`(${b.serviceCount} layanan)`, bx + bw / 2, chartBaseY + 9, { align: 'center' });
  });

  y += chartBoxH + 6;

  // Tren Per Semester table
  ensureSpace(45);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  doc.text('D. TREN PELAKSANAAN & EVALUASI PER SEMESTER', marginX, y);
  y += 3;

  const periodBuckets = new Map<string, { ta: string; sem: string; srv: number; ev: number; pcts: number[]; vals: number[] }>();
  services.forEach((s) => {
    const sem = getSemesterFromDate(s.date);
    const ta = getTahunAjaranFromDate(s.date);
    const key = `${ta}|${sem}`;
    if (!periodBuckets.has(key)) periodBuckets.set(key, { ta, sem, srv: 0, ev: 0, pcts: [], vals: [] });
    periodBuckets.get(key)!.srv += 1;
  });
  evaluations.forEach((e) => {
    const sem = e.semester || getSemesterFromDate(e.tanggal);
    const ta = e.tahunAjaran || getTahunAjaranFromDate(e.tanggal);
    const key = `${ta}|${sem}`;
    if (!periodBuckets.has(key)) periodBuckets.set(key, { ta, sem, srv: 0, ev: 0, pcts: [], vals: [] });
    const b = periodBuckets.get(key)!;
    b.ev += 1;
    const p = computeEvaluationPercentage(e.realisasi, e.target);
    if (p !== null) b.pcts.push(p);
    if (Number(e.nilai) > 0) b.vals.push(Number(e.nilai));
  });

  const trendRows = Array.from(periodBuckets.values()).sort((a, b) =>
    `${a.ta} ${a.sem === 'Ganjil' ? '1' : '2'}`.localeCompare(`${b.ta} ${b.sem === 'Ganjil' ? '1' : '2'}`)
  );

  const trendCols = [42, 34, 34, 35, 35];
  y = drawTableHeader(['Tahun Ajaran', 'Semester', 'Total Layanan', 'Terevaluasi', 'Rata Nilai / %'], trendCols, y);

  if (trendRows.length === 0) {
    doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
    doc.rect(marginX, y, contentWidth, 7.5, 'D');
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(SLATE_TEXT[0], SLATE_TEXT[1], SLATE_TEXT[2]);
    doc.text('Belum ada data semester pada filter periode yang dipilih.', marginX + 3, y + 5);
    y += 7.5;
  } else {
    trendRows.slice(0, 6).forEach((tr, idx) => {
      ensureSpace(8);
      const rowH = 7.5;
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 249);
        doc.rect(marginX, y, contentWidth, rowH, 'F');
      }
      const avgP = tr.pcts.length > 0 ? `${Math.round(tr.pcts.reduce((a, b) => a + b, 0) / tr.pcts.length)}%` : '-';
      const avgV = tr.vals.length > 0 ? `${(tr.vals.reduce((a, b) => a + b, 0) / tr.vals.length).toFixed(1)}/5` : '-';
      const cells = [tr.ta, tr.sem, `${tr.srv} Sesi`, `${tr.ev} Evaluasi`, `${avgV} (${avgP})`];
      let rx = marginX;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
      doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
      cells.forEach((c, ci) => {
        doc.rect(rx, y, trendCols[ci], rowH, 'D');
        doc.text(c, rx + 2.5, y + 5);
        rx += trendCols[ci];
      });
      y += rowH;
    });
  }

  // ==================== HALAMAN 2 DST: RINCIAN PER BIDANG ====================
  STANDARD_EVALUATION_BIDANG.forEach((bidang, bIdx) => {
    doc.addPage();
    doc.setFillColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
    doc.rect(marginX, 12, contentWidth, 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`BIDANG ${bIdx + 1}: ${bidang.toUpperCase()}`, marginX + 3, 17.3);
    doc.setFontSize(8);
    doc.text(config.schoolName || 'SMP N 2 Susukan', pageWidth - marginX - 3, 17.3, { align: 'right' });

    y = 26;

    const bServices = services.filter((s) => mapServiceToEvaluationBidang(s) === bidang);
    const bEvals = evaluations.filter((e) => {
      if (Array.isArray(e.bidangList) && e.bidangList.length > 0) {
        return e.bidangList.some((item) => normalizeBidangTab(item.bidang) === bidang);
      }
      return normalizeBidangTab(e.bidang) === bidang;
    });

    // 1. Tabel Data Real Layanan (dari services)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
    doc.text(`1. Daftar Layanan Terealisasi (${bServices.length} Sesi dari Data Layanan)`, marginX, y);
    y += 3;

    const srvCols = [10, 62, 24, 34, 24, 26]; // sum = 180
    y = drawTableHeader(['No', 'Topik / Jenis Layanan', 'Tanggal', 'Sasaran', 'Peserta', 'Status'], srvCols, y);

    if (bServices.length === 0) {
      doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
      doc.rect(marginX, y, contentWidth, 7.5, 'D');
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(SLATE_TEXT[0], SLATE_TEXT[1], SLATE_TEXT[2]);
      doc.text(`Belum ada rekaman layanan untuk bidang ${bidang} pada filter ini.`, marginX + 3, y + 5);
      y += 9.5;
    } else {
      bServices.slice(0, 25).forEach((srv, idx) => {
        const topicText = doc.splitTextToSize(`${srv.problem || srv.serviceType} (${srv.serviceType})`, srvCols[1] - 4);
        const rowH = Math.max(7.5, topicText.length * 4 + 3);
        ensureSpace(rowH + 4, `BIDANG ${bIdx + 1}: ${bidang.toUpperCase()}`);
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 249);
          doc.rect(marginX, y, contentWidth, rowH, 'F');
        }
        doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
        const classesList = Array.from(new Set((srv.students || []).map((st) => st.class).filter(Boolean))).join(', ') || (srv.targetType || 'Umum');
        const cells = [
          String(idx + 1),
          topicText,
          formatIndoDateShort(srv.date),
          doc.splitTextToSize(classesList, srvCols[3] - 4),
          `${(srv.students || []).length} siswa`,
          srv.status || 'Selesai',
        ];
        let rx = marginX;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
        cells.forEach((cellVal, ci) => {
          doc.rect(rx, y, srvCols[ci], rowH, 'D');
          if (Array.isArray(cellVal)) {
            doc.text(cellVal, rx + 2, y + 4.3);
          } else {
            doc.text(String(cellVal), rx + 2, y + 4.8);
          }
          rx += srvCols[ci];
        });
        y += rowH;
      });
      if (bServices.length > 25) {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(SLATE_TEXT[0], SLATE_TEXT[1], SLATE_TEXT[2]);
        doc.text(`... serta ${bServices.length - 25} sesi layanan lainnya pada bidang ini.`, marginX, y + 4);
        y += 6;
      }
      y += 5;
    }

    // 2. Detail Evaluasi Program (Narasi Hasil, Kondisi Awal vs Setelah, Feedback & Foto Bukti)
    ensureSpace(22, `BIDANG ${bIdx + 1}: ${bidang.toUpperCase()}`);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
    doc.text(`2. Narasi Evaluasi, Feedback & Dokumentasi Bukti (${bEvals.length} Evaluasi)`, marginX, y);
    y += 4;

    if (bEvals.length === 0) {
      doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
      doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
      doc.rect(marginX, y, contentWidth, 10, 'FD');
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(SLATE_TEXT[0], SLATE_TEXT[1], SLATE_TEXT[2]);
      doc.text('Belum ada catatan evaluasi terstruktur pada bidang ini. Gunakan tombol "Tambah Evaluasi" di aplikasi.', marginX + 3, y + 6.2);
      y += 14;
    } else {
      bEvals.forEach((ev, evIdx) => {
        const matchedSub = Array.isArray(ev.bidangList)
          ? ev.bidangList.find((item) => normalizeBidangTab(item.bidang) === bidang)
          : undefined;
        const effectiveReal = matchedSub ? matchedSub.realisasi : ev.realisasi;
        const effectiveTarget = matchedSub ? matchedSub.target : ev.target;
        const effectiveNilai = matchedSub ? matchedSub.nilai : ev.nilai;
        const effectiveKondisiAwal = (matchedSub?.kondisiAwal || ev.kondisiAwal || '-');
        const effectiveKondisiSetelah = (matchedSub?.kondisiSetelah || ev.kondisiSetelah || '-');

        const pct = computeEvaluationPercentage(effectiveReal, effectiveTarget);
        const pctStr = pct !== null ? `${pct}% (${effectiveReal}/${effectiveTarget})` : `${effectiveReal} siswa`;
        const hasilLines = doc.splitTextToSize(ev.hasil || 'Hasil evaluasi belum dirinci.', contentWidth - 8);
        const kendalaLines = ev.kendala ? doc.splitTextToSize(`Kendala: ${ev.kendala}`, contentWidth - 8) : [];
        const rtlLines = ev.tindakLanjut
          ? doc.splitTextToSize(
              `Tindak Lanjut (${ev.statusTindakLanjut || 'Masih Berjalan'}${ev.tanggalTindakLanjut ? ` • ${formatIndoDateShort(ev.tanggalTindakLanjut)}` : ''}): ${ev.tindakLanjut}`,
              contentWidth - 8
            )
          : [];
        const kondisiAwalLines = doc.splitTextToSize(`Sebelum: ${effectiveKondisiAwal}`, contentWidth / 2 - 8);
        const kondisiSetelahLines = doc.splitTextToSize(`Setelah: ${effectiveKondisiSetelah}`, contentWidth / 2 - 8);
        const fbSiswaLine =
          ev.feedbackSiswaNilai > 0 || ev.feedbackSiswaKomentar
            ? doc.splitTextToSize(
                `Feedback Siswa (${ev.feedbackSiswaNilai || '-'}/5): "${ev.feedbackSiswaKomentar || 'Baik'}"`,
                contentWidth - 8
              )
            : [];
        const fbWaliLine =
          ev.feedbackWaliNama || ev.feedbackWaliKomentar
            ? doc.splitTextToSize(
                `Feedback Wali/Ortu (${ev.feedbackWaliNama || 'Wali'}): "${ev.feedbackWaliKomentar || '-'}"`,
                contentWidth - 8
              )
            : [];

        const images = getNormalizedEvidenceList(ev.buktiFoto).filter((f) => f.dataUrl.startsWith('data:image/'));
        const imgBlockH = images.length > 0 ? 22 : 0;

        const blockHeight =
          14 +
          Math.max(kondisiAwalLines.length, kondisiSetelahLines.length) * 3.8 +
          hasilLines.length * 4 +
          kendalaLines.length * 3.8 +
          rtlLines.length * 3.8 +
          fbSiswaLine.length * 3.8 +
          fbWaliLine.length * 3.8 +
          imgBlockH +
          10;

        ensureSpace(Math.min(blockHeight, 120), `BIDANG ${bIdx + 1}: ${bidang.toUpperCase()}`);

        // Card Header Strip
        doc.setFillColor(230, 244, 241); // Soft teal header
        doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
        doc.rect(marginX, y, contentWidth, 9, 'FD');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.8);
        doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
        doc.text(`${evIdx + 1}. ${ev.namaProgram || 'Program Evaluasi BK'}`, marginX + 3, y + 5.8);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(TEAL_PRIMARY[0], TEAL_PRIMARY[1], TEAL_PRIMARY[2]);
        doc.text(
          `${formatIndoDateShort(ev.tanggal)} • Kelas: ${ev.kelas || '-'} • Capaian: ${pctStr} • Nilai: ${effectiveNilai || '-'}/5`,
          pageWidth - marginX - 3,
          y + 5.8,
          { align: 'right' }
        );

        const bodyStartY = y + 9;
        let cy = bodyStartY + 4.5;

        // Kondisi Awal vs Setelah side-by-side
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.setTextColor(SLATE_TEXT[0], SLATE_TEXT[1], SLATE_TEXT[2]);
        doc.text(kondisiAwalLines, marginX + 3, cy);
        doc.text(kondisiSetelahLines, marginX + contentWidth / 2 + 2, cy);
        cy += Math.max(kondisiAwalLines.length, kondisiSetelahLines.length) * 3.8 + 2.5;

        // Hasil Narrative
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
        doc.text('Hasil Evaluasi:', marginX + 3, cy);
        cy += 3.8;
        doc.setFont('Helvetica', 'normal');
        doc.text(hasilLines, marginX + 3, cy);
        cy += hasilLines.length * 4 + 1.5;

        if (kendalaLines.length > 0) {
          doc.setTextColor(140, 60, 20);
          doc.text(kendalaLines, marginX + 3, cy);
          cy += kendalaLines.length * 3.8 + 1.5;
        }
        if (rtlLines.length > 0) {
          doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
          doc.text(rtlLines, marginX + 3, cy);
          cy += rtlLines.length * 3.8 + 1.5;
        }
        if (fbSiswaLine.length > 0) {
          doc.setTextColor(TEAL_PRIMARY[0], TEAL_PRIMARY[1], TEAL_PRIMARY[2]);
          doc.text(fbSiswaLine, marginX + 3, cy);
          cy += fbSiswaLine.length * 3.8 + 1;
        }
        if (fbWaliLine.length > 0) {
          doc.setTextColor(SLATE_TEXT[0], SLATE_TEXT[1], SLATE_TEXT[2]);
          doc.text(fbWaliLine, marginX + 3, cy);
          cy += fbWaliLine.length * 3.8 + 1.5;
        }

        // Photo thumbnails (max 3)
        if (images.length > 0) {
          let ix = marginX + 3;
          images.slice(0, 3).forEach((img) => {
            try {
              const fmt = img.dataUrl.toLowerCase().includes('image/png') ? 'PNG' : 'JPEG';
              doc.addImage(img.dataUrl, fmt, ix, cy + 1, 24, 17);
              doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
              doc.rect(ix, cy + 1, 24, 17, 'D');
              ix += 27;
            } catch {
              // Skip unreadable image format gracefully
            }
          });
          cy += 20;
        }

        const totalCardH = cy - bodyStartY + 2;
        doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
        doc.rect(marginX, bodyStartY, contentWidth, totalCardH, 'D');
        y = bodyStartY + totalCardH + 4;
      });
    }
  });

  // ==================== BAGIAN AKHIR: KESIMPULAN, REKOMENDASI, RTL & TTD ====================
  doc.addPage();
  doc.setFillColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  doc.rect(marginX, 12, contentWidth, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('KESIMPULAN, REKOMENDASI & DAFTAR TINDAK LANJUT', marginX + 3, 17.3);
  y = 27;

  const completenessWarning =
    unevaluatedSrvCount > 0 || progAgg.pendingFollowUpCount > 0
      ? `CATATAN KEJUJURAN DATA: Kesimpulan ini masih bersifat sementara karena ${unevaluatedSrvCount} layanan belum dievaluasi dan ${progAgg.pendingFollowUpCount} evaluasi belum memiliki hasil cek follow-up.`
      : '';

  const autoRecommendations = [
    unevaluatedSrvCount > 0
      ? `Segera selesaikan pengisian Form Evaluasi Layanan untuk ${unevaluatedSrvCount} layanan yang masih berstatus "Belum Dievaluasi" agar analisis Program BK akurat 100%.`
      : `Pertahankan kedisiplinan pengisian Evaluasi Layanan langsung setelah sesi konseling berakhir.`,
    activeFollowUps.length > 0
      ? `Lakukan pemantauan dan Cek Follow-up 14 Hari terhadap ${activeFollowUps.length} rencana tindak lanjut yang belum selesai.`
      : `Seluruh tindak lanjut evaluasi layanan telah diselesaikan sesuai rencana.`,
    progAgg.byTeknik.length > 0
      ? `Teknik yang paling efektif digunakan sejauh ini adalah ${[...progAgg.byTeknik].sort((a, b) => b.rataRataSkor - a.rataRataSkor)[0]?.teknik} (${[...progAgg.byTeknik].sort((a, b) => b.rataRataSkor - a.rataRataSkor)[0]?.rataRataSkor.toFixed(2)}/5).`
      : `Optimalkan variasi teknik layanan sesuai kebutuhan masalah siswa.`,
  ];

  const activeKebutuhan = latestProgramDoc?.kebutuhanAwal || latestKebutuhanDoc?.kebutuhanAwal || null;
  const activeStakeholder = latestProgramDoc?.suaraStakeholder || null;
  const activeRefleksi = latestProgramDoc?.refleksiKonselor || null;
  const activePerbaikan = latestProgramDoc?.rencanaPerbaikan || null;

  const stakeholderTextGlobal = hasRealStakeholderVoices(activeStakeholder)
    ? [
        !isUncollectedPlaceholderText(activeStakeholder?.suaraSiswa)
          ? `Siswa: "${activeStakeholder?.suaraSiswa}"`
          : '',
        !isUncollectedPlaceholderText(activeStakeholder?.suaraWaliKelas)
          ? `Wali Kelas: "${activeStakeholder?.suaraWaliKelas}"`
          : '',
        !isUncollectedPlaceholderText(activeStakeholder?.suaraKepsekOrtu)
          ? `Kepsek/Ortu: "${activeStakeholder?.suaraKepsekOrtu}"`
          : '',
        latestProgramDoc?.aiEvaluasiStakeholder || '',
      ]
        .filter(Boolean)
        .join('\n')
    : latestProgramDoc?.aiEvaluasiStakeholder ||
      'Suara stakeholder belum terkumpul, evaluasi ini masih dari sudut pandang Guru BK saja.';

  const kebutuhanTextGlobal =
    latestProgramDoc?.aiPerbandinganKebutuhan ||
    (activeKebutuhan?.kebutuhanUtama?.length
      ? `Fokus Kebutuhan Awal: ${activeKebutuhan.kebutuhanUtama.join(' & ')} (${activeKebutuhan.caraMenentukan}). Layanan terbanyak dijalankan: ${
          progAgg.byJenisMasalah[0]?.jenisMasalah || '-'
        }.`
      : 'Kebutuhan awal semester belum dicatat di Rencana Program.');

  const kasusTextGlobal = `Total Kasus: ${progAgg.caseSummary.totalKasus}  •  Tuntas: ${progAgg.caseSummary.tuntas}  •  Masih Berproses: ${progAgg.caseSummary.masihBerproses}  •  Dirujuk ke Psikolog/Pihak Luar: ${progAgg.caseSummary.dirujuk}  •  Tidak Tertangani: ${progAgg.caseSummary.tidakTertangani}${
    latestProgramDoc?.aiInterpretasiKasus ? `\n${latestProgramDoc.aiInterpretasiKasus}` : ''
  }`;

  const nineSectionNarrative = [
    completenessWarning || '',
    `1. TARGET vs REALISASI (4 BIDANG):\n${bidangSummary
      .map((b) => `• ${b.bidang}: ${b.serviceCount} layanan real, ${b.evalCount} dok evaluasi, capaian ${b.avgPct}%, nilai ${b.avgVal}/5`)
      .join('\n')}`,
    `2. LAYANAN TERLAKSANA vs BATAL:\n• Total Layanan: ${totalServices} (${progAgg.servicesTerlaksana} Terlaksana, ${progAgg.servicesDibatalkan} Dibatalkan, ${progAgg.servicesTerjadwal} Terjadwal) — ${evaluatedSrvCount} Sudah Dinilai / ${unevaluatedSrvCount} Belum Dinilai.`,
    `3. RATA-RATA SKOR PER JENIS MASALAH & TEKNIK (Global ${avgScore}/5):\n${
      progAgg.byJenisMasalah.length > 0
        ? progAgg.byJenisMasalah
            .map(
              (m) =>
                `• ${m.jenisMasalah} (${m.totalEvaluasi}x): ${m.rataRataSkor.toFixed(2)}/5 (Teknik dominan: ${m.teknikDominan})`
            )
            .join('\n')
        : '• Belum ada data Evaluasi Layanan.'
    }`,
    `4. DELTA BASELINE -> FOLLOW-UP 14 HARI:\n• Rata-rata Delta: ${avgDeltaStr} (${progAgg.followUpCheckedCount} sudah dicek, ${progAgg.pendingFollowUpCount} menunggu)  •  RTL Selesai: ${pctRtlDone}%`,
    `5. KASUS TUNTAS / BERPROSES / RUJUKAN / TIDAK TERTANGANI:\n${kasusTextGlobal}`,
    `6. KEBUTUHAN AWAL vs REALISASI:\n${kebutuhanTextGlobal}`,
    `7. SUARA STAKEHOLDER:\n${stakeholderTextGlobal}`,
    `8. REFLEKSI KONSELOR:\n• Teknik Berhasil: ${activeRefleksi?.teknikBerhasil || '-'}\n• Perlu Diubah: ${activeRefleksi?.teknikGagalDiubah || '-'}\n• Kendala Sistemik: ${activeRefleksi?.kendalaTerbesar ? `${activeRefleksi.kendalaTerbesar}${activeRefleksi.kendalaPenjelas ? ` (${activeRefleksi.kendalaPenjelas})` : ''}` : '-'}`,
    `9. RENCANA PERBAIKAN SEMESTER DEPAN:\n• Lanjutkan: ${activePerbaikan?.lanjutkan || autoRecommendations[2]}\n• Hentikan: ${activePerbaikan?.hentikan || '-'}\n• Ubah: ${activePerbaikan?.ubah || autoRecommendations[0]}\n• Butuh Dukungan: ${activePerbaikan?.butuhDukungan || autoRecommendations[1]}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  doc.text('RINGKASAN AKHIR 9 BAGIAN EVALUASI PROGRAM BK', marginX, y);
  y += 3;

  const nineLines = doc.splitTextToSize(nineSectionNarrative, contentWidth - 8);
  nineLines.forEach((line: string) => {
    ensureSpace(6, 'KESIMPULAN & 9 BAGIAN EVALUASI PROGRAM BK');
    doc.setFont('Helvetica', line.match(/^\d+\.\s/) ? 'bold' : 'normal');
    doc.setFontSize(line.match(/^\d+\.\s/) ? 8.6 : 8.2);
    doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
    doc.text(line, marginX + 2, y + 3);
    y += 4.3;
  });
  y += 4;

  // Daftar Tindak Lanjut yang Masih Berjalan
  ensureSpace(35);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  doc.text(`LAMPIRAN TINDAK LANJUT YANG MASIH BERJALAN (${activeFollowUps.length} Item)`, marginX, y);
  y += 3;

  const rtlCols = [10, 48, 22, 54, 24, 22]; // sum = 180
  y = drawTableHeader(['No', 'Nama Program', 'Kelas', 'Rencana Tindak Lanjut', 'Target Tgl', 'Status'], rtlCols, y);

  if (activeFollowUps.length === 0) {
    doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
    doc.rect(marginX, y, contentWidth, 8, 'D');
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(SLATE_TEXT[0], SLATE_TEXT[1], SLATE_TEXT[2]);
    doc.text('Seluruh tindak lanjut program telah selesai ditindaklanjuti.', marginX + 3, y + 5.3);
    y += 12;
  } else {
    activeFollowUps.forEach((ev, idx) => {
      const progLines = doc.splitTextToSize(ev.namaProgram || '-', rtlCols[1] - 4);
      const rtlDescLines = doc.splitTextToSize(ev.tindakLanjut || '-', rtlCols[3] - 4);
      const rowH = Math.max(8, Math.max(progLines.length, rtlDescLines.length) * 4 + 3);
      ensureSpace(rowH + 10);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 249);
        doc.rect(marginX, y, contentWidth, rowH, 'F');
      }
      doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
      const cells = [
        String(idx + 1),
        progLines,
        ev.kelas || '-',
        rtlDescLines,
        formatIndoDateShort(ev.tanggalTindakLanjut),
        ev.statusTindakLanjut,
      ];
      let rx = marginX;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
      cells.forEach((val, ci) => {
        doc.rect(rx, y, rtlCols[ci], rowH, 'D');
        if (Array.isArray(val)) {
          doc.text(val, rx + 2, y + 4.3);
        } else {
          doc.text(String(val), rx + 2, y + 4.8);
        }
        rx += rtlCols[ci];
      });
      y += rowH;
    });
    y += 8;
  }

  ensureSpace(42);
  drawSignatureBlock(doc, y + 4, activeCounselor);
  applyPageFooters(doc, config.schoolName || 'SMP N 2 Susukan', 'Laporan Evaluasi Program BK');

  const safeSem = semesterFilter === 'Semua' ? 'Semua' : semesterFilter;
  const filename = `Laporan_Evaluasi_Program_BK_${safeSem}_${new Date().toISOString().slice(0, 10)}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'rekap',
    successToastMessage: 'Laporan Evaluasi Program BK PDF berhasil dicetak!',
  });
}

/**
 * Generates a single-program Evaluation Card PDF (used in Step 5 "Simpan & Cetak PDF" and card preview).
 */
export function downloadSingleEvaluationCardPDF(
  evaluation: ProgramEvaluation,
  activeCounselor?: Counselor
) {
  const config = getSchoolConfig();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 15;
  const contentWidth = pageWidth - marginX * 2;

  drawLetterhead(doc, NAVY_DARK);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  const cardHeading =
    evaluation.evaluationScope === 'layanan' || (evaluation.serviceId && evaluation.evaluationScope !== 'program')
      ? 'KARTU EVALUASI PELAKSANAAN LAYANAN BK'
      : 'KARTU EVALUASI PELAKSANAAN PROGRAM BK';
  doc.text(cardHeading, pageWidth / 2, 43, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(SLATE_TEXT[0], SLATE_TEXT[1], SLATE_TEXT[2]);
  doc.text(
    `Bidang: ${evaluation.bidang}  •  Semester ${evaluation.semester || getSemesterFromDate(evaluation.tanggal)} (${
      evaluation.tahunAjaran || getTahunAjaranFromDate(evaluation.tanggal)
    })`,
    pageWidth / 2,
    48.5,
    { align: 'center' }
  );

  let y = 55;
  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // Identitas & Metrik Table
  const pct = computeEvaluationPercentage(evaluation.realisasi, evaluation.target);
  const isLayananCard =
    evaluation.evaluationScope === 'layanan' || (Boolean(evaluation.serviceId) && evaluation.evaluationScope !== 'program');

  const metaRows: [string, string][] = isLayananCard
    ? [
        ['Nama Layanan / Topik', evaluation.namaProgram || '-'],
        ['Bidang & Jenis Masalah', `${evaluation.bidang}  •  Masalah: ${evaluation.jenisMasalah || '-'}`],
        ['Teknik & Tujuan Layanan', `${evaluation.teknikDipakai || evaluation.jenisLayanan || '-'}  •  Tujuan: ${evaluation.tujuanLayanan || '-'}`],
        ['Tanggal & Kelas Sasaran', `${formatIndoDateLong(evaluation.tanggal)}  •  Kelas: ${evaluation.kelas || '-'}`],
        ['Guru BK Pelaksana', `${evaluation.guruBk || evaluation.createdBy || '-'} (Sesi ke-${evaluation.layananKeBerapa || 1})`],
        [
          'Skor 6 Dimensi',
          evaluation.scores6
            ? `Total ${evaluation.scores6.totalSkor}/30  •  Rata-rata ${evaluation.scores6.rataRata}/5 (${evaluation.scores6.kategori})`
            : `${evaluation.nilai || 0} / 5 Bintang`,
        ],
      ]
    : [
        ['Nama Program BK', evaluation.namaProgram || '-'],
        ['Cakupan Bidang', evaluation.bidang || 'Semua 4 Bidang BK'],
        ['Periode & Kelas', `${evaluation.semester || '-'} ${evaluation.tahunAjaran || ''}  •  Kelas: ${evaluation.kelas || 'Semua Kelas'}`],
        ['Guru BK Pelaksana', evaluation.guruBk || evaluation.createdBy || '-'],
        [
          'Sudah vs Belum Dievaluasi',
          `${evaluation.programMetrics?.evaluatedServicesCount ?? evaluation.realisasi} sudah dinilai / ${
            evaluation.programMetrics?.totalServicesInPeriod ?? evaluation.realisasi
          } total layanan (${evaluation.programMetrics?.unevaluatedServicesCount ?? 0} belum)`,
        ],
        [
          'Rata 6 Skor & RTL Selesai',
          `${Number(evaluation.nilai || 0).toFixed(2)}/5  •  RTL Selesai: ${
            evaluation.programMetrics?.persenTindakLanjutSelesai ?? pct ?? 0
          }%`,
        ],
      ];

  metaRows.forEach(([label, val], idx) => {
    const valLines = doc.splitTextToSize(val, 120);
    const rh = Math.max(7.2, valLines.length * 4 + 3);
    if (idx % 2 === 0) {
      doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
      doc.rect(marginX, y, contentWidth, rh, 'F');
    }
    doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
    doc.rect(marginX, y, 56, rh, 'D');
    doc.rect(marginX + 56, y, contentWidth - 56, rh, 'D');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
    doc.text(label, marginX + 2.5, y + 4.8);

    doc.setFont('Helvetica', 'normal');
    doc.text(valLines, marginX + 58.5, y + 4.8);
    y += rh;
  });

  y += 5;

  if (Array.isArray(evaluation.bidangList) && evaluation.bidangList.length > 0) {
    ensureSpace(42);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
    doc.text('REKAPITULASI 4 BIDANG PROGRAM BK', marginX, y);
    y += 3;

    const bCols = [56, 26, 28, 30, 40]; // sum = 180
    doc.setFillColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
    doc.rect(marginX, y, contentWidth, 7.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(255, 255, 255);
    let hX = marginX;
    ['Bidang Program BK', 'Evaluasi', 'Siswa Unik', 'Capaian', 'Rata 6 Skor'].forEach((hdr, i) => {
      doc.text(hdr, hX + 2.5, y + 5);
      hX += bCols[i];
    });
    y += 7.5;

    evaluation.bidangList.forEach((bItem, bRowIdx) => {
      const rH = 7;
      if (bRowIdx % 2 === 1) {
        doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
        doc.rect(marginX, y, contentWidth, rH, 'F');
      }
      doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
      const rCells = [
        bItem.bidang,
        `${bItem.totalServices} Ev`,
        `${bItem.realisasi} Siswa`,
        bItem.target ? `${bItem.totalServices}/${bItem.target}` : '-',
        `${bItem.nilai || 0} / 5`,
      ];
      let cX = marginX;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
      rCells.forEach((val, ci) => {
        doc.rect(cX, y, bCols[ci], rH, 'D');
        doc.text(val, cX + 2.5, y + 4.8);
        cX += bCols[ci];
      });
      y += rH;
    });
    y += 5;
  }

  const drawTextBoxSection = (title: string, bodyText: string) => {
    const lines = doc.splitTextToSize(bodyText || '-', contentWidth - 6);
    const boxH = Math.max(12, lines.length * 4.3 + 9);
    ensureSpace(boxH + 4);
    doc.setFillColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
    doc.rect(marginX, y, contentWidth, 6.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(255, 255, 255);
    doc.text(title, marginX + 3, y + 4.5);

    doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
    doc.rect(marginX, y + 6.5, contentWidth, boxH - 6.5, 'D');
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
    doc.text(lines, marginX + 3, y + 11);
    y += boxH + 3.5;
  };

  if (isLayananCard) {
    if (evaluation.scores6) {
      const scoreLines = EVALUATION_6_SCORES_META.map(
        (m) => `• ${m.label}: ${evaluation.scores6?.[m.key] ?? '-'} / 5`
      ).join('\n');
      drawTextBoxSection(
        `RINCIAN 6 SKOR EVALUASI (TOTAL: ${evaluation.scores6.totalSkor}/30 • ${evaluation.scores6.kategori})`,
        scoreLines
      );
    }

    if (evaluation.baseline) {
      const baseCond = evaluation.baseline.skorKondisiAwal ?? computeBaselineKondisiAwal(evaluation.baseline);
      drawTextBoxSection(
        'BASELINE RETROSPEKTIF (baselineDariIngatan: true)',
        `Keparahan Awal: ${evaluation.baseline.keparahan}/5  •  Frekuensi Awal: ${evaluation.baseline.frekuensi}/5  •  Motivasi Awal: ${evaluation.baseline.motivasiAwal}/5\nSkor Kondisi Awal Terskala: ${baseCond.toFixed(2)} / 5`
      );
    }

    if (evaluation.aiAnalysis) {
      drawTextBoxSection(
        'ANALISIS AI OTAK KONSELOR',
        `${evaluation.aiAnalysis.interpretasiKontekstual}\nKekuatan Spesifik: ${evaluation.aiAnalysis.kekuatanSpesifik}\nArea Perbaikan: ${evaluation.aiAnalysis.areaPerbaikanSpesifik}\nRekomendasi Tindak Lanjut: ${evaluation.aiAnalysis.rekomendasiTindakLanjut?.ringkasan || '-'}`
      );
    }

    if (evaluation.followUpCheck) {
      drawTextBoxSection(
        `HASIL CEK FOLLOW-UP (${formatIndoDateLong(evaluation.followUpCheck.checkedAt)})`,
        `Skor Perubahan Sekarang: ${evaluation.followUpCheck.skorPerubahanSekarang}/5  •  Masalah Berulang: ${
          evaluation.followUpCheck.masalahBerulang ? 'Ya' : 'Tidak'
        }  •  Delta: ${evaluation.followUpCheck.delta >= 0 ? '+' : ''}${evaluation.followUpCheck.delta.toFixed(2)}${
          evaluation.followUpCheck.catatan ? `\nCatatan: ${evaluation.followUpCheck.catatan}` : ''
        }`
      );
    }
  } else {
    if (evaluation.aiCompletenessNotice) {
      drawTextBoxSection('PERINGATAN KELENGKAPAN DATA PROGRAM BK', evaluation.aiCompletenessNotice);
    }

    // Urutan Resmi 9 Bagian Laporan Evaluasi Program BK
    const bListText =
      Array.isArray(evaluation.bidangList) && evaluation.bidangList.length > 0
        ? evaluation.bidangList
            .map(
              (b) =>
                `• ${b.bidang}: Target ${b.target ?? '-'} | Realisasi ${b.realisasi} Siswa (${b.evaluatedCount ?? b.totalServices} Evaluasi, Skor ${b.rata6Skor ?? b.nilai}/5)`
            )
            .join('\n')
        : '-';
    drawTextBoxSection('1. TARGET vs REALISASI (4 BIDANG PROGRAM BK)', bListText);

    const pm = evaluation.programMetrics;
    drawTextBoxSection(
      '2. LAYANAN TERLAKSANA vs BATAL',
      `Total Layanan: ${pm?.totalServicesInPeriod ?? 0}  •  Terlaksana: ${pm?.servicesTerlaksana ?? 0}  •  Dibatalkan: ${pm?.servicesDibatalkan ?? 0}  •  Terjadwal: ${pm?.servicesTerjadwal ?? 0}\nSudah Dievaluasi: ${pm?.evaluatedServicesCount ?? 0}  •  Belum Dievaluasi: ${pm?.unevaluatedServicesCount ?? 0}`
    );

    const masalahText =
      pm?.byJenisMasalah && pm.byJenisMasalah.length > 0
        ? pm.byJenisMasalah
            .map(
              (m) =>
                `• ${m.jenisMasalah} (${m.totalEvaluasi}x): Rata ${m.rataRataSkor}/5 | Teknik Dominan: ${m.teknikDominan} | Selesai ${m.persenSelesai}%`
            )
            .join('\n')
        : 'Belum ada kelompok masalah terisi.';
    const teknikText =
      pm?.byTeknik && pm.byTeknik.length > 0
        ? pm.byTeknik
            .map((t) => `• ${t.teknik} (${t.totalEvaluasi} sesi): Rata ${t.rataRataSkor}/5`)
            .join('\n')
        : 'Belum ada data teknik.';
    drawTextBoxSection(
      `3. RATA-RATA SKOR PER JENIS MASALAH & TEKNIK (GLOBAL: ${Number(evaluation.nilai || 0).toFixed(2)}/5)`,
      `Per Jenis Masalah:\n${masalahText}\n\nPer Teknik Konseling:\n${teknikText}`
    );

    const deltaStrSingle =
      pm?.rataRataDeltaFollowUp !== null && pm?.rataRataDeltaFollowUp !== undefined
        ? `${pm.rataRataDeltaFollowUp >= 0 ? '+' : ''}${pm.rataRataDeltaFollowUp.toFixed(2)}`
        : 'Belum ada data cek follow-up';
    drawTextBoxSection(
      '4. DELTA BASELINE -> FOLLOW-UP 14 HARI',
      `Rata-rata Delta: ${deltaStrSingle}  •  Sudah Dicek: ${pm?.followUpCheckedCount ?? 0}  •  Menunggu Cek: ${pm?.pendingFollowUpCount ?? 0}  •  Ketuntasan RTL: ${pm?.persenTindakLanjutSelesai ?? 0}%`
    );

    const cs = pm?.caseSummary;
    const caseSummaryText = cs
      ? `Total Kasus: ${cs.totalKasus}  •  Tuntas: ${cs.tuntas}  •  Masih Berproses: ${cs.masihBerproses}  •  Dirujuk ke Psikolog/Pihak Luar: ${cs.dirujuk}  •  Tidak Tertangani: ${cs.tidakTertangani}${
          evaluation.aiInterpretasiKasus ? `\n${evaluation.aiInterpretasiKasus}` : ''
        }`
      : 'Belum ada ringkasan status kasus.';
    drawTextBoxSection('5. KASUS TUNTAS / BERPROSES / RUJUKAN / TIDAK TERTANGANI', caseSummaryText);

    const needText = evaluation.kebutuhanAwal?.kebutuhanUtama?.length
      ? `Kebutuhan Utama Awal (${evaluation.kebutuhanAwal.caraMenentukan}): ${evaluation.kebutuhanAwal.kebutuhanUtama.join(' & ')}\n${evaluation.aiPerbandinganKebutuhan || ''}`
      : evaluation.aiPerbandinganKebutuhan || 'Kebutuhan awal semester belum diisi.';
    drawTextBoxSection('6. KEBUTUHAN AWAL vs REALISASI', needText);

    const sh = evaluation.suaraStakeholder;
    const hasSh = hasRealStakeholderVoices(sh);
    const shText = hasSh
      ? [
          !isUncollectedPlaceholderText(sh?.suaraSiswa) ? `Suara Siswa: "${sh?.suaraSiswa}"` : '',
          !isUncollectedPlaceholderText(sh?.suaraWaliKelas)
            ? `Suara Wali Kelas: "${sh?.suaraWaliKelas}"`
            : '',
          !isUncollectedPlaceholderText(sh?.suaraKepsekOrtu)
            ? `Suara Kepsek/Ortu: "${sh?.suaraKepsekOrtu}"`
            : '',
          evaluation.aiEvaluasiStakeholder || '',
        ]
          .filter(Boolean)
          .join('\n')
      : evaluation.aiEvaluasiStakeholder ||
        'Suara stakeholder belum terkumpul, evaluasi ini masih dari sudut pandang Guru BK saja.';
    drawTextBoxSection('7. SUARA STAKEHOLDER', shText);

    const refl = evaluation.refleksiKonselor;
    drawTextBoxSection(
      '8. REFLEKSI KONSELOR',
      `Teknik Paling Berhasil: ${refl?.teknikBerhasil || '-'}\nTeknik Gagal/Perlu Diubah: ${refl?.teknikGagalDiubah || '-'}\nKendala Terbesar: ${
        refl?.kendalaTerbesar
          ? `${refl.kendalaTerbesar}${refl.kendalaPenjelas ? ` — ${refl.kendalaPenjelas}` : ''}`
          : '-'
      }${evaluation.aiEvaluasiRefleksi ? `\nCatatan Sistemik: ${evaluation.aiEvaluasiRefleksi}` : ''}`
    );

    const rp = evaluation.rencanaPerbaikan;
    drawTextBoxSection(
      '9. RENCANA PERBAIKAN SEMESTER DEPAN',
      `1. LANJUTKAN: ${rp?.lanjutkan || '-'}\n2. HENTIKAN: ${rp?.hentikan || '-'}\n3. UBAH: ${rp?.ubah || '-'}\n4. BUTUH DUKUNGAN: ${rp?.butuhDukungan || '-'}`
    );

    if (Array.isArray(evaluation.aiProgramPerMasalah) && evaluation.aiProgramPerMasalah.length > 0) {
      const pmText = evaluation.aiProgramPerMasalah
        .map(
          (item) =>
            `• ${item.jenisMasalah}: ${item.ringkasanEvaluasi} Rekomendasi: ${item.rekomendasiStrategis}`
        )
        .join('\n');
      drawTextBoxSection('ANALISIS DETAIL PER JENIS MASALAH', pmText);
    }
  }

  drawTextBoxSection('HASIL SINGKAT & KONDISI', evaluation.hasil || '-');
  drawTextBoxSection('KENDALA PELAKSANAAN', evaluation.kendala || 'Tidak ada kendala signifikan.');
  drawTextBoxSection(
    `TINDAK LANJUT (STATUS: ${evaluation.statusTindakLanjut})`,
    `${evaluation.tindakLanjut || '-'}${
      evaluation.penanggungJawabTindakLanjut ? `\nPenanggung Jawab: ${evaluation.penanggungJawabTindakLanjut}` : ''
    }${
      evaluation.tanggalTindakLanjut ? `\nJadwal Rencana Tindak Lanjut: ${formatIndoDateLong(evaluation.tanggalTindakLanjut)}` : ''
    }`
  );

  const images = getNormalizedEvidenceList(evaluation.buktiFoto).filter((f) => f.dataUrl.startsWith('data:image/'));
  if (images.length > 0) {
    ensureSpace(34);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
    doc.text('LAMPIRAN BUKTI KEGIATAN', marginX, y + 2);
    y += 4;
    let ix = marginX;
    images.slice(0, 3).forEach((img) => {
      try {
        const fmt = img.dataUrl.toLowerCase().includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(img.dataUrl, fmt, ix, y, 42, 28);
        doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
        doc.rect(ix, y, 42, 28, 'D');
        ix += 46;
      } catch {
        // skip
      }
    });
    y += 32;
  }

  ensureSpace(40);
  drawSignatureBlock(doc, y + 4, activeCounselor);
  applyPageFooters(doc, config.schoolName || 'SMP N 2 Susukan', 'Kartu Evaluasi Program BK');

  const safeSlug = (evaluation.namaProgram || 'Evaluasi').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 30);
  finalizeAndSavePdf(doc, `Evaluasi_Program_${safeSlug}_${evaluation.tanggal || 'BK'}.pdf`, {
    category: 'rekap',
    successToastMessage: 'Kartu Evaluasi Program BK berhasil dicetak PDF!',
  });
}

/**
 * Generates clean 1-page / A4 Summary PDF for Kepala Sekolah ("Export PDF untuk Kepala Sekolah"):
 * Title, Tahun Ajaran, Target vs Realisasi 4 Bidang table, and 1-paragraph AI Conclusion.
 */
export function downloadKepsekReportPDF(params: {
  tahunAjaran: string;
  semester?: 'Ganjil' | 'Genap' | 'Semua';
  rencanaTahunan: RencanaTahunanData;
  services: CounselingService[];
  serviceEvaluations: ProgramEvaluation[];
  programEvaluations?: ProgramEvaluation[];
  activeCounselor?: Counselor;
}) {
  const {
    tahunAjaran,
    semester = 'Semua',
    rencanaTahunan,
    services,
    serviceEvaluations,
    programEvaluations = [],
    activeCounselor,
  } = params;
  const config = getSchoolConfig();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const marginX = 15;
  const contentWidth = pageWidth - marginX * 2; // 180mm

  drawLetterhead(doc, NAVY_DARK);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  doc.text('LAPORAN PROGRAM BIMBINGAN DAN KONSELING', pageWidth / 2, 43, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(SLATE_TEXT[0], SLATE_TEXT[1], SLATE_TEXT[2]);
  const periodLine =
    semester && semester !== 'Semua'
      ? `Tahun Ajaran ${tahunAjaran} • Semester ${semester} • Fokus Utama: ${rencanaTahunan.fokusUtama}`
      : `Tahun Ajaran ${tahunAjaran} • Fokus Utama: ${rencanaTahunan.fokusUtama}`;
  doc.text(periodLine, pageWidth / 2, 49, { align: 'center' });

  let y = 57;

  // Parameter Beban Kerja Ringkas
  doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
  doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
  doc.roundedRect(marginX, y, contentWidth, 16, 2, 2, 'FD');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  doc.text(
    `Kapasitas Layanan: ${rencanaTahunan.jamPerMinggu} Jam/Minggu x ${rencanaTahunan.jumlahKelas} Kelas (${rencanaTahunan.mingguEfektif} Minggu Efektif)`,
    marginX + 4,
    y + 6
  );
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(SLATE_TEXT[0], SLATE_TEXT[1], SLATE_TEXT[2]);
  doc.text(
    `Total Target Tahunan: ${rencanaTahunan.totalTarget} Layanan (${
      rencanaTahunan.totalTarget > 400 ? 'Peringatan Beban Tinggi >400' : 'Realistis untuk 1 Guru BK'
    })  •  Tanggal Cetak: ${formatTanggalIndonesia(new Date().toISOString().slice(0, 10))}`,
    marginX + 4,
    y + 12
  );
  y += 23;

  // Compute Realisasi per Bidang for Tahun Ajaran (+ optional semester)
  const cleanSrvs = (services || []).filter((s) => {
    const ta = getTahunAjaranFromDate(s.date);
    if (ta !== tahunAjaran) return false;
    if (semester === 'Ganjil' || semester === 'Genap') {
      return getSemesterFromDate(s.date) === semester;
    }
    return true;
  });

  const realCountMap: Record<string, number> = {
    'Layanan Dasar': 0,
    'Layanan Responsif': 0,
    'Perencanaan Individual': 0,
    'Dukungan Sistem': 0,
  };
  cleanSrvs.forEach((s) => {
    const b = mapServiceToEvaluationBidang(s);
    realCountMap[b] = (realCountMap[b] || 0) + 1;
  });

  const divisor = semester === 'Ganjil' || semester === 'Genap' ? 2 : 1;
  const rowsData = [
    {
      bidang: 'Layanan Dasar',
      target: Math.max(1, Math.round(rencanaTahunan.targetLayananDasar / divisor)),
      realisasi: realCountMap['Layanan Dasar'] || 0,
    },
    {
      bidang: 'Layanan Responsif',
      target: Math.max(1, Math.round(rencanaTahunan.targetLayananResponsif / divisor)),
      realisasi: realCountMap['Layanan Responsif'] || 0,
    },
    {
      bidang: 'Perencanaan Individual',
      target: Math.max(1, Math.round(rencanaTahunan.targetPerencanaanIndividual / divisor)),
      realisasi: realCountMap['Perencanaan Individual'] || 0,
    },
    {
      bidang: 'Dukungan Sistem',
      target: Math.max(1, Math.round(rencanaTahunan.targetDukunganSistem / divisor)),
      realisasi: realCountMap['Dukungan Sistem'] || 0,
    },
  ];

  // Table Header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  doc.text('TABEL TARGET VS REALISASI 4 BIDANG PROGRAM BK', marginX, y);
  y += 3.5;

  const colW = [64, 28, 28, 24, 36]; // total = 180
  const headers = ['Bidang Program BK', 'Target', 'Realisasi', 'Capaian', 'Status'];
  doc.setFillColor(TEAL_PRIMARY[0], TEAL_PRIMARY[1], TEAL_PRIMARY[2]);
  doc.rect(marginX, y, contentWidth, 8.5, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  let cx = marginX;
  headers.forEach((h, i) => {
    doc.text(h, cx + 3, y + 5.7);
    cx += colW[i];
  });
  y += 8.5;

  let sumTarget = 0;
  let sumReal = 0;
  rowsData.forEach((r, idx) => {
    sumTarget += r.target;
    sumReal += r.realisasi;
    const pct = r.target > 0 ? Math.round((r.realisasi / r.target) * 100) : 0;
    const statusTxt = pct >= 100 ? 'Tercapai' : pct >= 70 ? 'Sesuai Jalur' : 'Belum Tercapai';
    if (idx % 2 === 0) {
      doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
      doc.rect(marginX, y, contentWidth, 8.2, 'F');
    }
    doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
    let rx = marginX;
    const vals = [r.bidang, `${r.target} sesi`, `${r.realisasi} sesi`, `${pct}%`, statusTxt];
    doc.setFont('Helvetica', idx === 0 ? 'bold' : 'normal');
    doc.setFontSize(8.4);
    vals.forEach((v, ci) => {
      doc.rect(rx, y, colW[ci], 8.2, 'D');
      if (ci === 4) {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(pct >= 100 ? 5 : pct >= 70 ? 0 : 180, pct >= 100 ? 120 : pct >= 70 ? 104 : 83, pct >= 100 ? 80 : pct >= 70 ? 95 : 9);
      } else {
        doc.setFont('Helvetica', ci === 0 ? 'bold' : 'normal');
        doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
      }
      doc.text(v, rx + 3, y + 5.4);
      rx += colW[ci];
    });
    y += 8.2;
  });

  // Total Row
  const totalPct = sumTarget > 0 ? Math.round((sumReal / sumTarget) * 100) : 0;
  doc.setFillColor(230, 244, 241);
  doc.rect(marginX, y, contentWidth, 8.5, 'FD');
  const totVals = [
    'TOTAL KESELURUHAN',
    `${sumTarget} sesi`,
    `${sumReal} sesi`,
    `${totalPct}%`,
    totalPct >= 100 ? 'Tercapai' : 'Berjalan',
  ];
  let tx = marginX;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(TEAL_PRIMARY[0], TEAL_PRIMARY[1], TEAL_PRIMARY[2]);
  totVals.forEach((v, ci) => {
    doc.rect(tx, y, colW[ci], 8.5, 'D');
    doc.text(v, tx + 3, y + 5.7);
    tx += colW[ci];
  });
  y += 16;

  // 1-Paragraph AI Conclusion
  const evalsInYear = (serviceEvaluations || []).filter(
    (e) =>
      e.evaluationScope !== 'program' &&
      e.evaluationScope !== 'kebutuhan-awal' &&
      e.evaluationScope !== 'rencana-tahunan' &&
      (e.tahunAjaran || getTahunAjaranFromDate(e.tanggal)) === tahunAjaran
  );
  const scored = evalsInYear.map((e) => getEffectiveServiceEvalScore(e)).filter((v) => v > 0);
  const avgSkor = scored.length > 0 ? (scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(2) : '0.00';

  const latestProg = (programEvaluations || []).find(
    (e) => e.evaluationScope === 'program' && e.tahunAjaran === tahunAjaran
  );
  const aiConclusion =
    latestProg?.aiPerbandinganKebutuhan ||
    latestProg?.hasil ||
    `Sepanjang Tahun Ajaran ${tahunAjaran} dengan fokus utama "${rencanaTahunan.fokusUtama}", program Bimbingan dan Konseling telah merealisasikan ${sumReal} dari ${sumTarget} target layanan (${totalPct}%) dengan capaian rata-rata mutu layanan ${avgSkor}/5 dari ${evalsInYear.length} evaluasi layanan terisi. ${rencanaTahunan.aiNote}`;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  doc.text('KESIMPULAN EKSEKUTIF AI UNTUK KEPALA SEKOLAH', marginX, y);
  y += 4;

  const conclLines = doc.splitTextToSize(aiConclusion, contentWidth - 8);
  const boxH = Math.max(20, conclLines.length * 4.5 + 8);
  doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
  doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
  doc.roundedRect(marginX, y, contentWidth, boxH, 2, 2, 'FD');
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(NAVY_DARK[0], NAVY_DARK[1], NAVY_DARK[2]);
  doc.text(conclLines, marginX + 4, y + 6.2);
  y += boxH + 10;

  drawSignatureBlock(doc, y, activeCounselor);
  applyPageFooters(doc, config.schoolName || 'SMP N 2 Susukan', `Laporan Kepala Sekolah - ${tahunAjaran}`);

  const safeTa = tahunAjaran.replace(/[^0-9]/g, '');
  finalizeAndSavePdf(doc, `Laporan_Kepsek_BK_${safeTa}.pdf`, {
    category: 'rekap',
    successToastMessage: 'Laporan PDF untuk Kepala Sekolah berhasil diunduh!',
  });
}
