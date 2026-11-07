import { Student, ViolationRecord, CounselingService, ActivityLog, HomeVisitRecord, Counselor, ClassAttendanceRecord } from '../types';
import { CANONICAL_ATTENDANCE_HISTORY } from './canonicalAttendance';
import { CANONICAL_AULIA_STUDENTS } from './canonicalStudents';
import { CANONICAL_AULIA_VIOLATIONS, CANONICAL_AULIA_SERVICES, CANONICAL_AULIA_HOME_VISITS } from './canonicalAuliaData';
// @ts-ignore
import auliaAvatar from '../assets/images/aulia_aji_sasongko_1783735129196.jpg';

export const counselors: Counselor[] = [
  {
    id: 'c1',
    name: 'Aulia Aji Sasongko, S.Pd.',
    role: 'Koordinator BK & Administrator Sekolah',
    nip: 'NIP. 19931231 202221 1 002',
    avatar: auliaAvatar,
    allowedClasses: ['7A', '7B', '7C', '7D', '7E', '7F', '8A', '8B', '8C', '8D', '8E', '8F', '8G', '9A', '9B', '9C', '9D', '9E', '9F', '9G'],
    username: 'aulia',
    password: 'aulia',
    email: 'auliasasongko12@guru.smp.belajar.id',
    phone: '089681287339',
    schoolId: 'sch_20320123',
    schoolNpsn: '20320123',
    schoolName: 'SMP N 2 Susukan',
    approvalStatus: 'approved' as const
  },
  {
    id: 'admin',
    name: 'Admin Utama',
    role: 'Administrator BK (Akses Penuh)',
    nip: '-',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
    allowedClasses: [] as string[],
    username: 'admin',
    password: 'admin',
    email: 'admin.bk@smpn2susukan.sch.id',
    phone: '081234567800',
    schoolId: 'sch_20320123',
    schoolNpsn: '20320123',
    schoolName: 'SMP N 2 Susukan',
    approvalStatus: 'approved' as const
  },
  {
    id: 'c2',
    name: 'Nona Muanifah, S.Pd.',
    role: 'Guru Pembimbing Kelas 7',
    nip: 'NIP. 19950412 202312 2 003',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120',
    allowedClasses: ['7A', '7B', '7C', '7D', '7F'],
    username: 'nona',
    password: 'nona',
    email: 'nona.muanifah@guru.smp.belajar.id',
    phone: '081234567801',
    schoolId: 'sch_20320123',
    schoolNpsn: '20320123',
    schoolName: 'SMP N 2 Susukan',
    approvalStatus: 'approved' as const
  },
  {
    id: 'c3',
    name: 'Tri Juni Budiastuti, S.Pd.',
    role: 'Guru Pembimbing Kelas 9',
    nip: 'NIP. 19880615 201804 2 001',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=120',
    allowedClasses: ['9A', '9B', '9C', '9D', '9E', '9F', '9G'],
    username: 'tri',
    password: 'tri',
    email: 'tri.juni@guru.smp.belajar.id',
    phone: '081234567814',
    schoolId: 'sch_20320123',
    schoolNpsn: '20320123',
    schoolName: 'SMP N 2 Susukan',
    approvalStatus: 'approved' as const
  },
  {
    id: 'c4',
    name: 'Bina Saptarina, S.Pd.',
    role: 'Guru Pembimbing BK (Anggota)',
    nip: 'NIP. 19920814 202121 2 005',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120',
    allowedClasses: ['7A', '7B', '8A', '8B'],
    username: 'bina',
    password: 'bina',
    email: 'binasaptarina58@guru.sma.belajar.id',
    phone: '081234567815',
    schoolId: 'sch_20320123',
    schoolNpsn: '20320123',
    schoolName: 'SMP N 2 Susukan',
    approvalStatus: 'approved' as const
  }
];

export const initialStudents: Student[] = CANONICAL_AULIA_STUDENTS;

export const initialViolations: ViolationRecord[] = (CANONICAL_AULIA_VIOLATIONS as ViolationRecord[]) || [];

export const initialHomeVisits: HomeVisitRecord[] = (CANONICAL_AULIA_HOME_VISITS as HomeVisitRecord[]) || [];

export const initialServices: CounselingService[] = (CANONICAL_AULIA_SERVICES as CounselingService[]) || [];

export const initialLogs: ActivityLog[] = [
  {
    id: 'l1',
    timeLabel: 'HARI INI, 09:45',
    type: 'counseling',
    title: 'Konseling Individu',
    description: 'Sesi selesai dengan Rangga Wijaya (9B). Masalah: Penurunan motivasi belajar.',
    studentName: 'Rangga Wijaya',
    studentClass: 'Kelas 9B',
    timestamp: new Date(),
    schoolId: 'sch_20320123'
  },
  {
    id: 'l2',
    timeLabel: 'HARI INI, 08:30',
    type: 'violation',
    title: 'Pelanggaran Berat',
    description: 'Bagas Saputra (8A) dilaporkan membolos saat jam pelajaran ke-3.',
    studentName: 'Bagas Saputra',
    studentClass: 'Kelas 8A',
    timestamp: new Date(),
    schoolId: 'sch_20320123'
  },
  {
    id: 'l3',
    timeLabel: 'KEMARIN, 14:15',
    type: 'homevisit',
    title: 'Kunjungan Rumah (Home Visit)',
    description: 'Selesai mengunjungi rumah Lina Marlina (7A). Observasi lingkungan keluarga.',
    studentName: 'Lina Marlina',
    studentClass: 'Kelas 7A',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    schoolId: 'sch_20320123'
  }
];

export const initialAttendanceHistory: ClassAttendanceRecord[] = CANONICAL_ATTENDANCE_HISTORY;

