import { ParentSummonTemplate } from '../types';
import { getSchoolConfig } from './schoolConfig';
import { formatIndonesianDate } from './pdfGenerator';

export const DEFAULT_SUMMON_TEMPLATES: ParentSummonTemplate[] = [
  {
    id: 'tpl-disiplin-terlambat',
    title: 'Kedisiplinan & Keterlambatan Berulang',
    category: 'Kedisiplinan',
    agenda: 'Konsultasi evaluasi kedisiplinan dan koordinasi penanganan keterlambatan hadir ke sekolah secara berulang',
    place: 'Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan',
    suggestedAgreements: 'Orang tua membantu mengawasi jam bangun pagi dan keberangkatan anak, serta siswa berkomitmen tiba sebelum bel 06.45 WIB.',
    isCustom: false,
    waMessageTemplate: `*SURAT PEMBERITAHUAN & PANGGILAN ORANG TUA / WALI*
*{NAMA_SEKOLAH}*

Yth. Bapak/Ibu Orang Tua / Wali dari:
👤 *Nama Siswa:* {NAMA_SISWA}
🏫 *Kelas / NIS:* {KELAS} / {NIS}

Dengan hormat,
Sehubungan dengan pembinaan kedisiplinan dan tata tertib sekolah terkait kehadiran, kami mengundang Bapak/Ibu untuk hadir pada:

📅 *Hari / Tanggal:* {HARI_TANGGAL}
⏰ *Waktu:* {JAM} WIB
📍 *Tempat:* {TEMPAT}
🎯 *Agenda:* {AGENDA}
📋 *No. Surat:* {NO_SURAT}

Kehadiran dan kerja sama Bapak/Ibu sangat berharga demi masa depan dan pembiasaan positif putra/putri kita bersama. Atas perhatian dan kehadirannya, kami ucapkan terima kasih.

Hormat kami,
*Guru Pembimbing BK:* {GURU_BK}
_{NAMA_SEKOLAH}_`
  },
  {
    id: 'tpl-alpha-membolos',
    title: 'Ketidakhadiran Tanpa Keterangan (Alpha/Membolos)',
    category: 'Kedisiplinan',
    agenda: 'Koordinasi penyelesaian masalah ketidakhadiran tanpa keterangan (Alpha/Membolos) dan evaluasi motivasi belajar siswa',
    place: 'Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan',
    suggestedAgreements: 'Orang tua proaktif mengonfirmasi kehadiran anak setiap pagi ke Wali Kelas dan membatasi izin non-darurat.',
    isCustom: false,
    waMessageTemplate: `*UNDANGAN KONSULTASI ORANG TUA / WALI SISWA*
*{NAMA_SEKOLAH}*

Yth. Bapak/Ibu Orang Tua / Wali dari *{NAMA_SISWA}* ({KELAS}),

Melalui pesan ini, kami dari Tim Bimbingan dan Konseling bermaksud mengundang Bapak/Ibu untuk hadir di sekolah guna koordinasi dan evaluasi kehadiran putra/putri tercinta:

📅 *Hari / Tanggal:* {HARI_TANGGAL}
⏰ *Pukul:* {JAM} WIB
📍 *Tempat:* {TEMPAT}
📝 *Agenda:* {AGENDA}
📋 *No. Surat Resmi:* {NO_SURAT}

Mohon Bapak/Ibu dapat meluangkan waktu agar kita dapat menemukan solusi terbaik secara restoratif bersama. Terima kasih atas kerja sama dan dukungannya.

Salam hormat,
*{GURU_BK}* (Guru BK)
_{NAMA_SEKOLAH}_`
  },
  {
    id: 'tpl-akademik-tugas',
    title: 'Evaluasi Prestasi Belajar & Kendala Akademik',
    category: 'Akademik',
    agenda: 'Konsultasi bimbingan belajar, evaluasi ketuntasan tugas mata pelajaran, dan persiapan penilaian sumatif',
    place: 'Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan',
    suggestedAgreements: 'Dibuatkan jadwal belajar teratur di rumah didampingi orang tua serta bimbingan remedial oleh guru mata pelajaran.',
    isCustom: false,
    waMessageTemplate: `*PEMBERITAHUAN KONSULTASI BELAJAR SISWA*
*{NAMA_SEKOLAH}*

Yth. Orang Tua / Wali dari *{NAMA_SISWA}* ({KELAS}),

Demi mendukung peningkatan capaian belajar, ketuntasan tugas akademik, serta memotivasi belajar putra/putri Bapak/Ibu di sekolah, kami mengundang Bapak/Ibu untuk berkonsultasi bersama pada:

📅 *Hari / Tanggal:* {HARI_TANGGAL}
⏰ *Pukul:* {JAM} WIB
📍 *Tempat:* {TEMPAT}
📌 *Agenda:* {AGENDA}

Besar harapan kami Bapak/Ibu dapat hadir demi kesuksesan belajar putra/putri. Atas perhatiannya kami sampaikan terima kasih.

Hormat kami,
*{GURU_BK}*
_{NAMA_SEKOLAH}_`
  },
  {
    id: 'tpl-mediasi-sosial',
    title: 'Mediasi & Penyelesaian Masalah Sosial Antar Siswa',
    category: 'Sosial & Perilaku',
    agenda: 'Sesi khusus mediasi, penyelesaian perselisihan, dan pemulihan hubungan sosial antar siswa secara damai dan kekeluargaan',
    place: 'Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan',
    suggestedAgreements: 'Saling memaafkan, menjaga perkataan, tidak mengunggah perselisihan ke media sosial, serta saling menghormati di lingkungan sekolah.',
    isCustom: false,
    waMessageTemplate: `*UNDANGAN MEDIASI & KONSULTASI BK*
*{NAMA_SEKOLAH}*

Yth. Bapak/Ibu Orang Tua / Wali dari:
*{NAMA_SISWA}* (Kelas {KELAS})

Dengan hormat,
Guna menjaga kenyamanan, kerukunan, serta pembinaan hubungan pertemanan positif di lingkungan sekolah, kami mengundang Bapak/Ibu untuk hadir pada:

📅 *Hari / Tanggal:* {HARI_TANGGAL}
⏰ *Waktu:* {JAM} WIB
📍 *Tempat:* {TEMPAT}
🤝 *Agenda:* {AGENDA}

Kehadiran Bapak/Ibu sangat diharapkan demi terciptanya suasana belajar yang kondusif dan harmonis bagi anak-anak kita.

Hormat kami,
*{GURU_BK}*
_{NAMA_SEKOLAH}_`
  },
  {
    id: 'tpl-gawai-etika',
    title: 'Pembinaan Etika & Penggunaan Gawai / Media Sosial',
    category: 'Sosial & Perilaku',
    agenda: 'Koordinasi pendampingan etika pergaulan dan pembinaan pemanfaatan media digital / gawai secara bijak',
    place: 'Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan',
    suggestedAgreements: 'Pembatasan durasi penggunaan ponsel saat jam malam belajar dan pendampingan orang tua terhadap konten yang diakses.',
    isCustom: false,
    waMessageTemplate: `*UNDANGAN PEMBINAAN & KONSULTASI BK*
*{NAMA_SEKOLAH}*

Yth. Orang Tua / Wali dari ananda *{NAMA_SISWA}* ({KELAS}),

Sehubungan dengan bimbingan etika, pergaulan, dan pemanfaatan media digital di sekolah, kami mengundang Bapak/Ibu untuk hadir pada:

📅 *Hari / Tanggal:* {HARI_TANGGAL}
⏰ *Pukul:* {JAM} WIB
📍 *Tempat:* {TEMPAT}
📱 *Agenda:* {AGENDA}

Kerja sama antara pihak sekolah dan orang tua di rumah sangat penting untuk membimbing tumbuh kembang karakter ananda. Terima kasih atas kehadirannya.

Hormat kami,
*{GURU_BK}*
_{NAMA_SEKOLAH}_`
  },
  {
    id: 'tpl-karir-studi',
    title: 'Bimbingan Minat Bakat & Kelanjutan Studi',
    category: 'Karir / Masa Depan',
    agenda: 'Konsultasi bimbingan minat, bakat, penjurusan studi lanjutan (SMA/SMK/MA), dan perencanaan masa depan siswa',
    place: 'Ruang Bimbingan dan Konseling (BK) SMP N 2 Susukan',
    suggestedAgreements: 'Penyelarasan cita-cita siswa dengan dukungan orang tua serta pemetaan jurusan dan sekolah lanjutan yang sesuai.',
    isCustom: false,
    waMessageTemplate: `*UNDANGAN KONSULTASI MINAT, BAKAT & STUDI LANJUTAN*
*{NAMA_SEKOLAH}*

Yth. Bapak/Ibu Orang Tua / Wali dari:
*{NAMA_SISWA}* (Kelas {KELAS})

Dengan hormat,
Dalam rangka pemetaan potensi, minat bakat, serta persiapan kelanjutan studi ke jenjang berikutnya, kami mengundang Bapak/Ibu untuk berdiskusi bersama Guru BK pada:

📅 *Hari / Tanggal:* {HARI_TANGGAL}
⏰ *Pukul:* {JAM} WIB
📍 *Tempat:* {TEMPAT}
🎓 *Agenda:* {AGENDA}

Mari bersama-sama kita rencanakan masa depan terbaik bagi putra/putri tercinta. Terima kasih.

Hormat kami,
*{GURU_BK}*
_{NAMA_SEKOLAH}_`
  }
];

/**
 * Gets all saved parent summon templates (merges custom templates with defaults)
 */
export function getParentSummonTemplates(): ParentSummonTemplate[] {
  const saved = localStorage.getItem('bk_parent_summon_templates');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Error loading parent summon templates:', e);
    }
  }
  return DEFAULT_SUMMON_TEMPLATES;
}

/**
 * Saves templates list to localStorage
 */
export function saveParentSummonTemplates(templates: ParentSummonTemplate[]): void {
  localStorage.setItem('bk_parent_summon_templates', JSON.stringify(templates));
  window.dispatchEvent(new Event('storage'));
}

/**
 * Formats a WhatsApp message template by substituting dynamic placeholder tags
 */
export function formatSummonWaMessage(
  templateStr: string,
  variables: {
    studentName?: string;
    studentClass?: string;
    studentNis?: string;
    parentName?: string;
    summonDate?: string;
    summonTime?: string;
    summonPlace?: string;
    agenda?: string;
    letterNumber?: string;
    counselorName?: string;
    schoolName?: string;
  }
): string {
  const schoolConfig = getSchoolConfig();
  const rawDate = variables.summonDate || new Date().toISOString().split('T')[0];
  const formattedDate = formatIndonesianDate(rawDate);

  let text = templateStr || '';

  const replacements: Record<string, string> = {
    '{NAMA_SISWA}': variables.studentName || '(Nama Siswa)',
    '{KELAS}': variables.studentClass || '(Kelas)',
    '{NIS}': variables.studentNis || '-',
    '{NAMA_ORTU}': variables.parentName || 'Bapak / Ibu Wali Murid',
    '{HARI_TANGGAL}': formattedDate,
    '{JAM}': variables.summonTime || '09:00',
    '{TEMPAT}': variables.summonPlace || 'Ruang BK',
    '{AGENDA}': variables.agenda || 'Konsultasi dan Bimbingan Siswa',
    '{NO_SURAT}': variables.letterNumber || '(Nomor Surat)',
    '{GURU_BK}': variables.counselorName || 'Guru BK',
    '{NAMA_SEKOLAH}': variables.schoolName || schoolConfig.schoolName || 'SMP Negeri 2 Susukan',
  };

  Object.entries(replacements).forEach(([placeholder, value]) => {
    text = text.split(placeholder).join(value);
  });

  return text;
}

/**
 * Builds a direct WhatsApp web/app intent link with URI-encoded message
 */
export function createWhatsAppLink(phone?: string, messageText?: string): string {
  const encodedText = encodeURIComponent(messageText || '');
  if (phone) {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    }
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}
