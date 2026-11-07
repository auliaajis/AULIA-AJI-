import { jsPDF } from 'jspdf';
import { getSchoolConfig } from './schoolConfig';
import { showToast } from './toast';
import { drawKabSemarangLogo, drawSchoolLogo, finalizeAndSavePdf } from './pdfGenerator';

/**
 * Professional Multi-Page PDF Generator for:
 * "BUKU PANDUAN PENGGUNA & DOKUMENTASI FITUR SISTEM ADMINISTRASI BIMBINGAN DAN KONSELING (BK)"
 */
export function generateUserManualPDF() {
  const config = getSchoolConfig();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2; // 174 mm
  const primaryTeal = [0, 104, 95]; // #00685f
  const deepSlate = [11, 28, 48]; // #0b1c30
  const bodyCharcoal = [61, 73, 71]; // #3d4947
  const softTealBg = [230, 244, 241];
  const borderLight = [188, 201, 198];

  let currentY = 20;

  // Helper: check page break
  function checkPageBreak(neededHeight: number): boolean {
    if (currentY + neededHeight > pageHeight - 22) {
      doc.addPage();
      currentY = 28; // Space below standard running header
      return true;
    }
    return false;
  }

  // Helper: render running header on sub-pages
  function drawRunningHeader(chapterTitle: string) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(bodyCharcoal[0], bodyCharcoal[1], bodyCharcoal[2]);
    doc.text('BUKU PANDUAN APLIKASI SIKAP-BK', marginX, 12);
    doc.text(config.schoolName.toUpperCase(), pageWidth - marginX, 12, { align: 'right' });

    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.3);
    doc.line(marginX, 14, pageWidth - marginX, 14);
  }

  // Helper: render chapter header banner
  function drawChapterHeader(chapterNum: string, title: string, subtitle?: string) {
    checkPageBreak(30);

    // Chapter badge
    doc.setFillColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
    doc.roundedRect(marginX, currentY, 24, 7, 1.5, 1.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(chapterNum, marginX + 12, currentY + 4.8, { align: 'center' });

    // Chapter title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(deepSlate[0], deepSlate[1], deepSlate[2]);
    doc.text(title, marginX + 27, currentY + 5.2);

    currentY += 10;

    if (subtitle) {
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(bodyCharcoal[0], bodyCharcoal[1], bodyCharcoal[2]);
      const subLines = doc.splitTextToSize(subtitle, contentWidth);
      doc.text(subLines, marginX, currentY);
      currentY += subLines.length * 4.2 + 2;
    }

    doc.setDrawColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
    doc.setLineWidth(0.6);
    doc.line(marginX, currentY, marginX + 45, currentY);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.2);
    doc.line(marginX + 45, currentY, pageWidth - marginX, currentY);

    currentY += 6;
  }

  // Helper: section title
  function drawSectionTitle(title: string) {
    checkPageBreak(15);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
    doc.text(title, marginX, currentY);
    currentY += 5.5;
  }

  // Helper: body paragraph
  function drawParagraph(text: string, spaceAfter = 4) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(bodyCharcoal[0], bodyCharcoal[1], bodyCharcoal[2]);
    const lines = doc.splitTextToSize(text, contentWidth);
    checkPageBreak(lines.length * 4.2 + spaceAfter);
    doc.text(lines, marginX, currentY);
    currentY += lines.length * 4.2 + spaceAfter;
  }

  // Helper: bullet point
  function drawBullet(title: string, desc: string) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(deepSlate[0], deepSlate[1], deepSlate[2]);

    const titlePrefix = `•  ${title}: `;
    const fullText = `${titlePrefix}${desc}`;
    const lines = doc.splitTextToSize(fullText, contentWidth - 4);
    checkPageBreak(lines.length * 4 + 2);

    // Draw bullet dot with teal accent
    doc.setFillColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
    doc.circle(marginX + 1.8, currentY - 1.2, 0.9, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.text(titlePrefix, marginX + 4.5, currentY);

    const titleWidth = doc.getTextWidth(titlePrefix);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(bodyCharcoal[0], bodyCharcoal[1], bodyCharcoal[2]);

    // Handle multiline wrapping smoothly
    if (lines.length === 1) {
      doc.text(desc, marginX + 4.5 + titleWidth, currentY);
      currentY += 4.5;
    } else {
      const restLines = doc.splitTextToSize(desc, contentWidth - 4 - titleWidth);
      doc.text(restLines[0], marginX + 4.5 + titleWidth, currentY);
      currentY += 4.2;
      const subsequentLines = doc.splitTextToSize(desc.substring(restLines[0].length).trim(), contentWidth - 4);
      for (let i = 0; i < subsequentLines.length; i++) {
        checkPageBreak(4.5);
        doc.text(subsequentLines[i], marginX + 4.5, currentY);
        currentY += 4.2;
      }
      currentY += 1;
    }
  }

  // Helper: Callout highlight box
  function drawCalloutBox(title: string, content: string, type: 'info' | 'tip' | 'warning' = 'info') {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(content, contentWidth - 10);
    const boxHeight = lines.length * 4 + 11;

    checkPageBreak(boxHeight + 4);

    let bgColor = softTealBg;
    let borderColor = primaryTeal;
    let iconChar = 'ℹ️';

    if (type === 'tip') {
      bgColor = [240, 253, 244]; // light emerald
      borderColor = [22, 163, 74];
      iconChar = '💡';
    } else if (type === 'warning') {
      bgColor = [255, 251, 235]; // light amber
      borderColor = [217, 119, 6];
      iconChar = '⚠️';
    }

    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.4);
    doc.roundedRect(marginX, currentY, contentWidth, boxHeight, 2, 2, 'FD');

    // Left accent bar
    doc.setFillColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.rect(marginX, currentY, 2.5, boxHeight, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.text(`${iconChar}  ${title}`, marginX + 6, currentY + 5.5);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(bodyCharcoal[0], bodyCharcoal[1], bodyCharcoal[2]);
    doc.text(lines, marginX + 6, currentY + 10);

    currentY += boxHeight + 4;
  }

  // =========================================================================
  // 1. COVER PAGE (HALAMAN JUDUL)
  // =========================================================================
  // Outer decorative border
  doc.setDrawColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.setLineWidth(1.2);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(0.3);
  doc.rect(14, 14, pageWidth - 28, pageHeight - 28);

  // Top header school banner
  doc.setFillColor(softTealBg[0], softTealBg[1], softTealBg[2]);
  doc.rect(14.5, 14.5, pageWidth - 29, 32, 'F');

  // Draw Logos on Cover
  try {
    const customSchoolLogo = typeof localStorage !== 'undefined' ? localStorage.getItem('bk_custom_school_logo') : null;
    if (customSchoolLogo) {
      const format = customSchoolLogo.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(customSchoolLogo, format, pageWidth - 38, 18, 18, 18);
    } else {
      drawSchoolLogo(doc, pageWidth - 29, 27, 8.5);
    }
  } catch {
    drawSchoolLogo(doc, pageWidth - 29, 27, 8.5);
  }

  try {
    const customKabLogo = typeof localStorage !== 'undefined' ? localStorage.getItem('bk_custom_kabupaten_logo') : null;
    if (customKabLogo) {
      const format = customKabLogo.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(customKabLogo, format, 20, 18, 18, 18);
    } else {
      drawKabSemarangLogo(doc, 29, 27, 8.5);
    }
  } catch {
    drawKabSemarangLogo(doc, 29, 27, 8.5);
  }

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(deepSlate[0], deepSlate[1], deepSlate[2]);
  doc.text(config.governmentName.toUpperCase(), 105, 23, { align: 'center' });
  doc.text(config.departmentName.toUpperCase(), 105, 27.5, { align: 'center' });

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.text(config.schoolName.toUpperCase(), 105, 33.5, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(bodyCharcoal[0], bodyCharcoal[1], bodyCharcoal[2]);
  doc.text(config.schoolAddress, 105, 38, { align: 'center' });

  // Main Cover Titles
  currentY = 70;

  // Badge: Panduan Resmi
  doc.setFillColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.roundedRect(105 - 35, currentY, 70, 7.5, 3.5, 3.5, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('BUKU PETUNJUK OPERASIONAL & FITUR', 105, currentY + 5.2, { align: 'center' });

  currentY += 20;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.text('SIKAP-BK', 105, currentY, { align: 'center' });
  currentY += 8;
  doc.setFontSize(11);
  doc.setTextColor(deepSlate[0], deepSlate[1], deepSlate[2]);
  doc.text('Sistem Informasi Karakter, Apresiasi & Pelayanan BK', 105, currentY, { align: 'center' });

  currentY += 7;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.text('Platform Bimbingan Konseling & Disiplin Positif Terpadu', 105, currentY, { align: 'center' });

  // Decorative divider
  currentY += 8;
  doc.setDrawColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.setLineWidth(1.2);
  doc.line(75, currentY, 135, currentY);
  doc.circle(105, currentY, 1.6, 'F');

  // Cover Feature Highlights Matrix Box
  currentY += 15;
  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(24, currentY, pageWidth - 48, 70, 3, 3, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(deepSlate[0], deepSlate[1], deepSlate[2]);
  doc.text('CAKUPAN MODUL & KEUNGGULAN SISTEM:', 30, currentY + 9);

  const coverFeatures = [
    ['Real-time Cloud Sync (Firestore)', 'Sinkronisasi instan multi-perangkat & multi-tab (<1 ms).'],
    ['Multi-Sekolah & Multi-Konselor', 'Partisi data per NPSN, aman & terisolasi antarsekolah.'],
    ['Manajemen Siswa 360 Derajat', 'Pencatatan rekam kasus, absensi, prestasi, & konseling.'],
    ['Restitusi Disiplin & Kasus', 'Tiket pelanggaran, poin tertib, s/d sanksi edukatif.'],
    ['Layanan Konseling Komprehensif', 'Individu, kelompok, klasikal, & alih tangan kasus.'],
    ['Surat Panggilan & Home Visit', 'Kop surat dinamis, QR code verifikasi, tanda tangan digital.'],
    ['Pembinaan & Kontrak Perilaku', 'Surat perjanjian, kontrak perilaku, jurnal bertahap, RTL.'],
    ['Kecerdasan Buatan (Gemini AI)', 'Analisis psikopedagogis & rekomendasi intervensi kasus.'],
    ['Laporan Berstandar Dinas (PDF/Excel)', 'Rekapitulasi otomatis bulanan, semesteran, & tahunan.']
  ];

  let featY = currentY + 16;
  coverFeatures.forEach(([title, desc]) => {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
    doc.text(`✔  ${title}:`, 30, featY);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(bodyCharcoal[0], bodyCharcoal[1], bodyCharcoal[2]);
    const titleLen = doc.getTextWidth(`✔  ${title}: `);
    doc.text(desc, 30 + titleLen, featY);
    featY += 5.8;
  });

  // Cover Footer Meta
  currentY = pageHeight - 48;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(deepSlate[0], deepSlate[1], deepSlate[2]);
  doc.text('Diterbitkan Untuk:', 105, currentY, { align: 'center' });
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(bodyCharcoal[0], bodyCharcoal[1], bodyCharcoal[2]);
  doc.text(`Guru Pembimbing BK, Koordinator BK, & Manajemen Sekolah`, 105, currentY + 4.5, { align: 'center' });
  doc.text(`${config.schoolName}`, 105, currentY + 9, { align: 'center' });
  doc.text(`Tahun Ajaran Aktif • Edisi Pembaruan Terintegrasi Cloud & PWA`, 105, currentY + 13.5, { align: 'center' });

  // =========================================================================
  // 2. DAFTAR ISI & STRUKTUR PANDUAN
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Daftar Isi');

  drawChapterHeader('BAB I', 'DAFTAR ISI & PETA FITUR APLIKASI', 'Struktur modul dan pemetaan materi panduan penggunaan sistem.');

  const tableOfContents = [
    ['Bab 1', 'Pengenalan Sistem & Konsep Dasar Administrasi BK Digital'],
    ['Bab 2', 'Persiapan Awal, Manajemen Akun Konselor, & Multi-Sekolah (NPSN)'],
    ['Bab 3', 'Eksplorasi Dashboard, Indikator Kinerja, & Early Warning System'],
    ['Bab 4', 'Manajemen Data Siswa & Profil Perkembangan Siswa 360°'],
    ['Bab 5', 'Sistem Absensi Harian Kelas & Deteksi Kerentanan Bolos'],
    ['Bab 6', 'Pencatatan Pelanggaran, Poin Kedisiplinan, & Restitusi Positif'],
    ['Bab 7', 'Modul Apresiasi & Pencatatan Prestasi Siswa'],
    ['Bab 8', 'Penyelenggaraan Layanan Bimbingan & Konseling (Individu/Kelompok/Klasikal)'],
    ['Bab 9', 'Administrasi Surat Panggilan Orang Tua / Wali Siswa'],
    ['Bab 10', 'Pelaksanaan & Dokumentasi Kunjungan Rumah (Home Visit)'],
    ['Bab 11', 'Modul Pembinaan & Pendisiplinan Khusus (Perjanjian, Kontrak Perilaku, RTL)'],
    ['Bab 12', 'Asesmen Diagnostik Kebutuhan Siswa (AKPD, Sosiometri, Gaya Belajar)'],
    ['Bab 13', 'Jurnal Harian Guru BK & Pelaporan Kinerja Terintegrasi'],
    ['Bab 14', 'Rekapitulasi Laporan Dinas & Ekspor Data (PDF Resmi & Excel)'],
    ['Bab 15', 'Pemanfaatan Asisten Cerdas AI (Gemini Pedagogical Assistant)'],
    ['Bab 16', 'Sinkronisasi Cloud Firestore, Google Sheets, & Keamanan Data'],
    ['Bab 17', 'Panduan Instalasi Aplikasi (PWA di PC / Laptop / Android)'],
    ['Bab 18', 'Tanya Jawab Populer (FAQ) & Solusi Pemecahan Masalah (Troubleshooting)']
  ];

  tableOfContents.forEach(([num, title]) => {
    checkPageBreak(7.5);
    doc.setFillColor(softTealBg[0], softTealBg[1], softTealBg[2]);
    doc.roundedRect(marginX, currentY - 1, 15, 5.2, 1, 1, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
    doc.text(num, marginX + 7.5, currentY + 2.7, { align: 'center' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(deepSlate[0], deepSlate[1], deepSlate[2]);
    doc.text(title, marginX + 18, currentY + 2.7);

    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.2);
    doc.line(marginX + 18 + doc.getTextWidth(title) + 2, currentY + 3, pageWidth - marginX - 10, currentY + 3);

    currentY += 6.5;
  });

  currentY += 4;
  drawCalloutBox(
    'Pedoman Cepat Untuk Pengguna Baru',
    'Jika Anda baru pertama kali menggunakan aplikasi ini, mulailah dari Bab 2 (Pengaturan Sekolah & Akun), kemudian impor data siswa Anda di Bab 4. Sistem akan langsung siap digunakan untuk mencatat absensi, layanan konseling, dan penerbitan surat resmi.',
    'tip'
  );

  // =========================================================================
  // 3. BAB 1: PENGENALAN SISTEM & KONSEP DASAR
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 1: Pengenalan Sistem');

  drawChapterHeader('BAB 1', 'PENGENALAN SISTEM & KONSEP DASAR', 'Prinsip kerja, arsitektur data, dan filosofi pembinaan ramah anak.');

  drawSectionTitle('1.1. Latar Belakang & Tujuan Aplikasi');
  drawParagraph(
    'Sistem Informasi & Administrasi Bimbingan Konseling (BK) Digital dirancang khusus untuk memodernisasi tugas guru BK, wali kelas, dan pimpinan sekolah. Aplikasi ini mentransformasikan administrasi manual yang rumit menjadi alur digital terstruktur, hemat waktu, tanpa kertas (paperless), dan akuntabel sesuai standar pelaporan dinas pendidikan.'
  );

  drawSectionTitle('1.2. Keunggulan Utama');
  drawBullet('Teknologi Cloud & Offline-First', 'Data tersimpan otomatis di Google Cloud Firestore secara realtime. Aplikasi tetap dapat digunakan tanpa koneksi internet dan akan otomatis melakukan sinkronisasi saat tersambung kembali.');
  drawBullet('Sinkronisasi Multi-Tab & Multi-Perangkat (<1 ms)', 'Dilengkapi Web API BroadcastChannel sehingga perubahan data di satu tab browser atau perangkat langsung terupdate di seluruh tab lainnya secara instan tanpa jeda.');
  drawBullet('Multi-Sekolah Mandiri (NPSN-Partitioned)', 'Satu aplikasi dapat digunakan oleh guru BK dari sekolah mana pun (SD, SMP/MTs, SMA/MA, SMK). Pengaturan nama sekolah, dinas, alamat, dan kepala sekolah tersimpan terisolasi berdasarkan NPSN.');
  drawBullet('Multi-Konselor & Hak Akses Rombel (RBAC)', 'Mendukung pembagian tugas bimbingan. Guru BK hanya melihat dan membina siswa pada kelas yang ditugaskan, sementara Koordinator/Admin memiliki akses penuh ke seluruh rombel.');
  drawBullet('Kecerdasan Buatan (Gemini AI)', 'Fitur asisten cerdas untuk membantu guru BK menganalisis akar masalah perilaku siswa serta merumuskan rekomendasi restitusi positif dan konseling.');

  drawSectionTitle('1.3. Prinsip Disiplin Positif & Restitusi');
  drawParagraph(
    'Aplikasi ini menjunjung tinggi filosofi Disiplin Positif dan Restitusi (Diana Gossen). Pelanggaran siswa tidak diposisikan sebagai ajang penghukuman fisik atau mempermalukan siswa, melainkan proses reflektif agar siswa mengenali kebutuhan dasarnya yang belum terpenuhi, memperbaiki kesalahan secara bertanggung jawab, dan mengembalikan harga dirinya ke dalam komunitas kelas.'
  );

  // =========================================================================
  // 4. BAB 2: PERSIAPAN AWAL & MANAJEMEN AKUN
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 2: Persiapan & Akun');

  drawChapterHeader('BAB 2', 'PERSIAPAN AWAL, PENGATURAN SEKOLAH & MANAJEMEN AKUN', 'Langkah konfigurasi identitas sekolah dan pengelolaan guru pembimbing.');

  drawSectionTitle('2.1. Konfigurasi Identitas Sekolah & Kop Surat');
  drawParagraph(
    'Sebelum memulai pencatatan, lakukan pengaturan identitas sekolah agar seluruh kop surat, lembar pemanggilan, home visit, dan laporan PDF otomatis terbit atas nama sekolah Anda.'
  );
  drawBullet('Buka Menu Pengaturan', 'Klik menu "Pengaturan & Tools" -> "System & Hak Akses" pada sidebar.');
  drawBullet('Tab Pengaturan Sekolah', 'Isikan Nama Instansi Pemda (Kop Baris 1), Dinas Terkait (Kop Baris 2), Nama Sekolah Resmi, Alamat Lengkap, NPSN Sekolah, Nama Kepala Sekolah beserta NIP.');
  drawBullet('Kustomisasi Logo', 'Unggah logo sekolah dan logo pemerintah daerah (Kabupaten/Kota/Provinsi). Logo akan otomatis tampil pada kop surat PDF resmi.');
  drawBullet('Simpan Pengaturan', 'Klik tombol "Simpan Pengaturan Sekolah". Seluruh dokumen akan langsung menyesuaikan identitas tersebut.');

  drawSectionTitle('2.2. Manajemen Akun Guru BK & Hak Akses');
  drawParagraph(
    'Sistem membedakan dua peran pengguna demi keamanan dan ketertiban data siswa:'
  );
  drawBullet('Admin / Koordinator BK', 'Memiliki hak akses penuh untuk mengelola data seluruh kelas, menyetujui pendaftaran akun guru baru, mengatur identitas sekolah, serta mengelola akun konselor lain.');
  drawBullet('Guru Pembimbing BK (Anggota)', 'Hanya dapat mengakses, mencatat, dan membina siswa pada kelas-kelas binaan yang ditugaskan padanya (misal: hanya kelas 7A, 7B, 7C). Data kelas lain tetap terlindungi.');

  drawSectionTitle('2.3. Alur Pendaftaran Guru BK Baru (Self-Registration)');
  drawParagraph(
    'Guru BK baru dapat mendaftarkan diri secara mandiri melalui layar Login dengan memilih "Daftar Akun Baru". Masukkan Nama Lengkap, NIP, Nomor WhatsApp, Email Belajar.id / Pribadi, serta memilih kelas yang dibina. Pendaftaran akan berstatus "Pending" dan membutuhkan persetujuan (Approval) satu klik oleh Admin pada tab "Persetujuan Akun" di Pengaturan.'
  );

  drawCalloutBox(
    'Pencegahan Salah Akses Rombel',
    'Pastikan Admin memverifikasi alokasi kelas binaan tiap guru BK agar tidak terjadi tumpang tindih pembinaan. Admin dapat mengubah hak akses kelas seorang guru kapan saja melalui tombol Edit Konselor.',
    'info'
  );

  // =========================================================================
  // 5. BAB 3: DASHBOARD & EARLY WARNING SYSTEM
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 3: Dashboard & EWS');

  drawChapterHeader('BAB 3', 'DASHBOARD INTERAKTIF & EARLY WARNING SYSTEM (EWS)', 'Pusat komando visual untuk memantau dinamika kedisiplinan dan layanan siswa.');

  drawSectionTitle('3.1. Kartu Ringkasan Indikator Kinerja (KPI)');
  drawParagraph(
    'Saat membuka aplikasi, Dashboard menyajikan empat metrik utama secara real-time:'
  );
  drawBullet('Total Siswa Aktif', 'Jumlah peserta didik yang terdaftar dalam rombel binaan Anda.');
  drawBullet('Sesi Layanan Terselesaikan', 'Jumlah sesi bimbingan dan konseling yang telah tuntas ditindaklanjuti.');
  drawBullet('Pelanggaran Menunggu Tindakan', 'Kasus pelanggaran yang belum diselesaikan atau membutuhkan pemanggilan orang tua / home visit.');
  drawBullet('Siswa Berisiko Tinggi (Early Warning)', 'Jumlah siswa yang akumulasi poin pelanggarannya telah melampaui batas waspada (≥30 poin) dan memerlukan intervensi intensif segera.');

  drawSectionTitle('3.2. Grafik Tren & Visualisasi Data');
  drawParagraph(
    'Dashboard dilengkapi grafik analitik modern yang menampilkan tren kasus per minggu, distribusi jenis bimbingan (Pribadi, Sosial, Belajar, Karir), serta rekapitulasi status kehadiran kelas.'
  );

  drawSectionTitle('3.3. Fitur Pendukung Produktivitas');
  drawBullet('Jadwal Mengajar & Kegiatan Harian', 'Menampilkan agenda bimbingan klasikal dan janji konseling terjadwal hari ini.');
  drawBullet('Widget Catatan Cepat (Sticky Notes)', 'Papan memo digital interaktif untuk mencatat pengingat penting kasus siswa yang dapat dipindah dan diedit secara cepat.');
  drawBullet('Early Warning Notification Popover', 'Ikon lonceng notifikasi di bagian atas header langsung menyala merah apabila ada siswa yang akumulasi poinnya mencapai kategori darurat pemanggilan.');

  // =========================================================================
  // 6. BAB 4: DATA SISWA & PROFIL 360 DERAJAT
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 4: Data Siswa 360°');

  drawChapterHeader('BAB 4', 'MANAJEMEN DATA SISWA & PROFIL PERKEMBANGAN 360°', 'Pengelolaan database murid, penelusuran rekam jejak, dan rekap portofolio.');

  drawSectionTitle('4.1. Menambah & Mengimpor Data Siswa');
  drawParagraph(
    'Aplikasi menyediakan dua metode praktis untuk memasukkan data siswa:'
  );
  drawBullet('Input Manual Satu per Satu', 'Klik tombol "+ Tambah Siswa". Isikan NISN, Nama Lengkap, Kelas, Jenis Kelamin, Nomor Telepon/WA Orang Tua, Alamat Rumah, dan Nama Wali.');
  drawBullet('Impor Massal via Excel (.xlsx / .xls)', 'Gunakan tombol "Import Excel" pada halaman Data Siswa. Unduh format template yang disediakan, salin data siswa dari Dapodik/Emis, lalu unggah. Ratusan data siswa akan masuk dalam hitungan detik.');

  drawSectionTitle('4.2. Fitur Pencarian Cerdas & Filter Cepat');
  drawParagraph(
    'Pencarian siswa dapat dilakukan secara global dari bilah pencarian atas (Header) maupun bilah pencarian tabel Data Siswa. Cukup ketikkan nama depan, nama panggilan, NISN, atau kelas. Sistem juga menyediakan tombol filter kelas cepat (Kelas 7, 8, 9 / 10, 11, 12).'
  );

  drawSectionTitle('4.3. Kartu Profil Portofolio Siswa 360 Derajat');
  drawParagraph(
    'Dengan mengklik nama siswa, jendela Profil Siswa akan terbuka menampilkan portofolio komprehensif:'
  );
  drawBullet('Status Poin Perilaku', 'Total poin pelanggaran vs total poin apresiasi/prestasi secara transparan.');
  drawBullet('Riwayat Kasus Pelanggaran', 'Daftar tanggal, jenis pelanggaran, sanksi edukatif, dan guru pelapor.');
  drawBullet('Riwayat Konseling & Layanan', 'Catatan konseling individu/kelompok, home visit, dan bimbingan yang pernah diterima.');
  drawBullet('Portofolio Apresiasi', 'Sertifikat dan pencapaian kejuaraan atau perilaku terpuji murid.');
  drawBullet('Unduh Dokumen Profil Lengkap (PDF)', 'Tombol satu klik untuk mencetak buku rekap perkembangan siswa lengkap dengan kop dinas resmi.');

  // =========================================================================
  // 7. BAB 5: ABSENSI KELAS & DETEKSI KERENTANAN
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 5: Absensi Kelas');

  drawChapterHeader('BAB 5', 'SISTEM ABSENSI KELAS & DETEKSI KERENTANAN BOLOS', 'Pencatatan presensi harian per rombel dan peringatan siswa rentan putus sekolah.');

  drawSectionTitle('5.1. Alur Pencatatan Presensi Harian');
  drawBullet('Pilih Kelas & Tanggal', 'Buka menu "Data Utama" -> "Absensi Kelas". Pilih kelas yang dibina dan tanggal presensi.');
  drawBullet('Status Kehadiran Lengkap', 'Pilih status untuk setiap siswa: Hadir (H), Sakit (S), Izin (I), Alfa / Tanpa Keterangan (A), Terlambat (T), atau Membolos (B).');
  drawBullet('Catatan Khusus Siswa', 'Tambahkan keterangan spesifik bila diperlukan (misal: "Sakit demam berdarah" atau "Terlambat 20 menit ban bocor").');
  drawBullet('Simpan Presensi', 'Klik tombol "Simpan Absensi". Data kehadiran langsung terekam di cloud dan otomatis tercatat pada jurnal harian guru BK.');

  drawSectionTitle('5.2. Integrasi Otomatis ke Penanganan Pelanggaran');
  drawParagraph(
    'Siswa yang terdata membolos atau memiliki akumulasi Alfa berturut-turut (misal: 3 hari tanpa keterangan) dapat langsung dialihkan ke modul penanganan kasus dengan menekan tombol "Alihkan ke Kasus / Panggilan". Guru BK tidak perlu mengetik ulang biodata siswa.'
  );

  // =========================================================================
  // 8. BAB 6: PELANGGARAN, POIN & RESTITUSI
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 6: Pelanggaran & Restitusi');

  drawChapterHeader('BAB 6', 'PENCATATAN PELANGGARAN, POIN KEDISIPLINAN & RESTITUSI', 'Sistem pembobotan tata tertib dan alur pemulihan perilaku yang mendidik.');

  drawSectionTitle('6.1. Klasifikasi Bobot Pelanggaran');
  drawBullet('Pelanggaran Ringan (Poin 5 – 10)', 'Terlambat masuk sekolah, atribut seragam tidak lengkap, membuang sampah sembarangan, pakaian tidak rapi.');
  drawBullet('Pelanggaran Sedang (Poin 15 – 25)', 'Meninggalkan jam pelajaran tanpa izin (bolos), bermain ponsel saat KBM, menyontek, berkata kasar/tidak sopan.');
  drawBullet('Pelanggaran Berat (Poin 30 – 50)', 'Merokok/vape di lingkungan sekolah, perundungan (bullying) verbal/fisik, merusak fasilitas sekolah, membawa senjata tajam.');
  drawBullet('Pelanggaran Sangat Berat (Poin 75 – 100)', 'Narkoba/miras, perkelahian massal/tawuran, pornografi, tindak kriminal.');

  drawSectionTitle('6.2. Langkah Mencatat Pelanggaran Siswa');
  drawBullet('Buka Form Pelanggaran', 'Klik tombol "Catat Pelanggaran" pada sidebar atau header.');
  drawBullet('Pilih Siswa', 'Ketik nama atau NISN siswa pada kotak pencarian siswa.');
  drawBullet('Pilih Jenis Pelanggaran', 'Pilih dari daftar tata tertib standar sekolah atau ketikkan uraian pelanggaran khusus. Poin akan terisi otomatis sesuai bobot.');
  drawBullet('Identitas Guru Pelapor', 'Isikan nama guru piket atau guru mapel yang pertama kali mendapati kejadian.');
  drawBullet('Rencana Tindakan Restitusi', 'Tuliskan kesepakatan sanksi edukatif yang bermakna (misal: membaca buku di perpustakaan dan membuat resume, merawat taman sekolah, meminta maaf kepada pihak terkait).');
  drawBullet('Simpan Pelanggaran', 'Tiket kasus akan diterbitkan otomatis dengan nomor unik (Contoh: PLG-2026-8412).');

  drawSectionTitle('6.3. Jenjang Tindak Lanjut Berdasarkan Akumulasi Poin');
  drawBullet('Poin 20 – 30', 'Peringatan Lisan & Bimbingan Konseling Individu oleh Guru BK.');
  drawBullet('Poin 35 – 50', 'Surat Panggilan Orang Tua ke-1 & Penandatanganan Surat Perjanjian Siswa.');
  drawBullet('Poin 55 – 75', 'Surat Panggilan Orang Tua ke-2 & Pelaksanaan Home Visit (Kunjungan Rumah).');
  drawBullet('Poin 76 – 99', 'Surat Panggilan Orang Tua ke-3, Konferensi Kasus bersama Kepala Sekolah & Skorsing Edukatif.');
  drawBullet('Poin 100+', 'Sidang Pleno Dewan Guru & Rekomendasi Alih Tangan / Dikembalikan kepada Orang Tua.');

  // =========================================================================
  // 9. BAB 7: APRESIASI & PRESTASI SISWA
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 7: Apresiasi & Prestasi');

  drawChapterHeader('BAB 7', 'MODUL APRESIASI & PENCATATAN PRESTASI SISWA', 'Penghargaan bakat, kejuaraan lomba, dan pembinaan karakter positif.');

  drawSectionTitle('7.1. Filosofi Penguatan Karakter Positif');
  drawParagraph(
    'Bimbingan dan Konseling tidak hanya menangani siswa bermasalah. Aplikasi ini memberikan porsi yang setara untuk mendokumentasikan setiap prestasi, bakat istimewa, dan perilaku mulia peserta didik agar mereka termotivasi mengembangkan potensinya secara optimal.'
  );

  drawSectionTitle('7.2. Kategori Apresiasi & Poin Bonus');
  drawBullet('Prestasi Akademik', 'Juara OSN/KSM, nilai ujian terbaik, karya ilmiah remaja (Poin Apresiasi: 15 – 35).');
  drawBullet('Prestasi Non-Akademik', 'Kejuaraan olahraga (O2SN), seni/budaya (FLS2N), keagamaan (MTQ), kepramukaan (Poin: 15 – 35).');
  drawBullet('Karakter & Keteladanan Terpuji', 'Kejujuran luar biasa (mengembalikan dompet hilang), kepedulian sosial, aktif menjadi konselor sebaya (Poin: 10 – 20).');

  drawSectionTitle('7.3. Manfaat Sistem Apresiasi');
  drawParagraph(
    'Poin apresiasi dapat digunakan oleh sekolah sebagai pengurang akumulasi poin pelanggaran ringan melalui kesepakatan pembinaan (pemulihan nama baik), serta menjadi dasar pertimbangan rekomendasi beasiswa dan penghargaan siswa berprestasi di akhir semester.'
  );

  // =========================================================================
  // 10. BAB 8: LAYANAN BIMBINGAN & KONSELING
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 8: Layanan Konseling');

  drawChapterHeader('BAB 8', 'PENYELENGGARAAN LAYANAN BIMBINGAN & KONSELING', 'Format layanan komprehensif: Individu, Kelompok, Klasikal, dan Kolaborasi.');

  drawSectionTitle('8.1. Macam-Macam Format Layanan BK');
  drawBullet('Konseling Individual', 'Layanan empat mata tatap muka yang bersifat konfidensial untuk membantu siswa mengentaskan masalah pribadi, sosial, belajar, atau karir.');
  drawBullet('Konseling Kelompok', 'Memanfaatkan dinamika kelompok untuk memecahkan persoalan yang dialami bersama oleh beberapa siswa.');
  drawBullet('Bimbingan Klasikal', 'Layanan bimbingan terprogram yang diberikan di dalam ruang kelas kepada seluruh siswa dalam satu rombel.');
  drawBullet('Bimbingan Kelompok', 'Layanan preventif kepada kelompok kecil siswa untuk mendiskusikan topik umum (misal: tips mengatasi stress ujian, memilih jurusan).');
  drawBullet('Alih Tangan Kasus (Referral)', 'Pelimpahan penanganan siswa kepada pihak yang lebih berwenang/ahli (Psikolog, Psikiater, Dokter, atau Kepolisian).');

  drawSectionTitle('8.2. Prosedur Pencatatan Sesi Konseling');
  drawBullet('Langkah 1', 'Klik tombol "+ Tambah Sesi Layanan" pada sidebar atau menu Layanan BK.');
  drawBullet('Langkah 2', 'Pilih format layanan (Individu / Kelompok / Klasikal) dan bidang bimbingan (Pribadi / Sosial / Belajar / Karir).');
  drawBullet('Langkah 3', 'Pilih siswa peserta sesi bimbingan.');
  drawBullet('Langkah 4', 'Tentukan tanggal, jam mulai, dan jam selesai konseling.');
  drawBullet('Langkah 5', 'Uraikan permasalahan / topik bahasan, pendekatan konseling yang diterapkan (misal: Cognitive Behavioral Therapy, Reality Therapy, Solution-Focused Brief Therapy), dan hasil kesepakatan.');
  drawBullet('Langkah 6', 'Unggah bukti foto kegiatan jika diperlukan (dokumen terenkripsi).');
  drawBullet('Langkah 7', 'Simpan data. Status dapat diatur "Terjadwal" atau langsung "Selesai".');

  drawSectionTitle('8.3. Cetak Berita Acara / Laporan Konseling (PDF)');
  drawParagraph(
    'Setiap sesi konseling dapat dicetak menjadi dokumen Berita Acara Konseling resmi berformat PDF lengkap dengan tanggal, tanda tangan konselor, dan tanda tangan siswa konseli.'
  );

  // =========================================================================
  // 11. BAB 9: SURAT PANGGILAN ORANG TUA
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 9: Surat Panggilan');

  drawChapterHeader('BAB 9', 'ADMINISTRASI SURAT PANGGILAN ORANG TUA / WALI', 'Pembuatan surat panggilan dinas otomatis dengan QR Code dan nomor surat standar.');

  drawSectionTitle('9.1. Kriteria Penerbitan Surat Panggilan');
  drawParagraph(
    'Surat panggilan diterbitkan apabila siswa membutuhkan pendampingan bersama orang tua, seperti akumulasi pelanggaran melampaui batas, ketidakhadiran berulang tanpa keterangan, atau pembahasan perkembangan belajar krusial.'
  );

  drawSectionTitle('9.2. Langkah Pembuatan Surat Panggilan');
  drawBullet('Buka Menu Panggilan Orang Tua', 'Buka tab "Layanan BK" lalu pilih sub-tab "Panggilan Orang Tua".');
  drawBullet('Klik Tombol Terbitkan Surat', 'Tekan tombol "+ Buat Surat Panggilan".');
  drawBullet('Pilih Siswa & Nomor Urut Panggilan', 'Pilih siswa yang bersangkutan. Tentukan tingkat pemanggilan: Surat Panggilan I, Surat Panggilan II, atau Surat Panggilan III.');
  drawBullet('Atur Waktu & Tempat Pertemuan', 'Tentukan hari, tanggal, pukul (WIB), dan ruangan pertemuan (misal: Ruang Bimbingan Konseling).');
  drawBullet('Uraikan Maksud Pemanggilan', 'Tuliskan hal yang akan dimusyawarahkan secara santun dan profesional.');
  drawBullet('Pilih Penanda Tangan', 'Surat otomatis mencantumkan nama Guru BK Pembimbing dan dapat menyertakan persetujuan Kepala Sekolah.');

  drawSectionTitle('9.3. Keunggulan Format Surat Panggilan PDF');
  drawBullet('Kop Surat Resmi Dinas', 'Memuat nama instansi pemerintah, dinas pendidikan, logo daerah, dan logo sekolah yang proporsional.');
  drawBullet('Penomoran Surat Standar Kedinasan', 'Format nomor surat otomatis: 421.3 / [Nomor] / BK / [Tahun].');
  drawBullet('QR Code Keabsahan Dokumen', 'Surat dilengkapi QR Code digital yang memvalidasi keaslian dokumen saat dipindai.');
  drawBullet('Lembar Tanda Terima Potongan (Tanda Tangan Orang Tua)', 'Bagian bawah surat memuat lembar potong tanda terima untuk dikembalikan ke sekolah.');

  // =========================================================================
  // 12. BAB 10: KUNJUNGAN RUMAH (HOME VISIT)
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 10: Home Visit');

  drawChapterHeader('BAB 10', 'LAYANAN KUNJUNGAN RUMAH (HOME VISIT)', 'Investigasi langsung ke kediaman siswa untuk memahami latar belakang keluarga.');

  drawSectionTitle('10.1. Tujuan & Sasaran Home Visit');
  drawParagraph(
    'Home Visit dilakukan untuk memperoleh data komprehensif mengenai kondisi keluarga, ekonomi, lingkungan tempat tinggal, dan pola asuh orang tua siswa, terutama bagi siswa yang tidak hadir berhari-hari atau mengalami perubahan perilaku drastis.'
  );

  drawSectionTitle('10.2. Paket Dokumen Resmi Home Visit');
  drawParagraph(
    'Aplikasi secara otomatis menghasilkan 3 (tiga) lembar dokumen resmi berstandar dinas:'
  );
  drawBullet('1. Surat Tugas Kunjungan Rumah', 'Surat perintah tugas resmi dari Kepala Sekolah yang menugaskan Guru BK / Tim Penanganan Siswa.');
  drawBullet('2. Berita Acara & Lembar Wawancara', 'Instrumen rekam kondisi rumah tangga, ringkasan perbincangan dengan orang tua/wali, serta solusi yang disepakati.');
  drawBullet('3. Lembar Komitmen Orang Tua & Dokumentasi', 'Surat pernyataan kesediaan orang tua mendampingi anak dan ruang foto dokumentasi kunjungan.');

  // =========================================================================
  // 13. BAB 11: PEMBINAAN & KONTRAK PERILAKU
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 11: Pembinaan Khusus');

  drawChapterHeader('BAB 11', 'MODUL PEMBINAAN & PENDISIPLINAN KHUSUS', 'Surat perjanjian bermaterai, kontrak perilaku terukur, jurnal bertahap, dan RTL.');

  drawSectionTitle('11.1. Empat Instrumen Pembinaan Lanjutan');
  drawBullet('Surat Perjanjian Siswa', 'Surat pernyataan formal kesanggupan menaati tata tertib sekolah, ditandatangani siswa, orang tua, wali kelas, guru BK, dan kepala sekolah.');
  drawBullet('Kontrak Perilaku Siswa (Behavior Contract)', 'Kontrak psikopedagogis terstruktur yang merumuskan perilaku positif sasaran, konsekuensi logis, dan reward penguatan.');
  drawBullet('Jurnal Pembinaan Bertahap', 'Tabel evaluasi mingguan untuk memantau apakah perilaku siswa mengalami perbaikan nyata hari demi hari.');
  drawBullet('Rencana Tindak Lanjut (RTL)', 'Rencana aksi kolaboratif jangka menengah yang melibatkan guru mata pelajaran dan orang tua.');

  drawSectionTitle('11.2. Cara Menggunakan Modul Pembinaan');
  drawParagraph(
    'Buka menu "Layanan BK & Kasus" -> "Pendisiplinan". Pilih siswa dari daftar siswa berisiko atau cari nama siswa. Pilih salah satu dari 4 tab instrumen (Perjanjian / Kontrak Perilaku / Jurnal / RTL). Lengkapi isian formulir, lalu klik "Simpan" dan tekan "Cetak PDF" untuk mencetak dokumen siap tanda tangan.'
  );

  // =========================================================================
  // 14. BAB 12: ASESMEN KEBUTUHAN SISWA (AKPD)
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 12: Asesmen AKPD');

  drawChapterHeader('BAB 12', 'ASESMEN KEBUTUHAN SISWA & DIAGNOSTIK BK', 'Pemetaan komprehensif: AKPD, Gaya Belajar, dan Profil Minat Siswa.');

  drawSectionTitle('12.1. Angket Kebutuhan Peserta Didik (AKPD)');
  drawParagraph(
    'Asesmen kebutuhan merupakan pondasi penyusunan program tahunan bimbingan konseling. Modul Asesmen menyediakan instrumen AKPD yang mencakup 4 bidang bimbingan:'
  );
  drawBullet('Bidang Pribadi', 'Tingkat kepercayaan diri, manajemen emosi, ketaatan beribadah, dan pemahaman diri.');
  drawBullet('Bidang Sosial', 'Hubungan pertemanan sebaya, adaptasi lingkungan sekolah, dan etika berkomunikasi.');
  drawBullet('Bidang Belajar', 'Motivasi belajar, kesulitan konsentrasi, manajemen waktu, dan persiapan ujian.');
  drawBullet('Bidang Karir', 'Rencana kelanjutan studi (SMA/SMK/Kuliah), pengenalan cita-cita, dan bakat minat kerja.');

  drawSectionTitle('12.2. Asesmen Diagnostik Gaya Belajar');
  drawParagraph(
    'Memetakan profil modalitas belajar siswa (Visual, Auditori, Kinestetik) agar guru BK dan guru mata pelajaran dapat menerapkan metode pembelajaran yang berdiferensiasi sesuai kebutuhan murid.'
  );

  // =========================================================================
  // 15. BAB 13: JURNAL HARIAN GURU BK
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 13: Jurnal Harian');

  drawChapterHeader('BAB 13', 'JURNAL HARIAN GURU BK & BUKTI KINERJA', 'Pencatatan agenda kerja harian yang sinkron otomatis untuk penilaian kinerja.');

  drawSectionTitle('13.1. Konsep Jurnal Harian Terpadu');
  drawParagraph(
    'Jurnal Harian berfungsi sebagai buku catatan kerja harian resmi guru BK untuk memenuhi kewajiban jam kerja dinas dan penilaian kinerja (SKP/PMM). Setiap kali Anda menyelesaikan sesi konseling atau mengisi absensi, kegiatan tersebut dapat otomatis tertaut ke dalam jurnal harian tanpa perlu input berulang.'
  );

  drawSectionTitle('13.2. Mengisi & Mencetak Jurnal');
  drawBullet('Pencatatan Harian', 'Buka menu "Dashboard & Laporan" -> "Jurnal Harian". Klik "+ Tambah Kegiatan Jurnal". Isikan Jam Pelaksanaan, Sasaran Siswa/Kelas, Uraian Kegiatan, dan Hasil yang Dicapai.');
  drawBullet('Filter Periode', 'Pilih rentang tanggal (Harian, Mingguan, Bulanan) untuk melihat rekapitulasi agenda kerja.');
  drawBullet('Ekspor PDF Jurnal Resmi', 'Klik tombol "Cetak Jurnal PDF" untuk mengunduh laporan rekapitulasi kegiatan lengkap dengan tanda tangan Kepala Sekolah.');

  // =========================================================================
  // 16. BAB 14: PELAPORAN & REKAPITULASI RESMI
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 14: Pelaporan & Rekap');

  drawChapterHeader('BAB 14', 'REKAPITULASI LAPORAN DINAS & EKSPOR DATA', 'Laporan bulanan, semesteran, dan tahunan siap cetak berstandar dinas pendidikan.');

  drawSectionTitle('14.1. Ragam Laporan Rekapitulasi');
  drawBullet('Laporan Bulanan Kasus & Pelanggaran', 'Tabulasi seluruh kejadian pelanggaran, nama siswa, bobot poin, dan status penyelesaian.');
  drawBullet('Laporan Rekapitulasi Sesi Konseling', 'Jumlah sesi konseling individu, kelompok, klasikal, dan alih tangan kasus yang terlaksana.');
  drawBullet('Laporan Prestasi & Apresiasi Murid', 'Daftar penghargaan dan pencapaian positif siswa dalam satu semester.');
  drawBullet('Rekapitulasi Kehadiran & Ketidakhadiran Kelas', 'Persentase kehadiran per kelas dan daftar siswa dengan ketidakhadiran tinggi.');

  drawSectionTitle('14.2. Ekspor Format Excel & PDF');
  drawParagraph(
    'Semua tabel laporan dapat diekspor ke dalam file spreadsheet Excel (.xlsx) untuk pengolahan data lanjutan atau dicetak langsung menjadi buku laporan resmi PDF berformat rapi dan profesional.'
  );

  // =========================================================================
  // 17. BAB 15: ASISTEN CERDAS AI (GEMINI)
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 15: Asisten Cerdas AI');

  drawChapterHeader('BAB 15', 'FITUR KECERDASAN BUATAN (GEMINI AI ASSISTANT)', 'Dukungan analisis psikopedagogis untuk membantu keputusan guru BK.');

  drawSectionTitle('15.1. Peran AI dalam Bimbingan Konseling');
  drawParagraph(
    'Aplikasi ini terintegrasi dengan Google Gemini AI melalui backend server aman. AI bertindak sebagai mitra asisten analisis psikopedagogis bagi guru BK, bukan untuk menggantikan empati dan pertimbangan manusia, melainkan untuk memberikan rujukan teori bimbingan konseling secara cepat.'
  );

  drawSectionTitle('15.2. Cara Menggunakan Asisten AI');
  drawBullet('Widget Asisten AI di Pojok Kanan Bawah', 'Klik ikon robot/bintang cerdas di pojok kanan bawah layar untuk membuka panel chat interaktif.');
  drawBullet('Diagnosa Masalah Perilaku Siswa', 'Saat mencatat pelanggaran atau konseling, tekan tombol "Analisis AI". Masukkan deskripsi singkat permasalahan. AI akan memberikan sintesis kemungkinan akar masalah (keluarga, pertemanan, kebutuhan dasar yang defisit) dan menyarankan 3 alternatif teknik konseling terbaik.');
  drawBullet('Perumusan Kontrak Perilaku Terukur', 'AI dapat membantu merumuskan kalimat target perilaku positif dan reward yang sesuai dengan tingkat usia murid.');

  // =========================================================================
  // 18. BAB 16: CLOUD SYNC & GOOGLE INTEGRATION
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 16: Cloud & Keamanan');

  drawChapterHeader('BAB 16', 'SINKRONISASI CLOUD, GOOGLE SHEETS & KEAMANAN', 'Ketahanan data multi-perangkat, pencadangan otomatis, dan perlindungan privasi.');

  drawSectionTitle('16.1. Mekanisme Cloud Firestore Real-Time');
  drawParagraph(
    'Setiap aksi penambahan, pengubahan, atau penghapusan data secara otomatis dikirim ke Google Cloud Firestore. Apabila beberapa guru BK membuka aplikasi secara bersamaan dari komputer berbeda atau ponsel pintar, data akan saling tersinkronisasi dalam waktu hitungan detik.'
  );

  drawSectionTitle('16.2. Cadangan Mandiri ke Google Sheets (Opsional)');
  drawParagraph(
    'Melalui menu "Integrasi Google", guru BK dapat menghubungkan aplikasi ke Google Spreadsheet pribadi sekolah. Setiap data siswa, pelanggaran, dan layanan dapat disinkronkan langsung ke baris tabel Google Sheets sebagai salinan arsip mandiri.'
  );

  drawSectionTitle('16.3. Backup & Restore Data JSON');
  drawParagraph(
    'Pada menu Pengaturan, tersedia fitur "Unduh Cadangan JSON". Koordinator BK disarankan mengunduh berkas cadangan data secara berkala (misal: tiap akhir semester) untuk disimpan di media penyimpanan lokal/flashdisk sekolah.'
  );

  // =========================================================================
  // 19. BAB 17: INSTALASI PWA (OFFLINE APP)
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 17: Instalasi PWA');

  drawChapterHeader('BAB 17', 'PANDUAN INSTALASI APLIKASI (PWA DI PC & HP)', 'Cara memasang aplikasi layaknya software desktop dan aplikasi Android.');

  drawSectionTitle('17.1. Instalasi di Komputer / Laptop (Google Chrome / Edge)');
  drawBullet('Langkah 1', 'Buka tautan aplikasi di peramban Google Chrome atau Microsoft Edge.');
  drawBullet('Langkah 2', 'Perhatikan bilah alamat (URL bar) di kanan atas. Klik ikon "Install App" (komputer dengan panah ke bawah).');
  drawBullet('Langkah 3', 'Klik "Install". Aplikasi akan terpasang di desktop komputer Anda dan dapat dibuka langsung tanpa perlu membuka browser terlebih dahulu.');

  drawSectionTitle('17.2. Instalasi di HP Android (Smartphone / Tablet)');
  drawBullet('Langkah 1', 'Buka tautan aplikasi melalui Google Chrome di ponsel pintar Anda.');
  drawBullet('Langkah 2', 'Tekan ikon titik tiga di pojok kanan atas browser Chrome.');
  drawBullet('Langkah 3', 'Pilih menu "Tambahkan ke Layar Utama" (Add to Home Screen) atau "Instal Aplikasi".');
  drawBullet('Langkah 4', 'Ikon aplikasi Sistem BK akan muncul di layar utama ponsel Anda dan dapat dioperasikan secara penuh.');

  // =========================================================================
  // 20. BAB 18: FAQ & TROUBLESHOOTING
  // =========================================================================
  doc.addPage();
  currentY = 24;
  drawRunningHeader('Bab 18: FAQ & Solusi');

  drawChapterHeader('BAB 18', 'TANYA JAWAB (FAQ) & PANDUAN PEMECAHAN MASALAH', 'Jawaban atas pertanyaan umum dan solusi teknis kendala operasional.');

  drawSectionTitle('18.1. Tanya Jawab Populer (FAQ)');
  drawBullet('Apakah aplikasi ini bisa digunakan di sekolah lain?', 'Ya, aplikasi ini 100% fleksibel dan multi-sekolah. Masukkan identitas sekolah dan NPSN Anda di menu Pengaturan, dan seluruh kop surat serta data akan terpisah rapi.');
  drawBullet('Bagaimana jika internet di sekolah tiba-tiba mati saat sedang mengetik?', 'Tenang! Aplikasi bekerja secara offline-first. Semua ketikan Anda tersimpan aman di memori perangkat lokal dan akan otomatis diunggah ke cloud saat internet kembali menyala.');
  drawBullet('Apakah guru BK lain bisa mengubah catatan konseling saya?', 'Guru BK hanya dapat melihat dan membina siswa pada kelas yang dialokasikan padanya. Hanya Koordinator/Admin yang dapat memantau seluruh kelas.');
  drawBullet('Bagaimana cara mengganti logo di kop surat PDF?', 'Buka menu Pengaturan -> Pengaturan Sekolah. Unggah berkas gambar logo sekolah (format PNG transparan disarankan) pada kolom Logo Sekolah. Sistem akan langsung memperbarui seluruh cetakan PDF.');

  drawSectionTitle('18.2. Pemecahan Masalah (Troubleshooting)');
  drawBullet('Tampilan Terasa Tidak Berubah Setelah Update', 'Lakukan Refresh paksa dengan menekan tombol Ctrl + Shift + R pada keyboard laptop, atau hapus cache browser Anda.');
  drawBullet('Lupa Kata Sandi Akun Guru BK', 'Mintalah kepada Koordinator BK (Admin) untuk membuka menu Pengaturan -> Manajemen Konselor, lalu klik tombol Edit pada nama Anda untuk melihat atau menyetel ulang kata sandi baru.');
  drawBullet('Status Cloud Menunjukkan "Offline"', 'Periksa sambungan Wi-Fi atau paket data internet Anda. Klik tombol "Segarkan Koneksi" pada ikon cloud di header atas untuk menyambungkan kembali.');

  // Closing Note & Signature Page Block
  currentY += 6;
  checkPageBreak(35);
  doc.setFillColor(softTealBg[0], softTealBg[1], softTealBg[2]);
  doc.setDrawColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, currentY, contentWidth, 30, 2, 2, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.text('KOMITMEN PELAYANAN BIMBINGAN DAN KONSELING RAMAH ANAK', marginX + 6, currentY + 7);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(bodyCharcoal[0], bodyCharcoal[1], bodyCharcoal[2]);
  doc.text(
    doc.splitTextToSize(
      'Aplikasi ini dikembangkan untuk mendukung terwujudnya iklim sekolah yang aman, inklusif, dan membahagiakan bagi seluruh peserta didik. Mari wujudkan administrasi bimbingan konseling yang humanis, akurat, dan berdampak nyata bagi masa depan generasi bangsa.',
      contentWidth - 12
    ),
    marginX + 6,
    currentY + 13
  );

  // =========================================================================
  // FOOTER & NOMOR HALAMAN DI SELURUH HALAMAN (EXCEPT COVER)
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i === 1) continue; // Jangan tampilkan running footer di halaman cover

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(bodyCharcoal[0], bodyCharcoal[1], bodyCharcoal[2]);

    // Footer Divider Line
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.25);
    doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14);

    doc.text(
      `Buku Panduan Sistem Administrasi BK • ${config.schoolName}`,
      marginX,
      pageHeight - 9.5
    );
    doc.text(
      `Halaman ${i} dari ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 9.5,
      { align: 'right' }
    );
  }

  // Save PDF & Auto Sync to Google Drive
  const cleanSchoolName = config.schoolName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Buku_Panduan_Fitur_Aplikasi_BK_${cleanSchoolName}.pdf`;
  finalizeAndSavePdf(doc, filename, {
    category: 'umum',
    successToastMessage: 'Buku Panduan & Dokumentasi Fitur Aplikasi berhasil diunduh & tersimpan otomatis di Google Drive!',
  });
}
