export interface AppreciationOption {
  id: string;
  label: string;
  points: number;
}

export interface AppreciationCategory {
  id: string;
  name: string;
  options: AppreciationOption[];
}

export const APPRECIATION_TEMPLATES: AppreciationCategory[] = [
  {
    id: 'Akademik',
    name: 'Prestasi Akademik',
    options: [
      { id: 'ap1', label: 'Menjuarai lomba akademis tingkat sekolah / Kabupaten / Provinsi', points: 30 },
      { id: 'ap2', label: 'Meraih nilai harian tertinggi, nilai sempurna (100) atau peningkatan nilai rapor signifikan', points: 15 },
      { id: 'ap3', label: 'Menjadi tutor sebaya untuk membantu teman sekelas belajar secara berkala', points: 15 },
      { id: 'ap4', label: 'Menunjukkan kebiasaan membaca tinggi (literasi teraktif di perpustakaan)', points: 10 },
      { id: 'ap5', label: 'Juara kelas (peringkat 1, 2, atau 3) tingkat paralel / kelas', points: 25 },
      { id: 'ap_ak_6', label: 'Konsisten mengumpulkan tugas sekolah dengan lengkap dan tepat waktu', points: 10 }
    ]
  },
  {
    id: 'Olahraga & Seni',
    name: 'Prestasi Olahraga & Seni (Bakat/Minat)',
    options: [
      { id: 'ap6', label: 'Menjuarai kejuaraan olahraga resmi (O2SN, POPDA, klub daerah) mewakili sekolah', points: 30 },
      { id: 'ap7', label: 'Juara festival seni/budaya resmi (FLS2N, tari, lukis, menyanyi, musik) tingkat Kabupaten', points: 25 },
      { id: 'ap8', label: 'Aktif berkontribusi dan berdedikasi tinggi dalam kepengurusan ekstrakurikuler sekolah', points: 15 },
      { id: 'ap9', label: 'Menjadi petugas upacara bendera hari Senin atau hari besar nasional dengan sangat baik', points: 15 },
      { id: 'ap10', label: 'Menunjukkan sportivitas tinggi dan kontribusi aktif selama turnamen antar kelas (Classmeeting)', points: 10 }
    ]
  },
  {
    id: 'Kedisiplinan',
    name: 'Kedisiplinan, Kerapihan & Ketertiban',
    options: [
      { id: 'ap16', label: 'Kehadiran sempurna 100% (Tanpa Alpa/Sakit/Izin) selama satu semester penuh', points: 30 },
      { id: 'ap17', label: 'Menunjukkan komitmen perubahan perilaku yang sangat signifikan ke arah positif', points: 25 },
      { id: 'ap18', label: 'Selalu berpakaian rapi, bersih, berambut sesuai aturan, dan lengkap sebulan penuh', points: 15 },
      { id: 'ap19', label: 'Selalu hadir tepat waktu di sekolah (sebelum bel masuk) selama sebulan penuh', points: 15 },
      { id: 'ap20', label: 'Menjadi pelopor kedisiplinan dan mementingkan tata tertib di kelas', points: 10 }
    ]
  },
  {
    id: 'Sosial',
    name: 'Kepedulian Sosial & Karakter Mulia',
    options: [
      { id: 'ap11', label: 'Aksi kejujuran luar biasa (mengembalikan dompet/uang/barang berharga yang ditemukan)', points: 30 },
      { id: 'ap12', label: 'Membantu melerai konflik, pertikaian, atau kesalahpahaman antar rekan (Mediator Sebaya)', points: 20 },
      { id: 'ap13', label: 'Menolong teman yang sedang sakit, terluka, atau tertimpa musibah di sekolah', points: 15 },
      { id: 'ap14', label: 'Secara sukarela membantu guru, staf, atau tamu sekolah dengan sangat sopan', points: 10 },
      { id: 'ap15', label: 'Aktif menginisiasi atau berpartisipasi dalam aksi bakti sosial sekolah', points: 15 },
      { id: 'ap_kebersihan', label: 'Secara sukarela membantu menjaga kebersihan kelas, lingkungan sekolah, atau membuang sampah pada tempatnya (Membantu Kebersihan)', points: 10 }
    ]
  },
  {
    id: 'Keagamaan',
    name: 'Penguatan Karakter Keagamaan',
    options: [
      { id: 'ap21', label: 'Menjadi imam shalat berjamaah atau muadzin secara rutin di masjid sekolah', points: 15 },
      { id: 'ap22', label: 'Juara dalam lomba keagamaan (MTQ, khitobah, hafalan juz) mewakili sekolah', points: 25 },
      { id: 'ap23', label: 'Konsisten membantu menjaga kebersihan dan kesucian sarana ibadah sekolah', points: 10 },
      { id: 'ap24', label: 'Menunjukkan sikap toleransi yang tinggi dan menghargai keberagaman di sekolah', points: 15 }
    ]
  },
  {
    id: 'Kebersihan',
    name: 'Kebersihan & Lingkungan Sekolah',
    options: [
      { id: 'ap_kb_1', label: 'Secara sukarela membersihkan area kelas, taman, atau fasilitas umum sekolah', points: 15 },
      { id: 'ap_kb_2', label: 'Pelopor pemilahan sampah organik & anorganik serta pengolahan bank sampah sekolah', points: 20 },
      { id: 'ap_kb_3', label: 'Konsisten melaksanakan piket kelas dengan sangat bersih dan tepat waktu', points: 10 },
      { id: 'ap_kb_4', label: 'Inisiator kegiatan kerja bakti atau penghijauan lingkungan sekolah', points: 20 },
      { id: 'ap_kb_5', label: 'Menjaga kebersihan dan kerapian tempat wudhu / fasilitas sanitasi sekolah', points: 10 }
    ]
  }
];
