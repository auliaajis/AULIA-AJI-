import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Counselor, Student, ParentSummon, ParentSummonTemplate, BidangBimbinganType } from '../types';
import { BIDANG_BIMBINGAN_OPTIONS } from '../utils/bkKomprehensif';
import { 
  Mail, 
  Printer, 
  Plus, 
  Trash2, 
  Search, 
  FileText, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  CheckCircle2, 
  Clock3, 
  XCircle, 
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  PenTool,
  Check,
  Sparkles,
  Copy,
  ExternalLink,
  MessageSquare,
  BookmarkPlus,
  Edit3,
  RotateCcw,
  SlidersHorizontal,
  Bookmark,
  Share2
} from 'lucide-react';
import { downloadParentSummonPDF, downloadParentAttendancePDF, formatIndonesianDate } from '../utils/pdfGenerator';
import { registerDeletedId } from '../utils/deletionTracker';
import { autoPushToJournal } from '../utils/journalAutoLink';
import { saveBulkToFirestore, saveSchoolData, loadSchoolData, deleteFromFirestore, saveToFirestore } from '../utils/firestoreSync';
import { showToast } from '../utils/toast';
import { 
  getParentSummonTemplates, 
  saveParentSummonTemplates, 
  DEFAULT_SUMMON_TEMPLATES, 
  formatSummonWaMessage, 
  createWhatsAppLink 
} from '../utils/summonTemplates';
import { getSchoolConfig } from '../utils/schoolConfig';

export interface AttendancePreset {
  id: string;
  label: string;
  bidang: BidangBimbinganType;
  issues: string;
  agreements: string;
  parentCommitment: string;
  studentCommitment: string;
  followUpPlan: string;
}

export const ATTENDANCE_PRESETS: AttendancePreset[] = [
  {
    id: 'disiplin_presensi',
    label: 'Kedisiplinan & Presensi',
    bidang: 'Pribadi',
    issues: 'Evaluasi ketidakhadiran tanpa keterangan (alpa) dan keterlambatan masuk kelas yang terjadi berulang dalam kurun waktu 2 pekan terakhir.',
    agreements: 'Orang tua bersama pihak sekolah sepakat memperketat pengawasan waktu istirahat dan bangun pagi siswa, serta mewajibkan siswa melapor presensi ke ruang BK setiap pagi sebelum jam pertama dimulai.',
    parentCommitment: 'Orang tua berkomitmen memastikan putra/putri berangkat tepat waktu dari rumah dan segera mengabari wali kelas/guru BK apabila ada kendala darurat.',
    studentCommitment: 'Siswa berjanji tidak akan terlambat lagi, hadir tepat waktu setiap hari, dan mematuhi tata tertib jam kehadiran sekolah.',
    followUpPlan: 'Guru BK melakukan monitoring absensi harian bersama wali kelas selama 2 pekan berturut-turut dan menyampaikan laporan perkembangannya ke orang tua.'
  },
  {
    id: 'perilaku_sosial',
    label: 'Perilaku Teman Sebaya',
    bidang: 'Sosial',
    issues: 'Penanganan insiden perselisihan / ketidakharmonisan interaksi dengan teman sebaya di kelas yang mengganggu kenyamanan proses belajar mengajar.',
    agreements: 'Kedua belah pihak menyepakati penyelesaian masalah secara damai, saling memaafkan, menghormati teman, dan menjunjung tinggi budaya santun di sekolah.',
    parentCommitment: 'Orang tua memberikan nasihat dan pembinaan moral di rumah agar anak senantiasa mengendalikan emosi dan bergaul secara positif.',
    studentCommitment: 'Siswa bersedia saling memaafkan, menjaga sikap ramah, menghindari provokasi, dan tidak mengulangi perilaku konfrontatif.',
    followUpPlan: 'Guru BK memantau dinamika pertemanan siswa di lingkungan sekolah dan melakukan sesi konseling kelompok/individu berkala.'
  },
  {
    id: 'motivasi_akademik',
    label: 'Motivasi Belajar & Tugas',
    bidang: 'Belajar',
    issues: 'Penurunan konsentrasi dan motivasi belajar, serta kelalaian dalam pengumpulan tugas-tugas mata pelajaran utama.',
    agreements: 'Menyusun jadwal belajar mandiri terstruktur di rumah minimal 1,5 jam setiap malam, dengan pendampingan orang tua dan bimbingan guru mata pelajaran.',
    parentCommitment: 'Orang tua membatasi penggunaan gawai/game pada malam hari dan memantau penyelesaian tugas sekolah sebelum waktu tidur.',
    studentCommitment: 'Siswa bertekad mencatat seluruh tugas di buku agenda, fokus saat pembelajaran di kelas, dan mengumpulkan tugas tepat waktu.',
    followUpPlan: 'Guru BK berkoordinasi mingguan dengan guru mata pelajaran untuk memantau kemajuan nilai dan pengumpulan tugas siswa.'
  },
  {
    id: 'gawai_gadget',
    label: 'Pengawasan Gawai / HP',
    bidang: 'Pribadi',
    issues: 'Penggunaan gawai/smartphone berlebihan di rumah hingga larut malam yang berdampak pada rasa kantuk di kelas dan hilangnya fokus belajar.',
    agreements: 'Penerapan aturan batas waktu layar (screen time) di rumah maksimal hingga pukul 21.00 WIB dan pengumpulan gawai kepada orang tua menjelang jam istirahat malam.',
    parentCommitment: 'Orang tua berkomitmen mendampingi jam belajar malam dan konsisten menerapkan aturan penyimpanan gawai sebelum tidur.',
    studentCommitment: 'Siswa berkomitmen mematuhi batas jam bermain gawai dan mengutamakan istirahat cukup agar segar saat bersekolah.',
    followUpPlan: 'Evaluasi kebugaran dan keaktifan siswa di sekolah dilakukan berkala setiap pekan oleh Guru BK dan Wali Kelas.'
  }
];

export function createAttendanceWaSummary(summon: ParentSummon, counselor: Counselor): string {
  const att = summon.attendanceDetails || {
    actualDate: summon.summonDate,
    actualTime: summon.summonTime,
    attendeeName: summon.parentName,
    attendeeRelation: 'Orang Tua / Wali',
    issuesDiscussed: summon.agenda,
    agreements: 'Peningkatan disiplin dan koordinasi belajar bersama.',
    parentCommitment: '-',
    studentCommitment: '-',
    followUpPlan: 'Pemantauan berkala Guru BK & Wali Kelas.',
    counselorName: counselor.name,
    documentedAt: new Date().toISOString()
  };
  const config = getSchoolConfig();
  const dateStr = formatIndonesianDate(att.actualDate || summon.summonDate, true);
  return `*RESUME RESMI PERTEMUAN WALI MURID - ${config.schoolName.toUpperCase()}*\n\n` +
    `Yth. Bapak/Ibu *${att.attendeeName || summon.parentName}* (${att.attendeeRelation || 'Wali Murid'}),\n\n` +
    `Terima kasih telah hadir dan bermusyawarah di Ruang Bimbingan dan Konseling (BK) ${config.schoolName} pada:\n` +
    `📅 Hari/Tanggal : ${dateStr}\n` +
    `⏰ Waktu         : ${att.actualTime || summon.summonTime || '09:00'} WIB\n` +
    `👤 Peserta Didik : *${summon.studentName}* (Kelas ${summon.studentClass})\n\n` +
    `*📋 Ringkasan Hasil Pertemuan:* \n` +
    `• Pokok Bahasan : ${att.issuesDiscussed || summon.agenda}\n` +
    `• Kesepakatan   : ${att.agreements}\n\n` +
    `*🤝 Komitmen Bersama:*\n` +
    `• Komitmen Orang Tua : ${att.parentCommitment || '-'}\n` +
    `• Janji Siswa        : ${att.studentCommitment || '-'}\n` +
    `• Tindak Lanjut BK   : ${att.followUpPlan || '-'}\n\n` +
    `Dokumen resmi Berita Acara & Notulen telah diarsipkan secara digital di Portal BK ${config.schoolName}.\n\n` +
    `Salam hormat,\n` +
    `*${counselor.name}*\n` +
    `Guru Bimbingan dan Konseling ${config.schoolName}`;
}

interface SignaturePadProps {
  label: string;
  onChange: (base64: string | undefined) => void;
  initialBase64?: string;
}

function SignaturePad({ label, onChange, initialBase64 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!initialBase64);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: any) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setIsEmpty(false);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onChange(canvas.toDataURL('image/png'));
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange(undefined);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0b1c30'; // Dark Slate
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (initialBase64) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setIsEmpty(false);
      };
      img.src = initialBase64;
    }
  }, [initialBase64]);

  return (
    <div className="space-y-1 p-2.5 bg-gray-50 border border-gray-200 rounded-xl w-full">
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-[10px] font-extrabold text-[#0b1c30] uppercase tracking-wide block flex items-center gap-1">
          <PenTool className="w-3 h-3 text-[#00685f]" />
          <span>{label} (Opsional)</span>
        </span>
        {!isEmpty && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[9px] font-extrabold text-red-600 hover:underline uppercase cursor-pointer"
          >
            Hapus TTD
          </button>
        )}
      </div>

      <div className="relative bg-white border border-dashed border-gray-300 rounded-lg overflow-hidden h-24 flex items-center justify-center">
        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              Sentuh / Seret Layar HP untuk TTD
            </span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={350}
          height={120}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        />
      </div>
    </div>
  );
}

interface PanggilanOrangTuaViewProps {
  students: Student[];
  activeCounselor: Counselor;
}

export default function PanggilanOrangTuaView({ students, activeCounselor }: PanggilanOrangTuaViewProps) {
  // Tabs: 'daftar' | 'templat' | 'dokumentasi' | 'buat'
  const [activeTab, setActiveTab] = useState<'daftar' | 'templat' | 'dokumentasi' | 'buat'>('daftar');
  const [tabDirection, setTabDirection] = useState<number>(1);
  const TAB_ORDER: Record<string, number> = { daftar: 0, templat: 1, dokumentasi: 2, buat: 3 };

  const handleSwitchTab = (newTab: 'daftar' | 'templat' | 'dokumentasi' | 'buat') => {
    const currentIdx = TAB_ORDER[activeTab] ?? 0;
    const nextIdx = TAB_ORDER[newTab] ?? 0;
    setTabDirection(nextIdx >= currentIdx ? 1 : -1);
    setActiveTab(newTab);
  };

  const tabSlideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 32 : -32,
      opacity: 0,
      filter: 'blur(3px)',
    }),
    center: {
      x: 0,
      opacity: 1,
      filter: 'blur(0px)',
      transition: {
        duration: 0.28,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -32 : 32,
      opacity: 0,
      filter: 'blur(3px)',
      transition: {
        duration: 0.2,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    }),
  };
  
  // Summons State
  const [summons, setSummons] = useState<ParentSummon[]>(() => {
    return loadSchoolData('bk_parent_summons', []);
  });

  // Templates State
  const [templates, setTemplates] = useState<ParentSummonTemplate[]>(() => {
    return getParentSummonTemplates();
  });
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<string>('Semua');
  const [templateSearchQuery, setTemplateSearchQuery] = useState<string>('');
  
  // Active selected template for quick drafting
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Form States (Drafting)
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [showStudentDropdown, setShowStudentDropdown] = useState<boolean>(false);
  const [parentName, setParentName] = useState<string>('');
  const [letterNumber, setLetterNumber] = useState<string>('');
  const [letterDate, setLetterDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [summonDate, setSummonDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [summonTime, setSummonTime] = useState<string>('09:00');
  const [summonPlace, setSummonPlace] = useState<string>('Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan');
  const [agenda, setAgenda] = useState<string>('Konsultasi bimbingan perkembangan perilaku, kedisiplinan, dan belajar putra/putri Bapak/Ibu');
  const [bidangBimbingan, setBidangBimbingan] = useState<BidangBimbinganType>('Pribadi');
  const [customAgenda, setCustomAgenda] = useState<string>('');
  const [customWaTemplate, setCustomWaTemplate] = useState<string>('');

  // Search/Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Attendance Documentation Modal State & Direct Tab State
  const [selectedSummonForAttendance, setSelectedSummonForAttendance] = useState<ParentSummon | null>(null);
  const [attActualDate, setAttActualDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [attActualTime, setAttActualTime] = useState<string>('09:00');
  const [attMeetingPlace, setAttMeetingPlace] = useState<string>('Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan');
  const [attBidangBimbingan, setAttBidangBimbingan] = useState<BidangBimbinganType>('Pribadi');
  const [attAttendeeName, setAttAttendeeName] = useState<string>('');
  const [attAttendeeRelation, setAttAttendeeRelation] = useState<string>('Ibu Kandung');
  const [attPhone, setAttPhone] = useState<string>('');
  const [attIssues, setAttIssues] = useState<string>('');
  const [attAgreements, setAttAgreements] = useState<string>('');
  const [attParentCommitment, setAttParentCommitment] = useState<string>('');
  const [attStudentCommitment, setAttStudentCommitment] = useState<string>('');
  const [attFollowUpPlan, setAttFollowUpPlan] = useState<string>('');
  const [attParentSig, setAttParentSig] = useState<string | undefined>(undefined);
  const [attCounselorSig, setAttCounselorSig] = useState<string | undefined>(undefined);

  // Direct Documentation Tab state
  const [docStudentId, setDocStudentId] = useState<string>('');
  const [docStudentSearchQuery, setDocStudentSearchQuery] = useState<string>('');
  const [showDocStudentDropdown, setShowDocStudentDropdown] = useState<boolean>(false);

  // WhatsApp Message Share Modal State (from List Card)
  const [selectedSummonForWhatsApp, setSelectedSummonForWhatsApp] = useState<ParentSummon | null>(null);
  const [waModalPhone, setWaModalPhone] = useState<string>('');
  const [waModalSelectedTemplateId, setWaModalSelectedTemplateId] = useState<string>('');
  const [waModalCustomText, setWaModalCustomText] = useState<string>('');
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  // Template Manager Modal State (Create / Edit Template)
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [editingTemplate, setEditingTemplate] = useState<ParentSummonTemplate | null>(null);
  const [tplFormTitle, setTplFormTitle] = useState<string>('');
  const [tplFormCategory, setTplFormCategory] = useState<ParentSummonTemplate['category']>('Kedisiplinan');
  const [tplFormAgenda, setTplFormAgenda] = useState<string>('');
  const [tplFormPlace, setTplFormPlace] = useState<string>('Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan');
  const [tplFormWaMessage, setTplFormWaMessage] = useState<string>('');
  const [tplFormAgreements, setTplFormAgreements] = useState<string>('');

  // Save current drafting form as new template modal
  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState<boolean>(false);
  const [saveAsTplTitle, setSaveAsTplTitle] = useState<string>('');
  const [saveAsTplCategory, setSaveAsTplCategory] = useState<ParentSummonTemplate['category']>('Kedisiplinan');

  // Auto-sync summons to local cache
  useEffect(() => {
    saveSchoolData('bk_parent_summons', summons);
  }, [summons]);

  // Realtime subscriber for remote changes
  useEffect(() => {
    const handleRealtimeUpdate = (e: any) => {
      const key = e.detail?.key;
      const data = e.detail?.data;
      if (key === 'bk_parent_summons') {
        if (Array.isArray(data)) {
          setSummons(data);
        } else {
          setSummons(loadSchoolData('bk_parent_summons', []));
        }
      } else if (key === 'bk_parent_summon_templates') {
        if (Array.isArray(data)) {
          setTemplates(data);
        } else {
          setTemplates(loadSchoolData('bk_parent_summon_templates', []));
        }
      }
    };

    window.addEventListener('bk_realtime_sync', handleRealtimeUpdate);
    window.addEventListener('storage', (e) => {
      if (e.key === 'bk_parent_summons' || e.key === 'bk_parent_summon_templates') {
        handleRealtimeUpdate({ detail: { key: e.key } });
      }
    });

    return () => {
      window.removeEventListener('bk_realtime_sync', handleRealtimeUpdate);
    };
  }, []);

  // Auto-sync templates to localStorage and Firestore
  const updateTemplates = (newTemplates: ParentSummonTemplate[]) => {
    setTemplates(newTemplates);
    saveParentSummonTemplates(newTemplates);
    saveBulkToFirestore('bk_parent_summon_templates', newTemplates);
  };

  // Helper to get Roman numeral for months
  const getRomanMonth = (monthNumber: number): string => {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return romans[monthNumber] || 'I';
  };

  // Helper to auto-generate formal school letter number
  const generateLetterNumber = (count: number) => {
    const year = new Date().getFullYear();
    const month = getRomanMonth(new Date().getMonth());
    const paddedCount = String(count + 1).padStart(3, '0');
    return `421.7/${paddedCount}/SMPN2/${month}/${year}`;
  };

  // Auto-populate letter number when creating new summon
  useEffect(() => {
    if (activeTab === 'buat' && !letterNumber) {
      setLetterNumber(generateLetterNumber(summons.length));
    }
  }, [activeTab, summons.length]);

  // Selected Student Object
  const currentSelectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  // Apply a template to the current drafting form
  const applyTemplateToDraft = (template: ParentSummonTemplate) => {
    setSelectedTemplateId(template.id);
    setAgenda('Lainnya');
    setCustomAgenda(template.agenda);
    if (template.place) {
      setSummonPlace(template.place);
    }
    if (template.waMessageTemplate) {
      setCustomWaTemplate(template.waMessageTemplate);
    }
  };

  // Switch to Create Tab with a preselected Template
  const handleUseTemplate = (template: ParentSummonTemplate) => {
    applyTemplateToDraft(template);
    setActiveTab('buat');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open Template Modal for Create / Edit
  const openCreateTemplateModal = () => {
    setEditingTemplate(null);
    setTplFormTitle('');
    setTplFormCategory('Kedisiplinan');
    setTplFormAgenda('');
    setTplFormPlace('Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan');
    setTplFormWaMessage(`*SURAT PEMBERITAHUAN & PANGGILAN ORANG TUA / WALI*
*{NAMA_SEKOLAH}*

Yth. Bapak/Ibu Orang Tua / Wali dari:
👤 *Nama Siswa:* {NAMA_SISWA}
🏫 *Kelas / NIS:* {KELAS} / {NIS}

Dengan hormat,
Kami mengundang Bapak/Ibu untuk hadir pada pertemuan bimbingan:

📅 *Hari / Tanggal:* {HARI_TANGGAL}
⏰ *Waktu:* {JAM} WIB
📍 *Tempat:* {TEMPAT}
🎯 *Agenda:* {AGENDA}
📋 *No. Surat:* {NO_SURAT}

Terima kasih atas kerja sama dan dukungannya.

Hormat kami,
*Guru Pembimbing BK:* {GURU_BK}
_{NAMA_SEKOLAH}_`);
    setTplFormAgreements('');
    setShowTemplateModal(true);
  };

  const openEditTemplateModal = (tpl: ParentSummonTemplate) => {
    setEditingTemplate(tpl);
    setTplFormTitle(tpl.title);
    setTplFormCategory(tpl.category);
    setTplFormAgenda(tpl.agenda);
    setTplFormPlace(tpl.place || 'Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan');
    setTplFormWaMessage(tpl.waMessageTemplate || '');
    setTplFormAgreements(tpl.suggestedAgreements || '');
    setShowTemplateModal(true);
  };

  const handleSaveTemplateForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplFormTitle.trim() || !tplFormAgenda.trim()) {
      alert('Judul templat dan agenda resmi wajib diisi.');
      return;
    }

    if (editingTemplate) {
      // Edit existing
      const updated = templates.map(t => {
        if (t.id === editingTemplate.id) {
          return {
            ...t,
            title: tplFormTitle.trim(),
            category: tplFormCategory,
            agenda: tplFormAgenda.trim(),
            place: tplFormPlace.trim(),
            waMessageTemplate: tplFormWaMessage.trim(),
            suggestedAgreements: tplFormAgreements.trim(),
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      });
      updateTemplates(updated);
      alert('Templat surat dan pesan berhasil diperbarui!');
    } else {
      // Create new
      const newTpl: ParentSummonTemplate = {
        id: `tpl-custom-${Date.now()}`,
        title: tplFormTitle.trim(),
        category: tplFormCategory,
        agenda: tplFormAgenda.trim(),
        place: tplFormPlace.trim(),
        waMessageTemplate: tplFormWaMessage.trim(),
        suggestedAgreements: tplFormAgreements.trim(),
        isCustom: true,
        createdAt: new Date().toISOString()
      };
      updateTemplates([newTpl, ...templates]);
      alert('Templat baru berhasil ditambahkan!');
    }

    setShowTemplateModal(false);
  };

  const handleDeleteTemplate = (id: string, title: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus templat "${title}"?`)) {
      registerDeletedId(id);
      deleteFromFirestore('bk_parent_summon_templates', id);
      const filtered = templates.filter(t => t.id !== id);
      updateTemplates(filtered);
    }
  };

  const handleResetTemplatesToDefault = () => {
    if (confirm('Kembalikan seluruh daftar templat ke setelan bawaan standar BK? Templat kustom Anda mungkin akan terhapus.')) {
      updateTemplates(DEFAULT_SUMMON_TEMPLATES);
      alert('Daftar templat berhasil dikembalikan ke standar bawaan.');
    }
  };

  // Save current Drafting Form as New Reusable Template
  const handleSaveDraftAsTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveAsTplTitle.trim()) {
      alert('Nama templat wajib diisi.');
      return;
    }
    const currentAgendaText = agenda === 'Lainnya' ? customAgenda : agenda;
    if (!currentAgendaText.trim()) {
      alert('Agenda surat tidak boleh kosong.');
      return;
    }

    const newTpl: ParentSummonTemplate = {
      id: `tpl-saved-${Date.now()}`,
      title: saveAsTplTitle.trim(),
      category: saveAsTplCategory,
      agenda: currentAgendaText.trim(),
      place: summonPlace.trim(),
      waMessageTemplate: customWaTemplate.trim() || DEFAULT_SUMMON_TEMPLATES[0].waMessageTemplate,
      isCustom: true,
      createdAt: new Date().toISOString()
    };

    updateTemplates([newTpl, ...templates]);
    setShowSaveAsTemplateModal(false);
    setSaveAsTplTitle('');
    alert(`🎉 Sukses! Isian ini telah disimpan sebagai templat baru "${newTpl.title}".`);
  };

  // Filtered Student Suggestions for Autocomplete
  const filteredStudentSuggestions = useMemo(() => {
    const q = studentSearchQuery.toLowerCase().trim();
    let list = students;
    if (q) {
      list = students.filter(
        (s) =>
          s &&
          (String(s.name || '').toLowerCase().includes(q) ||
            String(s.nis ?? '').toLowerCase().includes(q) ||
            String(s.nisn ?? '').toLowerCase().includes(q) ||
            String(s.class || '').toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id'));
  }, [studentSearchQuery, students]);

  const handleStudentChange = (studentId: string) => {
    setSelectedStudentId(studentId);
    const student = students.find(s => s.id === studentId);
    if (student) {
      setParentName(`Bapak / Ibu Wali dari ${student.name}`);
      setStudentSearchQuery(student.name);
    } else {
      setParentName('');
      setStudentSearchQuery('');
    }
  };

  // Form submission (Create Summon)
  const handleCreateSummon = (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) {
      alert('Silakan pilih siswa target terlebih dahulu.');
      return;
    }

    if (!parentName.trim()) {
      alert('Nama orang tua / wali murid tidak boleh kosong.');
      return;
    }

    const finalAgenda = agenda === 'Lainnya' ? customAgenda : agenda;
    if (!finalAgenda.trim()) {
      alert('Agenda panggilan tidak boleh kosong.');
      return;
    }

    const newSummon: ParentSummon = {
      id: `ps-${Date.now()}`,
      letterNumber: letterNumber || generateLetterNumber(summons.length),
      date: letterDate,
      bidangBimbingan,
      studentId: student.id,
      studentName: student.name,
      studentClass: student.class,
      studentNis: student.nis,
      parentName: parentName.trim(),
      summonDate,
      summonTime,
      summonPlace: summonPlace.trim(),
      agenda: finalAgenda.trim(),
      counselorId: activeCounselor.id,
      status: 'Terkirim',
      createdAt: new Date().toISOString(),
    };

    setSummons([newSummon, ...summons]);
    saveToFirestore('bk_parent_summons', newSummon);

    // Push to Daily Journal automatically
    autoPushToJournal({
      sourceType: 'summon_visit',
      date: letterDate,
      startTime: summonTime || '09:00',
      endTime: '10:00',
      activityType: 'Konsultasi Orang Tua',
      title: `Surat Panggilan Orang Tua - ${newSummon.letterNumber}`,
      description: `Penerbitan surat panggilan resmi kepada Orang Tua/Wali dari ${student.name} (${student.class}) untuk agenda: ${finalAgenda}. Jadwal kehadiran: ${formatIndonesianDate(summonDate)} pukul ${summonTime} di ${summonPlace}.`,
      target: `Siswa ${student.name} (${student.class}) & Ortu (${parentName})`,
      status: 'Dalam Proses',
      counselorId: activeCounselor.id
    });

    // Auto-generate & download PDF letter
    downloadParentSummonPDF(newSummon, activeCounselor);

    // Reset fields
    setSelectedStudentId('');
    setParentName('');
    setCustomAgenda('');
    setStudentSearchQuery('');
    
    alert(`Surat Panggilan Orang Tua untuk ${student.name} berhasil dibuat dan diunduh.`);
    setActiveTab('daftar');
  };

  // Handle status update
  const handleUpdateStatus = (id: string, newStatus: 'Terkirim' | 'Hadir' | 'Batal' | 'Penjadwalan Ulang') => {
    setSummons(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, status: newStatus } : s);
      const target = updated.find(s => s.id === id);
      if (target) saveToFirestore('bk_parent_summons', target);
      saveSchoolData('bk_parent_summons', updated);
      return updated;
    });
    showToast(`Status penanganan diperbarui ke: ${newStatus}`, 'info');
  };

  // Handle delete
  const handleDeleteSummon = (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus catatan surat panggilan untuk ${name}?`)) {
      registerDeletedId(id);
      deleteFromFirestore('bk_parent_summons', id);
      setSummons(prev => {
        const next = prev.filter(s => s.id !== id);
        saveSchoolData('bk_parent_summons', next);
        return next;
      });
      showToast(`Catatan surat panggilan ${name} berhasil dihapus.`, 'info');
    }
  };

  // Open Attendance Modal
  const openAttendanceModal = (summon: ParentSummon) => {
    setSelectedSummonForAttendance(summon);
    const existing = summon.attendanceDetails;
    setAttActualDate(existing?.actualDate || summon.summonDate || new Date().toISOString().split('T')[0]);
    setAttActualTime(existing?.actualTime || summon.summonTime || '09:00');
    setAttMeetingPlace(existing?.meetingPlace || summon.summonPlace || 'Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan');
    setAttBidangBimbingan(summon.bidangBimbingan || 'Pribadi');
    setAttAttendeeName(existing?.attendeeName || summon.parentName || '');
    setAttAttendeeRelation(existing?.attendeeRelation || 'Ibu Kandung');
    setAttPhone(existing?.phone || '');
    setAttIssues(existing?.issuesDiscussed || summon.agenda || '');
    setAttAgreements(existing?.agreements || 'Siswa dan Orang Tua menyepakati langkah-langkah perbaikan disiplin serta pendampingan rutin di rumah.');
    setAttParentCommitment(existing?.parentCommitment || 'Orang tua bersedia memantau dan membatasi penggunaan gawai serta mendampingi jam belajar malam anak.');
    setAttStudentCommitment(existing?.studentCommitment || 'Siswa berjanji tidak akan mengulangi kesalahan dan akan datang tepat waktu ke sekolah.');
    setAttFollowUpPlan(existing?.followUpPlan || 'Guru BK akan melakukan evaluasi mingguan bersama Wali Kelas selama 1 bulan ke depan.');
    setAttParentSig(existing?.parentSignatureBase64);
    setAttCounselorSig(existing?.counselorSignatureBase64);
  };

  const openDirectAttendanceForm = () => {
    handleSwitchTab('dokumentasi');
    setAttActualDate(new Date().toISOString().split('T')[0]);
    setAttActualTime('09:00');
    setAttMeetingPlace('Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan');
    setAttBidangBimbingan('Pribadi');
    setAttAttendeeName('');
    setAttAttendeeRelation('Ibu Kandung');
    setAttPhone('');
    setAttIssues('Konsultasi khusus perkembangan perilaku dan kedisiplinan siswa di sekolah.');
    setAttAgreements('Siswa dan Orang Tua menyepakati perbaikan jam belajar serta pembatasan penggunaan gawai.');
    setAttParentCommitment('Orang tua berkomitmen melakukan pendampingan belajar dan pengawasan di rumah.');
    setAttStudentCommitment('Siswa berjanji hadir tepat waktu dan tidak membolos pelajaran.');
    setAttFollowUpPlan('Guru BK dan Wali Kelas melakukan evaluasi presensi dan kedisiplinan selama 2 minggu.');
    setAttParentSig(undefined);
    setAttCounselorSig(undefined);
  };

  const handleSaveAttendanceDocumentation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSummonForAttendance) return;

    const updatedSummons = summons.map((s) => {
      if (s.id === selectedSummonForAttendance.id) {
        return {
          ...s,
          bidangBimbingan: attBidangBimbingan,
          status: 'Hadir' as const,
          attendanceDetails: {
            actualDate: attActualDate,
            actualTime: attActualTime,
            meetingPlace: attMeetingPlace,
            attendeeName: attAttendeeName,
            attendeeRelation: attAttendeeRelation,
            phone: attPhone,
            counselorName: activeCounselor.name,
            issuesDiscussed: attIssues,
            agreements: attAgreements,
            parentCommitment: attParentCommitment,
            studentCommitment: attStudentCommitment,
            followUpPlan: attFollowUpPlan,
            parentSignatureBase64: attParentSig,
            counselorSignatureBase64: attCounselorSig,
            documentedAt: new Date().toISOString(),
          },
        };
      }
      return s;
    });

    setSummons(updatedSummons);
    saveSchoolData('bk_parent_summons', updatedSummons);

    const targetSummon = updatedSummons.find(s => s.id === selectedSummonForAttendance.id);
    if (targetSummon) {
      saveToFirestore('bk_parent_summons', targetSummon);
      autoPushToJournal({
        sourceType: 'summon_visit',
        date: attActualDate,
        startTime: attActualTime || '09:00',
        endTime: '10:00',
        activityType: 'Konsultasi Orang Tua',
        title: `Notulen & Konfirmasi Kehadiran Panggilan Ortu - ${targetSummon.letterNumber}`,
        description: `Pertemuan & Konsultasi Wali Murid ${targetSummon.studentName} (${targetSummon.studentClass}). Yang Hadir: ${attAttendeeName} (${attAttendeeRelation}). Pembahasan: ${attIssues}. Kesepakatan: ${attAgreements}. RTL: ${attFollowUpPlan}`,
        target: `Siswa ${targetSummon.studentName} (${targetSummon.studentClass}) & Ortu (${attAttendeeName})`,
        status: 'Selesai',
        counselorId: activeCounselor.id
      });
      
      downloadParentAttendancePDF(targetSummon, activeCounselor);
    }

    showToast('Berita Acara & Notulen Kehadiran Orang Tua berhasil disimpan!', 'success');
    setSelectedSummonForAttendance(null);
  };

  const handleSaveDirectAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find(s => s.id === docStudentId);
    if (!student) {
      showToast('Silakan pilih siswa terlebih dahulu.', 'error');
      return;
    }

    if (!attAttendeeName.trim()) {
      showToast('Nama wali murid yang hadir tidak boleh kosong.', 'error');
      return;
    }

    const newId = `ps-direct-${Date.now()}`;
    const letterNo = generateLetterNumber(summons.length);

    const newSummon: ParentSummon = {
      id: newId,
      letterNumber: letterNo,
      date: attActualDate,
      bidangBimbingan: attBidangBimbingan,
      studentId: student.id,
      studentName: student.name,
      studentClass: student.class,
      studentNis: student.nis,
      parentName: attAttendeeName,
      summonDate: attActualDate,
      summonTime: attActualTime,
      summonPlace: attMeetingPlace || 'Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan',
      agenda: attIssues,
      counselorId: activeCounselor.id,
      status: 'Hadir',
      createdAt: new Date().toISOString(),
      attendanceDetails: {
        actualDate: attActualDate,
        actualTime: attActualTime,
        meetingPlace: attMeetingPlace,
        attendeeName: attAttendeeName,
        attendeeRelation: attAttendeeRelation,
        phone: attPhone,
        counselorName: activeCounselor.name,
        issuesDiscussed: attIssues,
        agreements: attAgreements,
        parentCommitment: attParentCommitment,
        studentCommitment: attStudentCommitment,
        followUpPlan: attFollowUpPlan,
        parentSignatureBase64: attParentSig,
        counselorSignatureBase64: attCounselorSig,
        documentedAt: new Date().toISOString(),
      }
    };

    setSummons(prev => {
      const next = [newSummon, ...prev];
      saveSchoolData('bk_parent_summons', next);
      return next;
    });
    saveToFirestore('bk_parent_summons', newSummon);

    autoPushToJournal({
      sourceType: 'summon_visit',
      date: attActualDate,
      startTime: attActualTime || '09:00',
      endTime: '10:00',
      activityType: 'Konsultasi Orang Tua',
      title: `Notulen Direct Kehadiran Orang Tua - ${letterNo}`,
      description: `Konsultasi langsung dengan Orang Tua/Wali ${student.name} (${student.class}). Yang Hadir: ${attAttendeeName} (${attAttendeeRelation}). Pembahasan: ${attIssues}. Kesepakatan: ${attAgreements}. RTL: ${attFollowUpPlan}`,
      target: `Siswa ${student.name} (${student.class}) & Ortu (${attAttendeeName})`,
      status: 'Selesai',
      counselorId: activeCounselor.id
    });

    showToast('Berita Acara Kehadiran Orang Tua berhasil dicatat dan diunduh!', 'success');
    downloadParentAttendancePDF(newSummon, activeCounselor);
    setActiveTab('daftar');
  };

  const openAttendanceWaModal = (summon: ParentSummon) => {
    setSelectedSummonForWhatsApp(summon);
    const phone = summon.attendanceDetails?.phone || '';
    setWaModalPhone(phone);
    setWaModalSelectedTemplateId('resume-ba');
    const text = createAttendanceWaSummary(summon, activeCounselor);
    setWaModalCustomText(text);
  };

  // Open WhatsApp Modal for a specific summon
  const openWhatsAppModal = (summon: ParentSummon) => {
    setSelectedSummonForWhatsApp(summon);
    setWaModalPhone('');
    setWaModalSelectedTemplateId(templates[0]?.id || '');
    
    const formatted = formatSummonWaMessage(templates[0]?.waMessageTemplate || DEFAULT_SUMMON_TEMPLATES[0].waMessageTemplate, {
      studentName: summon.studentName,
      studentClass: summon.studentClass,
      studentNis: summon.studentNis,
      parentName: summon.parentName,
      summonDate: summon.summonDate,
      summonTime: summon.summonTime,
      summonPlace: summon.summonPlace,
      agenda: summon.agenda,
      letterNumber: summon.letterNumber,
      counselorName: activeCounselor.name,
      schoolName: getSchoolConfig().schoolName
    });
    setWaModalCustomText(formatted);
  };

  const handleWaTemplateChangeInModal = (templateId: string) => {
    setWaModalSelectedTemplateId(templateId);
    if (!selectedSummonForWhatsApp) return;
    if (templateId === 'resume-ba') {
      const text = createAttendanceWaSummary(selectedSummonForWhatsApp, activeCounselor);
      setWaModalCustomText(text);
      return;
    }
    const tpl = templates.find(t => t.id === templateId) || DEFAULT_SUMMON_TEMPLATES[0];
    const formatted = formatSummonWaMessage(tpl.waMessageTemplate, {
      studentName: selectedSummonForWhatsApp.studentName,
      studentClass: selectedSummonForWhatsApp.studentClass,
      studentNis: selectedSummonForWhatsApp.studentNis,
      parentName: selectedSummonForWhatsApp.parentName,
      summonDate: selectedSummonForWhatsApp.summonDate,
      summonTime: selectedSummonForWhatsApp.summonTime,
      summonPlace: selectedSummonForWhatsApp.summonPlace,
      agenda: selectedSummonForWhatsApp.agenda,
      letterNumber: selectedSummonForWhatsApp.letterNumber,
      counselorName: activeCounselor.name,
      schoolName: getSchoolConfig().schoolName
    });
    setWaModalCustomText(formatted);
  };

  const handleCopyWaMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  };

  // Filtered Templates by Category & Search Query
  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (selectedTemplateCategory !== 'Semua') {
      if (selectedTemplateCategory === 'Kustom') {
        list = list.filter(t => t.isCustom);
      } else {
        list = list.filter(t => t.category === selectedTemplateCategory);
      }
    }
    if (templateSearchQuery.trim()) {
      const q = templateSearchQuery.toLowerCase().trim();
      list = list.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.agenda.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [templates, selectedTemplateCategory, templateSearchQuery]);

  // Filtered summons for list
  const filteredSummons = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return summons.filter(s => {
      const matchesSearch = 
        s.studentName.toLowerCase().includes(searchLower) ||
        s.studentClass.toLowerCase().includes(searchLower) ||
        s.letterNumber.toLowerCase().includes(searchLower) ||
        s.agenda.toLowerCase().includes(searchLower);
      
      const matchesCounselor = activeCounselor.id === 'admin' || s.counselorId === activeCounselor.id;
      return matchesSearch && matchesCounselor;
    });
  }, [summons, searchQuery, activeCounselor]);

  // Live WhatsApp Preview string for the Drafting Form
  const liveDraftWaMessage = useMemo(() => {
    const currentAgendaText = agenda === 'Lainnya' ? customAgenda : agenda;
    const rawTemplate = customWaTemplate || (templates.find(t => t.id === selectedTemplateId)?.waMessageTemplate) || DEFAULT_SUMMON_TEMPLATES[0].waMessageTemplate;
    return formatSummonWaMessage(rawTemplate, {
      studentName: currentSelectedStudent?.name || '(Pilih Siswa)',
      studentClass: currentSelectedStudent?.class || '(Kelas)',
      studentNis: currentSelectedStudent?.nis || '-',
      parentName: parentName || 'Bapak / Ibu Wali Murid',
      summonDate,
      summonTime,
      summonPlace,
      agenda: currentAgendaText || 'Konsultasi dan Bimbingan Siswa',
      letterNumber: letterNumber || '421.7/001/SMPN2/...',
      counselorName: activeCounselor.name,
      schoolName: getSchoolConfig().schoolName
    });
  }, [currentSelectedStudent, parentName, summonDate, summonTime, summonPlace, agenda, customAgenda, letterNumber, customWaTemplate, selectedTemplateId, activeCounselor, templates]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans" id="panggilan-orangtua-container">
      
      {/* Toast Notification */}
      {copiedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0b1c30] text-white px-4 py-2.5 rounded-xl shadow-xl border border-emerald-500/30 flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Teks pesan WhatsApp berhasil disalin ke clipboard!</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b1c30] flex items-center gap-2">
            <Mail className="w-7 h-7 text-[#00685f]" />
            <span>Panggilan Orang Tua / Wali Murid</span>
          </h2>
          <p className="text-sm text-[#3d4947]/70 font-semibold mt-0.5">
            Manajemen surat panggilan resmi, berita acara kehadiran, serta bank templat surat & pesan WhatsApp instan.
          </p>
        </div>
        
        {/* Tab Controls */}
        <div className="flex flex-wrap bg-gray-100 p-1.5 rounded-2xl border border-gray-200 gap-1 shadow-2xs">
          <button
            onClick={() => handleSwitchTab('daftar')}
            className={`relative px-3.5 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer select-none active:scale-98 ${
              activeTab === 'daftar'
                ? 'text-white'
                : 'text-[#3d4947] hover:text-[#0b1c30]'
            }`}
          >
            {activeTab === 'daftar' && (
              <motion.div
                layoutId="panggilan-tab-indicator"
                className="absolute inset-0 bg-[#00685f] rounded-xl shadow-xs"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
            <span className="relative z-10">Daftar Surat ({summons.length})</span>
          </button>
          <button
            onClick={() => handleSwitchTab('templat')}
            className={`relative px-3.5 py-2 rounded-xl text-xs font-extrabold transition-colors flex items-center gap-1.5 cursor-pointer select-none active:scale-98 ${
              activeTab === 'templat'
                ? 'text-white'
                : 'text-[#3d4947] hover:text-[#0b1c30]'
            }`}
          >
            {activeTab === 'templat' && (
              <motion.div
                layoutId="panggilan-tab-indicator"
                className="absolute inset-0 bg-[#00685f] rounded-xl shadow-xs"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
            <Sparkles className="w-3.5 h-3.5 text-amber-300 relative z-10" />
            <span className="relative z-10">Templat Surat & Pesan ({templates.length})</span>
          </button>
          <button
            onClick={openDirectAttendanceForm}
            className={`relative px-3.5 py-2 rounded-xl text-xs font-extrabold transition-colors flex items-center gap-1.5 cursor-pointer select-none active:scale-98 ${
              activeTab === 'dokumentasi'
                ? 'text-white'
                : 'text-[#3d4947] hover:text-[#0b1c30]'
            }`}
          >
            {activeTab === 'dokumentasi' && (
              <motion.div
                layoutId="panggilan-tab-indicator"
                className="absolute inset-0 bg-purple-600 rounded-xl shadow-xs"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
            <FileSpreadsheet className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">Dokumentasi Kehadiran</span>
          </button>
          <button
            onClick={() => handleSwitchTab('buat')}
            className={`relative px-3.5 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer select-none active:scale-98 ${
              activeTab === 'buat'
                ? 'text-white'
                : 'text-[#3d4947] hover:text-[#0b1c30]'
            }`}
          >
            {activeTab === 'buat' && (
              <motion.div
                layoutId="panggilan-tab-indicator"
                className="absolute inset-0 bg-[#00685f] rounded-xl shadow-xs"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
            <span className="relative z-10">+ Buat Surat Panggilan</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB CONTENTS WITH SMOOTH ANIMATE PRESENCE & DIRECTIONAL SLIDE */}
      {/* ========================================================================= */}
      <div className="overflow-hidden">
        <AnimatePresence mode="wait" custom={tabDirection} initial={false}>
          {/* TAB 1: BANK TEMPLAT SURAT & PESAN WHATSAPP */}
          {activeTab === 'templat' && (
            <motion.div
              key="panggilan-tab-templat"
              custom={tabDirection}
              variants={tabSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
          {/* Header Bar within Tab */}
          <div className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-extrabold text-[#0b1c30] text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#00685f]" />
                <span>Bank Templat Surat Resmi & Format Pesan WhatsApp</span>
              </h3>
              <p className="text-xs text-[#3d4947]/70 font-semibold mt-1">
                Pilih dan simpan susunan agenda resmi serta draf pesan WA agar Anda dapat memanggil wali murid dalam hitungan detik tanpa mengetik ulang dari awal.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={openCreateTemplateModal}
                className="px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-97"
              >
                <Plus className="w-4 h-4" />
                <span>+ Buat Templat Baru</span>
              </button>
              <button
                type="button"
                onClick={handleResetTemplatesToDefault}
                className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Reset ke templat bawaan standar BK"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                <span>Reset Default</span>
              </button>
            </div>
          </div>

          {/* Search & Category Filter Pills */}
          <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/30 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari judul templat, topik agenda, atau kategori..."
                  value={templateSearchQuery}
                  onChange={(e) => setTemplateSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                />
              </div>

              <div className="text-xs text-[#3d4947] font-bold">
                Menampilkan <strong>{filteredTemplates.length}</strong> templat
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              {['Semua', 'Kedisiplinan', 'Akademik', 'Sosial & Perilaku', 'Karir / Masa Depan', 'Kustom'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedTemplateCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    selectedTemplateCategory === cat
                      ? 'bg-[#00685f] text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Templates Grid Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTemplates.map((tpl) => (
              <div 
                key={tpl.id}
                className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative group"
              >
                <div className="space-y-3">
                  {/* Category & Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#00685f]/10 text-[#00685f] border border-[#00685f]/20">
                      {tpl.category}
                    </span>
                    {tpl.isCustom ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                        Kustom Guru BK
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        Bawaan Sistem
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h4 className="font-extrabold text-[#0b1c30] text-sm leading-snug">
                    {tpl.title}
                  </h4>

                  {/* Agenda Preview */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                      Agenda Surat Resmi:
                    </span>
                    <p className="text-xs text-gray-700 font-semibold bg-gray-50 p-2.5 rounded-xl border border-gray-100 leading-relaxed line-clamp-3">
                      {tpl.agenda}
                    </p>
                  </div>

                  {/* Suggested Agreements if any */}
                  {tpl.suggestedAgreements && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                        Rekomendasi Solusi / RTL:
                      </span>
                      <p className="text-[11px] text-gray-600 font-medium bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 leading-snug line-clamp-2">
                        {tpl.suggestedAgreements}
                      </p>
                    </div>
                  )}

                  {/* WhatsApp Message Preview Bubble */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      <span>Format Pesan WhatsApp:</span>
                    </span>
                    <div className="bg-[#f0fdf4] border border-emerald-200/70 p-2.5 rounded-xl text-[11px] font-mono text-emerald-950 max-h-32 overflow-y-auto leading-relaxed whitespace-pre-wrap select-all">
                      {tpl.waMessageTemplate}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleUseTemplate(tpl)}
                    className="w-full py-2 px-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-97"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Gunakan Templat Ini</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyWaMessage(tpl.waMessageTemplate)}
                      className="flex-1 py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      title="Salin contoh format pesan WA"
                    >
                      <Copy className="w-3 h-3 text-gray-500" />
                      <span>Salin Draf WA</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditTemplateModal(tpl)}
                      className="p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors border border-gray-200 cursor-pointer"
                      title="Edit Templat Ini"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {tpl.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tpl.id, tpl.title)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-200 cursor-pointer"
                        title="Hapus Templat Kustom"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CREATE SUMMON FORM */}
      {/* ========================================================================= */}
      {activeTab === 'buat' && (
        <motion.div
          key="panggilan-tab-buat"
          custom={tabDirection}
          variants={tabSlideVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleCreateSummon} className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-xs space-y-6">
            
            {/* Header Form */}
            <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-extrabold text-[#0b1c30] text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#00685f]" />
                  <span>Drafting Surat Resmi Panggilan Orang Tua</span>
                </h3>
                <p className="text-xs text-[#3d4947]/70 font-semibold mt-1">
                  Kop surat, nomor formal, dan tanda tangan Kepala Sekolah serta Guru BK akan terlampir otomatis.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowSaveAsTemplateModal(true)}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
                title="Simpan susunan agenda ini sebagai templat baru untuk masa depan"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-amber-700" />
                <span>Simpan Form Sebagai Templat</span>
              </button>
            </div>

            {/* Quick Template Selector Pill Bar */}
            <div className="bg-teal-50/60 p-3.5 rounded-xl border border-[#00685f]/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-[#00685f] uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#00685f]" />
                  <span>Pilih Cepat dari Templat Surat & Pesan:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('templat')}
                  className="text-[10px] font-bold text-[#00685f] hover:underline"
                >
                  Kelola Semua Templat &rarr;
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                {templates.slice(0, 8).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplateToDraft(tpl)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                      selectedTemplateId === tpl.id
                        ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-teal-100/50'
                    }`}
                  >
                    {tpl.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Target Student selection */}
              <div className="space-y-1.5 md:col-span-2 relative">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Pilih Siswa Target <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => {
                      setStudentSearchQuery(e.target.value);
                      setSelectedStudentId('');
                      setParentName('');
                      setShowStudentDropdown(true);
                    }}
                    onFocus={() => setShowStudentDropdown(true)}
                    placeholder="Cari nama, NISN, atau kelas siswa..."
                    className="w-full pl-3.5 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                    required
                  />
                  <Search className="w-4.5 h-4.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>

                {showStudentDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-20" 
                      onClick={() => setShowStudentDropdown(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#bcc9c6]/40 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto custom-scrollbar">
                      {filteredStudentSuggestions.length > 0 ? (
                        filteredStudentSuggestions.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => {
                              handleStudentChange(s.id);
                              setShowStudentDropdown(false);
                            }}
                            className={`p-3 hover:bg-[#eff4ff]/60 cursor-pointer flex items-center justify-between border-b border-[#bcc9c6]/10 last:border-b-0 relative z-40 ${
                              selectedStudentId === s.id ? 'bg-[#e6fcf5]' : ''
                            }`}
                          >
                            <div>
                              <p className="text-xs font-bold text-[#0b1c30]">{s.name}</p>
                              <p className="text-[10px] text-gray-500 font-semibold">
                                NISN: {s.nis} | Kelas: {s.class}
                              </p>
                            </div>
                            {selectedStudentId === s.id && (
                              <span className="text-[10px] font-bold text-[#00685f] bg-[#e6fcf5] px-2 py-0.5 rounded">
                                Terpilih
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-[#3d4947] opacity-60 relative z-40">
                          Siswa tidak ditemukan...
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Parents Name */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Nama Orang Tua / Wali Murid <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder="Bapak / Ibu Wali Murid"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                    required
                  />
                </div>
              </div>

              {/* Letter Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Nomor Surat Resmi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={letterNumber}
                  onChange={(e) => setLetterNumber(e.target.value)}
                  placeholder="Contoh: 421.7/001/SMP2/VII/2026"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
                <p className="text-[10px] text-gray-500 font-medium">Nomor surat otomatis di-increment resmi, tetapi dapat diedit manual.</p>
              </div>

              {/* Letter Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Tanggal Surat Dibuat
                </label>
                <input
                  type="date"
                  value={letterDate}
                  onChange={(e) => setLetterDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Summon Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Hari & Tanggal Pertemuan <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={summonDate}
                  onChange={(e) => setSummonDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Summon Time */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Jam Kehadiran <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={summonTime}
                  onChange={(e) => setSummonTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Summon Place */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Tempat Pertemuan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={summonPlace}
                  onChange={(e) => setSummonPlace(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Bidang Bimbingan Standar SOP Dinas */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide flex items-center justify-between">
                  <span>Bidang Bimbingan <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-[#00685f] font-bold">SOP Dinas BK</span>
                </label>
                <select
                  value={bidangBimbingan}
                  onChange={(e) => setBidangBimbingan(e.target.value as BidangBimbinganType)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                >
                  {BIDANG_BIMBINGAN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Bidang {opt.label} — {opt.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Agenda select option */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Agenda / Alasan Panggilan <span className="text-red-500">*</span>
                </label>
                <select
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                >
                  <option value="Konsultasi bimbingan perkembangan perilaku, kedisiplinan, dan belajar putra/putri Bapak/Ibu">
                    Konsultasi perkembangan perilaku, kedisiplinan, dan belajar (Umum)
                  </option>
                  <option value="Koordinasi tindak lanjut penanganan perilaku kesiswaan secara restoratif">
                    Koordinasi restitusi / pendampingan perkembangan perilaku siswa
                  </option>
                  <option value="Koordinasi bimbingan minat, bakat, kelanjutan studi, dan masa depan karir siswa">
                    Konsultasi bimbingan minat, bakat, dan kelanjutan karir/studi
                  </option>
                  <option value="Sesi khusus mediasi pertikaian / penyelesaian permasalahan hubungan sosial antar siswa">
                    Sesi khusus mediasi / problem-solving hubungan sosial
                  </option>
                  <option value="Lainnya">Agenda Lainnya / Dari Templat Kustom (Tulis Manual)</option>
                </select>
              </div>

              {/* Custom Agenda input */}
              {agenda === 'Lainnya' && (
                <div className="space-y-1.5 md:col-span-2 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-bold text-[#00685f] uppercase tracking-wide block">
                    Rincian Agenda / Alasan Panggilan <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={customAgenda}
                    onChange={(e) => setCustomAgenda(e.target.value)}
                    rows={3}
                    placeholder="Contoh: Koordinasi mendesak penanganan keterlambatan berulang dan penyelesaian tugas..."
                    className="w-full px-3.5 py-2.5 bg-teal-50/30 border border-[#00685f]/30 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                    required
                  />
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-md cursor-pointer active:scale-97"
              >
                <Printer className="w-4 h-4" />
                <span>Simpan & Unduh Surat Panggilan (PDF)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('daftar')}
                className="py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Kembali ke Daftar
              </button>
            </div>
          </form>

          {/* Form Side Guide & Live WhatsApp Preview */}
          <div className="space-y-4">
            
            {/* Live WhatsApp Preview Card */}
            <div className="bg-[#f0fdf4] rounded-2xl p-5 border border-emerald-300/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-emerald-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <MessageSquare className="w-4 h-4 text-emerald-700" />
                  <span>Pratinjau Pesan WhatsApp</span>
                </h4>
                <button
                  type="button"
                  onClick={() => handleCopyWaMessage(liveDraftWaMessage)}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95"
                >
                  <Copy className="w-3 h-3" />
                  <span>Salin Pesan</span>
                </button>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-200 text-[11px] font-mono text-gray-800 max-h-72 overflow-y-auto leading-relaxed whitespace-pre-wrap select-all custom-scrollbar">
                {liveDraftWaMessage}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={createWhatsAppLink('', liveDraftWaMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-97 text-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka WhatsApp Web / App</span>
                </a>
              </div>
            </div>

            {/* Guide Info */}
            <div className="bg-[#eff4ff]/80 rounded-2xl p-5 border border-[#00685f]/10 shadow-xs space-y-3">
              <h4 className="font-extrabold text-[#00685f] text-xs flex items-center gap-1.5 uppercase tracking-wide">
                <AlertCircle className="w-4 h-4 text-[#00685f]" />
                <span>Panduan Administrasi Surat Panggilan</span>
              </h4>
              
              <div className="text-xs text-[#3d4947] space-y-2 font-medium leading-relaxed">
                <p>
                  Surat panggilan orang tua dicetak dengan kop resmi dan dilampirkan nomor registrasi buku agenda keluar BK.
                </p>
                <div className="bg-white p-3 rounded-xl border border-[#00685f]/10 text-[11px] font-bold text-gray-700 space-y-0.5">
                  <div className="text-[#00685f] font-extrabold">Penandatangan Resmi:</div>
                  <div>1. Kepala Sekolah (Mengetahui)</div>
                  <div>2. Guru BK: {activeCounselor.name}</div>
                </div>
              </div>
            </div>

          </div>
        </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DIRECT ATTENDANCE DOCUMENTATION */}
      {/* ========================================================================= */}
      {activeTab === 'dokumentasi' && (
        <motion.div
          key="panggilan-tab-dokumentasi"
          custom={tabDirection}
          variants={tabSlideVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
        <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-xs space-y-6">
          <div className="border-b border-gray-100 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h3 className="font-extrabold text-[#0b1c30] text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-purple-600" />
                <span>Dokumentasi Hasil Kehadiran Orang Tua / Wali Murid (Berita Acara & Notulen)</span>
              </h3>
              <p className="text-xs text-[#3d4947]/70 font-semibold mt-1">
                Gunakan form ini untuk mendokumentasikan kehadiran wali murid secara langsung (baik dengan surat panggilan maupun tanpa surat panggilan).
              </p>
            </div>
            <button
              onClick={() => setActiveTab('daftar')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Kembali ke Daftar
            </button>
          </div>

          <form onSubmit={handleSaveDirectAttendance} className="space-y-5 text-xs">
            {/* Quick Presets for Berita Acara */}
            <div className="space-y-2 bg-teal-50/70 p-4 rounded-xl border border-teal-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-[#00685f] uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#00685f]" />
                  <span>⚡ Draf Cepat Berita Acara & Kesepakatan (1-Klik Isi Otomatis)</span>
                </label>
                <span className="text-[10px] text-gray-500 font-semibold">Dapat diedit & disesuaikan kembali</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {ATTENDANCE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setAttBidangBimbingan(p.bidang);
                      setAttIssues(p.issues);
                      setAttAgreements(p.agreements);
                      setAttParentCommitment(p.parentCommitment);
                      setAttStudentCommitment(p.studentCommitment);
                      setAttFollowUpPlan(p.followUpPlan);
                      showToast(`Draf Berita Acara: ${p.label} berhasil diterapkan!`, 'info');
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-[#00685f] hover:text-white text-[#00685f] font-extrabold text-[11px] rounded-lg border border-[#00685f]/30 transition-all shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1"
                  >
                    <span>+</span> {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Student selection */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                Pilih Siswa yang Dihadiri Orang Tua/Wali <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={docStudentSearchQuery}
                  onChange={(e) => {
                    setDocStudentSearchQuery(e.target.value);
                    setDocStudentId('');
                    setShowDocStudentDropdown(true);
                  }}
                  onFocus={() => setShowDocStudentDropdown(true)}
                  placeholder="Ketik nama, NISN, atau kelas siswa..."
                  className="w-full pl-3.5 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
                <Search className="w-4.5 h-4.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>

              {showDocStudentDropdown && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowDocStudentDropdown(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto custom-scrollbar">
                    {students
                      .filter((s) => {
                        if (!s) return false;
                        const q = docStudentSearchQuery.toLowerCase().trim();
                        return (
                          String(s.name || '').toLowerCase().includes(q) ||
                          String(s.class || '').toLowerCase().includes(q) ||
                          String(s.nis ?? '').toLowerCase().includes(q) ||
                          String(s.nisn ?? '').toLowerCase().includes(q)
                        );
                      })
                      .slice(0, 15)
                      .map((s) => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setDocStudentId(s.id);
                            setDocStudentSearchQuery(`${s.name} (${s.class}) - NIS: ${s.nis || '-'}`);
                            setAttAttendeeName(`Orang Tua / Wali ${s.name}`);
                            setShowDocStudentDropdown(false);
                          }}
                          className={`p-3 hover:bg-teal-50 cursor-pointer flex items-center justify-between border-b border-gray-100 last:border-b-0 relative z-40 ${
                            docStudentId === s.id ? 'bg-teal-100/60' : ''
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold text-[#0b1c30]">{s.name}</p>
                            <p className="text-[10px] text-gray-500 font-semibold">NIS: {s.nis} | Kelas: {s.class}</p>
                          </div>
                          {docStudentId === s.id && (
                            <span className="text-[10px] font-bold text-[#00685f] bg-teal-100 px-2 py-0.5 rounded">
                              Terpilih
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>

            {/* Date, Time & Place */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-teal-50/40 p-4 rounded-xl border border-teal-100">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Tanggal Kehadiran <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={attActualDate}
                  onChange={(e) => setAttActualDate(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Jam Kehadiran (WIB) <span className="text-red-500">*</span></label>
                <input
                  type="time"
                  value={attActualTime}
                  onChange={(e) => setAttActualTime(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Tempat Pertemuan <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={attMeetingPlace}
                  onChange={(e) => setAttMeetingPlace(e.target.value)}
                  placeholder="Contoh: Ruang Bimbingan Konseling SMP N 2 Susukan"
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>
            </div>

            {/* Attendee Details */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Nama Wali Murid yang Hadir <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={attAttendeeName}
                  onChange={(e) => setAttAttendeeName(e.target.value)}
                  placeholder="Nama lengkap orang tua / wali..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Hubungan Kekeluargaan</label>
                <select
                  value={attAttendeeRelation}
                  onChange={(e) => setAttAttendeeRelation(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-[#00685f]"
                >
                  <option value="Ibu Kandung">Ibu Kandung</option>
                  <option value="Ayah Kandung">Ayah Kandung</option>
                  <option value="Kakek / Nenek">Kakek / Nenek</option>
                  <option value="Paman / Bibi (Wali)">Paman / Bibi (Wali)</option>
                  <option value="Kakak Kandung">Kakak Kandung</option>
                  <option value="Wali Murid Lainnya">Wali Murid Lainnya</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Bidang Bimbingan <span className="text-red-500">*</span></label>
                <select
                  value={attBidangBimbingan}
                  onChange={(e) => setAttBidangBimbingan(e.target.value as BidangBimbinganType)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-[#00685f]"
                  required
                >
                  {BIDANG_BIMBINGAN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Bidang {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">No. WhatsApp / HP</label>
                <input
                  type="text"
                  value={attPhone}
                  onChange={(e) => setAttPhone(e.target.value)}
                  placeholder="08xxxxxxxx"
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-[#00685f]"
                />
              </div>
            </div>

            {/* Pokok Masalah */}
            <div>
              <label className="font-bold text-gray-800 block mb-1">Pokok Masalah / Topik Konsultasi <span className="text-red-500">*</span></label>
              <textarea
                rows={3}
                value={attIssues}
                onChange={(e) => setAttIssues(e.target.value)}
                placeholder="Pokok masalah yang dibahas bersama orang tua..."
                className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#00685f]"
                required
              />
            </div>

            {/* Hasil Kesepakatan */}
            <div>
              <label className="font-bold text-gray-800 block mb-1">Hasil Kesepakatan & Solusi Bersama <span className="text-red-500">*</span></label>
              <textarea
                rows={3}
                value={attAgreements}
                onChange={(e) => setAttAgreements(e.target.value)}
                placeholder="Langkah-langkah penyelesaian masalah..."
                className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#00685f]"
                required
              />
            </div>

            {/* Commitments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-gray-800 block mb-1">Komitmen Orang Tua / Wali</label>
                <textarea
                  rows={2}
                  value={attParentCommitment}
                  onChange={(e) => setAttParentCommitment(e.target.value)}
                  placeholder="Bentuk pengawasan dan komitmen orang tua..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#00685f]"
                />
              </div>
              <div>
                <label className="font-bold text-gray-800 block mb-1">Komitmen & Janji Siswa</label>
                <textarea
                  rows={2}
                  value={attStudentCommitment}
                  onChange={(e) => setAttStudentCommitment(e.target.value)}
                  placeholder="Janji perbaikan perilaku siswa..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#00685f]"
                />
              </div>
            </div>

            {/* RTL */}
            <div>
              <label className="font-bold text-gray-800 block mb-1">Rencana Tindak Lanjut (RTL) & Evaluasi Konselor BK</label>
              <textarea
                rows={2}
                value={attFollowUpPlan}
                onChange={(e) => setAttFollowUpPlan(e.target.value)}
                placeholder="Langkah evaluasi dan koordinasi lanjutan bersama wali kelas..."
                className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#00685f]"
              />
            </div>

            {/* Touch Signature */}
            <div className="pt-2 border-t">
              <label className="font-extrabold text-[#0b1c30] text-xs uppercase tracking-wide block mb-2">
                Tanda Tangan Digital Layar Sentuh (Opsional)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SignaturePad
                  label="Tanda Tangan Orang Tua / Wali"
                  onChange={(base64) => setAttParentSig(base64)}
                  initialBase64={attParentSig}
                />
                <SignaturePad
                  label="Tanda Tangan Guru BK / Konselor"
                  onChange={(base64) => setAttCounselorSig(base64)}
                  initialBase64={attCounselorSig}
                />
              </div>
            </div>

            <div className="pt-4 border-t flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('daftar')}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold rounded-xl shadow-md cursor-pointer flex items-center gap-2 transition-all active:scale-97"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan & Cetak Berita Acara PDF</span>
              </button>
            </div>
          </form>
        </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SUMMONS LIST VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'daftar' && (
        <motion.div
          key="panggilan-tab-daftar"
          custom={tabDirection}
          variants={tabSlideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="space-y-4"
        >
          {/* Filters & Actions Bar */}
          <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/30 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari siswa, kelas, nomor surat, atau agenda..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#00685f]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('templat')}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-teal-50 hover:bg-teal-100 text-[#00685f] border border-[#00685f]/30 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#00685f]" />
                <span>Templat Surat & Pesan</span>
              </button>
              <button
                onClick={() => setActiveTab('buat')}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Surat Baru</span>
              </button>
            </div>
          </div>

          {/* List Display */}
          {filteredSummons.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-[#bcc9c6]/30 text-center space-y-4">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-[#00685f]">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#0b1c30] text-sm">Tidak Ada Surat Panggilan</h3>
                <p className="text-xs text-[#3d4947]/70 font-semibold max-w-sm mx-auto mt-1">
                  {searchQuery ? 'Tidak ditemukan data panggilan yang cocok dengan pencarian Anda.' : 'Anda belum pernah membuat surat panggilan orang tua / wali murid.'}
                </p>
              </div>

              {!searchQuery && (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('buat')}
                    className="px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Surat Panggilan Baru</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('templat')}
                    className="px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-[#00685f] border border-[#00685f]/30 text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Buka Bank Templat</span>
                  </button>
                </div>
              )}

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Clear Pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSummons.map((summon) => {
                let badgeClass = 'bg-[#00685f]/10 text-[#00685f]';
                let StatusIcon = Clock3;
                if (summon.status === 'Hadir') {
                  badgeClass = 'bg-[#6b38d4]/10 text-[#6b38d4]';
                  StatusIcon = CheckCircle2;
                } else if (summon.status === 'Batal') {
                  badgeClass = 'bg-red-50 text-red-600 border border-red-100';
                  StatusIcon = XCircle;
                } else if (summon.status === 'Penjadwalan Ulang') {
                  badgeClass = 'bg-amber-50 text-amber-600 border border-amber-100';
                  StatusIcon = RefreshCw;
                }

                return (
                  <div 
                    key={summon.id}
                    className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      
                      {/* Badge / Letter Date row */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded">
                            Surat: {summon.date}
                          </span>
                          <span className="text-[10px] bg-teal-50 text-[#00685f] font-bold px-2 py-0.5 rounded border border-[#00685f]/20">
                            Bidang {summon.bidangBimbingan || 'Pribadi'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 ${badgeClass}`}>
                            <StatusIcon className="w-3 h-3" />
                            <span>{summon.status}</span>
                          </span>
                        </div>
                      </div>

                      {/* Title & Student */}
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Target Siswa:</p>
                        <h4 className="font-extrabold text-[#0b1c30] text-sm">
                          {summon.studentName}
                        </h4>
                        <p className="text-xs font-bold text-[#00685f] mt-0.5">
                          Kelas {summon.studentClass} • NIS {summon.studentNis}
                        </p>
                      </div>

                      {/* Official Letter Number */}
                      <div className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-100 text-xs">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">No. Surat Resmi:</div>
                        <div className="font-mono font-extrabold text-gray-800 tracking-tight select-all truncate">
                          {summon.letterNumber}
                        </div>
                      </div>

                      {/* Meeting Agenda Details */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Agenda Pertemuan:</p>
                        <p className="text-xs font-semibold text-[#3d4947] leading-relaxed line-clamp-3 bg-teal-50/30 p-2.5 rounded-xl border border-[#00685f]/5">
                          {summon.agenda}
                        </p>
                      </div>

                      {/* Summon Date/Time/Place details */}
                      <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-500">
                        <div className="space-y-1">
                          <span className="text-gray-400 font-medium block">HARI/TANGGAL</span>
                          <span className="text-gray-800 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-[#00685f]" />
                            <span className="truncate">{formatIndonesianDate(summon.summonDate).split(',')[1]?.trim() || summon.summonDate}</span>
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-gray-400 font-medium block">WAKTU</span>
                          <span className="text-gray-800 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#00685f]" />
                            <span>{summon.summonTime} WIB</span>
                          </span>
                        </div>
                        <div className="col-span-2 space-y-0.5 pt-1">
                          <span className="text-gray-400 font-medium block">LOKASI</span>
                          <span className="text-gray-800 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#00685f]" />
                            <span className="truncate" title={summon.summonPlace}>{summon.summonPlace}</span>
                          </span>
                        </div>
                      </div>

                      {/* Documented Attendance Callout */}
                      {summon.attendanceDetails && (
                        <div className="bg-teal-50/90 p-3 rounded-xl border border-teal-200 text-xs space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between text-[#0b1c30] font-black text-[11px]">
                            <span className="flex items-center gap-1.5 text-[#00685f]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#00685f] shrink-0" />
                              <span>Berita Acara Resmi Tersimpan</span>
                            </span>
                            <span className="text-[10px] bg-teal-100 text-[#00685f] font-bold px-2 py-0.5 rounded">
                              {formatIndonesianDate(summon.attendanceDetails.actualDate)}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#3d4947] font-semibold leading-snug">
                            Wali Hadir: <strong>{summon.attendanceDetails.attendeeName}</strong> ({summon.attendanceDetails.attendeeRelation})
                          </div>
                          <div className="text-[10px] text-gray-700 bg-white/80 p-2 rounded-lg border border-teal-100 font-medium line-clamp-2">
                            <strong>Kesepakatan:</strong> "{summon.attendanceDetails.agreements}"
                          </div>
                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => downloadParentAttendancePDF(summon, activeCounselor)}
                              className="flex-1 py-1.5 px-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-97"
                              title="Unduh Berita Acara & Notulen Resmi (PDF)"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Unduh Berita Acara PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openAttendanceWaModal(summon)}
                              className="py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-97"
                              title="Kirim Resume Hasil Pertemuan ke WA Orang Tua"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Resume WA</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer actions block */}
                    <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
                      
                      {/* Status select editor */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-gray-400 font-bold">STATUS PENANGANAN:</span>
                        <select
                          value={summon.status}
                          onChange={(e) => handleUpdateStatus(summon.id, e.target.value as any)}
                          className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold text-gray-700 focus:outline-none"
                        >
                          <option value="Terkirim">Terkirim</option>
                          <option value="Hadir">Siswa/Wali Hadir</option>
                          <option value="Batal">Dibatalkan</option>
                          <option value="Penjadwalan Ulang">Reschedule</option>
                        </select>
                      </div>

                      {/* WhatsApp Share Button */}
                      <button
                        type="button"
                        onClick={() => openWhatsAppModal(summon)}
                        className="w-full py-1.5 px-3 bg-[#f0fdf4] hover:bg-[#dcfce7] text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-97"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Kirim / Salin Undangan WA</span>
                      </button>

                      {/* Buttons */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openAttendanceModal(summon)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer shadow-xs ${
                              summon.attendanceDetails
                                ? 'bg-teal-50 text-[#00685f] hover:bg-teal-100 border border-teal-200'
                                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white border border-emerald-200'
                            }`}
                            title="Isi atau edit berita acara & notulen kehadiran orang tua"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{summon.attendanceDetails ? 'Edit Berita Acara' : '+ Catat Kehadiran Ortu'}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadParentSummonPDF(summon, activeCounselor)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#00685f]/10 text-[#00685f] hover:bg-[#00685f] hover:text-white rounded-lg text-[10px] font-extrabold transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Cetak Ulang Surat Panggilan Resmi (PDF)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Cetak Surat (PDF)</span>
                          </button>
                          <button
                            onClick={() => handleDeleteSummon(summon.id, summon.studentName)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 cursor-pointer"
                            title="Hapus Rekaman"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </motion.div>
      )}
      </AnimatePresence>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: WHATSAPP SHARE & PREVIEW MODAL */}
      {/* ========================================================================= */}
      {selectedSummonForWhatsApp && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <MessageSquare className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#0b1c30]">
                    Pesan Pemberitahuan WhatsApp
                  </h3>
                  <p className="text-xs text-gray-500 font-semibold">
                    Target: <strong>{selectedSummonForWhatsApp.studentName}</strong> ({selectedSummonForWhatsApp.studentClass})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSummonForWhatsApp(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Template Selector in Modal */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">
                Pilih Gaya Templat Pesan:
              </label>
              <select
                value={waModalSelectedTemplateId}
                onChange={(e) => handleWaTemplateChangeInModal(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500"
              >
                {selectedSummonForWhatsApp?.attendanceDetails && (
                  <option value="resume-ba" className="font-bold text-emerald-800">
                    🌟 [Resume Resmi] Hasil Pertemuan Wali Murid & Kesepakatan BK
                  </option>
                )}
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    [{tpl.category}] {tpl.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Phone Number input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">
                Nomor WhatsApp Wali Murid (Opsional):
              </label>
              <input
                type="text"
                value={waModalPhone}
                onChange={(e) => setWaModalPhone(e.target.value)}
                placeholder="Contoh: 081234567890 (Kosongkan jika ingin memilih kontak manual di WA)"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Message Textarea (Editable) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 block">
                  Teks Pesan (Dapat Anda sesuaikan):
                </label>
                <span className="text-[10px] text-gray-400 font-semibold">Teks siap dikirim</span>
              </div>
              <textarea
                rows={8}
                value={waModalCustomText}
                onChange={(e) => setWaModalCustomText(e.target.value)}
                className="w-full bg-[#f8faf9] border border-emerald-200 rounded-xl p-3 font-mono text-xs text-gray-800 focus:ring-2 focus:ring-emerald-500 leading-relaxed custom-scrollbar"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t flex flex-col sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedSummonForWhatsApp(null)}
                className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={() => handleCopyWaMessage(waModalCustomText)}
                className="w-full sm:w-auto px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-[#00685f] border border-[#00685f]/30 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Copy className="w-4 h-4" />
                <span>Salin Teks Pesan</span>
              </button>

              <a
                href={createWhatsAppLink(waModalPhone, waModalCustomText)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-97 text-center"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Buka WhatsApp Sekarang</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CREATE / EDIT TEMPLATE MODAL */}
      {/* ========================================================================= */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center text-[#00685f]">
                  <Sparkles className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#0b1c30]">
                    {editingTemplate ? 'Edit Templat Surat & Pesan' : 'Buat Templat Surat & Pesan Baru'}
                  </h3>
                  <p className="text-xs text-gray-500 font-semibold">
                    Simpan format agenda resmi dan draf WA agar dapat digunakan berulang kali.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplateForm} className="space-y-4 text-xs">
              
              {/* Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-bold text-gray-700 block mb-1">
                    Judul Templat <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tplFormTitle}
                    onChange={(e) => setTplFormTitle(e.target.value)}
                    placeholder="Contoh: Panggilan Terkait Keterlambatan dan Disiplin"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-[#00685f]"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Kategori
                  </label>
                  <select
                    value={tplFormCategory}
                    onChange={(e) => setTplFormCategory(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-[#00685f]"
                  >
                    <option value="Kedisiplinan">Kedisiplinan</option>
                    <option value="Akademik">Akademik</option>
                    <option value="Sosial & Perilaku">Sosial & Perilaku</option>
                    <option value="Karir / Masa Depan">Karir / Masa Depan</option>
                    <option value="Keluarga & Kehadiran">Keluarga & Kehadiran</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* Agenda Surat Resmi */}
              <div>
                <label className="font-bold text-gray-800 block mb-1">
                  Agenda Surat Resmi (Kalimat Formal untuk Surat PDF) <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={tplFormAgenda}
                  onChange={(e) => setTplFormAgenda(e.target.value)}
                  placeholder="Contoh: Konsultasi koordinasi tindak lanjut kedisiplinan dan evaluasi kehadiran siswa di sekolah..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Tempat & Solusi RTL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-800 block mb-1">
                    Lokasi Pertemuan Default
                  </label>
                  <input
                    type="text"
                    value={tplFormPlace}
                    onChange={(e) => setTplFormPlace(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 font-bold focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-800 block mb-1">
                    Saran Kesepakatan / Solusi (Opsional)
                  </label>
                  <input
                    type="text"
                    value={tplFormAgreements}
                    onChange={(e) => setTplFormAgreements(e.target.value)}
                    placeholder="Contoh: Pendampingan belajar di rumah dan pembatasan gawai..."
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 font-medium focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
              </div>

              {/* Draf Pesan WhatsApp Template */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-emerald-800 block">
                    Draf Pesan WhatsApp (Gunakan Tag Dinamis di Bawah) <span className="text-red-500">*</span>
                  </label>
                </div>

                {/* Clickable Variable Tag Chips */}
                <div className="flex items-center gap-1 flex-wrap bg-teal-50/80 p-2 rounded-xl border border-teal-200 text-[10px]">
                  <span className="text-gray-500 font-bold mr-1">Klik untuk sisipkan:</span>
                  {[
                    '{NAMA_SISWA}',
                    '{KELAS}',
                    '{NIS}',
                    '{HARI_TANGGAL}',
                    '{JAM}',
                    '{TEMPAT}',
                    '{AGENDA}',
                    '{NO_SURAT}',
                    '{GURU_BK}',
                    '{NAMA_SEKOLAH}'
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTplFormWaMessage(prev => prev + ' ' + tag)}
                      className="px-2 py-0.5 bg-white hover:bg-[#00685f] hover:text-white text-[#00685f] font-mono font-bold rounded border border-teal-300 cursor-pointer transition-colors shadow-2xs"
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={7}
                  value={tplFormWaMessage}
                  onChange={(e) => setTplFormWaMessage(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-mono text-xs text-gray-800 focus:ring-2 focus:ring-[#00685f] leading-relaxed custom-scrollbar"
                  required
                />
              </div>

              {/* Form Actions */}
              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Templat</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SAVE CURRENT FORM AS TEMPLATE MODAL */}
      {/* ========================================================================= */}
      {showSaveAsTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2">
                <BookmarkPlus className="w-5 h-5 text-amber-600" />
                <span>Simpan Form Sebagai Templat Baru</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSaveAsTemplateModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveDraftAsTemplate} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Nama / Judul Templat <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={saveAsTplTitle}
                  onChange={(e) => setSaveAsTplTitle(e.target.value)}
                  placeholder="Contoh: Panggilan Masalah Tugas Belajar"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-[#00685f]"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Kategori Templat
                </label>
                <select
                  value={saveAsTplCategory}
                  onChange={(e) => setSaveAsTplCategory(e.target.value as any)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-[#00685f]"
                >
                  <option value="Kedisiplinan">Kedisiplinan</option>
                  <option value="Akademik">Akademik</option>
                  <option value="Sosial & Perilaku">Sosial & Perilaku</option>
                  <option value="Karir / Masa Depan">Karir / Masa Depan</option>
                  <option value="Keluarga & Kehadiran">Keluarga & Kehadiran</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-gray-600">
                <span className="font-bold text-gray-800 block mb-1">Agenda yang akan disimpan:</span>
                <div className="italic text-gray-700 line-clamp-2">
                  "{agenda === 'Lainnya' ? customAgenda : agenda}"
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSaveAsTemplateModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan ke Bank Templat</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DOKUMENTASI KEHADIRAN ORANG TUA / NOTULEN MODAL (FROM CARD) */}
      {/* ========================================================================= */}
      {selectedSummonForAttendance && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#00685f]" />
                  <span>Berita Acara & Notulen Hasil Kehadiran Orang Tua</span>
                </h3>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">
                  Siswa: <strong>{selectedSummonForAttendance.studentName}</strong> (Kelas {selectedSummonForAttendance.studentClass}) • Surat: {selectedSummonForAttendance.letterNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSummonForAttendance(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveAttendanceDocumentation} className="space-y-4 text-xs">
              {/* Quick Presets for Berita Acara */}
              <div className="space-y-1.5 bg-teal-50/70 p-3.5 rounded-xl border border-teal-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-[#00685f] uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#00685f]" />
                    <span>⚡ Draf Cepat Berita Acara (Klik untuk Isi Otomatis)</span>
                  </label>
                  <span className="text-[10px] text-gray-500 font-semibold">Dapat disesuaikan</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ATTENDANCE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setAttBidangBimbingan(p.bidang);
                        setAttIssues(p.issues);
                        setAttAgreements(p.agreements);
                        setAttParentCommitment(p.parentCommitment);
                        setAttStudentCommitment(p.studentCommitment);
                        setAttFollowUpPlan(p.followUpPlan);
                        showToast(`Draf Berita Acara ${p.label} diterapkan!`, 'info');
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-[#00685f] hover:text-white text-[#00685f] font-extrabold text-[11px] rounded-lg border border-[#00685f]/30 transition-all shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1"
                    >
                      <span>+</span> {p.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Row 1: Attendance Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-teal-50/50 p-3.5 rounded-xl border border-[#00685f]/10">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Tanggal Realisasi Kehadiran</label>
                  <input
                    type="date"
                    value={attActualDate}
                    onChange={(e) => setAttActualDate(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2 font-bold focus:ring-2 focus:ring-[#00685f]"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Waktu Kehadiran (WIB)</label>
                  <input
                    type="time"
                    value={attActualTime}
                    onChange={(e) => setAttActualTime(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2 font-bold focus:ring-2 focus:ring-[#00685f]"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Tempat Pertemuan</label>
                  <input
                    type="text"
                    value={attMeetingPlace}
                    onChange={(e) => setAttMeetingPlace(e.target.value)}
                    placeholder="Contoh: Ruang BK SMP N 2 Susukan"
                    className="w-full bg-white border border-gray-300 rounded-lg p-2 font-bold focus:ring-2 focus:ring-[#00685f]"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Attendee Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Nama Wali yang Hadir</label>
                  <input
                    type="text"
                    value={attAttendeeName}
                    onChange={(e) => setAttAttendeeName(e.target.value)}
                    placeholder="Nama lengkap..."
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2 font-bold focus:ring-2 focus:ring-[#00685f]"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Hubungan dengan Siswa</label>
                  <select
                    value={attAttendeeRelation}
                    onChange={(e) => setAttAttendeeRelation(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2 font-bold focus:ring-2 focus:ring-[#00685f]"
                  >
                    <option value="Ibu Kandung">Ibu Kandung</option>
                    <option value="Ayah Kandung">Ayah Kandung</option>
                    <option value="Kakek / Nenek">Kakek / Nenek</option>
                    <option value="Paman / Bibi (Wali)">Paman / Bibi (Wali)</option>
                    <option value="Kakak Kandung">Kakak Kandung</option>
                    <option value="Wali Murid Lainnya">Wali Murid Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">No. WhatsApp / HP</label>
                  <input
                    type="text"
                    value={attPhone}
                    onChange={(e) => setAttPhone(e.target.value)}
                    placeholder="08xxxxxxxx"
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2 font-bold focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
              </div>

              {/* Row 2b: Bidang Bimbingan */}
              <div>
                <label className="font-bold text-gray-700 block mb-1">Bidang Bimbingan <span className="text-red-500">*</span></label>
                <select
                  value={attBidangBimbingan}
                  onChange={(e) => setAttBidangBimbingan(e.target.value as BidangBimbinganType)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2 font-bold focus:ring-2 focus:ring-[#00685f]"
                  required
                >
                  {BIDANG_BIMBINGAN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Bidang {opt.label} — {opt.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 3: Issues discussed */}
              <div>
                <label className="font-bold text-gray-800 block mb-1">Pokok Bahasan & Pokok Masalah yang Didiskusikan</label>
                <textarea
                  rows={2}
                  value={attIssues}
                  onChange={(e) => setAttIssues(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Row 4: Agreements */}
              <div>
                <label className="font-bold text-gray-800 block mb-1">Hasil Kesepakatan & Solusi Bersama</label>
                <textarea
                  rows={2}
                  value={attAgreements}
                  onChange={(e) => setAttAgreements(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Row 5: Commitments */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-800 block mb-1">Komitmen Orang Tua / Wali</label>
                  <textarea
                    rows={2}
                    value={attParentCommitment}
                    onChange={(e) => setAttParentCommitment(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-800 block mb-1">Komitmen & Janji Siswa</label>
                  <textarea
                    rows={2}
                    value={attStudentCommitment}
                    onChange={(e) => setAttStudentCommitment(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
              </div>

              {/* Row 6: Follow-up plan */}
              <div>
                <label className="font-bold text-gray-800 block mb-1">Rencana Tindak Lanjut (RTL) & Evaluasi Konselor BK</label>
                <textarea
                  rows={2}
                  value={attFollowUpPlan}
                  onChange={(e) => setAttFollowUpPlan(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#00685f]"
                />
              </div>

              {/* Row 7: Touch Signatures (Optional) */}
              <div className="pt-2 border-t">
                <label className="font-extrabold text-[#0b1c30] text-xs uppercase tracking-wide block mb-2">
                  Tanda Tangan Digital Layar Sentuh (Opsional)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SignaturePad
                    label="Tanda Tangan Orang Tua / Wali"
                    onChange={(base64) => setAttParentSig(base64)}
                    initialBase64={attParentSig}
                  />
                  <SignaturePad
                    label="Tanda Tangan Guru BK / Konselor"
                    onChange={(base64) => setAttCounselorSig(base64)}
                    initialBase64={attCounselorSig}
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedSummonForAttendance) return;
                      const previewSummon: ParentSummon = {
                        ...selectedSummonForAttendance,
                        bidangBimbingan: attBidangBimbingan,
                        attendanceDetails: {
                          actualDate: attActualDate,
                          actualTime: attActualTime,
                          meetingPlace: attMeetingPlace,
                          attendeeName: attAttendeeName,
                          attendeeRelation: attAttendeeRelation,
                          phone: attPhone,
                          counselorName: activeCounselor.name,
                          issuesDiscussed: attIssues,
                          agreements: attAgreements,
                          parentCommitment: attParentCommitment,
                          studentCommitment: attStudentCommitment,
                          followUpPlan: attFollowUpPlan,
                          parentSignatureBase64: attParentSig,
                          counselorSignatureBase64: attCounselorSig,
                          documentedAt: new Date().toISOString(),
                        }
                      };
                      downloadParentAttendancePDF(previewSummon, activeCounselor);
                    }}
                    className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-[#00685f] border border-[#00685f]/30 font-extrabold rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5 text-xs transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak PDF Sekarang</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openAttendanceWaModal(selectedSummonForAttendance)}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5 text-xs transition-all"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>Kirim WA</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSummonForAttendance(null)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all active:scale-97"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan & Unduh Berita Acara</span>
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
