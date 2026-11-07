import { jsPDF } from 'jspdf';
import { 
  Student, 
  ViolationRecord, 
  CounselingService, 
  Counselor, 
  StudentAchievement, 
  BidangBimbinganType, 
  BKComponentType 
} from '../types';
import { getSchoolConfig, getActiveSchoolId, loadSchoolData } from './schoolConfig';
import { finalizeAndSavePdf, drawSchoolLogo, drawKabSemarangLogo, getActiveCounselorSigner } from './pdfGenerator';
import { getBKComponentForService, getPilarBadge, BIDANG_BIMBINGAN_OPTIONS, BK_COMPONENTS_DATA } from './bkKomprehensif';

export type StudioPdfTemplateType = 
  | 'jurnal-agenda'
  | 'rekap-bidang-pilar'
  | 'register-kasus'
  | 'rekap-homevisit-panggilan'
  | 'rekap-prestasi'
  | 'laporan-periodik'
  | 'matriks-kustom';

export interface StudioPdfConfig {
  templateId: StudioPdfTemplateType;
  paperSize: 'A4' | 'F4';
  orientation: 'portrait' | 'landscape';
  margin: 'compact' | 'standard' | 'spacious';
  
  // Filtering
  startDate: string;
  endDate: string;
  dateRangeLabel?: string;
  selectedClass: string;
  selectedCounselorId: string;
  selectedBidang: string;
  selectedPilar: string;
  selectedStatus: string;
  
  // Display Options
  showLetterhead: boolean;
  showDoubleLine: boolean;
  showDocumentNumber: boolean;
  customDocNumber: string;
  customDocTitle: string;
  customDocSubtitle: string;
  showExecutiveSummary: boolean;
  showAnalysisEvaluation: boolean;
  customEvaluationNotes: string;
  showStudentNisn: boolean;
  showProblemDescription: boolean;
  showFollowUpRtl: boolean;
  showSignatures: boolean;
  
  // Signatures
  titimangsaCity: string;
  titimangsaDate: string;
  headmasterName: string;
  headmasterNip: string;
  headmasterTitle: string;
  counselorName: string;
  counselorNip: string;
  counselorTitle: string;
  
  // Styling
  primaryColorHex: string;
}

export interface StudioPdfDataSources {
  students: Student[];
  services: CounselingService[];
  violations: ViolationRecord[];
  achievements?: StudentAchievement[];
  homeVisits?: any[];
  summons?: any[];
  allCounselors?: Counselor[];
  activeCounselor: Counselor;
}

// Convert Hex to RGB tuple
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 104;
  const b = parseInt(clean.substring(4, 6), 16) || 95;
  return [r, g, b];
}

// Format Indonesian Date
export function formatIndoDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

/**
 * Main Builder for Studio PDF Maker
 */
export function generateStudioPdf(
  config: StudioPdfConfig,
  data: StudioPdfDataSources,
  options?: { download?: boolean; returnDoc?: boolean }
): jsPDF {
  const isLandscape = config.orientation === 'landscape';
  
  // Paper dimensions in mm
  // A4: 210 x 297 | F4 (Folio): 215 x 330
  let pageWidth = 210;
  let pageHeight = 297;
  
  if (config.paperSize === 'F4') {
    pageWidth = 215;
    pageHeight = 330;
  }
  
  if (isLandscape) {
    const temp = pageWidth;
    pageWidth = pageHeight;
    pageHeight = temp;
  }
  
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: config.paperSize === 'F4' ? (isLandscape ? [330, 215] : [215, 330]) : 'a4'
  });
  
  // Margins
  let marginX = 15;
  if (config.margin === 'compact') marginX = 10;
  if (config.margin === 'spacious') marginX = 20;
  
  const contentWidth = pageWidth - (marginX * 2);
  const schoolConfig = getSchoolConfig(data.activeCounselor?.schoolId);
  const primaryRgb = hexToRgb(config.primaryColorHex || '#00685f');
  const darkNavyRgb = [11, 28, 48];
  const charcoalRgb = [61, 73, 71];
  
  let currentY = 12;
  
  // Helper for page break check
  const checkPageBreak = (neededHeight: number): boolean => {
    const bottomLimit = pageHeight - 15;
    if (currentY + neededHeight > bottomLimit) {
      doc.addPage();
      currentY = 14;
      return true;
    }
    return false;
  };
  
  // 1. Draw Kop Surat / Letterhead if enabled
  if (config.showLetterhead) {
    // Top border line
    doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.setLineWidth(1.0);
    doc.line(marginX, currentY, marginX + contentWidth, currentY);
    currentY += 4;
    
    const logoY = currentY + 8;
    const logoRadius = 8;
    const leftLogoX = marginX + 10;
    const rightLogoX = marginX + contentWidth - 10;
    const centerX = marginX + (contentWidth / 2);
    
    // Draw left kabupaten logo
    try {
      const customKab = schoolConfig.customKabupatenLogo || (typeof localStorage !== 'undefined' ? localStorage.getItem('bk_custom_kabupaten_logo') : null);
      if (customKab) {
        const format = customKab.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(customKab, format, leftLogoX - logoRadius, logoY - logoRadius, logoRadius * 2, logoRadius * 2);
      } else {
        drawKabSemarangLogo(doc, leftLogoX, logoY, logoRadius);
      }
    } catch {
      drawKabSemarangLogo(doc, leftLogoX, logoY, logoRadius);
    }
    
    // Draw right school logo
    try {
      const customSchool = schoolConfig.customSchoolLogo || (typeof localStorage !== 'undefined' ? localStorage.getItem('bk_custom_school_logo') : null);
      if (customSchool) {
        const format = customSchool.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(customSchool, format, rightLogoX - logoRadius, logoY - logoRadius, logoRadius * 2, logoRadius * 2);
      } else {
        drawSchoolLogo(doc, rightLogoX, logoY, logoRadius);
      }
    } catch {
      drawSchoolLogo(doc, rightLogoX, logoY, logoRadius);
    }
    
    // School Head Text
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(darkNavyRgb[0], darkNavyRgb[1], darkNavyRgb[2]);
    doc.text(schoolConfig.governmentName.toUpperCase(), centerX, currentY + 3, { align: 'center' });
    doc.text(schoolConfig.departmentName.toUpperCase(), centerX, currentY + 7, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text(schoolConfig.schoolName.toUpperCase(), centerX, currentY + 12, { align: 'center' });
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(charcoalRgb[0], charcoalRgb[1], charcoalRgb[2]);
    doc.text(schoolConfig.schoolAddress, centerX, currentY + 16, { align: 'center' });
    
    currentY += 19;
    
    // Double lines
    doc.setDrawColor(darkNavyRgb[0], darkNavyRgb[1], darkNavyRgb[2]);
    doc.setLineWidth(0.6);
    doc.line(marginX, currentY, marginX + contentWidth, currentY);
    if (config.showDoubleLine) {
      doc.setLineWidth(0.2);
      doc.line(marginX, currentY + 0.9, marginX + contentWidth, currentY + 0.9);
      currentY += 1.8;
    }
    currentY += 4;
  } else {
    currentY += 4;
  }
  
  // 2. Document Title & Administrative Meta
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(darkNavyRgb[0], darkNavyRgb[1], darkNavyRgb[2]);
  
  const titleText = config.customDocTitle || 'REKAPITULASI LAPORAN BIMBINGAN DAN KONSELING';
  doc.text(titleText.toUpperCase(), marginX + (contentWidth / 2), currentY, { align: 'center' });
  currentY += 4.5;
  
  if (config.customDocSubtitle) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text(config.customDocSubtitle, marginX + (contentWidth / 2), currentY, { align: 'center' });
    currentY += 4.5;
  }
  
  // Document Number & Scope Info Box
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(charcoalRgb[0], charcoalRgb[1], charcoalRgb[2]);
  
  const metaLines: string[] = [];
  if (config.showDocumentNumber && config.customDocNumber) {
    metaLines.push(`Nomor Dokumen: ${config.customDocNumber}`);
  }
  
  const filterSummary = [
    config.dateRangeLabel ? `Periode: ${config.dateRangeLabel}` : `Periode: ${formatIndoDate(config.startDate)} s.d. ${formatIndoDate(config.endDate)}`,
    config.selectedClass === 'semua' ? 'Kelas: Seluruh Siswa Binaan' : `Kelas: ${config.selectedClass}`,
    config.selectedBidang !== 'semua' ? `Bidang: ${config.selectedBidang}` : null,
    config.selectedPilar !== 'semua' ? `Pilar: ${config.selectedPilar}` : null
  ].filter(Boolean).join('  |  ');
  
  metaLines.push(filterSummary);
  
  metaLines.forEach(line => {
    doc.text(line, marginX + (contentWidth / 2), currentY, { align: 'center' });
    currentY += 3.8;
  });
  
  currentY += 2;
  
  // 3. Filter Dataset based on configuration
  const filteredServices = data.services.filter(s => {
    if (config.startDate && s.date < config.startDate) return false;
    if (config.endDate && s.date > config.endDate) return false;
    if (config.selectedStatus !== 'semua' && s.status !== config.selectedStatus) return false;
    if (config.selectedBidang !== 'semua') {
      const sBidang = s.bidangBimbingan || s.specificDetails?.bidangBimbingan || 'Pribadi';
      if (sBidang !== config.selectedBidang) return false;
    }
    if (config.selectedPilar !== 'semua') {
      const pilar = s.bkComponent || getBKComponentForService(s.serviceType);
      if (pilar !== config.selectedPilar) return false;
    }
    if (config.selectedClass !== 'semua') {
      const hasClass = s.students.some(st => (st.class || '').trim().toUpperCase() === config.selectedClass.trim().toUpperCase());
      if (!hasClass) return false;
    }
    if (config.selectedCounselorId !== 'semua' && s.counselorId && s.counselorId !== config.selectedCounselorId) {
      return false;
    }
    return true;
  });
  
  const filteredViolations = data.violations.filter(v => {
    if (config.startDate && v.date < config.startDate) return false;
    if (config.endDate && v.date > config.endDate) return false;
    if (config.selectedClass !== 'semua' && (v.studentClass || '').trim().toUpperCase() !== config.selectedClass.trim().toUpperCase()) {
      return false;
    }
    if (config.selectedStatus !== 'semua') {
      if (config.selectedStatus === 'Selesai' && v.handledBy === 'Belum Ditangani') return false;
      if (config.selectedStatus === 'Terjadwal' && v.handledBy !== 'Belum Ditangani') return false;
    }
    return true;
  });
  
  const filteredAchievements = (data.achievements || []).filter(a => {
    if (config.startDate && a.date < config.startDate) return false;
    if (config.endDate && a.date > config.endDate) return false;
    if (config.selectedClass !== 'semua' && (a.studentClass || '').trim().toUpperCase() !== config.selectedClass.trim().toUpperCase()) {
      return false;
    }
    return true;
  });
  
  const filteredHomeVisits = (data.homeVisits || []).filter(h => {
    if (config.startDate && h.date < config.startDate) return false;
    if (config.endDate && h.date > config.endDate) return false;
    if (config.selectedClass !== 'semua' && (h.studentClass || '').trim().toUpperCase() !== config.selectedClass.trim().toUpperCase()) {
      return false;
    }
    if (config.selectedBidang !== 'semua' && h.bidangBimbingan && h.bidangBimbingan !== config.selectedBidang) {
      return false;
    }
    return true;
  });
  
  const filteredSummons = (data.summons || []).filter(sm => {
    if (config.startDate && sm.date < config.startDate) return false;
    if (config.endDate && sm.date > config.endDate) return false;
    if (config.selectedClass !== 'semua' && (sm.studentClass || '').trim().toUpperCase() !== config.selectedClass.trim().toUpperCase()) {
      return false;
    }
    return true;
  });

  // 4. Executive Summary Box (if enabled)
  if (config.showExecutiveSummary) {
    checkPageBreak(28);
    doc.setFillColor(243, 246, 245);
    doc.roundedRect(marginX, currentY, contentWidth, 20, 2, 2, 'F');
    doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, currentY, contentWidth, 20, 2, 2, 'D');
    
    // Header tag inside box
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('IKHTISAR EKSEKUTIF PELAKSANAAN BK & DATA SISWA', marginX + 4, currentY + 5);
    
    // 4 Columns Metrics
    const colW = contentWidth / 4;
    const metrics = [
      { label: 'Total Sesi Layanan', val: `${filteredServices.length} Sesi` },
      { label: 'Kasus / Pelanggaran', val: `${filteredViolations.length} Kasus` },
      { label: 'Kunjungan & Panggilan', val: `${filteredHomeVisits.length + filteredSummons.length} Agenda` },
      { label: 'Prestasi Apresiasi', val: `${filteredAchievements.length} Catatan` }
    ];
    
    metrics.forEach((m, idx) => {
      const startColX = marginX + (idx * colW);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(charcoalRgb[0], charcoalRgb[1], charcoalRgb[2]);
      doc.text(m.label, startColX + 4, currentY + 11);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(darkNavyRgb[0], darkNavyRgb[1], darkNavyRgb[2]);
      doc.text(m.val, startColX + 4, currentY + 16.5);
      
      if (idx < 3) {
        doc.setDrawColor(200, 210, 208);
        doc.setLineWidth(0.15);
        doc.line(startColX + colW, currentY + 7, startColX + colW, currentY + 18);
      }
    });
    
    currentY += 24;
  }
  
  // 5. Render Specific Table based on templateId
  switch (config.templateId) {
    case 'jurnal-agenda':
      renderJurnalAgendaTable(doc, filteredServices, marginX, contentWidth, currentY, (newY) => { currentY = newY; }, checkPageBreak, primaryRgb, config);
      break;
    case 'rekap-bidang-pilar':
      renderBidangPilarTable(doc, filteredServices, marginX, contentWidth, currentY, (newY) => { currentY = newY; }, checkPageBreak, primaryRgb, config);
      break;
    case 'register-kasus':
      renderRegisterKasusTable(doc, filteredViolations, marginX, contentWidth, currentY, (newY) => { currentY = newY; }, checkPageBreak, primaryRgb, config);
      break;
    case 'rekap-homevisit-panggilan':
      renderHomeVisitPanggilanTable(doc, filteredHomeVisits, filteredSummons, marginX, contentWidth, currentY, (newY) => { currentY = newY; }, checkPageBreak, primaryRgb, config);
      break;
    case 'rekap-prestasi':
      renderPrestasiTable(doc, filteredAchievements, marginX, contentWidth, currentY, (newY) => { currentY = newY; }, checkPageBreak, primaryRgb, config);
      break;
    case 'laporan-periodik':
      renderLaporanPeriodikComprehensive(doc, filteredServices, filteredViolations, filteredHomeVisits, filteredSummons, filteredAchievements, marginX, contentWidth, currentY, (newY) => { currentY = newY; }, checkPageBreak, primaryRgb, config);
      break;
    case 'matriks-kustom':
    default:
      renderCustomMatrixTable(doc, data.students, filteredServices, filteredViolations, marginX, contentWidth, currentY, (newY) => { currentY = newY; }, checkPageBreak, primaryRgb, config);
      break;
  }

  // 6. Analysis and Evaluation Section (if enabled)
  if (config.showAnalysisEvaluation) {
    checkPageBreak(35);
    currentY += 4;
    doc.setFillColor(248, 250, 249);
    doc.rect(marginX, currentY, contentWidth, 7, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('EVALUASI, ANALISIS KEBUTUHAN & RENCANA TINDAK LANJUT (RTL)', marginX + 3, currentY + 4.8);
    currentY += 9;
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(darkNavyRgb[0], darkNavyRgb[1], darkNavyRgb[2]);
    
    const evalText = config.customEvaluationNotes || 
      `1. Layanan bimbingan dan konseling pada periode ini terlaksana secara tertib dan akuntabel sesuai dengan 4 Bidang Bimbingan dan 4 Komponen Program BK Komprehensif.\n` +
      `2. Pembinaan terhadap siswa berbobot pelanggaran tinggi telah dikoordinasikan secara berkala dengan Wali Kelas, Guru Mata Pelajaran, dan Orang Tua/Wali Murid.\n` +
      `3. Rencana Tindak Lanjut difokuskan pada penguatan peminatan studi lanjut, pemeliharaan iklim kelas ramah anak, dan peningkatan asesmen diagnostik non-kognitif.`;
      
    const splitNotes = doc.splitTextToSize(evalText, contentWidth - 6);
    splitNotes.forEach((line: string) => {
      checkPageBreak(5);
      doc.text(line, marginX + 3, currentY);
      currentY += 4.2;
    });
    currentY += 4;
  }
  
  // 7. Signatures / Lembar Pengesahan (if enabled)
  if (config.showSignatures) {
    checkPageBreak(42);
    currentY += 6;
    
    const signColW = contentWidth / 2;
    const leftCenterX = marginX + (signColW / 2);
    const rightCenterX = marginX + signColW + (signColW / 2);
    
    // Top Row: Left has "Mengetahui,"; Right has Titimangsa City & Date
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(darkNavyRgb[0], darkNavyRgb[1], darkNavyRgb[2]);
    
    const titimangsaText = `${config.titimangsaCity || 'Susukan'}, ${config.titimangsaDate || formatIndoDate(new Date().toISOString().split('T')[0])}`;
    
    // Left & Right Top Row
    doc.text('Mengetahui,', leftCenterX, currentY, { align: 'center' });
    doc.text(titimangsaText, rightCenterX, currentY, { align: 'center' });
    
    currentY += 4.5;
    
    // Role Titles Row: Left has Kepala Sekolah; Right has Guru Pembimbing BK
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    
    const cleanHeadmasterTitle = config.headmasterTitle 
      ? config.headmasterTitle.replace(/^Mengetahui,?\s*/i, '').trim() || 'Kepala Sekolah'
      : 'Kepala Sekolah';
    const counselorTitleText = config.counselorTitle || 'Guru Pembimbing BK / Koordinator';
    
    doc.text(cleanHeadmasterTitle, leftCenterX, currentY, { align: 'center' });
    doc.text(counselorTitleText, rightCenterX, currentY, { align: 'center' });
    
    // Fixed physical signature & seal stamping gap
    currentY += 24;
    
    // Names (Bold & Underlined on Exact Same Baseline)
    const hmName = config.headmasterName || schoolConfig.principalName;
    const csName = config.counselorName || data.activeCounselor?.name || 'Aulia Aji Sasongko, S.Pd.';
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(hmName, leftCenterX, currentY, { align: 'center' });
    doc.text(csName, rightCenterX, currentY, { align: 'center' });
    
    // Draw underline for both names on exact same baseline
    doc.setDrawColor(darkNavyRgb[0], darkNavyRgb[1], darkNavyRgb[2]);
    doc.setLineWidth(0.3);
    const hmWidth = doc.getTextWidth(hmName);
    const csWidth = doc.getTextWidth(csName);
    doc.line(leftCenterX - (hmWidth / 2), currentY + 0.8, leftCenterX + (hmWidth / 2), currentY + 0.8);
    doc.line(rightCenterX - (csWidth / 2), currentY + 0.8, rightCenterX + (csWidth / 2), currentY + 0.8);
    
    currentY += 4.2;
    
    // NIPs (Normal font, exact same baseline)
    const hmNip = config.headmasterNip || schoolConfig.principalNip;
    const csNip = config.counselorNip || data.activeCounselor?.nip || '19931231 202221 1 002';
    const cleanHmNip = hmNip.toUpperCase().startsWith('NIP') ? hmNip : `NIP. ${hmNip}`;
    const cleanCsNip = csNip.toUpperCase().startsWith('NIP') ? csNip : `NIP. ${csNip}`;
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(cleanHmNip, leftCenterX, currentY, { align: 'center' });
    doc.text(cleanCsNip, rightCenterX, currentY, { align: 'center' });
  }
  
  // 8. Dynamic Page Footers (Page X of Y)
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 160, 158);
    
    doc.setDrawColor(225, 230, 228);
    doc.setLineWidth(0.1);
    doc.line(marginX, pageHeight - 8, marginX + contentWidth, pageHeight - 8);
    
    const footerLeft = `SIKAP-BK Studio PDF Maker  |  ${schoolConfig.schoolName}`;
    const footerRight = `Halaman ${i} dari ${totalPages}`;
    doc.text(footerLeft, marginX, pageHeight - 5);
    doc.text(footerRight, marginX + contentWidth, pageHeight - 5, { align: 'right' });
  }
  
  // 9. Download or Return
  if (options?.download !== false) {
    const safeTitle = (config.customDocTitle || 'rekap-bk')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 40);
    const dateSlug = new Date().toISOString().split('T')[0];
    const filename = `rekap_bk_${safeTitle}_${dateSlug}.pdf`;
    finalizeAndSavePdf(doc, filename, {
      category: 'rekap',
      successToastMessage: '📄 Rekap PDF resmi standar dinas berhasil dibuat & diunduh!'
    });
  }
  
  return doc;
}

// -------------------------------------------------------------
// HELPER TABLE RENDERERS
// -------------------------------------------------------------

function renderTableHeader(
  doc: jsPDF,
  headers: { label: string; width: number; align?: 'left' | 'center' | 'right' }[],
  startX: number,
  currentY: number,
  primaryRgb: [number, number, number]
): number {
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  const totalWidth = headers.reduce((acc, h) => acc + h.width, 0);
  doc.rect(startX, currentY, totalWidth, 7, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  
  let curX = startX;
  headers.forEach(h => {
    let textX = curX + 2;
    if (h.align === 'center') textX = curX + (h.width / 2);
    else if (h.align === 'right') textX = curX + h.width - 2;
    
    doc.text(h.label, textX, currentY + 4.8, { align: h.align || 'left' });
    curX += h.width;
  });
  
  return currentY + 7;
}

// Template 1: Jurnal Agenda Kerja BK
function renderJurnalAgendaTable(
  doc: jsPDF,
  services: CounselingService[],
  startX: number,
  contentWidth: number,
  currentY: number,
  setY: (y: number) => void,
  checkPageBreak: (h: number) => boolean,
  primaryRgb: [number, number, number],
  config: StudioPdfConfig
) {
  const isLandscape = config.orientation === 'landscape';
  
  // Column definitions
  const headers = isLandscape ? [
    { label: 'No', width: 8, align: 'center' as const },
    { label: 'Tanggal & Jam', width: 25 },
    { label: 'Nama Siswa / Sasaran', width: 45 },
    { label: 'Kelas', width: 15, align: 'center' as const },
    { label: 'Bidang BK', width: 22 },
    { label: 'Komponen / Layanan', width: 45 },
    { label: 'Uraian Masalah / Topik', width: 65 },
    { label: 'Tindak Lanjut / RTL', width: 55 },
    { label: 'Status', width: 20, align: 'center' as const },
  ] : [
    { label: 'No', width: 8, align: 'center' as const },
    { label: 'Tgl / Jam', width: 22 },
    { label: 'Nama Siswa & Kelas', width: 38 },
    { label: 'Bidang & Layanan BK', width: 36 },
    { label: 'Uraian Topik Masalah', width: 44 },
    { label: 'RTL & Solusi', width: 32 },
  ];
  
  currentY = renderTableHeader(doc, headers, startX, currentY, primaryRgb);
  
  if (services.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 130);
    doc.text('Tidak ada data sesi layanan BK pada parameter filter ini.', startX + 5, currentY + 6);
    setY(currentY + 12);
    return;
  }
  
  services.forEach((srv, idx) => {
    const studentNames = srv.students.map(s => s.name).join(', ');
    const studentClass = srv.students[0]?.class || '-';
    const bidang = srv.bidangBimbingan || srv.specificDetails?.bidangBimbingan || 'Pribadi';
    const pilar = srv.bkComponent || getBKComponentForService(srv.serviceType);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    
    let rowHeight = 7;
    let splitProblem: string[] = [];
    let splitFollowUp: string[] = [];
    let splitStudents: string[] = [];
    
    if (isLandscape) {
      splitStudents = doc.splitTextToSize(studentNames, 41);
      splitProblem = doc.splitTextToSize(srv.problem || '-', 61);
      splitFollowUp = doc.splitTextToSize(srv.followUp || '-', 51);
      rowHeight = Math.max(7, (Math.max(splitStudents.length, splitProblem.length, splitFollowUp.length) * 3.6) + 2.5);
    } else {
      splitStudents = doc.splitTextToSize(`${studentNames} (${studentClass})`, 34);
      splitProblem = doc.splitTextToSize(srv.problem || '-', 40);
      splitFollowUp = doc.splitTextToSize(srv.followUp || '-', 28);
      rowHeight = Math.max(7, (Math.max(splitStudents.length, splitProblem.length, splitFollowUp.length) * 3.6) + 2.5);
    }
    
    if (checkPageBreak(rowHeight)) {
      currentY = renderTableHeader(doc, headers, startX, currentY, primaryRgb);
    }
    
    // Zebra row background
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 249);
      doc.rect(startX, currentY, contentWidth, rowHeight, 'F');
    }
    
    // Draw cells
    let curX = startX;
    doc.setTextColor(11, 28, 48);
    
    // No
    doc.text(`${idx + 1}`, curX + 4, currentY + 4, { align: 'center' });
    curX += headers[0].width;
    
    if (isLandscape) {
      // Tanggal & Jam
      doc.text(`${srv.date}\n${srv.startTime || '09:00'}`, curX + 2, currentY + 3.5);
      curX += headers[1].width;
      
      // Siswa
      doc.text(splitStudents, curX + 2, currentY + 3.5);
      curX += headers[2].width;
      
      // Kelas
      doc.text(studentClass, curX + 7.5, currentY + 3.5, { align: 'center' });
      curX += headers[3].width;
      
      // Bidang
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(`Bid. ${bidang}`, curX + 2, currentY + 3.5);
      curX += headers[4].width;
      
      // Komponen & Layanan
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(11, 28, 48);
      const splitType = doc.splitTextToSize(`${srv.serviceType}\n(${pilar})`, 41);
      doc.text(splitType, curX + 2, currentY + 3.5);
      curX += headers[5].width;
      
      // Uraian Masalah
      doc.text(splitProblem, curX + 2, currentY + 3.5);
      curX += headers[6].width;
      
      // Tindak Lanjut
      doc.text(splitFollowUp, curX + 2, currentY + 3.5);
      curX += headers[7].width;
      
      // Status
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(srv.status === 'Selesai' ? 0 : 160, srv.status === 'Selesai' ? 120 : 80, srv.status === 'Selesai' ? 80 : 0);
      doc.text(srv.status, curX + 10, currentY + 3.5, { align: 'center' });
    } else {
      // Portrait Compact Layout
      doc.text(`${srv.date}\n${srv.startTime || '09:00'}`, curX + 2, currentY + 3.5);
      curX += headers[1].width;
      
      doc.text(splitStudents, curX + 2, currentY + 3.5);
      curX += headers[2].width;
      
      const splitLayanan = doc.splitTextToSize(`[${bidang}] ${srv.serviceType}`, 32);
      doc.text(splitLayanan, curX + 2, currentY + 3.5);
      curX += headers[3].width;
      
      doc.text(splitProblem, curX + 2, currentY + 3.5);
      curX += headers[4].width;
      
      doc.text(splitFollowUp, curX + 2, currentY + 3.5);
    }
    
    // Bottom border
    doc.setDrawColor(230, 235, 233);
    doc.setLineWidth(0.1);
    doc.line(startX, currentY + rowHeight, startX + contentWidth, currentY + rowHeight);
    
    currentY += rowHeight;
  });
  
  setY(currentY + 4);
}

// Template 2: Rekapitulasi 4 Bidang & 4 Komponen Pilar BK
function renderBidangPilarTable(
  doc: jsPDF,
  services: CounselingService[],
  startX: number,
  contentWidth: number,
  currentY: number,
  setY: (y: number) => void,
  checkPageBreak: (h: number) => boolean,
  primaryRgb: [number, number, number],
  config: StudioPdfConfig
) {
  // Matriks Cross-Tabulation 4 Bidang vs 4 Pilar
  const bidangs: BidangBimbinganType[] = ['Pribadi', 'Sosial', 'Belajar', 'Karir'];
  const pilars: BKComponentType[] = [
    'Layanan Dasar',
    'Peminatan & Perencanaan Individual',
    'Layanan Responsif',
    'Layanan Dukungan Sistem'
  ];
  
  const matrix: Record<string, Record<string, number>> = {};
  bidangs.forEach(b => {
    matrix[b] = {};
    pilars.forEach(p => {
      matrix[b][p] = 0;
    });
  });
  
  services.forEach(s => {
    const b = s.bidangBimbingan || s.specificDetails?.bidangBimbingan || 'Pribadi';
    const p = s.bkComponent || getBKComponentForService(s.serviceType);
    if (matrix[b] && matrix[b][p] !== undefined) {
      matrix[b][p]++;
    }
  });
  
  // Section 1: Tabel Matriks Rekapitulasi Frekuensi
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text('I. MATRIKS DISTRIBUSI LAYANAN BK (4 BIDANG x 4 PILAR KOMPONEN)', startX, currentY);
  currentY += 4;
  
  const colW = (contentWidth - 40) / 4;
  const headers = [
    { label: 'Bidang Bimbingan', width: 40 },
    { label: 'Pilar 1: Dasar', width: colW, align: 'center' as const },
    { label: 'Pilar 2: Peminatan', width: colW, align: 'center' as const },
    { label: 'Pilar 3: Responsif', width: colW, align: 'center' as const },
    { label: 'Pilar 4: Dukungan', width: colW, align: 'center' as const },
  ];
  
  currentY = renderTableHeader(doc, headers, startX, currentY, primaryRgb);
  
  bidangs.forEach((b, idx) => {
    doc.setFillColor(idx % 2 === 1 ? 248 : 255, idx % 2 === 1 ? 250 : 255, idx % 2 === 1 ? 249 : 255);
    doc.rect(startX, currentY, contentWidth, 7, 'F');
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(11, 28, 48);
    doc.text(`Bidang ${b}`, startX + 3, currentY + 4.8);
    
    pilars.forEach((p, pIdx) => {
      const cellX = startX + 40 + (pIdx * colW);
      const val = matrix[b][p];
      doc.setFont('Helvetica', val > 0 ? 'bold' : 'normal');
      doc.setTextColor(val > 0 ? primaryRgb[0] : 140, val > 0 ? primaryRgb[1] : 150, val > 0 ? primaryRgb[2] : 150);
      doc.text(`${val} Sesi`, cellX + (colW / 2), currentY + 4.8, { align: 'center' });
    });
    
    doc.setDrawColor(220, 225, 224);
    doc.setLineWidth(0.1);
    doc.line(startX, currentY + 7, startX + contentWidth, currentY + 7);
    currentY += 7;
  });
  
  currentY += 6;
  
  // Section 2: Rincian Layanan per Pilar
  checkPageBreak(25);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text('II. DAFTAR RINCIAN KEGIATAN & SASARAN LAYANAN SISWA', startX, currentY);
  currentY += 4;
  
  renderJurnalAgendaTable(doc, services, startX, contentWidth, currentY, setY, checkPageBreak, primaryRgb, config);
}

// Template 3: Register Pelanggaran & Tata Tertib Siswa
function renderRegisterKasusTable(
  doc: jsPDF,
  violations: ViolationRecord[],
  startX: number,
  contentWidth: number,
  currentY: number,
  setY: (y: number) => void,
  checkPageBreak: (h: number) => boolean,
  primaryRgb: [number, number, number],
  config: StudioPdfConfig
) {
  const isLandscape = config.orientation === 'landscape';
  
  const headers = isLandscape ? [
    { label: 'No', width: 8, align: 'center' as const },
    { label: 'Tanggal', width: 22 },
    { label: 'Nama Siswa', width: 45 },
    { label: 'Kelas', width: 14, align: 'center' as const },
    { label: 'Pelanggaran / Masalah', width: 65 },
    { label: 'Poin', width: 14, align: 'center' as const },
    { label: 'Petugas / Pelapor', width: 40 },
    { label: 'Status Penanganan & Progres', width: 62 },
  ] : [
    { label: 'No', width: 8, align: 'center' as const },
    { label: 'Tgl', width: 18 },
    { label: 'Nama & Kelas', width: 42 },
    { label: 'Kasus Pelanggaran', width: 55 },
    { label: 'Poin', width: 12, align: 'center' as const },
    { label: 'Penanganan BK', width: 45 },
  ];
  
  currentY = renderTableHeader(doc, headers, startX, currentY, primaryRgb);
  
  if (violations.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 130);
    doc.text('Tidak ada catatan pelanggaran/kasus siswa pada rentang filter ini.', startX + 5, currentY + 6);
    setY(currentY + 12);
    return;
  }
  
  violations.forEach((v, idx) => {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    
    const splitDesc = doc.splitTextToSize(v.category || '-', isLandscape ? 60 : 50);
    const splitHandling = doc.splitTextToSize(`${v.handledBy || 'Belum Ditangani'}: ${v.handlingProgress || v.notes || '-'}`, isLandscape ? 58 : 40);
    const rowHeight = Math.max(7, Math.max(splitDesc.length, splitHandling.length) * 3.6 + 2.5);
    
    if (checkPageBreak(rowHeight)) {
      currentY = renderTableHeader(doc, headers, startX, currentY, primaryRgb);
    }
    
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 249);
      doc.rect(startX, currentY, contentWidth, rowHeight, 'F');
    }
    
    let curX = startX;
    doc.setTextColor(11, 28, 48);
    
    doc.text(`${idx + 1}`, curX + 4, currentY + 3.8, { align: 'center' });
    curX += headers[0].width;
    
    doc.text(v.date, curX + 2, currentY + 3.8);
    curX += headers[1].width;
    
    if (isLandscape) {
      doc.text(v.studentName, curX + 2, currentY + 3.8);
      curX += headers[2].width;
      
      doc.text(v.studentClass, curX + 7, currentY + 3.8, { align: 'center' });
      curX += headers[3].width;
      
      doc.text(splitDesc, curX + 2, currentY + 3.8);
      curX += headers[4].width;
      
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(200, 30, 30);
      doc.text(`+${v.pointsAdded}`, curX + 7, currentY + 3.8, { align: 'center' });
      curX += headers[5].width;
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(11, 28, 48);
      doc.text(v.reportedBy || 'Guru Piket', curX + 2, currentY + 3.8);
      curX += headers[6].width;
      
      doc.text(splitHandling, curX + 2, currentY + 3.8);
    } else {
      doc.text(`${v.studentName}\n(${v.studentClass})`, curX + 2, currentY + 3.5);
      curX += headers[2].width;
      
      doc.text(splitDesc, curX + 2, currentY + 3.8);
      curX += headers[3].width;
      
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(200, 30, 30);
      doc.text(`+${v.pointsAdded}`, curX + 6, currentY + 3.8, { align: 'center' });
      curX += headers[4].width;
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(11, 28, 48);
      doc.text(splitHandling, curX + 2, currentY + 3.8);
    }
    
    doc.setDrawColor(230, 235, 233);
    doc.setLineWidth(0.1);
    doc.line(startX, currentY + rowHeight, startX + contentWidth, currentY + rowHeight);
    
    currentY += rowHeight;
  });
  
  setY(currentY + 4);
}

// Template 4: Home Visit & Panggilan Orang Tua
function renderHomeVisitPanggilanTable(
  doc: jsPDF,
  homeVisits: any[],
  summons: any[],
  startX: number,
  contentWidth: number,
  currentY: number,
  setY: (y: number) => void,
  checkPageBreak: (h: number) => boolean,
  primaryRgb: [number, number, number],
  config: StudioPdfConfig
) {
  const isLandscape = config.orientation === 'landscape';

  // Combine into unified agenda
  const combined = [
    ...homeVisits.map(h => ({
      type: 'Home Visit',
      date: h.date,
      time: h.time || '10:00',
      studentName: h.studentName,
      studentClass: h.studentClass,
      bidang: h.bidangBimbingan || 'Pribadi',
      targetPerson: h.parentName || 'Orang Tua / Wali',
      address: h.address || '-',
      reason: h.reason || h.background || '-',
      result: h.result || h.agreement || '-',
      officer: h.counselorName || 'Guru BK'
    })),
    ...summons.map(s => ({
      type: 'Panggilan Ortu',
      date: s.date || s.summonDate,
      time: s.time || s.summonTime || '09:00',
      studentName: s.studentName,
      studentClass: s.studentClass,
      bidang: s.bidangBimbingan || 'Pribadi',
      targetPerson: s.parentName || 'Orang Tua / Wali',
      address: 'Ruang BK',
      reason: s.agenda || s.customAgenda || '-',
      result: s.attendanceDetails?.counselingSummary || s.status || 'Terkirim',
      officer: s.counselorName || 'Guru BK'
    }))
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  
  const headers = isLandscape ? [
    { label: 'No', width: 8, align: 'center' as const },
    { label: 'Jenis Agenda', width: 24 },
    { label: 'Tanggal & Jam', width: 24 },
    { label: 'Nama Siswa', width: 38 },
    { label: 'Kelas', width: 14, align: 'center' as const },
    { label: 'Orang Tua / Sasaran', width: 34 },
    { label: 'Tujuan & Pokok Masalah', width: 66 },
    { label: 'Hasil Temu & Kesepakatan RTL', width: 68 },
  ] : [
    { label: 'No', width: 8, align: 'center' as const },
    { label: 'Jenis & Tgl', width: 26 },
    { label: 'Nama Siswa & Kelas', width: 38 },
    { label: 'Wali / Sasaran', width: 32 },
    { label: 'Tujuan & Pokok Masalah', width: 44 },
    { label: 'Hasil Kunjungan / RTL', width: 32 },
  ];
  
  currentY = renderTableHeader(doc, headers, startX, currentY, primaryRgb);
  
  if (combined.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 130);
    doc.text('Tidak ada catatan Kunjungan Rumah maupun Panggilan Orang Tua pada filter ini.', startX + 5, currentY + 6);
    setY(currentY + 12);
    return;
  }
  
  combined.forEach((item, idx) => {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    
    const splitReason = doc.splitTextToSize(item.reason, isLandscape ? 62 : 40);
    const splitResult = doc.splitTextToSize(item.result, isLandscape ? 64 : 28);
    const rowHeight = Math.max(7, Math.max(splitReason.length, splitResult.length) * 3.6 + 2.5);
    
    if (checkPageBreak(rowHeight)) {
      currentY = renderTableHeader(doc, headers, startX, currentY, primaryRgb);
    }
    
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 249);
      doc.rect(startX, currentY, contentWidth, rowHeight, 'F');
    }
    
    let curX = startX;
    doc.setTextColor(11, 28, 48);
    
    doc.text(`${idx + 1}`, curX + 4, currentY + 3.8, { align: 'center' });
    curX += headers[0].width;
    
    if (isLandscape) {
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(item.type === 'Home Visit' ? 180 : primaryRgb[0], item.type === 'Home Visit' ? 80 : primaryRgb[1], item.type === 'Home Visit' ? 0 : primaryRgb[2]);
      doc.text(item.type, curX + 2, currentY + 3.8);
      curX += headers[1].width;
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(11, 28, 48);
      doc.text(`${item.date}\n${item.time}`, curX + 2, currentY + 3.5);
      curX += headers[2].width;
      
      doc.text(item.studentName, curX + 2, currentY + 3.8);
      curX += headers[3].width;
      
      doc.text(item.studentClass, curX + 7, currentY + 3.8, { align: 'center' });
      curX += headers[4].width;
      
      doc.text(item.targetPerson, curX + 2, currentY + 3.8);
      curX += headers[5].width;
      
      doc.text(splitReason, curX + 2, currentY + 3.8);
      curX += headers[6].width;
      
      doc.text(splitResult, curX + 2, currentY + 3.8);
    } else {
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(item.type === 'Home Visit' ? 180 : primaryRgb[0], item.type === 'Home Visit' ? 80 : primaryRgb[1], item.type === 'Home Visit' ? 0 : primaryRgb[2]);
      doc.text(item.type, curX + 2, currentY + 3.5);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(11, 28, 48);
      doc.text(item.date, curX + 2, currentY + 7);
      curX += headers[1].width;
      
      doc.text(`${item.studentName}\n(${item.studentClass})`, curX + 2, currentY + 3.5);
      curX += headers[2].width;
      
      doc.text(item.targetPerson, curX + 2, currentY + 3.8);
      curX += headers[3].width;
      
      doc.text(splitReason, curX + 2, currentY + 3.8);
      curX += headers[4].width;
      
      doc.text(splitResult, curX + 2, currentY + 3.8);
    }
    
    doc.setDrawColor(230, 235, 233);
    doc.setLineWidth(0.1);
    doc.line(startX, currentY + rowHeight, startX + contentWidth, currentY + rowHeight);
    
    currentY += rowHeight;
  });
  
  setY(currentY + 4);
}

// Template 5: Rekap Apresiasi & Prestasi
function renderPrestasiTable(
  doc: jsPDF,
  achievements: StudentAchievement[],
  startX: number,
  contentWidth: number,
  currentY: number,
  setY: (y: number) => void,
  checkPageBreak: (h: number) => boolean,
  primaryRgb: [number, number, number],
  config: StudioPdfConfig
) {
  const isLandscape = config.orientation === 'landscape';

  const headers = isLandscape ? [
    { label: 'No', width: 8, align: 'center' as const },
    { label: 'Tanggal', width: 22 },
    { label: 'Nama Siswa', width: 45 },
    { label: 'Kelas', width: 14, align: 'center' as const },
    { label: 'Nama Kejuaraan / Prestasi Positif', width: 85 },
    { label: 'Tingkat / Kategori', width: 35 },
    { label: 'Reward Poin', width: 20, align: 'center' as const },
    { label: 'Dicatat Oleh', width: 35 },
  ] : [
    { label: 'No', width: 8, align: 'center' as const },
    { label: 'Tanggal', width: 20 },
    { label: 'Nama Siswa & Kelas', width: 42 },
    { label: 'Prestasi / Kejuaraan', width: 60 },
    { label: 'Reward (+)', width: 18, align: 'center' as const },
    { label: 'Pencatat', width: 28 },
  ];
  
  currentY = renderTableHeader(doc, headers, startX, currentY, primaryRgb);
  
  if (achievements.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 130);
    doc.text('Tidak ada catatan apresiasi/prestasi siswa pada filter ini.', startX + 5, currentY + 6);
    setY(currentY + 12);
    return;
  }
  
  achievements.forEach((a, idx) => {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    
    const splitAch = doc.splitTextToSize(a.achievementName || '-', isLandscape ? 80 : 55);
    const rowHeight = Math.max(7, splitAch.length * 3.6 + 2.5);
    
    if (checkPageBreak(rowHeight)) {
      currentY = renderTableHeader(doc, headers, startX, currentY, primaryRgb);
    }
    
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 249);
      doc.rect(startX, currentY, contentWidth, rowHeight, 'F');
    }
    
    let curX = startX;
    doc.setTextColor(11, 28, 48);
    
    doc.text(`${idx + 1}`, curX + 4, currentY + 3.8, { align: 'center' });
    curX += headers[0].width;
    
    doc.text(a.date, curX + 2, currentY + 3.8);
    curX += headers[1].width;
    
    if (isLandscape) {
      doc.text(a.studentName, curX + 2, currentY + 3.8);
      curX += headers[2].width;
      
      doc.text(a.studentClass, curX + 7, currentY + 3.8, { align: 'center' });
      curX += headers[3].width;
      
      doc.text(splitAch, curX + 2, currentY + 3.8);
      curX += headers[4].width;
      
      doc.text(a.category || 'Sekolah', curX + 2, currentY + 3.8);
      curX += headers[5].width;
      
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(`+${a.pointsReward}`, curX + 10, currentY + 3.8, { align: 'center' });
      curX += headers[6].width;
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(11, 28, 48);
      doc.text(a.recordedBy || 'Guru BK', curX + 2, currentY + 3.8);
    } else {
      doc.text(`${a.studentName}\n(${a.studentClass})`, curX + 2, currentY + 3.5);
      curX += headers[2].width;
      
      doc.text(splitAch, curX + 2, currentY + 3.8);
      curX += headers[3].width;
      
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(`+${a.pointsReward}`, curX + 9, currentY + 3.8, { align: 'center' });
      curX += headers[4].width;
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(11, 28, 48);
      doc.text(a.recordedBy || 'Guru BK', curX + 2, currentY + 3.8);
    }
    
    doc.setDrawColor(230, 235, 233);
    doc.setLineWidth(0.1);
    doc.line(startX, currentY + rowHeight, startX + contentWidth, currentY + rowHeight);
    
    currentY += rowHeight;
  });
  
  setY(currentY + 4);
}

// Template 6: Laporan Periodik Komprehensif
function renderLaporanPeriodikComprehensive(
  doc: jsPDF,
  services: CounselingService[],
  violations: ViolationRecord[],
  homeVisits: any[],
  summons: any[],
  achievements: StudentAchievement[],
  startX: number,
  contentWidth: number,
  currentY: number,
  setY: (y: number) => void,
  checkPageBreak: (h: number) => boolean,
  primaryRgb: [number, number, number],
  config: StudioPdfConfig
) {
  // Bagian A: Ringkasan Sesi Layanan
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(`A. REKAPITULASI SESI LAYANAN BK (${services.length} SESI)`, startX, currentY);
  currentY += 4;
  
  renderJurnalAgendaTable(doc, services.slice(0, 25), startX, contentWidth, currentY, (newY) => { currentY = newY; }, checkPageBreak, primaryRgb, config);
  
  // Bagian B: Rekap Kasus Pelanggaran
  checkPageBreak(30);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(`B. CATATAN PENANGANAN DISIPLIN & KASUS SISWA (${violations.length} KASUS)`, startX, currentY);
  currentY += 4;
  
  renderRegisterKasusTable(doc, violations.slice(0, 25), startX, contentWidth, currentY, (newY) => { currentY = newY; }, checkPageBreak, primaryRgb, config);
  
  // Bagian C: Kunjungan Rumah & Panggilan Orang Tua
  checkPageBreak(30);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(`C. REKAPITULASI KUNJUNGAN RUMAH & PANGGILAN ORANG TUA (${homeVisits.length + summons.length} AGENDA)`, startX, currentY);
  currentY += 4;
  
  renderHomeVisitPanggilanTable(doc, homeVisits.slice(0, 20), summons.slice(0, 20), startX, contentWidth, currentY, (newY) => { currentY = newY; }, checkPageBreak, primaryRgb, config);

  // Bagian D: Catatan Prestasi Siswa
  checkPageBreak(30);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(`D. REKAPITULASI CATATAN PRESTASI & APRESIASI SISWA (${achievements.length} CATATAN)`, startX, currentY);
  currentY += 4;

  renderPrestasiTable(doc, achievements.slice(0, 20), startX, contentWidth, currentY, (newY) => { currentY = newY; }, checkPageBreak, primaryRgb, config);

  setY(currentY);
}

// Template 7: Matriks Rekap Kustom
function renderCustomMatrixTable(
  doc: jsPDF,
  students: Student[],
  services: CounselingService[],
  violations: ViolationRecord[],
  startX: number,
  contentWidth: number,
  currentY: number,
  setY: (y: number) => void,
  checkPageBreak: (h: number) => boolean,
  primaryRgb: [number, number, number],
  config: StudioPdfConfig
) {
  const filteredStudents = students.filter(s => {
    if (config.selectedClass !== 'semua' && (s.class || '').trim().toUpperCase() !== config.selectedClass.trim().toUpperCase()) {
      return false;
    }
    return true;
  });
  
  const headers = [
    { label: 'No', width: 8, align: 'center' as const },
    { label: 'NIS / NISN', width: 25 },
    { label: 'Nama Lengkap Siswa', width: 55 },
    { label: 'Kelas', width: 15, align: 'center' as const },
    { label: 'L/P', width: 12, align: 'center' as const },
    { label: 'Poin Pelanggaran', width: 30, align: 'center' as const },
    { label: 'Jumlah Layanan', width: 35, align: 'center' as const },
  ];
  
  currentY = renderTableHeader(doc, headers, startX, currentY, primaryRgb);
  
  filteredStudents.forEach((st, idx) => {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    const rowHeight = 6.5;
    
    if (checkPageBreak(rowHeight)) {
      currentY = renderTableHeader(doc, headers, startX, currentY, primaryRgb);
    }
    
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 249);
      doc.rect(startX, currentY, contentWidth, rowHeight, 'F');
    }
    
    let curX = startX;
    doc.setTextColor(11, 28, 48);
    
    doc.text(`${idx + 1}`, curX + 4, currentY + 4.2, { align: 'center' });
    curX += headers[0].width;
    
    doc.text(st.nisn || st.nis || '-', curX + 2, currentY + 4.2);
    curX += headers[1].width;
    
    doc.setFont('Helvetica', 'bold');
    doc.text(st.name, curX + 2, currentY + 4.2);
    curX += headers[2].width;
    
    doc.setFont('Helvetica', 'normal');
    doc.text(st.class, curX + 7.5, currentY + 4.2, { align: 'center' });
    curX += headers[3].width;
    
    doc.text(st.gender || '-', curX + 6, currentY + 4.2, { align: 'center' });
    curX += headers[4].width;
    
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(st.violationPoints > 20 ? 200 : 11, st.violationPoints > 20 ? 30 : 28, st.violationPoints > 20 ? 30 : 48);
    doc.text(`${st.violationPoints || 0} Poin`, curX + 15, currentY + 4.2, { align: 'center' });
    curX += headers[5].width;
    
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text(`${st.bkServicesCount || 0} Kali`, curX + 17.5, currentY + 4.2, { align: 'center' });
    
    doc.setDrawColor(230, 235, 233);
    doc.setLineWidth(0.1);
    doc.line(startX, currentY + rowHeight, startX + contentWidth, currentY + rowHeight);
    
    currentY += rowHeight;
  });
  
  setY(currentY + 4);
}
