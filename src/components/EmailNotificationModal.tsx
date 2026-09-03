import { useState, useEffect } from 'react';
import { Mail, Send, Copy, Check, ExternalLink, X, FileSpreadsheet, ShieldAlert, CheckCircle2, MessageSquare, UserCheck } from 'lucide-react';
import { getSavedScriptUrl, callGasApi } from '../utils/googleSync';
import { defaultWaliKelasList } from '../utils/classNormalizer';

interface EmailNotificationModalProps {
  studentName: string;
  studentClass: string;
  studentNis?: string;
  netPoints?: number;
  alpaCount?: number;
  followUpPlan?: string;
  riskLevel?: string;
  homeroomEmail?: string;
  onClose: () => void;
}

export default function EmailNotificationModal({
  studentName,
  studentClass,
  studentNis,
  netPoints = 0,
  alpaCount = 0,
  followUpPlan = '',
  riskLevel = 'Kritis',
  homeroomEmail: initialHomeroomEmail = '',
  onClose
}: EmailNotificationModalProps) {
  // Pre-fill Wali Kelas email from classNormalizer if empty
  const defaultWaliEmail = () => {
    if (initialHomeroomEmail) return initialHomeroomEmail;
    const foundWali = defaultWaliKelasList.find(
      w => w.class.toLowerCase().replace(/\s+/g, '') === studentClass.toLowerCase().replace(/\s+/g, '')
    );
    return foundWali?.email || '';
  };

  const [homeroomEmail, setHomeroomEmail] = useState(defaultWaliEmail);
  const [preset, setPreset] = useState<'critical' | 'dialog' | 'progress'>('critical');
  const [counselorName, setCounselorName] = useState('Guru Bimbingan & Konseling');
  const [customNotes, setCustomNotes] = useState(followUpPlan);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [scriptUrl, setScriptUrl] = useState('');

  useEffect(() => {
    const url = getSavedScriptUrl();
    if (url) setScriptUrl(url);

    const savedAuth = localStorage.getItem('bk_active_auth_user');
    if (savedAuth) {
      try {
        const u = JSON.parse(savedAuth);
        if (u.name) setCounselorName(u.name);
      } catch (e) {}
    }
  }, []);

  const getSubject = () => {
    switch (preset) {
      case 'dialog':
        return `[REKAP WALIKELAS] Permohonan Koordinasi Pembinaan Siswa: ${studentName} (${studentClass})`;
      case 'progress':
        return `[REKAP WALIKELAS] Update Perkembangan Pembinaan Anak Asuh: ${studentName} (${studentClass})`;
      default:
        return `[PEMBERITAHUAN WALI KELAS] Rekap Pelanggaran & Pembinaan Siswa: ${studentName} (${studentClass})`;
    }
  };

  const getBody = () => {
    const dateToday = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    let mainText = '';
    if (preset === 'critical') {
      mainText = `Melalui surel ini, Tim Bimbingan & Konseling (BK) menyampaikan rekap pemberitahuan resmi mengenai perkembangan dan pembinaan disiplin anak asuh Bapak/Ibu Wali Kelas.

REKAP PEMBINAAN SISWA ANAK ASUH:
- Nama Lengkap: ${studentName}
- Kelas / NISN: Kelas ${studentClass} ${studentNis ? `/ NISN: ${studentNis}` : ''}
- Akumulasi Bobot Pelanggaran: ${netPoints} Bobot
- Catatan Ketidakhadiran (Alpa): ${alpaCount} Kali
- Status Pembinaan: ${riskLevel || 'Perhatian Khusus / Kritis'}

CATATAN & RENCANA TINDAK LANJUT UNTUK WALI KELAS:
${customNotes || '1. Mohon bantuan Wali Kelas untuk melakukan pendampingan harian di kelas.\n2. Koordinasikan bersama Guru BK jika diperlukan pemanggilan Orang Tua.\n3. Pantau kehadiran dan kedisiplinan belajar di kelas.'}`;
    } else if (preset === 'dialog') {
      mainText = `Tim Bimbingan & Konseling (BK) memohon koordinasi bersama Bapak/Ibu Wali Kelas ${studentClass} guna mendiskusikan langkah pendampingan terbaik bagi anak asuh Bapak/Ibu.

IDENTITAS SISWA ANAK ASUH:
- Nama Lengkap: ${studentName}
- Kelas: ${studentClass}
- Akumulasi Bobot: ${netPoints} Bobot ${alpaCount > 0 ? `| Alpa: ${alpaCount}x` : ''}

AGENDA DISKUSI & RENCANA KOORDINASI:
${customNotes || 'Diskusi langkah pembinaan di kelas dan perumusan komitmen pemulihan karakter siswa.'}`;
    } else {
      mainText = `Berikut kami sampaikan ringkasan rekap perkembangan pembinaan karakter anak asuh Bapak/Ibu Wali Kelas.

INFORMASI SISWA:
- Nama Lengkap: ${studentName}
- Kelas: ${studentClass}
- Catatan Perkembangan: ${customNotes || 'Siswa menunjukkan ikhtiar perbaikan dan kooperatif mengikuti pembinaan.'}`;
    }

    return `Yth. Bapak/Ibu Wali Kelas ${studentClass},

Salam hangat dan hormat. Semoga Bapak/Ibu senantiasa dalam keadaan sehat walafiat.

${mainText}

Demikian informasi rekap ini kami sampaikan agar dapat menjadi bahan koordinasi dan pendampingan anak asuh di kelas. Terima kasih banyak atas kerjasama dan dedikasi Bapak/Ibu Wali Kelas.

Hormat kami,
Tim Bimbingan & Konseling (BK)
${counselorName}
Tanggal: ${dateToday}`;
  };

  const handleCopySubject = () => {
    navigator.clipboard.writeText(getSubject());
    setCopiedSubject(true);
    setTimeout(() => setCopiedSubject(false), 2000);
  };

  const handleCopyBody = () => {
    navigator.clipboard.writeText(getBody());
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2000);
  };

  const handleOpenMailto = () => {
    if (!homeroomEmail) {
      alert('Harap masukkan alamat email Wali Kelas terlebih dahulu.');
      return;
    }
    const recipients = homeroomEmail.trim();
    const subject = encodeURIComponent(getSubject());
    const body = encodeURIComponent(getBody());
    window.open(`mailto:${recipients}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleSaveToGmailDraft = async () => {
    if (!scriptUrl) {
      alert('Integrasi Google Apps Script belum terhubung. Silakan atur URL Web App di menu Integrasi Google.');
      return;
    }
    if (!homeroomEmail) {
      alert('Harap masukkan alamat email Wali Kelas terlebih dahulu.');
      return;
    }

    setSavingDraft(true);
    try {
      const payload = {
        action: 'createDraftEmail',
        homeroomEmail,
        studentName,
        studentClass,
        subject: getSubject(),
        body: getBody()
      };

      const res = await callGasApi(scriptUrl, 'POST', payload);
      if (res.success) {
        alert('Draf email pemberitahuan ke Wali Kelas berhasil dikirim/disimpan ke Google Apps Script!');
      } else {
        alert(`Respons dari Google Apps Script: ${res.message}`);
      }
    } catch (err: any) {
      alert(`Terjadi kesalahan: ${err.message}`);
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#0b1c30] to-[#00685f] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <UserCheck className="w-6 h-6 text-teal-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-wide">Email Pemberitahuan ke Wali Kelas</h3>
              <p className="text-xs text-teal-100/90 font-medium">
                Rekap Pelanggaran & Pembinaan Anak Asuh: {studentName} ({studentClass})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs text-[#0b1c30]">
          {/* Email Recipient Input (Wali Kelas Only) */}
          <div className="bg-teal-50/70 p-3.5 rounded-xl border border-teal-200/80">
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-[#00685f] uppercase tracking-wider block">
                Email Wali Kelas ({studentClass})
              </label>
              <input
                type="email"
                placeholder="walikelas@sekolah.sch.id"
                value={homeroomEmail}
                onChange={(e) => setHomeroomEmail(e.target.value)}
                className="w-full bg-white border border-teal-300 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Pemberitahuan rekap pelanggaran anak asuh akan dikirim langsung ke surel Wali Kelas.
              </p>
            </div>
          </div>

          {/* Preset Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-gray-500 uppercase">Pilih Jenis Template Pesan Wali Kelas</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPreset('critical')}
                className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                  preset === 'critical'
                    ? 'bg-red-50 border-red-300 text-red-900'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                🚨 Rekap Status Kritis
              </button>
              <button
                type="button"
                onClick={() => setPreset('dialog')}
                className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                  preset === 'dialog'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                🤝 Permohonan Koordinasi
              </button>
              <button
                type="button"
                onClick={() => setPreset('progress')}
                className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                  preset === 'progress'
                    ? 'bg-teal-50 border-teal-300 text-teal-900'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                📈 Laporan Progres
              </button>
            </div>
          </div>

          {/* Custom Notes / Rencana Tindak Lanjut Edit */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-gray-500 uppercase">Catatan & Rencana Tindak Lanjut untuk Wali Kelas</label>
            <textarea
              rows={3}
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Masukkan catatan khusus atau langkah pendampingan wali kelas di kelas..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]"
            />
          </div>

          {/* Draft Preview Box */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-gray-500 uppercase">Subjek Email:</span>
              <button
                onClick={handleCopySubject}
                className="text-[10px] font-bold text-[#00685f] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedSubject ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSubject ? 'Subjek Tersalin' : 'Salin Subjek'}</span>
              </button>
            </div>
            <p className="p-2 bg-white rounded-lg border border-gray-200 font-bold text-xs text-[#0b1c30]">
              {getSubject()}
            </p>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] font-extrabold text-gray-500 uppercase">Isi Pesan Email:</span>
              <button
                onClick={handleCopyBody}
                className="text-[10px] font-bold text-[#00685f] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedBody ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedBody ? 'Pesan Tersalin' : 'Salin Isi Pesan'}</span>
              </button>
            </div>
            <div className="p-3 bg-white rounded-lg border border-gray-200 font-medium text-[11px] text-gray-800 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
              {getBody()}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Tutup
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyBody}
              className="px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Pesan</span>
            </button>

            {scriptUrl && (
              <button
                onClick={handleSaveToGmailDraft}
                disabled={savingDraft}
                className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{savingDraft ? 'Menyimpan...' : 'Simpan Draf Gmail'}</span>
              </button>
            )}

            <button
              onClick={handleOpenMailto}
              className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim Email ke Wali Kelas</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

