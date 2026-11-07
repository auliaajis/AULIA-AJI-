import { jsPDF } from 'jspdf';
import { showToast } from './toast';
import { Student, ViolationRecord, CounselingService, ClassAttendanceRecord, StudentAttendance, StudentAchievement, Counselor, SuratPerjanjianRecord, KontrakPerilakuRecord, JurnalPembinaanDisiplinRecord, KomitmenRtlRecord, HomeVisitRecord } from '../types';
import { getSchoolConfig, getActiveSchoolId, loadSchoolData } from './schoolConfig';
import { uploadPdfToGoogleDrive, PdfDriveUploadOptions } from './googleDriveUpload';

export { getSchoolConfig };

/**
 * Returns dynamic counselor info for signatures (preventing hardcoded fallback)
 */
export function getActiveCounselorSigner(counselorOverride?: any): { name: string; nip: string } {
  if (counselorOverride && counselorOverride.name) {
    return {
      name: counselorOverride.name,
      nip: counselorOverride.nip && counselorOverride.nip !== '-' ? counselorOverride.nip : '-'
    };
  }
  try {
    const activeSchoolId = getActiveSchoolId();
    const activeCounselors = loadSchoolData<any[]>('bk_counselors', [], activeSchoolId);
    const activeId = typeof localStorage !== 'undefined' ? localStorage.getItem('bk_active_counselor_id') : null;
    const found = activeCounselors.find(c => c.id === activeId) || activeCounselors[0];
    if (found && found.name) {
      return {
        name: found.name,
        nip: found.nip && found.nip !== '-' ? found.nip : '-'
      };
    }
  } catch (e) {}

  return {
    name: 'Guru Pembimbing BK',
    nip: '-'
  };
}

/**
 * Unified PDF Finalizer:
 * 1. Saves/downloads the PDF locally for the user immediately.
 * 2. Automatically syncs and archives the PDF to the logged-in user's Google Drive folder.
 */
export function finalizeAndSavePdf(
  doc: jsPDF,
  filename: string,
  options?: {
    category?: 'rekap' | 'layanan' | 'pelanggaran' | 'panggilan' | 'perjanjian' | 'kontrak' | 'jurnal' | 'rtl' | 'homevisit' | 'berita_acara' | 'umum';
    studentName?: string;
    nisn?: string;
    successToastMessage?: string;
  }
) {
  // 1. Instant local download
  const cleanFileName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(cleanFileName);

  // 2. Automated Google Drive synchronization in background
  try {
    const pdfBlob = doc.output('blob');
    uploadPdfToGoogleDrive(pdfBlob, cleanFileName, {
      category: options?.category || 'umum',
      studentName: options?.studentName,
      nisn: options?.nisn,
      date: new Date().toISOString().split('T')[0],
    }).then((driveRes) => {
      if (driveRes && driveRes.success) {
        showToast(`📄 PDF berhasil diunduh & tersimpan otomatis di Google Drive Anda! ☁️`, 'success');
      } else if (options?.successToastMessage) {
        showToast(options.successToastMessage, 'success');
      }
    }).catch((err) => {
      console.warn('Google Drive background sync note:', err);
      if (options?.successToastMessage) {
        showToast(options.successToastMessage, 'success');
      }
    });
  } catch (err) {
    console.error('Error initiating Google Drive PDF upload:', err);
    if (options?.successToastMessage) {
      showToast(options.successToastMessage, 'success');
    }
  }
}

/**
 * Silently generates and uploads a PDF directly to Google Drive without triggering a browser file download dialog.
 * Perfect for automatic background backup on data input (sehingga apabila aplikasi crash, bukti PDF sudah aman tersimpan).
 */
export async function autoArchiveDocToDrive(
  doc: jsPDF,
  filename: string,
  options?: {
    category?: 'rekap' | 'layanan' | 'pelanggaran' | 'panggilan' | 'perjanjian' | 'kontrak' | 'jurnal' | 'rtl' | 'homevisit' | 'berita_acara' | 'umum';
    studentName?: string;
    nisn?: string;
    silent?: boolean;
  }
) {
  try {
    const cleanFileName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    const pdfBlob = doc.output('blob');
    const result = await uploadPdfToGoogleDrive(pdfBlob, cleanFileName, {
      category: options?.category || 'umum',
      studentName: options?.studentName,
      nisn: options?.nisn,
      date: new Date().toISOString().split('T')[0],
    });
    if (result.success && !options?.silent) {
      showToast(`☁️ Salinan PDF otomatis tersimpan di Google Drive (SIKAP-BK/${result.folderName || 'Arsip'})`, 'info');
    }
    return result;
  } catch (err) {
    console.warn('Auto-archive doc to Drive note:', err);
    return { success: false, error: String(err) };
  }
}

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

export function drawLetterhead(doc: jsPDF, accentColor: number[]) {
  const config = getSchoolConfig();

  // Top border line
  doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setLineWidth(1.2);
  doc.line(15, 12, 195, 12);

  // Draw Kabupaten / Regional logo on the left (X=26, Y=24, R=9)
  const customKabupatenLogo = config.customKabupatenLogo || (typeof localStorage !== 'undefined' ? localStorage.getItem('bk_custom_kabupaten_logo') : null);
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
  const customSchoolLogo = config.customSchoolLogo || (typeof localStorage !== 'undefined' ? localStorage.getItem('bk_custom_school_logo') : null);
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
    doc.text('LEMBAR REKAPITULASI PERKEMBANGAN & BIMBINGAN SISWA', 105, 45, { align: 'center' });

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
  const signer = getActiveCounselorSigner();
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

  const citySign = schoolConfig.schoolAddress?.includes('Semarang') ? 'Kabupaten Semarang' : 'Kota / Kabupaten';
  doc.text(citySign + ', ' + formatIndonesianDate(new Date().toISOString()), 125, currentY);
  doc.text('Guru Pembimbing / Konselor,', 125, currentY + 5.5);
  doc.line(125, currentY + 28, 180, currentY + 28);
  doc.setFont('Helvetica', 'bold');
  doc.text(signer.name, 125, currentY + 27);
  doc.setFont('Helvetica', 'normal');
  doc.text(`NIP. ${signer.nip}`, 125, currentY + 31.5);

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
  const filename = `Rekap_BK_${student.nis}_${student.name.replace(/\s+/g, '_')}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'rekap',
    studentName: student.name,
    nisn: student.nis,
    successToastMessage: 'Dokumen PDF Rekap Perkembangan Siswa berhasil diunduh!',
  });
}

/**
 * Generates a professional PDF for a Violation Record (Bukti Pelanggaran).
 */
export function buildViolationPdfDoc(violation: ViolationRecord): jsPDF {
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
  const signerViolation = getActiveCounselorSigner(violation.reportedBy ? { name: violation.reportedBy } : undefined);
  const splitReportedName = doc.splitTextToSize(signerViolation.name || 'Guru BK', 60);
  doc.text(splitReportedName, 130, footerY + 27);
  doc.setFont('Helvetica', 'normal');
  doc.text(`NIP. ${signerViolation.nip}`, 130, footerY + 32);

  // Footer metadata
  const schoolConfig = getSchoolConfig();
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 130);
  doc.text(`Dicetak otomatis melalui Portal BK ${schoolConfig.schoolName} pada ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`, 15, 280);

  return doc;
}

export function downloadViolationPDF(violation: ViolationRecord) {
  const doc = buildViolationPdfDoc(violation);
  const cleanStudent = violation.studentName.replace(/\s+/g, '_');
  const filename = `Bukti_Pelanggaran_${violation.ticketId}_${cleanStudent}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'pelanggaran',
    studentName: violation.studentName,
    successToastMessage: 'Dokumen PDF Bukti Pelanggaran berhasil diunduh!',
  });
}

/**
 * Otomatis mengarsipkan PDF Bukti Pelanggaran ke Google Drive (SIKAP-BK/Pelanggaran) secara background
 */
export async function autoArchiveViolationToDrive(
  violation: ViolationRecord,
  options?: { silent?: boolean }
) {
  try {
    const doc = buildViolationPdfDoc(violation);
    const cleanStudent = (violation.studentName || 'Siswa').replace(/\s+/g, '_');
    const filename = `Bukti_Pelanggaran_${violation.ticketId || Date.now()}_${cleanStudent}.pdf`;
    return await autoArchiveDocToDrive(doc, filename, {
      category: 'pelanggaran',
      studentName: violation.studentName,
      silent: options?.silent,
    });
  } catch (err: any) {
    console.warn('Auto-archive violation to Drive error:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Generates a professional PDF for a Counseling Service (Bukti Layanan BK).
 */
export function generateServicePDF(service: CounselingService) {
  return downloadServicePDF(service);
}

export function buildServicePdfDoc(service: CounselingService): jsPDF {
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

  // Page break tracker
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > 270) {
      doc.addPage();
      drawLetterhead(doc, primaryColor);
      currentY = 45;
      return true;
    }
    return false;
  };

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

  let currentY = 58;

  // Student Section Header
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('I. DAFTAR PESERTA LAYANAN (SISWA)', 20, currentY + 5.5);

  currentY += 12;

  // List students participating
  doc.setFont('Helvetica', 'normal');
  (service.students || []).forEach((student, idx) => {
    checkPageBreak(8);
    doc.setFont('Helvetica', 'bold');
    doc.text(`${idx + 1}. ${student.name}`, 20, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Kelas: ${student.class} | NISN: ${student.nis}`, 100, currentY);
    currentY += 6;
  });

  currentY += 4;
  checkPageBreak(40);

  // Service details Section Header
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('II. DETAIL PELAKSANAAN LAYANAN', 20, currentY + 5.5);

  currentY += 14;

  // Details
  doc.setFont('Helvetica', 'normal');
  doc.text('Komponen Pilar BK', 20, currentY);
  doc.text(':', 55, currentY);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(service.bkComponent || 'Layanan BK Komprehensif', 60, currentY);

  if (service.bidangBimbingan) {
    currentY += 6;
    checkPageBreak(8);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('Helvetica', 'normal');
    doc.text('Bidang Bimbingan', 20, currentY);
    doc.text(':', 55, currentY);
    doc.setFont('Helvetica', 'bold');
    doc.text(
      service.bidangBimbingan.includes('Non-Bidang')
        ? 'Non-Bidang (Dukungan Sistem)'
        : `Bidang ${service.bidangBimbingan}`,
      60,
      currentY
    );
  }

  if (service.focusIssue) {
    currentY += 6;
    checkPageBreak(8);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('Helvetica', 'normal');
    doc.text('Fokus / Bidang Isu', 20, currentY);
    doc.text(':', 55, currentY);
    doc.setFont('Helvetica', 'bold');
    doc.text(service.focusIssue, 60, currentY);
  }

  currentY += 6;
  checkPageBreak(12);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('Helvetica', 'normal');
  doc.text('Topik/Masalah', 20, currentY);
  doc.text(':', 55, currentY);
  doc.setFont('Helvetica', 'bold');
  const splitProblemText = doc.splitTextToSize(service.problem || '-', 135);
  doc.text(splitProblemText, 60, currentY);

  currentY += Math.max(6, splitProblemText.length * 5);
  checkPageBreak(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Status Layanan', 20, currentY);
  doc.text(':', 55, currentY);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(service.status || 'Selesai', 60, currentY);

  currentY += 6;
  checkPageBreak(8);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('Helvetica', 'normal');
  doc.text('Waktu Sesi', 20, currentY);
  doc.text(':', 55, currentY);
  const serviceTimeRange = service.startTime && service.endTime ? `${service.startTime} - ${service.endTime}` : service.startTime || '';
  doc.text(formatRecordDateTime(service.date, serviceTimeRange), 60, currentY);

  currentY += 10;
  checkPageBreak(40);

  // Description & Outcomes Header
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 8, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('III. DESKRIPSI, HASIL & TINDAK LANJUT', 20, currentY + 5.5);

  currentY += 14;

  // Content
  doc.setFont('Helvetica', 'bold');
  doc.text('Deskripsi Masalah / Kegiatan:', 20, currentY);
  doc.setFont('Helvetica', 'normal');
  const splitDesc = doc.splitTextToSize(service.description || '-', 170);
  doc.text(splitDesc, 20, currentY + 5);
  
  currentY += splitDesc.length * 5 + 8;
  checkPageBreak(25);

  // Contextual details if present
  if (service.specificDetails) {
    const sd = service.specificDetails;
    const detailItems: { label: string; val?: string }[] = [
      { label: 'Aspek SKKPD', val: sd.aspekSkkpd },
      { label: 'Tahap Capaian Kemandirian', val: sd.tahapCapaian },
      { label: 'Sub-Aktivitas Sistem', val: sd.subAktivitasSistem },
      { label: 'Metode / Teknik', val: sd.metodeLayanan },
      { label: 'Media / Alat Peraga', val: sd.mediaLayanan },
      { label: 'Pendekatan Konseling', val: sd.pendekatanKonseling },
      { label: 'Akar Masalah / Faktor Pemicu', val: sd.akarMasalah },
      { label: 'Komitmen / Kesepakatan Konseli', val: sd.komitmenKonseli || sd.kesepakatanDamai },
      { label: 'Pihak Terlibat / Peserta', val: sd.pesertaKonferensi || sd.pihakBersengketa || sd.mitraTerlibat },
      { label: 'Pilihan Peminatan / Karir', val: sd.bidangPeminatan },
      { label: 'Rencana Aksi Siswa', val: sd.rencanaAksiSiswa },
      { label: 'Evaluasi Hasil (Laiseg)', val: sd.evaluasiHasil },
      { label: 'Lembaga / Pihak Rujukan', val: sd.lembagaRujukan }
    ].filter(item => Boolean(item.val));

    if (detailItems.length > 0) {
      doc.setFont('Helvetica', 'bold');
      doc.text('Parameter & Spesifikasi Layanan:', 20, currentY);
      currentY += 5;
      doc.setFont('Helvetica', 'normal');
      detailItems.forEach(item => {
        checkPageBreak(12);
        doc.setFont('Helvetica', 'bold');
        doc.text(`• ${item.label}:`, 22, currentY);
        doc.setFont('Helvetica', 'normal');
        const splitVal = doc.splitTextToSize(item.val || '-', 135);
        doc.text(splitVal, 60, currentY);
        currentY += Math.max(5, splitVal.length * 4.5);
      });
      currentY += 4;
      checkPageBreak(25);
    }
  }

  doc.setFont('Helvetica', 'bold');
  doc.text('Hasil / Output Layanan:', 20, currentY);
  doc.setFont('Helvetica', 'normal');
  const splitOutput = doc.splitTextToSize(service.output || '-', 170);
  doc.text(splitOutput, 20, currentY + 5);

  currentY += splitOutput.length * 5 + 8;
  checkPageBreak(25);

  doc.setFont('Helvetica', 'bold');
  doc.text('Rencana Tindak Lanjut (RTL):', 20, currentY);
  doc.setFont('Helvetica', 'normal');
  const splitFollowUp = doc.splitTextToSize(service.followUp || '-', 170);
  doc.text(splitFollowUp, 20, currentY + 5);

  currentY += splitFollowUp.length * 5 + 14;

  // Signatures Section
  checkPageBreak(38);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Mengetahui,', 20, currentY);
  doc.text('Perwakilan Orang Tua / Siswa,', 20, currentY + 5);
  doc.line(20, currentY + 28, 70, currentY + 28);

  doc.text('Guru Pembimbing / Konselor,', 130, currentY + 5);
  doc.setFont('Helvetica', 'bold');
  const signerService = getActiveCounselorSigner(service.counselorName ? { name: service.counselorName } : undefined);
  doc.text(signerService.name, 130, currentY + 27);
  doc.setFont('Helvetica', 'normal');
  doc.text(`NIP. ${signerService.nip}`, 130, currentY + 32);

  // Footer metadata on all pages
  const totalPages = doc.getNumberOfPages();
  const schoolConfig = getSchoolConfig();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 130);
    doc.text(
      `Kartu Layanan BK ${schoolConfig.schoolName} | Hal ${i} dari ${totalPages} | Dicetak: ${formatIndonesianDate(new Date().toISOString())}`,
      105,
      285,
      { align: 'center' }
    );
  }

  return doc;
}

export function downloadServicePDF(service: CounselingService) {
  const doc = buildServicePdfDoc(service);
  const primaryStudentName = service.students?.[0]?.name || 'Siswa';
  const filename = `Bukti_Layanan_BK_${service.id}_${service.serviceType.replace(/\s+/g, '_')}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'layanan',
    studentName: primaryStudentName,
    successToastMessage: 'Dokumen PDF Bukti Layanan BK berhasil diunduh!',
  });
}

/**
 * Otomatis mengarsipkan PDF Bukti Layanan BK ke Google Drive (SIKAP-BK/Laporan_Layanan) secara background
 */
export async function autoArchiveServiceToDrive(
  service: CounselingService,
  options?: { silent?: boolean }
) {
  try {
    const doc = buildServicePdfDoc(service);
    const primaryStudentName = service.students?.[0]?.name || 'Siswa';
    const cleanStudent = primaryStudentName.replace(/\s+/g, '_');
    const cleanType = (service.serviceType || 'Layanan').replace(/\s+/g, '_');
    const filename = `Bukti_Layanan_BK_${service.id || Date.now()}_${cleanStudent}_${cleanType}.pdf`;
    return await autoArchiveDocToDrive(doc, filename, {
      category: 'layanan',
      studentName: primaryStudentName,
      silent: options?.silent,
    });
  } catch (err: any) {
    console.warn('Auto-archive service to Drive error:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Generates an official Counseling Commitment Letter (Lembar Komitmen Konseli)
 */
export function downloadCommitmentLetterPDF(service: CounselingService) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [0, 104, 95]; // #00685f (Teal)
  const darkColor = [11, 28, 48]; // #0b1c30
  const lightGrayColor = [240, 244, 244];

  drawLetterhead(doc, primaryColor);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('LEMBAR KESEPAKATAN & KOMITMEN DIRI KONSELING BK', 105, 45, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`Nomor Registrasi Sesi: KMT-${service.id.substring(0, 8).toUpperCase()}`, 105, 51, { align: 'center' });

  let currentY = 58;

  // I. DATA KONSELI
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 7.5, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('I. IDENTITAS KONSELI (PESERTA DIDIK)', 20, currentY + 5);

  currentY += 12;
  doc.setFont('Helvetica', 'normal');

  const studentList = service.students || [];
  studentList.forEach((st, idx) => {
    doc.text(`Nama Lengkap: ${st.name}`, 20, currentY);
    doc.text(`Kelas: ${st.class}  |  NISN: ${st.nis}`, 120, currentY);
    currentY += 6;
  });

  currentY += 2;

  // II. POKOK PEMBAHASAN
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 7.5, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('II. ISU / FOKUS PERUBAHAN PERILAKU', 20, currentY + 5);

  currentY += 12;
  doc.setFont('Helvetica', 'normal');
  doc.text('Jenis Layanan', 20, currentY);
  doc.text(':', 55, currentY);
  doc.text(service.serviceType, 60, currentY);

  currentY += 6;
  doc.text('Topik / Isu Konseling', 20, currentY);
  doc.text(':', 55, currentY);
  const splitProb = doc.splitTextToSize(service.problem, 135);
  doc.text(splitProb, 60, currentY);
  currentY += Math.max(6, splitProb.length * 5);

  // III. BUTIR-BUTIR KOMITMEN
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 7.5, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('III. BUTIR KESEPAKATAN & KOMITMEN TINDAKAN BARU', 20, currentY + 5);

  currentY += 11;
  doc.setFont('Helvetica', 'normal');
  doc.text('Setelah mengikuti sesi konseling dengan penuh kesadaran dan tanpa paksaan, saya berkomitmen:', 20, currentY);

  currentY += 6;
  const commitmentText = service.specificDetails?.komitmenKonseli || service.output || service.followUp || 'Berkomitmen untuk memperbaiki diri, hadir tepat waktu, dan mematuhi tata tertib sekolah.';
  const splitCommitment = doc.splitTextToSize(`" ${commitmentText} "`, 170);
  
  doc.setFont('Helvetica', 'bolditalic');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(splitCommitment, 20, currentY);

  currentY += splitCommitment.length * 5 + 6;

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Rencana Monitoring / Evaluasi Mandiri:', 20, currentY);
  currentY += 5;
  const followUpText = service.followUp || 'Evaluasi berkala bersama Guru BK 1 pekan mendatang.';
  const splitFollow = doc.splitTextToSize(followUpText, 170);
  doc.text(splitFollow, 20, currentY);

  currentY += splitFollow.length * 5 + 14;

  // Signatures
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Konseli yang Berkomitmen,', 25, currentY);
  doc.text('Guru Pembimbing / Konselor,', 125, currentY);

  currentY += 24;
  doc.setFont('Helvetica', 'bold');
  const primaryName = studentList[0]?.name || 'Siswa';
  doc.text(primaryName, 25, currentY);
  doc.line(25, currentY + 1, 75, currentY + 1);

  const signer = getActiveCounselorSigner(service.counselorName ? { name: service.counselorName } : undefined);
  doc.text(signer.name, 125, currentY);
  doc.line(125, currentY + 1, 175, currentY + 1);
  doc.setFont('Helvetica', 'normal');
  doc.text(`NIP. ${signer.nip}`, 125, currentY + 6);

  const filename = `Lembar_Komitmen_BK_${service.id}_${primaryName.replace(/\s+/g, '_')}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'layanan',
    studentName: primaryName,
    successToastMessage: 'Lembar Komitmen Konseli berhasil diunduh!',
  });
}

/**
 * Generates an official Berita Acara Pelaksanaan Layanan BK
 */
export function downloadBeritaAcaraLayananPDF(service: CounselingService) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [0, 104, 95];
  const darkColor = [11, 28, 48];
  const lightGrayColor = [240, 244, 244];

  drawLetterhead(doc, primaryColor);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('BERITA ACARA PELAKSANAAN LAYANAN BIMBINGAN & KONSELING', 105, 45, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`Nomor Dokumen: BA-BK/${new Date().getFullYear()}/${service.id.substring(0, 6).toUpperCase()}`, 105, 51, { align: 'center' });

  let currentY = 58;

  const schoolConfig = getSchoolConfig();
  const formattedDate = formatIndonesianDate(service.date);

  const preamble = `Pada hari ini, ${formattedDate}, bertempat di Ruang Bimbingan dan Konseling ${schoolConfig.schoolName}, telah dilaksanakan kegiatan layanan bimbingan dan konseling sebagai berikut:`;
  const splitPreamble = doc.splitTextToSize(preamble, 170);
  doc.text(splitPreamble, 20, currentY);

  currentY += splitPreamble.length * 5 + 4;

  // TABEL SPESIFIKASI
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 7.5, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('I. DATA PELAKSANAAN KEGIATAN', 20, currentY + 5);

  currentY += 12;
  doc.setFont('Helvetica', 'normal');

  const rows = [
    ['1. Jenis Layanan', `: ${service.serviceType}`],
    ['2. Komponen Pilar BK', `: ${service.bkComponent || 'Layanan BK Komprehensif'}`],
    ['3. Bidang Bimbingan', `: ${service.bidangBimbingan ? (service.bidangBimbingan.includes('Non-Bidang') ? 'Non-Bidang (Dukungan Sistem)' : `Bidang ${service.bidangBimbingan}`) : 'Bidang Pribadi'}`],
    ['4. Waktu Pelaksanaan', `: ${service.startTime} s.d. ${service.endTime} WIB`],
    ['5. Pokok Bahasan / Topik', `: ${service.problem}`],
    ['6. Status Sesi', `: ${service.status}`],
  ];

  rows.forEach(([label, val]) => {
    doc.text(label, 20, currentY);
    doc.text(val, 65, currentY);
    currentY += 6;
  });

  currentY += 2;

  // II. PESERTA & PIHAK TERLIBAT
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 7.5, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('II. PESERTA & PIHAK TERLIBAT', 20, currentY + 5);

  currentY += 12;
  doc.setFont('Helvetica', 'normal');
  (service.students || []).forEach((st, idx) => {
    doc.text(`${idx + 1}. ${st.name} (Kelas ${st.class} / NISN ${st.nis})`, 25, currentY);
    currentY += 5.5;
  });

  currentY += 3;

  // III. HASIL & REKOMENDASI
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(15, currentY, 180, 7.5, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('III. KESIMPULAN & KESEPAKATAN', 20, currentY + 5);

  currentY += 11;
  doc.setFont('Helvetica', 'normal');
  const splitOut = doc.splitTextToSize(`Hasil: ${service.output || '-'}`, 170);
  doc.text(splitOut, 20, currentY);
  currentY += splitOut.length * 5 + 3;

  const splitRtl = doc.splitTextToSize(`Tindak Lanjut: ${service.followUp || '-'}`, 170);
  doc.text(splitRtl, 20, currentY);
  currentY += splitRtl.length * 5 + 10;

  // Signatures
  doc.text('Demikian Berita Acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.', 20, currentY);
  currentY += 12;

  doc.text('Mengetahui / Mengesahkan,', 25, currentY);
  doc.text('Guru Pembimbing / Konselor,', 125, currentY);

  currentY += 22;
  doc.setFont('Helvetica', 'bold');
  doc.text('Kepala Sekolah / Kesiswaan', 25, currentY);
  doc.line(25, currentY + 1, 75, currentY + 1);

  const signer = getActiveCounselorSigner(service.counselorName ? { name: service.counselorName } : undefined);
  doc.text(signer.name, 125, currentY);
  doc.line(125, currentY + 1, 175, currentY + 1);
  doc.setFont('Helvetica', 'normal');
  doc.text(`NIP. ${signer.nip}`, 125, currentY + 6);

  const filename = `Berita_Acara_BK_${service.id}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'layanan',
    successToastMessage: 'Berita Acara Layanan BK berhasil diunduh!',
  });
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
  const filename = `Rekap_Absensi_BK_${className.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'rekap',
    studentName: `Kelas_${className}`,
    successToastMessage: 'Dokumen PDF Rekap Presensi Siswa berhasil diunduh!',
  });
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
  const filename = `Jurnal_Harian_BK_${date}_${counselor.name.replace(/\s+/g, '_')}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'jurnal',
    studentName: `Guru_${counselor.name}`,
    successToastMessage: 'Dokumen PDF Jurnal Harian BK berhasil diunduh!',
  });
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
  const filename = `Rekap_Jurnal_Harian_BK_${startDate}_to_${endDate}_${counselor.name.replace(/\s+/g, '_')}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'jurnal',
    studentName: `Guru_${counselor.name}`,
    successToastMessage: 'Dokumen PDF Rekap Jurnal Harian berhasil diunduh!',
  });
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
  const cleanLetterNo = String(summon.letterNumber || 'SURAT').replace(/[\/\s]/g, '_');
  const cleanStudent = String(summon.studentName || 'Siswa').replace(/\s+/g, '_');
  const filename = `Surat_Panggilan_Orang_Tua_${cleanLetterNo}_${cleanStudent}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'panggilan',
    studentName: summon.studentName,
    successToastMessage: 'Surat Panggilan Orang Tua berhasil diunduh!',
  });
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
  const charcoalColor = [61, 73, 71]; // #3d4947
  const sectionBgColor = [240, 248, 246]; // soft teal bg
  const att = summon.attendanceDetails || {};

  const schoolConfig = getSchoolConfig();
  const counselorInfo = getActiveCounselorSigner(counselor || (att.counselorName ? { name: att.counselorName } : undefined));

  // Extract clean city from school address
  const rawAddressParts = (schoolConfig.schoolAddress || '').split(',');
  const city = rawAddressParts.find(p => p.trim().startsWith('Kab.') || p.trim().startsWith('Kec.') || p.trim().includes('Semarang')) || 'Semarang';
  const cleanCity = city.replace('Kab.', '').replace('Kec.', '').trim() || 'Susukan';

  const docDate = att.actualDate || summon.summonDate || new Date().toISOString().split('T')[0];
  const docYear = new Date(docDate).getFullYear() || new Date().getFullYear();
  const rawSummonNum = String(summon.letterNumber || summon.id || 'DIR-01').trim();
  const cleanDocNum = rawSummonNum.replace(/\s+/g, '').replace(/\//g, '-');
  const baNumber = att.documentNumber || `BA-OT/${docYear}/${cleanDocNum}`;

  let currentY = 15;
  const pageHeight = 297;

  function drawHeader() {
    drawLetterhead(doc, tealColor);

    // Document Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
    doc.text('BERITA ACARA & NOTULEN HASIL KEHADIRAN ORANG TUA / WALI MURID', 105, 43, { align: 'center' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`Nomor: ${baNumber}`, 105, 48, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(charcoalColor[0], charcoalColor[1], charcoalColor[2]);
    const refText = summon.letterNumber
      ? `Rujukan / Lampiran Surat Panggilan: No. ${summon.letterNumber}`
      : 'Dasar Pertemuan: Konsultasi Langsung / Penanganan Kasus Siswa BK';
    doc.text(refText, 105, 52.5, { align: 'center' });

    currentY = 57;
  }

  function checkPageBreak(spaceNeeded: number) {
    if (currentY + spaceNeeded > pageHeight - 24) {
      doc.addPage();
      // Draw running header on page 2+
      doc.setDrawColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setLineWidth(0.8);
      doc.line(15, 12, 195, 12);

      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(110, 120, 120);
      doc.text(`Berita Acara Kehadiran Orang Tua - Siswa: ${summon.studentName || '-'} (${summon.studentClass || '-'})`, 15, 16);
      doc.text(`Halaman ${doc.getNumberOfPages()}`, 195, 16, { align: 'right' });

      doc.setDrawColor(220, 225, 225);
      doc.setLineWidth(0.2);
      doc.line(15, 18, 195, 18);

      currentY = 24;
    }
  }

  // Draw initial header
  drawHeader();

  // Preamble sentence
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  const meetingDateFormatted = formatIndonesianDate(docDate, true);
  const preamble = `Pada hari ini, ${meetingDateFormatted}, bertempat di ${att.meetingPlace || summon.summonPlace || 'Ruang Bimbingan dan Konseling ' + schoolConfig.schoolName}, telah dilaksanakan pertemuan koordinasi dan konsultasi penanganan bimbingan siswa antara pihak sekolah dengan Orang Tua / Wali Murid:`;
  const splitPreamble = doc.splitTextToSize(preamble, 180);
  doc.text(splitPreamble, 15, currentY);
  currentY += splitPreamble.length * 4.2 + 3;

  // ==========================================
  // SECTION I: IDENTITAS SISWA & ORANG TUA
  // ==========================================
  checkPageBreak(35);
  doc.setFillColor(sectionBgColor[0], sectionBgColor[1], sectionBgColor[2]);
  doc.rect(15, currentY, 180, 6.5, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.text('I. IDENTITAS PESERTA DIDIK DAN ORANG TUA / WALI MURID', 18, currentY + 4.5);

  currentY += 9;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  // Two-column metadata grid
  // Left: Data Siswa
  doc.setFont('Helvetica', 'bold');
  doc.text('Data Peserta Didik:', 18, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.text(`• Nama Siswa       : ${summon.studentName || '-'}`, 18, currentY + 4.5);
  doc.text(`• Kelas / NISN     : Kelas ${summon.studentClass || '-'} (NISN: ${summon.studentNis || '-'})`, 18, currentY + 9);
  doc.text(`• Bidang Bimbingan : ${summon.bidangBimbingan ? 'Bidang ' + summon.bidangBimbingan : 'Bidang Pribadi'}`, 18, currentY + 13.5);

  // Right: Data Orang Tua / Wali
  doc.setFont('Helvetica', 'bold');
  doc.text('Data Orang Tua / Wali yang Hadir:', 110, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.text(`• Nama Lengkap   : ${att.attendeeName || summon.parentName || '-'}`, 110, currentY + 4.5);
  doc.text(`• Hubungan       : ${att.attendeeRelation || 'Orang Tua / Wali Murid'}`, 110, currentY + 9);
  doc.text(`• No. WhatsApp   : ${att.phone || '-'}`, 110, currentY + 13.5);

  currentY += 19;

  // Waktu & Petugas Pelaksana
  doc.setFillColor(248, 250, 250);
  doc.rect(15, currentY, 180, 6, 'F');
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(charcoalColor[0], charcoalColor[1], charcoalColor[2]);
  doc.text(
    `Waktu Pertemuan: ${att.actualTime || summon.summonTime || '09:00'} WIB s.d. Selesai  |  Konselor BK Pendamping: ${att.counselorName || counselorInfo.name}`,
    18,
    currentY + 4
  );

  currentY += 9;

  // ==========================================
  // SECTION II: POKOK BAHASAN & MASALAH
  // ==========================================
  const issuesText = att.issuesDiscussed || summon.agenda || 'Konsultasi dan koordinasi perkembangan belajar serta kedisiplinan siswa di lingkungan sekolah.';
  const splitIssues = doc.splitTextToSize(issuesText, 175);
  const issuesHeight = splitIssues.length * 4.2 + 10;

  checkPageBreak(issuesHeight + 8);
  doc.setFillColor(sectionBgColor[0], sectionBgColor[1], sectionBgColor[2]);
  doc.rect(15, currentY, 180, 6.5, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.text('II. POKOK PERMASALAHAN & MATERI KONSULTASI', 18, currentY + 4.5);

  currentY += 9;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(splitIssues, 18, currentY);

  currentY += splitIssues.length * 4.2 + 4;

  // ==========================================
  // SECTION III: HASIL KESEPAKATAN & SOLUSI
  // ==========================================
  const agreementsText = att.agreements || 'Siswa, Orang Tua, dan Guru BK menyepakati langkah pembinaan terpadu demi perbaikan perilaku, peningkatan kehadiran, serta kedisiplinan belajar siswa.';
  const splitAgreements = doc.splitTextToSize(agreementsText, 175);
  const agreementsHeight = splitAgreements.length * 4.2 + 10;

  checkPageBreak(agreementsHeight + 8);
  doc.setFillColor(sectionBgColor[0], sectionBgColor[1], sectionBgColor[2]);
  doc.rect(15, currentY, 180, 6.5, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.text('III. HASIL MUSYAWARAH & KESEPAKATAN BERSAMA', 18, currentY + 4.5);

  currentY += 9;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(splitAgreements, 18, currentY);

  currentY += splitAgreements.length * 4.2 + 4;

  // ==========================================
  // SECTION IV: KOMITMEN BERSAMA & RTL
  // ==========================================
  const parentComText = att.parentCommitment || 'Orang tua berkomitmen melakukan pendampingan belajar, memantau pergaulan, serta membatasi durasi penggunaan gawai anak di rumah.';
  const splitParentCom = doc.splitTextToSize(parentComText, 175);

  const studentComText = att.studentCommitment || 'Siswa berjanji tidak akan mengulangi kesalahan, senantiasa mematuhi tata tertib sekolah, dan siap menerima sanksi edukatif bila melanggar.';
  const splitStudentCom = doc.splitTextToSize(studentComText, 175);

  const followUpText = att.followUpPlan || 'Guru BK dan Wali Kelas melakukan evaluasi presensi dan sikap berkala selama 2 (dua) minggu ke depan serta memberikan laporan kepada orang tua.';
  const splitFollowUp = doc.splitTextToSize(followUpText, 175);

  const totalComHeight = (splitParentCom.length + splitStudentCom.length + splitFollowUp.length) * 4.2 + 25;

  checkPageBreak(totalComHeight);
  doc.setFillColor(sectionBgColor[0], sectionBgColor[1], sectionBgColor[2]);
  doc.rect(15, currentY, 180, 6.5, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.text('IV. KOMITMEN BERSAMA & RENCANA TINDAK LANJUT (RTL)', 18, currentY + 4.5);

  currentY += 9;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('1. Komitmen & Peran Orang Tua / Wali di Rumah:', 18, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.text(splitParentCom, 18, currentY + 4);
  currentY += splitParentCom.length * 4.2 + 5.5;

  doc.setFont('Helvetica', 'bold');
  doc.text('2. Komitmen & Ikrar Perbaikan Diri Siswa:', 18, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.text(splitStudentCom, 18, currentY + 4);
  currentY += splitStudentCom.length * 4.2 + 5.5;

  doc.setFont('Helvetica', 'bold');
  doc.text('3. Rencana Tindak Lanjut & Pemantauan BK / Sekolah:', 18, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.text(splitFollowUp, 18, currentY + 4);
  currentY += splitFollowUp.length * 4.2 + 7;

  // Closing sentence
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(charcoalColor[0], charcoalColor[1], charcoalColor[2]);
  doc.text(
    'Demikian Berita Acara & Notulen Kehadiran ini disusun dengan sebenarnya secara bermusyawarah dan penuh rasa tanggung jawab.',
    18,
    currentY
  );
  currentY += 6;

  // ==========================================
  // SECTION V: SIGNATURES & ENDORSEMENTS
  // ==========================================
  const sigBoxHeight = 44;
  checkPageBreak(sigBoxHeight);

  // Date and location above counselor
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`${cleanCity}, ${formatIndonesianDate(docDate)}`, 130, currentY);
  currentY += 4.5;

  const sigStartY = currentY;

  // Left Signatory: Orang Tua / Wali Murid
  doc.text('Orang Tua / Wali Murid,', 25, sigStartY);

  // Right Signatory: Guru Bimbingan & Konseling
  doc.text('Guru Bimbingan & Konseling,', 130, sigStartY);

  // Render touch/digital signatures if present
  if (att.parentSignatureBase64 && att.parentSignatureBase64.startsWith('data:image/')) {
    try {
      doc.addImage(att.parentSignatureBase64, 'PNG', 23, sigStartY + 2, 35, 14);
    } catch (e) {
      console.warn('Could not render parent signature image:', e);
    }
  }

  if (att.counselorSignatureBase64 && att.counselorSignatureBase64.startsWith('data:image/')) {
    try {
      doc.addImage(att.counselorSignatureBase64, 'PNG', 128, sigStartY + 2, 35, 14);
    } catch (e) {
      console.warn('Could not render counselor signature image:', e);
    }
  }

  currentY = sigStartY + 18;
  doc.setFont('Helvetica', 'bold');
  doc.text(att.attendeeName || summon.parentName || 'Orang Tua / Wali Siswa', 25, currentY);
  doc.text(counselorInfo.name, 130, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Tanda Tangan & Nama Terang', 25, currentY + 3.8);
  doc.text(counselorInfo.nip && counselorInfo.nip !== '-' ? `NIP. ${counselorInfo.nip}` : 'NIP. -', 130, currentY + 3.8);

  currentY += 9;

  // Mengetahui: Kepala Sekolah (Middle/bottom endorsement)
  if (schoolConfig.principalName) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Mengetahui,', 105, currentY, { align: 'center' });
    doc.text('Kepala Sekolah', 105, currentY + 4, { align: 'center' });

    currentY += 17;
    doc.setFont('Helvetica', 'bold');
    doc.text(schoolConfig.principalName, 105, currentY, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      schoolConfig.principalNip && schoolConfig.principalNip !== '-' ? `NIP. ${schoolConfig.principalNip}` : 'NIP. -',
      105,
      currentY + 3.8,
      { align: 'center' }
    );
  }

  // Footer metadata on each page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(120, 130, 130);
    doc.text(
      `Dokumen Resmi Berita Acara Kehadiran Orang Tua - ${schoolConfig.schoolName} (${formatIndonesianDate(docDate)})`,
      15,
      287
    );
    doc.text(`Halaman ${p} dari ${totalPages}`, 195, 287, { align: 'right' });
  }

  // Safe filename
  const cleanStudentName = String(summon.studentName || 'Siswa').replace(/\s+/g, '_');
  const cleanDocIdentifier = String(summon.letterNumber || summon.id || 'BA').replace(/[\/\s]/g, '_');
  const filename = `Berita_Acara_Kehadiran_OrangTua_${cleanStudentName}_${cleanDocIdentifier}.pdf`;

  finalizeAndSavePdf(doc, filename, {
    category: 'berita_acara',
    studentName: summon.studentName,
    successToastMessage: 'Berita Acara Kehadiran Orang Tua berhasil diunduh & diarsipkan!',
  });
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

  const filename = `Laporan_Analitik_BK_Kelas_${filterClass.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'rekap',
    studentName: `Analitik_Kelas_${filterClass}`,
    successToastMessage: 'Laporan Analitik BK berhasil diunduh!',
  });
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

  const filename = `Surat_Perjanjian_${record.letterNumber.replace(/\//g, '_')}_${record.studentName.replace(/\s+/g, '_')}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'perjanjian',
    studentName: record.studentName,
    successToastMessage: 'Surat Perjanjian Siswa & Ortu berhasil diunduh!',
  });
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

  const filename = `Kontrak_Perilaku_${contract.contractNumber.replace(/\//g, '_')}_${contract.studentName.replace(/\s+/g, '_')}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'kontrak',
    studentName: contract.studentName,
    successToastMessage: 'Kontrak Perilaku Siswa berhasil diunduh!',
  });
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
  const filename = `Laporan_Rekap_BK_${cleanStart}_sd_${cleanEnd}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'rekap',
    studentName: `Rekap_${startDate}_sd_${endDate}`,
    successToastMessage: 'Laporan Rekapitulasi BK berhasil diunduh!',
  });
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

  const filename = `Jurnal_Pembinaan_BK_${record.studentName.replace(/\s+/g, '_')}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'jurnal',
    studentName: record.studentName,
    successToastMessage: 'Jurnal Pembinaan Disiplin Restitusi berhasil diunduh!',
  });
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

  const filename = `Komitmen_RTL_BK_${record.studentName.replace(/\s+/g, '_')}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'rtl',
    studentName: record.studentName,
    successToastMessage: 'Lembar Komitmen & RTL berhasil diunduh!',
  });
}

/**
 * Generates an official, highly polished PDF report for a Home Visit (Kunjungan Rumah).
 */
export function downloadHomeVisitPDF(record: HomeVisitRecord) {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [0, 104, 95]; // #00685f (Teal)
    const darkColor = [11, 28, 48]; // #0b1c30 (Dark Slate)
    const grayColor = [61, 73, 71]; // #3d4947 (Charcoal)
    const lightGrayColor = [240, 244, 244]; // Light background
    const schoolConfig = getSchoolConfig();

    // 1. Draw Letterhead
    drawLetterhead(doc, primaryColor);

    // 2. Document Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('LAPORAN BUKTI KUNJUNGAN RUMAH (HOME VISIT)', 105, 45, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`Nomor Dokumen: ${record.reportNumber || '-'}`, 105, 51, { align: 'center' });

    // 3. I. IDENTITAS SISWA & WALI
    doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
    doc.rect(15, 58, 180, 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text('I. DATA DIRI SISWA & ORANG TUA/WALI', 20, 63.5);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    
    doc.text('Nama Siswa', 20, 72);
    doc.text(':', 55, 72);
    doc.setFont('Helvetica', 'bold');
    doc.text(String(record.studentName || '-'), 60, 72);

    doc.setFont('Helvetica', 'normal');
    doc.text('NISN', 20, 77);
    doc.text(':', 55, 77);
    doc.text(String(record.studentNis || '-'), 60, 77);

    doc.text('Kelas', 20, 82);
    doc.text(':', 55, 82);
    doc.text(String(record.studentClass || '-'), 60, 82);

    doc.text('Wali yang Ditemui', 20, 87);
    doc.text(':', 55, 87);
    doc.setFont('Helvetica', 'bold');
    doc.text(String(record.parentNameMet || '-'), 60, 87);

    doc.setFont('Helvetica', 'normal');
    doc.text('Alamat Kunjungan', 20, 92);
    doc.text(':', 55, 92);
    const splitAddress = doc.splitTextToSize(record.address || '-', 130);
    doc.text(splitAddress, 60, 92);

    const afterAddressY = 92 + (splitAddress.length * 4.5) + 3;

    // 4. II. DETAIL KUNJUNGAN & TEMUAN
    doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
    doc.rect(15, afterAddressY, 180, 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.text('II. MAKSUD, TEMUAN & SOLUSI KUNJUNGAN RUMAH', 20, afterAddressY + 5);

    let contentY = afterAddressY + 14;
    doc.setFont('Helvetica', 'bold');
    doc.text('Tanggal Kunjungan:', 20, contentY);
    doc.setFont('Helvetica', 'normal');
    const dateFormatted = record.date ? new Date(record.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
    doc.text(dateFormatted, 55, contentY);

    if (record.bidangBimbingan) {
      contentY += 6;
      doc.setFont('Helvetica', 'bold');
      doc.text('Bidang Bimbingan:', 20, contentY);
      doc.setFont('Helvetica', 'normal');
      doc.text(record.bidangBimbingan.includes('Non-Bidang') ? 'Non-Bidang (Dukungan Sistem)' : `Bidang ${record.bidangBimbingan}`, 55, contentY);
    }

    contentY += 6;
    doc.setFont('Helvetica', 'bold');
    doc.text('Tujuan / Masalah:', 20, contentY);
    doc.setFont('Helvetica', 'normal');
    const splitPurpose = doc.splitTextToSize(record.purpose || '-', 170);
    doc.text(splitPurpose, 20, contentY + 5);

    contentY += (splitPurpose.length * 4.5) + 8;
    doc.setFont('Helvetica', 'bold');
    doc.text('Hasil Kunjungan (Temuan):', 20, contentY);
    doc.setFont('Helvetica', 'normal');
    const splitResult = doc.splitTextToSize(record.result || '-', 170);
    doc.text(splitResult, 20, contentY + 5);

    contentY += (splitResult.length * 4.5) + 8;
    doc.setFont('Helvetica', 'bold');
    doc.text('Kesepakatan / Tindak Lanjut:', 20, contentY);
    doc.setFont('Helvetica', 'normal');
    const splitAgreement = doc.splitTextToSize(record.agreement || '-', 170);
    doc.text(splitAgreement, 20, contentY + 5);

    contentY += (splitAgreement.length * 4.5) + 8;

    // Check photo attachment
    let photoBlockHeight = 0;
    if (record.photoUrl) {
      photoBlockHeight = 55;
    }

    const signaturesHeight = 45;
    const totalSpaceNeeded = photoBlockHeight + signaturesHeight + 10;

    if (contentY + totalSpaceNeeded > 275) {
      doc.addPage();
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.8);
      doc.line(15, 15, 195, 15);

      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 130);
      doc.text(`Bukti Home Visit: ${record.studentName || '-'} (${record.reportNumber || '-'}) - Halaman 2`, 15, 12);
      contentY = 22;
    }

    // 5. DRAW PHOTO ATTACHMENT IF AVAILABLE
    if (record.photoUrl) {
      try {
        doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
        doc.rect(15, contentY, 180, 7, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.text('III. DOKUMENTASI KEGIATAN (FOTO BUKTI KUNJUNGAN)', 20, contentY + 4.5);
        
        contentY += 10;
        
        const format = record.photoUrl.toLowerCase().includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(record.photoUrl, format, 15, contentY, 65, 40);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        doc.text(`Lampiran Berkas: ${record.photoName || 'foto_visit.jpg'}`, 85, contentY + 15);
        doc.text('Keterangan: Foto diambil di lokasi kunjungan sebagai bukti fisik sah', 85, contentY + 20);
        doc.text(`pelaksanaan layanan bimbingan konseling Guru BK ${schoolConfig.schoolName}.`, 85, contentY + 24);

        contentY += 46;
      } catch (err) {
        console.error('Error rendering image in PDF:', err);
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(180, 50, 50);
        doc.text('([Foto terlampir dalam arsip sistem])', 20, contentY + 5);
        contentY += 10;
      }
    }

    // 6. IV. SIGNATURES
    if (contentY + 45 > 275) {
      doc.addPage();
      drawLetterhead(doc, primaryColor);
      contentY = 45;
    } else {
      contentY = Math.max(contentY, 215);
    }
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

    doc.text('Mengetahui,', 20, contentY);
    doc.text('Orang Tua / Wali Murid,', 20, contentY + 5);

    if (record.parentSignature) {
      try {
        doc.addImage(record.parentSignature, 'PNG', 24, contentY + 7, 36, 18);
      } catch (err) {
        console.error('Error rendering parent signature on PDF:', err);
      }
    }

    doc.line(20, contentY + 28, 70, contentY + 28);
    doc.setFont('Helvetica', 'bold');
    const parentCleanName = (record.parentNameMet || 'Orang Tua / Wali').replace('Bapak / Ibu Wali dari ', '');
    doc.text(parentCleanName, 20, contentY + 27);

    doc.setFont('Helvetica', 'normal');
    const locCity = schoolConfig.schoolAddress?.toLowerCase().includes('susukan') ? 'Susukan' : 'Tempat';
    doc.text(`${locCity}, ` + dateFormatted, 125, contentY);
    doc.text('Guru Pembimbing / Konselor BK,', 125, contentY + 5);

    if (record.counselorSignature) {
      try {
        doc.addImage(record.counselorSignature, 'PNG', 128, contentY + 7, 36, 18);
      } catch (err) {
        console.error('Error rendering counselor signature on PDF:', err);
      }
    }

    doc.line(125, contentY + 28, 180, contentY + 28);
    doc.setFont('Helvetica', 'bold');
    doc.text(record.counselorName || 'Guru BK', 125, contentY + 27);
    doc.setFont('Helvetica', 'normal');
    doc.text(record.counselorId ? `NIP/ID. ${record.counselorId}` : 'Guru Bimbingan Konseling', 125, contentY + 32);

    // Page footer layout
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 130);
    doc.text(`Dicetak otomatis melalui Portal BK ${schoolConfig.schoolName} pada ${new Date().toLocaleDateString('id-ID')} | Sifat: Dokumen Rahasia BK`, 15, 282);

    const filename = `Laporan_Home_Visit_${(record.reportNumber || 'Doc').replace(/[^a-zA-Z0-9-_]/g, '_')}_${(record.studentName || 'Siswa').replace(/\s+/g, '_')}.pdf`;
    finalizeAndSavePdf(doc, filename, {
      category: 'homevisit',
      studentName: record.studentName,
      successToastMessage: 'Dokumen PDF Laporan Home Visit berhasil diterbitkan & diunduh!',
    });
  } catch (error) {
    console.error('Gagal membuat PDF Home Visit:', error);
    showToast('Gagal menerbitkan PDF Home Visit. Periksa kelengkapan data.', 'error');
  }
}

/**
 * Draws official Kop Surat / Letterhead in Landscape A4 (297mm width)
 */
export function drawLandscapeLetterhead(doc: jsPDF, accentColor: number[]) {
  const config = getSchoolConfig();

  // Top border line across landscape width (15 to 282)
  doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setLineWidth(1.2);
  doc.line(15, 12, 282, 12);

  // Logo Left (X=26, Y=24, R=9)
  const customKabupatenLogo = config.customKabupatenLogo || (typeof localStorage !== 'undefined' ? localStorage.getItem('bk_custom_kabupaten_logo') : null);
  if (customKabupatenLogo) {
    try {
      const kabFormat = customKabupatenLogo.toLowerCase().includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(customKabupatenLogo, kabFormat, 17, 15, 18, 18);
    } catch (e) {
      drawKabSemarangLogo(doc, 26, 24, 9);
    }
  } else {
    drawKabSemarangLogo(doc, 26, 24, 9);
  }

  // Logo Right (X=271, Y=24, R=9)
  const customSchoolLogo = config.customSchoolLogo || (typeof localStorage !== 'undefined' ? localStorage.getItem('bk_custom_school_logo') : null);
  if (customSchoolLogo) {
    try {
      const schoolFormat = customSchoolLogo.toLowerCase().includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(customSchoolLogo, schoolFormat, 262, 15, 18, 18);
    } catch (e) {
      drawSchoolLogo(doc, 271, 24, 9);
    }
  } else {
    drawSchoolLogo(doc, 271, 24, 9);
  }

  // Text in center (X=148.5)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(11, 28, 48);
  doc.text(config.governmentName.toUpperCase(), 148.5, 17, { align: 'center' });
  doc.text(config.departmentName.toUpperCase(), 148.5, 21, { align: 'center' });
  
  doc.setFontSize(13);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(config.schoolName.toUpperCase(), 148.5, 26, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(61, 73, 71);
  doc.text(config.schoolAddress, 148.5, 30, { align: 'center' });

  // Double Line Separator
  doc.setDrawColor(11, 28, 48);
  doc.setLineWidth(0.6);
  doc.line(15, 33, 282, 33);
  doc.setLineWidth(0.2);
  doc.line(15, 34, 282, 34);
}

export interface RekapHomeVisitOptions {
  startDate: string;
  endDate: string;
  selectedClass?: string;
  homeVisits: any[];
  activeCounselor: Counselor;
}

/**
 * 1. BUKU REGISTER REKAPITULASI KUNJUNGAN RUMAH (HOME VISIT)
 * Dedicated official document customized strictly for Home Visit instrument records
 */
export function downloadRekapHomeVisitPDF(options: RekapHomeVisitOptions) {
  const { startDate, endDate, selectedClass = 'semua', homeVisits = [], activeCounselor } = options;
  const schoolConfig = getSchoolConfig();
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4 (297 x 210 mm)
  const primaryTeal = [0, 104, 95];
  const darkSlate = [11, 28, 48];

  drawLandscapeLetterhead(doc, primaryTeal);

  let currentY = 40;

  const checkPageOverflow = (neededSpace: number = 15) => {
    if (currentY + neededSpace > 185) {
      doc.addPage('a4', 'l');
      currentY = 18;

      doc.setDrawColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
      doc.setLineWidth(0.8);
      doc.line(15, 12, 282, 12);

      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 110);
      doc.text(`Buku Register Rekapitulasi Home Visit - ${schoolConfig.schoolName} (Lanjutan)`, 15, 16);
      currentY = 22;
      return true;
    }
    return false;
  };

  // Title Box
  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(188, 201, 198);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, currentY, 267, 18, 2, 2, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('BUKU REGISTER REKAPITULASI KUNJUNGAN RUMAH (HOME VISIT)', 148.5, currentY + 6.5, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(61, 73, 71);
  const classLabel = selectedClass === 'semua' ? 'Semua Kelas' : `Kelas ${selectedClass}`;
  doc.text(
    `Periode: ${formatIndonesianDate(startDate)} s.d. ${formatIndonesianDate(endDate)}   |   Lingkup Sasaran: ${classLabel}   |   Petugas Pembimbing: ${activeCounselor.name}`,
    148.5,
    currentY + 12.5,
    { align: 'center' }
  );

  currentY += 22;

  // Metric Summary Bar
  doc.setFillColor(250, 252, 252);
  doc.setDrawColor(220, 230, 228);
  doc.roundedRect(15, currentY, 267, 10, 1.5, 1.5, 'FD');

  const uniqueStudents = new Set(homeVisits.map((h: any) => h.studentName)).size;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`Total Agenda Kunjungan: ${homeVisits.length} Kali`, 20, currentY + 6.5);
  doc.text(`Siswa Terlayani Home Visit: ${uniqueStudents} Orang`, 105, currentY + 6.5);
  doc.text(`Sifat Dokumen: Instrumen Resmi & Rahasia BK`, 215, currentY + 6.5);

  currentY += 13;

  // Table Headers
  const renderHeaders = () => {
    doc.setFillColor(0, 104, 95);
    doc.rect(15, currentY, 267, 6.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);

    let x = 15;
    doc.text('No', x + 4, currentY + 4.5, { align: 'center' }); x += 8;
    doc.text('No. Laporan', x + 2, currentY + 4.5); x += 25;
    doc.text('Tgl Kunjungan', x + 2, currentY + 4.5); x += 22;
    doc.text('Nama Siswa', x + 2, currentY + 4.5); x += 36;
    doc.text('NIS / Kelas', x + 2, currentY + 4.5); x += 22;
    doc.text('Wali yang Ditemui', x + 2, currentY + 4.5); x += 32;
    doc.text('Alamat Rumah Dikunjungi', x + 2, currentY + 4.5); x += 40;
    doc.text('Bidang & Maksud Kunjungan', x + 2, currentY + 4.5); x += 40;
    doc.text('Hasil Temuan & Kesepakatan RTL', x + 2, currentY + 4.5);
    currentY += 6.5;
  };

  renderHeaders();

  if (homeVisits.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 110, 110);
    doc.text('Tidak terdapat catatan kunjungan rumah (Home Visit) pada periode dan kelas yang dipilih.', 20, currentY + 8);
    currentY += 16;
  } else {
    homeVisits.forEach((hv, idx) => {
      const reportNum = hv.reportNumber || `HV-${idx + 1}`;
      const studentName = hv.studentName || '-';
      const nisClass = `${hv.studentNis || '-'} / ${hv.studentClass || '-'}`;
      const parentMet = hv.parentNameMet || hv.parentName || 'Orang Tua / Wali';
      const address = hv.address || '-';
      const purpose = hv.purpose || hv.reason || `Bidang ${hv.bidangBimbingan || 'Pribadi'}`;
      const agreement = hv.agreement || hv.result || '-';

      const splitName = doc.splitTextToSize(studentName, 34);
      const splitParent = doc.splitTextToSize(parentMet, 30);
      const splitAddress = doc.splitTextToSize(address, 38);
      const splitPurpose = doc.splitTextToSize(purpose, 38);
      const splitAgreement = doc.splitTextToSize(agreement, 40);

      const maxLines = Math.max(
        splitName.length,
        splitParent.length,
        splitAddress.length,
        splitPurpose.length,
        splitAgreement.length
      );
      const rowHeight = Math.max(7, maxLines * 3.4 + 2.5);

      if (checkPageOverflow(rowHeight)) {
        renderHeaders();
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 249);
        doc.rect(15, currentY, 267, rowHeight, 'F');
      }

      let curX = 15;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

      doc.text(`${idx + 1}`, curX + 4, currentY + 4, { align: 'center' }); curX += 8;
      
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
      doc.text(reportNum, curX + 2, currentY + 4); curX += 25;

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.text(hv.date || hv.visitDate || '-', curX + 2, currentY + 4); curX += 22;

      doc.setFont('Helvetica', 'bold');
      doc.text(splitName, curX + 2, currentY + 4); curX += 36;

      doc.setFont('Helvetica', 'normal');
      doc.text(nisClass, curX + 2, currentY + 4); curX += 22;

      doc.text(splitParent, curX + 2, currentY + 4); curX += 32;
      doc.text(splitAddress, curX + 2, currentY + 4); curX += 40;
      doc.text(splitPurpose, curX + 2, currentY + 4); curX += 40;
      doc.text(splitAgreement, curX + 2, currentY + 4);

      doc.setDrawColor(230, 235, 233);
      doc.setLineWidth(0.1);
      doc.line(15, currentY + rowHeight, 282, currentY + rowHeight);

      currentY += rowHeight;
    });
  }

  // Lembar Pengesahan
  checkPageOverflow(35);
  currentY += 4;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(40, 50, 50);

  const locCity = schoolConfig.schoolAddress?.toLowerCase().includes('susukan') ? 'Susukan' : 'Semarang';
  const todayFormatted = formatIndonesianDate(new Date().toISOString().split('T')[0]);
  doc.text(`Ditetapkan di: ${locCity}`, 215, currentY);
  doc.text(`Pada Tanggal: ${todayFormatted}`, 215, currentY + 4);

  currentY += 8;
  doc.setFont('Helvetica', 'bold');
  doc.text('Mengetahui,', 25, currentY);
  doc.text('Guru Bimbingan dan Konseling,', 215, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.text('Kepala Sekolah', 25, currentY + 4);

  currentY += 18;

  // Signatures
  doc.setFont('Helvetica', 'bold');
  doc.text(schoolConfig.principalName, 25, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${schoolConfig.principalNip || '-'}`, 25, currentY + 4);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(activeCounselor.name, 215, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${activeCounselor.nip || '-'}`, 215, currentY + 4);

  const filename = `Rekap_Home_Visit_${classLabel.replace(/\s+/g, '_')}_${startDate}_sd_${endDate}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'homevisit',
    successToastMessage: '📄 Rekapitulasi Home Visit (PDF) berhasil diunduh!',
  });
}

export interface RekapPelanggaranOptions {
  startDate: string;
  endDate: string;
  selectedClass?: string;
  violations: ViolationRecord[];
  activeCounselor: Counselor;
}

/**
 * 2. BUKU REGISTER REKAPITULASI PELANGGARAN & TATA TERTIB SISWA
 * Dedicated official document customized strictly for Student Violations & Discipline
 */
export function downloadRekapPelanggaranPDF(options: RekapPelanggaranOptions) {
  const { startDate, endDate, selectedClass = 'semua', violations = [], activeCounselor } = options;
  const schoolConfig = getSchoolConfig();
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4 (297 x 210 mm)
  const primaryTeal = [0, 104, 95];
  const darkSlate = [11, 28, 48];

  drawLandscapeLetterhead(doc, primaryTeal);

  let currentY = 40;

  const checkPageOverflow = (neededSpace: number = 15) => {
    if (currentY + neededSpace > 185) {
      doc.addPage('a4', 'l');
      currentY = 18;

      doc.setDrawColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
      doc.setLineWidth(0.8);
      doc.line(15, 12, 282, 12);

      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 110);
      doc.text(`Buku Register Rekapitulasi Pelanggaran & Tata Tertib - ${schoolConfig.schoolName} (Lanjutan)`, 15, 16);
      currentY = 22;
      return true;
    }
    return false;
  };

  // Title Box
  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(188, 201, 198);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, currentY, 267, 18, 2, 2, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('BUKU REGISTER REKAPITULASI PELANGGARAN & TATA TERTIB SISWA', 148.5, currentY + 6.5, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(61, 73, 71);
  const classLabel = selectedClass === 'semua' ? 'Semua Kelas' : `Kelas ${selectedClass}`;
  doc.text(
    `Periode: ${formatIndonesianDate(startDate)} s.d. ${formatIndonesianDate(endDate)}   |   Lingkup Sasaran: ${classLabel}   |   Petugas BK / Piket: ${activeCounselor.name}`,
    148.5,
    currentY + 12.5,
    { align: 'center' }
  );

  currentY += 22;

  // Metric Summary Bar
  doc.setFillColor(250, 252, 252);
  doc.setDrawColor(220, 230, 228);
  doc.roundedRect(15, currentY, 267, 10, 1.5, 1.5, 'FD');

  const totalPoints = violations.reduce((acc, v) => acc + (v.pointsAdded || 0), 0);
  const uniqueStudents = new Set(violations.map((v) => v.studentName)).size;
  const completedCases = violations.filter((v) => (v.handlingProgress || '').toLowerCase().includes('selesai')).length;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`Total Kasus Pelanggaran: ${violations.length} Kasus`, 20, currentY + 6.5);
  doc.text(`Akumulasi Poin: +${totalPoints} Bobot`, 90, currentY + 6.5);
  doc.text(`Peserta Didik Terlibat: ${uniqueStudents} Orang`, 155, currentY + 6.5);
  doc.text(`Status Selesai: ${completedCases} Kasus`, 225, currentY + 6.5);

  currentY += 13;

  // Table Headers
  const renderHeaders = () => {
    doc.setFillColor(180, 40, 40); // Discipline Maroon Accent
    doc.rect(15, currentY, 267, 6.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);

    let x = 15;
    doc.text('No', x + 4, currentY + 4.5, { align: 'center' }); x += 8;
    doc.text('Tanggal & Jam', x + 2, currentY + 4.5); x += 24;
    doc.text('Nama Siswa', x + 2, currentY + 4.5); x += 36;
    doc.text('NIS / NISN', x + 2, currentY + 4.5); x += 20;
    doc.text('Kelas', x + 7, currentY + 4.5, { align: 'center' }); x += 14;
    doc.text('Bentuk Pelanggaran Tata Tertib', x + 2, currentY + 4.5); x += 55;
    doc.text('Kategori', x + 2, currentY + 4.5); x += 28;
    doc.text('Poin', x + 6, currentY + 4.5, { align: 'center' }); x += 12;
    doc.text('Sanksi / Tindakan Pembinaan', x + 2, currentY + 4.5); x += 40;
    doc.text('Petugas Pelapor & Status', x + 2, currentY + 4.5);
    currentY += 6.5;
  };

  renderHeaders();

  if (violations.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 110, 110);
    doc.text('Tidak terdapat catatan pelanggaran tata tertib pada periode dan kelas yang dipilih.', 20, currentY + 8);
    currentY += 16;
  } else {
    violations.forEach((v, idx) => {
      const studentName = v.studentName || '-';
      const studentNis = (v as any).studentNis || '-';
      const studentClass = v.studentClass || '-';
      const violationName = v.category || '-';
      const cat = (v as any).violationType || 'Kedisiplinan';
      const points = `+${v.pointsAdded || 0}`;
      const action = v.handlingProgress || v.notes || 'Pembinaan Wali Kelas & BK';
      const reporter = `${v.reportedBy || 'Piket'} (${v.handledBy || 'Diproses'})`;

      const splitName = doc.splitTextToSize(studentName, 34);
      const splitViolation = doc.splitTextToSize(violationName, 53);
      const splitCat = doc.splitTextToSize(cat, 26);
      const splitAction = doc.splitTextToSize(action, 38);
      const splitReporter = doc.splitTextToSize(reporter, 28);

      const maxLines = Math.max(
        splitName.length,
        splitViolation.length,
        splitCat.length,
        splitAction.length,
        splitReporter.length
      );
      const rowHeight = Math.max(7, maxLines * 3.4 + 2.5);

      if (checkPageOverflow(rowHeight)) {
        renderHeaders();
      }

      if (idx % 2 === 1) {
        doc.setFillColor(254, 248, 248);
        doc.rect(15, currentY, 267, rowHeight, 'F');
      }

      let curX = 15;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

      doc.text(`${idx + 1}`, curX + 4, currentY + 4, { align: 'center' }); curX += 8;
      doc.text(`${v.date}\n${v.time || '07:30'}`, curX + 2, currentY + 3.6); curX += 24;

      doc.setFont('Helvetica', 'bold');
      doc.text(splitName, curX + 2, currentY + 4); curX += 36;

      doc.setFont('Helvetica', 'normal');
      doc.text(studentNis, curX + 2, currentY + 4); curX += 20;

      doc.text(studentClass, curX + 7, currentY + 4, { align: 'center' }); curX += 14;

      doc.text(splitViolation, curX + 2, currentY + 4); curX += 55;
      doc.text(splitCat, curX + 2, currentY + 4); curX += 28;

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(190, 30, 30);
      doc.text(points, curX + 6, currentY + 4, { align: 'center' }); curX += 12;

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.text(splitAction, curX + 2, currentY + 4); curX += 40;
      doc.text(splitReporter, curX + 2, currentY + 4);

      doc.setDrawColor(235, 230, 230);
      doc.setLineWidth(0.1);
      doc.line(15, currentY + rowHeight, 282, currentY + rowHeight);

      currentY += rowHeight;
    });
  }

  // Lembar Pengesahan
  checkPageOverflow(35);
  currentY += 4;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(40, 50, 50);

  const locCity = schoolConfig.schoolAddress?.toLowerCase().includes('susukan') ? 'Susukan' : 'Semarang';
  const todayFormatted = formatIndonesianDate(new Date().toISOString().split('T')[0]);
  doc.text(`Ditetapkan di: ${locCity}`, 215, currentY);
  doc.text(`Pada Tanggal: ${todayFormatted}`, 215, currentY + 4);

  currentY += 8;
  doc.setFont('Helvetica', 'bold');
  doc.text('Mengetahui,', 25, currentY);
  doc.text('Guru Pembimbing BK / Tatib,', 215, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.text('Kepala Sekolah', 25, currentY + 4);

  currentY += 18;

  // Signatures
  doc.setFont('Helvetica', 'bold');
  doc.text(schoolConfig.principalName, 25, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${schoolConfig.principalNip || '-'}`, 25, currentY + 4);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(activeCounselor.name, 215, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${activeCounselor.nip || '-'}`, 215, currentY + 4);

  const filename = `Rekap_Pelanggaran_${classLabel.replace(/\s+/g, '_')}_${startDate}_sd_${endDate}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'pelanggaran',
    successToastMessage: '📄 Rekapitulasi Pelanggaran Siswa (PDF) berhasil diunduh!',
  });
}

export interface RekapLayananOptions {
  startDate: string;
  endDate: string;
  selectedClass?: string;
  services: CounselingService[];
  activeCounselor: Counselor;
}

/**
 * 3. BUKU AGENDA REKAPITULASI LAYANAN BIMBINGAN DAN KONSELING
 * Dedicated official document customized strictly for Counseling Services
 */
export function downloadRekapLayananPDF(options: RekapLayananOptions) {
  const { startDate, endDate, selectedClass = 'semua', services = [], activeCounselor } = options;
  const schoolConfig = getSchoolConfig();
  const doc = new jsPDF('l', 'mm', 'a4');
  const primaryTeal = [0, 104, 95];
  const darkSlate = [11, 28, 48];

  drawLandscapeLetterhead(doc, primaryTeal);

  let currentY = 40;

  const checkPageOverflow = (neededSpace: number = 15) => {
    if (currentY + neededSpace > 185) {
      doc.addPage('a4', 'l');
      currentY = 18;

      doc.setDrawColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
      doc.setLineWidth(0.8);
      doc.line(15, 12, 282, 12);

      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 110);
      doc.text(`Buku Agenda Rekapitulasi Layanan BK - ${schoolConfig.schoolName} (Lanjutan)`, 15, 16);
      currentY = 22;
      return true;
    }
    return false;
  };

  // Title Box
  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(188, 201, 198);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, currentY, 267, 18, 2, 2, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('BUKU AGENDA REKAPITULASI LAYANAN BIMBINGAN DAN KONSELING', 148.5, currentY + 6.5, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(61, 73, 71);
  const classLabel = selectedClass === 'semua' ? 'Semua Kelas' : `Kelas ${selectedClass}`;
  doc.text(
    `Periode: ${formatIndonesianDate(startDate)} s.d. ${formatIndonesianDate(endDate)}   |   Lingkup Sasaran: ${classLabel}   |   Guru BK: ${activeCounselor.name}`,
    148.5,
    currentY + 12.5,
    { align: 'center' }
  );

  currentY += 22;

  // Metric Summary Bar
  doc.setFillColor(250, 252, 252);
  doc.setDrawColor(220, 230, 228);
  doc.roundedRect(15, currentY, 267, 10, 1.5, 1.5, 'FD');

  const completed = services.filter((s) => s.status === 'Selesai').length;
  const uniqueStudents = new Set(services.flatMap((s) => s.students.map((st) => st.name))).size;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`Total Sesi Layanan: ${services.length} Sesi`, 20, currentY + 6.5);
  doc.text(`Siswa Terlayani: ${uniqueStudents} Siswa`, 105, currentY + 6.5);
  doc.text(`Status Terlaksana / Selesai: ${completed} Sesi`, 190, currentY + 6.5);

  currentY += 13;

  // Table Headers
  const renderHeaders = () => {
    doc.setFillColor(0, 104, 95);
    doc.rect(15, currentY, 267, 6.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);

    let x = 15;
    doc.text('No', x + 4, currentY + 4.5, { align: 'center' }); x += 8;
    doc.text('Hari & Tanggal', x + 2, currentY + 4.5); x += 22;
    doc.text('Waktu / Jam', x + 2, currentY + 4.5); x += 16;
    doc.text('Nama Siswa (Konseli)', x + 2, currentY + 4.5); x += 38;
    doc.text('Kelas', x + 7, currentY + 4.5, { align: 'center' }); x += 14;
    doc.text('Jenis Layanan', x + 2, currentY + 4.5); x += 32;
    doc.text('Bidang', x + 2, currentY + 4.5); x += 22;
    doc.text('Komponen Pilar', x + 2, currentY + 4.5); x += 25;
    doc.text('Topik / Pokok Masalah', x + 2, currentY + 4.5); x += 48;
    doc.text('Solusi / RTL & Status', x + 2, currentY + 4.5);
    currentY += 6.5;
  };

  renderHeaders();

  if (services.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 110, 110);
    doc.text('Tidak ada rekam catatan sesi layanan BK pada rentang waktu yang dipilih.', 20, currentY + 8);
    currentY += 16;
  } else {
    services.forEach((srv, idx) => {
      const studentNames = srv.students.map((st) => st.name).join(', ');
      const classNames = Array.from(new Set(srv.students.map((st) => st.class))).join(', ');
      const timeStr = `${srv.startTime || '08:00'} - ${srv.endTime || '08:45'}`;
      const splitNames = doc.splitTextToSize(studentNames || '-', 36);
      const splitType = doc.splitTextToSize(srv.serviceType || '-', 30);
      const splitProblem = doc.splitTextToSize(srv.problem || '-', 46);
      const splitFollowUp = doc.splitTextToSize(`${srv.followUp || '-'}: [${srv.status}]`, 40);

      const maxLines = Math.max(
        splitNames.length,
        splitType.length,
        splitProblem.length,
        splitFollowUp.length
      );
      const rowHeight = Math.max(7, maxLines * 3.4 + 2.5);

      if (checkPageOverflow(rowHeight)) {
        renderHeaders();
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 249);
        doc.rect(15, currentY, 267, rowHeight, 'F');
      }

      let curX = 15;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

      doc.text(`${idx + 1}`, curX + 4, currentY + 4, { align: 'center' }); curX += 8;
      doc.text(srv.date, curX + 2, currentY + 4); curX += 22;
      doc.text(timeStr, curX + 2, currentY + 4); curX += 16;

      doc.setFont('Helvetica', 'bold');
      doc.text(splitNames, curX + 2, currentY + 4); curX += 38;

      doc.setFont('Helvetica', 'normal');
      doc.text(classNames, curX + 7, currentY + 4, { align: 'center' }); curX += 14;

      doc.text(splitType, curX + 2, currentY + 4); curX += 32;
      doc.text(`Bidang ${srv.bidangBimbingan || 'Pribadi'}`, curX + 2, currentY + 4); curX += 22;
      doc.text(srv.bkComponent || 'Responsif', curX + 2, currentY + 4); curX += 25;
      doc.text(splitProblem, curX + 2, currentY + 4); curX += 48;
      doc.text(splitFollowUp, curX + 2, currentY + 4);

      doc.setDrawColor(230, 235, 233);
      doc.setLineWidth(0.1);
      doc.line(15, currentY + rowHeight, 282, currentY + rowHeight);

      currentY += rowHeight;
    });
  }

  // Lembar Pengesahan
  checkPageOverflow(35);
  currentY += 4;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(40, 50, 50);

  const locCity = schoolConfig.schoolAddress?.toLowerCase().includes('susukan') ? 'Susukan' : 'Semarang';
  const todayFormatted = formatIndonesianDate(new Date().toISOString().split('T')[0]);
  doc.text(`Ditetapkan di: ${locCity}`, 215, currentY);
  doc.text(`Pada Tanggal: ${todayFormatted}`, 215, currentY + 4);

  currentY += 8;
  doc.setFont('Helvetica', 'bold');
  doc.text('Mengetahui,', 25, currentY);
  doc.text('Guru Bimbingan dan Konseling,', 215, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.text('Kepala Sekolah', 25, currentY + 4);

  currentY += 18;

  // Signatures
  doc.setFont('Helvetica', 'bold');
  doc.text(schoolConfig.principalName, 25, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${schoolConfig.principalNip || '-'}`, 25, currentY + 4);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(activeCounselor.name, 215, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${activeCounselor.nip || '-'}`, 215, currentY + 4);

  const filename = `Rekap_Layanan_BK_${classLabel.replace(/\s+/g, '_')}_${startDate}_sd_${endDate}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'layanan',
    successToastMessage: '📄 Rekapitulasi Layanan BK (PDF) berhasil diunduh!',
  });
}

export interface RekapSiswaKritisOptions {
  startDate: string;
  endDate: string;
  selectedClass?: string;
  criticalStudentsList: any[];
  activeCounselor: Counselor;
}

/**
 * 4. DAFTAR REKAPITULASI SISWA PRIORITAS PEMBINAAN KHUSUS (STATUS KRITIS)
 * Dedicated official document customized strictly for At-Risk and Critical Students
 */
export function downloadRekapSiswaKritisPDF(options: RekapSiswaKritisOptions) {
  const { startDate, endDate, selectedClass = 'semua', criticalStudentsList = [], activeCounselor } = options;
  const schoolConfig = getSchoolConfig();
  const doc = new jsPDF('l', 'mm', 'a4');
  const primaryTeal = [0, 104, 95];
  const darkSlate = [11, 28, 48];

  drawLandscapeLetterhead(doc, primaryTeal);

  let currentY = 40;

  const checkPageOverflow = (neededSpace: number = 15) => {
    if (currentY + neededSpace > 185) {
      doc.addPage('a4', 'l');
      currentY = 18;

      doc.setDrawColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
      doc.setLineWidth(0.8);
      doc.line(15, 12, 282, 12);

      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 110);
      doc.text(`Daftar Rekapitulasi Siswa Kritis & Pembinaan Khusus - ${schoolConfig.schoolName} (Lanjutan)`, 15, 16);
      currentY = 22;
      return true;
    }
    return false;
  };

  // Title Box
  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(188, 201, 198);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, currentY, 267, 18, 2, 2, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('DAFTAR REKAPITULASI SISWA PRIORITAS PEMBINAAN KHUSUS (STATUS KRITIS)', 148.5, currentY + 6.5, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(61, 73, 71);
  const classLabel = selectedClass === 'semua' ? 'Semua Kelas' : `Kelas ${selectedClass}`;
  doc.text(
    `Periode: ${formatIndonesianDate(startDate)} s.d. ${formatIndonesianDate(endDate)}   |   Lingkup Sasaran: ${classLabel}   |   Koordinator BK: ${activeCounselor.name}`,
    148.5,
    currentY + 12.5,
    { align: 'center' }
  );

  currentY += 22;

  // Metric Summary Bar
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(15, currentY, 267, 10, 1.5, 1.5, 'FD');

  const countKritis = criticalStudentsList.filter((c) => c.riskLevel === 'Kritis').length;
  const countTinggi = criticalStudentsList.filter((c) => c.riskLevel === 'Tinggi').length;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 20, 20);
  doc.text(`Total Siswa Prioritas: ${criticalStudentsList.length} Orang`, 20, currentY + 6.5);
  doc.text(`Status Risiko Kritis (Merah): ${countKritis} Siswa`, 95, currentY + 6.5);
  doc.text(`Status Risiko Tinggi (Oranye): ${countTinggi} Siswa`, 175, currentY + 6.5);

  currentY += 13;

  // Table Headers
  const renderHeaders = () => {
    doc.setFillColor(180, 20, 20);
    doc.rect(15, currentY, 267, 6.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);

    let x = 15;
    doc.text('No', x + 4, currentY + 4.5, { align: 'center' }); x += 8;
    doc.text('NIS / NISN', x + 2, currentY + 4.5); x += 22;
    doc.text('Nama Peserta Didik', x + 2, currentY + 4.5); x += 42;
    doc.text('Kelas', x + 8, currentY + 4.5, { align: 'center' }); x += 16;
    doc.text('Poin Net', x + 8, currentY + 4.5, { align: 'center' }); x += 16;
    doc.text('Tot Alpa', x + 8, currentY + 4.5, { align: 'center' }); x += 16;
    doc.text('Tingkat Risiko', x + 2, currentY + 4.5); x += 25;
    doc.text('Riwayat Kasus Dominan / Pelanggaran Terakhir', x + 2, currentY + 4.5); x += 62;
    doc.text('Rekomendasi Tindak Lanjut Khusus BK', x + 2, currentY + 4.5);
    currentY += 6.5;
  };

  renderHeaders();

  if (criticalStudentsList.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 110, 110);
    doc.text('Alhamdulillah, tidak terdapat siswa berstatus kritis maupun membutuhkan pembinaan khusus pada periode ini.', 20, currentY + 8);
    currentY += 16;
  } else {
    criticalStudentsList.forEach((item, idx) => {
      const studentName = item.student.name || '-';
      const studentNis = item.student.nis || '-';
      const studentClass = item.student.class || '-';
      const latestCase = item.latestViolation || '-';
      const recAction = item.recommendedAction || 'Konseling individual intensif, pembinaan wali kelas, dan koordinasi orang tua.';

      const splitName = doc.splitTextToSize(studentName, 40);
      const splitCase = doc.splitTextToSize(latestCase, 60);
      const splitRec = doc.splitTextToSize(recAction, 58);

      const maxLines = Math.max(splitName.length, splitCase.length, splitRec.length);
      const rowHeight = Math.max(7, maxLines * 3.4 + 2.5);

      if (checkPageOverflow(rowHeight)) {
        renderHeaders();
      }

      if (idx % 2 === 1) {
        doc.setFillColor(254, 248, 248);
        doc.rect(15, currentY, 267, rowHeight, 'F');
      }

      let curX = 15;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

      doc.text(`${idx + 1}`, curX + 4, currentY + 4, { align: 'center' }); curX += 8;
      doc.text(studentNis, curX + 2, currentY + 4); curX += 22;

      doc.setFont('Helvetica', 'bold');
      doc.text(splitName, curX + 2, currentY + 4); curX += 42;

      doc.setFont('Helvetica', 'normal');
      doc.text(studentClass, curX + 8, currentY + 4, { align: 'center' }); curX += 16;

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(180, 20, 20);
      doc.text(`${item.netPoints}`, curX + 8, currentY + 4, { align: 'center' }); curX += 16;

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.text(item.alpaCount > 0 ? `${item.alpaCount}x` : '-', curX + 8, currentY + 4, { align: 'center' }); curX += 16;

      doc.setFont('Helvetica', 'bold');
      if (item.riskLevel === 'Kritis') doc.setTextColor(180, 20, 20);
      else if (item.riskLevel === 'Tinggi') doc.setTextColor(190, 80, 0);
      else doc.setTextColor(0, 100, 150);
      doc.text(item.riskLevel || 'Sedang', curX + 2, currentY + 4); curX += 25;

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.text(splitCase, curX + 2, currentY + 4); curX += 62;
      doc.text(splitRec, curX + 2, currentY + 4);

      doc.setDrawColor(240, 220, 220);
      doc.setLineWidth(0.1);
      doc.line(15, currentY + rowHeight, 282, currentY + rowHeight);

      currentY += rowHeight;
    });
  }

  // Lembar Pengesahan
  checkPageOverflow(35);
  currentY += 4;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(40, 50, 50);

  const locCity = schoolConfig.schoolAddress?.toLowerCase().includes('susukan') ? 'Susukan' : 'Semarang';
  const todayFormatted = formatIndonesianDate(new Date().toISOString().split('T')[0]);
  doc.text(`Ditetapkan di: ${locCity}`, 215, currentY);
  doc.text(`Pada Tanggal: ${todayFormatted}`, 215, currentY + 4);

  currentY += 8;
  doc.setFont('Helvetica', 'bold');
  doc.text('Mengetahui,', 25, currentY);
  doc.text('Koordinator Bimbingan Konseling,', 215, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.text('Kepala Sekolah', 25, currentY + 4);

  currentY += 18;

  // Signatures
  doc.setFont('Helvetica', 'bold');
  doc.text(schoolConfig.principalName, 25, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${schoolConfig.principalNip || '-'}`, 25, currentY + 4);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(activeCounselor.name, 215, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${activeCounselor.nip || '-'}`, 215, currentY + 4);

  const filename = `Rekap_Siswa_Kritis_${classLabel.replace(/\s+/g, '_')}_${startDate}_sd_${endDate}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'rekap',
    successToastMessage: '📄 Rekapitulasi Siswa Kritis (PDF) berhasil diunduh!',
  });
}

/**
 * Generates an official "Laporan Layanan Bimbingan dan Konseling" for all filtered services.
 */
export function downloadRekapSemuaLayananPDF(options: {
  services: CounselingService[];
  filterInfo?: string;
  aiSummary?: string;
  counselorOverride?: any;
}) {
  const { services, filterInfo = '', aiSummary, counselorOverride } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const schoolConfig = getSchoolConfig();
  const signer = getActiveCounselorSigner(counselorOverride);

  const tealColor = [0, 104, 95];
  const darkNavy = [11, 28, 48];

  drawLetterhead(doc, tealColor);

  let currentY = 40;

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > 275) {
      doc.addPage();
      drawLetterhead(doc, tealColor);
      currentY = 42;
    }
  };

  // Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.text('LAPORAN LAYANAN BIMBINGAN DAN KONSELING', 105, currentY, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  const subtitleText = filterInfo 
    ? `Rekapitulasi Pelaksanaan Layanan Siswa — ${filterInfo}` 
    : 'Rekapitulasi Pelaksanaan Layanan Siswa Terpadu';
  doc.text(subtitleText, 105, currentY + 5, { align: 'center' });

  currentY += 10;

  // Metadata Bar
  doc.setFillColor(243, 246, 245);
  doc.roundedRect(15, currentY, 180, 7, 1.5, 1.5, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text(`Total Layanan: ${services.length} Sesi Terdata`, 20, currentY + 4.5);
  doc.text(`Tanggal Cetak: ${formatIndonesianDate(new Date().toISOString().slice(0, 10))}`, 190, currentY + 4.5, { align: 'right' });

  currentY += 10;

  // AI Summary Card if present
  if (aiSummary && aiSummary.trim()) {
    checkPageBreak(25);
    doc.setFillColor(238, 242, 255); // Indigo light
    doc.setDrawColor(199, 210, 254);
    doc.setLineWidth(0.3);
    
    const splitAi = doc.splitTextToSize(aiSummary.trim(), 170);
    const boxHeight = splitAi.length * 4 + 10;
    doc.roundedRect(15, currentY, 180, boxHeight, 2, 2, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(67, 56, 202);
    doc.text('✨ Ringkasan Eksekutif Bimbingan (Meta AI):', 20, currentY + 5);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(splitAi, 20, currentY + 9);

    currentY += boxHeight + 4;
  }

  // Table Header
  checkPageBreak(15);
  doc.setFillColor(0, 104, 95);
  doc.rect(15, currentY, 180, 7, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  doc.text('No', 17, currentY + 4.5);
  doc.text('Tanggal', 24, currentY + 4.5);
  doc.text('Nama Siswa', 46, currentY + 4.5);
  doc.text('Kelas', 80, currentY + 4.5);
  doc.text('Layanan', 93, currentY + 4.5);
  doc.text('Topik / Masalah', 126, currentY + 4.5);
  doc.text('Tindak Lanjut', 162, currentY + 4.5);

  currentY += 7;

  // Table Rows
  if (services.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 110);
    doc.text('Belum ada rekam layanan yang sesuai dengan filter.', 105, currentY + 6, { align: 'center' });
    currentY += 12;
  } else {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);

    // Sort newest first
    const sorted = [...services].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    sorted.forEach((srv, index) => {
      const studentNames = (srv.students || []).map(s => s.name).join(', ') || 'Siswa';
      const studentClasses = Array.from(new Set((srv.students || []).map(s => s.class))).join(', ') || '-';
      
      const splitStudent = doc.splitTextToSize(studentNames, 32);
      const splitService = doc.splitTextToSize(srv.serviceType || '-', 31);
      const splitProblem = doc.splitTextToSize(srv.problem || '-', 34);
      const splitFollowUp = doc.splitTextToSize(srv.followUp || srv.output || '-', 31);

      const maxLines = Math.max(
        splitStudent.length,
        splitService.length,
        splitProblem.length,
        splitFollowUp.length
      );
      const rowHeight = Math.max(7, maxLines * 3.5 + 2.5);

      checkPageBreak(rowHeight);

      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 249);
        doc.rect(15, currentY, 180, rowHeight, 'F');
      }

      doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
      doc.text(String(index + 1), 17, currentY + 4);
      doc.text(srv.date || '-', 24, currentY + 4);
      
      doc.setFont('Helvetica', 'bold');
      doc.text(splitStudent, 46, currentY + 4);
      
      doc.setFont('Helvetica', 'normal');
      doc.text(studentClasses, 80, currentY + 4);
      doc.text(splitService, 93, currentY + 4);
      doc.text(splitProblem, 126, currentY + 4);
      doc.text(splitFollowUp, 162, currentY + 4);

      // Separator
      doc.setDrawColor(220, 225, 225);
      doc.setLineWidth(0.1);
      doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

      currentY += rowHeight;
    });
  }

  // Signatures
  checkPageBreak(35);
  currentY += 6;

  const locCity = schoolConfig.schoolAddress?.toLowerCase().includes('susukan') ? 'Susukan' : 'Semarang';
  const todayFormatted = formatIndonesianDate(new Date().toISOString().slice(0, 10));

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);

  doc.text(`Ditetapkan di: ${locCity}`, 135, currentY);
  doc.text(`Pada Tanggal: ${todayFormatted}`, 135, currentY + 4);

  currentY += 8;
  doc.setFont('Helvetica', 'bold');
  doc.text('Mengetahui,', 20, currentY);
  doc.text('Kepala Sekolah', 20, currentY + 4);

  doc.text('Guru Bimbingan & Konseling,', 135, currentY + 4);

  currentY += 18;
  doc.text(schoolConfig.principalName, 20, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${schoolConfig.principalNip || '-'}`, 20, currentY + 4);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(signer.name, 135, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${signer.nip || '-'}`, 135, currentY + 4);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(120, 130, 130);
    doc.text(
      `Laporan Layanan BK ${schoolConfig.schoolName} | Hal ${i} dari ${totalPages} | Dicetak: ${todayFormatted}`,
      105,
      287,
      { align: 'center' }
    );
  }

  const filename = `Laporan_Layanan_BK_Semua_${new Date().toISOString().slice(0, 10)}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'layanan',
    successToastMessage: '📄 Laporan Rekapitulasi Layanan BK berhasil diunduh!',
  });
}

/**
 * Generates an official "Laporan Layanan Bimbingan dan Konseling" for a specific student (sorted newest first).
 */
export function downloadRekapLayananPerSiswaPDF(options: {
  student: Student;
  services: CounselingService[];
  aiSummary?: string;
  counselorOverride?: any;
}) {
  const { student, services, aiSummary, counselorOverride } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const schoolConfig = getSchoolConfig();
  const signer = getActiveCounselorSigner(counselorOverride);

  const tealColor = [0, 104, 95];
  const darkNavy = [11, 28, 48];

  drawLetterhead(doc, tealColor);

  let currentY = 40;

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > 275) {
      doc.addPage();
      drawLetterhead(doc, tealColor);
      currentY = 42;
    }
  };

  // Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.text('LAPORAN LAYANAN BIMBINGAN DAN KONSELING', 105, currentY, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text(`Rekam Jejak & Riwayat Layanan Konseling Peserta Didik`, 105, currentY + 5, { align: 'center' });

  currentY += 10;

  // Student Profile Card
  doc.setFillColor(243, 246, 245);
  doc.roundedRect(15, currentY, 180, 20, 2, 2, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('Nama Siswa', 20, currentY + 5);
  doc.setFont('Helvetica', 'normal');
  doc.text(`: ${student.name}`, 50, currentY + 5);

  doc.setFont('Helvetica', 'bold');
  doc.text('NIS / NISN', 20, currentY + 10);
  doc.setFont('Helvetica', 'normal');
  doc.text(`: ${student.nis || '-'}`, 50, currentY + 10);

  doc.setFont('Helvetica', 'bold');
  doc.text('Kelas Asuhan', 20, currentY + 15);
  doc.setFont('Helvetica', 'normal');
  doc.text(`: Kelas ${student.class}`, 50, currentY + 15);

  doc.setFont('Helvetica', 'bold');
  doc.text('Total Layanan', 120, currentY + 5);
  doc.setFont('Helvetica', 'normal');
  doc.text(`: ${services.length} Sesi Bimbingan & Konseling`, 145, currentY + 5);

  doc.setFont('Helvetica', 'bold');
  doc.text('Poin Kedisiplinan', 120, currentY + 10);
  doc.setFont('Helvetica', 'normal');
  doc.text(`: ${student.violationPoints || 0} Poin`, 145, currentY + 10);

  doc.setFont('Helvetica', 'bold');
  doc.text('Tanggal Cetak', 120, currentY + 15);
  doc.setFont('Helvetica', 'normal');
  doc.text(`: ${formatIndonesianDate(new Date().toISOString().slice(0, 10))}`, 145, currentY + 15);

  currentY += 24;

  // Meta AI Summary Box
  if (aiSummary && aiSummary.trim()) {
    checkPageBreak(25);
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(199, 210, 254);
    doc.setLineWidth(0.3);

    const splitAi = doc.splitTextToSize(aiSummary.trim(), 170);
    const boxHeight = splitAi.length * 4 + 10;
    doc.roundedRect(15, currentY, 180, boxHeight, 2, 2, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(67, 56, 202);
    doc.text(`✨ Ringkasan Perkembangan Siswa (${student.name}) oleh Meta AI:`, 20, currentY + 5);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(splitAi, 20, currentY + 9);

    currentY += boxHeight + 4;
  }

  // Table Header
  checkPageBreak(15);
  doc.setFillColor(0, 104, 95);
  doc.rect(15, currentY, 180, 7, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  doc.text('No', 17, currentY + 4.5);
  doc.text('Tanggal', 24, currentY + 4.5);
  doc.text('Jenis Layanan', 48, currentY + 4.5);
  doc.text('Topik / Masalah', 85, currentY + 4.5);
  doc.text('Rencana Tindak Lanjut', 130, currentY + 4.5);
  doc.text('Status', 175, currentY + 4.5);

  currentY += 7;

  // Table rows sorted newest first
  const sorted = [...services].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (sorted.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 110);
    doc.text(`Belum ada riwayat layanan konseling untuk siswa ${student.name}.`, 105, currentY + 6, { align: 'center' });
    currentY += 12;
  } else {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);

    sorted.forEach((srv, index) => {
      const splitType = doc.splitTextToSize(srv.serviceType || '-', 34);
      const splitProblem = doc.splitTextToSize(srv.problem || '-', 42);
      const splitFollowUp = doc.splitTextToSize(srv.followUp || srv.output || '-', 42);

      const maxLines = Math.max(splitType.length, splitProblem.length, splitFollowUp.length);
      const rowHeight = Math.max(7, maxLines * 3.5 + 2.5);

      checkPageBreak(rowHeight);

      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 249);
        doc.rect(15, currentY, 180, rowHeight, 'F');
      }

      doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
      doc.text(String(index + 1), 17, currentY + 4);
      doc.text(srv.date || '-', 24, currentY + 4);

      doc.setFont('Helvetica', 'bold');
      doc.text(splitType, 48, currentY + 4);

      doc.setFont('Helvetica', 'normal');
      doc.text(splitProblem, 85, currentY + 4);
      doc.text(splitFollowUp, 130, currentY + 4);

      doc.setFont('Helvetica', 'bold');
      if (srv.status === 'Selesai') doc.setTextColor(0, 104, 95);
      else doc.setTextColor(217, 119, 6);
      doc.text(srv.status || 'Selesai', 175, currentY + 4);

      // Separator
      doc.setDrawColor(220, 225, 225);
      doc.setLineWidth(0.1);
      doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

      currentY += rowHeight;
    });
  }

  // Signatures (Mengetahui Orang Tua / Wali & Guru BK)
  checkPageBreak(35);
  currentY += 6;

  const locCity = schoolConfig.schoolAddress?.toLowerCase().includes('susukan') ? 'Susukan' : 'Semarang';
  const todayFormatted = formatIndonesianDate(new Date().toISOString().slice(0, 10));

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);

  doc.text(`Susukan, ${todayFormatted}`, 135, currentY);

  currentY += 5;
  doc.setFont('Helvetica', 'bold');
  doc.text('Mengetahui,', 20, currentY);
  doc.text('Orang Tua / Wali Siswa', 20, currentY + 4);

  doc.text('Guru Bimbingan & Konseling,', 135, currentY + 4);

  currentY += 20;
  doc.text('( ................................................ )', 20, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Orang Tua dari ${student.name}`, 20, currentY + 4);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(signer.name, 135, currentY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${signer.nip || '-'}`, 135, currentY + 4);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(120, 130, 130);
    doc.text(
      `Laporan Layanan BK Siswa ${student.name} (${student.class}) | Hal ${i} dari ${totalPages}`,
      105,
      287,
      { align: 'center' }
    );
  }

  const cleanName = student.name.replace(/\s+/g, '_');
  const filename = `Laporan_Layanan_BK_${cleanName}_${student.class}_${new Date().toISOString().slice(0, 10)}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'layanan',
    studentName: student.name,
    successToastMessage: `📄 Laporan Layanan untuk ${student.name} berhasil diunduh!`,
  });
}

export interface RekapSemesterPDFOptions {
  semester: 'Ganjil' | 'Genap';
  tahunAjaran: string;
  activeCounselor: Counselor;
  serviceCounts: {
    klasikal: number;
    bimbinganKelompok: number;
    konselingIndividual: number;
    konselingKelompok: number;
    homeVisit: number;
    konferensiKasus: number;
    lainnya: number;
    total: number;
  };
  totalUniqueStudents: number;
  topStudents: { name: string; class: string; count: number; types: string }[];
  pendingFollowUps: { studentName: string; studentClass: string; serviceType: string; date: string; followUp: string; status: string }[];
}

export function downloadRekapSemesterPDF(options: RekapSemesterPDFOptions) {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const primaryColor = [0, 104, 95]; // #00685f
    const darkColor = [11, 28, 48]; // #0b1c30
    const grayColor = [61, 73, 71];
    const lightBg = [240, 244, 244];
    const config = getSchoolConfig();

    // 1. Draw Kop Surat Resmi Sekolah
    drawLetterhead(doc, primaryColor);

    // 2. Title & Subtitle
    let currentY = 46;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('LAPORAN REKAPITULASI BIMBINGAN DAN KONSELING', 105, currentY, { align: 'center' });
    currentY += 5;
    doc.setFontSize(10);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(
      `SEMESTER ${options.semester.toUpperCase()} TAHUN AJARAN ${options.tahunAjaran}`,
      105,
      currentY,
      { align: 'center' }
    );
    currentY += 4.5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(
      `Guru Pembimbing: ${options.activeCounselor.name} (NIP. ${options.activeCounselor.nip || '-'})`,
      105,
      currentY,
      { align: 'center' }
    );
    currentY += 6;

    // 3. Highlight Box: Siswa Terlayani & Total Sesi
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.roundedRect(15, currentY, 180, 10, 2, 2, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`Total Pelaksanaan Layanan: ${options.serviceCounts.total} Sesi`, 20, currentY + 6.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`Jumlah Siswa Unik Terlayani: ${options.totalUniqueStudents} Siswa`, 110, currentY + 6.5);
    currentY += 14;

    // 4. TABEL 1: TOTAL LAYANAN PER JENIS
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('I. TOTAL FREKUENSI PELAKSANAAN LAYANAN PER JENIS', 15, currentY);
    currentY += 4;

    // Header Table 1
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(15, currentY, 180, 6, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('NO', 18, currentY + 4.2);
    doc.text('JENIS LAYANAN BIMBINGAN DAN KONSELING', 30, currentY + 4.2);
    doc.text('JUMLAH SESI', 155, currentY + 4.2, { align: 'right' });
    currentY += 6;

    const serviceRows = [
      { no: '1', name: 'Bimbingan Klasikal (Tatap Muka Kelas)', count: options.serviceCounts.klasikal },
      { no: '2', name: 'Bimbingan Kelompok', count: options.serviceCounts.bimbinganKelompok },
      { no: '3', name: 'Konseling Individual (Perorangan)', count: options.serviceCounts.konselingIndividual },
      { no: '4', name: 'Konseling Kelompok', count: options.serviceCounts.konselingKelompok },
      { no: '5', name: 'Kunjungan Rumah (Home Visit)', count: options.serviceCounts.homeVisit },
      { no: '6', name: 'Rapat Kasus (Konferensi Kasus)', count: options.serviceCounts.konferensiKasus },
      { no: '7', name: 'Layanan Pendukung & Konsultasi Lainnya', count: options.serviceCounts.lainnya },
    ];

    serviceRows.forEach((row, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 249);
        doc.rect(15, currentY, 180, 5, 'F');
      }
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text(row.no, 19, currentY + 3.6);
      doc.text(row.name, 30, currentY + 3.6);
      doc.setFont('Helvetica', 'bold');
      doc.text(`${row.count} Kali`, 155, currentY + 3.6, { align: 'right' });

      doc.setDrawColor(230, 235, 235);
      doc.setLineWidth(0.15);
      doc.line(15, currentY + 5, 195, currentY + 5);
      currentY += 5;
    });

    // Total Row Table 1
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.rect(15, currentY, 180, 5.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('TOTAL SELURUH LAYANAN SEMESTER INI', 30, currentY + 3.8);
    doc.text(`${options.serviceCounts.total} Kali`, 155, currentY + 3.8, { align: 'right' });
    currentY += 9;

    // 5. TABEL 2: DAFTAR 10 SISWA PALING SERING DITANGANI
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('II. DAFTAR 10 SISWA PALING SERING DITANGANI / PERHATIAN INTENSIF', 15, currentY);
    currentY += 4;

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(15, currentY, 180, 6, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('NO', 18, currentY + 4.2);
    doc.text('NAMA SISWA', 30, currentY + 4.2);
    doc.text('KELAS', 105, currentY + 4.2);
    doc.text('TOTAL SESI', 135, currentY + 4.2);
    doc.text('JENIS LAYANAN DOMINAN', 160, currentY + 4.2);
    currentY += 6;

    if (options.topStudents.length === 0) {
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text('Belum ada data layanan siswa pada semester ini.', 20, currentY + 4);
      currentY += 6;
    } else {
      options.topStudents.slice(0, 10).forEach((st, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 249);
          doc.rect(15, currentY, 180, 5, 'F');
        }
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.text(String(idx + 1), 19, currentY + 3.6);
        doc.setFont('Helvetica', 'bold');
        doc.text(st.name.length > 35 ? `${st.name.slice(0, 35)}...` : st.name, 30, currentY + 3.6);
        doc.setFont('Helvetica', 'normal');
        doc.text(st.class || '-', 105, currentY + 3.6);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(`${st.count} Sesi`, 135, currentY + 3.6);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        doc.text(st.types || 'Konseling', 160, currentY + 3.6);

        doc.setDrawColor(230, 235, 235);
        doc.setLineWidth(0.15);
        doc.line(15, currentY + 5, 195, currentY + 5);
        currentY += 5;
      });
    }

    currentY += 4;

    // Check if new page is needed for Section III & Signatures
    if (currentY > 215) {
      doc.addPage();
      currentY = 20;
    }

    // 6. TABEL 3: DAFTAR TINDAK LANJUT YANG BELUM SELESAI
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('III. DAFTAR TINDAK LANJUT YANG MASIH DALAM PEMANTAUAN / PENDING', 15, currentY);
    currentY += 4;

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(15, currentY, 180, 6, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('NO', 18, currentY + 4.2);
    doc.text('NAMA & KELAS', 28, currentY + 4.2);
    doc.text('LAYANAN & TGL', 78, currentY + 4.2);
    doc.text('RENCANA TINDAK LANJUT', 125, currentY + 4.2);
    currentY += 6;

    if (options.pendingFollowUps.length === 0) {
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(4, 120, 87);
      doc.text('✓ Seluruh tindak lanjut telah terselesaikan dengan tuntas (0 pending).', 20, currentY + 4);
      currentY += 6;
    } else {
      options.pendingFollowUps.slice(0, 8).forEach((item, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 249);
          doc.rect(15, currentY, 180, 5.5, 'F');
        }
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.text(String(idx + 1), 18, currentY + 3.8);
        doc.text(`${item.studentName.slice(0, 24)} (${item.studentClass})`, 28, currentY + 3.8);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        doc.text(`${item.serviceType.slice(0, 18)} • ${item.date}`, 78, currentY + 3.8);
        doc.setTextColor(180, 83, 9); // amber-700
        doc.text(item.followUp.slice(0, 42), 125, currentY + 3.8);

        doc.setDrawColor(230, 235, 235);
        doc.setLineWidth(0.15);
        doc.line(15, currentY + 5.5, 195, currentY + 5.5);
        currentY += 5.5;
      });
    }

    currentY += 8;

    // Check page for signature blocks
    if (currentY > 235) {
      doc.addPage();
      currentY = 25;
    }

    // 7. Tanda Tangan: Kepala Sekolah & Guru BK
    const today = new Date();
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const dateFormatted = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
    const city = (config as any).kecamatan || (config as any).kabupatenKota || 'Susukan';

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`${city}, ${dateFormatted}`, 145, currentY);
    currentY += 4.5;

    doc.text('Mengetahui,', 25, currentY);
    doc.text('Guru Bimbingan dan Konseling,', 145, currentY);
    currentY += 4.5;
    doc.setFont('Helvetica', 'bold');
    doc.text('Kepala Sekolah', 25, currentY);
    currentY += 20;

    // Names & NIPs
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(config.principalName || 'Kepala Sekolah', 25, currentY);
    doc.text(options.activeCounselor.name, 145, currentY);
    currentY += 4;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`NIP. ${config.principalNip || '-'}`, 25, currentY);
    doc.text(`NIP. ${options.activeCounselor.nip || '-'}`, 145, currentY);

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(120, 130, 130);
      doc.text(
        `Rekap Semester BK: ${options.semester} ${options.tahunAjaran} | Hal ${i} dari ${totalPages}`,
        105,
        287,
        { align: 'center' }
      );
    }

    const filename = `Rekap_Semester_${options.semester}_${options.tahunAjaran.replace('/', '-')}_${options.activeCounselor.name.replace(/\s+/g, '_')}.pdf`;
    finalizeAndSavePdf(doc, filename, {
      category: 'rekap',
      successToastMessage: `📄 Rekap Semester ${options.semester} ${options.tahunAjaran} berhasil diunduh!`,
    });
  } catch (err) {
    console.error('Error generating Rekap Semester PDF:', err);
    showToast('❌ Gagal membuat PDF Rekap Semester', 'error');
  }
}

/**
 * 📚 Export RPL Hasil Si Becik Meta AI ke Dokumen PDF Standar Resmi BK
 */
export function downloadRplBecikPDF(options: {
  topic: string;
  studentClass: string;
  duration: string;
  rplContent: string;
  activeCounselor?: Counselor;
}) {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const config = getSchoolConfig();
    const primaryColor = [0, 104, 95];
    const darkColor = [11, 28, 48];

    // 1. Kop Surat Resmi
    drawLetterhead(doc, primaryColor);

    let currentY = 48;

    // 2. Judul Dokumen
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('RENCANA PELAKSANAAN LAYANAN (RPL) BIMBINGAN DAN KONSELING', 105, currentY, { align: 'center' });
    currentY += 5;
    doc.setFontSize(10);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text('BIMBINGAN KLASIKAL — KURIKULUM MERDEKA', 105, currentY, { align: 'center' });
    currentY += 7;

    // 3. Box Identitas RPL
    doc.setFillColor(248, 250, 249);
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(15, currentY, 180, 21, 2, 2, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Satuan Pendidikan', 19, currentY + 5);
    doc.text('Sasaran / Kelas', 19, currentY + 11);
    doc.text('Topik / Tema', 19, currentY + 17);

    doc.text('Bidang Bimbingan', 105, currentY + 5);
    doc.text('Komponen Layanan', 105, currentY + 11);
    doc.text('Alokasi Waktu', 105, currentY + 17);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`: ${config.schoolName || 'SMP Negeri 2 Susukan'}`, 48, currentY + 5);
    doc.text(`: ${options.studentClass || 'Kelas 7 / 8 / 9'}`, 48, currentY + 11);
    doc.text(`: ${options.topic || 'Bimbingan Klasikal'}`, 48, currentY + 17);

    doc.text(': Pribadi / Sosial / Belajar', 136, currentY + 5);
    doc.text(': Layanan Dasar (Klasikal)', 136, currentY + 11);
    doc.text(`: ${options.duration || '1 x 40 Menit'}`, 136, currentY + 17);

    currentY += 26;

    // 4. Parse content into sections or render paragraphs
    const cleanContent = options.rplContent
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/###/g, '')
      .replace(/##/g, '');

    const lines = doc.splitTextToSize(cleanContent, 180);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 45, 50);

    for (let i = 0; i < lines.length; i++) {
      if (currentY > 265) {
        doc.addPage();
        currentY = 20;
      }

      const line = lines[i];
      // Check if heading line
      if (
        line.startsWith('Tujuan Layanan') ||
        line.startsWith('Materi Layanan') ||
        line.startsWith('Metode Layanan') ||
        line.startsWith('Media Layanan') ||
        line.startsWith('Langkah Kegiatan') ||
        line.startsWith('Evaluasi Layanan')
      ) {
        currentY += 2;
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(line, 15, currentY);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(40, 45, 50);
        currentY += 4.5;
      } else {
        doc.text(line, 15, currentY);
        currentY += 4.2;
      }
    }

    currentY += 8;
    if (currentY > 235) {
      doc.addPage();
      currentY = 25;
    }

    // 5. Tanda Tangan
    const today = new Date();
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const dateFormatted = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
    const city = (config as any).kecamatan || (config as any).kabupatenKota || 'Susukan';

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`${city}, ${dateFormatted}`, 145, currentY);
    currentY += 4.5;

    doc.text('Mengetahui,', 25, currentY);
    doc.text('Guru Bimbingan dan Konseling,', 145, currentY);
    currentY += 4.5;
    doc.setFont('Helvetica', 'bold');
    doc.text('Kepala Sekolah', 25, currentY);
    currentY += 18;

    // Names & NIPs
    doc.text(config.principalName || 'Kepala Sekolah', 25, currentY);
    doc.text(options.activeCounselor?.name || 'Guru BK', 145, currentY);
    currentY += 4;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`NIP. ${config.principalNip || '-'}`, 25, currentY);
    doc.text(`NIP. ${options.activeCounselor?.nip || '-'}`, 145, currentY);

    const safeTopic = (options.topic || 'Bimbingan_Klasikal').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25);
    const filename = `RPL_${safeTopic}_${options.studentClass.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    finalizeAndSavePdf(doc, filename, {
      category: 'layanan',
      successToastMessage: `📄 Dokumen RPL "${options.topic}" berhasil diunduh!`,
    });
  } catch (err) {
    console.error('Error generating RPL PDF:', err);
    showToast('❌ Gagal membuat PDF RPL', 'error');
  }
}





