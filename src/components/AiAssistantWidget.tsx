import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, MessageSquare, RefreshCw, Send, ChevronDown, ChevronUp,
  X, Lightbulb, Dices, ChevronRight, ChevronLeft,
  CheckCircle2, Circle, ArrowRight, Compass, HelpCircle,
  ShieldCheck, HeartHandshake, Home, PhoneCall, Clock, Users,
  FileText, ExternalLink, BookmarkCheck
} from 'lucide-react';
import { Counselor, CounselingService, ViolationRecord, Student } from '../types';

interface AiAssistantWidgetProps {
  counselor: Counselor;
  students?: Student[];
  services?: CounselingService[];
  violations?: ViolationRecord[];
  onNavigateToTab: (tab: string, searchQuery?: string) => void;
  onNavigateToForm?: (form: string, selectStudentId?: string) => void;
  isOpenModalOnStart?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

export interface WorkflowStep {
  stepNo: number;
  title: string;
  action: string;
  tips: string;
  targetTab?: string;
  targetTabLabel?: string;
  targetForm?: string;
}

export interface WorkflowGuideData {
  id: string;
  title: string;
  badge: string;
  iconName: 'restitusi' | 'konseling' | 'homevisit' | 'ortu' | 'absensi' | 'mediasi' | 'custom';
  summary: string;
  steps: WorkflowStep[];
  proTips: string[];
}

// 🤖 CUTE AI MASCOT GRAPHIC COMPONENT (Si Becik 🦉)
export const CuteAiMascot: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  speechBubble?: string;
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const dimensions = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-18 h-18' : 'w-13 h-13';

  return (
    <div className={`relative flex flex-col items-center justify-center shrink-0 ${className}`}>
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className={`relative ${dimensions} rounded-2xl bg-gradient-to-tr from-[#00685f] via-teal-600 to-emerald-400 p-1 shadow-md flex items-center justify-center border-2 border-emerald-300/60 overflow-visible`}
      >
        {/* Glow Aura */}
        <div className="absolute inset-0 bg-emerald-400/25 rounded-2xl blur-md -z-10 animate-pulse" />

        {/* Owl Ears / Headphone */}
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
          <div className="w-2 h-2 bg-amber-400 rounded-full border border-amber-500 shadow-2xs" />
          <div className="w-2 h-2 bg-amber-400 rounded-full border border-amber-500 shadow-2xs" />
        </div>

        {/* Mascot Face Canvas */}
        <div className="w-full h-full bg-[#0b1c30] rounded-xl flex flex-col items-center justify-between p-1 border border-emerald-400/40 relative">
          {/* Eyes & Blushing cheeks */}
          <div className="w-full flex items-center justify-around mt-0.5">
            <div className="relative">
              <div className="w-2.5 h-2.5 bg-amber-300 rounded-full flex items-center justify-center shadow-[0_0_6px_#fcd34d]">
                <div className="w-1 h-1 bg-[#0b1c30] rounded-full" />
              </div>
            </div>
            <div className="w-1.5 h-1 bg-rose-400/80 rounded-full blur-[0.5px]" />
            <div className="relative">
              <div className="w-2.5 h-2.5 bg-amber-300 rounded-full flex items-center justify-center shadow-[0_0_6px_#fcd34d]">
                <div className="w-1 h-1 bg-[#0b1c30] rounded-full" />
              </div>
            </div>
          </div>

          {/* Cheerful Smile / Cute Beak */}
          <div className="w-2 h-1 bg-amber-400 rounded-b-md mb-0.5" />

          {/* Cute Waving Hands */}
          <div className="absolute -right-1 bottom-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-emerald-900 animate-bounce" />
          <div className="absolute -left-1 bottom-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-emerald-900" />
        </div>
      </motion.div>
    </div>
  );
};

// 🧭 PRESET STANDARD BK WORKFLOWS (STEP-BY-STEP SOP)
export const PRESET_BK_WORKFLOWS: WorkflowGuideData[] = [
  {
    id: 'wf-restitusi',
    title: 'Alur Segitiga Restitusi & Penanganan Kasus Siswa',
    badge: 'Disiplin Positif',
    iconName: 'restitusi',
    summary: 'Metode penanganan perilaku siswa berbasis restitusi untuk menumbuhkan motivasi internal dan tanggung jawab moral.',
    steps: [
      {
        stepNo: 1,
        title: 'Menstabilkan Identitas (Stabilize the Identity)',
        action: 'Sapa siswa dengan tenang tanpa nada menuduh. Bantu siswa merasa aman dengan menegaskan bahwa berbuat salah adalah hal manusiawi.',
        tips: 'Ucapkan kalimat kunci: "Semua orang pernah melakukan kesalahan, yang terpenting adalah bagaimana kita memperbaikinya."',
        targetTab: 'data-siswa',
        targetTabLabel: 'Cek Profil Siswa'
      },
      {
        stepNo: 2,
        title: 'Validasi Tindakan yang Salah (Validate the Misbehavior)',
        action: 'Gali alasan di balik tindakan siswa dengan mendengarkan aktif tanpa memotong pembicaraan atau langsung memarahi.',
        tips: 'Gunakan pertanyaan reflektif: "Kamu pasti punya alasan melakukannya, apa yang sebenarnya kamu rasakan saat itu?"',
        targetForm: 'tambah-layanan',
        targetTabLabel: 'Buka Sesi Konseling'
      },
      {
        stepNo: 3,
        title: 'Menanyakan Keyakinan Kelas/Sekolah (Seek the Belief)',
        action: 'Ajak siswa mengingat kembali kesepakatan dan nilai keyakinan yang telah disepakati bersama di kelas/sekolah.',
        tips: 'Tanyakan: "Nilai apa yang kita percayai bersama? Menurutmu tindakan tadi sesuai atau bertentangan dengan nilai tersebut?"'
      },
      {
        stepNo: 4,
        title: 'Rencana Aksi Perbaikan Mandiri & Dokumentasi',
        action: 'Bimbing siswa merumuskan sendiri solusi konkret untuk memperbaiki situasi, lalu catat kesepakatan secara resmi di sistem.',
        tips: 'Pastikan solusi berasal dari pemikiran siswa sendiri agar ada rasa kepemilikan dan komitmen kuat.',
        targetForm: 'pelanggaran',
        targetTabLabel: 'Catat Restitusi / Pembinaan'
      }
    ],
    proTips: [
      'Hindari memberikan hukuman fisik atau rasa malu di depan teman-temannya.',
      'Lakukan pemantauan berkala 3 hari setelah sesi untuk memberi apresiasi atas komitmen siswa.'
    ]
  },
  {
    id: 'wf-konseling-individu',
    title: 'Alur Sesi Layanan Konseling Individu',
    badge: 'Layanan BK',
    iconName: 'konseling',
    summary: 'Prosedur baku konseling tatap muka empatik mulai dari tahap rapport, eksplorasi, perumusan rencana, hingga evaluasi.',
    steps: [
      {
        stepNo: 1,
        title: 'Tahap Awal: Membangun Rapport & Asas Kerahasiaan',
        action: 'Ciptakan suasana nyaman di ruang BK. Jelaskan asas kerahasiaan konseling agar siswa merasa 100% aman untuk terbuka.',
        tips: 'Tegaskan: "Semua yang kita bicarakan di ruangan ini aman dan rahasia, hanya kamu dan saya yang tahu."',
        targetForm: 'tambah-layanan',
        targetTabLabel: 'Mulai Catatan Layanan BK'
      },
      {
        stepNo: 2,
        title: 'Tahap Eksplorasi & Identifikasi Pokok Masalah',
        action: 'Dengarkan cerita siswa secara mendalam. Identifikasi aspek emosi, faktor pemicu, serta pola pikir siswa.',
        tips: 'Gunakan teknik refleksi perasaan dan parafrase untuk memastikan pemahaman Anda selaras dengan yang dirasakan siswa.'
      },
      {
        stepNo: 3,
        title: 'Tahap Intervensi & Pengambilan Keputusan Mandiri',
        action: 'Fasilitasi siswa menemukan alternatif-alternatif solusi yang realistis dan dapat diterapkan dalam kesehariannya.',
        tips: 'Bantu siswa membedah kelebihan dan kekurangan dari setiap pilihan langkah yang ia ajukan.'
      },
      {
        stepNo: 4,
        title: 'Tahap Pengakhiran & Kesepakatan Tindak Lanjut',
        action: 'Simpulkan hasil sesi, tetapkan tenggat waktu rencana aksi, dan jadwalkan sesi tindak lanjut (follow-up).',
        tips: 'Catat resume bimbingan ke dalam modul Layanan BK untuk rekam jejak konseling terpadu.',
        targetTab: 'jurnal-harian',
        targetTabLabel: 'Input ke Jurnal BK'
      }
    ],
    proTips: [
      'Jaga kontak mata yang hangat dan bahasa tubuh yang terbuka (open body posture).',
      'Jika masalah melibatkan trauma berat, siapkan opsi rujukan/alih tangan kasus (referral).'
    ]
  },
  {
    id: 'wf-home-visit',
    title: 'Alur Prosedur Home Visit (Kunjungan Rumah)',
    badge: 'Kunjungan Lapangan',
    iconName: 'homevisit',
    summary: 'Tahapan resmi pelaksanaan kunjungan ke rumah siswa untuk memperoleh data komprehensif lingkungan keluarga.',
    steps: [
      {
        stepNo: 1,
        title: 'Analisis Urgensi & Koordinasi Wali Kelas',
        action: 'Kaji rekam jejak ketidakhadiran atau kendala siswa. Diskusikan bersama Wali Kelas untuk menentukan tujuan utama kunjungan.',
        tips: 'Kumpulkan data alamat domisili, nomor kontak orang tua, dan rute lokasi sebelum berangkat.',
        targetTab: 'data-siswa',
        targetTabLabel: 'Cek Alamat Siswa'
      },
      {
        stepNo: 2,
        title: 'Penerbitan Surat Tugas & Konfirmasi Janji Temu',
        action: 'Siapkan Surat Tugas Home Visit resmi dan lakukan konfirmasi waktu kepada orang tua/wali siswa agar siap menerima kunjungan.',
        tips: 'Sampaikan tujuan kunjungan dengan bahasa yang ramah sebagai bentuk kepedulian sekolah, bukan interogasi.',
        targetTab: 'home-visit',
        targetTabLabel: 'Kelola Modul Home Visit'
      },
      {
        stepNo: 3,
        title: 'Pelaksanaan Kunjungan & Observasi Empatik',
        action: 'Lakukan dialog hangat dengan orang tua, amati dinamika lingkungan belajar di rumah, dan gali faktor pendukung/penghambat.',
        tips: 'Gunakan pendekatan silaturahmi yang santun dan apresiatif terhadap orang tua.'
      },
      {
        stepNo: 4,
        title: 'Penyusunan Berita Acara & Rencana Tindak Lanjut',
        action: 'Dokumentasikan foto kunjungan, catat komitmen orang tua, dan buat Berita Acara resmi di modul Home Visit.',
        tips: 'Segera lakukan koordinasi kembali dengan Kepala Sekolah/Wali Kelas pasca-kunjungan.',
        targetTab: 'home-visit',
        targetTabLabel: 'Cetak Berita Acara Home Visit'
      }
    ],
    proTips: [
      'Usahakan berkunjung bersama Wali Kelas atau Guru Pendamping.',
      'Hindari menyudutkan kondisi ekonomi atau latar belakang keluarga siswa.'
    ]
  },
  {
    id: 'wf-panggilan-ortu',
    title: 'Alur Panggilan Orang Tua (Konferensi Kasus)',
    badge: 'Kemitraan Ortu',
    iconName: 'ortu',
    summary: 'Alur resmi pengundangan orang tua ke sekolah untuk musyawarah penanganan masalah dan pembinaan kolaboratif.',
    steps: [
      {
        stepNo: 1,
        title: 'Kompilasi Fakta & Rekapitulasi Data Terintegrasi',
        action: 'Kumpulkan seluruh catatan presensi, pembinaan, atau sesi konseling sebelumnya sebagai dasar dialog yang objektif dan valid.',
        tips: 'Fokuskan pada data faktual dan kronologi, bukan asumsi subjektif.',
        targetTab: 'panggilan-ortu',
        targetTabLabel: 'Buka Modul Panggilan Ortu'
      },
      {
        stepNo: 2,
        title: 'Penerbitan & Pengiriman Surat Panggilan Resmi',
        action: 'Cetak Surat Panggilan Orang Tua resmi bertanda tangan Guru BK/Kepala Sekolah dengan tanggal dan jam pertemuan yang jelas.',
        tips: 'Pastikan surat diterima langsung oleh orang tua atau dikonfirmasi via WhatsApp resmi sekolah.',
        targetTab: 'panggilan-ortu',
        targetTabLabel: 'Cetak Surat Panggilan'
      },
      {
        stepNo: 3,
        title: 'Pelaksanaan Temu Musyawarah di Ruang BK',
        action: 'Buka pertemuan dengan suasana kekeluargaan. Paparkan kondisi siswa dan dengarkan tanggapan orang tua secara seimbang.',
        tips: 'Gunakan pendekatan kemitraan: "Kita bersama-sama ingin masa depan ananda sukses dan bahagia di sekolah."'
      },
      {
        stepNo: 4,
        title: 'Penandatanganan Surat Perjanjian / Komitmen Bersama',
        action: 'Rumuskan butir-butir kesepakatan pembinaan dan minta tanda tangan siswa serta orang tua pada Surat Komitmen.',
        tips: 'Simpan salinan digital di aplikasi agar tersinkronisasi dengan portofolio bimbingan siswa.',
        targetTab: 'panggilan-ortu',
        targetTabLabel: 'Simpan Notulen Temu Ortu'
      }
    ],
    proTips: [
      'Siapkan tempat duduk melingkar di ruang BK agar tidak berkesan seperti ruang sidang pengadilan.',
      'Tetapkan tanggal evaluasi kemajuan (misal 2 minggu ke depan).'
    ]
  },
  {
    id: 'wf-absensi-tindaklanjut',
    title: 'Alur Tindak Lanjut Siswa Bolos / Ketidakhadiran Kronis',
    badge: 'Penanganan Absensi',
    iconName: 'absensi',
    summary: 'Langkah taktis mendeteksi dan menangani siswa yang sering terlambat, alpha, atau membolos jam pelajaran.',
    steps: [
      {
        stepNo: 1,
        title: 'Deteksi Dini & Rekap Ketidakhadiran Harian',
        action: 'Cek modul absensi kelas harian untuk mengidentifikasi siswa dengan frekuensi alpha/izin/terlambat berulang.',
        tips: 'Batas toleransi standar: jika mencapai 3x berturut-turut tanpa kabar, segera lakukan tindak lanjut.',
        targetTab: 'absensi',
        targetTabLabel: 'Cek Absensi Harian'
      },
      {
        stepNo: 2,
        title: 'Wawancara Personal & Pengecekan Alasan Nyata',
        action: 'Panggil siswa untuk wawancara santai. Cari tahu akar masalah (misal: begadang, kendala transportasi, masalah pertemanan, atau kejenuhan).',
        tips: 'Gunakan pendekatan empatik agar siswa tidak merasa takut untuk berterus terang.',
        targetForm: 'tambah-layanan',
        targetTabLabel: 'Catat Konseling Presensi'
      },
      {
        stepNo: 3,
        title: 'Notifikasi Cepat & Komunikasi dengan Wali Murid',
        action: 'Hubungi orang tua untuk menyamakan data keberangkatan siswa dari rumah ke sekolah.',
        tips: 'Sering terjadi kasus siswa pamit berangkat dari rumah namun tidak sampai ke sekolah (bolos di luar).'
      },
      {
        stepNo: 4,
        title: 'Penyusunan Kontrak Perilaku (Behavior Contract)',
        action: 'Buat target presensi terukur bersama siswa (misal: "Hadir tepat waktu selama 10 hari berturut-turut")',
        tips: 'Beri apresiasi nyata saat siswa berhasil memenuhi target kontrak perilakunya.',
        targetTab: 'absensi',
        targetTabLabel: 'Monitoring Kehadiran'
      }
    ],
    proTips: [
      'Koordinasikan dengan guru piket dan satpam sekolah untuk mendeteksi waktu kedatangan siswa.',
      'Libatkan teman sebaya yang positif sebagai buddy/pengingat.'
    ]
  },
  {
    id: 'wf-mediasi-konflik',
    title: 'Alur Mediasi Konflik & Pertengkaran Antarsiswa',
    badge: 'Resolusi Konflik',
    iconName: 'mediasi',
    summary: 'Panduan mendamaikan perselisihan antarmurid di sekolah secara adil, restoratif, dan saling memulihkan.',
    steps: [
      {
        stepNo: 1,
        title: 'Pemisahan Awal & Pendinginan Emosi (Cooling Down)',
        action: 'Pisahkan kedua pihak di ruangan berbeda sementara waktu hingga emosi dan amarah mereka mereda.',
        tips: 'Beri air minum dan minta mereka mengatur pernapasan sebelum memulai sesi mediasi.'
      },
      {
        stepNo: 2,
        title: 'Mendengarkan Versi Masing-Masing Pihak Bergantian',
        action: 'Pertemukan di ruang mediasi BK. Berikan giliran berbicara yang setara tanpa saling memotong atau mengejek.',
        tips: 'Terapkan aturan mediasi: "Tidak boleh meninggikan suara, berbicara bergantian, dan saling menghargai."',
        targetForm: 'tambah-layanan',
        targetTabLabel: 'Catat Sesi Mediasi BK'
      },
      {
        stepNo: 3,
        title: 'Menemukan Titik Temu & Saling Memahami Perspektif',
        action: 'Ajak mereka memahami perasaan satu sama lain dan melihat dampak dari perselisihan tersebut bagi kelas.',
        tips: 'Tanyakan: "Apa yang bisa kalian sepakati agar hal seperti ini tidak terulang lagi besok?"'
      },
      {
        stepNo: 4,
        title: 'Ikrar Perdamaian & Pemulihan Hubungan Pertemanan',
        action: 'Fasilitasi saling memaafkan dengan tulus dan buat kesepakatan tertulis perdamaian yang disaksikan Guru BK.',
        tips: 'Pastikan pemulihan hubungan berjalan tulus, bukan sekadar basa-basi formalitas.',
        targetForm: 'pelanggaran',
        targetTabLabel: 'Catat Pembinaan Restoratif'
      }
    ],
    proTips: [
      'Jangan mengambil peran sebagai hakim yang memihak salah satu anak.',
      'Perhatikan bahasa tubuh kedua belah pihak saat saling memaafkan.'
    ]
  }
];

export default function AiAssistantWidget({
  counselor,
  onNavigateToTab,
  onNavigateToForm,
  isOpenModalOnStart = false,
}: AiAssistantWidgetProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(isOpenModalOnStart);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'workflow' | 'chat' | 'icebreaker'>('workflow');

  // Chat State
  const [userQuery, setUserQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Workflow Guide State
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowGuideData>(PRESET_BK_WORKFLOWS[0]);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [customWorkflowQuery, setCustomWorkflowQuery] = useState('');
  const [isGeneratingCustomWorkflow, setIsGeneratingCustomWorkflow] = useState(false);
  const [customWorkflowResult, setCustomWorkflowResult] = useState<WorkflowGuideData | null>(null);

  // Ice Breaker State
  const [activeIceBreaker, setActiveIceBreaker] = useState<{ title: string; instruction: string; duration: string } | null>(null);

  const counselorFirstName = counselor?.name ? counselor.name.split(' ')[0] : 'Guru BK';

  // Greeting based on time of day
  const currentHour = new Date().getHours();
  const timeGreeting = currentHour < 11 ? 'Selamat Pagi' : currentHour < 15 ? 'Selamat Siang' : currentHour < 18 ? 'Selamat Sore' : 'Selamat Malam';
  const daysMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayDayName = daysMap[new Date().getDay()];

  // AI Briefing Speech Bubble
  const [briefingText, setBriefingText] = useState<string>('');
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);

  const toggleStepCompleted = (stepKey: string) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepKey]: !prev[stepKey]
    }));
  };

  // Quick 3-minute ice breakers
  const QUICK_ICE_BREAKERS = [
    {
      title: 'Tebak Emoji Suasana Hati 🎭',
      instruction: 'Minta siswa memilih 2 emoji yang mewakili perasaannya pagi ini dan ceritakan dalam 1 kalimat lucu di depan teman-temannya!',
      duration: '3 Menit'
    },
    {
      title: 'Satu Kata Semangat Positif ⚡',
      instruction: 'Setiap siswa secara berantai menyebutkan 1 kata positif berawalan huruf pertama nama mereka (misal: "Aulia - Aktif!").',
      duration: '2 Menit'
    },
    {
      title: 'Mitos vs Fakta Santai Ruang BK 🧠',
      instruction: 'Lontarkan pertanyaan unik: "Benar nggak sih Guru BK bisa membaca pikiran orang lain tanpa bicara?" Ajak siswa tertawa dan berdiskusi.',
      duration: '3 Menit'
    },
    {
      title: 'Tiga Hal yang Disyukuri Hari Ini 🌈',
      instruction: 'Ajak siswa menyebutkan 3 hal kecil yang bikin bersyukur hari ini (misal: sarapan enak, cuaca adem, ketemu sahabat sekelas).',
      duration: '3 Menit'
    }
  ];

  const handleRandomIceBreaker = () => {
    const randomItem = QUICK_ICE_BREAKERS[Math.floor(Math.random() * QUICK_ICE_BREAKERS.length)];
    setActiveIceBreaker(randomItem);
  };

  // Fetch Daily Companion Briefing (Personal, Warm & Cheerful)
  const fetchAiDailyBriefing = async (cacheKey?: string, forceRefresh = false) => {
    setIsGeneratingBriefing(true);
    try {
      if (forceRefresh && cacheKey) {
        sessionStorage.removeItem(cacheKey);
      }

      const payload = {
        counselorName: counselor?.name || 'Guru BK',
        timeGreeting,
        todayDayName,
      };

      const res = await fetch('/api/gemini/daily-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'briefing', payload })
      });

      const data = await res.json();
      if (data.success && data.message) {
        setBriefingText(data.message);
        if (cacheKey) sessionStorage.setItem(cacheKey, data.message);
      } else {
        const fbMsg = `☕ **${timeGreeting}, ${counselorFirstName}!**\n"Senyuman Guru BK di pagi hari adalah obat terbaik bagi suasana sekolah." Tarik napas dalam-dalam, nikmati kopi hangatmu, dan mari buat hari ini penuh inspirasi! ✨`;
        setBriefingText(fbMsg);
        if (cacheKey) sessionStorage.setItem(cacheKey, fbMsg);
      }
    } catch {
      const fbMsg = `☕ **${timeGreeting}, ${counselorFirstName}!**\nTetap santai, tersenyum hangat, dan nikmati harimu. Kamu adalah pahlawan hebat bagi anak-anak didikmu! 💪✨`;
      setBriefingText(fbMsg);
      if (cacheKey) sessionStorage.setItem(cacheKey, fbMsg);
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  useEffect(() => {
    const cacheKey = `bk_companion_${counselor?.name || 'default'}_${new Date().toDateString()}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setBriefingText(cached);
      return;
    }
    fetchAiDailyBriefing(cacheKey);
  }, [counselor?.name]);

  // Request AI Custom Step-by-Step Workflow Guide
  const handleGenerateCustomWorkflow = async (situationText?: string) => {
    const query = (situationText || customWorkflowQuery).trim();
    if (!query || isGeneratingCustomWorkflow) return;

    setIsGeneratingCustomWorkflow(true);
    try {
      const res = await fetch('/api/gemini/daily-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'workflow-guide',
          payload: {
            topic: query,
            situation: query,
            counselorName: counselor?.name || 'Guru BK'
          }
        })
      });

      const data = await res.json();
      if (data.success && data.data) {
        const generatedWf: WorkflowGuideData = {
          id: `custom-wf-${Date.now()}`,
          title: data.data.title || `Alur Penanganan: ${query}`,
          badge: 'Panduan Khusus AI',
          iconName: 'custom',
          summary: data.data.summary || `Panduan langkah demi langkah yang disesuaikan khusus untuk situasi: "${query}".`,
          steps: data.data.steps || [],
          proTips: data.data.proTips || []
        };
        setCustomWorkflowResult(generatedWf);
        setSelectedWorkflow(generatedWf);
      }
    } catch {
      // Fallback custom workflow
      const fbWf: WorkflowGuideData = {
        id: `custom-wf-${Date.now()}`,
        title: `Alur Penanganan Kasus: ${query}`,
        badge: 'Panduan Cepat',
        iconName: 'custom',
        summary: `Panduan taktis terstruktur langkah demi langkah untuk ${counselorFirstName} dalam menangani situasi: "${query}".`,
        steps: [
          {
            stepNo: 1,
            title: 'Stabilisasi & Pendekatan Awal',
            action: 'Sapa siswa dengan hangat dan ciptakan suasana yang aman untuk berdialog.',
            tips: 'Gunakan komunikasi empatik dan hindari kesan menghakimi.',
            targetForm: 'tambah-layanan',
            targetTabLabel: 'Buka Sesi Konseling'
          },
          {
            stepNo: 2,
            title: 'Eksplorasi Pokok Masalah',
            action: 'Gali informasi secara mendalam dan dengarkan secara aktif dari sudut pandang siswa.',
            tips: 'Identifikasi kebutuhan mendasar yang belum terpenuhi.'
          },
          {
            stepNo: 3,
            title: 'Penyusunan Rencana Aksi Solutif',
            action: 'Ajak siswa merumuskan sendiri komitmen perbaikan atau solusi mandiri.',
            tips: 'Buat target yang realistis dan terukur.'
          },
          {
            stepNo: 4,
            title: 'Dokumentasi & Tindak Lanjut Kolaboratif',
            action: 'Catat hasil sesi ke dalam sistem dan lakukan koordinasi dengan pihak terkait jika diperlukan.',
            tips: 'Pantau perkembangan siswa dalam beberapa hari ke depan.',
            targetTab: 'data-siswa',
            targetTabLabel: 'Cek Rekam Jejak Siswa'
          }
        ],
        proTips: ['Jaga kerahasiaan konseling.', 'Berikan apresiasi atas setiap kemajuan kecil siswa.']
      };
      setCustomWorkflowResult(fbWf);
      setSelectedWorkflow(fbWf);
    } finally {
      setIsGeneratingCustomWorkflow(false);
      setCustomWorkflowQuery('');
    }
  };

  // Chat message submission
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || userQuery).trim();
    if (!query || isAiLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    setChatHistory((prev) => [...prev, userMsg]);
    if (!textToSend) setUserQuery('');
    setIsAiLoading(true);

    try {
      const res = await fetch('/api/gemini/daily-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          payload: {
            userQuery: query,
            counselorName: counselor?.name || 'Guru BK'
          }
        })
      });

      const data = await res.json();
      const aiReply = data.success && data.message
        ? data.message
        : `Siap ${counselorFirstName}! ☕ Berikut langkah praktis yang bisa kamu lakukan:\n\n1️⃣ **Langkah 1**: Tarik napas sejenak dan dengarkan siswa dengan pikiran tenang.\n2️⃣ **Langkah 2**: Ajak siswa berdialog dalam suasana yang aman dan solutif.\n3️⃣ **Langkah 3**: Catat komitmen tindak lanjutnya di aplikasi BK. Tetap semangat! ✨`;

      setChatHistory((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: aiReply,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: `Semangat selalu ya, ${counselorFirstName}! Si Becik selalu siap membimbing langkah demi langkah untuk setiap kasus siswa. Tetap rileks dan percaya diri! ☕✨`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleStepActionClick = (step: WorkflowStep) => {
    if (step.targetForm && onNavigateToForm) {
      onNavigateToForm(step.targetForm);
    } else if (step.targetTab) {
      onNavigateToTab(step.targetTab);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden transition-all duration-300">
      {/* Header Banner - Warm & Cheerful Personal Companion Theme */}
      <div className="bg-gradient-to-r from-[#00685f] via-[#005a52] to-[#0b1c30] text-white p-4 sm:p-5 relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Si Becik Mascot Icon */}
            <CuteAiMascot size="md" />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-300 text-amber-950 font-black text-[11px] flex items-center gap-1 shadow-xs border border-amber-400">
                  <Sparkles className="w-3 h-3 text-amber-800" />
                  Si Becik 🦉 • Asisten Pribadi Guru BK
                </span>
                <span className="text-[11px] text-teal-100/90 font-medium bg-white/10 px-2 py-0.5 rounded-md">
                  {todayDayName}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-1 leading-snug">
                {timeGreeting}, {counselorFirstName}! ☕
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => {
                setIsDrawerOpen(!isDrawerOpen);
                if (!isDrawerOpen) setActiveTab('workflow');
              }}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-97 border border-amber-500/50"
              title="Buka Panduan Alur Kerja Step-by-Step & Konsultasi BK"
            >
              <Compass className="w-4 h-4" />
              <span>Panduan Alur Kerja</span>
            </button>
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title={isMinimized ? 'Bentangkan Asisten' : 'Ciutkan Asisten'}
            >
              {isMinimized ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* AI Friendly Speech Bubble (Warm & Mood-Boosting) */}
        {!isMinimized && (
          <div className="mt-3.5 pt-3 border-t border-white/15 flex items-start gap-2.5 text-xs text-teal-50/95 leading-relaxed font-normal">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5 animate-pulse" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                  ✨ Pesan Semangat Hari Ini
                </span>
                <button
                  type="button"
                  onClick={() => fetchAiDailyBriefing(undefined, true)}
                  disabled={isGeneratingBriefing}
                  className="text-[11px] text-teal-200 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-md font-semibold transition-all flex items-center gap-1 cursor-pointer"
                  title="Segarkan Pesan Penyemangat"
                >
                  <RefreshCw className={`w-3 h-3 ${isGeneratingBriefing ? 'animate-spin' : ''}`} />
                  <span>Segarkan Mood</span>
                </button>
              </div>
              {isGeneratingBriefing ? (
                <div className="flex items-center gap-2 text-teal-200/80 font-medium animate-pulse py-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Si Becik sedang merangkai kata-kata penyemangat hangat untukmu...</span>
                </div>
              ) : (
                <p className="whitespace-pre-line text-xs font-normal leading-relaxed text-teal-50">
                  {briefingText}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ice Breaker Popout Card if active */}
      {!isMinimized && activeIceBreaker && (
        <div className="bg-[#f8faf9] border-b border-[#bcc9c6]/30 p-3 sm:p-4 transition-all">
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-teal-200 rounded-2xl p-3.5 shadow-2xs flex items-start justify-between gap-3"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#00685f]">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{activeIceBreaker.title}</span>
                <span className="text-[10px] bg-teal-50 text-[#00685f] border border-teal-200 px-2 py-0.2 rounded-full font-bold">
                  ⏱️ {activeIceBreaker.duration}
                </span>
              </div>
              <p className="text-xs text-[#3d4947] leading-relaxed">
                {activeIceBreaker.instruction}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveIceBreaker(null)}
              className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      )}

      {/* 🎛️ EXPANDABLE DRAWER: STEP-BY-STEP WORKFLOW ASSISTANT & CHAT */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-[#bcc9c6]/40 bg-[#f8faf9] p-4 sm:p-6 space-y-4"
          >
            {/* Top Navigation Pill Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#bcc9c6]/30">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('workflow')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'workflow'
                      ? 'bg-[#00685f] text-white shadow-2xs'
                      : 'bg-white text-[#3d4947] border border-[#bcc9c6]/40 hover:bg-gray-50'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>🧭 Panduan Alur Kerja (Step-by-Step)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'chat'
                      ? 'bg-[#00685f] text-white shadow-2xs'
                      : 'bg-white text-[#3d4947] border border-[#bcc9c6]/40 hover:bg-gray-50'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>💬 Tanya Asisten Pribadi</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-200/60 cursor-pointer self-end sm:self-auto"
                title="Tutup Panel Asisten"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* TAB 1: INTERACTIVE STEP-BY-STEP WORKFLOW GUIDE */}
            {activeTab === 'workflow' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Horizontal Workflow Selector Chips */}
                <div>
                  <label className="text-xs font-bold text-[#0b1c30] mb-2 block">
                    Pilih Prosedur / Alur Kerja yang Ingin Dipandu:
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {PRESET_BK_WORKFLOWS.map((wf) => {
                      const isSelected = selectedWorkflow.id === wf.id;
                      return (
                        <button
                          key={wf.id}
                          type="button"
                          onClick={() => setSelectedWorkflow(wf)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer border ${
                            isSelected
                              ? 'bg-[#e6f4f1] text-[#00685f] border-[#00685f] shadow-2xs ring-1 ring-[#00685f]/30'
                              : 'bg-white text-[#3d4947] border-[#bcc9c6]/40 hover:border-[#00685f]/40 hover:bg-gray-50'
                          }`}
                        >
                          {wf.iconName === 'restitusi' && <ShieldCheck className="w-3.5 h-3.5 text-[#00685f]" />}
                          {wf.iconName === 'konseling' && <HeartHandshake className="w-3.5 h-3.5 text-teal-600" />}
                          {wf.iconName === 'homevisit' && <Home className="w-3.5 h-3.5 text-indigo-600" />}
                          {wf.iconName === 'ortu' && <PhoneCall className="w-3.5 h-3.5 text-amber-600" />}
                          {wf.iconName === 'absensi' && <Clock className="w-3.5 h-3.5 text-rose-600" />}
                          {wf.iconName === 'mediasi' && <Users className="w-3.5 h-3.5 text-purple-600" />}
                          <span>{wf.title.split('&')[0]}</span>
                        </button>
                      );
                    })}
                    {customWorkflowResult && (
                      <button
                        type="button"
                        onClick={() => setSelectedWorkflow(customWorkflowResult)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer border ${
                          selectedWorkflow.id === customWorkflowResult.id
                            ? 'bg-amber-50 text-amber-900 border-amber-500 shadow-2xs'
                            : 'bg-white text-[#3d4947] border-[#bcc9c6]/40 hover:bg-amber-50/50'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>{customWorkflowResult.title}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Custom AI Workflow Query Generator */}
                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#00685f]" />
                    <span className="text-xs font-bold text-[#0b1c30]">
                      Butuh Panduan Alur Kasus Khusus? Tanyakan ke Si Becik:
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customWorkflowQuery}
                      onChange={(e) => setCustomWorkflowQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleGenerateCustomWorkflow();
                      }}
                      placeholder="Contoh: Ada siswa kecanduan game online hingga sering tidur di kelas, langkah step by step apa yang harus saya lakukan?"
                      className="flex-1 px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-[#0b1c30] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00685f]/30"
                    />
                    <button
                      type="button"
                      onClick={() => handleGenerateCustomWorkflow()}
                      disabled={!customWorkflowQuery.trim() || isGeneratingCustomWorkflow}
                      className="px-3.5 py-2 bg-[#00685f] hover:bg-[#005049] disabled:bg-gray-300 text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-97"
                    >
                      {isGeneratingCustomWorkflow ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyusun Alur...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Buatkan Alur</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Active Workflow Card & Step Checklist */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs space-y-4">
                  {/* Workflow Header Banner */}
                  <div className="pb-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/30 rounded-md text-[10px] font-extrabold uppercase tracking-wide">
                          {selectedWorkflow.badge}
                        </span>
                        <span className="text-xs text-[#64748b] font-medium">
                          {selectedWorkflow.steps.length} Langkah Terstruktur
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-[#0b1c30] mt-1">
                        {selectedWorkflow.title}
                      </h3>
                      <p className="text-xs text-[#3d4947] mt-0.5 leading-relaxed">
                        {selectedWorkflow.summary}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                        {Object.keys(completedSteps).filter((k) => k.startsWith(selectedWorkflow.id) && completedSteps[k]).length} dari {selectedWorkflow.steps.length} Selesai
                      </span>
                    </div>
                  </div>

                  {/* Step-by-Step Flow List */}
                  <div className="space-y-3">
                    {selectedWorkflow.steps.map((step, idx) => {
                      const stepKey = `${selectedWorkflow.id}_step_${step.stepNo}`;
                      const isDone = !!completedSteps[stepKey];

                      return (
                        <div
                          key={step.stepNo}
                          className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                            isDone
                              ? 'bg-emerald-50/50 border-emerald-300 text-emerald-950'
                              : 'bg-[#f8faf9] border-gray-200 hover:border-[#00685f]/40'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Step Number & Checkbox */}
                            <button
                              type="button"
                              onClick={() => toggleStepCompleted(stepKey)}
                              className="mt-0.5 text-gray-400 hover:text-emerald-600 transition-colors cursor-pointer shrink-0"
                              title={isDone ? 'Tandai belum selesai' : 'Tandai langkah ini selesai'}
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-[#00685f] text-[#00685f] flex items-center justify-center font-bold text-[10px]">
                                  {step.stepNo}
                                </div>
                              )}
                            </button>

                            {/* Step Content */}
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <h4 className={`text-xs font-extrabold ${isDone ? 'text-emerald-900 line-through' : 'text-[#0b1c30]'}`}>
                                  Langkah {step.stepNo}: {step.title}
                                </h4>
                                {(step.targetTabLabel || step.targetTab || step.targetForm) && (
                                  <button
                                    type="button"
                                    onClick={() => handleStepActionClick(step)}
                                    className="text-[11px] font-bold text-[#00685f] hover:text-[#005049] hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                                  >
                                    <span>{step.targetTabLabel || 'Buka Modul Terkait'}</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              <p className="text-xs text-[#3d4947] leading-relaxed">
                                {step.action}
                              </p>

                              {step.tips && (
                                <div className="bg-amber-50/80 border border-amber-200/80 rounded-lg p-2 text-[11px] text-amber-900 flex items-start gap-1.5 mt-1">
                                  <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                  <span className="leading-snug"><strong>Tips Si Becik:</strong> {step.tips}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pro Tips Footer */}
                  {selectedWorkflow.proTips && selectedWorkflow.proTips.length > 0 && (
                    <div className="p-3 bg-teal-50/80 border border-teal-200 rounded-xl space-y-1 text-xs text-teal-950">
                      <div className="flex items-center gap-1.5 font-bold text-[#00685f]">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Catatan Penting Guru BK:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[#3d4947] pl-1">
                        {selectedWorkflow.proTips.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: PERSONAL BK AI CONSULTATION & CHAT */}
            {activeTab === 'chat' && (
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <CuteAiMascot size="sm" />
                    <div>
                      <h4 className="text-xs font-extrabold text-[#0b1c30] flex items-center gap-1.5">
                        <span>Konsultasi & Asisten Pribadi bersama Si Becik 🦉</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[9px] font-black">Online</span>
                      </h4>
                      <p className="text-[10px] text-[#3d4947]">Tanyakan langkah alur penanganan, tips menghadapi siswa, atau sekadar bertukar pikiran secara privat</p>
                    </div>
                  </div>
                </div>

                {/* Quick Question Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => handleSendMessage('Bantu langkah-langkah alur penanganan siswa yang nilainya turun drastis dan sering melamun')}
                    className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-[#00685f] border border-[#00685f]/30 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0"
                  >
                    🧭 Alur Siswa Melamun & Nilai Turun
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage('Bagaimana cara menengahi 2 siswa yang bertengkar di kelas dengan pendekatan restitusi?')}
                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0"
                  >
                    🤝 Alur Mediasi Restitusi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage('Berikan humor santai dan kata-kata penyemangat kerja untuk Guru BK hari ini!')}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0"
                  >
                    ☕ Humor & Semangat BK
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage('Tips pendekatan ramah saat memanggil orang tua siswa yang sensitif')}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0"
                  >
                    📞 Tips Panggil Orang Tua
                  </button>
                </div>

                {/* Chat Message Box */}
                <div className="max-h-64 overflow-y-auto space-y-3 p-3.5 bg-[#f8faf9] rounded-xl border border-gray-200/80">
                  {chatHistory.length === 0 ? (
                    <div className="text-center py-4 space-y-2">
                      <CuteAiMascot size="md" className="mx-auto" />
                      <p className="text-xs font-bold text-[#0b1c30]">Halo kawan {counselorFirstName}! Ada situasi apa yang perlu kita cari langkah solusinya bersama?</p>
                      <p className="text-[10px] text-[#3d4947]">
                        Tanyakan apa saja seputar alur kerja BK, penanganan murid, atau ketik curhatan santaimu di bawah!
                      </p>
                    </div>
                  ) : (
                    chatHistory.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.sender === 'ai' && (
                          <div className="w-6 h-6 rounded-full bg-[#00685f] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            AI
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                            msg.sender === 'user'
                              ? 'bg-[#00685f] text-white rounded-tr-xs shadow-2xs font-medium'
                              : 'bg-white text-[#0b1c30] border border-gray-200 rounded-tl-xs shadow-2xs whitespace-pre-line'
                          }`}
                        >
                          <p>{msg.text}</p>
                          <span
                            className={`text-[9px] block text-right mt-1 ${
                              msg.sender === 'user' ? 'text-white/70' : 'text-gray-400'
                            }`}
                          >
                            {msg.timestamp}
                          </span>
                        </div>
                      </div>
                    ))
                  )}

                  {isAiLoading && (
                    <div className="flex items-center gap-2 text-xs text-[#00685f] font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Si Becik 🦉 sedang menyusun panduan langkah demi langkah untukmu...</span>
                    </div>
                  )}
                </div>

                {/* Input Bar */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendMessage();
                    }}
                    placeholder="Ketik pertanyaan alur BK, situasi kasus siswa, atau minta tips ke Si Becik..."
                    className="flex-1 px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-[#0b1c30] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00685f]/30"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!userQuery.trim() || isAiLoading}
                    className="px-3.5 py-2 bg-[#00685f] hover:bg-[#005049] disabled:bg-gray-300 text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1 active:scale-97"
                  >
                    <span>Kirim</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
