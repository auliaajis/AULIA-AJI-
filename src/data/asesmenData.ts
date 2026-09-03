export interface AspekPerkembangan {
  id: string;
  code: string;
  name: string;
  description: string;
  capaianFaseD: {
    pengenalan: string;
    akomodasi: string;
    tindakan: string;
  };
  capaianFaseE: {
    pengenalan: string;
    akomodasi: string;
    tindakan: string;
  };
  capaianFaseF: {
    pengenalan: string;
    akomodasi: string;
    tindakan: string;
  };
}

export interface AkpdQuestion {
  id: string;
  code: string;
  bidang: 'Pribadi' | 'Sosial' | 'Belajar' | 'Karir';
  question: string;
  rekomendasiTopik: string;
}

export interface MateriBimbingan {
  ringkasanMateri: string;
  poinMateri: string[];
  studiKasus: string;
  tipsPraktis: string[];
}

export interface Lkpd {
  judulLkpd: string;
  instruksi: string;
  pertanyaanRefleksi: string[];
  lembarAksiNyata: string;
  rubrikPenilaian: string;
}

export interface SlideItem {
  slideNo: number;
  title: string;
  bulletPoints: string[];
  speakerNotes: string;
}

export interface PptOutline {
  slideJudul: string;
  slides: SlideItem[];
  notebookLmPrompt: string;
}

export interface ModulAjarRpl {
  id: string;
  title: string;
  fase: 'Fase D (SMP)' | 'Fase E (SMA 10)' | 'Fase F (SMA 11-12)';
  bidang: 'Pribadi' | 'Sosial' | 'Belajar' | 'Karir';
  aspekCode: string;
  aspekName: string;
  alokasiWaktu: string;
  profilPancasila: string[];
  metode: string;
  media: string[];
  tujuanPengenalan: string;
  tujuanAkomodasi: string;
  tujuanTindakan: string;
  langkahPendahuluan: string[];
  langkahInti: string[];
  langkahPenutup: string[];
  evaluasiProses: string[];
  evaluasiHasil: string[];
  // Lampiran Lengkap untuk Guru BK & Siswa
  materiBimbingan?: MateriBimbingan;
  lkpd?: Lkpd;
  pptOutline?: PptOutline;
}

export const ASPEK_PERKEMBANGAN_LIST: AspekPerkembangan[] = [
  {
    id: 'asp-1',
    code: 'SKKPD-1',
    name: 'Landasan Perilaku Etis',
    description: 'Kemampuan memahami dan mengaplikasikan nilai-nilai moral, etika, dan norma agama serta kemasyarakatan dalam kehidupan sehari-hari.',
    capaianFaseD: {
      pengenalan: 'Mengenal alasan perlunya menaati ajaran agama dan norma masyarakat.',
      akomodasi: 'Meyakini pentingnya menaati ajaran agama dan norma masyarakat.',
      tindakan: 'Bertindak atas dasar pertimbangan ajaran agama dan norma masyarakat.',
    },
    capaianFaseE: {
      pengenalan: 'Mengenal keragaman sumber nilai dan norma yang berlaku di masyarakat.',
      akomodasi: 'Menghargai keragaman sumber nilai dan norma sebagai rujukan berperilaku.',
      tindakan: 'Berperilaku atas dasar pertimbangan setingkat nilai-nilai moral dan etika.',
    },
    capaianFaseF: {
      pengenalan: 'Menganalisis sistem nilai dan norma yang berlaku di masyarakat global.',
      akomodasi: 'Meyakini pentingnya menjunjung tinggi norma dan moral universal.',
      tindakan: 'Mengembangkan komitmen pribadi untuk berperilaku etis secara konsisten.',
    },
  },
  {
    id: 'asp-2',
    code: 'SKKPD-2',
    name: 'Landasan Perilaku Keagamaan',
    description: 'Penghayatan dan pengalaman nilai-nilai ibadah serta toleransi antar umat beragama.',
    capaianFaseD: {
      pengenalan: 'Mengenal unsur-unsur tingkah laku yang sesuai dengan ajaran agama yang dianut.',
      akomodasi: 'Menghargai berbagai bentuk ibadah yang dilakukan oleh pemeluk agama lain.',
      tindakan: 'Melakukan berbagai kegiatan ibadah dengan kemauan sendiri.',
    },
    capaianFaseE: {
      pengenalan: 'Mengenal pentingnya integritas antara nilai keagamaan dan ilmu pengetahuan.',
      akomodasi: 'Meyakini nilai-nilai keagamaan sebagai pedoman dalam pengembangan IPTEK.',
      tindakan: 'Menjalankan kewajiban agama secara konsisten dalam kehidupan sehari-hari.',
    },
    capaianFaseF: {
      pengenalan: 'Menganalisis fenomena keagamaan dan moderasi beragama dalam masyarakat.',
      akomodasi: 'Menunjukkan komitmen toleransi dan kedamaian antar umat beragama.',
      tindakan: 'Menjadi teladan dalam pengamalan ibadah dan moderasi beragama.',
    },
  },
  {
    id: 'asp-3',
    code: 'SKKPD-3',
    name: 'Kematangan Emosi',
    description: 'Kemampuan mengenali, mengekspresikan, dan mengelola emosi secara sehat serta membina resiliensi emosional.',
    capaianFaseD: {
      pengenalan: 'Mengenal cara-cara mengekspresikan perasaan secara wajar.',
      akomodasi: 'Memahami keragaman ekspresi perasaan diri dan orang lain.',
      tindakan: 'Mengekspresikan perasaan atas dasar pertimbangan kontekstual.',
    },
    capaianFaseE: {
      pengenalan: 'Mengenal ungkapan emosi diri dan orang lain yang bersifat konstruktif.',
      akomodasi: 'Memahami penyebab dan dampak emosi bagi diri dan lingkungan.',
      tindakan: 'Mengendalikan emosi atas dasar pertimbangan hak-hak orang lain.',
    },
    capaianFaseF: {
      pengenalan: 'Menganalisis faktor-faktor yang mempengaruhi dinamika emosi remaja akhir.',
      akomodasi: 'Menerima keadaan emosi diri dan orang lain secara dewasa.',
      tindakan: 'Mampu mengelola stres, regulasi emosi, dan bangkit dari kegagalan (resiliensi).',
    },
  },
  {
    id: 'asp-4',
    code: 'SKKPD-4',
    name: 'Kematangan Intelektual',
    description: 'Pengembangan pola pikir kritis, kreatif, pemecahan masalah (problem solving), dan pengambilan keputusan.',
    capaianFaseD: {
      pengenalan: 'Memahami cara-cara pengambilan keputusan dan pemecahan masalah.',
      akomodasi: 'Menerima alternatif pemecahan masalah yang disarankan orang lain.',
      tindakan: 'Mengambil keputusan berdasarkan pertimbangan logis dan akibatnya.',
    },
    capaianFaseE: {
      pengenalan: 'Mengenal kemampuan berpikir kritis dan pengambilan keputusan alternatif.',
      akomodasi: 'Menyadari pentingnya mempertimbangkan resiko dalam mengambil keputusan.',
      tindakan: 'Mengambil keputusan rasional secara mandiri serta bertanggung jawab.',
    },
    capaianFaseF: {
      pengenalan: 'Menganalisis pemikiran tingkat tinggi (HOTS) dalam penyelesaian masalah komplek.',
      akomodasi: 'Menghargai perbedaan sudut pandang intelektual dalam diskusi.',
      tindakan: 'Mengembangkan inovasi dan solusi kreatif untuk tantangan pribadi dan sosial.',
    },
  },
  {
    id: 'asp-5',
    code: 'SKKPD-5',
    name: 'Kesadaran Tanggung Jawab Sosial',
    description: 'Kesadaran akan hak dan kewajiban sebagai anggota kelompok, masyarakat, dan warga negara.',
    capaianFaseD: {
      pengenalan: 'Mengenal hak dan kewajiban diri dalam lingkungan keluarga dan sekolah.',
      akomodasi: 'Menghargai keragaman hak dan kewajiban orang lain.',
      tindakan: 'Berpartisipasi aktif dalam kegiatan sosial di lingkungan masyarakat.',
    },
    capaianFaseE: {
      pengenalan: 'Mengenal nilai-nilai persatuan dan kesadaran hak-kewajiban sebagai warga negara.',
      akomodasi: 'Menghargai perbedaan pendapat dan latar belakang sosial budaya.',
      tindakan: 'Berinteraksi dengan orang lain atas dasar prinsip kesetaraan dan kepedulian.',
    },
    capaianFaseF: {
      pengenalan: 'Menganalisis isu-isu sosial dan lingkungan hidup tingkat lokal dan global.',
      akomodasi: 'Menunjukkan komitmen empati dan partisipasi aktif kemanusiaan.',
      tindakan: 'Melakukan aksi nyata empati sosial dan pengabdian masyarakat.',
    },
  },
  {
    id: 'asp-6',
    code: 'SKKPD-6',
    name: 'Kesadaran Gender',
    description: 'Pemahaman akan kesetaraan peran gender, saling menghargai tanpa stereotip gender.',
    capaianFaseD: {
      pengenalan: 'Mengenal peran laki-laki dan perempuan sesuai dengan norma sosial.',
      akomodasi: 'Menghargai perbedaan fungsi dan peran laki-laki dan perempuan.',
      tindakan: 'Berinteraksi secara wajar tanpa membedakan jenis kelamin.',
    },
    capaianFaseE: {
      pengenalan: 'Mengenal kesetaraan gender dan keragaman peran dalam kehidupan modern.',
      akomodasi: 'Menghargai hak-hak laki-laki dan perempuan dalam berprestasi.',
      tindakan: 'Peka terhadap isu diskriminasi gender dan bersikap adil.',
    },
    capaianFaseF: {
      pengenalan: 'Menganalisis peran gender dalam dinamika dunia kerja dan keluarga.',
      akomodasi: 'Menghormati kemitraan sepadan antara laki-laki dan perempuan.',
      tindakan: 'Bekerja sama lintas gender secara profesional dan saling mendukung.',
    },
  },
  {
    id: 'asp-7',
    code: 'SKKPD-7',
    name: 'Pengembangan Diri',
    description: 'Pemahaman akan keunikan potensi, bakat, minat, kelebihan, serta kelemahan diri.',
    capaianFaseD: {
      pengenalan: 'Mengenal keunikan diri dalam aspek fisik, bakat, minat, dan kemampuan.',
      akomodasi: 'Menerima keadaan diri sebagaimana adanya secara positif.',
      tindakan: 'Mengembangkan bakat dan minat secara terencana dan konsisten.',
    },
    capaianFaseE: {
      pengenalan: 'Mengenal potensi diri dan peluang pengembangannya secara optimal.',
      akomodasi: 'Menghargai proses pertumbuhan dan keunikan pribadi.',
      tindakan: 'Melakukan aktivitas pengembangan diri berbasis kekuatan dan bakat.',
    },
    capaianFaseF: {
      pengenalan: 'Menganalisis kekuatan dan kelemahan diri untuk rencana masa depan.',
      akomodasi: 'Memiliki rasa percaya diri yang tinggi dan konsep diri positif.',
      tindakan: 'Mengaktualisasikan potensi diri melalui prestasi dan karya nyata.',
    },
  },
  {
    id: 'asp-8',
    code: 'SKKPD-8',
    name: 'Perilaku Kewirausahaan (Eksplorasi Karir)',
    description: 'Sikap kreatif, inovatif, pantang menyerah, kemandirian finansial, dan pemikiran kewirausahaan.',
    capaianFaseD: {
      pengenalan: 'Mengenal nilai-nilai hemat, kerja keras, dan kemandirian.',
      akomodasi: 'Menghargai hasil karya dan usaha diri sendiri serta orang lain.',
      tindakan: 'Melakukan kegiatan produktif berbasis kreativitas sederhana.',
    },
    capaianFaseE: {
      pengenalan: 'Mengenal prinsip-prinsip kewirausahaan dan analisis peluang bisnis.',
      akomodasi: 'Menyukai kegiatan yang menantang dan berorientasi pada karya.',
      tindakan: 'Menciptakan produk/layanan kreatif bernilai ekonomi.',
    },
    capaianFaseF: {
      pengenalan: 'Menganalisis tren pasar, teknologi, dan strategi wirausaha digital.',
      akomodasi: 'Memiliki daya tahan dan keuletan dalam menghadapi resiko usaha.',
      tindakan: 'Merancang proyek bisnis mandiri atau simulasi wirausaha nyata.',
    },
  },
  {
    id: 'asp-9',
    code: 'SKKPD-9',
    name: 'Kematangan Karir',
    description: 'Pemahaman tentang dunia kerja, persiapan pendidikan lanjutan, dan pemetaan cita-cita.',
    capaianFaseD: {
      pengenalan: 'Mengenal berbagai ragam pekerjaan dan syarat-syarat pendidikannya.',
      akomodasi: 'Menghargai semua jenis pekerjaan yang halal dan bermanfaat.',
      tindakan: 'Identifikasi awal cita-cita dan merencanakan sekolah lanjutan (SMA/SMK).',
    },
    capaianFaseE: {
      pengenalan: 'Mengenal profil jurusan perguruan tinggi, kedinasan, dan kebutuhan dunia kerja.',
      akomodasi: 'Memahami kesesuaian antara bakat, minat, dan pilihan karir.',
      tindakan: 'Memilih peminatan mata pelajaran dan orientasi karir yang tepat.',
    },
    capaianFaseF: {
      pengenalan: 'Menganalisis persyaratan masuk PTN/PTS, beasiswa, dan lapangan kerja.',
      akomodasi: 'Meyakini pilihan jalur karir/studi lanjut pasca kelulusan.',
      tindakan: 'Menyusun portofolio dan mendaftar ke perguruan tinggi/dunia kerja.',
    },
  },
  {
    id: 'asp-10',
    code: 'SKKPD-10',
    name: 'Kesiapan Peran Pernikahan & Berkeluarga',
    description: 'Pemahaman tentang kesehatan reproduksi, etika pergaulan, dan tanggung jawab masa depan.',
    capaianFaseD: {
      pengenalan: 'Mengenal perubahan fisik dan psikologis masa pubertas.',
      akomodasi: 'Menerima norma pergaulan lawan jenis secara sehat dan santun.',
      tindakan: 'Menjaga kebersihan diri dan kesehatan reproduksi remaja.',
    },
    capaianFaseE: {
      pengenalan: 'Mengenal bahaya pernikahan dini, pergaulan bebas, dan penyakit menular.',
      akomodasi: 'Memahami pentingnya persiapan kesiapan fisik dan mental berkeluarga.',
      tindakan: 'Membatasi diri dari gaya hidup berisiko dan fokus pada masa depan.',
    },
    capaianFaseF: {
      pengenalan: 'Menganalisis prinsip-prinsip kesiapan psikologis, finansial, dan sosial pernikahan.',
      akomodasi: 'Menghargai nilai-nilai ketahanan keluarga dan pengasuhan anak.',
      tindakan: 'Menjalankan gaya hidup sehat dan dewasa secara emosional.',
    },
  },
];

export const SAMPLE_AKPD_QUESTIONS: AkpdQuestion[] = [
  // Pribadi
  { id: 'akpd-1', code: 'A1', bidang: 'Pribadi', question: 'Saya merasa belum percaya diri saat berbicara atau tampil di depan umum.', rekomendasiTopik: 'Membangun Kepercayaan Diri dan Publisitas Diri' },
  { id: 'akpd-2', code: 'A2', bidang: 'Pribadi', question: 'Saya sering kesulitan mengendalikan emosi ketika sedang marah atau kesal.', rekomendasiTopik: 'Manajemen Emosi dan Self-Control Remaja' },
  { id: 'akpd-3', code: 'A3', bidang: 'Pribadi', question: 'Saya merasa sering menunda-nunda pekerjaan rumah dan tidak disiplin waktu.', rekomendasiTopik: 'Manajemen Waktu dan Mengatasi Prokrastinasi' },
  { id: 'akpd-4', code: 'A4', bidang: 'Pribadi', question: 'Saya merasa cemas berlebihan ketika menghadapi ketidakpastian atau ujian.', rekomendasiTopik: 'Pengelolaan Kecemasan & Teknik Relaksasi' },
  
  // Sosial
  { id: 'akpd-5', code: 'A5', bidang: 'Sosial', question: 'Saya merasa sulit mendapatkan teman akrab atau sering merasa terisolir.', rekomendasiTopik: 'Keterampilan Komunikasi Interpersonal & Pertemanan Sehat' },
  { id: 'akpd-6', code: 'A6', bidang: 'Sosial', question: 'Saya atau teman saya pernah mengalami perundungan (bullying/cyberbullying) di sekolah.', rekomendasiTopik: 'Stop Bullying & Budaya Saling Menghargai' },
  { id: 'akpd-7', code: 'A7', bidang: 'Sosial', question: 'Saya ragu bagaimana cara menolak ajakan teman yang berdampak negatif (peer pressure).', rekomendasiTopik: 'Sikap Asertif & Menolak Ajakan Negatif Teman Sebaya' },
  { id: 'akpd-8', code: 'A8', bidang: 'Sosial', question: 'Saya belum memahami etika berkomunikasi di media sosial secara aman.', rekomendasiTopik: 'Bijak Bermedia Sosial & Etika Siber Remaja' },

  // Belajar
  { id: 'akpd-9', code: 'A9', bidang: 'Belajar', question: 'Saya merasa belum mengetahui cara dan gaya belajar yang paling efektif untuk diri saya.', rekomendasiTopik: 'Mengenal Gaya Belajar (VAK) & Strategi Belajar Efektif' },
  { id: 'akpd-10', code: 'A10', bidang: 'Belajar', question: 'Saya sering merasa bosan dan kehilangan motivasi saat mengikuti jam pelajaran.', rekomendasiTopik: 'Meningkatkan Motivasi Belajar & Mindset Bertumbuh' },
  { id: 'akpd-11', code: 'A11', bidang: 'Belajar', question: 'Saya merasa kesulitan berkonsentrasi karena sering terdistraksi HP/game online.', rekomendasiTopik: 'Manajemen Gadget & Meningkatkan Fokus Belajar' },
  { id: 'akpd-12', code: 'A12', bidang: 'Belajar', question: 'Saya merasa panik dan bingung cara mempersiapkan diri menghadapi asesmen/ujian.', rekomendasiTopik: 'Strategi Menghadapi Ujian & Mind Mapping Belajar' },

  // Karir
  { id: 'akpd-13', code: 'A13', bidang: 'Karir', question: 'Saya belum yakin dengan bakat, minat, dan cita-cita masa depan saya.', rekomendasiTopik: 'Eksplorasi Minat Bakat & Pemetaan Cita-Cita Masa Depan' },
  { id: 'akpd-14', code: 'A14', bidang: 'Karir', question: 'Saya belum paham perbedaan jenjang sekolah lanjutan (SMA vs SMK vs MA).', rekomendasiTopik: 'Orientasi Sekolah Lanjutan (SMA/SMK/MA/Kedinasan)' },
  { id: 'akpd-15', code: 'A15', bidang: 'Karir', question: 'Saya ingin tahu jenis-jenis profesi baru di era digital dan keterampilan yang dibutuhkan.', rekomendasiTopik: 'Dunia Kerja Era Digital & Keterampilan Abad 21' },
  { id: 'akpd-16', code: 'A16', bidang: 'Karir', question: 'Orang tua saya memiliki pilihan sekolah/karir yang berbeda dengan keinginan saya.', rekomendasiTopik: 'Komunikasi Efektif Pemilihan Karir dengan Orang Tua' },
];

export const PRESET_MODUL_AJAR_LIST: ModulAjarRpl[] = [
  {
    id: 'rpl-1',
    title: 'Stop Bullying! Mewujudkan Sekolah Ramah Anak dan Aman',
    fase: 'Fase D (SMP)',
    bidang: 'Sosial',
    aspekCode: 'SKKPD-5',
    aspekName: 'Kesadaran Tanggung Jawab Sosial',
    alokasiWaktu: '2 x 45 Menit (1 Pertemuan)',
    profilPancasila: ['Beriman & Bertakwa', 'Gotong Royong', 'Bernalar Kritis'],
    metode: 'Experiential Learning, Cinema Education, Diskusi Kelompok',
    media: ['Video Edukasi Bullying', 'Lembar Kerja Refleksi (LKPD)', 'Slide Presentasi Anti-Bullying'],
    tujuanPengenalan: 'Peserta didik dapat mengidentifikasi jenis-jenis bullying (fisik, verbal, siber, sosial) serta dampaknya bagi korban.',
    tujuanAkomodasi: 'Peserta didik memiliki sikap empati dan menolak tegas segala bentuk perilaku perundungan di lingkungan sekolah.',
    tujuanTindakan: 'Peserta didik mampu melakukan aksi nyata mendukung korban dan membuat deklarasi kelas anti-bullying.',
    langkahPendahuluan: [
      'Guru BK membuka kelas dengan salam, doa bersama, dan presensi.',
      'Apersepsi: Menayangkan cuplikan video singkat tentang dinamika persahabatan.',
      'Menjelaskan tujuan layanan BK dan kesepakatan norma dinamika kelas.'
    ],
    langkahInti: [
      'Konkrit (Experience): Menayangkan kisah nyata perundungan dan diskusi imersif.',
      'Refleksi (Reflective Observation): Peserta didik mengisi lembar refleksi perasaan jika berada di posisi korban atau saksi.',
      'Konseptualisasi (Abstract Conceptualization): Guru BK memfasilitasi pemahaman perbedaan antara gurauan sehat vs bullying.',
      'Aplikasi (Active Experimentation): Setiap kelompok membuat poster komitmen "Kelas Bebas Bullying" dan roleplay intervensi saksi bijak.'
    ],
    langkahPenutup: [
      'Peserta didik bersama Guru BK menyimpulkan butir-butir penting layanan.',
      'Refleksi singkat perasaan peserta didik setelah mengikuti bimbingan.',
      'Guru BK menutup kegiatan dengan apresiasi dan doa penutup.'
    ],
    evaluasiProses: [
      'Mengamati antusiasme dan keaktifan peserta didik dalam diskusi kelompok.',
      'Kesesuaian dinamika kelompok dan saling menghargai pendapat teman.'
    ],
    evaluasiHasil: [
      'Evaluasi pemahaman peserta didik melalui instrumen pemahaman diri (Understanding).',
      'Perubahan sikap empati (Comfort) dan rencana tindakan nyata anti bullying (Action).'
    ],
    materiBimbingan: {
      ringkasanMateri: 'Bullying (perundungan) adalah perilaku agresif yang dilakukan secara berulang oleh seseorang atau sekelompok orang yang lebih kuat terhadap individu yang lebih lemah, dengan maksud menyakiti secara fisik, verbal, maupun psikologis.',
      poinMateri: [
        'Jenis Bullying: Fisik (memukul, menendang), Verbal (mengejek, memanggil nama ejekan), Siber/Online (menyebar hoaks/ujaran kebencian di media sosial), dan Relasional/Sosial (mengucilkan teman).',
        'Dampak Bagi Korban: Rasa cemas, trauma belajar, penurunan prestasi akademik, isolasi sosial, hingga depresi.',
        'Peran Upstander vs Bystander: Bystander hanya menonton/tertawa, sedangkan Upstander adalah saksi bijak yang berani menegur atau melaporkan perundungan ke Guru BK.'
      ],
      studiKasus: 'Di kelas 8, seorang siswa baru bernama Budi sering diejek karena logat bicaranya dan dijauhi saat pembentukan kelompok belajar. Budi menjadi takut berangkat sekolah dan sering menyendiri saat istirahat.',
      tipsPraktis: [
        'Tetap tenang dan tunukkan rasa percaya diri (postur tubuh tegak).',
        'Katakan "HENTIKAN!" dengan tegas dan langsung tinggalkan lokasi.',
        'Segera laporkan kejadian ke Guru BK atau Guru Piket tanpa rasa takut.'
      ]
    },
    lkpd: {
      judulLkpd: 'Lembar Kerja Peserta Didik (LKPD): Refleksi & Komitmen Anti-Bullying',
      instruksi: 'Bacalah studi kasus di atas dan jawablah pertanyaan refleksi di bawah ini secara jujur dan mandiri. Setelah itu, rumuskan komitmen aksimu!',
      pertanyaanRefleksi: [
        'Menurutmu, apa saja tindakan yang masuk kategori perundungan verbal maupun emosional di sekolah kita?',
        'Jika kamu melihat temanmu dijadikan bahan ejekan hingga sedih, apa tindakan konkret yang akan kamu lakukan sebagai saksi bijak (Upstander)?',
        'Bagaimana perasaanmu jika diperlakukan secara tidak adil atau dikucilkan oleh teman sekelas?',
        'Tuliskan 3 kata kunci yang dapat membangun suasana kelas yang hangat, aman, dan saling menghargai!'
      ],
      lembarAksiNyata: 'SAYA BERKOMITMEN: Tidak akan melakukan perundungan dalam bentuk apapun, serta siap menjadi pelindung dan sahabat yang mendukung kedamaian di sekolah.',
      rubrikPenilaian: 'Penilaian mencakup 3 aspek: Pemahaman Konsep Bullying (40%), Sikap Empati & Toleransi (30%), serta Kejelasan Rencana Aksi Nyata (30%).'
    },
    pptOutline: {
      slideJudul: 'Stop Bullying! Mewujudkan Sekolah Ramah Anak & Aman',
      slides: [
        {
          slideNo: 1,
          title: 'Apa Itu Bullying & Mengapa Kita Harus Peduli?',
          bulletPoints: [
            'Definisi perundungan berulang vs gurauan biasa',
            'Ketidakseimbangan kekuatan antara pelaku & korban',
            'Mengapa sekolah kita wajib menjadi zona aman untuk semua'
          ],
          speakerNotes: 'Mulai dengan menyapa siswa dengan ramah dan tanyakan pengalaman mereka melihat dinamika pertemanan di sekolah.'
        },
        {
          slideNo: 2,
          title: '4 Bentuk Bullying Yang Wajib Kita Diwaspadai',
          bulletPoints: [
            'Bullying Fisik: Kekerasan badan & merusak barang',
            'Bullying Verbal: Ejekan, nama panggilan, gosip',
            'Bullying Sosial: Mengucilkan & menyebar prasangka',
            'Cyberbullying: Perundungan lewat medsos & chat'
          ],
          speakerNotes: 'Berikan contoh nyata sehari-hari di lingkungan sekolah agar siswa memahami beda bercanda sehat vs bullying.'
        },
        {
          slideNo: 3,
          title: 'Jadilah Upstander, Bukan Sekadar Bystander!',
          bulletPoints: [
            'Bystander: Diam atau ikut tertawa saat perundungan terjadi',
            'Upstander: Berani membela korban & melaporkan ke Guru BK',
            'Satu tindakan kecilmu bisa menyelamatkan masa depan temanmu'
          ],
          speakerNotes: 'Ajak siswa menyadari kekuatan suara mereka dalam menghentikan perilaku tidak menyenangkan.'
        },
        {
          slideNo: 4,
          title: 'Langkah Praktis Ketika Menghadapi Perundungan',
          bulletPoints: [
            'Tatap mata pelaku dan katakan STOP dengan tegas',
            'Jangan membalas dengan kekerasan fisik',
            'Temui Guru BK, Wali Kelas, atau Orang Tua segera'
          ],
          speakerNotes: 'Simulasikan kontak mata dan nada suara yang tegas namun tenang bersama 2 perwakilan siswa.'
        },
        {
          slideNo: 5,
          title: 'Deklarasi & Aksi Nyata Kelas Bebas Bullying',
          bulletPoints: [
            'Isi LKPD Refleksi Diri secara mandiri',
            'Tandatangani banner komitmen bersama kelas',
            'Mari ciptakan kelas penuh empati dan persahabatan!'
          ],
          speakerNotes: 'Bagikan lembar LKPD dan minta siswa menuliskan rencana komitmen aksi nyata mereka.'
        }
      ],
      notebookLmPrompt: 'Buatkan ringkasan podcast edukatif 2 pembicara (Guru BK dan Siswa) yang membahas materi "Stop Bullying di Sekolah". Bahas definisi bullying, beda bercanda vs perundungan, peran saksi bijak (upstander), serta tips menghadapi cyberbullying dengan nada empati, inspiratif, dan hangat untuk siswa SMP/SMA.'
    }
  },
  {
    id: 'rpl-2',
    title: 'Manajemen Waktu Belajar & Mengatasi Prokrastinasi',
    fase: 'Fase D (SMP)',
    bidang: 'Belajar',
    aspekCode: 'SKKPD-4',
    aspekName: 'Kematangan Intelektual',
    alokasiWaktu: '2 x 45 Menit (1 Pertemuan)',
    profilPancasila: ['Mandiri', 'Bernalar Kritis'],
    metode: 'Matriks Eisenhower, Mind Mapping, Self-Management Workshop',
    media: ['Lembar Kerja Matriks Prioritas (LKPD)', 'Aplikasi Jadwal', 'Slide Presentasi Interaktif'],
    tujuanPengenalan: 'Peserta didik dapat menganalisis kebiasaan penggunaan waktu dan penyebab prokrastinasi (menunda tugas).',
    tujuanAkomodasi: 'Peserta didik menyadari pentingnya skala prioritas untuk keseimbangan belajar dan waktu luang.',
    tujuanTindakan: 'Peserta didik mampu menyusun jadwal harian terstruktur dengan metode Matriks Eisenhower.',
    langkahPendahuluan: [
      'Guru BK menyapa peserta didik dan melakukan ice breaking "Tebak Kata Kunci Waktu".',
      'Penyampaian tujuan bimbingan klasikal tentang manajemen waktu.'
    ],
    langkahInti: [
      'Eksplorasi: Peserta didik menginventarisasi kegiatan harian selama 24 jam terakhir.',
      'Analisis Matriks: Guru BK mengenalkan 4 kuadran waktu (Penting-Mendesak, Penting-Tidak Mendesak, dll).',
      'Praktik Mandiri: Peserta didik memasukkan daftar tugas sekolah & aktivitas harian ke matriks prioritas.',
      'Komitmen: Menentukan target "Stop Menunda" untuk 1 minggu ke depan.'
    ],
    langkahPenutup: [
      'Siswa membagikan komitmen jadwal belajarnya kepada teman sejawat.',
      'Guru BK memberikan umpan balik penguatan dan menutup jam layanan.'
    ],
    evaluasiProses: [
      'Keterlibatan aktif siswa saat memilah aktivitas harian.',
      'Kedisiplinan mengisi lembar analisis waktu.'
    ],
    evaluasiHasil: [
      'Lembar jadwal harian baru yang realistis.',
      'Angket evaluasi tingkat prokrastinasi pasca layanan.'
    ],
    materiBimbingan: {
      ringkasanMateri: 'Manajemen waktu adalah seni merencanakan dan mengendalikan pembagian waktu untuk aktivitas tertentu guna meningkatkan efisiensi, produktivitas, dan keseimbangan hidup tanpa stres berlebihan.',
      poinMateri: [
        'Prokrastinasi (Menunda-nunda): Penyebab utamanya bukan malas, melainkan kesulitan mengelola emosi rasa cemas/bosan terhadap tugas.',
        'Matriks Eisenhower (4 Kuadran): Kuadran 1 (Penting & Mendesak - Kerjakan!), Kuadran 2 (Penting & Tidak Mendesak - Jadwalkan! Ini kunci sukses), Kuadran 3 (Tidak Penting & Mendesak - Delegasikan/Batasi), Kuadran 4 (Tidak Penting & Tidak Mendesak - Eliminasi).',
        'Teknik Pomodoro: Belajar fokus selama 25 menit, diselingi istirahat 5 menit untuk menjaga kesegaran otak.'
      ],
      studiKasus: 'Siti memiliki tugas makalah IPS yang dikumpulkan lusa, namun ia menghabiskan waktu 4 jam scroll media sosial karena merasa tugasnya terlalu sulit. Akibatnya, Siti begadang hingga jam 2 pagi dan hasilnya tidak maksimal.',
      tipsPraktis: [
        'Gunakan aturan 5 Detik: Hitung mundur 5-4-3-2-1 dan langsung mulai kerjakan langkah paling kecil!',
        'Pecah tugas besar menjadi sub-tugas kecil berdurasi 15-20 menit.',
        'Matikan notifikasi HP atau gunakan fitur Fokus saat jam belajar.'
      ]
    },
    lkpd: {
      judulLkpd: 'Lembar Kerja Peserta Didik (LKPD): Matriks Prioritas Waktu & Rencana Belajar Mandiri',
      instruksi: 'Inventarisasi seluruh kegiatan harianmu dan petakan ke dalam 4 Kuadran Matriks Eisenhower di bawah ini.',
      pertanyaanRefleksi: [
        'Aktivitas apa di Kuadran 4 (pencuri waktu) yang paling sering membuatmu menunda-nunda belajar?',
        'Mengapa Kuadran 2 (Penting tapi Tidak Mendesak) merupakan area terpenting bagi prestasi belajarmu?',
        'Bagaimana strategi konkretmu mengurangi gangguan smartphone saat jam belajar di rumah?'
      ],
      lembarAksiNyata: 'TARGET MINGGU INI: Saya akan menerapkan Teknik Pomodoro (25 menit belajar + 5 menit istirahat) dan menyelesaikan tugas sekolah sebelum jam 20.00 setiap harinya.',
      rubrikPenilaian: 'Penilaian mencakup: Ketepatan Mengelompokkan Aktivitas di Matriks (40%), Kelayakan Jadwal Harian (30%), dan Komitmen Target Aksi Nyata (30%).'
    },
    pptOutline: {
      slideJudul: 'Manajemen Waktu Belajar & Mengatasi Prokrastinasi',
      slides: [
        {
          slideNo: 1,
          title: 'Kenapa Kita Sering Menunda Tugas? (Prokrastinasi)',
          bulletPoints: [
            'Mitos: Prokrastinasi = Malas? (Salah!)',
            'Realita: Prokrastinasi adalah respon emosional atas rasa takut gagal atau overwhelmed',
            'Dampak buruk menunda: Begadang, stres, & nilai kurang optimal'
          ],
          speakerNotes: 'Ajak siswa melakukan polling singkat: Siapa yang pernah mengerjakan tugas sekolah H-1 jam pengumpulan?'
        },
        {
          slideNo: 2,
          title: 'Matriks Prioritas Eisenhower: Rahasia Orang Sukses',
          bulletPoints: [
            'Kuadran 1 (Penting & Mendesak): Tugas besok, krisis',
            'Kuadran 2 (Penting & Tidak Mendesak): Belajar rutin, olahraga, hobi positif',
            'Kuadran 3 (Tidak Penting & Mendesak): Gangguan notifikasi instant',
            'Kuadran 4 (Pencuri Waktu): Game berlebihan & scroll sosmed tanpa tujuan'
          ],
          speakerNotes: 'Jelaskan mengapa kunci kedamaian dan prestasi tinggi ada pada pembiasaan Kuadran 2.'
        },
        {
          slideNo: 3,
          title: 'Teknik Pomodoro: Belajar Efektif Tanpa Lelah',
          bulletPoints: [
            'Fokus penuh 25 menit (no handphone)',
            'Istirahat sejenak 5 menit (regangkan badan)',
            'Ulangi 4 kali siklus, lalu istirahat panjang 15-30 menit'
          ],
          speakerNotes: 'Demokan penggunaan timer Pomodoro sederhana.'
        },
        {
          slideNo: 4,
          title: 'Rencana Aksi & Pengisian LKPD',
          bulletPoints: [
            'Petakan 10 kegiatan harianmu ke lembar kerja',
            'Tentukan 1 kebiasaan buruk yang akan kamu eliminasi',
            'Buat jadwal belajar mingguan yang realistis'
          ],
          speakerNotes: 'Bimbing siswa mengisi LKPD Matriks Eisenhower.'
        }
      ],
      notebookLmPrompt: 'Buatkan naskah panduan belajar mandiri dan audio ringkasan tentang "Cara Mengatasi Menunda-nunda Tugas (Prokrastinasi) dengan Matriks Eisenhower dan Teknik Pomodoro" untuk siswa sekolah menengah.'
    }
  },
  {
    id: 'rpl-3',
    title: 'Mengenal Bakat, Minat & Orientasi Sekolah Lanjutan (SMA vs SMK)',
    fase: 'Fase D (SMP)',
    bidang: 'Karir',
    aspekCode: 'SKKPD-9',
    aspekName: 'Kematangan Karir',
    alokasiWaktu: '2 x 45 Menit (1 Pertemuan)',
    profilPancasila: ['Mandiri', 'Kreatif'],
    metode: 'Pohon Karir, Asesmen Holland (RIASEC), Small Group Discussion',
    media: ['Kuesioner RIASEC Holland', 'Brosur Sekolah Lanjutan', 'LKPD Pohon Karir'],
    tujuanPengenalan: 'Peserta didik memahami konsep bakat, minat, serta karakteristik pembelajaran di SMA, SMK, dan MA.',
    tujuanAkomodasi: 'Peserta didik meyakini bahwa setiap bidang keahlian memiliki peluang sukses yang setara.',
    tujuanTindakan: 'Peserta didik mampu memetakan potensi diri dan membuat perencanaan sekolah lanjutan secara mantap.',
    langkahPendahuluan: [
      'Guru BK membuka sesi dengan game interaktif "Profesi Impianku".',
      'Menjelaskan tujuan orientasi karir menjelang kelulusan.'
    ],
    langkahInti: [
      'Pemberian Informasi: Pemutaran video eksplorasi dunia jurusan SMA & SMK.',
      'Pengisian Tes RIASEC: Peserta didik mengetahui kecenderungan kepribadian karirnya.',
      'Pembuatan Pohon Karir: Menghubungkan bakat minat dengan pilihan sekolah lanjutan.',
      'Diskusi Kelompok: Saling memberikan masukan positif atas pilihan teman.'
    ],
    langkahPenutup: [
      'Merumuskan ikhtisar keputusan rencana sekolah lanjutan.',
      'Penyampaian rencana tindak lanjut konseling kelompok bagi siswa yang masih ragu.'
    ],
    evaluasiProses: ['Kelancaran pengisian asesmen karir dan keseriuhan diskusi.'],
    evaluasiHasil: ['Dokumen Pohon Karir Peserta Didik lengkap dengan pilihan jurusan target.'],
    materiBimbingan: {
      ringkasanMateri: 'Perencanaan karir sejak dini membantu siswa menentukan pilihan jalur pendidikan lanjutan yang sesuai dengan kombinasi Bakat (potensi bawaan/keahlian alami), Minat (ketertarikan emosional), dan Nilai Akademik.',
      poinMateri: [
        'Karakteristik SMA/MA: Berfokus pada penguatan teori akademis dasar untuk melanjutkan ke Perguruan Tinggi (Sarjana/Diploma).',
        'Karakteristik SMK/MAK: Berfokus pada keterampilan vokasi praktis, sertifikasi keahlian, dan kesiapan kerja langsung serta wirausaha.',
        'Kode Tipe Karir Holland (RIASEC): Realistic (Teknis), Investigative (Riset/Sains), Artistic (Seni/Desain), Social (Pelayanan/Sosial), Enterprising (Bisnis/Kepemimpinan), Conventional (Administrasi/Data).'
      ],
      studiKasus: 'Rian memiliki hobi membongkar mesin sepeda motor dan menggambar sketsa otomotif, namun orang tuanya menginginkan Rian masuk SMA jurusan IPA. Rian bingung bagaimana menjelaskan minat vokasionalnya.',
      tipsPraktis: [
        'Lakukan analisis RIASEC diri sendiri.',
        'Diskusikan pilihan jurusan secara terbuka dengan orang tua berlandaskan data bakat minat.',
        'Survei lokasi dan kurikulum jurusan target sekolah lanjutan.'
      ]
    },
    lkpd: {
      judulLkpd: 'Lembar Kerja Peserta Didik (LKPD): Pohon Karir & Peta Jalan Sekolah Lanjutan',
      instruksi: 'Gambarkan Pohon Karir pribadi berdasarkan potensi dirimu, lalu tentukan pilihan sekolah lanjutan prioritas 1 dan 2.',
      pertanyaanRefleksi: [
        'Apa saja 3 kekuatan terbesar (bakat/keterampilan) yang kamu miliki saat ini?',
        'Berdasarkan Tipe Holland RIASEC, manakah tipe kepribadian yang paling menggambarkan dirimu?',
        'Jelaskan alasan utamamu memilih antara jalur SMA/MA atau SMK/MAK pasca lulus SMP!'
      ],
      lembarAksiNyata: 'PETA JALAN SAYA: Target Sekolah Lanjutan Prioritas 1 adalah [Nama Sekolah & Jurusan Target], dengan langkah persiapan yaitu meningkatkan nilai mata pelajaran pendukung dan melatih keterampilan teknis mandiri.',
      rubrikPenilaian: 'Penilaian mencakup: Kejelasan Pemetaan Bakat Minat (40%), Kelengkapan Pohon Karir (30%), dan Kemantapan Alasan Pilihan Sekolah Lanjutan (30%).'
    },
    pptOutline: {
      slideJudul: 'Orientasi Karir: Memilih Jalur SMA vs SMK Sesuai Bakat Minat',
      slides: [
        {
          slideNo: 1,
          title: 'Perbedaan Mendasar Jalur SMA vs SMK',
          bulletPoints: [
            'SMA: 80% Teori Akademis, Persiapan Utama Kuliah S1',
            'SMK: 60% Praktik Vokasi & Magang Industri, Siap Kerja/Wirausaha',
            'Kedua jalur sama-sama memiliki masa depan cerah!'
          ],
          speakerNotes: 'Tekankan bahwa tidak ada jalur yang lebih baik, yang ada adalah jalur yang paling SESUAI dengan diri siswa.'
        },
        {
          slideNo: 2,
          title: 'Mengenal Diri Lewat Tipe Holland (RIASEC)',
          bulletPoints: [
            'Realistic (Praktikal & Otomotif/Sains Mesin)',
            'Investigative (Pemikir & Analis)',
            'Artistic (Seni, Musik, Desain)',
            'Social (Suka Membantu & Mengajar)',
            'Enterprising (Wirausaha & Negosiator)',
            'Conventional (Rapi, Data, & Aturan)'
          ],
          speakerNotes: 'Minta siswa mengangkat tangan sesuai tipe yang paling mewakili diri mereka.'
        },
        {
          slideNo: 3,
          title: 'Langkah Diskusi Bersama Orang Tua',
          bulletPoints: [
            'Sampaikan hasil tes bakat minat BK dengan ramah',
            'Tunjukkan prospek karir jurusan pilihanmu',
            'Konsultasikan ke Guru BK jika terjadi perbedaan pandangan'
          ],
          speakerNotes: 'Berikan panduan cara berdialog yang santun bersama orang tua di rumah.'
        }
      ],
      notebookLmPrompt: 'Buatkan rangkuman materi dan panduan diskusi interaktif bertema "Panduan Memilih Antara SMA dan SMK Berdasarkan Asesmen Bakat Minat RIASEC" yang cocok diimpor ke NotebookLM untuk bahan bacaan siswa dan orang tua.'
    }
  }
];
