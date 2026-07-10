import { Student, ViolationRecord, CounselingService, ActivityLog } from '../types';

export const counselors = [
  {
    id: 'c1',
    name: 'Budi Santoso',
    role: 'Admin BK',
    nip: 'NIP. 19780512 200501 1 002',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAbyCEztjas0B6fzPhlxxPW674q_i9B22dl1_HRajxedeDmrH8s9O-PSWhEMd-2U--7_FYiSuW3Cah8W4DS6ihuH1lVGikTnZsgK-s_dMuaSAJlQ9-qE0X5o6gvsoTspQxMzo9W76Pcgpp93BUMK695Kxdrj5wmkPNHBtebKazOZkgrAcsPROhBAPy3UyE3-XB3fDY9juv1aSLaa5BXpHGmSrUoB_a4k25wxyDX1PasVhSqu00kSBVbtw'
  },
  {
    id: 'c2',
    name: 'Ibu Rahayu, S.Pd',
    role: 'Konselor Utama',
    nip: 'NIP. 19801124 200812 2 003',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDecBZojVXfJdloRQMziC1PPM9X9fh3fnAMBq4csnBMBKQDvWkjTfeXY2EkpvbBxb1_uQb80K1MEUOUJxJvV-W6F9aJ02eY-6kCk8rthRJo5juBGzWmyWjK2GsJkMdqsFW6gvPcVe9eH-zi52FVyh7FVi4kndyeqYvLC8JaJ8MuHGLvvYE355cMC-Y2qW1eAEeF5p906wAvw0cEk-NXLEkkaPaDEolvhDqh6bbKNy5o19YBRlrfOjfxMA'
  },
  {
    id: 'c3',
    name: 'Ibu Sarah, M.Psi',
    role: 'Guru Pembimbing',
    nip: 'NIP. 19820412 201004 2 005',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDVCDZkrFlYCBJ0511W59H1H-5eCc_szDmst-lR-uBhyTXGKBFOKMYgYH-B5rTdHVril8npUYMUBm-uSeUpdbemJYDlZkJ89gvBJUmiR9qoWfPTrRkOGp2i2udPHA4XR4Oy59lOtx8ory9SH_RT_zSCTnq0rqu_X9w6v9falv0ZKIj1sw_VdaE3XAjLCoozeTp2UjeU7H4e6T57twxqur-15MVbB9ic0aDKObSwrkmkoYC_kAOVNq_w1w'
  }
];

export const initialStudents: Student[] = [
  {
    id: 's1',
    nis: '21221001',
    name: 'Aditya Saputra',
    class: 'XI - MIPA 1',
    gender: 'L',
    violationPoints: 5,
    bkServicesCount: 1,
    initials: 'AS'
  },
  {
    id: 's2',
    nis: '21221042',
    name: 'Bela Mahendra',
    class: 'XI - IPS 2',
    gender: 'P',
    violationPoints: 45,
    bkServicesCount: 3,
    initials: 'BM'
  },
  {
    id: 's3',
    nis: '21221088',
    name: 'Raka Kurniawan',
    class: 'X - MIPA 4',
    gender: 'L',
    violationPoints: 120,
    bkServicesCount: 6,
    initials: 'RK'
  },
  {
    id: 's4',
    nis: '21221015',
    name: 'Aditya Pratama',
    class: 'Kelas 8A',
    gender: 'L',
    violationPoints: 85,
    bkServicesCount: 4,
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcTnvG2xde_HPbAheCM2JSQ5NLtoiw7V7E3SJ4FAAf86-dzFEwT0NhGYkH4xuXXSeAxaTqIWgbnvYSbWefJYYgFMfraz-nrcc8w4Agfv5LuFdh5I7AhkEM-j7M09PbeLunozNNmXA02-qAH57WHSeNEbDbjqRyxu4M2QWpg9g5svQ_ZTizxe6jfCMnpxd6KFOp-VnRJXLBhKuCoKW2mpugdYZRHYCbeHq3PZS7H4LNxzxdxYkGhn2vIg',
    initials: 'AP'
  },
  {
    id: 's5',
    nis: '21221024',
    name: 'Siti Aminah',
    class: 'Kelas 9C',
    gender: 'P',
    violationPoints: 62,
    bkServicesCount: 2,
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBlqeclHSMTBhK85RAVsyGF6VD6JqJphTmrWPk375dtCT7eMlgwpZzpdQ_5yXMBNcsamEyywwAldAjqwJVYry3GaQWT9anazCroE6h9mbOiUkxRAsJtsJBr7MNe1HrIzxe-RwdcpL9-kBKZrPX1KcUpsRp2DjQUa8CfHQZ0mt4vWNKLv4d_AYSNZta-VGW-jCTL0zTq8QdIN48OogLRVI7uYaVTuBnGA3DFoNdBil2uc8UwKSUiRvLZbQ',
    initials: 'SA'
  },
  {
    id: 's6',
    nis: '21221057',
    name: 'Rizky Ramadhan',
    class: 'Kelas 7E',
    gender: 'L',
    violationPoints: 48,
    bkServicesCount: 3,
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDoN6ZNbiwKQD-JFmhVEUKis1FG755y2XJikxanj_GWPmFDXEvepDJyduN17PH7LfXaia6x4iO1iiskoGVY1uAT_aAUFom7x7NkhnUBcnK6N6FGrf-TGaf9Y2HvNdrwgTaWPieRWbaqDuOslmiQiVFeZY6FLUlfNC5k-EPIXDgm9R8FRhs6E2nGdxMMu7sHJtMreHX2dvjRL_xZdL2VDixVq6DUgi86vGziXDH73zI0TCW2v4gSySetIQ',
    initials: 'RR'
  },
  {
    id: 's7',
    nis: '21221063',
    name: 'Rangga Wijaya',
    class: 'Kelas 9B',
    gender: 'L',
    violationPoints: 15,
    bkServicesCount: 5,
    initials: 'RW'
  },
  {
    id: 's8',
    nis: '21221033',
    name: 'Bagas Saputra',
    class: 'Kelas 8A',
    gender: 'L',
    violationPoints: 35,
    bkServicesCount: 2,
    initials: 'BS'
  },
  {
    id: 's9',
    nis: '21221094',
    name: 'Lina Marlina',
    class: 'Kelas 7A',
    gender: 'P',
    violationPoints: 24,
    bkServicesCount: 1,
    initials: 'LM'
  },
  {
    id: 's10',
    nis: '21221040',
    name: 'Siti Nurhaliza',
    class: 'XI - MIPA 1',
    gender: 'P',
    violationPoints: 0,
    bkServicesCount: 2,
    initials: 'SN'
  },
  {
    id: 's11',
    nis: '21221102',
    name: 'Bagus Nugroho',
    class: 'Kelas X-IPS-3',
    gender: 'L',
    violationPoints: 12,
    bkServicesCount: 0,
    initials: 'BN'
  },
  {
    id: 's12',
    nis: '21221145',
    name: 'Dimas Setiawan',
    class: 'Kelas X-IPS-3',
    gender: 'L',
    violationPoints: 18,
    bkServicesCount: 1,
    initials: 'DS'
  }
];

export const initialViolations: ViolationRecord[] = [
  {
    id: 'v1',
    ticketId: 'PLG-2023-089',
    studentId: 's4',
    studentName: 'Aditya Pratama',
    studentClass: 'Kelas 8A',
    category: 'Perilaku',
    pointsAdded: 25,
    date: '2026-07-10',
    time: '08:30',
    location: 'Kantin',
    reportedBy: 'Ibu Rahayu, S.Pd',
    notes: 'Siswa terlibat perkelahian ringan dengan siswa kelas lain setelah jam istirahat.'
  },
  {
    id: 'v2',
    ticketId: 'PLG-2023-090',
    studentId: 's8',
    studentName: 'Bagas Saputra',
    studentClass: 'Kelas 8A',
    category: 'Kedisiplinan',
    pointsAdded: 15,
    date: '2026-07-10',
    time: '08:30',
    location: 'Halaman Belakang',
    reportedBy: 'Budi Santoso',
    notes: 'Melanggar aturan sekolah dengan membolos di jam pelajaran ke-3.'
  },
  {
    id: 'v3',
    ticketId: 'PLG-2023-087',
    studentId: 's3',
    studentName: 'Raka Kurniawan',
    studentClass: 'X - MIPA 4',
    category: 'Perilaku',
    pointsAdded: 50,
    date: '2026-07-09',
    time: '11:15',
    location: 'Luar Sekolah',
    reportedBy: 'Ibu Sarah, M.Psi',
    notes: 'Ketahuan merokok di luar sekolah saat masih menggunakan seragam lengkap.'
  }
];

export const initialServices: CounselingService[] = [
  {
    id: 'srv1',
    serviceType: 'Konseling Individu',
    students: [
      { id: 's7', name: 'Rangga Wijaya', class: 'Kelas 9B', nis: '21221063' }
    ],
    problem: 'Penurunan motivasi belajar',
    description: 'Siswa mengalami penurunan nilai akademik drastis dalam 2 bulan terakhir. Setelah digali, terdapat masalah kelelahan akibat membantu usaha keluarga di malam hari.',
    output: 'Siswa sepakat membagi waktu belajar lebih teratur dan orang tua akan dihubungi untuk memberikan batasan jam kerja bantu.',
    followUp: 'Membuat jadwal harian baru dan memantau perkembangannya minggu depan.',
    status: 'Selesai',
    date: '2026-07-10',
    startTime: '09:00',
    endTime: '09:45',
    attachments: []
  },
  {
    id: 'srv2',
    serviceType: 'Home Visit',
    students: [
      { id: 's9', name: 'Lina Marlina', class: 'Kelas 7A', nis: '21221094' }
    ],
    problem: 'Sering absen tanpa keterangan',
    description: 'Melakukan kunjungan ke rumah tinggal Lina untuk mengetahui alasan sering tidak masuk sekolah (3 hari berturut-turut tanpa surat).',
    output: 'Bertemu dengan ibunda Lina. Diketahui Lina membantu merawat neneknya yang sakit keras. Hubungan keluarga sangat hangat namun terkendala ekonomi.',
    followUp: 'Guru BK mengusulkan bantuan beasiswa sosial sekolah agar Lina bisa terus bersekolah dengan fokus.',
    status: 'Selesai',
    date: '2026-07-09',
    startTime: '13:00',
    endTime: '14:15',
    attachments: [
      { name: 'surat_panggilan_001.pdf', size: '1.2 MB' }
    ]
  },
  {
    id: 'srv3',
    serviceType: 'Konseling Individu',
    students: [
      { id: 's4', name: 'Aditya Pratama', class: 'Kelas 8A', nis: '21221015' },
      { id: 's10', name: 'Siti Nurhaliza', class: 'XI - MIPA 1', nis: '21221040' }
    ],
    problem: 'Konsultasi minat bakat penjurusan',
    description: 'Sesi konsultasi kelompok kecil mengenai pilihan karir lanjutan dan keselarasan dengan mata pelajaran pilihan.',
    output: 'Siswa mendapatkan pandangan yang lebih terarah mengenai program studi perguruan tinggi yang cocok.',
    followUp: 'Pemberian brosur pendaftaran tes minat bakat mandiri.',
    status: 'Terjadwal',
    date: '2026-07-12',
    startTime: '10:00',
    endTime: '11:00',
    attachments: []
  }
];

export const initialLogs: ActivityLog[] = [
  {
    id: 'l1',
    timeLabel: 'HARI INI, 09:45',
    type: 'counseling',
    title: 'Konseling Individu',
    description: 'Sesi selesai dengan Rangga Wijaya (9B). Masalah: Penurunan motivasi belajar.',
    studentName: 'Rangga Wijaya',
    studentClass: 'Kelas 9B',
    timestamp: new Date()
  },
  {
    id: 'l2',
    timeLabel: 'HARI INI, 08:30',
    type: 'violation',
    title: 'Pelanggaran Berat',
    description: 'Bagas Saputra (8A) dilaporkan membolos saat jam pelajaran ke-3.',
    studentName: 'Bagas Saputra',
    studentClass: 'Kelas 8A',
    timestamp: new Date()
  },
  {
    id: 'l3',
    timeLabel: 'KEMARIN, 14:15',
    type: 'homevisit',
    title: 'Kunjungan Rumah (Home Visit)',
    description: 'Selesai mengunjungi rumah Lina Marlina (7A). Observasi lingkungan keluarga.',
    studentName: 'Lina Marlina',
    studentClass: 'Kelas 7A',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000)
  }
];
