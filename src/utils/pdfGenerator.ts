import { jsPDF } from 'jspdf';
import { Student, ViolationRecord, CounselingService, ClassAttendanceRecord, StudentAttendance } from '../types';

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
  drawKabSemarangLogo(doc, 26, 24, 9);

  // Draw School logo on the right (X=184, Y=24, R=9)
  drawSchoolLogo(doc, 184, 24, 9);

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
  services: CounselingService[]
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
    doc.text(`Dicetak otomatis pada: ${new Date().toLocaleDateString('id-ID')} - Sifat: Rahasia`, 105, 50, { align: 'center' });

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
  doc.text(student.name, 60, currentY);

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
  doc.text(`${student.violationPoints} Poin`, 160, currentY);

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
    doc.text('Poin', 110, currentY + 4.5);
    doc.text('Keterangan / Kronologi', 125, currentY + 4.5);

    currentY += 7;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);

    violations.forEach((v, index) => {
      // split description to avoid breaking layout
      const notesLine = v.notes || '-';
      const splitNotes = doc.splitTextToSize(notesLine, 65);
      const rowHeight = Math.max(8, splitNotes.length * 4 + 2);

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
      doc.text(v.category, 80, currentY + 4.5);
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

  // III. RIWAYAT BIMBINGAN KONSELING (KONSULTASI)
  checkPageBreak(30);
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`III. RIWAYAT BIMBINGAN & KONSELING SISWA (${services.length})`, 20, currentY + 5.5);

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
      const splitProblem = doc.splitTextToSize(s.problem, 45);
      const splitFollowUp = doc.splitTextToSize(s.followUp || '-', 55);
      
      const maxTextLines = Math.max(splitProblem.length, splitFollowUp.length);
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
      doc.text(s.serviceType, 50, currentY + 4.5);
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

  // IV. REKOMENDASI GURU BK & TANDA TANGAN
  checkPageBreak(40);
  doc.setDrawColor(200, 205, 205);
  doc.setLineWidth(0.3);
  doc.line(15, currentY, 195, currentY);
  
  currentY += 7;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('IV. CATATAN DAN REKOMENDASI UMUM KONSIDERASI BK:', 15, currentY);

  currentY += 5;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  
  let generalRecommendation = '';
  if (student.violationPoints >= 100) {
    generalRecommendation = 'Siswa telah melampaui batas kritis akumulasi poin kedisiplinan (>= 100 Poin). Tindakan kedisiplinan khusus tingkat sekolah diwajibkan, termasuk pembinaan intensif khusus serta pemanggilan berkala Orang Tua/Wali bersama Kepala Sekolah.';
  } else if (student.violationPoints >= 50) {
    generalRecommendation = 'Siswa berada dalam pengawasan ketat (kategori Peringatan, >= 50 Poin). Diharapkan Guru BK dan Wali Kelas melakukan kolaborasi preventif harian untuk mencegah berulangnya pelanggaran disiplin.';
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

  doc.text('Kabupaten Semarang, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), 125, currentY);
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

  // Incident Details
  doc.setFont('Helvetica', 'normal');
  doc.text('Kategori Pelanggaran', 20, 106);
  doc.text(':', 55, 106);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(violation.category, 60, 106);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Poin Pelanggaran', 20, 112);
  doc.text(':', 55, 112);
  doc.setFont('Helvetica', 'bold');
  doc.text(`+ ${violation.pointsAdded} Poin`, 60, 112);

  doc.setFont('Helvetica', 'normal');
  doc.text('Waktu & Tanggal', 20, 118);
  doc.text(':', 55, 118);
  doc.text(`${violation.date} / Pukul ${violation.time} WIB`, 60, 118);

  doc.text('Lokasi Kejadian', 20, 124);
  doc.text(':', 55, 124);
  doc.text(violation.location, 60, 124);

  doc.text('Dilaporkan Oleh', 20, 130);
  doc.text(':', 55, 130);
  doc.text(violation.reportedBy, 60, 130);

  // Notes Section
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, 138, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('III. KETERANGAN / KRONOLOGI', 20, 143);

  doc.setFont('Helvetica', 'normal');
  const splitNotes = doc.splitTextToSize(violation.notes || 'Tidak ada keterangan tambahan.', 170);
  doc.text(splitNotes, 20, 152);

  // Signatures Section
  const footerY = 220;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Mengetahui,', 20, footerY);
  doc.text('Siswa Bersangkutan,', 20, footerY + 5);
  doc.line(20, footerY + 28, 70, footerY + 28);

  doc.text('Guru Pembimbing / Konselor,', 130, footerY + 5);
  doc.setFont('Helvetica', 'bold');
  doc.text(violation.reportedBy, 130, footerY + 27);
  doc.setFont('Helvetica', 'normal');
  doc.text('NIP. 19931231 202221 1 002', 130, footerY + 32);

  // Footer metadata
  const schoolConfig = getSchoolConfig();
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 130);
  doc.text(`Dicetak otomatis melalui Portal BK ${schoolConfig.schoolName} pada ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`, 15, 280);

  // Save the PDF file
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
  doc.text(service.problem, 60, detailY);

  detailY += 6;
  doc.setFont('Helvetica', 'normal');
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
  doc.text(`${service.date} / ${service.startTime} - ${service.endTime} WIB`, 60, detailY);

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
  const finalY = Math.max(225, contentY + splitFollowUp.length * 5 + 15);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
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
  doc.text(`Dicetak otomatis melalui Portal BK ${schoolConfig.schoolName} pada ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`, 15, 280);

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
    doc.text(`Dicetak otomatis pada: ${new Date().toLocaleDateString('id-ID')} - Sifat: Arsip BK`, 105, 50, { align: 'center' });
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

      const rowHeight = 7;
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
      doc.text(student.name, 52, currentY + 4.5);
      
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
    allEntriesToRender.push({
      time: `${e.startTime} - ${e.endTime}`,
      type: e.activityType,
      title: e.title,
      target: e.target,
      notes: e.description,
      status: e.status
    });
  });

  // 2. Add Auto-Integrated Activities
  if (includeAuto && autoActivities) {
    autoActivities.forEach((a) => {
      allEntriesToRender.push({
        time: a.time,
        type: a.type,
        title: a.title,
        target: a.target,
        notes: a.notes,
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
      const titleAndDesc = `${v.title}\n\nDetail: ${v.notes || '-'}`;
      const splitTitleDesc = doc.splitTextToSize(titleAndDesc, 58);
      const splitTarget = doc.splitTextToSize(v.target || '-', 22);
      const splitOutcome = doc.splitTextToSize(`[${v.status}]`, 32);

      const maxLines = Math.max(splitTitleDesc.length, splitTarget.length, splitOutcome.length);
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
      doc.text(v.type, 44, currentY + 4.5);
      
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
  doc.text(`Dicetak otomatis melalui Portal BK ${config.schoolName} pada ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`, 15, 282);

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
    allEntriesToRender.push({
      date: e.date,
      time: `${e.startTime} - ${e.endTime}`,
      type: e.activityType,
      title: e.title,
      target: e.target,
      notes: e.description,
      status: e.status
    });
  });

  // 2. Add Auto-Integrated Activities
  if (includeAuto && autoActivities) {
    autoActivities.forEach((a) => {
      allEntriesToRender.push({
        date: a.date || startDate,
        time: a.time,
        type: a.type,
        title: a.title,
        target: a.target,
        notes: a.notes,
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

      const titleAndDesc = `${v.title}\n\nDetail: ${v.notes || '-'}`;
      const splitTitleDesc = doc.splitTextToSize(titleAndDesc, 55);
      const splitTarget = doc.splitTextToSize(v.target || '-', 23);
      const splitOutcome = doc.splitTextToSize(`[${v.status}]`, 22);

      const maxLines = Math.max(splitDateAndTime.length, splitTitleDesc.length, splitTarget.length, splitOutcome.length);
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
      doc.text(v.type, 58, currentY + 4.5);
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
  doc.text(`Dicetak otomatis melalui Portal BK ${config.schoolName} pada ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`, 15, 282);

  // Save PDF file
  doc.save(`Rekap_Jurnal_Harian_BK_${startDate}_to_${endDate}_${counselor.name.replace(/\s+/g, '_')}.pdf`);
}

// Utility to format Date into Indonesian (e.g., "Senin, 13 Juli 2026")
export function formatIndonesianDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const dayName = days[d.getDay()];
    const dateNum = d.getDate();
    const monthName = months[d.getMonth()];
    const year = d.getFullYear();
    return `${dayName}, ${dateNum} ${monthName} ${year}`;
  } catch (e) {
    return dateStr;
  }
}
