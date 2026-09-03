export interface SchoolConfig {
  schoolId?: string;
  schoolName: string;
  schoolAddress: string;
  principalName: string;
  principalNip: string;
  governmentName: string;
  departmentName: string;
  npsn?: string;
  phoneEmail?: string;
  customLogo?: string;
  customKabupatenLogo?: string;
  updatedAt?: string;
}

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  schoolId: 'sch_20320123',
  schoolName: 'SMP N 2 Susukan',
  schoolAddress: 'Jl. Kyai Hasan Anwar No. 16, Susukan, Kec. Susukan, Kab. Semarang, Jawa Tengah 50777',
  principalName: 'Agus Setiawan, S.Pd. Fis',
  principalNip: '19680831 199103 1 007',
  governmentName: 'PEMERINTAH KABUPATEN SEMARANG',
  departmentName: 'DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA',
  npsn: '20320123',
  phoneEmail: 'Email: smpn2susukan@sch.id | Telp: (0298) 123456',
};

export function sanitizeSchoolId(input: string): string {
  if (!input || !input.trim()) return 'sch_20320123';
  const clean = input.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 32);
  if (!clean) return 'sch_20320123';
  return clean.startsWith('sch_') ? clean : `sch_${clean}`;
}

export function generateSchoolIdFromConfig(cfg: Partial<SchoolConfig>): string {
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

  const savedPartitioned = localStorage.getItem(partitionedKey);
  if (savedPartitioned) {
    try {
      return JSON.parse(savedPartitioned);
    } catch (e) {}
  }

  // Fallback to baseKey if partitioned not yet created or for backwards-compatibility
  const savedBase = localStorage.getItem(baseKey);
  if (savedBase) {
    try {
      const parsed = JSON.parse(savedBase);
      // Automatically migrate to partitioned key
      localStorage.setItem(partitionedKey, savedBase);
      return parsed;
    } catch (e) {}
  }

  return fallback;
}

export function saveSchoolData<T>(baseKey: string, data: T, schoolId?: string): void {
  if (typeof localStorage === 'undefined') return;
  const sId = schoolId ? sanitizeSchoolId(schoolId) : getActiveSchoolId();
  const partitionedKey = `${baseKey}_${sId}`;
  const serialized = JSON.stringify(data);

  localStorage.setItem(partitionedKey, serialized);
  // Also keep baseKey synchronized for the active school workspace so direct readers stay in sync
  if (sId === getActiveSchoolId()) {
    localStorage.setItem(baseKey, serialized);
  }
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

  // Ensure default SMP N 2 Susukan is present in list
  if (!list.some(s => s.schoolId === 'sch_20320123' || s.npsn === '20320123')) {
    list.unshift(DEFAULT_SCHOOL_CONFIG);
  }
  return list;
}

export function saveRegisteredSchools(list: SchoolConfig[]): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('bk_registered_schools', JSON.stringify(list));
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

  localStorage.setItem('bk_active_school_id', schoolId);
  localStorage.setItem('bk_school_config', JSON.stringify(updatedConfig));
  localStorage.setItem(`bk_school_config_${schoolId}`, JSON.stringify(updatedConfig));

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
