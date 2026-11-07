/**
 * Template Standar & Kustom untuk Masalah dan Tindak Lanjut Layanan BK
 * Membantu Guru BK mengisi catatan layanan secara cepat dan konsisten tanpa perlu mengetik ulang
 */

export interface LayananTemplateItem {
  id: string;
  label: string;
  text: string;
  category?: string;
  isCustom?: boolean;
}

export const DEFAULT_PROBLEM_TEMPLATES: LayananTemplateItem[] = [
  {
    id: 'prob-1',
    label: 'Kesulitan Belajar',
    text: 'Penurunan motivasi belajar, kesulitan memahami materi pelajaran tertentu, dan sering menunda pengerjaan tugas sekolah.',
    category: 'Belajar'
  },
  {
    id: 'prob-2',
    label: 'Ketidakhadiran / Alpa',
    text: 'Sering datang terlambat ke sekolah, tidak hadir tanpa keterangan (Alpa), atau meninggalkan jam pelajaran tertentu.',
    category: 'Kedisiplinan'
  },
  {
    id: 'prob-3',
    label: 'Kecanduan HP / Gadget',
    text: 'Penggunaan gadget/game online berlebihan hingga larut malam sehingga mengantuk dan sulit konsentrasi saat belajar.',
    category: 'Pribadi'
  },
  {
    id: 'prob-4',
    label: 'Konflik Teman Sebaya',
    text: 'Perselisihan, saling ejek, atau ketegangan komunikasi dengan teman sekelas yang mengganggu kenyamanan belajar.',
    category: 'Sosial'
  },
  {
    id: 'prob-5',
    label: 'Kurang Percaya Diri / Cemas',
    text: 'Rasa cemas menghadapi ujian, kurang percaya diri saat tampil di depan kelas, dan cenderung menarik diri dari pergaulan.',
    category: 'Pribadi'
  },
  {
    id: 'prob-6',
    label: 'Pelanggaran Tata Tertib',
    text: 'Melakukan pelanggaran tata tertib sekolah, berpakaian kurang rapi, atau bersikap kurang kooperatif saat jam pelajaran.',
    category: 'Kedisiplinan'
  },
  {
    id: 'prob-7',
    label: 'Peminatan & Studi Lanjut',
    text: 'Konsultasi eksplorasi bakat minat, kebingungan menentukan pilihan sekolah lanjutan (SMA/SMK), serta prospek karir masa depan.',
    category: 'Karir'
  },
  {
    id: 'prob-8',
    label: 'Komunikasi Keluarga',
    text: 'Kendala komunikasi atau permasalahan di lingkungan keluarga yang mempengaruhi kestabilan emosi dan kehadiran siswa di sekolah.',
    category: 'Sosial'
  }
];

export const DEFAULT_FOLLOWUP_TEMPLATES: LayananTemplateItem[] = [
  {
    id: 'foll-1',
    label: 'Konseling Individu Lanjutan',
    text: 'Menjadwalkan sesi konseling individu lanjutan 1 pekan mendatang untuk mengevaluasi komitmen dan perkembangan perilaku siswa.',
    category: 'Konseling'
  },
  {
    id: 'foll-2',
    label: 'Kontrak Perilaku & Jurnal Mandiri',
    text: 'Menyusun lembar kontrak perilaku positif dan buku kontrol harian yang dipantau bersama wali kelas dan guru BK.',
    category: 'Kedisiplinan'
  },
  {
    id: 'foll-3',
    label: 'Panggilan Orang Tua / Wali',
    text: 'Mengirimkan surat undangan pemanggilan orang tua/wali murid ke sekolah untuk dialog pembinaan terpadu di ruang bimbingan konseling.',
    category: 'Kerjasama'
  },
  {
    id: 'foll-4',
    label: 'Koordinasi Wali Kelas & Guru Mapel',
    text: 'Berkoordinasi dengan wali kelas dan guru mata pelajaran terkait guna memberikan pendampingan belajar khusus dan tugas susulan.',
    category: 'Kolaborasi'
  },
  {
    id: 'foll-5',
    label: 'Rencana Kunjungan Rumah (Home Visit)',
    text: 'Merencanakan agenda kunjungan rumah (Home Visit) untuk mengobservasi kondisi lingkungan keluarga dan mempererat silaturahmi.',
    category: 'Pendampingan'
  },
  {
    id: 'foll-6',
    label: 'Bimbingan Kelompok Sebaya',
    text: 'Mengikutsertakan siswa dalam sesi bimbingan atau konseling kelompok bersama teman dengan dinamika persoalan serupa.',
    category: 'Kelompok'
  },
  {
    id: 'foll-7',
    label: 'Komunikasi Berkala via WhatsApp Ortu',
    text: 'Menjalin komunikasi berkala via WhatsApp dengan orang tua siswa untuk memantau pembiasaan belajar dan jam istirahat di rumah.',
    category: 'Orang Tua'
  },
  {
    id: 'foll-8',
    label: 'Monitoring Pembiasaan (Selesai)',
    text: 'Siswa telah menemukan solusi konkret dan membuat komitmen mandiri. Dilakukan pemantauan berkala dalam pembiasaan harian.',
    category: 'Tuntas'
  }
];

const CUSTOM_PROBLEM_KEY = 'bk_custom_problem_templates';
const CUSTOM_FOLLOWUP_KEY = 'bk_custom_followup_templates';

export function getCustomProblemTemplates(): LayananTemplateItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PROBLEM_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function saveCustomProblemTemplate(label: string, text: string): LayananTemplateItem[] {
  const current = getCustomProblemTemplates();
  const newItem: LayananTemplateItem = {
    id: `custom-prob-${Date.now()}`,
    label: label.trim(),
    text: text.trim(),
    isCustom: true
  };
  const updated = [newItem, ...current.filter(item => item.label.toLowerCase() !== label.trim().toLowerCase())];
  try {
    localStorage.setItem(CUSTOM_PROBLEM_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}

export function deleteCustomProblemTemplate(id: string): LayananTemplateItem[] {
  const current = getCustomProblemTemplates();
  const updated = current.filter(item => item.id !== id);
  try {
    localStorage.setItem(CUSTOM_PROBLEM_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}

export function getCustomFollowUpTemplates(): LayananTemplateItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_FOLLOWUP_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function saveCustomFollowUpTemplate(label: string, text: string): LayananTemplateItem[] {
  const current = getCustomFollowUpTemplates();
  const newItem: LayananTemplateItem = {
    id: `custom-foll-${Date.now()}`,
    label: label.trim(),
    text: text.trim(),
    isCustom: true
  };
  const updated = [newItem, ...current.filter(item => item.label.toLowerCase() !== label.trim().toLowerCase())];
  try {
    localStorage.setItem(CUSTOM_FOLLOWUP_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}

export function deleteCustomFollowUpTemplate(id: string): LayananTemplateItem[] {
  const current = getCustomFollowUpTemplates();
  const updated = current.filter(item => item.id !== id);
  try {
    localStorage.setItem(CUSTOM_FOLLOWUP_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}
