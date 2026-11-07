import { safeSetItem, safeGetItem, safeRemoveItem, sanitizeLogsArray, sanitizeViolationsArray, compactAttendanceHistory } from './storageQuota';
import { CANONICAL_AULIA_STUDENTS } from '../data/canonicalStudents';

export interface SchoolConfig {
  schoolId?: string;
  schoolName: string;
  schoolAddress: string;
  principalName: string;
  principalNip: string;
  koordinatorBkName?: string;
  koordinatorBkNip?: string;
  governmentName: string;
  departmentName: string;
  npsn?: string;
  phoneEmail?: string;
  jenjang?: 'SD' | 'MI' | 'SMP' | 'MTs' | 'SMA' | 'MA' | 'SMK' | string;
  statusSekolah?: 'Negeri' | 'Swasta' | string;
  akreditasi?: 'A' | 'B' | 'C' | 'Belum Terakreditasi' | string;
  tahunAjaran?: string; // e.g. '2024/2025'
  semester?: 'Ganjil' | 'Genap' | string;
  nomorSuratPrefix?: string; // e.g. '421.3 / BK-SMP2 / '
  customLogo?: string;
  customSchoolLogo?: string;
  customKabupatenLogo?: string;
  updatedAt?: string;
  // Konfigurasi Standar Panduan BK & PPKSP Permendikbudristek No. 46/2023
  kurikulum?: string; // e.g. 'Kurikulum Merdeka'
  bkGuidelineVersion?: string; // e.g. 'Panduan BK Kurikulum Merdeka & PPKSP 2023/2024'
  tppkKetua?: string; // Nama Ketua TPPK Satuan Pendidikan
  tppkKontakPengaduan?: string; // Hotline/WhatsApp Pengaduan TPPK Satuan Pendidikan
  tppkSkPenetapan?: string; // Nomor SK Penetapan TPPK Sekolah
}

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  schoolId: 'sch_20320123',
  schoolName: 'SMP N 2 Susukan',
  schoolAddress: 'Jl. Kyai Hasan Anwar No. 16, Susukan, Kec. Susukan, Kab. Semarang, Jawa Tengah 50777',
  principalName: 'Agus Setiawan, S.Pd. Fis',
  principalNip: '19680831 199103 1 007',
  koordinatorBkName: 'Aulia Aji Sasongko, S.Pd.',
  koordinatorBkNip: 'NIP. 19931231 202221 1 002',
  governmentName: 'PEMERINTAH KABUPATEN SEMARANG',
  departmentName: 'DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA',
  npsn: '20320123',
  phoneEmail: 'Email: smpn2susukan@sch.id | Telp: (0298) 123456',
  jenjang: 'SMP',
  statusSekolah: 'Negeri',
  akreditasi: 'A',
  tahunAjaran: '2024/2025',
  semester: 'Ganjil',
  kurikulum: 'Kurikulum Merdeka',
  nomorSuratPrefix: '421.3 / BK-SMP2 / ',
  bkGuidelineVersion: 'Panduan BK Kurikulum Merdeka & PPKSP Permendikbudristek No. 46/2023',
  tppkKetua: 'Koordinator BK & Tim Kesiswaan',
  tppkKontakPengaduan: 'Hotline SAPA 129 / Pengaduan Sekolah: 0812-3456-7890',
  tppkSkPenetapan: 'SK/TPPK-SMP2SSK/2024/01',
};

// Preset Logo Data URLs (High-Resolution Official Emblems for Kop Surat)
export const PRESET_LOGOS = {
  tutwuri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="96" fill="%230b427b" stroke="%23f5c518" stroke-width="6"/><circle cx="100" cy="100" r="82" fill="%23ffffff" stroke="%230b427b" stroke-width="2"/><path d="M100 35 L120 70 L160 75 L130 105 L138 150 L100 130 L62 150 L70 105 L40 75 L80 70 Z" fill="%23f5c518" stroke="%23b8860b" stroke-width="2"/><path d="M70 115 Q100 140 130 115 Q100 130 70 115 Z" fill="%2300685f"/><path d="M85 85 L100 60 L115 85 Q100 75 85 85 Z" fill="%23ba1a1a"/><text x="100" y="172" font-family="Arial,sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="%230b427b">TUT WURI HANDAYANI</text></svg>`,
  kemenag: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><polygon points="100,10 185,55 185,145 100,190 15,145 15,55" fill="%2300685f" stroke="%23f5c518" stroke-width="5"/><circle cx="100" cy="100" r="60" fill="%23ffffff" stroke="%23f5c518" stroke-width="3"/><path d="M75 90 L100 70 L125 90 L100 110 Z" fill="%23f5c518"/><path d="M70 110 Q100 135 130 110 L125 135 Q100 155 75 135 Z" fill="%2300685f"/><text x="100" y="165" font-family="Arial,sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="%23ffffff">IKHLAS BERAMAL</text><text x="100" y="50" font-family="Arial,sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="%23ffffff">KEMENAG RI</text></svg>`,
  pemda: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="M100 15 L175 45 L175 110 Q175 170 100 190 Q25 170 25 110 L25 45 Z" fill="%230b427b" stroke="%23f5c518" stroke-width="6"/><path d="M100 30 L160 55 L160 105 Q160 155 100 175 Q40 155 40 105 L40 55 Z" fill="%23ffffff"/><polygon points="100,45 112,75 145,78 120,100 128,135 100,118 72,135 80,100 55,78 88,75" fill="%23f5c518" stroke="%23b8860b" stroke-width="1.5"/><text x="100" y="155" font-family="Arial,sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="%230b427b">PEMERINTAH DAERAH</text></svg>`,
  toga: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" fill="%2300685f" stroke="%2389f5e7" stroke-width="5"/><circle cx="100" cy="100" r="78" fill="%23ffffff"/><polygon points="100,50 160,80 100,110 40,80" fill="%2300685f"/><path d="M100 110 L150 85 L150 125 Q150 145 100 150 Q50 145 50 125 L50 85 Z" fill="%23005049"/><circle cx="160" cy="100" r="4" fill="%23f5c518"/><path d="M160 80 L160 120" stroke="%23f5c518" stroke-width="3"/><text x="100" y="172" font-family="Arial,sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="%2300685f">PENDIDIKAN</text></svg>`
};

export function isSmpSchool(schoolId?: string): boolean {
  if (typeof localStorage === 'undefined') return true;
  const cfg = getSchoolConfig(schoolId);
  const jenjang = (cfg.jenjang || '').toUpperCase();
  if (jenjang === 'SMA' || jenjang === 'SMK' || jenjang === 'MA') return false;
  if (jenjang === 'SD' || jenjang === 'MI') return false;
  const name = (cfg.schoolName || '').toLowerCase();
  if (name.includes('sma') || name.includes('smk') || name.includes('kejuruan') || name.includes('madrasah aliyah')) {
    return false;
  }
  return true;
}

export function sanitizeSchoolId(input: string): string {
  if (!input || !input.trim()) return 'sch_20320123';
  const clean = input.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 32);
  if (!clean) return 'sch_20320123';
  if (
    clean === '20320123' ||
    clean === 'sch_20320123' ||
    clean.includes('smp_negeri_2_susukan') ||
    clean.includes('smp_n_2_susukan') ||
    clean.includes('uptd_spf_smp_negeri_2_susuka')
  ) {
    return 'sch_20320123';
  }
  return clean.startsWith('sch_') ? clean : `sch_${clean}`;
}

export function generateSchoolIdFromConfig(cfg: Partial<SchoolConfig>): string {
  if (cfg.npsn && cfg.npsn.replace(/[^0-9a-zA-Z]/g, '').trim() === '20320123') {
    return 'sch_20320123';
  }
  const sName = (cfg.schoolName || '').toLowerCase();
  if (sName.includes('smp n 2 susukan') || sName.includes('smp negeri 2 susukan')) {
    return 'sch_20320123';
  }
  if (cfg.npsn && cfg.npsn.replace(/[^0-9a-zA-Z]/g, '').length >= 4) {
    return sanitizeSchoolId(cfg.npsn);
  }
  if (cfg.schoolName) {
    return sanitizeSchoolId(cfg.schoolName);
  }
  return 'sch_20320123';
}

export function getActiveSchoolId(): string {
  if (typeof localStorage === 'undefined') return 'sch_20320123';
  const saved = localStorage.getItem('bk_active_school_id');
  if (saved && saved.trim()) return sanitizeSchoolId(saved);

  // Read saved config without calling getSchoolConfig to avoid circular recursion
  try {
    const rawConfig = localStorage.getItem('bk_school_config');
    if (rawConfig) {
      const parsed = JSON.parse(rawConfig);
      const derived = generateSchoolIdFromConfig(parsed);
      localStorage.setItem('bk_active_school_id', derived);
      return derived;
    }
  } catch (e) {}

  localStorage.setItem('bk_active_school_id', 'sch_20320123');
  return 'sch_20320123';
}

export function setActiveSchoolId(schoolId: string): void {
  if (typeof localStorage === 'undefined') return;
  const cleanId = sanitizeSchoolId(schoolId);
  localStorage.setItem('bk_active_school_id', cleanId);
}

export function getSchoolStorageKey(baseKey: string, schoolId?: string): string {
  const sId = schoolId ? sanitizeSchoolId(schoolId) : getActiveSchoolId();
  return `${baseKey}_${sId}`;
}

export function loadSchoolData<T>(baseKey: string, fallback: T, schoolId?: string): T {
  if (typeof localStorage === 'undefined') return fallback;
  const sId = schoolId ? sanitizeSchoolId(schoolId) : getActiveSchoolId();
  const partitionedKey = `${baseKey}_${sId}`;

  const isExplicitlyCleared = safeGetItem(`bk_cleared_${sId}`) === 'true';

  const savedPartitioned = safeGetItem(partitionedKey);
  if (savedPartitioned !== null) {
    try {
      const parsed = JSON.parse(savedPartitioned);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          return [] as unknown as T;
        }
        let sanitized = parsed.filter((item: any) => {
          if (!item || typeof item !== 'object') return false;
          // Filter out records stamped with a different school ID
          if (item.schoolId && sanitizeSchoolId(item.schoolId) !== sId) {
            return false;
          }
          return true;
        });
        return sanitized as unknown as T;
      } else if (parsed !== null && parsed !== undefined) {
        return parsed;
      }
    } catch (e) {}
  }

  if (isExplicitlyCleared) {
    return (Array.isArray(fallback) ? [] : fallback) as unknown as T;
  }

  // Fallback to unpartitioned legacy storage if partitioned key is empty ONLY for canonical school sch_20320123
  const savedBase = safeGetItem(baseKey);
  if (savedBase !== null) {
    try {
      const parsed = JSON.parse(savedBase);
      if (Array.isArray(parsed)) {
        if (sId === 'sch_20320123') {
          saveSchoolData(baseKey, parsed, sId);
          safeRemoveItem(baseKey); // Clean up obsolete legacy key to free space
          return parsed as unknown as T;
        }
        return fallback;
      }
    } catch (e) {}
  }

  // Return provided fallback
  return fallback;
}

export function saveSchoolData<T>(baseKey: string, data: T, schoolId?: string): void {
  if (typeof localStorage === 'undefined') return;
  const sId = schoolId ? sanitizeSchoolId(schoolId) : getActiveSchoolId();
  const partitionedKey = `${baseKey}_${sId}`;

  // Automatically stamp schoolId on array items to guarantee origin identification
  let preparedData: any = data;
  if (Array.isArray(data)) {
    preparedData = data.map((item: any) => {
      if (item && typeof item === 'object') {
        return {
          ...item,
          schoolId: item.schoolId ? sanitizeSchoolId(item.schoolId) : sId
        };
      }
      return item;
    });
  }

  // Automatically cap and sanitize payloads to prevent quota bloat
  let payload: any = preparedData;
  if (baseKey === 'bk_logs' && Array.isArray(preparedData)) {
    payload = sanitizeLogsArray(preparedData, 50);
  } else if (baseKey === 'bk_violations' && Array.isArray(preparedData)) {
    payload = sanitizeViolationsArray(preparedData);
  } else if (baseKey === 'bk_attendance_history' && Array.isArray(preparedData)) {
    payload = compactAttendanceHistory(preparedData, 35);
  }

  // Manage cleared flag if student data is explicitly emptied or populated
  if (baseKey === 'bk_students') {
    if (Array.isArray(data) && data.length === 0) {
      safeSetItem(`bk_cleared_${sId}`, 'true');
    } else if (Array.isArray(data) && data.length > 0) {
      safeRemoveItem(`bk_cleared_${sId}`);
    }
  }

  const serialized = JSON.stringify(payload);
  safeSetItem(partitionedKey, serialized);
  // Remove redundant unpartitioned key if it exists
  safeRemoveItem(baseKey);
}

export function getRegisteredSchools(): SchoolConfig[] {
  if (typeof localStorage === 'undefined') return [DEFAULT_SCHOOL_CONFIG];
  const saved = localStorage.getItem('bk_registered_schools');
  let list: SchoolConfig[] = [];
  if (saved) {
    try {
      list = JSON.parse(saved);
    } catch (e) {}
  }

  // Deduplicate and filter out redundant duplicate partitions for SMP N 2 Susukan
  const seenIds = new Set<string>();
  const seenNpsn = new Set<string>();
  const deduplicated: SchoolConfig[] = [];

  // Always ensure canonical SMP N 2 Susukan is present first
  const hasCanonical = list.find(s => s.schoolId === 'sch_20320123' || (s.npsn && s.npsn.replace(/[^0-9]/g, '') === '20320123'));
  const canonicalSchool: SchoolConfig = {
    ...DEFAULT_SCHOOL_CONFIG,
    ...(hasCanonical || {}),
    schoolId: 'sch_20320123',
    npsn: '20320123'
  };
  deduplicated.push(canonicalSchool);
  seenIds.add('sch_20320123');
  seenNpsn.add('20320123');

  list.forEach(s => {
    if (!s || !s.schoolName) return;
    const cleanNpsn = (s.npsn || '').replace(/[^0-9]/g, '');
    const cleanId = sanitizeSchoolId(s.schoolId || s.npsn || s.schoolName);
    
    // Ignore duplicate entries for SMP N 2 Susukan
    if (cleanNpsn === '20320123' || cleanId === 'sch_20320123' || cleanId === 'sch_uptd_spf_smp_negeri_2_susuka') {
      return;
    }
    if (seenIds.has(cleanId) || (cleanNpsn && seenNpsn.has(cleanNpsn))) {
      return;
    }
    seenIds.add(cleanId);
    if (cleanNpsn) seenNpsn.add(cleanNpsn);
    deduplicated.push({ ...s, schoolId: cleanId });
  });

  return deduplicated;
}

export function saveRegisteredSchools(list: SchoolConfig[]): void {
  if (typeof localStorage !== 'undefined') {
    const seenIds = new Set<string>();
    const cleanList: SchoolConfig[] = [];
    list.forEach(s => {
      const cleanId = sanitizeSchoolId(s.schoolId || s.npsn || s.schoolName);
      if (s.schoolId === 'sch_uptd_spf_smp_negeri_2_susuka') return;
      if (!seenIds.has(cleanId)) {
        seenIds.add(cleanId);
        cleanList.push({ ...s, schoolId: cleanId });
      }
    });
    safeSetItem('bk_registered_schools', JSON.stringify(cleanList));
  }
}

export function getSchoolConfig(forSchoolId?: string): SchoolConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_SCHOOL_CONFIG;
  const targetId = forSchoolId ? sanitizeSchoolId(forSchoolId) : getActiveSchoolId();

  // Try reading school-specific config
  const specific = localStorage.getItem(`bk_school_config_${targetId}`);
  if (specific) {
    try {
      const parsed = JSON.parse(specific);
      return { ...DEFAULT_SCHOOL_CONFIG, ...parsed, schoolId: targetId };
    } catch (e) {}
  }

  // Fallback to general config if matching
  const saved = localStorage.getItem('bk_school_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const parsedId = parsed.schoolId ? sanitizeSchoolId(parsed.schoolId) : generateSchoolIdFromConfig(parsed);
      if (!forSchoolId || parsedId === targetId) {
        return {
          ...DEFAULT_SCHOOL_CONFIG,
          ...parsed,
          schoolId: parsedId
        };
      }
    } catch (e) {}
  }

  // Find in registered schools
  const found = getRegisteredSchools().find(s => s.schoolId === targetId);
  if (found) {
    return { ...DEFAULT_SCHOOL_CONFIG, ...found, schoolId: targetId };
  }

  return { ...DEFAULT_SCHOOL_CONFIG, schoolId: targetId };
}

export function saveSchoolConfig(config: SchoolConfig): void {
  if (typeof localStorage === 'undefined') return;

  const schoolId = config.schoolId ? sanitizeSchoolId(config.schoolId) : generateSchoolIdFromConfig(config);
  const updatedConfig: SchoolConfig = {
    ...config,
    schoolId,
    updatedAt: new Date().toISOString()
  };

  safeSetItem('bk_active_school_id', schoolId);
  safeSetItem('bk_school_config', JSON.stringify(updatedConfig));
  safeSetItem(`bk_school_config_${schoolId}`, JSON.stringify(updatedConfig));

  // Update registered schools registry
  const currentSchools = getRegisteredSchools();
  const existingIdx = currentSchools.findIndex(s => s.schoolId === schoolId);
  let updatedList: SchoolConfig[];
  if (existingIdx !== -1) {
    updatedList = [...currentSchools];
    updatedList[existingIdx] = updatedConfig;
  } else {
    updatedList = [...currentSchools, updatedConfig];
  }
  saveRegisteredSchools(updatedList);

  // Trigger events for reactive UI and Cloud Sync
  window.dispatchEvent(new Event('bk_school_config_updated'));
}

export function switchSchoolWorkspace(targetSchool: Partial<SchoolConfig> & { schoolId?: string; npsn?: string; schoolName: string }): SchoolConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_SCHOOL_CONFIG;

  const targetId = targetSchool.schoolId 
    ? sanitizeSchoolId(targetSchool.schoolId) 
    : generateSchoolIdFromConfig(targetSchool);

  const existingConfig = getSchoolConfig(targetId);
  const newConfig: SchoolConfig = {
    ...DEFAULT_SCHOOL_CONFIG,
    ...existingConfig,
    ...targetSchool,
    schoolId: targetId
  };

  setActiveSchoolId(targetId);
  saveSchoolConfig(newConfig);

  // Trigger school switch event
  window.dispatchEvent(new CustomEvent('bk_school_changed', { detail: { schoolId: targetId, config: newConfig } }));
  window.dispatchEvent(new Event('bk_school_config_updated'));
  window.dispatchEvent(new Event('storage'));

  return newConfig;
}

export function resetSchoolConfigToDefault(): void {
  if (typeof localStorage !== 'undefined') {
    setActiveSchoolId('sch_20320123');
    saveSchoolConfig(DEFAULT_SCHOOL_CONFIG);
    localStorage.removeItem('bk_custom_school_logo');
    localStorage.removeItem('bk_custom_kabupaten_logo');
    window.dispatchEvent(new CustomEvent('bk_school_changed', { detail: { schoolId: 'sch_20320123', config: DEFAULT_SCHOOL_CONFIG } }));
    window.dispatchEvent(new Event('bk_school_config_updated'));
  }
}
