import { jsPDF } from 'jspdf';
import { showToast } from './toast';
import { Student, ViolationRecord, CounselingService, ClassAttendanceRecord, StudentAttendance, StudentAchievement, Counselor, SuratPerjanjianRecord, KontrakPerilakuRecord, JurnalPembinaanDisiplinRecord, KomitmenRtlRecord } from '../types';

export function drawSchoolLogo(doc: jsPDF, x: number, y: number, r: number) {
  // We draw a gorgeous circular seal
  // Outer circle with deep teal/accent fill
  doc.setFillColor(0, 104, 95); // #00685f
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.circle(x, y, r, 'F');

  // Inner ring
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  doc.circle(x, y, r * 0.82, 'D');

  // Draw Graduation Cap in center
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.15);

  // 1. Cap Base (polygon under the diamond)
  doc.triangle(
    x - r * 0.2, y + r * 0.05,
    x + r * 0.2, y + r * 0.05,
    x, y + r * 0.35,
    'F'
  );

  // 2. Cap Top (Rhombus)
  doc.triangle(
    x, y - r * 0.3,
    x - r * 0.45, y - r * 0.05,
    x, y + r * 0.2,
    'F'
  );
  doc.triangle(
    x, y - r * 0.3,
    x, y + r * 0.2,
    x + r * 0.45, y - r * 0.05,
    'F'
  );

  // 3. Tassel Line
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.15);
  doc.line(x, y - r * 0.05, x - r * 0.35, y + r * 0.1);
  doc.line(x - r * 0.35, y + r * 0.1, x - r * 0.35, y + r * 0.25);
}

export function drawKabSemarangLogo(doc: jsPDF, x: number, y: number, r: number) {
  // 1. Outer Gold Shield/Ring
  doc.setFillColor(217, 119, 6); // amber-600 (#d97706)
  doc.circle(x, y, r, 'F');

  // 2. White inner stroke
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.25);
  doc.circle(x, y, r * 0.88, 'D');

  // 3. Inner Emerald/Green Field
  doc.setFillColor(4, 120, 87); // emerald-700 (#047857)
  doc.circle(x, y, r * 0.83, 'F');

  // 4. White central field container (half circle/lower arc) for water/mountain
  doc.setFillColor(14, 165, 233); // sky-500 (#0ea5e9) - Rawa Pening waves
  doc.triangle(
    x - r * 0.65, y + r * 0.1,
    x + r * 0.65, y + r * 0.1,
    x, y + r * 0.7,
    'F'
  );
  doc.circle(x, y + r * 0.2, r * 0.5, 'F');

  // 5. Stylized Mountains (Gunung Ungaran & Merbabu)
  // Outer mountain
  doc.setFillColor(30, 41, 59); // slate-800 (#1e293b)
  doc.triangle(
    x - r * 0.45, y + r * 0.2, // bottom left
    x + r * 0.45, y + r * 0.2, // bottom right
    x, y - r * 0.25,          // top peak
    'F'
  );

  // Inner snow peak reflection
  doc.setFillColor(255, 255, 255);
  doc.triangle(
    x - r * 0.15, y - r * 0.05,
    x + r * 0.15, y - r * 0.05,
    x, y - r * 0.25,
    'F'
  );

  // 6. Yellow Divine Star at the Top
  doc.setFillColor(253, 224, 71); // yellow-300 (#fde047)
  // Vertical diamond of the star
  doc.triangle(x, y - r * 0.65, x - r * 0.1, y - r * 0.48, x + r * 0.1, y - r * 0.48, 'F');
  doc.triangle(x, y - r * 0.31, x - r * 0.1, y - r * 0.48, x + r * 0.1, y - r * 0.48, 'F');
  // Horizontal diamond of the star
  doc.triangle(x - r * 0.17, y - r * 0.48, x, y - r * 0.55, x, y - r * 0.41, 'F');
  doc.triangle(x + r * 0.17, y - r * 0.48, x, y - r * 0.55, x, y - r * 0.41, 'F');

  // 7. Golden Rice & Cotton Wreath (stylized bottom boundary)
  doc.setDrawColor(245, 158, 11); // amber-500
  doc.setLineWidth(0.4);
  doc.circle(x, y, r * 0.7, 'D');
}

export function getSchoolConfig() {
  const saved = localStorage.getItem('bk_school_config');
  const defaults = {
    schoolName: 'SMP N 2 Susukan',
    schoolAddress: 'Jl. Kyai Hasan Anwar No. 16, Susukan, Kec. Susukan, Kab. Semarang, Jawa Tengah 50777',
    principalName: 'Drs. H. Suhardi, M.Pd.',
    principalNip: '19680320 199403 1 005',
    governmentName: 'PEMERINTAH KABUPATEN SEMARANG',
    departmentName: 'DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA'
  };
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        ...defaults,
        ...parsed
      };
    } catch (e) {}
  }
  return defaults;
}

export function drawLetterhead(doc: jsPDF, accentColor: number[]) {
  const config = getSchoolConfig();

  // Top border line
  doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setLineWidth(1.2);
  doc.line(15, 12, 195, 12);

  // Draw Kabupaten Semarang logo on the left (X=26, Y=24, R=9)
  const customKabupatenLogo = typeof localStorage !== 'undefined' ? localStorage.getItem('bk_custom_kabupaten_logo') : null;
  if (customKabupatenLogo) {
    try {
      // Draw at bounding box: X = 26 - 9 = 17, Y = 24 - 9 = 15, size 18x18
      const kabFormat = customKabupatenLogo.toLowerCase().includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(customKabupatenLogo, kabFormat, 17, 15, 18, 18);
    } catch (e) {
      drawKabSemarangLogo(doc, 26, 24, 9);
    }
  } else {
    drawKabSemarangLogo(doc, 26, 24, 9);
  }

  // Draw School logo on the right (X=184, Y=24, R=9)
  const customSchoolLogo = typeof localStorage !== 'undefined' ? localStorage.getItem('bk_custom_school_logo') : null;
  if (customSchoolLogo) {
    try {
      // Draw at bounding box: X = 184 - 9 = 175, Y = 24 - 9 = 15, size 18x18
      const schoolFormat = customSchoolLogo.toLowerCase().includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(customSchoolLogo, schoolFormat, 175, 15, 18, 18);
    } catch (e) {
      drawSchoolLogo(doc, 184, 24, 9);
    }
  } else {
    drawSchoolLogo(doc, 184, 24, 9);
  }

  // School name and title (centered perfectly between the two logos at X=105)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 28, 48); // Dark Navy
  doc.text(config.governmentName.toUpperCase(), 105, 18, { align: 'center' });
  doc.text(config.departmentName.toUpperCase(), 105, 22, { align: 'center' });
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(config.schoolName.toUpperCase(), 105, 27, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(61, 73, 71); // Charcoal
  doc.text(config.schoolAddress, 105, 31, { align: 'center' });

  // Thick Line Separator
  doc.setDrawColor(11, 28, 48);
  doc.setLineWidth(0.6);
  doc.line(15, 34, 195, 34);
  doc.setLineWidth(0.2);
  doc.line(15, 35, 195, 35);
}

/**
 * Generates a professional PDF for a Student Behavioral & Counseling Recap Report.
 */
export function downloadStudentRecapPDF(
  student: Student,
  violations: ViolationRecord[],
  services: CounselingService[],
  achievements: StudentAchievement[] = []
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Color Palette
  const primaryColor = [11, 28, 48]; // #0b1c30 (Dark Navy/Slate)
  const tealColor = [0, 104, 95]; // #00685f (Teal Accent)
  const redColor = [186, 26, 26]; // #ba1a1a (Violation Red)
  const grayColor = [61, 73, 71]; // #3d4947 (Charcoal)
  const lightGrayColor = [240, 244, 244]; // Backgrounds

  // Helper function to handle page breaks elegantly
  let currentY = 15;
  const pageHeight = 297; // A4 height in mm

  function drawHeader() {
    drawLetterhead(doc, tealColor);

    // Document Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
    doc.text('RAPOR REKAPITULASI PERILAKU & BIMBINGAN SISWA', 105, 45, { align: 'center' });

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(`Dicetak otomatis pada: ${formatIndonesianDate(new Date().toISOString())} - Sifat: Rahasia`, 105, 50, { align: 'center' });

    currentY = 56;
  }

  function checkPageBreak(spaceNeeded: number) {
    if (currentY + spaceNeeded > pageHeight - 25) {
      doc.addPage();
      // Draw minimal page header
      doc.setDrawColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setLineWidth(1);
      doc.line(15, 15, 195, 15);

      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 130);
      doc.text(`Rekap Perkembangan Siswa: ${student.name} - Halaman ${doc.getNumberOfPages()}`, 15, 12);
      
      currentY = 25;
    }
  }

  // Draw first page header
  drawHeader();

  // I. DATA DIRI SISWA
  checkPageBreak(35);
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('I. DATA IDENTITAS SISWA', 20, currentY + 5.5);

  currentY += 13;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  doc.text('Nama Lengkap', 20, currentY);
  doc.text(':', 55, currentY);
  doc.setFont('Helvetica', 'bold');
  const splitStudentName = doc.splitTextToSize(student.name, 50);
  doc.text(splitStudentName, 60, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.text('NISN / NIS', 20, currentY + 6);
  doc.text(':', 55, currentY + 6);
  doc.text(student.nis, 60, currentY + 6);

  doc.text('Kelas & Rombe', 20, currentY + 12);
  doc.text(':', 55, currentY + 12);
  doc.text(student.class, 60, currentY + 12);

  // Right column of basic info
  doc.text('Akumulasi Pelanggaran', 115, currentY);
  doc.text(':', 155, currentY);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(student.violationPoints > 50 ? redColor[0] : tealColor[0], student.violationPoints > 50 ? redColor[1] : tealColor[1], student.violationPoints > 50 ? redColor[2] : tealColor[2]);
  doc.text(`${student.violationPoints} Bobot`, 160, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Status Eskalasi', 115, currentY + 6);
  doc.text(':', 155, currentY + 6);
  
  doc.setFont('Helvetica', 'bold');
  if (student.violationPoints >= 100) {
    doc.setTextColor(redColor[0], redColor[1], redColor[2]);
    doc.text('BAHAYA (Eskalasi Kepsek)', 160, currentY + 6);
  } else if (student.violationPoints >= 50) {
    doc.setTextColor(180, 100, 0);
    doc.text('PERINGATAN (Panggil Walkes)', 160, currentY + 6);
  } else {
    doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
    doc.text('AMAN / TERKENDALASI', 160, currentY + 6);
  }

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Kehadiran Bimbingan', 115, currentY + 12);
  doc.text(':', 155, currentY + 12);
  doc.text(`${services.length} Sesi Terlaksana`, 160, currentY + 12);

  currentY += 21;

  // II. RIWAYAT CATATAN PELANGGARAN
  checkPageBreak(30);
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`II. CATATAN PELANGGARAN DISIPLIN (${violations.length})`, 20, currentY + 5.5);

  currentY += 12;

  if (violations.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 110, 110);
    doc.text('Siswa ini bersih dan tidak memiliki riwayat pelanggaran disiplin.', 20, currentY);
    currentY += 10;
  } else {
    // Render a clean tabular list for violations
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setFillColor(230, 235, 235);
    doc.rect(15, currentY, 180, 7, 'F');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    
    doc.text('No', 18, currentY + 4.5);
    doc.text('Tiket ID', 26, currentY + 4.5);
    doc.text('Tanggal & Waktu', 45, currentY + 4.5);
    doc.text('Kategori', 80, currentY + 4.5);
    doc.text('Bobot', 110, currentY + 4.5);
    doc.text('Keterangan / Kronologi', 125, currentY + 4.5);

    currentY += 7;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);

    violations.forEach((v, index) => {
      // split description to avoid breaking layout
      const notesLine = v.notes || '-';
      const splitCategory = doc.splitTextToSize(v.category || '-', 27);
      const splitNotes = doc.splitTextToSize(notesLine, 65);
      const rowHeight = Math.max(8, splitCategory.length * 4 + 2, splitNotes.length * 4 + 2);

      checkPageBreak(rowHeight);

      // Alternate backgrounds
      if (index % 2 === 1) {
        doc.setFillColor(248, 249, 249);
        doc.rect(15, currentY, 180, rowHeight, 'F');
      }

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`${index + 1}`, 18, currentY + 4.5);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(redColor[0], redColor[1], redColor[2]);
      doc.text(v.ticketId, 26, currentY + 4.5);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`${v.date} ${v.time}`, 45, currentY + 4.5);
      doc.text(splitCategory, 80, currentY + 4.5);
      doc.setFont('Helvetica', 'bold');
      doc.text(`+${v.pointsAdded}`, 110, currentY + 4.5);
      doc.setFont('Helvetica', 'normal');
      
      // Draw multiline notes
      doc.text(splitNotes, 125, currentY + 4.5);

      // Draw subtle bottom line
      doc.setDrawColor(220, 225, 225);
      doc.setLineWidth(0.1);
      doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

      currentY += rowHeight;
    });
    currentY += 6;
  }

  // III. POIN APRESIASI & PRESTASI SISWA
  checkPageBreak(30);
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`III. APRESIASI & PRESTASI SISWA (${achievements.length})`, 20, currentY + 5.5);

  currentY += 12;

  if (achievements.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 110, 110);
    doc.text('Siswa ini belum memiliki catatan prestasi atau bobot apresiasi positif.', 20, currentY);
    currentY += 10;
  } else {
    // Render tabular list for achievements
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setFillColor(230, 235, 235);
    doc.rect(15, currentY, 180, 7, 'F');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

    doc.text('No', 18, currentY + 4.5);
    doc.text('Tanggal', 26, currentY + 4.5);
    doc.text('Nama Prestasi / Kegiatan Positif', 50, currentY + 4.5);
    doc.text('Bobot', 140, currentY + 4.5);
    doc.text('Dicatat Oleh', 155, currentY + 4.5);

    currentY += 7;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);

    achievements.forEach((a, index) => {
      const splitName = doc.splitTextToSize(a.achievementName, 85);
      const splitRecordedBy = doc.splitTextToSize(a.recordedBy || 'Guru BK', 38);
      const rowHeight = Math.max(8, splitName.length * 4 + 2, splitRecordedBy.length * 4 + 2);

      checkPageBreak(rowHeight);

      if (index % 2 === 1) {
        doc.setFillColor(248, 249, 249);
        doc.rect(15, currentY, 180, rowHeight, 'F');
      }

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`${index + 1}`, 18, currentY + 4.5);
      doc.text(a.date, 26, currentY + 4.5);
      
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.text(splitName, 50, currentY + 4.5);
      
      doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.text(`+${a.pointsReward}`, 140, currentY + 4.5);
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(splitRecordedBy, 155, currentY + 4.5);

      doc.setDrawColor(220, 225, 225);
      doc.setLineWidth(0.1);
      doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

      currentY += rowHeight;
    });
    currentY += 6;
  }

  // IV. RIWAYAT BIMBINGAN KONSELING (KONSULTASI)
  checkPageBreak(30);
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`IV. RIWAYAT BIMBINGAN & KONSELING SISWA (${services.length})`, 20, currentY + 5.5);

  currentY += 12;

  if (services.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 110, 110);
    doc.text('Siswa ini belum memiliki riwayat bimbingan konseling dengan Guru BK.', 20, currentY);
    currentY += 10;
  } else {
    // Render tabular list for counseling
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setFillColor(230, 235, 235);
    doc.rect(15, currentY, 180, 7, 'F');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

    doc.text('No', 18, currentY + 4.5);
    doc.text('Tanggal', 26, currentY + 4.5);
    doc.text('Jenis Layanan', 50, currentY + 4.5);
    doc.text('Masalah / Topik', 85, currentY + 4.5);
    doc.text('Rekomendasi Tindak Lanjut', 135, currentY + 4.5);

    currentY += 7;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);

    services.forEach((s, index) => {
      const splitServiceType = doc.splitTextToSize(s.serviceType || '-', 32);
      const splitProblem = doc.splitTextToSize(s.problem, 45);
      const splitFollowUp = doc.splitTextToSize(s.followUp || '-', 55);
      
      const maxTextLines = Math.max(splitServiceType.length, splitProblem.length, splitFollowUp.length);
      const rowHeight = Math.max(8, maxTextLines * 4 + 2);

      checkPageBreak(rowHeight);

      if (index % 2 === 1) {
        doc.setFillColor(248, 249, 249);
        doc.rect(15, currentY, 180, rowHeight, 'F');
      }

      doc.text(`${index + 1}`, 18, currentY + 4.5);
      doc.text(s.date, 26, currentY + 4.5);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.text(splitServiceType, 50, currentY + 4.5);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(splitProblem, 85, currentY + 4.5);
      doc.text(splitFollowUp, 135, currentY + 4.5);

      doc.setDrawColor(220, 225, 225);
      doc.setLineWidth(0.1);
      doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

      currentY += rowHeight;
    });
    currentY += 6;
  }

  // V. REKOMENDASI GURU BK & TANDA TANGAN
  checkPageBreak(40);
  doc.setDrawColor(200, 205, 205);
  doc.setLineWidth(0.3);
  doc.line(15, currentY, 195, currentY);
  
  currentY += 7;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('V. CATATAN DAN REKOMENDASI UMUM KONSIDERASI BK:', 15, currentY);

  currentY += 5;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  
  let generalRecommendation = '';
  if (student.violationPoints >= 100) {
    generalRecommendation = 'Siswa telah melampaui batas kritis akumulasi bobot kedisiplinan (>= 100 Bobot). Tindakan kedisiplinan khusus tingkat sekolah diwajibkan, termasuk pembinaan intensif khusus serta pemanggilan berkala Orang Tua/Wali bersama Kepala Sekolah.';
  } else if (student.violationPoints >= 50) {
    generalRecommendation = 'Siswa berada dalam pengawasan ketat (kategori Peringatan, >= 50 Bobot). Diharapkan Guru BK dan Wali Kelas melakukan kolaborasi preventif harian untuk mencegah berulangnya pelanggaran disiplin.';
  } else {
    generalRecommendation = 'Catatan kedisiplinan siswa dalam kategori Baik / Terkendali. Tetap dorong motivasi siswa dan pertahankan koordinasi yang harmonis antara pihak sekolah dan siswa.';
  }

  const splitRec = doc.splitTextToSize(generalRecommendation, 175);
  doc.text(splitRec, 15, currentY);

  currentY += splitRec.length * 4.5 + 10;

  // Signatures
  const schoolConfig = getSchoolConfig();
  checkPageBreak(35);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  doc.text('Mengetahui,', 20, currentY);
  doc.text(`Kepala ${schoolConfig.schoolName},`, 20, currentY + 5.5);
  doc.line(20, currentY + 28, 75, currentY + 28);
  doc.setFont('Helvetica', 'bold');
  doc.text(schoolConfig.principalName, 20, currentY + 27);
  doc.setFont('Helvetica', 'normal');
  doc.text(`NIP. ${schoolConfig.principalNip}`, 20, currentY + 31.5);

  doc.text('Kabupaten Semarang, ' + formatIndonesianDate(new Date().toISOString()), 125, currentY);
  doc.text('Guru Pembimbing / Konselor,', 125, currentY + 5.5);
  doc.line(125, currentY + 28, 180, currentY + 28);
  doc.setFont('Helvetica', 'bold');
  doc.text('Aulia Aji Sasongko, S.Pd.', 125, currentY + 27);
  doc.setFont('Helvetica', 'normal');
  doc.text('NIP. 19931231 202221 1 002', 125, currentY + 31.5);

  // Footer page layout
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(150, 160, 160);
    doc.text(
      `Dokumen Rekapitulasi Digital Portal BK ${schoolConfig.schoolName} | Halaman ${i} dari ${totalPages} | Dicetak oleh: ${student.name.replace(/\s+/g, '_')}`,
      105,
      285,
      { align: 'center' }
    );
  }

  // Save the PDF file
  showToast('Dokumen PDF Rapor BK berhasil diunduh!', 'success');
  doc.save(`Rekap_BK_${student.nis}_${student.name.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generates a professional PDF for a Violation Record (Bukti Pelanggaran).
 */
export function downloadViolationPDF(violation: ViolationRecord) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Color Palette
  const primaryColor = [186, 26, 26]; // #ba1a1a (Red)
  const darkColor = [11, 28, 48]; // #0b1c30 (Dark Slate)
  const grayColor = [61, 73, 71]; // #3d4947 (Charcoal)
  const lightGrayColor = [240, 244, 244]; // Light background

  // Draw Letterhead
  drawLetterhead(doc, primaryColor);

  // Document Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('SURAT BUKTI PELANGGARAN DISIPLIN SISWA', 105, 45, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`Nomor Tiket: ${violation.ticketId}`, 105, 52, { align: 'center' });

  // Student Section Header
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, 58, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('I. DATA DIRI SISWA', 20, 63);

  // Student Details Table-like layout
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  
  doc.text('Nama Siswa', 20, 72);
  doc.text(':', 55, 72);
  doc.setFont('Helvetica', 'bold');
  doc.text(violation.studentName, 60, 72);

  doc.setFont('Helvetica', 'normal');
  doc.text('NISN', 20, 78);
  doc.text(':', 55, 78);
  doc.text(violation.studentId.startsWith('s-') ? '-' : violation.studentId, 60, 78);

  doc.text('Kelas', 20, 84);
  doc.text(':', 55, 84);
  doc.text(violation.studentClass, 60, 84);

  // Incident Section Header
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, 92, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('II. RINCIAN INSIDEN PELANGGARAN', 20, 97);

  // Incident Details with dynamic Y coordinates to avoid overlapping
  let detailY = 106;

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Kategori Pelanggaran', 20, detailY);
  doc.text(':', 55, detailY);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  const splitCategory = doc.splitTextToSize(violation.category || '-', 135);
  doc.text(splitCategory, 60, detailY);
  
  detailY += Math.max(6, splitCategory.length * 5);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Bobot Pelanggaran', 20, detailY);
  doc.text(':', 55, detailY);
  doc.setFont('Helvetica', 'bold');
  doc.text(`+ ${violation.pointsAdded} Bobot`, 60, detailY);

  detailY += 6;
  doc.setFont('Helvetica', 'normal');
  doc.text('Waktu & Tanggal', 20, detailY);
  doc.text(':', 55, detailY);
  doc.text(formatRecordDateTime(violation.date, violation.time), 60, detailY);

  detailY += 6;
  doc.text('Lokasi Kejadian', 20, detailY);
  doc.text(':', 55, detailY);
  const splitLocation = doc.splitTextToSize(violation.location || '-', 135);
  doc.text(splitLocation, 60, detailY);

  detailY += Math.max(6, splitLocation.length * 5);
  doc.text('Dilaporkan Oleh', 20, detailY);
  doc.text(':', 55, detailY);
  const splitReportedBy = doc.splitTextToSize(violation.reportedBy || '-', 135);
  doc.text(splitReportedBy, 60, detailY);

  detailY += Math.max(6, splitReportedBy.length * 5);

  // Notes Section
  const notesHeaderY = detailY + 4;
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, notesHeaderY, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('III. KETERANGAN / KRONOLOGI', 20, notesHeaderY + 5.5);

  doc.setFont('Helvetica', 'normal');
  const splitNotes = doc.splitTextToSize(violation.notes || 'Tidak ada keterangan tambahan.', 170);
  doc.text(splitNotes, 20, notesHeaderY + 14);

  // Signatures Section - dynamically positioned to avoid overlaps
  const notesContentY = notesHeaderY + 14;
  const endNotesY = notesContentY + (splitNotes.length * 5);
  let footerY = Math.max(215, endNotesY + 15);

  if (footerY + 35 > 275) {
    doc.addPage();
    drawLetterhead(doc, primaryColor);
    footerY = 45;
  }

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Mengetahui,', 20, footerY);
  doc.text('Siswa Bersangkutan,', 20, footerY + 5);
  doc.line(20, footerY + 28, 70, footerY + 28);

  doc.text('Guru Pembimbing / Konselor,', 130, footerY + 5);
  doc.setFont('Helvetica', 'bold');
  const splitReportedName = doc.splitTextToSize(violation.reportedBy || 'Guru BK', 60);
  doc.text(splitReportedName, 130, footerY + 27);
  doc.setFont('Helvetica', 'normal');
  doc.text('NIP. 19931231 202221 1 002', 130, footerY + 32);

  // Footer metadata
  const schoolConfig = getSchoolConfig();
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 130);
  doc.text(`Dicetak otomatis melalui Portal BK ${schoolConfig.schoolName} pada ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`, 15, 280);

  // Save the PDF file
  showToast('Dokumen PDF Bukti Pelanggaran berhasil diunduh!', 'success');
  doc.save(`Bukti_Pelanggaran_${violation.ticketId}_${violation.studentName.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generates a professional PDF for a Counseling Service (Bukti Layanan BK).
 */
export function downloadServicePDF(service: CounselingService) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Color Palette
  const primaryColor = [0, 104, 95]; // #00685f (Teal)
  const darkColor = [11, 28, 48]; // #0b1c30 (Dark Slate)
  const grayColor = [61, 73, 71]; // #3d4947 (Charcoal)
  const lightGrayColor = [240, 244, 244]; // Light background

  // Draw Letterhead
  drawLetterhead(doc, primaryColor);

  // Document Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('KARTU BUKTI PELAKSANAAN LAYANAN BK', 105, 45, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`Tipe Layanan: ${service.serviceType}`, 105, 52, { align: 'center' });

  // Student Section Header
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, 58, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('I. DAFTAR PESERTA LAYANAN (SISWA)', 20, 63);

  // List students participating
  doc.setFont('Helvetica', 'normal');
  let currentY = 71;
  service.students.forEach((student, idx) => {
    doc.setFont('Helvetica', 'bold');
    doc.text(`${idx + 1}. ${student.name}`, 20, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Kelas: ${student.class} | NISN: ${student.nis}`, 100, currentY);
    currentY += 6;
  });

  // Adjust placement based on number of students
  const serviceHeaderY = Math.max(88, currentY + 4);

  // Service details Section Header
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, serviceHeaderY, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('II. DETAIL PELAKSANAAN LAYANAN', 20, serviceHeaderY + 5);

  // Details
  let detailY = serviceHeaderY + 14;
  doc.setFont('Helvetica', 'normal');
  doc.text('Topik/Masalah', 20, detailY);
  doc.text(':', 55, detailY);
  doc.setFont('Helvetica', 'bold');
  const splitProblemText = doc.splitTextToSize(service.problem || '-', 135);
  doc.text(splitProblemText, 60, detailY);

  detailY += Math.max(6, splitProblemText.length * 5);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Status Layanan', 20, detailY);
  doc.text(':', 55, detailY);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(service.status, 60, detailY);

  detailY += 6;
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('Helvetica', 'normal');
  doc.text('Waktu Sesi', 20, detailY);
  doc.text(':', 55, detailY);
  const serviceTimeRange = service.startTime && service.endTime ? `${service.startTime} - ${service.endTime}` : service.startTime || '';
  doc.text(formatRecordDateTime(service.date, serviceTimeRange), 60, detailY);

  // Description & Outcomes Header
  const descHeaderY = detailY + 10;
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, descHeaderY, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('III. DESKRIPSI, HASIL & TINDAK LANJUT', 20, descHeaderY + 5);

  // Content
  let contentY = descHeaderY + 14;
  doc.setFont('Helvetica', 'bold');
  doc.text('Deskripsi Masalah:', 20, contentY);
  doc.setFont('Helvetica', 'normal');
  const splitDesc = doc.splitTextToSize(service.description || '-', 170);
  doc.text(splitDesc, 20, contentY + 5);
  
  contentY += splitDesc.length * 5 + 10;
  doc.setFont('Helvetica', 'bold');
  doc.text('Hasil / Output Layanan:', 20, contentY);
  doc.setFont('Helvetica', 'normal');
  const splitOutput = doc.splitTextToSize(service.output || '-', 170);
  doc.text(splitOutput, 20, contentY + 5);

  contentY += splitOutput.length * 5 + 10;
  doc.setFont('Helvetica', 'bold');
  doc.text('Tindak Lanjut:', 20, contentY);
  doc.setFont('Helvetica', 'normal');
  const splitFollowUp = doc.splitTextToSize(service.followUp || '-', 170);
  doc.text(splitFollowUp, 20, contentY + 5);

  // Signatures Section at the absolute bottom or relative if plenty space
  let finalY = Math.max(225, contentY + splitFollowUp.length * 5 + 15);

  if (finalY + 35 > 275) {
    doc.addPage();
    drawLetterhead(doc, primaryColor);
    finalY = 45;
  }

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Mengetahui,', 20, finalY);
  doc.text('Perwakilan Orang Tua / Siswa,', 20, finalY + 5);
  doc.line(20, finalY + 28, 70, finalY + 28);

  doc.text('Guru Pembimbing / Konselor,', 130, finalY + 5);
  doc.setFont('Helvetica', 'bold');
  doc.text('Aulia Aji Sasongko, S.Pd.', 130, finalY + 27);
  doc.setFont('Helvetica', 'normal');
  doc.text('NIP. 19931231 202221 1 002', 130, finalY + 32);

  // Footer metadata
  const schoolConfig = getSchoolConfig();
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 130);
  doc.text(`Dicetak otomatis melalui Portal BK ${schoolConfig.schoolName} pada ${formatIndonesianDate(new Date().toISOString())}`, 15, 280);

  // Save the PDF file
  doc.save(`Bukti_Layanan_BK_${service.id}_${service.serviceType.replace(/\s+/g, '_')}.pdf`);
}

export function downloadAttendanceRecapPDF(
  className: string,
  startDate: string,
  endDate: string,
  allStudents: Student[],
  attendanceHistory: ClassAttendanceRecord[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [11, 28, 48]; // #0b1c30 (Dark Navy/Slate)
  const tealColor = [0, 104, 95]; // #00685f (Teal Accent)
  const redColor = [186, 26, 26]; // #ba1a1a (Violation Red)
  const grayColor = [61, 73, 71]; // #3d4947 (Charcoal)
  const lightGrayColor = [240, 244, 244]; // Backgrounds

  let currentY = 15;
  const pageHeight = 297;

  function checkPageBreak(neededHeight: number) {
    if (currentY + neededHeight > pageHeight - 20) {
      doc.addPage();
      
      // Page frame border / header line
      doc.setDrawColor(220, 225, 225);
      doc.setLineWidth(0.3);
      doc.line(15, 15, 195, 15);

      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 130);
      doc.text(`Rekap Absensi Kelas ${className} - Halaman ${doc.getNumberOfPages()}`, 15, 12);
      
      currentY = 25;
    }
  }

  function drawHeader() {
    drawLetterhead(doc, tealColor);

    // Document Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
    doc.text('REKAPITULASI PRESENSI / KEHADIRAN SISWA', 105, 45, { align: 'center' });

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(`Dicetak otomatis pada: ${formatIndonesianDate(new Date().toISOString())} - Sifat: Arsip BK`, 105, 50, { align: 'center' });
  }

  drawHeader();
  currentY = 58;

  // Render Recap Info
  checkPageBreak(30);
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('INFORMASI REKAPITULASI', 20, currentY + 5.5);

  currentY += 13;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  doc.text('Kelas / Rombel', 20, currentY);
  doc.text(':', 55, currentY);
  doc.setFont('Helvetica', 'bold');
  doc.text(className, 60, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.text('Periode Laporan', 20, currentY + 6);
  doc.text(':', 55, currentY + 6);
  doc.text(`${startDate} s.d. ${endDate}`, 60, currentY + 6);

  // Filter attendance record within dates and class
  const filteredRecords = attendanceHistory.filter(
    (h) => h.class === className && h.date >= startDate && h.date <= endDate
  );

  doc.text('Hari Efektif KBM', 115, currentY);
  doc.text(':', 155, currentY);
  doc.setFont('Helvetica', 'bold');
  doc.text(`${filteredRecords.length} Hari Tercatat`, 160, currentY);

  const classStudents = allStudents.filter((s) => s.class === className);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Jumlah Siswa', 115, currentY + 6);
  doc.text(':', 155, currentY + 6);
  doc.text(`${classStudents.length} Siswa`, 160, currentY + 6);

  currentY += 16;

  // Render student list with aggregated count
  checkPageBreak(35);
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`DAFTAR PRESENSI SISWA - ${className}`, 20, currentY + 5.5);

  currentY += 12;

  // Header Table
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setFillColor(230, 235, 235);
  doc.rect(15, currentY, 180, 7, 'F');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  doc.text('No', 18, currentY + 4.5);
  doc.text('NISN', 26, currentY + 4.5);
  doc.text('Nama Siswa', 52, currentY + 4.5);
  doc.text('Hadir (H)', 105, currentY + 4.5, { align: 'center' });
  doc.text('Sakit (S)', 122, currentY + 4.5, { align: 'center' });
  doc.text('Izin (I)', 138, currentY + 4.5, { align: 'center' });
  doc.text('Alpa (A)', 154, currentY + 4.5, { align: 'center' });
  doc.text('% Kehadiran', 178, currentY + 4.5, { align: 'center' });

  currentY += 7;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);

  if (classStudents.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 110, 110);
    doc.text('Tidak ada siswa terdaftar di kelas ini.', 20, currentY + 5);
    currentY += 12;
  } else {
    classStudents.forEach((student, index) => {
      // Calculate individual attendance stats
      let H = 0;
      let S = 0;
      let I = 0;
      let A = 0;

      filteredRecords.forEach((rec) => {
        const studentRec = rec.records.find((r) => r.studentId === student.id);
        if (studentRec) {
          if (studentRec.status === 'H') H++;
          else if (studentRec.status === 'S') S++;
          else if (studentRec.status === 'I') I++;
          else if (studentRec.status === 'A') A++;
        } else {
          // If no record found for a specific day, default to 'H' if the day exists
          H++;
        }
      });

      const totalRecordedDays = filteredRecords.length || 1;
      const attendancePercentage = Math.round((H / totalRecordedDays) * 100);

      const splitStudentName = doc.splitTextToSize(student.name || '-', 45);
      const rowHeight = Math.max(7, splitStudentName.length * 3.5 + 2);
      checkPageBreak(rowHeight);

      // Alternate backgrounds
      if (index % 2 === 1) {
        doc.setFillColor(248, 249, 249);
        doc.rect(15, currentY, 180, rowHeight, 'F');
      }

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`${index + 1}`, 18, currentY + 4.5);
      doc.text(student.nis, 26, currentY + 4.5);
      doc.setFont('Helvetica', 'bold');
      doc.text(splitStudentName, 52, currentY + 4.5);
      
      doc.setFont('Helvetica', 'normal');
      doc.text(`${H}`, 105, currentY + 4.5, { align: 'center' });
      doc.text(`${S}`, 122, currentY + 4.5, { align: 'center' });
      doc.text(`${I}`, 138, currentY + 4.5, { align: 'center' });
      
      if (A > 0) {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(redColor[0], redColor[1], redColor[2]);
        doc.text(`${A}`, 154, currentY + 4.5, { align: 'center' });
      } else {
        doc.text(`${A}`, 154, currentY + 4.5, { align: 'center' });
      }

      // Percentage column styling
      doc.setFont('Helvetica', 'bold');
      if (attendancePercentage < 80) {
        doc.setTextColor(redColor[0], redColor[1], redColor[2]);
      } else if (attendancePercentage < 90) {
        doc.setTextColor(180, 100, 0);
      } else {
        doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
      }
      doc.text(`${attendancePercentage}%`, 178, currentY + 4.5, { align: 'center' });

      // Draw subtle bottom line
      doc.setDrawColor(220, 225, 225);
      doc.setLineWidth(0.1);
      doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

      currentY += rowHeight;
    });
  }

  // Signatures section at the bottom
  const finalNeededHeight = 45;
  checkPageBreak(finalNeededHeight);

  const finalY = currentY + 12;
  const config = getSchoolConfig();

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  doc.text('Mengetahui,', 20, finalY);
  doc.text('Kepala Sekolah,', 20, finalY + 5);
  doc.setFont('Helvetica', 'bold');
  doc.text(config.principalName, 20, finalY + 27);
  doc.setFont('Helvetica', 'normal');
  doc.text(`NIP. ${config.principalNip}`, 20, finalY + 32);

  doc.text('Guru Pembimbing / Konselor,', 130, finalY + 5);
  doc.setFont('Helvetica', 'bold');
  doc.text('Aulia Aji Sasongko, S.Pd.', 130, finalY + 27);
  doc.setFont('Helvetica', 'normal');
  doc.text('NIP. 19931231 202221 1 002', 130, finalY + 32);

  // Footer metadata
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 130);
  doc.text(`Dicetak otomatis melalui Portal BK ${config.schoolName} pada ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`, 15, 282);

  // Save the PDF file
  doc.save(`Rekap_Absensi_BK_${className.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.pdf`);
}

/**
 * Generates a professional PDF for a Counselor's Daily Activity Journal.
 */
export function downloadJournalPDF(
  date: string,
  counselor: any,
  entries: any[], // BKJournalEntry[]
  includeAuto: boolean,
  autoActivities: any[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Color Palette matching the rest of the application
  const primaryColor = [11, 28, 48]; // #0b1c30 (Dark Navy/Slate)
  const tealColor = [0, 104, 95]; // #00685f (Teal Accent)
  const grayColor = [61, 73, 71]; // #3d4947 (Charcoal)
  const lightGrayColor = [240, 244, 244]; // Backgrounds

  let currentY = 15;
  const pageHeight = 297; // A4 height in mm

  function drawHeader() {
    drawLetterhead(doc, tealColor);

    // Document Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
    doc.text('JURNAL HARIAN KEGIATAN GURU BIMBINGAN DAN KONSELING', 105, 43, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(`Hari, Tanggal: ${formatIndonesianDate(date)}`, 105, 48, { align: 'center' });

    currentY = 54;
  }

  function checkPageBreak(spaceNeeded: number) {
    if (currentY + spaceNeeded > pageHeight - 25) {
      doc.addPage();
      // Draw minimal page header
      doc.setDrawColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setLineWidth(1);
      doc.line(15, 15, 195, 15);

      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 130);
      doc.text(`Jurnal Harian Guru BK (${date}) - Halaman ${doc.getNumberOfPages()}`, 15, 12);
      
      currentY = 25;
    }
  }

  // Draw first page header
  drawHeader();

  // I. DATA KONSELOR / GURU BK
  checkPageBreak(25);
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 7, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('I. IDENTITAS GURU BIMBINGAN DAN KONSELING', 20, currentY + 4.5);

  currentY += 11;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  doc.text('Nama Guru BK', 20, currentY);
  doc.text(':', 55, currentY);
  doc.setFont('Helvetica', 'bold');
  doc.text(counselor.name, 60, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.text('NIP', 20, currentY + 5);
  doc.text(':', 55, currentY + 5);
  doc.text(counselor.nip || '-', 60, currentY + 5);

  doc.text('Jabatan / Peran', 20, currentY + 10);
  doc.text(':', 55, currentY + 10);
  doc.text(counselor.role, 60, currentY + 10);

  currentY += 18;

  // Combine manual and automatic entries if includeAuto is true
  const allEntriesToRender: any[] = [];
  
  // 1. Add Manual Entries
  entries.forEach((e) => {
    let notes = e.description;
    if (e.absentStudents) {
      notes += `\n\nSiswa Tidak Hadir: ${e.absentStudents}`;
    }
    allEntriesToRender.push({
      time: `${e.startTime} - ${e.endTime}`,
      type: e.activityType,
      title: e.title,
      target: e.target,
      notes: notes,
      status: e.status
    });
  });

  // 2. Add Auto-Integrated Activities
  if (includeAuto && autoActivities) {
    autoActivities.forEach((a) => {
      let notes = a.notes;
      if (a.absentStudents && !notes.includes('Siswa Tidak Hadir') && !notes.includes('Nihil')) {
        notes += `\n\nKetidakhadiran: ${a.absentStudents}`;
      }
      allEntriesToRender.push({
        time: a.time,
        type: a.type,
        title: a.title,
        target: a.target,
        notes: notes,
        status: a.status
      });
    });
  }

  // II. DAFTAR KEGIATAN HARIAN
  checkPageBreak(30);
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 7, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`II. RINCIAN KEGIATAN HARIAN (${allEntriesToRender.length})`, 20, currentY + 4.5);

  currentY += 11;

  if (allEntriesToRender.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 110, 110);
    doc.text('Tidak ada catatan kegiatan harian yang diinputkan untuk tanggal ini.', 20, currentY);
    currentY += 10;
  } else {
    // Sort by time
    allEntriesToRender.sort((a, b) => a.time.localeCompare(b.time));

    // Render Table Header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setFillColor(230, 235, 235);
    doc.rect(15, currentY, 180, 7, 'F');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

    doc.text('No', 18, currentY + 4.5);
    doc.text('Waktu', 24, currentY + 4.5);
    doc.text('Jenis Kegiatan', 44, currentY + 4.5);
    doc.text('Nama Kegiatan & Deskripsi', 74, currentY + 4.5);
    doc.text('Sasaran', 135, currentY + 4.5);
    doc.text('Catatan / Hasil', 160, currentY + 4.5);

    currentY += 7;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);

    allEntriesToRender.forEach((v, index) => {
      // Split description & notes to prevent breaking page borders
      const splitType = doc.splitTextToSize(v.type || '-', 27);
      const titleAndDesc = `${v.title}\n\nDetail: ${v.notes || '-'}`;
      const splitTitleDesc = doc.splitTextToSize(titleAndDesc, 58);
      const splitTarget = doc.splitTextToSize(v.target || '-', 22);
      const splitOutcome = doc.splitTextToSize(`[${v.status}]`, 32);

      const maxLines = Math.max(splitType.length, splitTitleDesc.length, splitTarget.length, splitOutcome.length);
      const rowHeight = Math.max(10, maxLines * 3.5 + 4);

      checkPageBreak(rowHeight);

      // Alternate row colors
      if (index % 2 === 1) {
        doc.setFillColor(248, 249, 249);
        doc.rect(15, currentY, 180, rowHeight, 'F');
      }

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`${index + 1}`, 18, currentY + 4.5);
      doc.text(v.time, 24, currentY + 4.5);
      doc.text(splitType, 44, currentY + 4.5);
      
      // Multi-line outputs
      doc.text(splitTitleDesc, 74, currentY + 4.5);
      doc.text(splitTarget, 135, currentY + 4.5);
      doc.text(splitOutcome, 160, currentY + 4.5);

      // Draw thin separator line
      doc.setDrawColor(220, 225, 225);
      doc.setLineWidth(0.1);
      doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

      currentY += rowHeight;
    });
  }

  // III. SIGNATURES
  const signatureHeight = 45;
  checkPageBreak(signatureHeight);

  const finalY = currentY + 12;
  const config = getSchoolConfig();

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  doc.text('Mengetahui,', 20, finalY);
  doc.text('Kepala Sekolah,', 20, finalY + 5);
  doc.setFont('Helvetica', 'bold');
  doc.text(config.principalName, 20, finalY + 27);
  doc.setFont('Helvetica', 'normal');
  doc.text(`NIP. ${config.principalNip}`, 20, finalY + 32);

  doc.text('Guru Bimbingan & Konseling,', 130, finalY + 5);
  doc.setFont('Helvetica', 'bold');
  doc.text(counselor.name, 130, finalY + 27);
  doc.setFont('Helvetica', 'normal');
  doc.text(counselor.nip && counselor.nip !== '-' ? counselor.nip : 'NIP. -', 130, finalY + 32);

  // Footer metadata
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 130, 130);
  doc.text(`Dicetak otomatis melalui Portal BK ${config.schoolName} pada ${formatIndonesianDate(new Date().toISOString())}`, 15, 282);

  // Save PDF file
  doc.save(`Jurnal_Harian_BK_${date}_${counselor.name.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generates a professional PDF for a Counselor's Journal over a custom date range.
 */
export function downloadJournalRangePDF(
  startDate: string,
  endDate: string,
  counselor: any,
  entries: any[], // BKJournalEntry[]
  includeAuto: boolean,
  autoActivities: any[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Color Palette matching the rest of the application
  const primaryColor = [11, 28, 48]; // #0b1c30 (Dark Navy/Slate)
  const tealColor = [0, 104, 95]; // #00685f (Teal Accent)
  const grayColor = [61, 73, 71]; // #3d4947 (Charcoal)
  const lightGrayColor = [240, 244, 244]; // Backgrounds

  let currentY = 15;
  const pageHeight = 297; // A4 height in mm

  function drawHeader() {
    drawLetterhead(doc, tealColor);

    // Document Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
    doc.text('REKAPITULASI JURNAL HARIAN KEGIATAN GURU BIMBINGAN DAN KONSELING', 105, 43, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(`Periode Laporan: ${formatIndonesianDate(startDate)} s.d. ${formatIndonesianDate(endDate)}`, 105, 48, { align: 'center' });

    currentY = 54;
  }

  function checkPageBreak(spaceNeeded: number) {
    if (currentY + spaceNeeded > pageHeight - 25) {
      doc.addPage();
      // Draw minimal page header
      doc.setDrawColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setLineWidth(1);
      doc.line(15, 15, 195, 15);

      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 130);
      doc.text(`Rekap Jurnal BK (${startDate} - ${endDate}) - Halaman ${doc.getNumberOfPages()}`, 15, 12);
      
      currentY = 25;
    }
  }

  // Draw first page header
  drawHeader();

  // I. DATA KONSELOR / GURU BK
  checkPageBreak(25);
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 7, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('I. IDENTITAS GURU BIMBINGAN DAN KONSELING', 20, currentY + 4.5);

  currentY += 11;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  doc.text('Nama Guru BK', 20, currentY);
  doc.text(':', 55, currentY);
  doc.setFont('Helvetica', 'bold');
  doc.text(counselor.name, 60, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.text('NIP', 20, currentY + 5);
  doc.text(':', 55, currentY + 5);
  doc.text(counselor.nip || '-', 60, currentY + 5);

  doc.text('Jabatan / Peran', 20, currentY + 10);
  doc.text(':', 55, currentY + 10);
  doc.text(counselor.role, 60, currentY + 10);

  currentY += 18;

  // Combine manual and automatic entries if includeAuto is true
  const allEntriesToRender: any[] = [];
  
  // 1. Add Manual Entries
  entries.forEach((e) => {
    let notes = e.description;
    if (e.absentStudents) {
      notes += `\n\nSiswa Tidak Hadir: ${e.absentStudents}`;
    }
    allEntriesToRender.push({
      date: e.date,
      time: `${e.startTime} - ${e.endTime}`,
      type: e.activityType,
      title: e.title,
      target: e.target,
      notes: notes,
      status: e.status
    });
  });

  // 2. Add Auto-Integrated Activities
  if (includeAuto && autoActivities) {
    autoActivities.forEach((a) => {
      let notes = a.notes;
      if (a.absentStudents && !notes.includes('Siswa Tidak Hadir') && !notes.includes('Nihil')) {
        notes += `\n\nKetidakhadiran: ${a.absentStudents}`;
      }
      allEntriesToRender.push({
        date: a.date || startDate,
        time: a.time,
        type: a.type,
        title: a.title,
        target: a.target,
        notes: notes,
        status: a.status
      });
    });
  }

  // Sort by date, then by time
  allEntriesToRender.sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return a.time.localeCompare(b.time);
  });

  // II. DAFTAR KEGIATAN HARIAN
  checkPageBreak(30);
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 7, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`II. REKAPITULASI RINCIAN KEGIATAN HARIAN (${allEntriesToRender.length} KEGIATAN)`, 20, currentY + 4.5);

  currentY += 11;

  if (allEntriesToRender.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 110, 110);
    doc.text('Tidak ada catatan kegiatan harian yang ditemukan untuk kurun waktu ini.', 20, currentY);
    currentY += 10;
  } else {
    // Render Table Header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setFillColor(230, 235, 235);
    doc.rect(15, currentY, 180, 7, 'F');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

    doc.text('No', 17, currentY + 4.5);
    doc.text('Hari/Tanggal & Waktu', 23, currentY + 4.5);
    doc.text('Jenis Kegiatan', 58, currentY + 4.5);
    doc.text('Nama Kegiatan & Rincian Deskripsi', 88, currentY + 4.5);
    doc.text('Sasaran', 146, currentY + 4.5);
    doc.text('Hasil/Status', 171, currentY + 4.5);

    currentY += 7;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);

    allEntriesToRender.forEach((v, index) => {
      // Human friendly date string
      const formattedD = formatIndonesianDate(v.date);
      const dateAndTime = `${formattedD}\n${v.time}`;
      const splitDateAndTime = doc.splitTextToSize(dateAndTime, 33);

      const splitType = doc.splitTextToSize(v.type || '-', 27);
      const titleAndDesc = `${v.title}\n\nDetail: ${v.notes || '-'}`;
      const splitTitleDesc = doc.splitTextToSize(titleAndDesc, 55);
      const splitTarget = doc.splitTextToSize(v.target || '-', 23);
      const splitOutcome = doc.splitTextToSize(`[${v.status}]`, 22);

      const maxLines = Math.max(splitDateAndTime.length, splitType.length, splitTitleDesc.length, splitTarget.length, splitOutcome.length);
      const rowHeight = Math.max(10, maxLines * 3.3 + 4);

      checkPageBreak(rowHeight);

      // Alternate row colors
      if (index % 2 === 1) {
        doc.setFillColor(248, 249, 249);
        doc.rect(15, currentY, 180, rowHeight, 'F');
      }

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`${index + 1}`, 17, currentY + 4.5);
      
      // Multiline columns
      doc.text(splitDateAndTime, 23, currentY + 4.5);
      doc.text(splitType, 58, currentY + 4.5);
      doc.text(splitTitleDesc, 88, currentY + 4.5);
      doc.text(splitTarget, 146, currentY + 4.5);
      doc.text(splitOutcome, 171, currentY + 4.5);

      // Draw thin separator line
      doc.setDrawColor(220, 225, 225);
      doc.setLineWidth(0.1);
      doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

      currentY += rowHeight;
    });
  }

  // III. SIGNATURES
  const signatureHeight = 45;
  checkPageBreak(signatureHeight);

  const finalY = currentY + 12;
  const config = getSchoolConfig();

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  doc.text('Mengetahui,', 20, finalY);
  doc.text('Kepala Sekolah,', 20, finalY + 5);
  doc.setFont('Helvetica', 'bold');
  doc.text(config.principalName, 20, finalY + 27);
  doc.setFont('Helvetica', 'normal');
  doc.text(`NIP. ${config.principalNip}`, 20, finalY + 32);

  doc.text('Guru Bimbingan & Konseling,', 130, finalY + 5);
  doc.setFont('Helvetica', 'bold');
  doc.text(counselor.name, 130, finalY + 27);
  doc.setFont('Helvetica', 'normal');
  doc.text(counselor.nip && counselor.nip !== '-' ? counselor.nip : 'NIP. -', 130, finalY + 32);

  // Footer metadata
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 130, 130);
  doc.text(`Dicetak otomatis melalui Portal BK ${config.schoolName} pada ${formatIndonesianDate(new Date().toISOString())}`, 15, 282);

  // Save PDF file
  doc.save(`Rekap_Jurnal_Harian_BK_${startDate}_to_${endDate}_${counselor.name.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generates an official Parent Summon Letter (Surat Panggilan Orang Tua) PDF.
 */
export function downloadParentSummonPDF(summon: any, counselor: any) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [11, 28, 48]; // #0b1c30
  const tealColor = [0, 104, 95]; // #00685f

  // 1. Draw Kop Surat / Letterhead
  drawLetterhead(doc, tealColor);

  let currentY = 43;

  // 2. Place Letter Date (Tanggal Surat) on the right, aligned with meta info on the left
  const schoolConfig = getSchoolConfig();
  const rawAddressParts = schoolConfig.schoolAddress.split(',');
  const city = rawAddressParts.find(p => p.trim().startsWith('Kab.') || p.trim().startsWith('Kec.') || p.trim().includes('Semarang')) || 'Semarang';
  const cleanCity = city.replace('Kab.', '').replace('Kec.', '').trim();

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`${cleanCity}, ${formatIndonesianDate(summon.date)}`, 195, currentY, { align: 'right' });

  // 3. Meta info on the left: Nomor, Lampiran, Hal
  doc.text(`Nomor    : ${summon.letterNumber}`, 15, currentY);
  doc.text('Lampiran : -', 15, currentY + 5);
  doc.setFont('Helvetica', 'bold');
  doc.text(`Perihal    : Panggilan Orang Tua / Wali Murid`, 15, currentY + 10);

  currentY += 20;

  // 4. Address to recipient (Kepada Yth. Bapak/Ibu Orang Tua/Wali...)
  doc.setFont('Helvetica', 'normal');
  doc.text('Kepada Yth.', 15, currentY);
  doc.setFont('Helvetica', 'bold');
  doc.text(`Bapak / Ibu Orang Tua / Wali dari ${summon.studentName}`, 15, currentY + 5);
  doc.setFont('Helvetica', 'normal');
  doc.text(`Siswa Kelas ${summon.studentClass}`, 15, currentY + 10);
  doc.text('di tempat', 15, currentY + 15);

  currentY += 27;

  // 5. Opening Salutation
  doc.text('Dengan hormat,', 15, currentY);
  
  // 6. Body Paragraph 1
  currentY += 7;
  const bodyText1 = `Sehubungan dengan diperlukannya koordinasi dan konsultasi bersama antara pihak sekolah dengan orang tua/wali murid guna mendukung perkembangan belajar, kedisiplinan, serta bimbingan putra/putri Bapak/Ibu, maka kami mengharapkan kehadiran Bapak/Ibu pada:`;
  const splitBodyText1 = doc.splitTextToSize(bodyText1, 180);
  doc.text(splitBodyText1, 15, currentY);

  currentY += splitBodyText1.length * 5 + 4;

  // 7. Meeting Schedule Details in clean indents
  doc.setFont('Helvetica', 'bold');
  doc.text('Hari, Tanggal', 25, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.text(`:  ${formatIndonesianDate(summon.summonDate)}`, 60, currentY);

  currentY += 6;
  doc.setFont('Helvetica', 'bold');
  doc.text('Waktu', 25, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.text(`:  ${summon.summonTime} WIB s.d. Selesai`, 60, currentY);

  currentY += 6;
  doc.setFont('Helvetica', 'bold');
  doc.text('Tempat', 25, currentY);
  doc.setFont('Helvetica', 'normal');
  const tempatLines = doc.splitTextToSize(`:  ${summon.summonPlace}`, 135);
  doc.text(tempatLines, 60, currentY);

  currentY += tempatLines.length * 5 + 1;
  doc.setFont('Helvetica', 'bold');
  doc.text('Acara', 25, currentY);
  const agendaLines = doc.splitTextToSize(`:  ${summon.agenda}`, 135);
  doc.text(agendaLines, 60, currentY);

  currentY += agendaLines.length * 5 + 8;

  // 8. Body Paragraph 2
  doc.setFont('Helvetica', 'normal');
  const bodyText2 = `Mengingat pentingnya koordinasi bimbingan ini demi kebaikan dan kelancaran proses pendidikan putra/putri Bapak/Ibu di sekolah, kami sangat mengharapkan kehadiran Bapak/Ibu tepat pada waktu yang telah ditentukan.`;
  const splitBodyText2 = doc.splitTextToSize(bodyText2, 180);
  doc.text(splitBodyText2, 15, currentY);

  currentY += splitBodyText2.length * 5 + 3;

  // 9. Closing Salutation
  const closingText = `Demikian surat panggilan ini kami sampaikan, atas perhatian, kehadiran, dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.`;
  const splitClosingText = doc.splitTextToSize(closingText, 180);
  doc.text(splitClosingText, 15, currentY);

  currentY += splitClosingText.length * 5 + 15;

  // 10. Signatures
  doc.text('Guru Bimbingan & Konseling,', 130, currentY + 5);
  doc.setFont('Helvetica', 'bold');
  doc.text(counselor.name, 130, currentY + 28);
  doc.setFont('Helvetica', 'normal');
  doc.text(counselor.nip && counselor.nip !== '-' ? `NIP. ${counselor.nip}` : 'NIP. -', 130, currentY + 33);

  // Footer metadata
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 130, 130);
  doc.text(`Surat Resmi ini dicetak secara digital melalui Portal BK ${schoolConfig.schoolName} pada ${formatIndonesianDate(new Date().toISOString())}`, 15, 282);

  // Save PDF
  doc.save(`Surat_Panggilan_Orang_Tua_${summon.letterNumber.replace(/\//g, '_')}_${summon.studentName.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generates an official Berita Acara / Notulen Kehadiran Orang Tua PDF.
 */
export function downloadParentAttendancePDF(summon: any, counselor: any) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [11, 28, 48]; // #0b1c30
  const tealColor = [0, 104, 95]; // #00685f
  const att = summon.attendanceDetails || {};

  // 1. Kop Surat
  drawLetterhead(doc, tealColor);

  let currentY = 43;
  const schoolConfig = getSchoolConfig();

  // Document Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('BERITA ACARA & NOTULEN HASIL PERTEMUAN ORANG TUA / WALI MURID', 105, currentY, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.text(`Lampiran Surat Panggilan No: ${summon.letterNumber}`, 105, currentY + 5, { align: 'center' });

  currentY += 12;

  // Section 1: Data Identitas Pertemuan
  doc.setFillColor(240, 248, 246);
  doc.rect(15, currentY, 180, 7, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.text('I. IDENTITAS PELAKSANAAN PERTEMUAN', 18, currentY + 5);

  currentY += 10;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  doc.text(`Hari / Tanggal Realisasi  : ${formatIndonesianDate(att.actualDate || summon.summonDate)}`, 18, currentY);
  doc.text(`Waktu Pelaksanaan       : ${att.actualTime || summon.summonTime} WIB`, 18, currentY + 5);
  doc.text(`Tempat                   : ${summon.summonPlace || 'Ruang Bimbingan Konseling'}`, 18, currentY + 10);
  doc.text(`Konselor BK / Petugas   : ${att.counselorName || counselor.name}`, 18, currentY + 15);

  currentY += 23;

  // Section 2: Data Siswa & Orang Tua / Wali
  doc.setFillColor(240, 248, 246);
  doc.rect(15, currentY, 180, 7, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.text('II. IDENTITAS SISWA DAN ORANG TUA / WALI MURID', 18, currentY + 5);

  currentY += 10;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  doc.text(`Nama Siswa           : ${summon.studentName}`, 18, currentY);
  doc.text(`Kelas / NISN         : Kelas ${summon.studentClass} (NISN: ${summon.studentNis || '-'})`, 18, currentY + 5);
  doc.text(`Nama Orang Tua/Wali : ${att.attendeeName || summon.parentName}`, 18, currentY + 10);
  doc.text(`Hubungan dgn Siswa   : ${att.attendeeRelation || 'Orang Tua / Wali Murid'}`, 18, currentY + 15);
  doc.text(`No. Telepon / WA     : ${att.phone || '-'}`, 18, currentY + 20);

  currentY += 28;

  // Section 3: Ringkasan Pembahasan & Pokok Masalah
  doc.setFillColor(240, 248, 246);
  doc.rect(15, currentY, 180, 7, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.text('III. POKOK PERMASALAHAN & HASIL DISKUSI', 18, currentY + 5);

  currentY += 10;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('A. Agenda & Pokok Pembahasan:', 18, currentY);
  doc.setFont('Helvetica', 'normal');
  const splitIssues = doc.splitTextToSize(att.issuesDiscussed || summon.agenda, 175);
  doc.text(splitIssues, 18, currentY + 4);

  currentY += splitIssues.length * 4.5 + 6;

  doc.setFont('Helvetica', 'bold');
  doc.text('B. Hasil Kesepakatan & Solusi Bersama:', 18, currentY);
  doc.setFont('Helvetica', 'normal');
  const splitAgreements = doc.splitTextToSize(att.agreements || 'Siswa dan Orang Tua menyepakati langkah-langkah perbaikan perilaku dan disiplin di rumah maupun di sekolah.', 175);
  doc.text(splitAgreements, 18, currentY + 4);

  currentY += splitAgreements.length * 4.5 + 8;

  // Section 4: Komitmen & Rencana Tindak Lanjut
  doc.setFillColor(240, 248, 246);
  doc.rect(15, currentY, 180, 7, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.text('IV. KOMITMEN BERSAMA & RENCANA TINDAK LANJUT (RTL)', 18, currentY + 5);

  currentY += 10;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('1. Komitmen Orang Tua / Wali:', 18, currentY);
  doc.setFont('Helvetica', 'normal');
  const splitParentCom = doc.splitTextToSize(att.parentCommitment || 'Orang tua bersedia memantau dan membimbing kegiatan belajar serta disiplin anak di rumah secara berkelanjutan.', 175);
  doc.text(splitParentCom, 18, currentY + 4);

  currentY += splitParentCom.length * 4.5 + 5;

  doc.setFont('Helvetica', 'bold');
  doc.text('2. Komitmen & Janji Siswa:', 18, currentY);
  doc.setFont('Helvetica', 'normal');
  const splitStudentCom = doc.splitTextToSize(att.studentCommitment || 'Siswa berjanji tidak akan mengulangi kesalahan dan bersedia mentaati seluruh tata tertib sekolah.', 175);
  doc.text(splitStudentCom, 18, currentY + 4);

  currentY += splitStudentCom.length * 4.5 + 5;

  doc.setFont('Helvetica', 'bold');
  doc.text('3. Rencana Tindak Lanjut & Evaluasi BK:', 18, currentY);
  doc.setFont('Helvetica', 'normal');
  const splitFollowUp = doc.splitTextToSize(att.followUpPlan || 'Guru BK akan melakukan pemantauan berkala dalam 2 minggu ke depan dan memberikan laporan perkembangan kepada wali kelas.', 175);
  doc.text(splitFollowUp, 18, currentY + 4);

  currentY += splitFollowUp.length * 4.5 + 12;

  // Signatures
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Orang Tua / Wali Murid,', 25, currentY);
  doc.text('Guru Bimbingan & Konseling,', 125, currentY);

  // Render touch signatures if available
  if (att.parentSignatureBase64) {
    try {
      doc.addImage(att.parentSignatureBase64, 'PNG', 22, currentY + 3, 35, 16);
    } catch (e) {
      console.error('Error adding parent signature image:', e);
    }
  }

  if (att.counselorSignatureBase64) {
    try {
      doc.addImage(att.counselorSignatureBase64, 'PNG', 122, currentY + 3, 35, 16);
    } catch (e) {
      console.error('Error adding counselor signature image:', e);
    }
  }

  currentY += 22;
  doc.setFont('Helvetica', 'bold');
  doc.text(att.attendeeName || summon.parentName, 25, currentY);
  doc.text(counselor.name, 125, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Tanda Tangan / Nama Terang', 25, currentY + 4);
  doc.text(counselor.nip && counselor.nip !== '-' ? `NIP. ${counselor.nip}` : 'NIP. -', 125, currentY + 4);

  // Footer metadata
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 130, 130);
  doc.text(`Dokumen Resmi Berita Acara Kehadiran Orang Tua - ${schoolConfig.schoolName} (${formatIndonesianDate(att.actualDate || summon.summonDate)})`, 15, 282);

  // Save PDF
  doc.save(`Berita_Acara_Kehadiran_OrangTua_${summon.studentName.replace(/\s+/g, '_')}_${summon.letterNumber.replace(/\//g, '_')}.pdf`);
}

// Utility to format Date into concise, clean Indonesian format (e.g., "27 Juli 2026" or "27 Juli 2026, 08:30 WIB")
export function formatIndonesianDate(dateStr: string, includeDayName: boolean = false): string {
  try {
    if (!dateStr) return '-';
    const cleanStr = String(dateStr).trim();

    // Check if YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      const [y, m, d] = cleanStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const monthName = months[m - 1] || '';
      let res = `${d} ${monthName} ${y}`;
      if (includeDayName) {
        res = `${days[dateObj.getDay()]}, ${res}`;
      }
      return res;
    }

    const dateObj = new Date(cleanStr);
    if (isNaN(dateObj.getTime())) return dateStr;

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const dateNum = dateObj.getDate();
    const monthName = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();

    let formatted = `${dateNum} ${monthName} ${year}`;
    if (includeDayName) {
      formatted = `${days[dateObj.getDay()]}, ${formatted}`;
    }

    // Append clean time if present in timestamp
    if (cleanStr.includes('T') || (cleanStr.includes(':') && !cleanStr.startsWith('http'))) {
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      if (hours !== '00' || minutes !== '00') {
        formatted += `, ${hours}:${minutes} WIB`;
      }
    }

    return formatted;
  } catch (e) {
    return dateStr;
  }
}

// Helper to format date & time together neatly for records and official documents
export function formatRecordDateTime(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return '-';
  const formattedDate = formatIndonesianDate(dateStr);
  if (timeStr && timeStr.trim()) {
    const cleanTime = timeStr.replace(/WIB/i, '').trim();
    return `${formattedDate}, ${cleanTime} WIB`;
  }
  return formattedDate;
}

// Export Class Analytics & Counseling History PDF Report
export function downloadClassAnalyticsPDF(
  filterClass: string,
  students: Student[],
  violations: ViolationRecord[],
  services: CounselingService[],
  achievements: StudentAchievement[],
  counselorName: string
) {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const schoolConfig = getSchoolConfig();

  // Draw Letterhead
  drawLetterhead(doc, [0, 104, 95]);

  // Title Box
  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(0, 104, 95);
  doc.setLineWidth(0.5);
  doc.roundedRect(15, 38, 180, 15, 2, 2, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 104, 95);
  doc.text('LAPORAN ANALITIK TREN PERILAKU & RIWAYAT KONSELING SISWA', 105, 45, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(50, 60, 60);
  doc.text(`Filter Kelas: ${filterClass} | Tanggal Cetak: ${formatIndonesianDate(new Date().toISOString())}`, 105, 50, { align: 'center' });

  // Filter Data
  const classStudents = filterClass === 'Semua Kelas' ? students : students.filter(s => s.class === filterClass);
  const classViolations = filterClass === 'Semua Kelas' ? violations : violations.filter(v => v.studentClass === filterClass);
  const classServices = filterClass === 'Semua Kelas' ? services : services.filter(s => s.students.some(st => st.class === filterClass));
  const classAchievements = filterClass === 'Semua Kelas' ? achievements : achievements.filter(a => a.studentClass === filterClass);

  const totalSiswa = classStudents.length;
  const totalViolations = classViolations.length;
  const totalServices = classServices.length;
  const totalAchievements = classAchievements.length;
  const resolvedViolations = classViolations.filter(v => v.handledBy && v.handledBy !== 'Belum Ditangani').length;
  const restitutionRate = totalViolations > 0 ? Math.round((resolvedViolations / totalViolations) * 100) : 100;

  // Overview Stats Box
  let currentY = 58;
  doc.setFillColor(240, 247, 245);
  doc.roundedRect(15, currentY, 180, 22, 2, 2, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(11, 28, 48);
  doc.text(`Total Siswa: ${totalSiswa} Siswa`, 20, currentY + 7);
  doc.text(`Restitusi Perilaku: ${totalViolations} Kasus`, 20, currentY + 15);

  doc.text(`Konseling BK: ${totalServices} Layanan`, 80, currentY + 7);
  doc.text(`Apresiasi & Prestasi: ${totalAchievements} Catatan`, 80, currentY + 15);

  doc.text(`Tingkat Restitusi Selesai: ${restitutionRate}%`, 140, currentY + 7);
  doc.text(`Konselor: ${counselorName}`, 140, currentY + 15);

  currentY += 28;

  // History Records Table Header
  doc.setFillColor(0, 104, 95);
  doc.rect(15, currentY, 180, 7, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('NO', 18, currentY + 5);
  doc.text('TANGGAL', 26, currentY + 5);
  doc.text('NAMA SISWA', 52, currentY + 5);
  doc.text('KELAS', 92, currentY + 5);
  doc.text('KATEGORI / LAYANAN', 108, currentY + 5);
  doc.text('STATUS / PENANGANAN', 158, currentY + 5);

  currentY += 7;

  // Combined History Records
  const combinedHistory = [
    ...classViolations.map(v => ({
      date: v.date,
      studentName: v.studentName,
      studentClass: v.studentClass,
      category: `[Restitusi] ${v.category}`,
      status: v.handledBy && v.handledBy !== 'Belum Ditangani' ? `Selesai (${v.handledBy})` : 'Dalam Proses',
      type: 'violation'
    })),
    ...classServices.map(s => ({
      date: s.date,
      studentName: s.students.map(st => st.name).join(', '),
      studentClass: s.students.map(st => st.class).join(', '),
      category: `[Konseling] ${s.serviceType}`,
      status: s.status,
      type: 'service'
    })),
    ...classAchievements.map(a => ({
      date: a.date,
      studentName: a.studentName,
      studentClass: a.studentClass,
      category: `[Apresiasi] ${a.achievementName}`,
      status: `+${a.pointsReward} Bobot`,
      type: 'achievement'
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);

  if (combinedHistory.length === 0) {
    doc.setTextColor(100, 100, 100);
    doc.text('Belum ada catatan riwayat konseling / perilaku untuk kriteria kelas ini.', 105, currentY + 8, { align: 'center' });
    currentY += 15;
  } else {
    combinedHistory.slice(0, 22).forEach((item, index) => {
      if (currentY > 255) {
        doc.addPage();
        drawLetterhead(doc, [0, 104, 95]);
        currentY = 40;
      }

      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 249);
        doc.rect(15, currentY, 180, 6, 'F');
      }

      doc.setTextColor(30, 40, 50);
      doc.text(String(index + 1), 18, currentY + 4.5);
      doc.text(item.date || '-', 26, currentY + 4.5);
      doc.text(item.studentName.slice(0, 22), 52, currentY + 4.5);
      doc.text(item.studentClass.slice(0, 8), 92, currentY + 4.5);
      doc.text(item.category.slice(0, 32), 108, currentY + 4.5);
      doc.text(item.status.slice(0, 20), 158, currentY + 4.5);

      currentY += 6;
    });
  }

  // Signatures
  if (currentY > 235) {
    doc.addPage();
    drawLetterhead(doc, [0, 104, 95]);
    currentY = 40;
  } else {
    currentY += 12;
  }

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(11, 28, 48);
  doc.text(`Susukan, ${formatIndonesianDate(new Date().toISOString())}`, 135, currentY);
  doc.text('Guru Bimbingan & Konseling,', 135, currentY + 5);
  doc.text('Mengetahui, Kepala Sekolah', 20, currentY + 5);

  currentY += 22;
  doc.setFont('Helvetica', 'bold');
  doc.text(schoolConfig.principalName, 20, currentY);
  doc.text(counselorName, 135, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`NIP. ${schoolConfig.principalNip}`, 20, currentY + 4);

  // Footer
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 130, 130);
  doc.text(`Dokumen Laporan Resmi Analitik BK - ${schoolConfig.schoolName}`, 15, 285);

  doc.save(`Laporan_Analitik_BK_Kelas_${filterClass.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
}

// Export Surat Perjanjian Siswa & Orang Tua PDF
export function downloadAgreementPDF(
  record: SuratPerjanjianRecord,
  counselor: Counselor
) {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const schoolConfig = getSchoolConfig();

  drawLetterhead(doc, [186, 26, 26]); // Deep Red Accent for discipline agreement

  let currentY = 38;

  // Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(186, 26, 26);
  doc.text('SURAT PERJANJIAN PEMBINAAN DISIPLIN SISWA', 105, currentY, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setTextColor(50, 60, 60);
  doc.text(`Nomor Surat: ${record.letterNumber}`, 105, currentY + 5, { align: 'center' });

  currentY += 12;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(20, 30, 40);
  doc.text('Yang bertanda tangan di bawah ini:', 15, currentY);

  currentY += 6;

  // Student Details Box
  doc.setFillColor(252, 242, 242);
  doc.roundedRect(15, currentY, 180, 32, 2, 2, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.text('1. NAMA SISWA', 20, currentY + 6);
  doc.setFont('Helvetica', 'normal');
  doc.text(`: ${record.studentName}`, 60, currentY + 6);

  doc.setFont('Helvetica', 'bold');
  doc.text('2. NISN / KELAS', 20, currentY + 12);
  doc.setFont('Helvetica', 'normal');
  doc.text(`: ${record.studentNis} / Kelas ${record.studentClass}`, 60, currentY + 12);

  doc.setFont('Helvetica', 'bold');
  doc.text('3. NAMA ORANG TUA/WALI', 20, currentY + 18);
  doc.setFont('Helvetica', 'normal');
  doc.text(`: ${record.parentName}`, 60, currentY + 18);

  doc.setFont('Helvetica', 'bold');
  doc.text('4. PERMASALAHAN / PERILAKU', 20, currentY + 24);
  doc.setFont('Helvetica', 'normal');
  const splitSummary = doc.splitTextToSize(record.violationSummary || '-', 130);
  doc.text(`: ${splitSummary[0]}`, 60, currentY + 24);

  currentY += 38;

  doc.setFont('Helvetica', 'bold');
  doc.text('Dengan ini menyatakan setulus hati dan berjanji secara sungguh-sungguh untuk:', 15, currentY);

  currentY += 6;

  // Agreement Points
  record.agreementPoints.forEach((pt, idx) => {
    doc.setFont('Helvetica', 'normal');
    const splitPt = doc.splitTextToSize(`${idx + 1}. ${pt}`, 170);
    doc.text(splitPt, 20, currentY);
    currentY += splitPt.length * 5;
  });

  currentY += 4;
  doc.setFont('Helvetica', 'bold');
  doc.text('Konsekuensi / Sanksi Kesepakatan Apabila Melanggar Perjanjian:', 15, currentY);
  currentY += 5;
  doc.setFont('Helvetica', 'normal');
  const splitSanksi = doc.splitTextToSize(record.consequences || 'Siswa bersedia menerima sanksi skorsing / dikembalikan kepada orang tua sesuai aturan tata tertib sekolah.', 175);
  doc.text(splitSanksi, 20, currentY);

  currentY += splitSanksi.length * 5 + 10;

  doc.text('Demikian surat perjanjian ini dibuat dengan penuh kesadaran dan tanpa paksaan dari pihak manapun.', 15, currentY);

  currentY += 12;

  if (currentY + 40 > 275) {
    doc.addPage();
    drawLetterhead(doc, [186, 26, 26]);
    currentY = 45;
  }

  // Signatures 3 Columns (Siswa, Orang Tua, Guru BK)
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Siswa Yang Berjanji,', 20, currentY);
  doc.text('Orang Tua / Wali Murid,', 85, currentY);
  doc.text('Guru Bimbingan & Konseling,', 145, currentY);

  // Render Signatures if available
  if (record.studentSignatureBase64) {
    try { doc.addImage(record.studentSignatureBase64, 'PNG', 18, currentY + 3, 30, 14); } catch (e) {}
  }
  if (record.parentSignatureBase64) {
    try { doc.addImage(record.parentSignatureBase64, 'PNG', 83, currentY + 3, 30, 14); } catch (e) {}
  }
  if (record.counselorSignatureBase64) {
    try { doc.addImage(record.counselorSignatureBase64, 'PNG', 143, currentY + 3, 30, 14); } catch (e) {}
  }

  currentY += 20;
  doc.setFont('Helvetica', 'bold');
  doc.text(record.studentName, 20, currentY);
  doc.text(record.parentName, 85, currentY);
  doc.text(counselor.name, 145, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Tanggal: ${formatIndonesianDate(record.date)}`, 20, currentY + 4);
  doc.text(`Tanda Tangan Ortu`, 85, currentY + 4);
  doc.text(`NIP. ${counselor.nip || '-'}`, 145, currentY + 4);

  // Footer
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(120, 130, 130);
  doc.text(`Surat Perjanjian Resmi Pembinaan Disiplin Siswa - ${schoolConfig.schoolName}`, 15, 285);

  doc.save(`Surat_Perjanjian_${record.letterNumber.replace(/\//g, '_')}_${record.studentName.replace(/\s+/g, '_')}.pdf`);
}

// Export Kontrak Perilaku (Behavioral Contract) PDF
export function downloadBehaviorContractPDF(
  contract: KontrakPerilakuRecord,
  counselor: Counselor
) {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const schoolConfig = getSchoolConfig();

  drawLetterhead(doc, [0, 104, 95]); // Teal Accent

  let currentY = 38;

  // Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 104, 95);
  doc.text('KONTRAK PERILAKU POSITIF (BEHAVIORAL CONTRACT)', 105, currentY, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(50, 60, 60);
  doc.text(`Nomor Kontrak: ${contract.contractNumber} | Durasi: ${contract.startDate} s.d ${contract.endDate} (${contract.reviewPeriod})`, 105, currentY + 5, { align: 'center' });

  currentY += 12;

  // Student Box
  doc.setFillColor(240, 247, 245);
  doc.roundedRect(15, currentY, 180, 24, 2, 2, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(11, 28, 48);
  doc.text(`Siswa: ${contract.studentName} (${contract.studentClass})`, 20, currentY + 6);
  doc.text(`NISN: ${contract.studentNis}`, 20, currentY + 12);
  doc.text(`Evaluator / Pendamping: ${contract.evaluator}`, 20, currentY + 18);

  currentY += 28;

  doc.setFont('Helvetica', 'bold');
  doc.text('1. Perilaku Sasaran Yang Ingin Diubah / Ditingkatkan:', 15, currentY);
  currentY += 5;
  doc.setFont('Helvetica', 'normal');
  const splitTarget = doc.splitTextToSize(contract.targetBehavior || '-', 170);
  doc.text(splitTarget, 20, currentY);
  currentY += splitTarget.length * 5 + 3;

  doc.setFont('Helvetica', 'bold');
  doc.text('2. Komitmen Perilaku Positif Yang Disepakati Siswa:', 15, currentY);
  currentY += 5;

  contract.agreedPositiveBehaviors.forEach((pt, idx) => {
    doc.setFont('Helvetica', 'normal');
    const splitPt = doc.splitTextToSize(`[✓] ${pt}`, 170);
    doc.text(splitPt, 20, currentY);
    currentY += splitPt.length * 5;
  });

  currentY += 4;
  doc.setFont('Helvetica', 'bold');
  doc.text('3. Imbalan / Apresiasi Jika Berhasil Memenuhi Kontrak (Reward):', 15, currentY);
  currentY += 5;
  doc.setFont('Helvetica', 'normal');
  const splitRewards = doc.splitTextToSize(contract.rewards || '-', 170);
  doc.text(splitRewards, 20, currentY);
  currentY += splitRewards.length * 5 + 3;

  doc.setFont('Helvetica', 'bold');
  doc.text('4. Konsekuensi Jika Tidak Memenuhi Kontrak (Sanction):', 15, currentY);
  currentY += 5;
  doc.setFont('Helvetica', 'normal');
  const splitSanctions = doc.splitTextToSize(contract.sanctions || '-', 170);
  doc.text(splitSanctions, 20, currentY);
  currentY += splitSanctions.length * 5 + 8;

  if (currentY + 40 > 275) {
    doc.addPage();
    drawLetterhead(doc, [0, 104, 95]);
    currentY = 45;
  }

  // Signatures
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Siswa Pembuat Kontrak,', 25, currentY);
  doc.text('Guru Bimbingan & Konseling,', 125, currentY);

  if (contract.studentSignatureBase64) {
    try { doc.addImage(contract.studentSignatureBase64, 'PNG', 23, currentY + 3, 30, 14); } catch (e) {}
  }
  if (contract.counselorSignatureBase64) {
    try { doc.addImage(contract.counselorSignatureBase64, 'PNG', 123, currentY + 3, 30, 14); } catch (e) {}
  }

  currentY += 20;
  doc.setFont('Helvetica', 'bold');
  doc.text(contract.studentName, 25, currentY);
  doc.text(counselor.name, 125, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Tanggal: ${formatIndonesianDate(contract.startDate)}`, 25, currentY + 4);
  doc.text(`NIP. ${counselor.nip || '-'}`, 125, currentY + 4);

  // Footer
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(120, 130, 130);
  doc.text(`Kontrak Perilaku Positif Siswa - ${schoolConfig.schoolName}`, 15, 285);

  doc.save(`Kontrak_Perilaku_${contract.contractNumber.replace(/\//g, '_')}_${contract.studentName.replace(/\s+/g, '_')}.pdf`);
}

export interface PeriodicReportOptions {
  startDate: string;
  endDate: string;
  selectedClass: string;
  periodServices: CounselingService[];
  periodViolations: ViolationRecord[];
  criticalStudentsList: {
    student: Student;
    netPoints: number;
    alpaCount: number;
    riskLevel: 'Kritis' | 'Tinggi' | 'Sedang';
    latestViolation: string;
  }[];
  stats: {
    totalServices: number;
    completedServices: number;
    scheduledServices: number;
    totalViolationsCount: number;
    totalViolationPoints: number;
    individualCount: number;
    groupCount: number;
    classicalCount: number;
    totalHomeVisitsCount: number;
    uniqueStudentsCount: number;
    criticalStudentsCount: number;
  };
  activeCounselor: Counselor;
}

export function downloadPeriodicReportPDF(options: PeriodicReportOptions) {
  const {
    startDate,
    endDate,
    selectedClass,
    periodServices,
    periodViolations,
    criticalStudentsList,
    stats,
    activeCounselor
  } = options;

  const schoolConfig = getSchoolConfig();
  const doc = new jsPDF('p', 'mm', 'a4');
  const primaryTeal = [0, 104, 95];
  const darkSlate = [11, 28, 48];

  // Draw Letterhead Header
  drawLetterhead(doc, primaryTeal);

  let currentY = 48;

  // Function to check page overflow and add a new page smoothly
  const checkPageOverflow = (neededSpace: number = 15) => {
    if (currentY + neededSpace > 270) {
      doc.addPage();
      currentY = 20;

      // Top thin accent line on sub-pages
      doc.setDrawColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
      doc.setLineWidth(0.8);
      doc.line(15, 12, 195, 12);

      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 110);
      doc.text(`Laporan Rekapitulasi BK - ${schoolConfig.schoolName} (Lanjutan)`, 15, 16);
      currentY = 24;
    }
  };

  // Report Document Title Block
  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(188, 201, 198);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, currentY, 180, 22, 2, 2, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('LAPORAN REKAPITULASI BIMBINGAN DAN KONSELING', 105, currentY + 7, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(61, 73, 71);
  const classLabel = selectedClass === 'semua' ? 'Semua Kelas' : `Kelas ${selectedClass}`;
  doc.text(`Periode: ${formatIndonesianDate(startDate)} s.d. ${formatIndonesianDate(endDate)}  |  Lingkup: ${classLabel}`, 105, currentY + 13, { align: 'center' });
  doc.text(`Konselor / Guru Pembimbing: ${activeCounselor.name}`, 105, currentY + 18, { align: 'center' });

  currentY += 28;

  // BAGIAN I: RINGKASAN & STATISTIK
  doc.setFillColor(0, 104, 95);
  doc.rect(15, currentY, 180, 6, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('I. RINGKASAN EKSEKUTIF & STATISTIK LAYANAN', 18, currentY + 4.2);

  currentY += 9;

  // KPI Table Box
  doc.setFillColor(250, 252, 252);
  doc.setDrawColor(220, 230, 228);
  doc.roundedRect(15, currentY, 180, 22, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

  // Col 1: Sesi Layanan
  doc.setFont('Helvetica', 'bold');
  doc.text('Total Sesi Layanan BK:', 20, currentY + 6);
  doc.setFont('Helvetica', 'normal');
  doc.text(`${stats.totalServices} Sesi (${stats.completedServices} Selesai, ${stats.scheduledServices} Terjadwal)`, 20, currentY + 11);
  doc.text(`Siswa Terlayani: ${stats.uniqueStudentsCount} Siswa`, 20, currentY + 16);

  // Col 2: Pelanggaran & Disiplin
  doc.setFont('Helvetica', 'bold');
  doc.text('Catatan Pelanggaran:', 82, currentY + 6);
  doc.setFont('Helvetica', 'normal');
  doc.text(`${stats.totalViolationsCount} Kasus (${stats.totalViolationPoints} Bobot)`, 82, currentY + 11);
  doc.text(`Kunjungan Rumah: ${stats.totalHomeVisitsCount} Kali`, 82, currentY + 16);

  // Col 3: Siswa Kritis
  doc.setFont('Helvetica', 'bold');
  doc.text('Status Perhatian Khusus:', 145, currentY + 6);
  doc.setFont('Helvetica', 'normal');
  doc.text(`${stats.criticalStudentsCount} Siswa Terdeteksi`, 145, currentY + 11);
  doc.text(`Individual: ${stats.individualCount} | Kelompok: ${stats.groupCount}`, 145, currentY + 16);

  currentY += 28;

  // BAGIAN II: DAFTAR SISWA MEMERLUKAN PERHATIAN KHUSUS / KRITIS
  checkPageOverflow(30);

  doc.setFillColor(0, 104, 95);
  doc.rect(15, currentY, 180, 6, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('II. DAFTAR SISWA MEMERLUKAN PERHATIAN KHUSUS ATAL KRITIS', 18, currentY + 4.2);

  currentY += 9;

  if (criticalStudentsList.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 110, 110);
    doc.text('Tidak terdapat siswa yang mencapai ambang batas status kritis/perhatian khusus pada periode ini.', 18, currentY);
    currentY += 8;
  } else {
    // Table Header
    doc.setFillColor(235, 242, 240);
    doc.rect(15, currentY, 180, 6, 'F');
    doc.setDrawColor(200, 215, 210);
    doc.line(15, currentY + 6, 195, currentY + 6);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.text('No', 18, currentY + 4);
    doc.text('Nama Siswa', 26, currentY + 4);
    doc.text('Kelas', 78, currentY + 4);
    doc.text('Bobot Net', 98, currentY + 4);
    doc.text('Tot. Alpa', 118, currentY + 4);
    doc.text('Tingkat Risiko', 136, currentY + 4);
    doc.text('Kasus Terakhir', 164, currentY + 4);

    currentY += 6;

    criticalStudentsList.slice(0, 15).forEach((item, idx) => {
      const nameLines = doc.splitTextToSize(item.student.name || '-', 48);
      const caseLines = doc.splitTextToSize(item.latestViolation || '-', 28);
      const rowHeight = Math.max(7, nameLines.length * 3.8 + 2, caseLines.length * 3.8 + 2);

      checkPageOverflow(rowHeight);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(40, 50, 50);

      doc.text(`${idx + 1}`, 18, currentY + 4);
      doc.text(nameLines, 26, currentY + 4);
      doc.text(item.student.class || '-', 78, currentY + 4);

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(180, 30, 30);
      doc.text(`${item.netPoints}`, 98, currentY + 4);

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(40, 50, 50);
      doc.text(`${item.alpaCount > 0 ? item.alpaCount + 'x' : '-'}`, 118, currentY + 4);

      doc.setFont('Helvetica', 'bold');
      if (item.riskLevel === 'Kritis') doc.setTextColor(180, 20, 20);
      else if (item.riskLevel === 'Tinggi') doc.setTextColor(190, 90, 0);
      else doc.setTextColor(0, 100, 150);

      doc.text(item.riskLevel, 136, currentY + 4);

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(50, 60, 60);
      doc.text(caseLines, 164, currentY + 4);

      doc.setDrawColor(235, 240, 240);
      doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

      currentY += rowHeight;
    });

    currentY += 4;
  }

  // BAGIAN III: RIWAYAT CATATAN KONSELING & LAYANAN BK
  checkPageOverflow(30);

  doc.setFillColor(0, 104, 95);
  doc.rect(15, currentY, 180, 6, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('III. RIWAYAT CATATAN SESI KONSELING & LAYANAN BK', 18, currentY + 4.2);

  currentY += 9;

  if (periodServices.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 110, 110);
    doc.text('Tidak ada rekam catatan sesi konseling pada periode yang dipilih.', 18, currentY);
    currentY += 8;
  } else {
    // Table Header
    doc.setFillColor(235, 242, 240);
    doc.rect(15, currentY, 180, 6, 'F');
    doc.setDrawColor(200, 215, 210);
    doc.line(15, currentY + 6, 195, currentY + 6);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.text('No', 18, currentY + 4);
    doc.text('Tanggal', 26, currentY + 4);
    doc.text('Nama Siswa (Kelas)', 48, currentY + 4);
    doc.text('Tipe Layanan', 98, currentY + 4);
    doc.text('Topik / Permasalahan', 130, currentY + 4);
    doc.text('Status', 174, currentY + 4);

    currentY += 6;

    periodServices.slice(0, 25).forEach((srv, idx) => {
      const stNames = srv.students.map((s) => `${s.name} (${s.class})`).join(', ');
      const nameLines = doc.splitTextToSize(stNames || '-', 46);
      const typeLines = doc.splitTextToSize(srv.serviceType || '-', 30);
      const probLines = doc.splitTextToSize(srv.problem || '-', 40);
      const rowHeight = Math.max(7, nameLines.length * 3.8 + 2, typeLines.length * 3.8 + 2, probLines.length * 3.8 + 2);

      checkPageOverflow(rowHeight);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(40, 50, 50);

      doc.text(`${idx + 1}`, 18, currentY + 4);
      doc.text(srv.date, 26, currentY + 4);
      doc.text(nameLines, 48, currentY + 4);
      doc.text(typeLines, 98, currentY + 4);
      doc.text(probLines, 130, currentY + 4);

      doc.setFont('Helvetica', 'bold');
      if (srv.status === 'Selesai') doc.setTextColor(0, 120, 80);
      else if (srv.status === 'Terjadwal') doc.setTextColor(0, 90, 160);
      else doc.setTextColor(180, 40, 40);

      doc.text(srv.status, 174, currentY + 4);

      doc.setDrawColor(235, 240, 240);
      doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

      currentY += rowHeight;
    });

    currentY += 6;
  }

  // BAGIAN IV: LEMBAR PENGESAHAN & TANDA TANGAN
  checkPageOverflow(40);

  currentY += 4;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 50, 50);

  const todayFormated = formatIndonesianDate(new Date().toISOString().split('T')[0]);
  doc.text(`Dibuat di: Susukan`, 130, currentY);
  doc.text(`Pada Tanggal: ${todayFormated}`, 130, currentY + 4);

  currentY += 10;

  doc.setFont('Helvetica', 'bold');
  doc.text('Mengetahui,', 25, currentY);
  doc.text('Guru Bimbingan & Konseling,', 130, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.text('Kepala Sekolah', 25, currentY + 4);

  currentY += 22;

  // Principal Signature
  doc.setFont('Helvetica', 'bold');
  doc.text(schoolConfig.principalName, 25, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${schoolConfig.principalNip || '-'}`, 25, currentY + 4);

  // Counselor Signature
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(activeCounselor.name, 130, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${activeCounselor.nip || '-'}`, 130, currentY + 4);

  // Document Footer
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(130, 140, 140);
  doc.text(`Dokumen Resmi Laporan Rekapitulasi BK - ${schoolConfig.schoolName}`, 15, 285);

  const cleanStart = startDate.replace(/-/g, '');
  const cleanEnd = endDate.replace(/-/g, '');
  doc.save(`Laporan_Rekap_BK_${cleanStart}_sd_${cleanEnd}.pdf`);
}

export function downloadJurnalPembinaanPDF(record: JurnalPembinaanDisiplinRecord) {
  const schoolConfig = getSchoolConfig();
  const doc = new jsPDF('p', 'mm', 'a4');
  const primaryTeal = [0, 104, 95];
  const darkSlate = [11, 28, 48];

  drawLetterhead(doc, primaryTeal);

  let currentY = 48;

  // Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('JURNAL PEMBINAAN DISIPLIN & RESTITUSI BK', 105, currentY, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(61, 73, 71);
  doc.text(`Nomor Registrasi: ${record.journalNumber}  |  Tanggal: ${formatIndonesianDate(record.date)}`, 105, currentY + 5, { align: 'center' });

  currentY += 14;

  // Student Info Box
  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(188, 201, 198);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, currentY, 180, 22, 2, 2, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('IDENTITAS SISWA & KONSELOR', 20, currentY + 6);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Nama Siswa : ${record.studentName} (${record.studentClass})`, 20, currentY + 12);
  doc.text(`NISN / NIS  : ${record.studentNis || '-'}`, 20, currentY + 17);

  doc.text(`Guru BK     : ${record.counselorName}`, 110, currentY + 12);
  doc.text(`Status Form : ${record.status}`, 110, currentY + 17);

  currentY += 28;

  // Detail Sections
  const sections = [
    { title: '1. Deskripsi Permasalahan / Indisiplin', content: record.problemDescription },
    { title: '2. Pendekatan Konseling & Strategi Restitusi', content: record.counselingApproach },
    { title: '3. Kesepakatan & Solusi Restitusi Disiplin', content: record.restitutionAgreement },
    { title: '4. Rencana Evaluasi & Monitoring Berkala', content: record.evaluationPlan }
  ];

  sections.forEach((sec) => {
    doc.setFillColor(235, 242, 240);
    doc.rect(15, currentY, 180, 6, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
    doc.text(sec.title, 18, currentY + 4.2);

    currentY += 8;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 50, 50);

    const splitLines = doc.splitTextToSize(sec.content || '-', 174);
    doc.text(splitLines, 18, currentY);

    currentY += splitLines.length * 4.2 + 6;
  });

  // Signatures
  currentY = Math.max(currentY + 6, 225);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 50, 50);

  const todayStr = formatIndonesianDate(new Date().toISOString().split('T')[0]);
  doc.text(`Dibuat di: Susukan, Pada Tanggal: ${todayStr}`, 115, currentY);

  currentY += 8;
  doc.setFont('Helvetica', 'bold');
  doc.text('Siswa Bersangkutan,', 25, currentY);
  doc.text('Guru Bimbingan & Konseling,', 120, currentY);

  currentY += 20;
  doc.text(record.studentName, 25, currentY);
  doc.text(record.counselorName, 120, currentY);

  doc.save(`Jurnal_Pembinaan_BK_${record.studentName.replace(/\s+/g, '_')}.pdf`);
}

export function downloadKomitmenRtlPDF(record: KomitmenRtlRecord) {
  const schoolConfig = getSchoolConfig();
  const doc = new jsPDF('p', 'mm', 'a4');
  const primaryTeal = [0, 104, 95];
  const darkSlate = [11, 28, 48];

  drawLetterhead(doc, primaryTeal);

  let currentY = 48;

  // Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('LEMBAR KOMITMEN & RENCANA TINDAK LANJUT (RTL)', 105, currentY, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(61, 73, 71);
  doc.text(`Nomor Registrasi: ${record.commitmentNumber}  |  Tanggal: ${formatIndonesianDate(record.date)}`, 105, currentY + 5, { align: 'center' });

  currentY += 14;

  // Identity Box
  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(188, 201, 198);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, currentY, 180, 20, 2, 2, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`Nama Siswa : ${record.studentName} (${record.studentClass})`, 20, currentY + 6);
  doc.text(`NISN / NIS  : ${record.studentNis || '-'}`, 20, currentY + 12);

  doc.text(`Guru Pendamping : ${record.counselorName}`, 110, currentY + 6);
  doc.text(`Sekolah         : ${schoolConfig.schoolName}`, 110, currentY + 12);

  currentY += 26;

  // Personal Commitment
  doc.setFillColor(235, 242, 240);
  doc.rect(15, currentY, 180, 6, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.text('I. KOMITMEN PRIBADI SISWA', 18, currentY + 4.2);

  currentY += 9;
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 50, 50);

  const commLines = doc.splitTextToSize(`"${record.personalCommitment}"`, 174);
  doc.text(commLines, 18, currentY);

  currentY += commLines.length * 4.2 + 8;

  // Action Steps (RTL)
  doc.setFillColor(235, 242, 240);
  doc.rect(15, currentY, 180, 6, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.text('II. LANGKAH AKSI NYAWA / RENCANA TINDAK LANJUT (RTL)', 18, currentY + 4.2);

  currentY += 9;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 50, 50);

  record.actionSteps.forEach((step, idx) => {
    const stepLines = doc.splitTextToSize(`${idx + 1}. ${step}`, 172);
    doc.text(stepLines, 18, currentY);
    currentY += stepLines.length * 4.2 + 2;
  });

  currentY += 6;

  // Indicators & Support
  const extraSecs = [
    { title: 'III. INDIKATOR KEBERHASILAN PERUBAHAN', content: record.successIndicators },
    { title: 'IV. DUKUNGAN YANG DIBUTUHKAN', content: record.supportNeeded }
  ];

  extraSecs.forEach((sec) => {
    doc.setFillColor(235, 242, 240);
    doc.rect(15, currentY, 180, 6, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
    doc.text(sec.title, 18, currentY + 4.2);

    currentY += 8;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 50, 50);

    const lines = doc.splitTextToSize(sec.content || '-', 174);
    doc.text(lines, 18, currentY);

    currentY += lines.length * 4.2 + 6;
  });

  // Signatures
  currentY = Math.max(currentY + 6, 225);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 50, 50);

  const todayStr = formatIndonesianDate(new Date().toISOString().split('T')[0]);
  doc.text(`Dibuat di: Susukan, Pada Tanggal: ${todayStr}`, 115, currentY);

  currentY += 8;
  doc.setFont('Helvetica', 'bold');
  doc.text('Siswa Pembuat Komitmen,', 25, currentY);
  doc.text('Guru Bimbingan & Konseling,', 120, currentY);

  currentY += 20;
  doc.text(record.studentName, 25, currentY);
  doc.text(record.counselorName, 120, currentY);

  doc.save(`Komitmen_RTL_BK_${record.studentName.replace(/\s+/g, '_')}.pdf`);
}


