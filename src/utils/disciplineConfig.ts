/**
 * Konfigurasi Fitur Pendisiplinan & Pembinaan BK
 * SMP Negeri 2 Susukan
 */

export interface DisciplineConfig {
  minAlpaCount: number;
  minViolationPoints: number;
  letterNumberPrefix: string;
  defaultCounselorName: string;
  defaultWitnessTitle: string;
  autoScrollOnSelect: boolean;
  showAiBanner: boolean;
  defaultAgreementPoints: string[];
  defaultConsequences: string[];
}

export const DEFAULT_DISCIPLINE_CONFIG: DisciplineConfig = {
  minAlpaCount: 1,
  minViolationPoints: 1,
  letterNumberPrefix: 'SP/SMPN2SSK',
  defaultCounselorName: 'Aulia Aji Sasongko, S.Pd.',
  defaultWitnessTitle: 'Wali Kelas / Pembina Kedisiplinan',
  autoScrollOnSelect: true,
  showAiBanner: true,
  defaultAgreementPoints: [
    'Berjanji hadir tepat waktu di sekolah dan tidak meninggalkan jam pelajaran tanpa izin (tidak Alpa/Bolos).',
    'Mematuhi seluruh tata tertib dan keyakinan sekolah SMP Negeri 2 Susukan dengan penuh kesadaran.',
    'Bersikap sopan dan menghargai bapak/ibu guru serta menjaga kerukunan antarteman.',
    'Menjaga ketertiban di lingkungan kelas dan tidak menggunakan handphone saat KBM tanpa instruksi guru.'
  ],
  defaultConsequences: [
    'Apabila mengulangi pelanggaran serupa, siap menerima pendampingan intensif bersama orang tua/wali di sekolah.',
    'Melaksanakan program restitusi pembiasaan positif berupa tugas literasi budi pekerti dan kebersihan terpadu.',
    'Menyetujui evaluasi berkala kontrak perilaku bersama Guru BK dan Wali Kelas.'
  ]
};

const STORAGE_KEY = 'bk_discipline_config';

export function getDisciplineConfig(): DisciplineConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DISCIPLINE_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_DISCIPLINE_CONFIG, ...parsed };
  } catch {
    return DEFAULT_DISCIPLINE_CONFIG;
  }
}

export function saveDisciplineConfig(newConfig: DisciplineConfig): DisciplineConfig {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bk_discipline_config_updated', { detail: newConfig }));
    }
  } catch (e) {
    console.error('Failed to save discipline config', e);
  }
  return newConfig;
}

export function resetDisciplineConfig(): DisciplineConfig {
  return saveDisciplineConfig(DEFAULT_DISCIPLINE_CONFIG);
}
