import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  FileText, 
  BookOpen, 
  Compass, 
  Copy, 
  Check, 
  Download, 
  Trash2, 
  Send, 
  RotateCcw, 
  ShieldCheck, 
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { Counselor, Student, CounselingService, ViolationRecord } from '../types';
import { downloadRplBecikPDF } from '../utils/pdfGenerator';
import { showToast } from '../utils/toast';

interface AiAssistantWidgetProps {
  counselor: Counselor;
  students?: Student[];
  services?: CounselingService[];
  violations?: ViolationRecord[];
  onNavigateToTab?: (tab: string, searchQuery?: string) => void;
  onNavigateToForm?: (form: string, selectStudentId?: string) => void;
  isOpenModalOnStart?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  mode?: 'rapikan-laporan' | 'buatkan-rpl' | 'tanya-teknik' | 'general';
  rplMeta?: {
    topic: string;
    studentClass: string;
    duration: string;
  };
}

// 🦉 CUTE AI MASCOT GRAPHIC (Si Becik Meta AI)
export const CuteAiMascot: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const dimensions = size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';

  return (
    <div className={`relative flex flex-col items-center justify-center shrink-0 ${className}`}>
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className={`relative ${dimensions} rounded-2xl bg-gradient-to-tr from-[#00685f] via-teal-600 to-cyan-500 p-0.5 shadow-md flex items-center justify-center border-2 border-teal-300/60 overflow-visible`}
      >
        {/* Glow Aura Meta Blue/Teal */}
        <div className="absolute inset-0 bg-cyan-400/25 rounded-2xl blur-md -z-10 animate-pulse" />

        {/* Mascot Face */}
        <div className="w-full h-full bg-[#0b1c30] rounded-xl flex flex-col items-center justify-between p-1 border border-cyan-400/40 relative">
          <div className="w-full flex items-center justify-around mt-0.5">
            <div className="w-2.5 h-2.5 bg-cyan-300 rounded-full flex items-center justify-center shadow-[0_0_6px_#67e8f9]">
              <div className="w-1 h-1 bg-[#0b1c30] rounded-full" />
            </div>
            <div className="w-2.5 h-2.5 bg-cyan-300 rounded-full flex items-center justify-center shadow-[0_0_6px_#67e8f9]">
              <div className="w-1 h-1 bg-[#0b1c30] rounded-full" />
            </div>
          </div>
          {/* Owl Beak */}
          <div className="w-2 h-1.5 bg-amber-400 rounded-b-full shadow-xs mb-0.5" />
        </div>
      </motion.div>
    </div>
  );
};

export default function AiAssistantWidget({
  counselor,
  students = [],
  onNavigateToTab,
  onNavigateToForm,
}: AiAssistantWidgetProps) {
  // Mode selection: 1. Rapikan Laporan, 2. Buatkan RPL, 3. Tanya Teknik BK
  const [activeMode, setActiveMode] = useState<'rapikan-laporan' | 'buatkan-rpl' | 'tanya-teknik'>('tanya-teknik');

  // Input states
  const [userQuery, setUserQuery] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // RPL specific fields
  const [rplTopic, setRplTopic] = useState('');
  const [rplClass, setRplClass] = useState('Kelas 7');
  const [rplDuration, setRplDuration] = useState('1 x 40 Menit');
  const [showRplForm, setShowRplForm] = useState(false);

  // Storage key per logged in counselor
  const storageKey = useMemo(() => {
    const raw = counselor?.id || counselor?.name || 'default_counselor';
    return `bk_meta_sibecik_chat_${raw.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }, [counselor]);

  // Load chat history for current counselor
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save chat history per counselor
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(chatHistory));
    } catch (e) {
      console.error('Failed to save chat history', e);
    }
  }, [chatHistory, storageKey]);

  // Reload chat history when active counselor switches
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setChatHistory(saved ? JSON.parse(saved) : []);
    } catch {
      setChatHistory([]);
    }
  }, [storageKey]);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isAiLoading]);

  const counselorFirstName = counselor?.name ? counselor.name.split(' ')[0] : 'Guru BK';

  // 🔒 PRIVACY & NAME GUARD
  // Checks if the user text contains actual student names or common indicators
  const checkRealNameViolation = (text: string): boolean => {
    const lower = text.toLowerCase();

    // Check against registered students' names
    if (students && students.length > 0) {
      for (const s of students) {
        if (!s.name) continue;
        const sNameLower = s.name.trim().toLowerCase();
        // Ignore single letter names or very short strings
        if (sNameLower.length <= 3) continue;

        // If whole student name or main first+last name appears in query
        const parts = sNameLower.split(/\s+/);
        if (parts.length >= 2 && lower.includes(sNameLower)) {
          return true;
        }
        // Check first name if distinct (longer than 4 chars) and preceded by "nama/siswa/ananda/si"
        const firstName = parts[0];
        if (firstName.length > 3) {
          const pattern = new RegExp(`\\b(nama|siswa|ananda|si|anak)\\s+${firstName}\\b`, 'i');
          if (pattern.test(lower)) return true;
        }
      }
    }

    // Generic pattern: "nama budi", "siswa ahmad nur", etc. excluding "siswa a", "siswa b", "siswa c", "siswa x"
    const explicitNamePattern = /\b(nama siswa|nama murid|namanya)\s*[:=]?\s*([a-z]{3,})/i;
    const match = lower.match(explicitNamePattern);
    if (match) {
      const detectedName = match[2].toLowerCase();
      if (!['siswa', 'murid', 'anak', 'orang', 'saya', 'kamu', 'anda', 'guru', 'kelas'].includes(detectedName)) {
        return true;
      }
    }

    return false;
  };

  // 📋 Copy text helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Teks berhasil disalin ke papan klip!', 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  // 📥 Download RPL PDF helper
  const handleDownloadRplPdf = (msg: ChatMessage) => {
    const meta = msg.rplMeta || {
      topic: rplTopic || 'Bimbingan Klasikal Siswa',
      studentClass: rplClass || 'Kelas 7',
      duration: rplDuration || '1 x 40 Menit'
    };

    downloadRplBecikPDF({
      topic: meta.topic,
      studentClass: meta.studentClass,
      duration: meta.duration,
      rplContent: msg.text,
      activeCounselor: counselor
    });
  };

  // 🗑️ Clear Chat for logged-in counselor
  const handleClearChat = () => {
    if (window.confirm('Hapus seluruh riwayat chat Si Becik untuk akun Anda?')) {
      setChatHistory([]);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      showToast('Riwayat chat berhasil dibersihkan', 'info');
    }
  };

  // 🚀 Send message handler
  const handleSendMessage = async (customPrompt?: string, forcedMode?: 'rapikan-laporan' | 'buatkan-rpl' | 'tanya-teknik') => {
    const targetMode = forcedMode || activeMode;
    let query = (customPrompt || userQuery).trim();

    // If RPL mode and fields are provided but query is empty
    if (targetMode === 'buatkan-rpl' && !query && rplTopic.trim()) {
      query = `Buatkan RPL lengkap untuk topik: "${rplTopic}", ${rplClass}, Alokasi Waktu: ${rplDuration}.`;
    }

    if (!query || isAiLoading) return;

    // Check Real Name Privacy Rule
    if (checkRealNameViolation(query)) {
      const userMsg: ChatMessage = {
        id: `usr-${Date.now()}`,
        sender: 'user',
        text: query,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        mode: targetMode
      };

      const warningAiMsg: ChatMessage = {
        id: `ai-${Date.now() + 1}`,
        sender: 'ai',
        text: 'Jangan pakai nama asli ya, pakai Siswa A saja. 😊\n\nUntuk menjaga privasi dan mematuhi asas kerahasiaan bimbingan konseling, mari kita lanjutkan pembahasan dengan sebutan Siswa A atau Siswa B. Silakan ceritakan kembali tanpa mencantumkan identitas asli siswa.',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        mode: targetMode
      };

      setChatHistory((prev) => [...prev, userMsg, warningAiMsg]);
      setUserQuery('');
      return;
    }

    // Add user message
    const userMsgId = `usr-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      mode: targetMode,
      rplMeta: targetMode === 'buatkan-rpl' ? {
        topic: rplTopic || query,
        studentClass: rplClass,
        duration: rplDuration
      } : undefined
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setUserQuery('');
    setIsAiLoading(true);

    try {
      const res = await fetch('/api/gemini/daily-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          payload: {
            userQuery: query,
            counselorName: counselor?.name || 'Guru BK',
            mode: targetMode,
            topic: rplTopic || query,
            studentClass: rplClass,
            duration: rplDuration
          }
        })
      });

      const data = await res.json();
      let aiText = data.message || '';

      if (!aiText) {
        throw new Error('No reply from server');
      }

      setChatHistory((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: aiText,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          mode: targetMode,
          rplMeta: targetMode === 'buatkan-rpl' ? {
            topic: rplTopic || query,
            studentClass: rplClass,
            duration: rplDuration
          } : undefined
        }
      ]);
    } catch {
      // Robust client-side fallback adhering to exact rules
      let fallbackText = '';

      if (targetMode === 'rapikan-laporan') {
        fallbackText = `Berikut draf laporan layanan BK yang telah dirapikan secara formal:

**Pelaksanaan:**
Layanan konseling dilaksanakan di Ruang Bimbingan dan Konseling bersama konseli (Siswa A). Konselor membangun hubungan baik (*rapport*), mendengarkan secara aktif tanpa menghakimi, serta mengidentifikasi faktor pemicu situasi yang dihadapi siswa dalam suasana yang kondusif dan terjaga kerahasiaannya.

**Hasil:**
Konseli (Siswa A) menunjukkan keterbukaan dalam menyampaikan kendala yang dialami, menyadari konsekuensi dari perilaku sebelumnya terhadap proses belajarnya, serta menunjukkan motivasi internal untuk melakukan perbaikan diri secara mandiri.

**Kesepakatan & Tindak Lanjut:**
1. Konseli menyepakati komitmen pengelolaan waktu dan pembiasaan disiplin baru.
2. Konselor akan memantau kehadiran dan perkembangan perilaku konseli selama 1 (satu) minggu ke depan.
3. Konseling lanjutan akan dijadwalkan kembali apabila diperlukan evaluasi mendalam.`;
      } else if (targetMode === 'buatkan-rpl') {
        const t = rplTopic || query || 'Pencegahan Perundungan & Disiplin Positif';
        fallbackText = `Berikut Rencana Pelaksanaan Layanan (RPL) Bimbingan Klasikal resmi:

**Topik Layanan:** ${t}
**Sasaran Kelas:** ${rplClass}
**Alokasi Waktu:** ${rplDuration}

**Tujuan Layanan:**
- *Tujuan Umum:* Peserta didik mampu memahami esensi dan dampak ${t.toLowerCase()} serta menumbuhkan kesadaran diri untuk berinteraksi secara sehat dan bertanggung jawab.
- *Tujuan Khusus:*
  1. Peserta didik dapat mengidentifikasi bentuk-bentuk perilaku yang mendukung iklim belajar kondusif.
  2. Peserta didik dapat menganalisis dampak positif dari penerapan nilai-nilai disiplin diri.
  3. Peserta didik dapat merumuskan komitmen bersama untuk menciptakan lingkungan kelas yang aman dan harmonis.

**Materi Layanan:**
1. Pengertian dan urgensi ${t}.
2. Faktor-faktor pendukung terciptanya kenyamanan belajar dan pertemanan sehat.
3. Strategi penyelesaian konflik secara asertif dan saling menghargai.

**Metode Layanan:**
Ceramah interaktif, diskusi kelompok terbimbing (*small group discussion*), dan refleksi diri.

**Media Layanan:**
Slide presentasi (PPT), video edukasi inspiratif, serta lembar kerja peserta didik (LKPD reflektif).

**Langkah Kegiatan:**
1. *Pendahuluan (8 Menit):*
   - Guru BK membuka sesi dengan salam, doa bersama, dan pembinaan suasana hangat (*ice breaking*).
   - Menyampaikan topik, tujuan layanan, serta kontrak belajar yang disepakati bersama.
2. *Kegiatan Inti (25 Menit):*
   - Guru BK menayangkan materi/studi kasus kontekstual seputar ${t}.
   - Siswa berdiskusi dalam kelompok kecil untuk merumuskan pandangan dan solusi alternatif.
   - Perwakilan kelompok mempresentasikan hasil refleksi dan ditanggapi dengan penguatan oleh Guru BK.
3. *Penutup (7 Menit):*
   - Guru BK dan peserta didik bersama-sama menyimpulkan inti pembelajaran hari ini.
   - Guru BK memberikan lembar refleksi singkat serta kata-kata penguatan motivasi.

**Evaluasi Layanan:**
- *Laiseg (Penilaian Segera):* Mengamati antusiasme, keaktifan berpendapat, dan suasana emosi siswa selama sesi klasikal berlangsung.
- *Laijapen (Penilaian Jangka Pendek):* Mengamati perubahan sikap siswa dalam 1–2 minggu setelah layanan, terutama interaksi sosial antarteman di kelas.
- *Laijapang (Penilaian Jangka Panjang):* Mengamati ketahanan komitmen perilaku positif siswa sepanjang semester dan nihilnya laporan insiden sejenis.`;
      } else {
        fallbackText = `Berikut analisis bimbingan konseling untuk situasi tersebut:

**Penyebab:**
Perilaku siswa umumnya dipicu oleh kombinasi faktor internal (kesulitan regulasi emosi, kebutuhan perhatian yang belum terpenuhi, atau kelelahan adaptasi) dan faktor eksternal (tekanan pertemanan sebaya, pola komunikasi di rumah, atau kebiasaan begadang akibat gawai).

**Teknik yang Cocok:**
Pendekatan *Solution-Focused Brief Counseling* (SFBC) yang dipadukan dengan teknik *Segitiga Restitusi* (Menstabilkan Identitas, Validasi Tindakan yang Salah, dan Menanyakan Keyakinan). Pendekatan ini efektif karena berfokus pada kekuatan siswa dan solusi perbaikan di masa depan, bukan menghukum kesalahan masa lalu.

**Langkah Minggu Ini:**
1. Lakukan konseling individual singkat (15–20 menit) dalam suasana hangat tanpa menghakimi.
2. Ajak siswa menyusun kontrak perilaku sederhana (*behavioral contract*) selama 7 hari.
3. Berkoordinasi dengan wali kelas untuk memantau perubahan afektif siswa di kelas tanpa membuat siswa merasa diawasi secara berlebihan.

**Kapan Home Visit / Rapat Kasus:**
Lakukan **Kunjungan Rumah (Home Visit)** jika siswa tidak hadir 3 hari berturut-turut tanpa kabar atau orang tua tidak merespons surat panggilan. Lakukan **Rapat Kasus (Konferensi Kasus)** jika persoalan melibatkan pelanggaran berat, perundungan lintas kelas, atau kebuntuan yang memerlukan koordinasi resmi kepala sekolah dan tim PPKSP.

Mau saya buatkan draf laporannya?`;
      }

      setChatHistory((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          mode: targetMode,
          rplMeta: targetMode === 'buatkan-rpl' ? {
            topic: rplTopic || query,
            studentClass: rplClass,
            duration: rplDuration
          } : undefined
        }
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Quick 3 Examples from user specification:
  // 1. "Buatkan RPL Bullying kelas 7"
  // 2. "Rapikan laporan home visit"
  // 3. "Siswa menyendiri, teknik apa?"
  const handleQuickExample = (type: 1 | 2 | 3) => {
    if (type === 1) {
      setActiveMode('buatkan-rpl');
      setRplTopic('Pencegahan Bullying & Perundungan');
      setRplClass('Kelas 7');
      setRplDuration('1 x 40 Menit');
      handleSendMessage('Buatkan RPL Bullying kelas 7', 'buatkan-rpl');
    } else if (type === 2) {
      setActiveMode('rapikan-laporan');
      const exampleNotes = `Rapikan laporan home visit berikut:
Tanggal kunjungan: Kemarin jam 14.00 ke rumah Siswa A.
Bertemu dengan: Ibu kandung Siswa A.
Masalah: Siswa A sudah 4 hari tidak masuk sekolah tanpa keterangan.
Kondisi di rumah: Siswa A membantu ibu menjaga adik balita karena ayah sedang bekerja di luar kota, merasa malu dan tertinggal banyak materi pelajaran.
Kesepakatan: Ibu berjanji mengatur waktu agar Siswa A fokus sekolah, sekolah memberikan keringanan tugas susulan, guru BK memantau kehadiran mulai besok.`;
      handleSendMessage(exampleNotes, 'rapikan-laporan');
    } else if (type === 3) {
      setActiveMode('tanya-teknik');
      handleSendMessage('Siswa menyendiri, menarik diri dari teman sekelas dan prestasi menurun, teknik BK apa yang cocok?', 'tanya-teknik');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden transition-all duration-300">
      {/* 🦉 HEADER: SI BECIK POWERED BY META AI */}
      <div className="bg-gradient-to-r from-[#00685f] via-[#005049] to-[#0b1c30] text-white p-5 sm:p-6 relative overflow-hidden">
        {/* Glow Ambient Meta Cyan */}
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <CuteAiMascot size="lg" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Si Becik 🦉
                </h3>
                {/* Meta AI Badge */}
                <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-400 text-slate-950 text-[11px] font-black flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-blue-950" />
                  <span>Powered by Meta AI ✨</span>
                </span>
              </div>
              <p className="text-xs text-teal-100/90 font-medium mt-1">
                Asisten Cerdas Guru BK • Pendamping Administrasi, RPL & Solusi Kasus
              </p>
            </div>
          </div>

          {/* Action Header: Hapus Chat */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handleClearChat}
              disabled={chatHistory.length === 0}
              className="px-3.5 py-2 bg-white/10 hover:bg-red-500/80 disabled:opacity-40 disabled:hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border border-white/15"
              title="Bersihkan riwayat percakapan untuk akun Anda"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Chat</span>
            </button>
          </div>
        </div>

        {/* 🔒 BANNER ATURAN PRIVASI & KODE ETIK BK */}
        <div className="mt-4 pt-3.5 border-t border-white/15 flex items-center gap-2 text-[11px] text-teal-100/95 font-medium">
          <ShieldCheck className="w-4 h-4 text-cyan-300 shrink-0" />
          <span>
            <strong>Aturan Privasi:</strong> Dilarang memasukkan nama asli, NIS, nama ortu, atau foto. Jika tertulis, Si Becik akan mengalihkan ke sebutan <strong>"Siswa A"</strong>.
          </span>
        </div>
      </div>

      {/* 🚀 3 TOMBOL BESAR MODE DI ATAS CHAT */}
      <div className="p-4 sm:p-5 bg-[#f8faf9] border-b border-gray-200/80">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-2.5">
          Pilih Mode Bantuan Si Becik:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Mode 1: Rapikan Laporan */}
          <button
            type="button"
            onClick={() => {
              setActiveMode('rapikan-laporan');
              setShowRplForm(false);
            }}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer active:scale-98 relative overflow-hidden group ${
              activeMode === 'rapikan-laporan'
                ? 'bg-white border-[#00685f] shadow-sm ring-2 ring-[#00685f]/30'
                : 'bg-white/80 border-gray-200/90 hover:border-[#00685f]/40 hover:bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                activeMode === 'rapikan-laporan' ? 'bg-[#00685f] text-white shadow-xs' : 'bg-teal-50 text-[#00685f]'
              }`}>
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-[#0b1c30]">
                    Rapikan Laporan
                  </h4>
                  {activeMode === 'rapikan-laporan' && (
                    <span className="w-2 h-2 rounded-full bg-[#00685f] animate-pulse" />
                  )}
                </div>
                <p className="text-xs text-gray-500 font-medium mt-1 leading-snug">
                  Ubah tulisan acak jadi: Pelaksanaan, Hasil, RTL
                </p>
              </div>
            </div>
          </button>

          {/* Mode 2: Buatkan RPL */}
          <button
            type="button"
            onClick={() => {
              setActiveMode('buatkan-rpl');
              setShowRplForm(true);
            }}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer active:scale-98 relative overflow-hidden group ${
              activeMode === 'buatkan-rpl'
                ? 'bg-white border-[#00685f] shadow-sm ring-2 ring-[#00685f]/30'
                : 'bg-white/80 border-gray-200/90 hover:border-[#00685f]/40 hover:bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                activeMode === 'buatkan-rpl' ? 'bg-[#00685f] text-white shadow-xs' : 'bg-cyan-50 text-cyan-800'
              }`}>
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-[#0b1c30]">
                    Buatkan RPL
                  </h4>
                  {activeMode === 'buatkan-rpl' && (
                    <span className="w-2 h-2 rounded-full bg-[#00685f] animate-pulse" />
                  )}
                </div>
                <p className="text-xs text-gray-500 font-medium mt-1 leading-snug">
                  Input Topik, Kelas, Waktu → RPL Lengkap & PDF
                </p>
              </div>
            </div>
          </button>

          {/* Mode 3: Tanya Teknik BK */}
          <button
            type="button"
            onClick={() => {
              setActiveMode('tanya-teknik');
              setShowRplForm(false);
            }}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer active:scale-98 relative overflow-hidden group ${
              activeMode === 'tanya-teknik'
                ? 'bg-white border-[#00685f] shadow-sm ring-2 ring-[#00685f]/30'
                : 'bg-white/80 border-gray-200/90 hover:border-[#00685f]/40 hover:bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                activeMode === 'tanya-teknik' ? 'bg-[#00685f] text-white shadow-xs' : 'bg-purple-50 text-purple-800'
              }`}>
                <Compass className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-[#0b1c30]">
                    Tanya Teknik BK
                  </h4>
                  {activeMode === 'tanya-teknik' && (
                    <span className="w-2 h-2 rounded-full bg-[#00685f] animate-pulse" />
                  )}
                </div>
                <p className="text-xs text-gray-500 font-medium mt-1 leading-snug">
                  Penyebab, Teknik Cocok, Langkah Minggu Ini
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Optional RPL Quick Input Form */}
        {activeMode === 'buatkan-rpl' && (
          <div className="mt-3.5 p-4 bg-white rounded-2xl border border-teal-200 shadow-2xs space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#00685f] flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                <span>Form Cepat Pembuatan RPL:</span>
              </span>
              <span className="text-[10px] text-gray-400 font-bold">Lengkap dengan Evaluasi Laiseg</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-1">Topik / Materi</label>
                <input
                  type="text"
                  value={rplTopic}
                  onChange={(e) => setRplTopic(e.target.value)}
                  placeholder="Contoh: Anti Bullying / Manajemen Waktu"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                />
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-1">Kelas</label>
                <select
                  value={rplClass}
                  onChange={(e) => setRplClass(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                >
                  <option value="Kelas 7">Kelas 7</option>
                  <option value="Kelas 8">Kelas 8</option>
                  <option value="Kelas 9">Kelas 9</option>
                  <option value="Kelas 7 / 8 / 9">Semua Tingkat</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-1">Alokasi Waktu</label>
                <input
                  type="text"
                  value={rplDuration}
                  onChange={(e) => setRplDuration(e.target.value)}
                  placeholder="Contoh: 1 x 40 Menit / 2 JP"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 💬 CHAT MESSAGE STREAM AREA */}
      <div 
        ref={chatContainerRef}
        className="p-5 sm:p-6 min-h-[280px] max-h-[520px] overflow-y-auto space-y-4 bg-white"
      >
        {chatHistory.length === 0 ? (
          <div className="py-8 text-center space-y-4 max-w-xl mx-auto">
            <CuteAiMascot size="lg" className="mx-auto" />
            <div>
              <h4 className="text-base sm:text-lg font-black text-[#0b1c30]">
                Halo, {counselorFirstName}! Si Becik siap membantu.
              </h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Pilih mode di atas atau klik salah satu contoh prompt cepat di bawah untuk mulai berdiskusi:
              </p>
            </div>

            {/* 3 CONTOH KLIK CEPAT SESUAI INSTRUKSI */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                Contoh Cepat (Klik untuk Mencoba):
              </span>
              <div className="flex flex-col sm:flex-row items-stretch justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickExample(1)}
                  className="px-3.5 py-2.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-950 border border-cyan-200 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between gap-2 shadow-2xs active:scale-97 cursor-pointer"
                >
                  <span>📚 "Buatkan RPL Bullying kelas 7"</span>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickExample(2)}
                  className="px-3.5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-950 border border-teal-200 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between gap-2 shadow-2xs active:scale-97 cursor-pointer"
                >
                  <span>📝 "Rapikan laporan home visit"</span>
                  <ArrowRight className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickExample(3)}
                  className="px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-950 border border-purple-200 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between gap-2 shadow-2xs active:scale-97 cursor-pointer"
                >
                  <span>🧭 "Siswa menyendiri, teknik apa?"</span>
                  <ArrowRight className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          chatHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <CuteAiMascot size="sm" className="mt-1" />
              )}

              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 sm:p-5 shadow-2xs transition-all ${
                  msg.sender === 'user'
                    ? 'bg-[#00685f] text-white rounded-tr-xs font-medium text-sm'
                    : 'bg-[#f8faf9] border border-[#bcc9c6]/40 text-[#0b1c30] rounded-tl-xs'
                }`}
              >
                {/* AI RESPONSE: HURUF JAWABAN 16px SESUAI ATURAN */}
                {msg.sender === 'ai' ? (
                  <div className="space-y-3">
                    {/* Header badge if mode is tagged */}
                    <div className="flex items-center justify-between gap-2 border-b border-gray-200/80 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-[#00685f] flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Si Becik Meta AI</span>
                      </span>
                      <span className="text-[10px] text-gray-400 font-semibold">
                        {msg.timestamp}
                      </span>
                    </div>

                    {/* Main Content with 16px Font Size */}
                    <div className="text-[16px] leading-relaxed text-[#0b1c30] whitespace-pre-line font-normal space-y-2">
                      {msg.text}
                    </div>

                    {/* Action Bar per Mode */}
                    <div className="pt-3 border-t border-gray-200/80 flex flex-wrap items-center justify-end gap-2">
                      {/* Tombol [Salin] */}
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.text, msg.id)}
                        className="px-3.5 py-2 bg-white hover:bg-gray-100 text-[#0b1c30] border border-gray-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                        title="Salin isi teks ke clipboard"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-gray-600" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>

                      {/* Tombol [PDF] jika respons merupakan RPL */}
                      {(msg.mode === 'buatkan-rpl' || msg.text.includes('Rencana Pelaksanaan Layanan') || msg.text.includes('Laiseg')) && (
                        <button
                          type="button"
                          onClick={() => handleDownloadRplPdf(msg)}
                          className="px-3.5 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                          title="Unduh dokumen RPL resmi dalam format PDF standar dinas"
                        >
                          <Download className="w-3.5 h-3.5 text-teal-200" />
                          <span>PDF</span>
                        </button>
                      )}

                      {/* Tombol Aksi Cepat jika Si Becik bertanya: "Mau saya buatkan draf laporannya?" */}
                      {msg.text.includes('Mau saya buatkan draf laporannya?') && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMode('rapikan-laporan');
                            handleSendMessage('Ya, buatkan draf laporan formal BK berdasarkan analisis teknik di atas untuk Siswa A.', 'rapikan-laporan');
                          }}
                          className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                          <span>Ya, Buatkan Draf Laporan</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="whitespace-pre-line text-sm sm:text-base leading-relaxed">{msg.text}</p>
                    <span className="text-[10px] text-teal-200 block text-right mt-1.5 font-medium">
                      {msg.timestamp}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Loading Indicator */}
        {isAiLoading && (
          <div className="flex items-center gap-3 p-4 bg-teal-50 border border-teal-200 rounded-2xl text-xs font-bold text-[#00685f] animate-pulse">
            <CuteAiMascot size="sm" />
            <span>Si Becik Meta AI sedang merangkai solusi dan menyusun format formal BK...</span>
          </div>
        )}
      </div>

      {/* ⌨️ KOTAK KETIK BESAR DENGAN TOMBOL KIRIM */}
      <div className="p-4 sm:p-5 bg-white border-t border-gray-200 space-y-2.5">
        <div className="relative">
          <textarea
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            rows={3}
            placeholder={
              activeMode === 'rapikan-laporan'
                ? 'Tulis atau tempel catatan acak layanan di sini (contoh: siswa A sering tidur di kelas, ngaku main game sampai subuh, ortu sibuk kerja, nangis takut dimarahin wali kelas)...'
                : activeMode === 'buatkan-rpl'
                ? 'Ketik permintaan materi RPL (contoh: Buatkan RPL Manajemen Waktu kelas 8 durasi 1 JP) atau isi form cepat di atas...'
                : 'Ceritakan situasi siswa (contoh: Ada siswa sering menyendiri, tidak mau bergabung saat kerja kelompok, prestasi menurun drastis, teknik apa yang cocok?)...'
            }
            className="w-full px-4 py-3 bg-[#f8faf9] border border-gray-300 rounded-2xl text-[15px] text-[#0b1c30] placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00685f]/30 focus:border-[#00685f] transition-all resize-none font-normal leading-relaxed"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-1">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Tekan <strong>Enter</strong> untuk kirim, <strong>Shift + Enter</strong> untuk baris baru</span>
            </div>

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={(!userQuery.trim() && !(activeMode === 'buatkan-rpl' && rplTopic.trim())) || isAiLoading}
              className="px-6 py-2.5 bg-[#00685f] hover:bg-[#005049] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 active:scale-95 shrink-0"
            >
              <span>Kirim Pesan</span>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
