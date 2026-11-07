import { loadSchoolData, saveSchoolData, getActiveSchoolId, getSchoolConfig } from './schoolConfig';
import { saveToFirestore } from './firestoreSync';

export interface ViolationOption {
  id: string;
  label: string;
  points: number;
  description?: string;
}

export interface ViolationCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  options: ViolationOption[];
}

// Preset 1: Standar SMP / MTs (Nasional Kemdikbud & Kemenag)
export const PRESET_SMP_MTS: ViolationCategory[] = [
  {
    id: 'kedisiplinan',
    name: 'Kedisiplinan & Ketertiban',
    description: 'Pelanggaran terkait keterlambatan, presensi, waktu belajar, dan kepatuhan tata tertib harian.',
    color: 'emerald',
    options: [
      { id: 'k1', label: 'Terlambat masuk sekolah', points: 5 },
      { id: 'k2', label: 'Membolos pelajaran / meninggalkan kelas tanpa izin', points: 15 },
      { id: 'k3', label: 'Membolos sekolah / tidak masuk tanpa keterangan (alpa)', points: 20 },
      { id: 'k4', label: 'Keluar lingkungan sekolah saat jam istirahat / pelajaran tanpa izin', points: 10 },
      { id: 'k5', label: 'Membawa gawai / smartphone non-edukasi tanpa izin guru', points: 15 },
      { id: 'k6', label: 'Tidak mengikuti upacara bendera hari Senin / kegiatan wajib', points: 10 },
      { id: 'k7', label: 'Membawa barang yang mengganggu ketertiban (mainan, kartu, dll)', points: 10 },
      { id: 'k8', label: 'Tidak mengikuti kegiatan ibadah wajib di sekolah (sholat berjamaah, dll.)', points: 10 },
      { id: 'k9', label: 'Membawa kendaraan bermotor ke sekolah tanpa SIM / helm / kelengkapan standar', points: 15 },
      { id: 'k10', label: 'Memarkir kendaraan di luar area yang ditentukan sekolah', points: 5 },
      { id: 'k11', label: 'Tidak melaksanakan piket kebersihan kelas sesuai jadwal', points: 5 },
      { id: 'k12', label: 'Makan atau minum di dalam kelas saat Kegiatan Belajar Mengajar (KBM) berlangsung', points: 5 },
      { id: 'k13', label: 'Tidak membawa buku pelajaran sesuai jadwal pelajaran', points: 5 },
      { id: 'k14', label: 'Mengulur-ngulur waktu kembali ke kelas setelah jam istirahat selesai', points: 5 },
      { id: 'k15', label: 'Sengaja tidur di kelas saat jam pelajaran berlangsung', points: 5 },
      { id: 'k16', label: 'Membawa / menghidupkan speaker bluetooth atau headset saat KBM tanpa izin', points: 10 },
      { id: 'k17', label: 'Tidak memakai atribut upacara lengkap (topi, dasi, ikat pinggang)', points: 5 },
      { id: 'k18', label: 'Tidak mengenakan kartu siswa / nametag di lingkungan sekolah', points: 5 }
    ]
  },
  {
    id: 'kerapian',
    name: 'Kerapian & Atribut Seragam',
    description: 'Pelanggaran terkait ketentuan pakaian seragam, atribut, rambut, kuku, dan penampilan siswa.',
    color: 'blue',
    options: [
      { id: 'a1', label: 'Seragam tidak lengkap / tidak sesuai hari / atribut tidak ada', points: 5 },
      { id: 'a2', label: 'Pakaian dikeluarkan / tidak rapi / tidak memakai ikat pinggang hitam', points: 5 },
      { id: 'a3', label: 'Rambut gondrong / dicat warna / potongan tidak rapi (siswa putra)', points: 10 },
      { id: 'a4', label: 'Memakai perhiasan berlebihan / aksesoris tidak pantas ke sekolah', points: 5 },
      { id: 'a5', label: 'Kuku panjang / dicat warna-warni', points: 5 },
      { id: 'a6', label: 'Menggunakan sepatu atau kaos kaki tidak sesuai ketentuan sekolah', points: 5 },
      { id: 'a7', label: 'Menggunakan make-up / kosmetik berlebihan', points: 5 },
      { id: 'a8', label: 'Memakai kaos dalam (singlet) berwarna mencolok atau bermotif tembus pandang', points: 5 },
      { id: 'a9', label: 'Memiliki / menggunakan tato (temporer maupun permanen)', points: 25 },
      { id: 'a10', label: 'Bertindik bagi siswa putra, atau menggunakan tindik berlebihan bagi siswa putri', points: 15 },
      { id: 'a11', label: 'Membawa atau menggunakan tas sekolah yang tidak pantas (misal tas plastik/kresek)', points: 5 },
      { id: 'a12', label: 'Model rambut dicukur garis (skin rambut) / berpola tidak wajar', points: 10 },
      { id: 'a13', label: 'Memakai jaket, sweater, atau rompi non-sekolah tanpa izin tertulis guru', points: 5 },
      { id: 'a14', label: 'Ujung celana terlalu ketat / model pensil (tidak standar kesiswaan)', points: 10 },
      { id: 'a15', label: 'Model rok siswi di atas lutut / diperpendek sengaja di luar ketentuan', points: 10 },
      { id: 'a16', label: 'Memakai ikat pinggang bermotif mencolok atau berkepala terlalu besar', points: 5 },
      { id: 'a17', label: 'Memakai softlens berwarna mencolok / hiasan bulu mata berlebihan', points: 5 }
    ]
  },
  {
    id: 'perilaku',
    name: 'Perilaku & Etika / Karakter',
    description: 'Pelanggaran terkait adab, sikap terhadap guru/teman, perundungan, dan ketertiban sosial.',
    color: 'amber',
    options: [
      { id: 'p1', label: 'Tidak sopan / menentang / berkata kasar kepada Guru atau Staf sekolah', points: 25 },
      { id: 'p2', label: 'Membuat kegaduhan / mengganggu jalannya proses pembelajaran', points: 10 },
      { id: 'p3', label: 'Merusak fasilitas / sarana prasarana sekolah secara sengaja', points: 30 },
      { id: 'p4', label: 'Melakukan perundungan verbal (bullying), ejekan SARA, atau intimidasi', points: 25 },
      { id: 'p5', label: 'Berpacaran berlebihan atau berdua-duaan di tempat sepi lingkungan sekolah', points: 20 },
      { id: 'p6', label: 'Mencoret-coret meja, dinding, kursi, atau buku perpustakaan (vandalism)', points: 10 },
      { id: 'p7', label: 'Membawa / mengonsumsi rokok elektrik (vape) / rokok biasa di luar sekolah memakai seragam', points: 30 },
      { id: 'p8', label: 'Membuang sampah sembarangan atau mengotori lingkungan sekolah secara sengaja', points: 5 },
      { id: 'p9', label: 'Meludah sembarangan di koridor, ruang kelas, tempat ibadah, atau lapangan', points: 5 },
      { id: 'p10', label: 'Menyebarkan berita bohong (hoaks) atau fitnah tentang teman/guru/staf', points: 25 },
      { id: 'p11', label: 'Mengambil foto atau video guru/staf secara diam-diam untuk bahan ejekan di media sosial', points: 35 },
      { id: 'p12', label: 'Melakukan provokasi perkelahian atau adu domba antar teman', points: 30 },
      { id: 'p13', label: 'Menggunakan nama panggilan orang tua teman untuk bahan olok-olokan (ejekan)', points: 10 },
      { id: 'p14', label: 'Membuat coretan/tulisan kotor atau tidak senonoh pada buku siswa lain', points: 15 },
      { id: 'p15', label: 'Berkomunikasi di media sosial menggunakan nama sekolah disertai konten tidak sopan', points: 25 },
      { id: 'p16', label: 'Sengaja merusak karya kerajinan / karya seni milik teman lain', points: 15 },
      { id: 'p17', label: 'Tidak mengindahkan teguran guru / staf saat diingatkan berulang kali', points: 20 },
      { id: 'p18', label: 'Mengeluarkan kata-kata kotor atau mengumpat di lingkungan sekolah', points: 15 }
    ]
  },
  {
    id: 'akademik',
    name: 'Akademik & Integritas',
    description: 'Pelanggaran terkait kejujuran akademik, penilaian, pemalsuan dokumen, dan tugas sekolah.',
    color: 'purple',
    options: [
      { id: 'ak1', label: 'Menyontek saat ujian harian, tengah semester, atau akhir semester', points: 25 },
      { id: 'ak2', label: 'Melakukan plagiasi / menyalin tugas atau PR teman', points: 10 },
      { id: 'ak3', label: 'Tidak mengerjakan tugas / pekerjaan rumah (PR) berulang kali', points: 10 },
      { id: 'ak4', label: 'Memalsukan tanda tangan orang tua, wali kelas, atau guru mata pelajaran', points: 30 },
      { id: 'ak5', label: 'Mengubah nilai rapor / lembar jawaban secara ilegal', points: 50 },
      { id: 'ak6', label: 'Membawa atau menyebarkan kunci jawaban ujian secara tidak sah', points: 50 },
      { id: 'ak7', label: 'Membolos saat kegiatan penilaian harian atau ujian susulan tanpa alasan sah', points: 20 },
      { id: 'ak8', label: 'Menggunakan AI / joki tugas secara curang untuk menyalin karya ilmiah utuh tanpa sitasi', points: 15 },
      { id: 'ak9', label: 'Bekerja sama / bertukar lembar jawaban saat ulangan berlangsung', points: 25 },
      { id: 'ak10', label: 'Mengumpulkan tugas hasil jiplakan murni (copy-paste) dari internet tanpa modifikasi', points: 10 },
      { id: 'ak11', label: 'Membawa catatan ringkasan (contekan) saat ujian di laci, saku, atau gawai', points: 25 },
      { id: 'ak12', label: 'Sengaja tidak mengikuti remedial ujian yang telah dijadwalkan secara berkala', points: 10 }
    ]
  },
  {
    id: 'berat',
    name: 'Pelanggaran Berat & Hukum',
    description: 'Pelanggaran tingkat tinggi yang melanggar norma hukum, asusila, narkoba, senjata tajam, dan tawuran.',
    color: 'red',
    options: [
      { id: 'b1', label: 'Melakukan perundungan fisik (physical bullying) atau kekerasan', points: 50 },
      { id: 'b2', label: 'Melakukan pemalakan / pemerasan uang atau barang kepada teman', points: 40 },
      { id: 'b3', label: 'Membawa, menyimpan, atau menghisap rokok di lingkungan sekolah', points: 50 },
      { id: 'b4', label: 'Membawa, menyimpan, atau menyebarkan konten pornografi', points: 75 },
      { id: 'b5', label: 'Membawa senjata tajam, senjata api, atau barang berbahaya lainnya', points: 100 },
      { id: 'b6', label: 'Terlibat pencurian barang milik sekolah, guru, karyawan, atau sesama siswa', points: 75 },
      { id: 'b7', label: 'Membawa, mengonsumsi, atau mengedarkan narkoba, miras, atau obat terlarang', points: 100 },
      { id: 'b8', label: 'Terlibat perkelahian massal (tawuran) antar kelas atau antar sekolah', points: 100 },
      { id: 'b9', label: 'Melakukan tindakan asusila atau pelecehan seksual di lingkungan sekolah', points: 100 },
      { id: 'b10', label: 'Terlibat dalam aktivitas perjudian (online maupun konvensional) di lingkungan sekolah', points: 75 },
      { id: 'b11', label: 'Melakukan penipuan keuangan atau penggalangan dana ilegal mengatasnamakan sekolah', points: 50 },
      { id: 'b12', label: 'Terlibat dalam geng motor liar atau organisasi terlarang/radikal', points: 100 },
      { id: 'b13', label: 'Membawa, menyimpan, atau mengonsumsi minuman keras (miras) atau alkohol', points: 100 },
      { id: 'b14', label: 'Melakukan tindakan intimidasi / premanisme / pengompasan berkelompok', points: 75 },
      { id: 'b15', label: 'Terlibat dalam pornografi aksi langsung atau pengiriman media asusila', points: 100 },
      { id: 'b16', label: 'Melakukan perusakan berat gerbang, ruang komputer, atau laboratorium sekolah', points: 75 }
    ]
  }
];

// Preset 2: Standar SMA / SMK / MA
export const PRESET_SMA_SMK: ViolationCategory[] = [
  {
    id: 'kedisiplinan_sma',
    name: 'Kedisiplinan & Tata Tertib Siswa SMA/SMK',
    description: 'Ketertiban kehadiran, parkir kendaraan bermotor, praktik kerja, dan jam sekolah.',
    color: 'emerald',
    options: [
      { id: 'sma_k1', label: 'Terlambat hadir di sekolah (>15 menit)', points: 5 },
      { id: 'sma_k2', label: 'Keluar gerbang sekolah tanpa surat izin satpam / piket', points: 15 },
      { id: 'sma_k3', label: 'Tidak masuk sekolah tanpa surat keterangan (Alpa)', points: 20 },
      { id: 'sma_k4', label: 'Membolos pada jam pelajaran tertentu / sembunyi di kantin', points: 15 },
      { id: 'sma_k5', label: 'Membawa motor knalpot brong / tidak standar kelengkapan', points: 20 },
      { id: 'sma_k6', label: 'Tidak mengikuti upacara bendera / apel pagi', points: 10 },
      { id: 'sma_k7', label: 'Tidak mengikuti kegiatan Praktik Kerja Lapangan (PKL) / magang tanpa kabar', points: 30 }
    ]
  },
  {
    id: 'kerapian_sma',
    name: 'Kerapian, Seragam & Praktikum',
    description: 'Standar seragam kejuruan/sekolah, rambut, atribut wearpack, dan etika berbusana.',
    color: 'blue',
    options: [
      { id: 'sma_a1', label: 'Pakaian seragam ketat / robek / tidak sesuai regulasi kesiswaan', points: 10 },
      { id: 'sma_a2', label: 'Rambut gondrong / diwarnai selain hitam (siswa putra)', points: 15 },
      { id: 'sma_a3', label: 'Tidak memakai atribut kelengkapan wearpack / lab saat praktikum', points: 10 },
      { id: 'sma_a4', label: 'Memiliki tato atau tindik tubuh tidak wajar', points: 30 },
      { id: 'sma_a5', label: 'Sepatu tidak sesuai ketentuan (bukan hitam polos)', points: 5 }
    ]
  },
  {
    id: 'etika_karakter_sma',
    name: 'Etika, Perilaku & Karakter Remaja',
    description: 'Sikap sopan santun, media sosial, perundungan, dan hubungan sosial.',
    color: 'amber',
    options: [
      { id: 'sma_p1', label: 'Melakukan perundungan (bullying) verbal / cyberbullying di medsos', points: 35 },
      { id: 'sma_p2', label: 'Bersikap tidak hormat / menentang guru dan staf sekolah', points: 30 },
      { id: 'sma_p3', label: 'Merokok biasa atau rokok elektrik (vape) di dalam/sekitar sekolah', points: 40 },
      { id: 'sma_p4', label: 'Berduaan di tempat sepi / perilaku asusila ringan di sekolah', points: 30 },
      { id: 'sma_p5', label: 'Membuat keonaran / merusak fasilitas publik sekolah', points: 35 }
    ]
  },
  {
    id: 'integritas_sma',
    name: 'Kejujuran & Integritas Akademik',
    description: 'Kecurangan ujian sekolah, pemalsuan dokumen resmi, dan joki tugas.',
    color: 'purple',
    options: [
      { id: 'sma_ak1', label: 'Menyontek / membuka gawai saat Asesmen Sumatif / Ujian', points: 25 },
      { id: 'sma_ak2', label: 'Memalsukan tanda tangan orang tua, guru, atau stempel sekolah', points: 40 },
      { id: 'sma_ak3', label: 'Menggunakan jasa joki tugas / karya ilmiah tanpa kejujuran akademik', points: 20 },
      { id: 'sma_ak4', label: 'Membocorkan soal ujian kepada pihak lain', points: 50 }
    ]
  },
  {
    id: 'kriminal_sma',
    name: 'Pelanggaran Kriminal & Hukum',
    description: 'Narkoba, tawuran, senjata tajam, pemerasan, dan pelanggaran hukum berat.',
    color: 'red',
    options: [
      { id: 'sma_b1', label: 'Terlibat tawuran antar sekolah / perkelahian massal', points: 100 },
      { id: 'sma_b2', label: 'Membawa atau menggunakan senjata tajam / senjata api', points: 100 },
      { id: 'sma_b3', label: 'Membawa, mengonsumsi, atau mengedarkan narkoba / miras', points: 100 },
      { id: 'sma_b4', label: 'Melakukan pelecehan seksual / asusila berat', points: 100 },
      { id: 'sma_b5', label: 'Melakukan tindak pidana pencurian atau pemerasan (pemalakan)', points: 80 }
    ]
  }
];

// Preset 3: Standar Pesantren / Islamic Boarding School
export const PRESET_PESANTREN: ViolationCategory[] = [
  {
    id: 'ibadah_adab',
    name: 'Adab, Ibadah & Halaqah',
    description: 'Kedisiplinan sholat berjamaah, tahfidz/halaqah, adab thalabul ilmi, dan aurat.',
    color: 'emerald',
    options: [
      { id: 'pes_i1', label: 'Masbuq / terlambat sholat fardhu berjamaah di masjid', points: 5 },
      { id: 'pes_i2', label: 'Tidak mengikuti sholat fardhu berjamaah tanpa uzur syari', points: 15 },
      { id: 'pes_i3', label: 'Tidak hadir halaqah tahfidz / pengajian kitab kuning', points: 15 },
      { id: 'pes_i4', label: 'Membuka aurat / tidak memakai busana muslim/muslimah syari', points: 10 },
      { id: 'pes_i5', label: 'Bicara kotor / mencela ustadz atau sesama santri', points: 15 }
    ]
  },
  {
    id: 'asrama_disiplin',
    name: 'Ketertiban Asrama & Pondok',
    description: 'Jam tidur, kebersihan kamar, keluar pondok tanpa izin pengasuh, dan gawai.',
    color: 'blue',
    options: [
      { id: 'pes_a1', label: 'Membawa smartphone / gawai ilegal tanpa izin musyrif', points: 25 },
      { id: 'pes_a2', label: 'Keluar area pondok / melanggar batas asrama (ghosob wilayah)', points: 30 },
      { id: 'pes_a3', label: 'Terlambat kembali ke pondok setelah izin libur (mutaakhkhir)', points: 15 },
      { id: 'pes_a4', label: 'Mengambil barang milik santri lain tanpa izin (ghosob barang)', points: 10 },
      { id: 'pes_a5', label: 'Begadang di luar jam tidur asrama tanpa izin belajar', points: 10 }
    ]
  },
  {
    id: 'akhlak_pesantren',
    name: 'Pelanggaran Akhlak & Syariat Berat',
    description: 'Hubungan bukan mahram, rokok/vape, perundungan, dan pelanggaran berat syariat.',
    color: 'red',
    options: [
      { id: 'pes_b1', label: 'Berkomunikasi intens / berduaan dengan lawan jenis bukan mahram (ikhtilath)', points: 50 },
      { id: 'pes_b2', label: 'Membawa atau merokok / vape di lingkungan pesantren', points: 50 },
      { id: 'pes_b3', label: 'Melakukan perundungan fisik atau pemukulan (junior-senior)', points: 75 },
      { id: 'pes_b4', label: 'Melihat / menyimpan konten pornografi atau media tidak senonoh', points: 75 },
      { id: 'pes_b5', label: 'Kabur dari pesantren atau melakukan tindakan pidana', points: 100 }
    ]
  }
];

// Preset 4: Standar Sederhana (Ringan, Sedang, Berat)
export const PRESET_SEDERHANA: ViolationCategory[] = [
  {
    id: 'kategori_ringan',
    name: 'Pelanggaran Ringan (1 - 10 Poin)',
    description: 'Pelanggaran tingkat ringan yang dapat dibina langsung oleh Guru Piket atau Wali Kelas.',
    color: 'emerald',
    options: [
      { id: 'ringan_1', label: 'Terlambat masuk sekolah / kelas', points: 5 },
      { id: 'ringan_2', label: 'Seragam tidak rapi / atribut tidak lengkap', points: 5 },
      { id: 'ringan_3', label: 'Tidak membawa perlengkapan belajar / buku paket', points: 5 },
      { id: 'ringan_4', label: 'Membuang sampah tidak pada tempatnya', points: 5 },
      { id: 'ringan_5', label: 'Rambut tidak rapi / melewati batas kerah (putra)', points: 10 },
      { id: 'ringan_6', label: 'Mengganggu ketenangan proses pembelajaran', points: 10 }
    ]
  },
  {
    id: 'kategori_sedang',
    name: 'Pelanggaran Sedang (15 - 35 Poin)',
    description: 'Pelanggaran yang memerlukan pembinaan terstruktur oleh Wali Kelas & Guru BK.',
    color: 'amber',
    options: [
      { id: 'sedang_1', label: 'Membolos sekolah / tidak masuk tanpa keterangan (Alpa)', points: 20 },
      { id: 'sedang_2', label: 'Keluar pagar sekolah saat jam istirahat tanpa izin', points: 15 },
      { id: 'sedang_3', label: 'Membawa gawai tanpa izin saat jam pelajaran', points: 15 },
      { id: 'sedang_4', label: 'Berkata kasar / tidak sopan kepada teman atau staf sekolah', points: 20 },
      { id: 'sedang_5', label: 'Menyontek saat ujian atau tugas sekolah', points: 25 },
      { id: 'sedang_6', label: 'Merokok / vape di luar sekolah dengan seragam', points: 30 }
    ]
  },
  {
    id: 'kategori_berat',
    name: 'Pelanggaran Berat (40 - 100 Poin)',
    description: 'Pelanggaran berat yang memerlukan Panggilan Orang Tua, Konferensi Kasus, atau Skorsing.',
    color: 'red',
    options: [
      { id: 'berat_1', label: 'Merokok / membawa rokok di dalam lingkungan sekolah', points: 50 },
      { id: 'berat_2', label: 'Melakukan perundungan (bullying) fisik / kekerasan', points: 50 },
      { id: 'berat_3', label: 'Membawa senjata tajam / benda berbahaya', points: 100 },
      { id: 'berat_4', label: 'Terlibat perkelahian massal (tawuran)', points: 100 },
      { id: 'berat_5', label: 'Membawa / mengonsumsi narkoba, miras, atau obat terlarang', points: 100 },
      { id: 'berat_6', label: 'Melakukan tindakan asusila atau pelecehan seksual', points: 100 }
    ]
  }
];

// Preset 5: STANDAR TERBARU BK KURIKULUM MERDEKA & PPKSP (Permendikbudristek No. 46 Tahun 2023)
export const PRESET_KURIKULUM_MERDEKA_PPKSP: ViolationCategory[] = [
  {
    id: 'ppksp_perundungan',
    name: 'Perundungan (Bullying) & Kekerasan Psikis [PPKSP]',
    description: 'Bentuk kekerasan berulang atau tekanan psikologis menurut Permendikbudristek No. 46/2023. Perlu pembinaan restitutif dan perlindungan korban.',
    color: 'rose',
    options: [
      { id: 'km_bul_1', label: 'Perundungan verbal (mengejek fisik, mengancam, memanggil dengan nama tidak pantas)', points: 25, description: 'Siswa diarahkan mengidentifikasi empati dan keyakinan kelas tentang saling menghormati.' },
      { id: 'km_bul_2', label: 'Pengucilan terencana / intimidasi sosial dalam kelompok kelas', points: 30, description: 'Pembinaan dinamika kelompok dan mediasi teman sebaya.' },
      { id: 'km_bul_3', label: 'Cyberbullying di media sosial / grup WhatsApp kelas', points: 35, description: 'Klarifikasi jejak digital dan komitmen penghapusan konten secara bertanggung jawab.' },
      { id: 'km_bul_4', label: 'Mengambil foto/video teman atau guru diam-diam untuk dijadikan cemoohan publik', points: 35, description: 'Edukasi literasi digital dan perlindungan privasi diri sesama warga sekolah.' },
      { id: 'km_bul_5', label: 'Pemerasan uang jajan atau barang milik teman (pemalakan)', points: 40, description: 'Restitusi ganti rugi barang dan penelusuran kebutuhan dasar anak.' }
    ]
  },
  {
    id: 'ppksp_fisik',
    name: 'Kekerasan Fisik & Konflik Antar Murid [PPKSP]',
    description: 'Tindakan yang mencederai fisik atau berisiko membahayakan keselamatan raga peserta didik.',
    color: 'red',
    options: [
      { id: 'km_fis_1', label: 'Perkelahian perorangan atau pemukulan di lingkungan sekolah', points: 50, description: 'Pengamanan korban, mediasi dengan pendekatan restitusi, dan kesepakatan damai tertulis.' },
      { id: 'km_fis_2', label: 'Pengeroyokan / kekerasan fisik berkelompok', points: 75, description: 'Konferensi kasus melibatkan orang tua, wali kelas, dan Tim TPPK satuan pendidikan.' },
      { id: 'km_fis_3', label: 'Terlibat tawuran antar sekolah / perkelahian massal', points: 100, description: 'Penanganan komprehensif bersama aparat, dinas pendidikan, dan pendampingan rehabilitatif.' },
      { id: 'km_fis_4', label: 'Membawa senjata tajam atau benda berbahaya ke sekolah', points: 100, description: 'Penyitaan benda berbahaya, pemanggilan orang tua segera, dan kontrak perilaku ketat.' }
    ]
  },
  {
    id: 'ppksp_seksual',
    name: 'Kekerasan Seksual & Pornografi [PPKSP]',
    description: 'Pelanggaran kehormatan tubuh dan asusila sesuai amanat perlindungan anak dan Permendikbudristek No. 46/2023.',
    color: 'purple',
    options: [
      { id: 'km_sek_1', label: 'Catcalling / lelucon verbal bernuansa seksual atau tidak senonoh', points: 25, description: 'Edukasi batasan tubuh, etika kesopanan, dan kesadaran gender.' },
      { id: 'km_sek_2', label: 'Menyimpan, menonton, atau menyebarkan konten pornografi', points: 50, description: 'Konseling individual intensif, penelusuran adiksi gawai, dan pendampingan psikologis.' },
      { id: 'km_sek_3', label: 'Pelecehan seksual fisik atau perbuatan asusila', points: 100, description: 'Penanganan khusus berkoordinasi dengan TPPK, UPTD PPA, dan perlindungan penuh bagi korban.' }
    ]
  },
  {
    id: 'ppksp_diskriminasi',
    name: 'Diskriminasi, Intoleransi & Sikap SARA [PPKSP]',
    description: 'Tindakan merendahkan atau memperlakukan berbeda berdasarkan suku, agama, ras, dan kondisi fisik/inklusi.',
    color: 'amber',
    options: [
      { id: 'km_dis_1', label: 'Mengejek latar belakang suku, agama, ras, atau status sosial teman', points: 25, description: 'Penguatan Profil Pelajar Pancasila dimensi Berkebinekaan Global.' },
      { id: 'km_dis_2', label: 'Melakukan diskriminasi terhadap peserta didik berkebutuhan khusus (PDBK/Inklusi)', points: 30, description: 'Edukasi sekolah ramah anak dan budaya inklusif.' },
      { id: 'km_dis_3', label: 'Mengganggu atau menolak kegiatan ibadah agama lain di sekolah', points: 40, description: 'Bimbingan nilai toleransi dan dialog lintas agama bersama guru PAI/Agama.' }
    ]
  },
  {
    id: 'disiplin_positif_kelas',
    name: 'Kedisiplinan & Kesepakatan Belajar (Restitusi)',
    description: 'Ketertiban kehadiran dan komitmen belajar sehari-hari. Dibina melalui kesepakatan kelas dan posisi kontrol Manajer.',
    color: 'emerald',
    options: [
      { id: 'km_dis_kls_1', label: 'Terlambat hadir di sekolah / kelas', points: 5, description: 'Menstabilkan identitas: murid menyusun rencana manajemen waktu pagi.' },
      { id: 'km_dis_kls_2', label: 'Meninggalkan kelas saat jam pelajaran tanpa izin (membolos pelajaran)', points: 15, description: 'Eksplorasi alasan ketidaktertarikan belajar dan solusi bersama guru mata pelajaran.' },
      { id: 'km_dis_kls_3', label: 'Tidak masuk sekolah tanpa keterangan (Alpa)', points: 20, description: 'Komunikasi sinergis dengan orang tua dan kunjungan rumah bila berulang.' },
      { id: 'km_dis_kls_4', label: 'Menggunakan gawai / smartphone di luar izin belajar guru', points: 10, description: 'Penyimpanan mandiri gawai dan refleksi komitmen fokus belajar.' },
      { id: 'km_dis_kls_5', label: 'Pakaian seragam tidak rapi atau atribut tidak lengkap', points: 5, description: 'Pengingat positif untuk kerapian diri sebagai cermin kedewasaan.' },
      { id: 'km_dis_kls_6', label: 'Mengabaikan tugas piket kebersihan kelas bersama', points: 5, description: 'Restitusi merapikan lingkungan belajar secara sukarela.' }
    ]
  },
  {
    id: 'integritas_karakter',
    name: 'Integritas Akademik & Karakter Pelajar Pancasila',
    description: 'Kejujuran budi pekerti, pencegahan zat adiktif, dan pemeliharaan fasilitas sekolah.',
    color: 'blue',
    options: [
      { id: 'km_int_1', label: 'Menyontek saat ujian atau melakukan plagiasi tugas utuh', points: 20, description: 'Validasi kebutuhan prestasi vs integritas: bimbingan cara belajar mandiri.' },
      { id: 'km_int_2', label: 'Memalsukan tanda tangan orang tua, guru, atau memalsukan surat izin', points: 30, description: 'Dialog terbuka mengenai alasan ketakutan berterus terang.' },
      { id: 'km_int_3', label: 'Merusak sarana prasarana sekolah secara sengaja (vandalisme)', points: 30, description: 'Restitusi memperbaiki atau merapikan kembali fasilitas yang dirusak.' },
      { id: 'km_int_4', label: 'Membawa, menyimpan, atau merokok / vape di lingkungan sekolah', points: 50, description: 'Pemeriksaan kesehatan, konseling berhenti merokok, dan pendampingan orang tua.' },
      { id: 'km_int_5', label: 'Membawa atau mengonsumsi minuman keras, narkoba, atau zat terlarang', points: 100, description: 'Alih tangan kasus (referral) ke BNN/rehabilitasi medis dan pendampingan keluarga.' }
    ]
  }
];

export const PRESET_MAP: Record<string, { label: string; description: string; categories: ViolationCategory[] }> = {
  kurikulum_merdeka_ppksp: {
    label: 'Standar BK Kurikulum Merdeka & PPKSP (Permendikbudristek No. 46/2023)',
    description: 'Paling Direkomendasikan! Selaras dengan panduan BK terbaru, berfokus pada 6 bentuk kekerasan PPKSP, Disiplin Positif, dan Pendekatan Segitiga Restitusi edukatif.',
    categories: PRESET_KURIKULUM_MERDEKA_PPKSP
  },
  smp_mts: {
    label: 'Standar Nasional SMP / MTs (Kemdikbud & Kemenag)',
    description: 'Struktur komprehensif 5 kategori (Kedisiplinan, Kerapian, Perilaku, Akademik, Pelanggaran Berat). Cocok untuk jenjang sekolah menengah pertama.',
    categories: PRESET_SMP_MTS
  },
  sma_smk: {
    label: 'Standar SMA / SMK / MA',
    description: 'Struktur disesuaikan dengan lingkungan sekolah menengah atas, praktikum lab/bengkel, ketertiban motor, dan pergaulan remaja.',
    categories: PRESET_SMA_SMK
  },
  pesantren: {
    label: 'Standar Pesantren / Islamic Boarding School',
    description: 'Dilengkapi adab sholat berjamaah, tahfidz/halaqah, ketertiban asrama, ghosob, dan larangan gawai ilegal.',
    categories: PRESET_PESANTREN
  },
  sederhana: {
    label: 'Standar Sederhana (Ringan, Sedang, Berat)',
    description: 'Format ringkas 3 tingkatan bobot yang praktis dan fleksibel untuk sekolah skala kecil atau perintis.',
    categories: PRESET_SEDERHANA
  }
};

export const DEFAULT_VIOLATION_CATEGORIES = PRESET_KURIKULUM_MERDEKA_PPKSP;

/**
 * Terapkan konfigurasi panduan BK & PPKSP terbaru untuk sekolah aktif
 */
export function applyLatestBkGuideConfig(schoolId?: string): { count: number; presetKey: string } {
  const sId = schoolId || getActiveSchoolId();
  saveSchoolViolationCategories(PRESET_KURIKULUM_MERDEKA_PPKSP, sId);
  return {
    count: PRESET_KURIKULUM_MERDEKA_PPKSP.length,
    presetKey: 'kurikulum_merdeka_ppksp'
  };
}

/**
 * Get configured violation categories for a given school partition
 */
export function getSchoolViolationCategories(schoolId?: string): ViolationCategory[] {
  const sId = schoolId || getActiveSchoolId();
  const data = loadSchoolData<ViolationCategory[]>('bk_violation_rules', DEFAULT_VIOLATION_CATEGORIES, sId);
  if (Array.isArray(data) && data.length > 0) {
    return data;
  }
  return DEFAULT_VIOLATION_CATEGORIES;
}

/**
 * Save customized violation categories for a given school partition
 */
export function saveSchoolViolationCategories(categories: ViolationCategory[], schoolId?: string): void {
  const sId = schoolId || getActiveSchoolId();
  saveSchoolData('bk_violation_rules', categories, sId);

  // Dispatch custom event for UI reactivity
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('bk_violation_rules_changed', {
        detail: { schoolId: sId, categories }
      })
    );
  }

  // Also sync to Firestore under school settings asynchronously
  try {
    saveToFirestore('violation_rules', {
      id: 'custom_rules',
      categories,
      updatedAt: new Date().toISOString(),
      schoolId: sId
    }, sId).catch(err => console.warn('Could not sync violation rules to cloud:', err));
  } catch (e) {}
}

/**
 * Reset violation categories to a chosen preset
 */
export function resetSchoolViolationCategoriesToPreset(presetKey: string, schoolId?: string): ViolationCategory[] {
  const sId = schoolId || getActiveSchoolId();
  const selectedPreset = PRESET_MAP[presetKey]?.categories || DEFAULT_VIOLATION_CATEGORIES;
  saveSchoolViolationCategories(selectedPreset, sId);
  return selectedPreset;
}

/**
 * Export rules as formatted JSON for sharing with other schools
 */
export function exportViolationRulesJSON(categories: ViolationCategory[], schoolName?: string): string {
  const payload = {
    schemaVersion: '1.0',
    app: 'Sistem Administrasi BK - Buku Pedoman Tata Tertib & Bobot Pelanggaran',
    schoolName: schoolName || 'Sekolah Pengguna BK',
    exportedAt: new Date().toISOString(),
    totalCategories: categories.length,
    totalRules: categories.reduce((acc, cat) => acc + (cat.options?.length || 0), 0),
    categories
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Import rules from JSON string with strict validation
 */
export function importViolationRulesJSON(jsonStr: string): ViolationCategory[] | null {
  try {
    const parsed = JSON.parse(jsonStr);
    const rawCategories = Array.isArray(parsed) ? parsed : (parsed.categories || parsed.data);
    if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
      return null;
    }

    // Validate and sanitize each category
    const cleanCategories: ViolationCategory[] = rawCategories.map((c, catIdx) => {
      const catId = String(c.id || `kategori_${catIdx + 1}`).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const catName = String(c.name || c.kategori || `Kategori ${catIdx + 1}`).trim();
      const rawOptions = Array.isArray(c.options) ? c.options : (Array.isArray(c.subOptions) ? c.subOptions : []);
      
      const cleanOptions: ViolationOption[] = rawOptions.map((o: any, optIdx: number) => {
        const optId = String(o.id || `opt_${catIdx}_${optIdx + 1}`);
        const optLabel = String(o.label || o.nama || o.name || `Pelanggaran ${optIdx + 1}`).trim();
        const optPoints = Number(o.points ?? o.poin ?? o.bobot ?? 5) || 5;
        return {
          id: optId,
          label: optLabel,
          points: Math.max(1, Math.min(200, optPoints)),
          description: o.description ? String(o.description).trim() : undefined
        };
      });

      return {
        id: catId,
        name: catName,
        description: c.description ? String(c.description).trim() : undefined,
        color: c.color || 'emerald',
        options: cleanOptions
      };
    });

    return cleanCategories.length > 0 ? cleanCategories : null;
  } catch (err) {
    console.error('Failed to parse imported violation rules JSON:', err);
    return null;
  }
}
