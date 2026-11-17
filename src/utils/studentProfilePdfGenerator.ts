import { jsPDF } from 'jspdf';
import { Student, ViolationRecord, CounselingService, StudentAchievement, Counselor } from '../types';
import { formatCardDateTime, formatCardDate } from './dateFormatter';
import { getViolationRestitutionStatus } from '../components/CatatPelanggaranForm';
import { defaultWaliKelasList, getNormalizedClassKey } from './classNormalizer';
import { getSchoolConfig, getActiveSchoolId } from './schoolConfig';
import { showToast } from './toast';

export interface GenerateProfilePdfOptions {
  student: Student;
  violations: ViolationRecord[];
  services: CounselingService[];
  achievements: StudentAchievement[];
  homeVisits?: any[];
  activeCounselor?: Counselor;
  includeNisn?: boolean;
}

export function generateStudentProfilePdf({
  student,
  violations = [],
  services = [],
  achievements = [],
  homeVisits = [],
  activeCounselor,
  includeNisn = false,
}: GenerateProfilePdfOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const school = getSchoolConfig(getActiveSchoolId());
  const primaryColor = [11, 28, 48]; // #0b1c30
  const tealColor = [0, 104, 95]; // #00685f
  const redColor = [186, 26, 26]; // #ba1a1a
  const grayColor = [61, 73, 71]; // #3d4947

  let currentY = 15;
  const pageHeight = 297;

  // Helper check page break
  const checkPageBreak = (needed: number) => {
    if (currentY + needed > pageHeight - 20) {
      doc.addPage();
      currentY = 20;
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      doc.text(`Profil Siswa: ${student.name} (${student.class}) - Hal ${doc.getNumberOfPages()}`, 15, 12);
      doc.setDrawColor(200, 210, 210);
      doc.line(15, 14, 195, 14);
    }
  };

  // 1. KOP SURAT RESMI SEKOLAH
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('PEMERINTAH KABUPATEN BANJARNEGARA', 105, currentY, { align: 'center' });
  currentY += 5;

  doc.text('DINAS PENDIDIKAN, KEPEMUDAAN DAN OLAHRAGA', 105, currentY, { align: 'center' });
  currentY += 6;

  doc.setFontSize(14);
  doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.text((school.schoolName || 'SMP N 2 Susukan').toUpperCase(), 105, currentY, { align: 'center' });
  currentY += 5;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text(school.schoolAddress || 'Kecamatan Susukan, Kabupaten Semarang, Jawa Tengah', 105, currentY, { align: 'center' });
  currentY += 4;
  doc.text(`NPSN: ${school.npsn || '20320123'} • Pos-el: info@smpn2susukan.sch.id`, 105, currentY, { align: 'center' });
  currentY += 4;

  // Double horizontal rule
  doc.setDrawColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.setLineWidth(1.2);
  doc.line(15, currentY, 195, currentY);
  currentY += 1.2;
  doc.setLineWidth(0.3);
  doc.line(15, currentY, 195, currentY);
  currentY += 7;

  // 2. JUDUL DOKUMEN
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.text('LEMBAR PROFIL PERKEMBANGAN & RESTITUSI SISWA', 105, currentY, { align: 'center' });
  currentY += 5;

  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(redColor[0], redColor[1], redColor[2]);
  doc.text('DOKUMEN RAHASIA BIMBINGAN & KONSELING - UNTUK KEBUTUHAN RAPAT KASUS / PEMBINAAN', 105, currentY, { align: 'center' });
  currentY += 7;

  // 3. TABEL IDENTITAS SISWA & WALI KELAS
  const normClass = getNormalizedClassKey(student.class);
  const wali = defaultWaliKelasList.find(w => getNormalizedClassKey(w.class) === normClass);
  const waliName = wali?.name || 'Wali Kelas ' + student.class;

  doc.setFillColor(245, 248, 248);
  doc.roundedRect(15, currentY, 180, 32, 2, 2, 'F');
  doc.setDrawColor(200, 215, 215);
  doc.setLineWidth(0.4);
  doc.roundedRect(15, currentY, 180, 32, 2, 2, 'S');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  // Left Column
  doc.text('Nama Lengkap', 20, currentY + 6);
  doc.setFont('Helvetica', 'normal');
  doc.text(`:  ${student.name}`, 55, currentY + 6);

  doc.setFont('Helvetica', 'bold');
  doc.text('Kelas / Rombel', 20, currentY + 12);
  doc.setFont('Helvetica', 'normal');
  doc.text(`:  ${student.class}`, 55, currentY + 12);

  doc.setFont('Helvetica', 'bold');
  doc.text('NIS / NISN', 20, currentY + 18);
  doc.setFont('Helvetica', 'normal');
  const nisnText = includeNisn ? (student.nisn || student.nis) : `****${(student.nisn || student.nis).slice(-4)}`;
  doc.text(`:  ${student.nis} / ${nisnText}`, 55, currentY + 18);

  doc.setFont('Helvetica', 'bold');
  doc.text('Jenis Kelamin', 20, currentY + 24);
  doc.setFont('Helvetica', 'normal');
  doc.text(`:  ${student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}`, 55, currentY + 24);

  // Right Column
  doc.setFont('Helvetica', 'bold');
  doc.text('Wali Kelas', 110, currentY + 6);
  doc.setFont('Helvetica', 'normal');
  doc.text(`:  ${waliName}`, 140, currentY + 6);

  doc.setFont('Helvetica', 'bold');
  doc.text('Kontak Wali', 110, currentY + 12);
  doc.setFont('Helvetica', 'normal');
  doc.text(`:  ${wali?.phone || '0812-3456-78xx'}`, 140, currentY + 12);

  doc.setFont('Helvetica', 'bold');
  doc.text('Guru Pembimbing BK', 110, currentY + 18);
  doc.setFont('Helvetica', 'normal');
  doc.text(`:  ${activeCounselor?.name || 'Aulia Aji Sasongko, S.Pd.'}`, 140, currentY + 18);

  // Status Perkembangan
  const hasActiveRestitution = violations.some(v => {
    const s = getViolationRestitutionStatus(v);
    return s === 'Proses Restitusi' || s === 'Baru Dicatat';
  });
  const statusLabel = hasActiveRestitution || student.violationPoints > 40
    ? 'PERLU PERHATIAN'
    : student.violationPoints > 15
    ? 'SEDANG DIPANTAU'
    : 'BAIK';

  doc.setFont('Helvetica', 'bold');
  doc.text('Status Kedisiplinan', 110, currentY + 24);
  doc.setFont('Helvetica', 'bold');
  if (statusLabel === 'BAIK') {
    doc.setTextColor(0, 120, 80);
  } else if (statusLabel === 'SEDANG DIPANTAU') {
    doc.setTextColor(180, 120, 0);
  } else {
    doc.setTextColor(redColor[0], redColor[1], redColor[2]);
  }
  doc.text(`:  [ ${statusLabel} ]`, 140, currentY + 24);

  currentY += 38;

  // 4. TIGA KOTAK RINGKASAN
  const boxWidth = 57;
  const boxHeight = 16;
  const gap = 4.5;
  const startX = 15;

  // Box 1: Pelanggaran
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(startX, currentY, boxWidth, boxHeight, 1.5, 1.5, 'F');
  doc.setDrawColor(252, 165, 165);
  doc.roundedRect(startX, currentY, boxWidth, boxHeight, 1.5, 1.5, 'S');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(redColor[0], redColor[1], redColor[2]);
  doc.text('TOTAL PELANGGARAN', startX + 4, currentY + 5);
  doc.setFontSize(11);
  doc.text(`${violations.length} Kasus (+${student.violationPoints} Poin)`, startX + 4, currentY + 12);

  // Box 2: Reward
  const totalRewardPoints = achievements.reduce((acc, a) => acc + (a.pointsReward || (a as any).points || 10), 0);
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(startX + boxWidth + gap, currentY, boxWidth, boxHeight, 1.5, 1.5, 'F');
  doc.setDrawColor(134, 239, 172);
  doc.roundedRect(startX + boxWidth + gap, currentY, boxWidth, boxHeight, 1.5, 1.5, 'S');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(21, 128, 61);
  doc.text('TOTAL REWARD & APRESIASI', startX + boxWidth + gap + 4, currentY + 5);
  doc.setFontSize(11);
  doc.text(`${achievements.length} Catatan (-${totalRewardPoints} Poin)`, startX + boxWidth + gap + 4, currentY + 12);

  // Box 3: Layanan BK
  const totalServicesCount = services.length + homeVisits.length;
  doc.setFillColor(240, 253, 250);
  doc.roundedRect(startX + (boxWidth + gap) * 2, currentY, boxWidth, boxHeight, 1.5, 1.5, 'F');
  doc.setDrawColor(153, 246, 228);
  doc.roundedRect(startX + (boxWidth + gap) * 2, currentY, boxWidth, boxHeight, 1.5, 1.5, 'S');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.text('TOTAL LAYANAN & KONSELING', startX + (boxWidth + gap) * 2 + 4, currentY + 5);
  doc.setFontSize(11);
  doc.text(`${totalServicesCount} Sesi Pendampingan`, startX + (boxWidth + gap) * 2 + 4, currentY + 12);

  currentY += 22;

  // 5. RESTITUSI AKTIF (JIKA ADA)
  const activeRestitutions = violations.filter(v => {
    const st = getViolationRestitutionStatus(v);
    return st === 'Proses Restitusi' || st === 'Baru Dicatat';
  });

  if (activeRestitutions.length > 0) {
    checkPageBreak(25);
    const firstAct = activeRestitutions[0];
    const st = getViolationRestitutionStatus(firstAct);
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(15, currentY, 180, 20, 2, 2, 'F');
    doc.setDrawColor(redColor[0], redColor[1], redColor[2]);
    doc.setLineWidth(0.6);
    doc.roundedRect(15, currentY, 180, 20, 2, 2, 'S');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(redColor[0], redColor[1], redColor[2]);
    doc.text('RESTITUSI AKTIF DALAM PEMANTAUAN:', 20, currentY + 6);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${firstAct.category} - Status: ${st}`, 20, currentY + 11);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    const deadlineStr = firstAct.restitutionDeadline ? formatCardDate(firstAct.restitutionDeadline) : '7 Hari sejak dicatat';
    const supervisorStr = firstAct.restitutionSupervisor || activeCounselor?.name || 'Guru BK';
    doc.text(`Tenggat: ${deadlineStr}  |  Pemantau: ${supervisorStr}`, 20, currentY + 16);

    currentY += 26;
  }

  // 6. RIWAYAT TIMELINE SEMUA LAYANAN & PERILAKU (TABEL)
  checkPageBreak(30);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('RIWAYAT LENGKAP LAYANAN, PERILAKU & RESTITUSI (TERBARU DI ATAS)', 15, currentY);
  currentY += 4;

  // Table Header
  doc.setFillColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.rect(15, currentY, 180, 7, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('No', 18, currentY + 4.8);
  doc.text('Tanggal & Jam', 26, currentY + 4.8);
  doc.text('Jenis / Kasus / Layanan', 65, currentY + 4.8);
  doc.text('Poin', 125, currentY + 4.8);
  doc.text('Status Restitusi', 142, currentY + 4.8);
  doc.text('Petugas', 170, currentY + 4.8);
  currentY += 7;

  // Build combined timeline rows
  interface CombinedRow {
    date: string;
    time?: string;
    title: string;
    points: string;
    status: string;
    reporter: string;
    notes?: string;
    timestamp: number;
  }

  const rows: CombinedRow[] = [];

  violations.forEach(v => {
    const rawDate = v.date ? String(v.date).slice(0, 10) : '';
    const ts = rawDate ? new Date(rawDate).getTime() : 0;
    rows.push({
      date: formatCardDateTime(v.date, v.time),
      title: v.category || 'Pelanggaran Disiplin',
      points: `+${v.pointsAdded}`,
      status: getViolationRestitutionStatus(v),
      reporter: v.reportedBy || 'Guru BK',
      notes: v.notes,
      timestamp: ts,
    });
  });

  achievements.forEach(a => {
    const rawDate = a.date ? String(a.date).slice(0, 10) : '';
    const ts = rawDate ? new Date(rawDate).getTime() : 0;
    const titleText = a.achievementName || (a as any).title || a.category || 'Prestasi';
    const pointsNum = a.pointsReward ?? (a as any).points ?? 10;
    rows.push({
      date: formatCardDateTime(a.date),
      title: `[Reward] ${titleText}`,
      points: `-${pointsNum}`,
      status: 'Apresiasi Positif',
      reporter: a.recordedBy || 'Guru BK',
      notes: a.notes || (a as any).description,
      timestamp: ts,
    });
  });

  services.forEach(s => {
    const rawDate = s.date ? String(s.date).slice(0, 10) : '';
    const ts = rawDate ? new Date(rawDate).getTime() : 0;
    rows.push({
      date: formatCardDateTime(s.date, s.startTime),
      title: s.serviceType || 'Layanan Konseling',
      points: '-',
      status: s.status || 'Terlaksana',
      reporter: s.counselorName || 'Guru BK',
      notes: s.description || s.problem || s.followUp,
      timestamp: ts,
    });
  });

  homeVisits.forEach(h => {
    const rawDate = h.date ? String(h.date).slice(0, 10) : '';
    const ts = rawDate ? new Date(rawDate).getTime() : 0;
    rows.push({
      date: formatCardDateTime(h.date),
      title: 'Kunjungan Rumah (Home Visit)',
      points: '-',
      status: 'Selesai Dikunjungi',
      reporter: h.counselorName || 'Guru BK',
      notes: h.purpose ? `${h.purpose} ${h.result ? `(${h.result})` : ''}` : (h.result || h.agreement),
      timestamp: ts,
    });
  });

  // Sort newest first
  rows.sort((a, b) => b.timestamp - a.timestamp);

  if (rows.length === 0) {
    checkPageBreak(12);
    doc.setFillColor(250, 250, 250);
    doc.rect(15, currentY, 180, 10, 'F');
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text('Belum ada catatan pelanggaran maupun layanan konseling untuk siswa ini.', 105, currentY + 6, { align: 'center' });
    currentY += 12;
  } else {
    rows.forEach((row, idx) => {
      checkPageBreak(9);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 250);
        doc.rect(15, currentY, 180, 8, 'F');
      }
      doc.setDrawColor(230, 235, 235);
      doc.line(15, currentY + 8, 195, currentY + 8);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

      // No
      doc.text(String(idx + 1), 18, currentY + 5.5);
      // Tanggal
      doc.text(row.date, 26, currentY + 5.5);
      // Judul
      const cleanTitle = row.title.length > 32 ? row.title.substring(0, 30) + '...' : row.title;
      doc.text(cleanTitle, 65, currentY + 5.5);
      // Poin
      if (row.points.startsWith('+')) {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(redColor[0], redColor[1], redColor[2]);
      } else if (row.points.startsWith('-')) {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(21, 128, 61);
      } else {
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      }
      doc.text(row.points, 125, currentY + 5.5);

      // Status
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      const cleanStatus = row.status.length > 16 ? row.status.substring(0, 15) + '..' : row.status;
      doc.text(cleanStatus, 142, currentY + 5.5);

      // Petugas
      const cleanReporter = row.reporter.length > 14 ? row.reporter.substring(0, 13) + '..' : row.reporter;
      doc.text(cleanReporter, 170, currentY + 5.5);

      currentY += 8;
    });
  }

  currentY += 6;

  // 7. KOTAK REKOMENDASI RAPAT KASUS / TINDAK LANJUT
  checkPageBreak(30);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('CATATAN & KESEPAKATAN RAPAT KASUS (CASE CONFERENCE):', 15, currentY);
  currentY += 4;

  doc.setFillColor(250, 252, 252);
  doc.roundedRect(15, currentY, 180, 22, 1.5, 1.5, 'F');
  doc.setDrawColor(200, 215, 215);
  doc.setLineWidth(0.4);
  doc.roundedRect(15, currentY, 180, 22, 1.5, 1.5, 'S');

  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 110, 110);
  doc.text(
    'Ruang catatan hasil evaluasi wali kelas, guru BK, dan pimpinan sekolah saat pembahasan khusus kasus:',
    18,
    currentY + 5
  );
  doc.setDrawColor(220, 230, 230);
  doc.line(18, currentY + 11, 192, currentY + 11);
  doc.line(18, currentY + 16, 192, currentY + 16);

  currentY += 28;

  // 8. TANDA TANGAN PENGESAHAN
  checkPageBreak(35);
  const signY = currentY;
  const signerName = activeCounselor?.name || 'Aulia Aji Sasongko, S.Pd.';
  const signerNip = activeCounselor?.nip && activeCounselor.nip !== '-' ? activeCounselor.nip : 'NIP. 19931231 202221 1 002';

  // Kiri: Wali Kelas
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Mengetahui,', 25, signY);
  doc.text('Wali Kelas ' + student.class, 25, signY + 5);

  doc.setFont('Helvetica', 'bold');
  doc.text(waliName, 25, signY + 25);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('NIP. -', 25, signY + 29);

  // Kanan: Guru Pembimbing BK
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Susukan, ${formatCardDate(new Date().toISOString())}`, 130, signY);
  doc.text('Guru Pembimbing BK / Koordinator', 130, signY + 5);

  doc.setFont('Helvetica', 'bold');
  doc.text(signerName, 130, signY + 25);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(signerNip, 130, signY + 29);

  // Generate file name & save
  const cleanName = student.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `profil_bk_${student.class.toLowerCase().replace(/[^a-z0-9]/g, '')}_${cleanName}.pdf`;

  doc.save(filename);
  showToast(`Profil ${student.name} berhasil diunduh sebagai PDF!`, 'success');
}
