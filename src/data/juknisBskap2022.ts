/**
 * PANDUAN OPERASIONAL & IMPLEMENTASI BIMBINGAN DAN KONSELING KURIKULUM MERDEKA
 * Badan Standar, Kurikulum, dan Asesmen Pendidikan (BSKAP Edisi Terkini)
 * & Permendikbudristek No. 46 Tahun 2023 (PPKSP - Pencegahan dan Penanganan Kekerasan di Satuan Pendidikan)
 * Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi Republik Indonesia
 */

export interface RiasecQuestionItem {
  id: number;
  text: string;
  categoryCode: 1 | 2 | 3 | 4 | 5 | 6; // 1=R, 2=I, 3=A, 4=S, 5=E, 6=C
  type: 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
}

export interface RiasecSkillItem {
  id: string;
  label: string;
  type: 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
  category: string;
}

export interface RiasecCareerInterpretation {
  code: 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
  title: string;
  tagline: string;
  characteristics: string;
  profesiPendukung: string[];
  jalurBimbinganKarir: string[];
  mapelPilihanRekomendasi: string[];
}

/**
 * 42 Butir Kuesioner Minat RIASEC (Instrumen 1 - Lampiran 10 Juknis BSKAP 2022)
 */
export const RIASEC_MINAT_QUESTIONS: RiasecQuestionItem[] = [
  { id: 1, text: 'Aku suka mengulik peralatan mekanik / mesin', categoryCode: 1, type: 'R' },
  { id: 2, text: 'Aku suka mengerjakan puzzle / teka-teki logika', categoryCode: 2, type: 'I' },
  { id: 3, text: 'Aku suka bekerja mandiri dan mengekspresikan ide sendiri', categoryCode: 3, type: 'A' },
  { id: 4, text: 'Aku suka bekerja dalam kelompok dan membantu teman', categoryCode: 4, type: 'S' },
  { id: 5, text: 'Aku suka membuat target prestasi untuk diriku sendiri & memimpin', categoryCode: 5, type: 'E' },
  { id: 6, text: 'Aku suka merapikan barang-barang (buku, alat tulis, kamar, data)', categoryCode: 6, type: 'C' },
  { id: 7, text: 'Aku suka menyusun balok / LEGO / merakit model', categoryCode: 1, type: 'R' },
  { id: 8, text: 'Aku suka membaca buku tentang seni, musik, atau sastra', categoryCode: 3, type: 'A' },
  { id: 9, text: 'Aku suka mengerjakan hal-hal dengan instruksi dan alur yang jelas', categoryCode: 6, type: 'C' },
  { id: 10, text: 'Aku suka meyakinkan dan memengaruhi teman untuk mengikuti caraku', categoryCode: 5, type: 'E' },
  { id: 11, text: 'Aku suka melakukan percobaan sains / eksperimen ilmiah', categoryCode: 2, type: 'I' },
  { id: 12, text: 'Aku suka menjelaskan suatu pelajaran / konsep kepada teman', categoryCode: 4, type: 'S' },
  { id: 13, text: 'Aku suka membantu orang lain memecahkan persoalan hidupnya', categoryCode: 4, type: 'S' },
  { id: 14, text: 'Aku suka memelihara dan merawat binatang atau tanaman', categoryCode: 1, type: 'R' },
  { id: 15, text: 'Aku tidak berkeberatan bekerja dengan ketelitian tinggi dan jadwal teratur', categoryCode: 6, type: 'C' },
  { id: 16, text: 'Aku suka menjual sesuatu atau berwirausaha', categoryCode: 5, type: 'E' },
  { id: 17, text: 'Aku suka membuat karya berbentuk tulisan, puisi, atau cerita', categoryCode: 3, type: 'A' },
  { id: 18, text: 'Aku suka pelajaran sains, fenomena alam, dan riset', categoryCode: 2, type: 'I' },
  { id: 19, text: 'Aku suka mendapatkan tantangan baru yang kompetitif', categoryCode: 5, type: 'E' },
  { id: 20, text: 'Aku suka menghibur teman yang sedang sedih atau cemas', categoryCode: 4, type: 'S' },
  { id: 21, text: 'Aku suka mencari tahu cara kerja sebuah alat elektronik atau mesin', categoryCode: 2, type: 'I' },
  { id: 22, text: 'Aku suka merangkaikan, menyolder, atau merakit benda nyata', categoryCode: 1, type: 'R' },
  { id: 23, text: 'Aku adalah orang yang kreatif dan suka hal-hal yang tidak monoton', categoryCode: 3, type: 'A' },
  { id: 24, text: 'Aku suka memperhatikan detail dan ketelitian laporan', categoryCode: 6, type: 'C' },
  { id: 25, text: 'Aku suka merapikan catatan pelajaran, tabel, atau lembar kerja (LKS)', categoryCode: 6, type: 'C' },
  { id: 26, text: 'Aku suka mencari tahu akar penyebab suatu kejadian secara mendalam', categoryCode: 2, type: 'I' },
  { id: 27, text: 'Aku suka memainkan alat musik, bernyanyi, atau mengaransemen lagu', categoryCode: 3, type: 'A' },
  { id: 28, text: 'Aku suka mempelajari budaya, adat, dan bahasa berbagai daerah', categoryCode: 4, type: 'S' },
  { id: 29, text: 'Aku ingin membuka usaha / bisnis sendiri suatu saat nanti', categoryCode: 5, type: 'E' },
  { id: 30, text: 'Aku suka memasak, meracik resep, atau praktek langsung di dapur/lapangan', categoryCode: 1, type: 'R' },
  { id: 31, text: 'Aku suka bermain peran, akting, atau drama panggung', categoryCode: 3, type: 'A' },
  { id: 32, text: 'Aku suka mempraktikkan langsung hal-hal yang baru aku pelajari', categoryCode: 1, type: 'R' },
  { id: 33, text: 'Aku suka menganalisis soal matematika, statistik, atau grafik data', categoryCode: 2, type: 'I' },
  { id: 34, text: 'Aku suka mendiskusikan isu sosial dan hal-hal yang terjadi di sekitarku', categoryCode: 4, type: 'S' },
  { id: 35, text: 'Aku suka menata ruangan dan mengatur kerapian kamarku sendiri', categoryCode: 6, type: 'C' },
  { id: 36, text: 'Aku suka memimpin kelompok, organisasi, atau kelas', categoryCode: 5, type: 'E' },
  { id: 37, text: 'Aku suka berkegiatan fisik di luar ruangan (outdoor / lapangan)', categoryCode: 1, type: 'R' },
  { id: 38, text: 'Aku suka berkegiatan di dalam ruangan dengan dokumen dan meja kerja', categoryCode: 6, type: 'C' },
  { id: 39, text: 'Aku suka berhitung cepat dan mengelola anggaran keuangan', categoryCode: 2, type: 'I' },
  { id: 40, text: 'Aku suka menjadi sukarelawan dan menolong orang yang kesulitan', categoryCode: 4, type: 'S' },
  { id: 41, text: 'Aku suka menggambar, melukis, membuat desain, atau fotografi', categoryCode: 3, type: 'A' },
  { id: 42, text: 'Aku suka berbicara, presentasi, dan berpidato di depan umum', categoryCode: 5, type: 'E' },
];

/**
 * 24 Butir Keterampilan RIASEC (Instrumen 2 - Lampiran 10 Juknis BSKAP 2022)
 */
export const RIASEC_KETERAMPILAN_ITEMS: RiasecSkillItem[] = [
  { id: 'k1', label: 'Memperbaiki barang / alat rusak', type: 'R', category: 'Doers' },
  { id: 'k2', label: 'Mencari solusi masalah rumit', type: 'I', category: 'Thinkers' },
  { id: 'k3', label: 'Memberi saran / nasehat bijak', type: 'S', category: 'Helpers' },
  { id: 'k4', label: 'Mengutak-atik barang mekanik', type: 'R', category: 'Doers' },
  { id: 'k5', label: 'Menari / mengekspresikan tubuh', type: 'A', category: 'Creators' },
  { id: 'k6', label: 'Mengelola acara / event organiser', type: 'E', category: 'Persuaders' },
  { id: 'k7', label: 'Memahami perasaan orang lain', type: 'S', category: 'Helpers' },
  { id: 'k8', label: 'Menulis cerita / artikel kreatif', type: 'A', category: 'Creators' },
  { id: 'k9', label: 'Menganalisis data & logika masalah', type: 'I', category: 'Thinkers' },
  { id: 'k10', label: 'Bermusik / mengolah vokal', type: 'A', category: 'Creators' },
  { id: 'k11', label: 'Membongkar-pasang perangkat', type: 'R', category: 'Doers' },
  { id: 'k12', label: 'Membereskan & mengarsip barang', type: 'C', category: 'Organizers' },
  { id: 'k13', label: 'Mengajar / membimbing teman', type: 'S', category: 'Helpers' },
  { id: 'k14', label: 'Mengurutkan data & dokumen', type: 'C', category: 'Organizers' },
  { id: 'k15', label: 'Memimpin kelompok kerja', type: 'E', category: 'Persuaders' },
  { id: 'k16', label: 'Membantu orang dengan tulus', type: 'S', category: 'Helpers' },
  { id: 'k17', label: 'Menjual barang / promosi produk', type: 'E', category: 'Persuaders' },
  { id: 'k18', label: 'Menghitung cepat & teliti', type: 'I', category: 'Thinkers' },
  { id: 'k19', label: 'Berpikir logis & sistematis', type: 'I', category: 'Thinkers' },
  { id: 'k20', label: 'Membujuk & meyakinkan orang', type: 'E', category: 'Persuaders' },
  { id: 'k21', label: 'Mengikuti aturan & SOP ketat', type: 'C', category: 'Organizers' },
  { id: 'k22', label: 'Merakit benda atau instalasi fisik', type: 'R', category: 'Doers' },
  { id: 'k23', label: 'Menggambar sketsa atau desain visual', type: 'A', category: 'Creators' },
  { id: 'k24', label: 'Menjalankan jadwal rutin terjadwal', type: 'C', category: 'Organizers' },
];

/**
 * Matriks Interpretasi Profesi & Jalur Karir RIASEC Standar BSKAP 2022
 */
export const RIASEC_INTERPRETATIONS: Record<'R' | 'I' | 'A' | 'S' | 'E' | 'C', RiasecCareerInterpretation> = {
  R: {
    code: 'R',
    title: 'Realistic (Doers / Praktisi Lapangan)',
    tagline: 'Terampil secara mekanik, mengutamakan keterampilan fisik, kekuatan motorik, dan manipulasi alat.',
    characteristics: 'Menyukai pekerjaan konkrit dengan alat, mesin, tumbuhan, hewan, atau kegiatan di luar ruangan.',
    profesiPendukung: ['Pertanian & Agribisnis', 'Asisten Kesehatan / Fisioterapi', 'Teknisi Komputer & Jaringan', 'Konstruksi & Arsitektur Lapangan', 'Mekanik Otomotif / Mesin', 'Pariwisata & Ekowisata'],
    jalurBimbinganKarir: ['Pengelolaan Sumber Daya Alam', 'Pelayanan Kesehatan Praktis', 'Teknik Industri & Manufaktur', 'Rekayasa Teknologi', 'Seni Pertunjukan Teknis'],
    mapelPilihanRekomendasi: ['Fisika', 'Biologi', 'Informatika', 'Keahlian Otomotif/Elektronika (SMK)', 'Agroteknologi']
  },
  I: {
    code: 'I',
    title: 'Investigative (Thinkers / Peneliti & Analis)',
    tagline: 'Tertarik mengobservasi, meneliti, menganalisis secara mendalam dan memecahkan persoalan rumit.',
    characteristics: 'Menyukai riset ilmiah, observasi gejala, pemikiran teoritis konseptual, dan logika analitis.',
    profesiPendukung: ['Ilmuwan Kelautan / Maritim', 'Insinyur Teknik (Engineer)', 'Ilmuwan Kimia / Farmasi', 'Dokter Hewan', 'Peternakan Modern', 'Dokter Umum / Spesialis', 'Ekonom & Data Analyst', 'Psikolog Klinis / Peneliti', 'Fisikawan & Matematikawan', 'Pakar Hukum'],
    jalurBimbinganKarir: ['Layanan Kesehatan & Riset Medis', 'Analisis Bisnis & Finansial', 'Pekerjaan Sosial & Riset Kebijakan', 'Teknik Industri', 'Rekayasa Teknologi Cerdas'],
    mapelPilihanRekomendasi: ['Matematika Tingkat Lanjut', 'Fisika', 'Kimia', 'Biologi', 'Ekonomi']
  },
  A: {
    code: 'A',
    title: 'Artistic (Creators / Kreator & Seniman)',
    tagline: 'Bekerja pada situasi tidak terstruktur, leluasa mengekspresikan imajinasi dan kreativitas estetis.',
    characteristics: 'Menyukai ekspresi diri melalui seni rupa, musik, sastra, desain, drama, dan media interaktif.',
    profesiPendukung: ['Spesialis Komunikasi & Media', 'Kecantikan & Tata Rias Estetis', 'Seniman Lukis / Patung', 'Sastrawan & Penulis Naskah', 'Fotografer & Videografer', 'Penyiar Radio / Presenter TV', 'Desainer Interior & Arsitek', 'Desain Komunikasi Visual (DKV)'],
    jalurBimbinganKarir: ['Pekerja Sosial Kreatif', 'Industri Seni & Budaya', 'Komunikasi & Periklanan Digital'],
    mapelPilihanRekomendasi: ['Seni Rupa / Musik / Teater', 'Bahasa & Sastra Indonesia / Asing', 'Desain Grafis / DKV', 'Informatika Multimedia']
  },
  S: {
    code: 'S',
    title: 'Social (Helpers / Pendidik & Konselor)',
    tagline: 'Suka bekerja bersama manusia, membantu sesama, mendidik, memberi konseling, dan melayani.',
    characteristics: 'Memiliki empati tinggi, komunikatif, sabar, peduli masalah kemanusiaan, dan suka kolaborasi.',
    profesiPendukung: ['Guru Bimbingan Konseling / Konselor', 'Perawat & Tenaga Medis', 'Fisioterapis / Terapis Okupasi', 'Pemandu Wisata & Hospitality', 'Spesialis Periklanan Ramah Sosial', 'Public Relations (PR / Humas)', 'Pendidik / Guru Sekolah'],
    jalurBimbinganKarir: ['Layanan Kesehatan Masyarakat', 'Pekerja Sosial & Kesejahteraan', 'Pendidikan dan Pelatihan'],
    mapelPilihanRekomendasi: ['Sosiologi', 'Psikologi / Antropologi', 'Bahasa Indonesia Tingkat Lanjut', 'Biologi (Kesehatan)', 'Pendidikan Karakter']
  },
  E: {
    code: 'E',
    title: 'Enterprising (Persuaders / Pemimpin & Wirausahawan)',
    tagline: 'Suka mempengaruhi orang lain, memimpin, mengorganisir, dan berwirausaha untuk mencapai target.',
    characteristics: 'Ambisius, percaya diri di depan umum, energetik, jago negosiasi, dan memiliki jiwa kepemimpinan.',
    profesiPendukung: ['Pengusaha / Wirausahawan (CEO)', 'Agen Real Estate & Properti', 'Manajer Pemasaran (Marketing)', 'Advokat / Pengacara Hukum', 'Politisi & Analis Sosial Politik', 'Manajer Perdagangan Internasional', 'Perbankan & Financial Advisor'],
    jalurBimbinganKarir: ['Pengembangan Bisnis & Startup', 'Pemberdayaan Sosial Masyarakat', 'Seni Pertunjukan Komersial', 'Manajemen Komunikasi Publik'],
    mapelPilihanRekomendasi: ['Ekonomi Tingkat Lanjut', 'Sosiologi', 'Geografi', 'Bahasa Inggris / Asing', 'Kewirausahaan']
  },
  C: {
    code: 'C',
    title: 'Conventional (Organizers / Administrator & Pengelola Data)',
    tagline: 'Tertarik pada hal mendetail, terorganisir rapi, angka numerik, dan pengarsipan data terstruktur.',
    characteristics: 'Rapi, teliti, taat prosedur/SOP, konsisten, telaten mengolah tabel, laporan, dan administrasi.',
    profesiPendukung: ['Akuntan Publik & Auditor', 'Underwriter Asuransi', 'Administrator Kantor & Arsiparis', 'Petugas Perbankan (Teller/Back Office)', 'Data Processing Specialist & Operator Sistem'],
    jalurBimbinganKarir: ['Layanan Kesehatan Administratif', 'Manajemen Bisnis & Keuangan', 'Teknik Industri Terjadwal', 'Teknologi Informasi & Database'],
    mapelPilihanRekomendasi: ['Ekonomi / Akuntansi', 'Matematika', 'Informatika (Database / Spreadsheet)', 'Administrasi Perkantoran']
  }
};

/**
 * 6 Model Pelibatan Orang Tua / Tri Sentra Pendidikan (Joyce Epstein 2009 - Juknis BSKAP 2022 Hal 29-30)
 */
export const EPSTEIN_PARENT_PARTNERSHIP_MODELS = [
  {
    id: 1,
    title: '1. Parenting (Pola Pengasuhan)',
    desc: 'Memberikan kelas-kelas orang tua tentang keterampilan mengasuh anak, pemahaman pubertas remaja, dan lingkungan rumah yang sehat.',
    activities: [
      'Kelas Parenting berkala bersama psikolog/ahli tumbuh kembang',
      'Sosialisasi pendampingan fase pubertas anak kelas 7 & masa transisi',
      'Edukasi pendidikan seksual (sex education) dan batasan tubuh yang aman'
    ]
  },
  {
    id: 2,
    title: '2. Menjadi Relawan di Sekolah',
    desc: 'Membuka peluang bagi orang tua menjadi narasumber guru tamu pengenalan profesi atau relawan kegiatan sekolah.',
    activities: [
      'Program "Orang Tua Berbagi Profesi" untuk inspirasi karir murid',
      'Relawan kepanitiaan pentas seni, pameran karya, dan bazar sekolah',
      'Pendampingan kegiatan field trip dan kunjungan dunia industri'
    ]
  },
  {
    id: 3,
    title: '3. Membantu Pembelajaran di Rumah',
    desc: 'Melibatkan keluarga dalam pendampingan belajar tanpa membebani, menyelaraskan rutinitas positif di rumah.',
    activities: [
      'Pemanfaatan buku komunikasi & agenda refleksi mingguan',
      'Pengkondisian ruang belajar yang minim distraksi gawai di rumah',
      'Dialog hangat harian mengenai pengalaman bermakna murid di kelas'
    ]
  },
  {
    id: 4,
    title: '4. Membangun Komunikasi Efektif',
    desc: 'Komunikasi dua arah secara rutin dan ramah, tidak hanya menghubungi ketika murid sedang bermasalah.',
    activities: [
      'Konsultasi terjadwal perkembangan bakat & minat siswa',
      'Kanal komunikasi digital (WhatsApp Grup / Portal Sekolah) yang edukatif',
      'Pendekatan humanistik, mendengarkan aktif tanpa menjustifikasi keluarga'
    ]
  },
  {
    id: 5,
    title: '5. Terlibat Pengambilan Keputusan',
    desc: 'Menyertakan perwakilan orang tua dalam penyusunan Kurikulum Operasional Satuan Pendidikan (KOSP) & kebijakan sekolah.',
    activities: [
      'Forum Komite Sekolah dalam perumusan tata tertib dan visi sekolah',
      'Diskusi kelompok terpumpun (FGD) pencegahan tindak kekerasan',
      'Evaluasi bersama iklim keamanan dan kenyamanan lingkungan belajar'
    ]
  },
  {
    id: 6,
    title: '6. Berkolaborasi dengan Masyarakat & Mitra',
    desc: 'Menghubungkan sumber daya komunitas bisnis, perguruan tinggi, puskesmas, dan tokoh masyarakat untuk kemajuan siswa.',
    activities: [
      'Kerjasama Puskesmas setempat untuk skrining kesehatan fisik & jiwa',
      'Kemitraan dunia usaha/industri untuk magang & PKL murid',
      'Kolaborasi tokoh adat dan pemuka agama dalam penguatan karakter toleransi'
    ]
  }
];

/**
 * Prosedur & SOP Penanganan Kekerasan Satuan Pendidikan (Permendikbudristek No. 46 Tahun 2023 - PPKSP)
 * Memperbarui regulasi Permendikbud No. 82/2015 & Permendikbudristek No. 30/2021
 */
export const PPKSP_2023_SOP = {
  regulasi: 'Permendikbudristek No. 46 Tahun 2023 tentang Pencegahan dan Penanganan Kekerasan di Lingkungan Satuan Pendidikan (PPKSP)',
  portalPpkspUrl: 'https://merdekadarikekerasan.kemdikbud.go.id/ppksp',
  portalLaporUrl: 'https://kemdikbud.lapor.go.id',
  portalPuspekaUrl: 'https://cerdasberkarakter.kemdikbud.go.id',
  hotlineSapa129: '129 / WhatsApp: 08111-129-129',
  enamBentukKekerasan: [
    {
      id: 1,
      nama: 'Kekerasan Fisik',
      definisi: 'Perbuatan yang mengakibatkan luka, rasa sakit, cidera fisik, seperti pemukulan, penganiayaan, tawuran, atau perkelahian massal.'
    },
    {
      id: 2,
      nama: 'Kekerasan Psikis',
      definisi: 'Perbuatan yang merendahkan, menghina, menakut-nakuti, meneror, mengucilkan, atau menimbulkan trauma psikologis emosional.'
    },
    {
      id: 3,
      nama: 'Perundungan (Bullying)',
      definisi: 'Kekerasan fisik/psikis berulang yang dilakukan perorangan atau kelompok karena ketimpangan kuasa, termasuk cyberbullying di media sosial.'
    },
    {
      id: 4,
      nama: 'Kekerasan Seksual',
      definisi: 'Setiap perbuatan merendahkan, menghina, melecehkan, atau menyerang tubuh/fungsi reproduksi secara fisik, verbal, maupun media elektronik.'
    },
    {
      id: 5,
      nama: 'Diskriminasi dan Intoleransi',
      definisi: 'Pembedaan, pengecualian, atau pembatasan atas dasar suku, agama, ras, gender, kemampuan fisik/disabilitas, status sosial yang merugikan hak anak.'
    },
    {
      id: 6,
      nama: 'Kebijakan yang Mengandung Kekerasan',
      definisi: 'Aturan, instruksi, atau tata tertib satuan pendidikan yang membenarkan hukuman fisik, denda tidak wajar, atau perlakuan merendahkan martabat.'
    }
  ],
  alurPenangananTppk: [
    {
      step: 1,
      title: 'Penerimaan Laporan & Perlindungan Awal',
      desc: 'Menerima laporan melalui kanal pengaduan rahasia sekolah/TPPK, memberikan rasa aman, pertolongan medis/psikis segera bagi korban tanpa menghakimi.'
    },
    {
      step: 2,
      title: 'Pemeriksaan & Klarifikasi Bukti',
      desc: 'Pengumpulan fakta objektif melalui wawancara terpisah dengan korban, saksi, dan terlapor dalam suasana ramah anak dengan menjamin kerahasiaan identitas.'
    },
    {
      step: 3,
      title: 'Penyusunan Kesimpulan & Rekomendasi',
      desc: 'TPPK merumuskan kategori kasus, tingkat dampak, dan rekomendasi sanksi edukatif serta rencana pemulihan menyeluruh.'
    },
    {
      step: 4,
      title: 'Tindakan Pemulihan & Sanksi Edukatif',
      desc: 'Pendampingan psikologis pemulihan korban, pemenuhan hak belajar anak, dan pemberian sanksi administratif yang mendidik bagi pelaku anak sesuai SPPA.'
    },
    {
      step: 5,
      title: 'Pemantauan & Evaluasi Keberlanjutan',
      desc: 'Monitoring berkala kondisi fisik/psikologis anak, pencegahan viktimisasi sekunder, dan evaluasi iklim keamanan satuan pendidikan.'
    }
  ]
};

// Aliaskan untuk backward compatibility
export const TIGA_DOSA_BESAR_SOP = PPKSP_2023_SOP;

/**
 * Konsep Segitiga Restitusi (Restitution Triangle - Diana Gossen & William Glasser)
 * Pilar Utama Disiplin Positif dalam Panduan BK Kurikulum Merdeka
 */
export const SEGITIGA_RESTITUSI_STEPS = [
  {
    step: 1,
    title: 'Menstabilkan Identitas (Stabilize the Identity)',
    tujuan: 'Mengubah paradigma anak dari rasa gagal & bersalah menjadi individu yang siap belajar dari kesalahan.',
    contohKalimat: [
      'Setiap orang pasti pernah melakukan kesalahan, itu hal manusiawi.',
      'Bapak/Ibu di sini bukan untuk mencari siapa yang salah atau benar.',
      'Kita di sini bersama-sama mencari solusi bagaimana memperbaiki situasi ini.',
      'Kamu bukan satu-satunya yang pernah mengalami hal ini.'
    ]
  },
  {
    step: 2,
    title: 'Validasi Tindakan yang Salah (Validate the Misbehavior)',
    tujuan: 'Membantu anak memahami kebutuhan dasar apa yang ingin ia penuhi saat berbuat kesalahan.',
    contohKalimat: [
      'Kamu pasti punya alasan tersendiri mengapa melakukan tindakan itu.',
      'Pasti ada hal penting yang sedang kamu perjuangkan saat itu, ya?',
      'Bapak/Ibu paham kamu merasa kesal/kecewa saat itu, tapi adakah cara lain yang lebih aman?',
      'Apakah cara tersebut benar-benar membantumu mendapatkan apa yang kamu inginkan?'
    ]
  },
  {
    step: 3,
    title: 'Menanyakan Keyakinan Kelas/Sekolah (Ask the Beliefs/Values)',
    tujuan: 'Menghubungkan anak dengan nilai-nilai kebajikan universal yang telah disepakati bersama.',
    contohKalimat: [
      'Nilai kebajikan dan keyakinan kelas apa yang telah kita sepakati bersama?',
      'Kamu ingin menjadi sosok orang seperti apa nantinya?',
      'Bagaimana perasaanmu sekarang, dan apa rencana konkretmu untuk memperbaiki keadaan ini?',
      'Apa yang bisa kamu lakukan untuk bertanggung jawab atas apa yang terjadi?'
    ]
  }
];

/**
 * 5 Posisi Kontrol Guru (Dr. William Glasser - Control Theory)
 */
export const LIMA_POSISI_KONTROL = [
  {
    posisi: 'Penghukum',
    ciri: 'Menggunakan suara tinggi, menyindir, menunjuk-nunjuk, hukuman fisik/kata-kata keras. Hasil: dendam, pemberontakan.',
    kategori: 'Kurang Dianjurkan'
  },
  {
    posisi: 'Pembuat Merasa Bersalah',
    ciri: 'Menggunakan suara memelas, menyalahkan emosional anak ("Ibu kecewa sekali padamu"). Hasil: rendah diri, cemas.',
    kategori: 'Kurang Dianjurkan'
  },
  {
    posisi: 'Teman',
    ciri: 'Santai, humoris, memaklumi. Hasil: ketergantungan pada sosok guru tertentu.',
    kategori: 'Transisi'
  },
  {
    posisi: 'Pemantau (Monitor)',
    ciri: 'Berdasarkan aturan dan data kuantitatif sanksi/poin secara formal. Hasil: patuh karena hitungan konsekuensi.',
    kategori: 'Baik'
  },
  {
    posisi: 'Manajer (Posisi Ideal Guru BK)',
    ciri: 'Membimbing murid menganalisis kebutuhan diri, mengajak menyusun solusi mandiri & restitusi yang bertanggung jawab. Hasil: kemandirian karakter utuh.',
    kategori: 'Sangat Direkomendasikan (Kurikulum Merdeka)'
  }
];

/**
 * Lampiran 1: Contoh Alur Melakukan Refleksi Ketika Peserta Didik Melanggar Aturan
 * Pemetaan Sebab Akibat & Konseling Humanistik (BSKAP 2022 Hal 35)
 */
export const BSKAP_LAMPIRAN_1_SEBAB_AKIBAT = {
  judul: 'Alur Refleksi Pelanggaran Aturan & Pemetaan Sebab-Akibat',
  tahapanAlur: [
    { step: 1, text: 'Peserta didik diajak diskusi tentang peristiwa yang terjadi / kegiatan yang dilakukan.' },
    { step: 2, text: 'Peserta didik diajak mengidentifikasi hal-hal yang menjadi akibat dari perbuatannya.' },
    { step: 3, text: 'Peserta didik dipandu untuk menyebutkan akibat terhadap diri sendiri dan orang lain.' },
    { step: 4, text: 'Guru BK membimbing peserta didik untuk menemukan solusi dan perbaikan mandiri.' },
    { step: 5, text: 'Membuat perjanjian tertulis untuk menerapkan solusi dan konsekuensi logis yang disepakati.' }
  ],
  dialogHumanistikLangkah: [
    '1. Mengidentifikasi masalah yang dihadapi secara objektif;',
    '2. Fokus pada masalah perilaku yang dihadapi, bukan mencela pribadi anak;',
    '3. Menemukan alternatif solusi dari sudut pandang anak sendiri;',
    '4. Membimbing anak mendengar dan menerima masukan orang lain / pihak terdampak;',
    '5. Mengevaluasi konsekuensi dari setiap solusi yang akan diambil;',
    '6. Menerapkan solusi tindakan nyata secara bertanggung jawab;',
    '7. Mengevaluasi hasil komitmen secara berkala bersama Guru BK / wali kelas.'
  ],
  pertanyaanKunci: [
    { label: 'Peristiwa', pertanyaan: 'Apa peristiwa / tindakan yang sesungguhnya terjadi?' },
    { label: 'Apa yang sudah kamu lakukan', pertanyaan: 'Apa peran dan tindakan konkrit yang telah kamu ambil?' },
    { label: 'Bagaimana perasaanmu', pertanyaan: 'Bagaimana perasaanmu saat dan sesudah kejadian tersebut?' },
    { label: 'Sebab', pertanyaan: 'Apa alasan mendasar atau kebutuhan yang ingin kamu penuhi saat itu?' },
    { label: 'Akibat', pertanyaan: 'Apa dampak yang dirasakan oleh teman, guru, atau lingkungan sekitarmu?' },
    { label: 'Solusi / Rencana Perbaikan', pertanyaan: 'Apa yang harus kamu lakukan untuk memperbaiki situasi ini?' }
  ]
};

/**
 * Lampiran 2: Lembar Rencana Aksi (BSKAP 2022 Hal 36-37)
 */
export const BSKAP_LAMPIRAN_2_RENCANA_AKSI = {
  judul: 'Lembar Rencana Aksi Peserta Didik',
  instruksi: [
    '1. Identifikasi situasi / masalah yang dihadapi saat ini.',
    '2. Tuliskan situasi yang kamu inginkan berbeda atau lebih baik dari situasi saat ini.',
    '3. Pikirkan 3 hal yang bisa kamu lakukan secara berbeda agar situasi berubah.',
    '4. Putuskan langkah konkrit rencana aksi dan detilkan komitmen pelaksanaannya.'
  ],
  pertanyaanAksi: [
    'Mau melakukan apa?',
    'Kapan dilakukannya?',
    'Butuh dukungan apa dan dari siapa?',
    'Apa konsekuensi logis jika rencana ini tidak dilaksanakan?'
  ]
};

/**
 * Lampiran 3: 7 Tahap Konseling Berdasarkan Glasser (1965) Reality Therapy (BSKAP 2022 Hal 53)
 */
export const BSKAP_LAMPIRAN_3_GLASSER = [
  {
    tahap: 1,
    nama: 'Menjalin Hubungan Baik',
    penjelasan: 'Menciptakan ruang aman, rapport hangat, dan penerimaan tanpa menghakimi.'
  },
  {
    tahap: 2,
    nama: 'Fokus pada Perilaku Saat Ini',
    penjelasan: 'Mengajukan pertanyaan faktual: "Apa yang sedang terjadi?" bukan menyalahkan motif masa lalu.'
  },
  {
    tahap: 3,
    nama: 'Evaluasi Perilaku Diri Sendiri',
    penjelasan: 'Membantu murid menilai apakah perilakunya membantu mendekatkan pada apa yang ia inginkan: "Apakah tindakan ini membantumu bersikap lebih baik?"'
  },
  {
    tahap: 4,
    nama: 'Mengembangkan Strategi Mencari Solusi',
    penjelasan: 'Mengajukan pertanyaan: "Apa cara berbeda yang bisa kamu lakukan untuk memperbaiki? Dukungan apa yang diperlukan?"'
  },
  {
    tahap: 5,
    nama: 'Membuat Komitmen Atas Solusi',
    penjelasan: 'Komitmen murni tanpa paksaan: "Kapan kamu akan memulai langkah-langkah itu? Sudahkah kamu memikirkan rencanamu secara detail?"'
  },
  {
    tahap: 6,
    nama: 'Menyepakati Konsekuensi Bersama',
    penjelasan: 'Mengajak siswa menyepakati konsekuensi logis jika rencana tidak dijalankan secara bertanggung jawab.'
  },
  {
    tahap: 7,
    nama: 'Kesabaran & Pemantauan Berkala',
    penjelasan: 'Mendampingi remaja secara sabar, mengajak mengobrol santai, dan memantau kemajuan secara konsisten.'
  }
];

/**
 * Lampiran 6: Kriteria Triase Status Situasi Peserta Didik (BSKAP 2022 Hal 62-63)
 */
export const BSKAP_LAMPIRAN_6_TRIASE = {
  hijau: {
    kode: 'Hijau',
    label: 'Insidental / Perkembangan Baik',
    warnaBadge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    faktorPesertaDidik: 'Perkembangan umum baik. Hanya 1 atau sedikit aspek terhambat non-mendasar. Cepat & mudah ditangani.',
    faktorKelas: 'Dinamika kelas tidak banyak terpengaruh.',
    penangananGuru: 'Situasi ditangani melalui program kelas dan obrolan ringan individual.',
    cakupanPendampingan: 'Wali kelas / guru mata pelajaran berkonsultasi santai dengan Guru BK.'
  },
  kuning: {
    kode: 'Kuning',
    label: 'Sering Muncul / Mulai Menghambat',
    warnaBadge: 'bg-amber-100 text-amber-900 border-amber-300',
    faktorPesertaDidik: 'Aspek yang terhambat merupakan aspek mendasar dan mulai mempengaruhi aspek lainnya. Perkembangan belum konsisten.',
    faktorKelas: 'Perlu pengkondisian dan kesepakatan khusus terkait situasi peserta didik di kelas.',
    penangananGuru: 'Perlu penanganan dan pendampingan khusus individu secara berkala.',
    cakupanPendampingan: 'Pegangan khusus dan intervensi terstruktur oleh Guru BK.'
  },
  merah: {
    kode: 'Merah',
    label: 'Konsisten Muncul / Situasi Kritis',
    warnaBadge: 'bg-rose-100 text-rose-900 border-rose-300',
    faktorPesertaDidik: 'Aspek yang terhambat mendasar dan sangat memengaruhi aspek lain. Perkembangan sangat lambat atau bahkan mundur.',
    faktorKelas: 'Sangat mengganggu atau konsisten memengaruhi dinamika kondusif kelas.',
    penangananGuru: 'Perlu perhatian intensif yang membutuhkan penyesuaian porsi pendampingan kelas.',
    cakupanPendampingan: 'Ajuan kerja sama rujukan dengan pihak ahli eksternal (psikolog, psikiater, terapis, Puskesmas, atau TPPK).'
  }
};

/**
 * Lampiran 7: Struktur Bagan Analisis Situasi Kolaboratif (BSKAP 2022 Hal 64-66)
 */
export interface BaganAnalisisSituasiForm {
  studentName: string;
  studentClass: string;
  date: string;
  waliKelasName: string;
  counselorName: string;
  penyebabInternalFisik: string;
  penyebabInternalKarakter: string;
  penyebabInternalKognitif: string;
  penyebabEksternalRumah: string;
  penyebabEksternalSekolah: string;
  perilakuKekuatanPlus: string;
  perilakuMasalahMinus: string;
  dampakPerilaku: string;
  dugaanSementara: string;
  harapanJangkaPendek: string;
  harapanJangkaPanjang: string;
  strategiDiSekolah: string;
  strategiDiRumah: string;
  strategiKolaborasiSekolahRumah: string;
}

/**
 * 4 Komponen Besar Layanan BK & 6 Peran Guru BK (BSKAP 2022 Bab 2 Hal 6-17)
 */
export const BSKAP_4_KOMPONEN_LAYANAN = [
  {
    id: 'dasar',
    nama: '1. Layanan Dasar',
    sifat: 'Preventif & Developmental (Untuk Seluruh Peserta Didik)',
    alokasi: 'Klasikal minimal 1 JP / Bimbingan Kelompok 4-8 Siswa',
    deskripsi: 'Membantu semua murid mengembangkan pemahaman dan keterampilan tugas perkembangannya secara menyeluruh, membangun iklim kelas sehat, dan mencegah kekerasan/perundungan.',
    fokusMateri: ['Pengenalan diri & emosi', 'Komunikasi asertif', 'Pencegahan perundungan, kekerasan seksual & intoleransi', 'Profil Pelajar Pancasila']
  },
  {
    id: 'peminatan',
    nama: '2. Peminatan & Perencanaan Individual',
    sifat: 'Eksploratif & Perencanaan Masa Depan',
    alokasi: 'Klasikal, Konseling Kelompok, Konseling Individu & Konsultasi Ortu',
    deskripsi: 'Mengakomodasi kebutuhan murid dalam mengenali minat, bakat, kelebihan, aspirasi karir sejak dini, eksplorasi ekstrakurikuler, dan persiapan studi lanjut (SMA/SMK).',
    fokusMateri: ['Asesmen RIASEC', 'Pengenalan rumpun profesi & dunia kerja', 'Pemilihan mapel pilihan / konsentrasi keahlian SMK', 'Rencana aksi pengembangan diri']
  },
  {
    id: 'responsif',
    nama: '3. Layanan Responsif',
    sifat: 'Kuratif & Darurat (Penanganan Segera)',
    alokasi: 'Konseling Individual, Konseling Krisis, Mediasi Konflik & Referal Ahli',
    deskripsi: 'Bantuan segera bagi peserta didik yang menghadapi masalah mendesak (akademik, sosial, pribadi, emosi, atau konflik) agar mampu menyelesaikan masalah secara bertanggung jawab.',
    fokusMateri: ['Segitiga Restitusi & konseling humanistik', 'Mediasi perdamaian antar murid berkonflik', 'Penanganan trauma / kekerasan', 'Rujukan ke psikolog/dokter/TPPK']
  },
  {
    id: 'dukungan_sistem',
    nama: '4. Layanan Dukungan Sistem',
    sifat: 'Manajemen, Tata Kerja & Peningkatan Kapasitas',
    alokasi: 'Berkelanjutan (Manajemen Data, Kolaborasi Mitra & TIK)',
    deskripsi: 'Pengelolaan sistem BK yang sehat, administrasi data konseling, koordinasi dengan pimpinan sekolah, wali kelas, guru mapel, orang tua, dan kemitraan masyarakat.',
    fokusMateri: ['Pengelolaan database bimbingan digital', 'Kolaborasi Tri Sentra (Sekolah-Keluarga-Mitra)', 'Program parenting & UKS', 'Pengembangan profesionalitas konselor']
  }
];

export const BSKAP_6_PERAN_GURU_BK = [
  { peran: '1. Pengelola Program', tugas: 'Merencanakan, melaksanakan, dan mengevaluasi program BK secara kolaboratif bersama wali kelas & guru mapel.' },
  { peran: '2. Pembimbing', tugas: 'Membimbing murid mengenal diri, memfasilitasi pertumbuhan kepribadian, potensi, minat, dan penyesuaian diri.' },
  { peran: '3. Penilai (Assessor)', tugas: 'Menggunakan instrumen penilaian formal & informal (RIASEC, sosiometri, angket) serta menafsirkan data asesmen.' },
  { peran: '4. Konselor', tugas: 'Membuka akses konseling perorangan dan kelompok untuk penyembuhan, pemecahan masalah, dan perbaikan karakter.' },
  { peran: '5. Konsultasi', tugas: 'Memberikan informasi perkembangan potensi dan solusi anak kepada siswa, wali kelas, kepala sekolah, dan orang tua.' },
  { peran: '6. Koordinasi', tugas: 'Bekerja sama dengan bidang akademik, keluarga, dan mitra luar (psikolog, Puskesmas, dunia kerja, kepolisian/TPPK).' }
];
