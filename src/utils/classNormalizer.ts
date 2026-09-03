export interface WaliKelasConfig {
  class: string;
  name: string;
  email: string;
  phone?: string;
}

export const defaultWaliKelasList: WaliKelasConfig[] = [
  { class: 'Kelas 7A', name: 'Ibu Nona Marlina, S.Pd.', email: 'wali.kelas.7a@smpn2susukan.sch.id', phone: '081234567801' },
  { class: 'Kelas 7B', name: 'Bapak Budi Santoso, S.Pd.', email: 'wali.kelas.7b@smpn2susukan.sch.id', phone: '081234567802' },
  { class: 'Kelas 7C', name: 'Ibu Citra Lestari, S.Pd.', email: 'wali.kelas.7c@smpn2susukan.sch.id', phone: '081234567803' },
  { class: 'Kelas 7D', name: 'Ibu Dewi Setyowati, S.Pd.', email: 'wali.kelas.7d@smpn2susukan.sch.id', phone: '081234567804' },
  { class: 'Kelas 7E', name: 'Bapak Eko Prasetyo, S.Pd.', email: 'wali.kelas.7e@smpn2susukan.sch.id', phone: '081234567805' },
  { class: 'Kelas 7F', name: 'Ibu Farida Asri, S.Pd.', email: 'wali.kelas.7f@smpn2susukan.sch.id', phone: '081234567806' },
  { class: 'Kelas 8A', name: 'Ibu Aulia Aji Sasongko, S.Pd.', email: 'wali.kelas.8a@smpn2susukan.sch.id', phone: '081234567807' },
  { class: 'Kelas 8B', name: 'Bapak Heri Wibowo, S.Pd.', email: 'wali.kelas.8b@smpn2susukan.sch.id', phone: '081234567808' },
  { class: 'Kelas 8C', name: 'Ibu Indah Permata, S.Pd.', email: 'wali.kelas.8c@smpn2susukan.sch.id', phone: '081234567809' },
  { class: 'Kelas 8D', name: 'Ibu Joko Susilo, S.Pd.', email: 'wali.kelas.8d@smpn2susukan.sch.id', phone: '081234567810' },
  { class: 'Kelas 8E', name: 'Bapak Kusuma Wijaya, S.Pd.', email: 'wali.kelas.8e@smpn2susukan.sch.id', phone: '081234567811' },
  { class: 'Kelas 8F', name: 'Ibu Lilis Handayani, S.Pd.', email: 'wali.kelas.8f@smpn2susukan.sch.id', phone: '081234567812' },
  { class: 'Kelas 8G', name: 'Bapak Mujiyono, S.Pd.', email: 'wali.kelas.8g@smpn2susukan.sch.id', phone: '081234567813' },
  { class: 'Kelas 9A', name: 'Ibu Tri Handayani, S.Pd.', email: 'wali.kelas.9a@smpn2susukan.sch.id', phone: '081234567814' },
  { class: 'Kelas 9B', name: 'Bapak Nurdin, S.Pd.', email: 'wali.kelas.9b@smpn2susukan.sch.id', phone: '081234567815' },
  { class: 'Kelas 9C', name: 'Ibu Oki Rahmawati, S.Pd.', email: 'wali.kelas.9c@smpn2susukan.sch.id', phone: '081234567816' },
  { class: 'Kelas 9D', name: 'Bapak Purwanto, S.Pd.', email: 'wali.kelas.9d@smpn2susukan.sch.id', phone: '081234567817' },
  { class: 'Kelas 9E', name: 'Ibu Qori Lestari, S.Pd.', email: 'wali.kelas.9e@smpn2susukan.sch.id', phone: '081234567818' },
  { class: 'Kelas 9F', name: 'Bapak Roni Wijaya, S.Pd.', email: 'wali.kelas.9f@smpn2susukan.sch.id', phone: '081234567819' },
  { class: 'Kelas 9G', name: 'Ibu Siti Aminah, S.Pd.', email: 'wali.kelas.9g@smpn2susukan.sch.id', phone: '081234567820' },
];

export function getNormalizedClassKey(className: string): string {
  if (!className) return '';
  let clean = className.toLowerCase()
    .replace(/kelas/g, '')
    .replace(/[\s\-_]/g, '') // remove spaces, hyphens, underscores
    .trim();
  
  if (clean.startsWith('viii')) {
    clean = clean.replace('viii', '8');
  } else if (clean.startsWith('vii')) {
    clean = clean.replace('vii', '7');
  } else if (clean.startsWith('xii')) {
    clean = clean.replace('xii', '12');
  } else if (clean.startsWith('xi')) {
    clean = clean.replace('xi', '11');
  } else if (clean.startsWith('ix')) {
    clean = clean.replace('ix', '9');
  } else if (clean.startsWith('x')) {
    clean = clean.replace('x', '10');
  }
  
  return clean;
}
