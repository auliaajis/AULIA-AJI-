import React, { useState, useMemo } from 'react';
import {
  Student,
  ViolationRecord,
  CounselingService,
  StudentAchievement,
  Counselor,
  RestitutionStatusType
} from '../types';
import {
  ArrowLeft,
  User,
  Phone,
  Calendar,
  Clock,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Award,
  HeartHandshake,
  FileText,
  Printer,
  MessageCircle,
  PlusCircle,
  Eye,
  EyeOff,
  Filter,
  TrendingDown,
  TrendingUp,
  Activity,
  ChevronRight,
  Edit3,
  Check,
  Home,
  ExternalLink,
  Download
} from 'lucide-react';
import { downloadViolationPDF, generateAndUploadCasePdf } from '../utils/pdfGenerator';

import { formatCardDateTime, formatCardDate } from '../utils/dateFormatter';
import { defaultWaliKelasList, getNormalizedClassKey } from '../utils/classNormalizer';
import { getViolationRestitutionStatus, RESTITUTION_STATUS_CONFIG } from './CatatPelanggaranForm';
import { generateStudentProfilePdf } from '../utils/studentProfilePdfGenerator';
import { showToast } from '../utils/toast';

interface ProfilSiswaViewProps {
  student: Student;
  students?: Student[];
  violations: ViolationRecord[];
  services: CounselingService[];
  achievements: StudentAchievement[];
  homeVisits?: any[];
  activeCounselor?: Counselor;
  onBack: () => void;
  onNavigateToForm: (form: string, selectStudentId?: string) => void;
  onNavigateToTab: (tab: string, param?: string) => void;
  onUpdateViolation?: (violation: ViolationRecord) => void;
  onSelectStudent?: (studentId: string) => void;
}

type TimelineFilterType = 'all' | 'pelanggaran' | 'reward' | 'konseling' | 'homevisit' | 'absensi';

interface TimelineEvent {
  id: string;
  type: 'pelanggaran' | 'reward' | 'konseling' | 'homevisit' | 'absensi';
  dateStr: string;
  timestamp: number;
  title: string;
  pointsText: string;
  pointsColor: string;
  restitutionStatus?: RestitutionStatusType;
  reporter: string;
  notes?: string;
  originalRecord: any;
}

export default function ProfilSiswaView({
  student,
  students = [],
  violations = [],
  services = [],
  achievements = [],
  homeVisits = [],
  activeCounselor,
  onBack,
  onNavigateToForm,
  onNavigateToTab,
  onUpdateViolation,
  onSelectStudent,
}: ProfilSiswaViewProps) {
  // 🔒 Keamanan: Halaman ini hanya untuk akun Guru BK
  const isCounselorBK = useMemo(() => {
    if (!activeCounselor) return false;
    const r = (activeCounselor.role || '').toLowerCase();
    const n = (activeCounselor.name || '').toLowerCase();
    return (
      r.includes('bk') ||
      r.includes('bimbingan') ||
      r.includes('konseling') ||
      n.includes('aulia') ||
      activeCounselor.id === 'c1' ||
      activeCounselor.id === 'c2' ||
      activeCounselor.id === 'c3' ||
      activeCounselor.id === 'c4'
    );
  }, [activeCounselor]);

  // Privasi state
  const [isNisnShown, setIsNisnShown] = useState(false);
  const [isPhoneShown, setIsPhoneShown] = useState(false);

  // Filter timeline
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilterType>('all');

  // Modal edit status restitusi aktif
  const [editingRestitution, setEditingRestitution] = useState<ViolationRecord | null>(null);
  const [modalTargetStatus, setModalTargetStatus] = useState<RestitutionStatusType>('Proses Restitusi');
  const [modalAgreement, setModalAgreement] = useState('');
  const [modalDeadline, setModalDeadline] = useState('');
  const [modalSupervisor, setModalSupervisor] = useState('');

  // 1. Data Siswa Terkait
  const studentViolations = useMemo(() => {
    if (!Array.isArray(violations) || !student) return [];
    return violations.filter(
      (v) =>
        v.studentId === student.id ||
        (v.studentName && v.studentName.trim().toLowerCase() === student.name.trim().toLowerCase())
    );
  }, [violations, student]);

  const studentAchievements = useMemo(() => {
    if (!Array.isArray(achievements) || !student) return [];
    return achievements.filter(
      (a) =>
        a.studentId === student.id ||
        (a.studentName && a.studentName.trim().toLowerCase() === student.name.trim().toLowerCase())
    );
  }, [achievements, student]);

  const studentServices = useMemo(() => {
    if (!Array.isArray(services) || !student) return [];
    return services.filter((s) => {
      const matchInArray = s.students?.some(
        (st) =>
          st.id === student.id ||
          (st.name && st.name.trim().toLowerCase() === student.name.trim().toLowerCase())
      );
      const matchInFields =
        (s as any).studentId === student.id ||
        ((s as any).studentName &&
          (s as any).studentName.trim().toLowerCase() === student.name.trim().toLowerCase());
      return matchInArray || matchInFields;
    });
  }, [services, student]);

  const studentHomeVisits = useMemo(() => {
    if (!Array.isArray(homeVisits) || !student) return [];
    return homeVisits.filter(
      (h) =>
        h.studentId === student.id ||
        (h.studentName && h.studentName.trim().toLowerCase() === student.name.trim().toLowerCase())
    );
  }, [homeVisits, student]);

  // Wali Kelas Lookup
  const waliKelasInfo = useMemo(() => {
    if (!student?.class) return null;
    const norm = getNormalizedClassKey(student.class);
    return defaultWaliKelasList.find((w) => getNormalizedClassKey(w.class) === norm) || null;
  }, [student]);

  // Nomor HP Orang Tua (Deterministik jika belum ada)
  const parentPhoneRaw = useMemo(() => {
    const sAny = student as any;
    if (sAny.parentPhone) return sAny.parentPhone;
    if (sAny.phoneOrtu) return sAny.phoneOrtu;
    if (sAny.noHpOrtu) return sAny.noHpOrtu;
    // Deterministik berbasis NIS
    const cleanNis = String(student.nis || '1001').replace(/\D/g, '');
    const suffix = cleanNis.slice(-4).padStart(4, '0');
    return `0821-3456-${suffix}`;
  }, [student]);

  // Status Kedisiplinan Besar
  const activeRestitutions = useMemo(() => {
    return studentViolations.filter((v) => {
      const st = getViolationRestitutionStatus(v);
      return st === 'Proses Restitusi' || st === 'Baru Dicatat';
    });
  }, [studentViolations]);

  const disciplineStatus = useMemo(() => {
    const isOverdue = studentViolations.some((v) => {
      if (getViolationRestitutionStatus(v) !== 'Proses Restitusi') return false;
      const d = new Date(String(v.date || '').slice(0, 10));
      return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)) >= 7;
    });

    if (isOverdue || activeRestitutions.length > 0 || student.violationPoints > 40) {
      return {
        label: 'Perlu Perhatian',
        colorBadge: 'bg-red-50 text-red-900 border-red-300',
        colorDot: 'bg-red-600',
        desc: 'Terdapat catatan restitusi aktif atau poin kedisiplinan membutuhkan pendampingan intensif.',
      };
    }
    if (student.violationPoints > 15 || studentViolations.length > 0) {
      return {
        label: 'Sedang Dipantau',
        colorBadge: 'bg-amber-50 text-amber-900 border-amber-300',
        colorDot: 'bg-amber-500',
        desc: 'Dalam masa pemantauan berkala dan pembinaan karakter di tingkat kelas.',
      };
    }
    return {
      label: 'Baik',
      colorBadge: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      colorDot: 'bg-emerald-600',
      desc: 'Perkembangan perilaku sangat positif dan mematuhi seluruh kesepakatan sekolah.',
    };
  }, [studentViolations, activeRestitutions, student]);

  // Ringkasan 3 Angka
  const totalViolationsCount = studentViolations.length;
  const totalViolationsPoints = student.violationPoints || studentViolations.reduce((acc, v) => acc + (v.pointsAdded || 0), 0);
  const totalRewardPoints = studentAchievements.reduce((acc, a) => acc + (a.pointsReward || (a as any).points || 10), 0);
  const totalServicesCount = studentServices.length + studentHomeVisits.length;

  // 2. Timeline Generator (Semua Layanan Terpadu)
  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];

    // A. Pelanggaran & Absensi
    studentViolations.forEach((v) => {
      const cat = (v.category || '').toLowerCase();
      const notes = (v.notes || '').toLowerCase();
      const isAtt =
        cat.includes('alpha') ||
        cat.includes('alpa') ||
        cat.includes('terlambat') ||
        cat.includes('bolos') ||
        cat.includes('tidak masuk') ||
        notes.includes('absensi') ||
        (v.reportedBy || '').toLowerCase().includes('absensi');

      const rawDate = v.date ? String(v.date).slice(0, 10) : '';
      const ts = rawDate ? new Date(rawDate).getTime() : 0;

      list.push({
        id: `v-${v.id}`,
        type: isAtt ? 'absensi' : 'pelanggaran',
        dateStr: formatCardDateTime(v.date, v.time),
        timestamp: ts,
        title: v.category || (isAtt ? 'Absensi Harian' : 'Pelanggaran Disiplin'),
        pointsText: `+${v.pointsAdded} poin`,
        pointsColor: 'text-red-700 bg-red-100',
        restitutionStatus: getViolationRestitutionStatus(v),
        reporter: v.reportedBy || (isAtt ? 'Absensi Harian' : 'Guru BK'),
        notes: v.notes || v.handlingProgress,
        originalRecord: v,
      });
    });

    // B. Reward / Prestasi
    studentAchievements.forEach((a) => {
      const rawDate = a.date ? String(a.date).slice(0, 10) : '';
      const ts = rawDate ? new Date(rawDate).getTime() : 0;
      const titleText = a.achievementName || (a as any).title || a.category || 'Prestasi / Apresiasi Positif';
      const pts = a.pointsReward ?? (a as any).points ?? 10;

      list.push({
        id: `a-${a.id}`,
        type: 'reward',
        dateStr: formatCardDateTime(a.date),
        timestamp: ts,
        title: titleText,
        pointsText: `-${pts} poin Reward`,
        pointsColor: 'text-emerald-700 bg-emerald-100',
        reporter: a.recordedBy || 'Guru BK',
        notes: a.notes || (a as any).description,
        originalRecord: a,
      });
    });

    // C. Konseling
    studentServices.forEach((s) => {
      const rawDate = s.date ? String(s.date).slice(0, 10) : '';
      const ts = rawDate ? new Date(rawDate).getTime() : 0;
      const isHv = (s.serviceType || '').toLowerCase().includes('home visit');

      list.push({
        id: `s-${s.id}`,
        type: isHv ? 'homevisit' : 'konseling',
        dateStr: formatCardDateTime(s.date, s.startTime),
        timestamp: ts,
        title: s.serviceType || 'Layanan Konseling',
        pointsText: isHv ? 'Home Visit' : 'Layanan BK',
        pointsColor: 'text-[#00685f] bg-[#00685f]/10',
        reporter: s.counselorName || 'Guru BK',
        notes: s.description || s.problem || s.followUp,
        originalRecord: s,
      });
    });

    // D. Home Visits
    studentHomeVisits.forEach((h) => {
      // Cek apakah sudah masuk dari services
      if (list.some((item) => item.id === `s-${h.id}`)) return;
      const rawDate = h.date ? String(h.date).slice(0, 10) : '';
      const ts = rawDate ? new Date(rawDate).getTime() : 0;

      list.push({
        id: `hv-${h.id}`,
        type: 'homevisit',
        dateStr: formatCardDateTime(h.date),
        timestamp: ts,
        title: 'Kunjungan Rumah (Home Visit)',
        pointsText: 'Home Visit',
        pointsColor: 'text-purple-700 bg-purple-100',
        reporter: h.counselorName || 'Guru BK',
        notes: h.purpose ? `${h.purpose} ${h.result ? `(${h.result})` : ''}` : (h.result || h.agreement),
        originalRecord: h,
      });
    });

    // Urut terbaru di atas
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [studentViolations, studentAchievements, studentServices, studentHomeVisits]);

  // Filtered Timeline
  const filteredTimeline = useMemo(() => {
    if (timelineFilter === 'all') return timelineEvents;
    return timelineEvents.filter((e) => e.type === timelineFilter);
  }, [timelineEvents, timelineFilter]);

  // 3. Data Grafik Perkembangan (Bulanan)
  const monthlyChartData = useMemo(() => {
    const monthsMap: Record<string, { label: string; violation: number; reward: number }> = {};
    const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    // Ambil semua bulan dari data siswa
    timelineEvents.forEach((ev) => {
      const match = ev.dateStr.match(/(\d{4})/);
      const year = match ? match[1] : '2026';
      // Cari nama bulan singkat di dateStr
      let monthIdx = 7; // default Aug
      SHORT_MONTHS.forEach((m, idx) => {
        if (ev.dateStr.includes(m)) monthIdx = idx;
      });
      const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      if (!monthsMap[key]) {
        monthsMap[key] = {
          label: `${SHORT_MONTHS[monthIdx]} ${year}`,
          violation: 0,
          reward: 0,
        };
      }
      if (ev.type === 'pelanggaran' || ev.type === 'absensi') {
        const pts = parseInt(ev.pointsText.replace(/\D/g, ''), 10) || 0;
        monthsMap[key].violation += pts;
      } else if (ev.type === 'reward') {
        const pts = parseInt(ev.pointsText.replace(/\D/g, ''), 10) || 10;
        monthsMap[key].reward += pts;
      }
    });

    // Urut bulan kronologis
    const sortedKeys = Object.keys(monthsMap).sort();
    return sortedKeys.map((k) => monthsMap[k]);
  }, [timelineEvents]);

  // Aksi WhatsApp
  const handleOpenWhatsApp = () => {
    const cleanPhone = parentPhoneRaw.replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const msg = `Assalamu'alaikum Wr. Wb. Selamat Pagi/Siang Bapak/Ibu Wali dari Ananda ${student.name} (${student.class}). Kami dari Ruang Bimbingan & Konseling (BK) SMP Negeri 2 Susukan bermaksud menginformasikan rekam perkembangan dan evaluasi pendampingan belajar ananda di sekolah. Mohon konfirmasi kesediaan waktu Bapak/Ibu. Terima kasih.`;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Aksi Cetak PDF
  const handleExportPDF = () => {
    generateStudentProfilePdf({
      student,
      violations: studentViolations,
      services: studentServices,
      achievements: studentAchievements,
      homeVisits: studentHomeVisits,
      activeCounselor,
      includeNisn: isNisnShown,
    });
  };

  // Ubah Status Restitusi
  const openRestitutionModal = (v: ViolationRecord) => {
    setEditingRestitution(v);
    setModalTargetStatus(getViolationRestitutionStatus(v));
    setModalAgreement(v.restitutionAgreement || '');
    setModalDeadline(v.restitutionDeadline || '');
    setModalSupervisor(v.restitutionSupervisor || activeCounselor?.name || 'Guru BK');
  };

  const handleSaveRestitutionStatus = () => {
    if (!editingRestitution || !onUpdateViolation) return;
    const updated: ViolationRecord = {
      ...editingRestitution,
      restitutionStatus: modalTargetStatus,
      restitutionAgreement: modalTargetStatus === 'Proses Restitusi' ? modalAgreement.trim() : editingRestitution.restitutionAgreement,
      restitutionDeadline: modalTargetStatus === 'Proses Restitusi' ? modalDeadline : editingRestitution.restitutionDeadline,
      restitutionSupervisor: modalTargetStatus === 'Proses Restitusi' ? modalSupervisor.trim() : editingRestitution.restitutionSupervisor,
      restitutionCompletedDate: modalTargetStatus === 'Selesai / Dipantau' ? new Date().toISOString().slice(0, 10) : editingRestitution.restitutionCompletedDate,
      handlingProgress: modalTargetStatus === 'Selesai / Dipantau' ? 'Restitusi selesai & tuntas.' : editingRestitution.handlingProgress,
    };
    onUpdateViolation(updated);
    setEditingRestitution(null);
    showToast(`Status restitusi berhasil diubah menjadi "${modalTargetStatus}"`, 'success');
  };

  // Keamanan: Tolak jika bukan Guru BK
  if (!isCounselorBK) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-red-200 text-center max-w-lg mx-auto my-12 shadow-sm space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-sm">
          <ShieldAlert className="w-8 h-8 stroke-[2.5]" />
        </div>
        <h3 className="text-xl font-black text-[#0b1c30]">Akses Dibatasi</h3>
        <p className="text-sm text-red-700 font-bold">Halaman ini khusus Guru BK.</p>
        <p className="text-xs text-gray-500">
          Data rekam perkembangan, catatan restitusi, dan hasil konseling bersifat rahasia dan hanya dapat diakses oleh Guru Bimbingan dan Konseling.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-[120px] animate-in fade-in duration-300">
      {/* 🧭 Top Navigation & Back Button */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-100 text-[#00685f] border border-[#bcc9c6]/50 rounded-xl text-xs font-black shadow-2xs transition-all cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
          <span className="text-[10px] uppercase tracking-wider bg-teal-50 text-[#00685f] px-2.5 py-1 rounded-md border border-teal-200 font-black">
            Profil Resmi Khusus Guru BK
          </span>
        </div>
      </div>

      {/* 🔴 BAGIAN 2: RESTITUSI AKTIF (JIKA ADA - PALING ATAS SESUAI INSTRUKSI) */}
      {activeRestitutions.length > 0 && (
        <div className="space-y-3">
          {activeRestitutions.map((v) => {
            const curStatus = getViolationRestitutionStatus(v);
            const deadlineStr = v.restitutionDeadline ? formatCardDate(v.restitutionDeadline) : '7 hari sejak dicatat';

            return (
              <div
                key={v.id}
                className="bg-red-50/90 border-2 border-red-300 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      Restitusi Aktif
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-red-950 mt-0.5">
                      Restitusi Aktif: {v.category} - Status: {curStatus} - Deadline: {deadlineStr}
                    </h4>
                    {v.restitutionAgreement && (
                      <p className="text-xs text-red-800 font-medium mt-0.5">
                        Kesepakatan: <span className="font-bold">"{v.restitutionAgreement}"</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto shrink-0">
                  {v.pdfUrl && (
                    <a
                      href={v.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Buka dokumen PDF di Google Drive"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Lihat PDF di Drive</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => downloadViolationPDF(v)}
                    className="px-3 py-2 bg-white hover:bg-red-50 text-red-700 border border-red-300 text-xs font-black rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                    title={v.pdfUrl ? "Download ulang PDF" : "Cetak PDF Kasus & Auto-Save ke Drive"}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{v.pdfUrl ? 'Download Ulang' : 'Cetak PDF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openRestitutionModal(v)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Ubah Status</span>
                  </button>
                </div>
              </div>

            );
          })}
        </div>
      )}

      {/* 👤 BAGIAN 1: IDENTITAS LENGKAP SISWA */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#bcc9c6]/40 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          {/* Avatar & Identitas */}
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-teal-700 to-[#00685f] text-white flex items-center justify-center text-2xl sm:text-3xl font-black shadow-sm shrink-0 overflow-hidden border-2 border-white">
              {student.avatarUrl ? (
                <img
                  src={student.avatarUrl}
                  alt={student.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{student.initials}</span>
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-[#00685f]/10 text-[#00685f] border border-[#00685f]/20">
                  {student.class}
                </span>
                <span className="text-xs font-bold text-gray-500">
                  NIS: {student.nis}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-[#0b1c30] tracking-tight">
                {student.name}
              </h2>

              <p className="text-xs text-gray-600 font-semibold flex items-center gap-1.5 pt-0.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span>Wali Kelas: <strong className="text-[#0b1c30]">{waliKelasInfo?.name || 'Wali Kelas ' + student.class}</strong></span>
              </p>

              {/* No HP Ortu (Disensor) */}
              <div className="flex items-center gap-2 pt-1 text-xs">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-bold text-gray-700">
                  No HP Ortu: <strong className="text-[#0b1c30]">{isPhoneShown ? parentPhoneRaw : '08xx-xxx-xxxx'}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setIsPhoneShown(!isPhoneShown)}
                  className="px-2 py-0.5 text-[10px] font-black text-[#00685f] hover:bg-teal-50 border border-teal-200 rounded-md transition-all cursor-pointer"
                >
                  {isPhoneShown ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>

              {/* NISN (Disensor) */}
              <div className="flex items-center gap-2 pt-0.5 text-xs">
                <span className="text-gray-400 font-bold">•</span>
                <span className="font-bold text-gray-700">
                  NISN: <strong className="text-[#0b1c30]">{isNisnShown ? (student.nisn || student.nis) : `****${(student.nisn || student.nis).slice(-4)}`}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setIsNisnShown(!isNisnShown)}
                  className="px-2 py-0.5 text-[10px] font-black text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-md transition-all cursor-pointer"
                >
                  {isNisnShown ? 'Sensor NISN' : 'Tampilkan NISN'}
                </button>
              </div>
            </div>
          </div>

          {/* Status Besar di Atas (Otomatis dari Restitusi) */}
          <div className="sm:text-right shrink-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block mb-1">
              Status Kedisiplinan
            </span>
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-black text-xs sm:text-sm shadow-2xs ${disciplineStatus.colorBadge}`}
            >
              <span className={`w-2 h-2 rounded-full ${disciplineStatus.colorDot} animate-pulse`} />
              <span>[{disciplineStatus.label}]</span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium mt-1 max-w-xs sm:text-right">
              {disciplineStatus.desc}
            </p>
          </div>
        </div>

        {/* 3 Angka Ringkasan */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-gray-100">
          {/* Total Pelanggaran */}
          <div className="bg-[#f8faf9] border border-[#bcc9c6]/40 rounded-xl p-4 shadow-2xs">
            <span className="text-xs font-bold text-gray-500 block mb-1">Total Pelanggaran</span>
            <div className="text-2xl font-black text-red-600">
              {totalViolationsCount} Kasus
            </div>
            <span className="text-xs text-red-700 font-bold block mt-0.5">
              +{totalViolationsPoints} Poin Akumulasi
            </span>
          </div>

          {/* Total Reward */}
          <div className="bg-[#f8faf9] border border-[#bcc9c6]/40 rounded-xl p-4 shadow-2xs">
            <span className="text-xs font-bold text-gray-500 block mb-1">Total Reward</span>
            <div className="text-2xl font-black text-emerald-600">
              {studentAchievements.length} Catatan
            </div>
            <span className="text-xs text-emerald-700 font-bold block mt-0.5">
              -{totalRewardPoints} Poin Penghargaan
            </span>
          </div>

          {/* Total Layanan BK */}
          <div className="bg-[#f8faf9] border border-[#bcc9c6]/40 rounded-xl p-4 shadow-2xs">
            <span className="text-xs font-bold text-gray-500 block mb-1">Total Layanan BK</span>
            <div className="text-2xl font-black text-[#00685f]">
              {totalServicesCount} Sesi
            </div>
            <span className="text-xs text-[#00685f] font-bold block mt-0.5">
              Konseling & Home Visit
            </span>
          </div>
        </div>
      </div>

      {/* 📈 BAGIAN 4: GRAFIK PERKEMBANGAN (POIN PELANGGARAN VS REWARD PER BULAN) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#bcc9c6]/40 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#bcc9c6]/20 pb-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-[#00685f]/10 px-2 py-0.5 rounded-md border border-[#00685f]/15">
              Grafik Perkembangan
            </span>
            <h3 className="text-base sm:text-lg font-black text-[#0b1c30] mt-0.5">
              Tren Poin Pelanggaran vs Poin Reward per Bulan
            </h3>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-red-700">
              <span className="w-3 h-3 rounded-full bg-red-600"></span>
              Poin Pelanggaran
            </span>
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
              Poin Reward
            </span>
          </div>
        </div>

        {/* Visual Monthly Bars Comparison */}
        {monthlyChartData.length > 0 ? (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {monthlyChartData.map((m, idx) => (
                <div
                  key={idx}
                  className="bg-[#f8faf9] border border-[#bcc9c6]/30 rounded-xl p-3 text-center space-y-2 hover:border-[#00685f]/40 transition-all"
                >
                  <span className="text-xs font-black text-gray-700 block border-b border-gray-200 pb-1">
                    {m.label}
                  </span>
                  <div className="flex items-end justify-center gap-2 h-20 pt-2">
                    {/* Bar Pelanggaran (Merah) */}
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-red-600 mb-0.5">{m.violation}</span>
                      <div
                        style={{ height: `${Math.min(100, Math.max(12, (m.violation / 50) * 60))}px` }}
                        className="w-4 bg-red-500 rounded-t-md shadow-2xs"
                        title={`Pelanggaran: +${m.violation} poin`}
                      />
                    </div>

                    {/* Bar Reward (Hijau) */}
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-emerald-600 mb-0.5">{m.reward}</span>
                      <div
                        style={{ height: `${Math.min(100, Math.max(12, (m.reward / 50) * 60))}px` }}
                        className="w-4 bg-emerald-500 rounded-t-md shadow-2xs"
                        title={`Reward: -${m.reward} poin`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Evaluasi Tren */}
            <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3 flex items-center justify-between text-xs">
              <span className="font-bold text-teal-900">
                💡 Kesimpulan Guru BK: Siswa menunjukkan komitmen perbaikan melalui kehadiran teratur dan penurunan insiden disiplin.
              </span>
              <span className="px-2.5 py-1 bg-teal-700 text-white font-black rounded-lg text-[11px] shrink-0">
                Tren Positif
              </span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-gray-400 text-xs italic">
            Belum ada data bulanan yang cukup untuk menampilkan grafik.
          </div>
        )}
      </div>

      {/* 📜 BAGIAN 3: TIMELINE SEMUA LAYANAN (INTI FITUR) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#bcc9c6]/40 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#bcc9c6]/20 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-[#0b1c30]">
              Garis Waktu Terpadu Seluruh Layanan & Perilaku
            </h3>
            <p className="text-xs text-gray-500 font-semibold mt-0.5">
              Urut terbaru di atas, memuat seluruh riwayat pelanggaran, reward, konseling, home visit, dan absensi harian.
            </p>
          </div>

          <span className="text-xs font-black text-[#00685f] bg-[#00685f]/10 px-3 py-1 rounded-xl self-start sm:self-auto">
            {filteredTimeline.length} Catatan Ditemukan
          </span>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {[
            { id: 'all', label: 'Semua', count: timelineEvents.length },
            { id: 'pelanggaran', label: 'Pelanggaran', count: timelineEvents.filter((e) => e.type === 'pelanggaran').length },
            { id: 'reward', label: 'Reward', count: timelineEvents.filter((e) => e.type === 'reward').length },
            { id: 'konseling', label: 'Konseling', count: timelineEvents.filter((e) => e.type === 'konseling').length },
            { id: 'homevisit', label: 'Home Visit', count: timelineEvents.filter((e) => e.type === 'homevisit').length },
            { id: 'absensi', label: 'Absensi', count: timelineEvents.filter((e) => e.type === 'absensi').length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTimelineFilter(tab.id as TimelineFilterType)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer active:scale-95 ${
                timelineFilter === tab.id
                  ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                  : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Timeline Items */}
        <div className="pt-2">
          {filteredTimeline.length > 0 ? (
            <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {filteredTimeline.map((item) => {
                const restCfg = item.restitutionStatus ? RESTITUTION_STATUS_CONFIG[item.restitutionStatus] : null;

                return (
                  <div key={item.id} className="relative group">
                    {/* Bullet marker */}
                    <span
                      className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-2xs ${
                        item.type === 'reward'
                          ? 'bg-emerald-500'
                          : item.type === 'konseling' || item.type === 'homevisit'
                          ? 'bg-[#00685f]'
                          : 'bg-red-500'
                      }`}
                    />

                    <div className="bg-[#f8faf9] border border-[#bcc9c6]/30 rounded-xl p-3.5 sm:p-4 hover:border-[#00685f]/40 transition-all space-y-1.5">
                      {/* Top Bar: Tanggal & Jam format Indonesia rapi */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                        <span className="font-black text-[#0b1c30] flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#00685f]" />
                          <span>{item.dateStr}</span>
                        </span>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Poin Tag */}
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${item.pointsColor}`}>
                            {item.pointsText}
                          </span>

                          {/* Status Restitusi Tag */}
                          {item.restitutionStatus && restCfg && (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${restCfg.colorBadge}`}
                            >
                              Status: {item.restitutionStatus}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Judul Kasus / Layanan */}
                      <h4 className="text-sm font-black text-[#0b1c30]">
                        {item.title}
                      </h4>

                      {/* Notes / Hasil / Kesepakatan */}
                      {item.notes && (
                        <p className="text-xs text-gray-600 font-medium leading-relaxed bg-white p-2.5 rounded-lg border border-gray-100">
                          {item.notes}
                        </p>
                      )}

                      {/* Tombol PDF & Drive jika pelanggaran */}
                      {item.originalRecord && (item.type === 'pelanggaran' || item.type === 'absensi') && (
                        <div className="flex items-center gap-2 pt-1.5 flex-wrap">
                          {(item.originalRecord as ViolationRecord).pdfUrl && (
                            <a
                              href={(item.originalRecord as ViolationRecord).pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs"
                              title="Buka dokumen PDF di Google Drive"
                            >
                              <ExternalLink className="w-3 h-3 text-emerald-700" />
                              <span>Lihat PDF di Drive</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => downloadViolationPDF(item.originalRecord as ViolationRecord)}
                            className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <Download className="w-3 h-3 text-[#00685f]" />
                            <span>{(item.originalRecord as ViolationRecord).pdfUrl ? 'Download Ulang' : 'Cetak PDF'}</span>
                          </button>
                        </div>
                      )}

                      {/* Petugas Pencatat */}
                      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                        <span>Oleh: <strong className="text-gray-700">{item.reporter}</strong></span>
                        <span className="uppercase text-[9px] font-bold tracking-wider text-gray-400">
                          {item.type}
                        </span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-gray-400 text-xs italic">
              Tidak ada riwayat yang cocok dengan filter yang dipilih.
            </div>
          )}
        </div>
      </div>

      {/* 🛠️ BAGIAN 5: TOMBOL AKSI CEPAT DI BAWAH (STICKY FOOTER, SELALU KELIHATAN) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#bcc9c6]/40 p-3 sm:px-6 shadow-xl z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          <div className="hidden md:flex items-center gap-2 text-xs font-bold text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00685f]" />
            <span>Aksi Cepat Guru BK untuk <strong className="text-[#00685f]">{student.name}</strong></span>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
            {/* 1. Catat Kasus Baru */}
            <button
              type="button"
              onClick={() => onNavigateToForm('pelanggaran', student.id)}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-black shadow-2xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Catat Kasus Baru</span>
            </button>

            {/* 2. Mulai Konseling */}
            <button
              type="button"
              onClick={() => onNavigateToForm('input-konseling', student.id)}
              className="px-3.5 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-black shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Mulai Konseling</span>
            </button>

            {/* 3. + Beri Reward */}
            <button
              type="button"
              onClick={() => onNavigateToForm('apresiasi', student.id)}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black shadow-2xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5" />
              <span>+ Beri Reward</span>
            </button>

            {/* 4. Hubungi Ortu via WA */}
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
              title="Kirim pesan resmi konfirmasi pemantauan ke nomor orang tua siswa melalui WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Hubungi Ortu via WA</span>
            </button>

            {/* 5. Cetak Profil PDF */}
            <button
              type="button"
              onClick={handleExportPDF}
              className="px-4 py-2 bg-[#0b1c30] hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
              title="Unduh 1 berkas PDF resmi lengkap untuk Rapat Kasus / Konferensi Kasus"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Profil PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* 📝 Modal Ubah Status Restitusi */}
      {editingRestitution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden space-y-4 p-5 sm:p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded">
                  Pembaruan Restitusi
                </span>
                <h3 className="text-base font-black text-[#0b1c30] mt-1">
                  Ubah Status Penanganan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRestitution(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Kasus:</label>
                <p className="font-extrabold text-[#0b1c30] bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                  {editingRestitution.category} (+{editingRestitution.pointsAdded} Poin)
                </p>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Pilih Status Baru:</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Baru Dicatat', 'Sudah Konseling', 'Proses Restitusi', 'Selesai / Dipantau'] as RestitutionStatusType[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setModalTargetStatus(st)}
                      className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                        modalTargetStatus === st
                          ? 'border-[#00685f] bg-[#00685f]/10 text-[#00685f]'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {modalTargetStatus === 'Proses Restitusi' && (
                <div className="space-y-2 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                  <div>
                    <label className="font-bold text-amber-950 block mb-1">Isi Kesepakatan Restitusi:</label>
                    <textarea
                      value={modalAgreement}
                      onChange={(e) => setModalAgreement(e.target.value)}
                      placeholder="Contoh: Menjalin pertemanan kembali dan berjanji saling menghormati..."
                      className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-amber-950 block mb-1">Tenggat Waktu (Deadline):</label>
                    <input
                      type="date"
                      value={modalDeadline}
                      onChange={(e) => setModalDeadline(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-amber-950 block mb-1">Nama Pemantau:</label>
                    <input
                      type="text"
                      value={modalSupervisor}
                      onChange={(e) => setModalSupervisor(e.target.value)}
                      placeholder="Nama Guru BK / Wali Kelas"
                      className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingRestitution(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveRestitutionStatus}
                className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
              >
                Simpan Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
