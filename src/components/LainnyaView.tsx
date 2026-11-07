import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  FileText, 
  Columns3, 
  Share2, 
  UserCheck, 
  Settings, 
  Database, 
  Award, 
  BookOpen, 
  HelpCircle, 
  Sparkles,
  ChevronRight,
  ShieldCheck,
  LogOut,
  FolderSync,
  Bot,
  Mail
} from 'lucide-react';
import { Counselor } from '../types';
import PanduanBskap2022Modal from './PanduanBskap2022Modal';
import UserManualModal from './UserManualModal';

interface LainnyaViewProps {
  onNavigate: (view: string) => void;
  activeCounselor?: Counselor;
  onLogout?: () => void;
}

export const LainnyaView: React.FC<LainnyaViewProps> = ({
  onNavigate,
  activeCounselor,
  onLogout,
}) => {
  const [showBskapModal, setShowBskapModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAlihTanganModal, setShowAlihTanganModal] = useState(false);
  const [showPilarModal, setShowPilarModal] = useState(false);

  // Grouped Menu Items as required:
  // "Program Tahunan, RPL, Pilar 1-4, Sosiometri Lanjutan, Alih Tangan Kasus, Pengaturan, Backup Data"
  const administrasiItems = [
    {
      id: 'prota',
      title: 'Program Tahunan (Prota)',
      desc: 'Rencana kerja operasional bimbingan konseling tahunan & semester',
      icon: <Calendar className="w-5 h-5 text-teal-600" />,
      tag: 'Perencanaan',
      action: () => onNavigate('laporan-rekap'),
    },
    {
      id: 'rpl',
      title: 'RPL (Rencana Pelaksanaan Layanan)',
      desc: 'Format RPL 1 Lembar Kurikulum Merdeka untuk bimbingan klasikal & kelompok',
      icon: <FileText className="w-5 h-5 text-blue-600" />,
      tag: 'RPL BK',
      action: () => onNavigate('studio-pdf'),
    },
    {
      id: 'pilar',
      title: 'Pilar 1-4 Bimbingan Konseling',
      desc: 'Layanan Dasar, Perencanaan Individual, Konseling, & Dukungan Sistem',
      icon: <Columns3 className="w-5 h-5 text-indigo-600" />,
      tag: 'Komprehensif',
      action: () => setShowPilarModal(true),
    },
    {
      id: 'sosiometri',
      title: 'Sosiometri Lanjutan',
      desc: 'Pemetaan hubungan pertemanan, dinamika sosial siswa, & sosiogram kelas',
      icon: <Share2 className="w-5 h-5 text-purple-600" />,
      tag: 'Asesmen',
      action: () => onNavigate('asesmen-bk'),
    },
    {
      id: 'panggilan-ortu',
      title: 'Surat Panggilan Orang Tua',
      desc: 'Pembuatan surat undangan pemanggilan resmi, berita acara kehadiran, & arsip tanda tangan',
      icon: <Mail className="w-5 h-5 text-rose-600" />,
      tag: 'Undangan',
      action: () => onNavigate('panggilan-ortu'),
    },
    {
      id: 'alih-tangan',
      title: 'Alih Tangan Kasus (Referral)',
      desc: 'Rujukan kasus ke pihak ahli eksternal (Psikolog, Puskesmas, Dokter, dll)',
      icon: <UserCheck className="w-5 h-5 text-purple-600" />,
      tag: 'Rujukan',
      action: () => setShowAlihTanganModal(true),
    },
    {
      id: 'backup',
      title: 'Backup Data & Cloud Drive',
      desc: 'Sinkronisasi Google Drive/Sheets, ekspor Excel, & proteksi arsip PDF',
      icon: <Database className="w-5 h-5 text-emerald-600" />,
      tag: 'Google Sync',
      action: () => onNavigate('google-sync'),
    },
    {
      id: 'pengaturan',
      title: 'Pengaturan',
      desc: 'Profil Guru BK, penetapan rombel kelas asuhan, dan konfigurasi sekolah',
      icon: <Settings className="w-5 h-5 text-slate-700" />,
      tag: 'Sistem',
      action: () => onNavigate('pengaturan'),
    },
  ];

  const alatBantuItems = [
    {
      id: 'apresiasi',
      title: 'Apresiasi & Prestasi Siswa',
      desc: 'Pencatatan penghargaan karakter baik, bakat, minat, & prestasi siswa',
      icon: <Award className="w-5 h-5 text-amber-600" />,
      action: () => onNavigate('apresiasi'),
    },
    {
      id: 'jurnal',
      title: 'Jurnal Harian Guru BK',
      desc: 'Buku catatan harian kegiatan bimbingan siap cetak untuk pengawas sekolah',
      icon: <FileText className="w-5 h-5 text-teal-600" />,
      action: () => onNavigate('jurnal-harian'),
    },
    {
      id: 'panduan-bskap',
      title: 'Buku Panduan Resmi BK (BSKAP 2022)',
      desc: 'Regulasi resmi Kemendikbudristek & panduan pencegahan kekerasan PPKSP',
      icon: <BookOpen className="w-5 h-5 text-sky-600" />,
      action: () => setShowBskapModal(true),
    },
    {
      id: 'manual',
      title: 'Petunjuk Penggunaan Aplikasi',
      desc: 'Panduan langkah demi langkah penggunaan seluruh fitur aplikasi SIKAP-BK',
      icon: <HelpCircle className="w-5 h-5 text-violet-600" />,
      action: () => setShowManualModal(true),
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-[100px]">
      {/* Tombol Kembali yang Jelas */}
      <div>
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-[#00685f] border border-[#bcc9c6]/50 rounded-xl text-sm font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Kembali ke Beranda</span>
        </button>
      </div>

      {/* Judul Halaman Besar di Atas */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-[#00685f]/10 px-2.5 py-0.5 rounded-md border border-[#00685f]/15">
            Administrasi & Perangkat BK
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0b1c30] mt-1 tracking-tight">
            Menu Lainnya
          </h1>
          <p className="text-xs sm:text-sm text-[#3d4947] mt-1 font-medium">
            Program tahunan, instrumen asesmen sosiometri, RPL, rujukan kasus, hingga cadangan data.
          </p>
        </div>

        {activeCounselor && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 self-start sm:self-auto shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#00685f] text-white flex items-center justify-center font-bold text-sm">
              {activeCounselor.name ? activeCounselor.name.charAt(0) : 'G'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-[#0b1c30] truncate">{activeCounselor.name}</p>
              <p className="text-[11px] text-gray-500 truncate">{activeCounselor.role || 'Guru BK'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bagian 1: Administrasi Inti Bimbingan Konseling */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00685f]" />
          <h2 className="text-sm font-black text-[#0b1c30] uppercase tracking-wider">
            Perangkat & Administrasi BK
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {administrasiItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className="flex items-start gap-4 p-4 bg-white hover:bg-[#e6f4f1]/50 border border-[#bcc9c6]/40 hover:border-[#00685f]/50 rounded-2xl text-left transition-all cursor-pointer group active:scale-98 shadow-2xs"
            >
              <div className="p-3 rounded-xl bg-gray-50 group-hover:bg-[#00685f]/10 transition-colors border border-gray-200/60 shrink-0">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-[#0b1c30] group-hover:text-[#00685f] transition-colors leading-snug">
                    {item.title}
                  </h3>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 shrink-0">
                    {item.tag}
                  </span>
                </div>
                <p className="text-xs text-[#3d4947] opacity-80 mt-1 line-clamp-2 leading-relaxed">
                  {item.desc}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#00685f] group-hover:translate-x-0.5 transition-all shrink-0 mt-3" />
            </button>
          ))}
        </div>
      </div>

      {/* Bagian 2: Alat Bantu & Referensi Resmi */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 px-1">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
          <h2 className="text-sm font-black text-[#0b1c30] uppercase tracking-wider">
            Alat Bantu & Referensi Guru
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {alatBantuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className="flex items-start gap-3.5 p-4 bg-white hover:bg-blue-50/50 border border-[#bcc9c6]/40 hover:border-blue-400/50 rounded-2xl text-left transition-all cursor-pointer group active:scale-98 shadow-2xs"
            >
              <div className="p-2.5 rounded-xl bg-gray-50 group-hover:bg-blue-100 transition-colors border border-gray-200/60 shrink-0">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-[#0b1c30] group-hover:text-blue-700 transition-colors leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-[#3d4947] opacity-80 mt-1 line-clamp-2 leading-relaxed">
                  {item.desc}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-2" />
            </button>
          ))}
        </div>
      </div>

      {/* Modal Alih Tangan Kasus */}
      {showAlihTanganModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0b1c30]">Alih Tangan Kasus (Referral)</h3>
                  <p className="text-xs text-gray-500">Prosedur rujukan kasus siswa ke pihak ahli</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAlihTanganModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-[#3d4947] space-y-3 leading-relaxed">
              <p>
                <strong>Kapan Alih Tangan Kasus dilakukan?</strong><br />
                Dilakukan saat masalah siswa berada di luar kewenangan guru BK, seperti gangguan klinis/kejiwaan berat, kecanduan narkoba, kekerasan seksual/hukum, atau penyakit fisik kronis.
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                <p className="font-bold text-amber-900">Alur Standar Referral:</p>
                <ol className="list-decimal pl-4 space-y-0.5 text-amber-800">
                  <li>Konsultasi dengan Kepala Sekolah & orang tua/wali.</li>
                  <li>Pembuatan Surat Pengantar / Berita Acara Alih Tangan.</li>
                  <li>Pemberian rujukan ke Lembaga Ahli (Psikolog/Puskesmas/Dinsos).</li>
                  <li>Pemantauan berkala (follow-up) perkembangan siswa di sekolah.</li>
                </ol>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAlihTanganModal(false);
                  onNavigate('layanan-bk');
                }}
                className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
              >
                Buka Format Surat Rujukan di Layanan BK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4 Pilar BK */}
      {showPilarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <Columns3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0b1c30]">4 Pilar Bimbingan Konseling Komprehensif</h3>
                  <p className="text-xs text-gray-500">Struktur program resmi Kemendikbudristek & POP BK</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPilarModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 space-y-1">
                <p className="font-black text-teal-900 text-sm">1. Layanan Dasar</p>
                <p className="text-teal-800 leading-relaxed">
                  Bimbingan klasikal tatap muka di kelas, bimbingan kelompok, serta papan bimbingan untuk seluruh siswa tanpa terkecuali.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                <p className="font-black text-blue-900 text-sm">2. Perencanaan Individual</p>
                <p className="text-blue-800 leading-relaxed">
                  Membantu siswa merencanakan masa depan, studi lanjut ke SMA/SMK, asesmen minat bakat, dan pemilihan karir.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                <p className="font-black text-rose-900 text-sm">3. Layanan Responsif</p>
                <p className="text-rose-800 leading-relaxed">
                  Konseling individual, mediasi masalah teman sebaya, home visit, pemanggilan ortu, serta penanganan kasus darurat.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 space-y-1">
                <p className="font-black text-purple-900 text-sm">4. Dukungan Sistem</p>
                <p className="text-purple-800 leading-relaxed">
                  Pengembangan keprofesian berkelanjutan, manajemen prota/prosem, riset sosiometri, dan kolaborasi pihak sekolah.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPilarModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Panduan BSKAP 2022 */}
      <PanduanBskap2022Modal
        isOpen={showBskapModal}
        onClose={() => setShowBskapModal(false)}
      />

      {/* Modal Manual Pengguna */}
      <UserManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
      />
    </div>
  );
};

export default LainnyaView;
