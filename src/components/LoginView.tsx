import React, { useState, useEffect, useMemo } from 'react';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  User, 
  CheckCircle2, 
  ShieldAlert, 
  ArrowRight, 
  UserPlus, 
  Building2, 
  Search, 
  Plus, 
  RefreshCw, 
  X, 
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { Counselor } from '../types';
import SchoolLogo from './SchoolLogo';
import KabupatenLogo from './KabupatenLogo';
import { 
  fetchCloudRegisteredSchools,
  fetchCloudCounselors,
  searchCloudCounselor,
  saveAccountRequestToCloud,
  listenToAccountRequests
} from '../utils/firestoreSync';
import { 
  getSchoolConfig, 
  getRegisteredSchools, 
  saveRegisteredSchools,
  switchSchoolWorkspace, 
  getActiveSchoolId, 
  setActiveSchoolId,
  loadSchoolData,
  saveSchoolData,
  sanitizeSchoolId, 
  SchoolConfig 
} from '../utils/schoolConfig';
import { initialStudents, initialViolations, initialServices, initialLogs } from '../data/mockData';
import { clearCanonicalDeletedIds, resetStudentDeletedIds } from '../utils/deletionTracker';
import { CANONICAL_AULIA_STUDENTS } from '../data/canonicalStudents';

interface LoginViewProps {
  allCounselors: (Counselor & { username?: string; password?: string })[];
  onLoginSuccess: (counselor: Counselor) => void;
  onCreateNewCounselor?: (newCounselor: Counselor, makeActive?: boolean) => void;
}

export default function LoginView({ 
  allCounselors: initialCounselors, 
  onLoginSuccess,
  onCreateNewCounselor 
}: LoginViewProps) {
  const [currentSchool, setCurrentSchool] = useState<SchoolConfig>(() => getSchoolConfig());
  const [registeredSchools, setRegisteredSchools] = useState<SchoolConfig[]>(() => getRegisteredSchools());
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');

  // Form registrasi sekolah baru
  const [isRegisteringSchool, setIsRegisteringSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolNpsn, setNewSchoolNpsn] = useState('');
  const [newSchoolAddress, setNewSchoolAddress] = useState('');
  const [newPrincipalName, setNewPrincipalName] = useState('');
  const [newPrincipalNip, setNewPrincipalNip] = useState('');

  // State login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [autoSwitchedNotice, setAutoSwitchedNotice] = useState<string | null>(null);

  // Modal lupa sandi & registrasi guru baru
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Form registrasi akun guru baru
  const [regSchoolNpsn, setRegSchoolNpsn] = useState<string>(() => currentSchool.npsn || '20320123');
  const [regSchoolName, setRegSchoolName] = useState<string>(() => currentSchool.schoolName || 'SMP N 2 Susukan');
  const [regSchoolAddress, setRegSchoolAddress] = useState<string>(() => currentSchool.schoolAddress || '');
  const [regName, setRegName] = useState('');
  const [regNip, setRegNip] = useState('');
  const [regRole, setRegRole] = useState('Guru Pembimbing BK');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regClasses, setRegClasses] = useState('8A, 8B, 8C, 8D, 8E, 8F, 8G');
  const [regAvatar] = useState('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120');
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const [liveSubmissionStatus, setLiveSubmissionStatus] = useState<Counselor | null>(null);

  useEffect(() => {
    const handleSchoolUpdated = () => {
      const cfg = getSchoolConfig();
      setCurrentSchool(cfg);
      setRegisteredSchools(getRegisteredSchools());
    };
    window.addEventListener('bk_school_config_updated', handleSchoolUpdated);
    window.addEventListener('bk_school_changed', handleSchoolUpdated);

    // Ambil daftar sekolah terdaftar dari Cloud
    fetchCloudRegisteredSchools().then((schools) => {
      if (schools && schools.length > 0) {
        setRegisteredSchools(schools);
      }
    });

    // Listener real-time untuk status permohonan akun
    const unsubAccountRequests = listenToAccountRequests((requests) => {
      const currentTrackedId = sessionStorage.getItem('bk_tracked_reg_id');
      if (currentTrackedId) {
        const found = requests.find(r => r.id === currentTrackedId);
        if (found) {
          setLiveSubmissionStatus(found as Counselor);
          if (found.approvalStatus === 'approved') {
            setSuccessNotice(`Akun "${found.name}" telah disetujui Administrator BK. Anda dapat langsung masuk sekarang.`);
            sessionStorage.removeItem('bk_tracked_reg_id');
          } else if (found.approvalStatus === 'rejected') {
            setError(`Permintaan pendaftaran akun untuk "${found.name}" telah ditolak oleh Administrator BK.`);
          }
        }
      }
    });

    return () => {
      window.removeEventListener('bk_school_config_updated', handleSchoolUpdated);
      window.removeEventListener('bk_school_changed', handleSchoolUpdated);
      if (typeof unsubAccountRequests === 'function') {
        unsubAccountRequests();
      }
    };
  }, []);

  // Beralih sekolah/database
  const handleSelectSchool = async (school: SchoolConfig) => {
    const switched = switchSchoolWorkspace(school);
    setCurrentSchool(switched);
    setShowSchoolModal(false);
    setError(null);
    setUsername('');
    setPassword('');
    setAutoSwitchedNotice(null);
    setSuccessNotice(`Beralih ke database ${switched.schoolName} (NPSN: ${switched.npsn || '-'}).`);
  };

  // Simpan sekolah baru
  const handleSaveNewSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim() || !newSchoolNpsn.trim()) {
      alert('Nama Sekolah dan NPSN wajib diisi.');
      return;
    }
    const cleanNpsn = newSchoolNpsn.trim().replace(/[^0-9a-zA-Z]/g, '');
    const newSchool: SchoolConfig = {
      schoolName: newSchoolName.trim(),
      npsn: cleanNpsn,
      schoolAddress: newSchoolAddress.trim() || 'Alamat Belum Diatur',
      principalName: newPrincipalName.trim() || 'Kepala Sekolah',
      principalNip: newPrincipalNip.trim() || '-',
      governmentName: 'PEMERINTAH KABUPATEN / KOTA',
      departmentName: 'DINAS PENDIDIKAN'
    };
    const switched = switchSchoolWorkspace(newSchool);
    setCurrentSchool(switched);
    setRegisteredSchools(getRegisteredSchools());
    setIsRegisteringSchool(false);
    setShowSchoolModal(false);

    setNewSchoolName('');
    setNewSchoolNpsn('');
    setNewSchoolAddress('');
    setNewPrincipalName('');
    setNewPrincipalNip('');
    setSuccessNotice(`Pangkalan data baru "${switched.schoolName}" berhasil dibuat dan siap digunakan.`);
  };

  // Update NPSN pada form registrasi
  const handleNpsnChange = (val: string) => {
    const cleanDigits = val.replace(/[^0-9a-zA-Z]/g, '');
    setRegSchoolNpsn(cleanDigits);
    if (cleanDigits.length >= 4) {
      const found = registeredSchools.find(
        s => (s.npsn && s.npsn.replace(/[^0-9a-zA-Z]/g, '') === cleanDigits) ||
             s.schoolId === `sch_${cleanDigits}`
      );
      if (found) {
        setRegSchoolName(found.schoolName);
        if (found.schoolAddress) setRegSchoolAddress(found.schoolAddress);
      }
    }
  };

  // Auto-generate username jika nama diisi
  const handleNameChange = (val: string) => {
    setRegName(val);
    if (!regUsername || regUsername.trim() === '') {
      const clean = val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
      if (clean) setRegUsername(clean);
    }
    if (!regEmail || regEmail.trim() === '') {
      const clean = val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
      if (clean) setRegEmail(`${clean}@guru.smp.belajar.id`);
    }
  };

  // Helper pencarian sekolah asal akun
  const findSchoolForAccount = (rawInput: string): SchoolConfig | null => {
    if (!rawInput || rawInput.trim().length < 2) return null;
    const q = rawInput.trim().toLowerCase();
    const qDigits = q.replace(/[^0-9]/g, '');

    const checkMatch = (c: any): boolean => {
      if (!c) return false;
      const uMatch = c.username?.trim().toLowerCase() === q;
      const eMatch = c.email?.trim().toLowerCase() === q;
      const nameMatch = c.name?.trim().toLowerCase() === q;
      const cNipDigits = (c.nip || '').replace(/[^0-9]/g, '');
      const nipMatch = qDigits.length >= 4 && cNipDigits.includes(qDigits);
      return Boolean(uMatch || eMatch || nameMatch || nipMatch);
    };

    // Cari di pangkalan data sekolah terdaftar
    for (const school of registeredSchools) {
      const sId = school.schoolId ? sanitizeSchoolId(school.schoolId) : (school.npsn ? sanitizeSchoolId(school.npsn) : '');
      if (sId) {
        const counselorsInSchool = loadSchoolData<any[]>('bk_counselors', [], sId);
        if (Array.isArray(counselorsInSchool)) {
          for (const c of counselorsInSchool) {
            if (checkMatch(c)) return school;
          }
        }
      }
    }

    // Default sekolah canonical
    for (const c of (initialCounselors || [])) {
      if (checkMatch(c)) {
        const canonical = registeredSchools.find(s => s.schoolId === 'sch_20320123' || s.npsn === '20320123');
        return canonical || getSchoolConfig('sch_20320123');
      }
    }
    return null;
  };

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    setError(null);
    if (!val.trim()) {
      setAutoSwitchedNotice(null);
      return;
    }
    const targetSchool = findSchoolForAccount(val);
    if (targetSchool) {
      const curId = currentSchool.schoolId ? sanitizeSchoolId(currentSchool.schoolId) : getActiveSchoolId();
      const targetId = targetSchool.schoolId ? sanitizeSchoolId(targetSchool.schoolId) : sanitizeSchoolId(targetSchool.npsn || '');
      if (targetId && targetId !== curId) {
        const switched = switchSchoolWorkspace(targetSchool);
        setCurrentSchool(switched);
        setAutoSwitchedNotice(`Otomatis mengarah ke NPSN ${switched.npsn || '-'} (${switched.schoolName}).`);
      }
    }
  };

  // Helper pencocokan akun lokal
  const findMatchingCounselor = (inputUser: string, inputPass: string, targetSchoolId?: string) => {
    const rawUser = inputUser.trim().toLowerCase();
    const rawDigits = rawUser.replace(/[^0-9]/g, '');
    const cleanPass = inputPass.trim();
    const effectiveSchoolId = targetSchoolId ? sanitizeSchoolId(targetSchoolId) : (currentSchool.schoolId ? sanitizeSchoolId(currentSchool.schoolId) : getActiveSchoolId());

    const candidates = new Map<string, any>();
    const fromStorage = loadSchoolData<any[]>('bk_counselors', [], effectiveSchoolId);
    if (Array.isArray(fromStorage)) {
      fromStorage.forEach(c => { if (c?.id) candidates.set(c.id, c); });
    }

    if (effectiveSchoolId === 'sch_20320123') {
      (initialCounselors || []).forEach(c => {
        if (c?.id && !candidates.has(c.id)) {
          candidates.set(c.id, c);
        }
      });
    }

    const candidateList = Array.from(candidates.values());
    return candidateList.find((c) => {
      const uMatch = c.username?.trim().toLowerCase() === rawUser;
      const eMatch = c.email?.trim().toLowerCase() === rawUser;
      const nameMatch = c.name?.trim().toLowerCase() === rawUser;
      const cNipDigits = (c.nip || '').replace(/[^0-9]/g, '');
      const nipMatch = rawDigits.length >= 4 && cNipDigits.includes(rawDigits);
      if (!(uMatch || eMatch || nameMatch || nipMatch)) return false;

      const storedPass = (c.password || '').trim();
      if (!storedPass) {
        return cleanPass === '123456' || cleanPass === 'password' || cleanPass === (c.username || '').toLowerCase() || cleanPass === 'admin';
      }
      return storedPass === cleanPass || storedPass.toLowerCase() === cleanPass.toLowerCase();
    });
  };

  const auliaCounselor = useMemo(() => {
    const found = (initialCounselors || []).find(
      (c) => c.id === 'c1' || c.username === 'aulia' || (c.name && c.name.toLowerCase().includes('aulia'))
    );
    if (found) {
      return {
        ...found,
        id: 'c1',
        name: 'Aulia Aji Sasongko, S.Pd.',
        role: 'Koordinator BK & Administrator Sekolah',
        nip: found.nip && found.nip !== '-' ? found.nip : 'NIP. 19931231 202221 1 002',
        username: 'aulia',
        email: 'auliasasongko12@guru.smp.belajar.id',
        phone: '089681287339',
        schoolId: 'sch_20320123',
        schoolNpsn: '20320123',
        schoolName: 'SMP N 2 Susukan',
        allowedClasses: ['7A', '7B', '7C', '7D', '7E', '7F', '8A', '8B', '8C', '8D', '8E', '8F', '8G', '9A', '9B', '9C', '9D', '9E', '9F', '9G']
      };
    }
    return {
      id: 'c1',
      name: 'Aulia Aji Sasongko, S.Pd.',
      role: 'Koordinator BK & Administrator Sekolah',
      nip: 'NIP. 19931231 202221 1 002',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
      allowedClasses: ['7A', '7B', '7C', '7D', '7E', '7F', '8A', '8B', '8C', '8D', '8E', '8F', '8G', '9A', '9B', '9C', '9D', '9E', '9F', '9G'],
      username: 'aulia',
      email: 'auliasasongko12@guru.smp.belajar.id',
      phone: '089681287339',
      schoolId: 'sch_20320123',
      schoolNpsn: '20320123',
      schoolName: 'SMP N 2 Susukan'
    };
  }, [initialCounselors]);

  const handleQuickLogin = (counselorToLogin: any) => {
    setError(null);
    setLoading(true);
    try {
      const isAulia = counselorToLogin.id === 'c1' || counselorToLogin.username === 'aulia' || (counselorToLogin.name && counselorToLogin.name.toLowerCase().includes('aulia'));
      const targetSchool = getSchoolConfig(isAulia ? 'sch_20320123' : counselorToLogin.schoolId);
      switchSchoolWorkspace(targetSchool);
      setCurrentSchool(targetSchool);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('bk_active_counselor_id', counselorToLogin.id);
        localStorage.setItem('bk_is_logged_in', 'true');
      }
      if (isAulia) {
        setActiveSchoolId('sch_20320123');
        resetStudentDeletedIds();
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('bk_dummy_students_purged');
          localStorage.removeItem('bk_cleared_sch_20320123');
          localStorage.removeItem('bk_students_cleared_sch_20320123');
        }
        const existingStudents = loadSchoolData<any[]>('bk_students', [], 'sch_20320123');
        if (!existingStudents || existingStudents.length === 0) {
          saveSchoolData('bk_students', CANONICAL_AULIA_STUDENTS, 'sch_20320123');
        }
        const existingViolations = loadSchoolData<any[]>('bk_violations', [], 'sch_20320123');
        if (!existingViolations || existingViolations.length === 0 || existingViolations.length < initialViolations.length) {
          saveSchoolData('bk_violations', initialViolations, 'sch_20320123');
        }
        const existingServices = loadSchoolData<any[]>('bk_services', [], 'sch_20320123');
        if (!existingServices || existingServices.length === 0 || existingServices.length < initialServices.length) {
          saveSchoolData('bk_services', initialServices, 'sch_20320123');
        }
      }
      onLoginSuccess(counselorToLogin);
    } catch (err: any) {
      setError('Gagal masuk cepat: ' + (err?.message || err));
      setLoading(false);
    }
  };

  // Submit Login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    if (!username.trim() || !password.trim()) {
      setError('Silakan masukkan Username / NIP dan Kata Sandi.');
      return;
    }

    setLoading(true);

    const autoDetectedSchool = findSchoolForAccount(username);
    let activeTargetSchool = currentSchool;
    if (autoDetectedSchool) {
      const curId = currentSchool.schoolId ? sanitizeSchoolId(currentSchool.schoolId) : getActiveSchoolId();
      const detId = autoDetectedSchool.schoolId ? sanitizeSchoolId(autoDetectedSchool.schoolId) : '';
      if (detId && detId !== curId) {
        activeTargetSchool = switchSchoolWorkspace(autoDetectedSchool);
        setCurrentSchool(activeTargetSchool);
      }
    }

    // 1. Cek autentikasi Cloud Firestore
    let matched: any = null;
    try {
      const cloudResult = await searchCloudCounselor(username, password);
      if (cloudResult && cloudResult.counselor) {
        matched = cloudResult.counselor;
        const targetCfg = cloudResult.schoolConfig || autoDetectedSchool;
        if (targetCfg) {
          activeTargetSchool = switchSchoolWorkspace(targetCfg);
          setCurrentSchool(activeTargetSchool);
        }
        const currentSchoolId = cloudResult.schoolId || activeTargetSchool.schoolId || getActiveSchoolId();
        const currentList = loadSchoolData('bk_counselors', [], currentSchoolId);
        const merged = [...currentList.filter((c: any) => c.id !== matched.id), matched];
        saveSchoolData('bk_counselors', merged, currentSchoolId);
      }
    } catch (err) {
      console.warn('Cloud login lookup notice:', err);
    }

    // 2. Fallback autentikasi lokal
    if (!matched) {
      const targetSchoolId = activeTargetSchool.schoolId ? sanitizeSchoolId(activeTargetSchool.schoolId) : getActiveSchoolId();
      matched = findMatchingCounselor(username, password, targetSchoolId);

      if (!matched) {
        for (const sch of registeredSchools) {
          const sId = sch.schoolId ? sanitizeSchoolId(sch.schoolId) : '';
          if (sId && sId !== targetSchoolId) {
            const found = findMatchingCounselor(username, password, sId);
            if (found) {
              matched = found;
              activeTargetSchool = sch;
              break;
            }
          }
        }
      }
    }

    setLoading(false);

    if (matched) {
      if (matched.approvalStatus === 'pending') {
        setError(`Akun "${matched.name}" masih berstatus MENUNGGU PERSETUJUAN dari Administrator BK.`);
        return;
      }
      if (matched.approvalStatus === 'rejected') {
        setError(`Pendaftaran akun "${matched.name}" ditolak oleh Administrator BK.`);
        return;
      }
      if (matched.isBlocked) {
        setError('Akun Anda dinonaktifkan oleh Administrator BK.');
        return;
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('bk_active_counselor_id', matched.id);
      }

      const isAulia = username.trim().toLowerCase() === 'aulia' || 
                      username.toLowerCase().includes('aulia') ||
                      matched.id === 'c1' || 
                      matched.username === 'aulia' || 
                      (matched.name && matched.name.toLowerCase().includes('aulia'));

      if (isAulia) {
        setActiveSchoolId('sch_20320123');
        resetStudentDeletedIds();
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('bk_dummy_students_purged');
          localStorage.removeItem('bk_cleared_sch_20320123');
          localStorage.removeItem('bk_students_cleared_sch_20320123');
        }
        const existingStudents = loadSchoolData<any[]>('bk_students', [], 'sch_20320123');
        if (!existingStudents || existingStudents.length === 0) {
          saveSchoolData('bk_students', CANONICAL_AULIA_STUDENTS, 'sch_20320123');
        }
        const existingViolations = loadSchoolData<any[]>('bk_violations', [], 'sch_20320123');
        if (!existingViolations || existingViolations.length === 0 || existingViolations.length < initialViolations.length) {
          saveSchoolData('bk_violations', initialViolations, 'sch_20320123');
        }
        const existingServices = loadSchoolData<any[]>('bk_services', [], 'sch_20320123');
        if (!existingServices || existingServices.length === 0 || existingServices.length < initialServices.length) {
          saveSchoolData('bk_services', initialServices, 'sch_20320123');
        }
      }

      const resolvedSchoolId = isAulia ? 'sch_20320123' : (activeTargetSchool.schoolId ? sanitizeSchoolId(activeTargetSchool.schoolId) : getActiveSchoolId());
      const finalizedCounselor = isAulia ? {
        ...matched,
        id: 'c1',
        name: 'Aulia Aji Sasongko, S.Pd.',
        role: 'Koordinator BK & Administrator Sekolah',
        nip: matched.nip && matched.nip !== '-' ? matched.nip : 'NIP. 19931231 202221 1 002',
        avatar: matched.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
        allowedClasses: ['7A', '7B', '7C', '7D', '7E', '7F', '8A', '8B', '8C', '8D', '8E', '8F', '8G', '9A', '9B', '9C', '9D', '9E', '9F', '9G'],
        username: 'aulia',
        password: password || 'aulia',
        email: 'auliasasongko12@guru.smp.belajar.id',
        phone: '089681287339',
        schoolId: 'sch_20320123',
        schoolNpsn: '20320123',
        schoolName: 'SMP N 2 Susukan'
      } : {
        ...matched,
        schoolId: resolvedSchoolId,
        schoolNpsn: activeTargetSchool.npsn || matched.schoolNpsn || '',
        schoolName: activeTargetSchool.schoolName || matched.schoolName || ''
      };

      switchSchoolWorkspace(activeTargetSchool);
      setCurrentSchool(activeTargetSchool);
      onLoginSuccess(finalizedCounselor);
    } else {
      setError('Akun tidak ditemukan atau kata sandi tidak cocok. Silakan periksa kembali kredensial Anda.');
    }
  };

  // Submit Registrasi Akun Baru
  const handleSaveNewAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regUsername.trim()) {
      alert('Nama Lengkap dan Username wajib diisi.');
      return;
    }
    const cleanNpsn = regSchoolNpsn.trim().replace(/[^0-9a-zA-Z]/g, '');
    if (!cleanNpsn) {
      alert('NPSN Sekolah wajib diisi.');
      return;
    }

    setIsSubmittingReg(true);
    try {
      const targetSchoolId = sanitizeSchoolId(cleanNpsn);
      const targetSchoolConfig: SchoolConfig = {
        schoolId: targetSchoolId,
        schoolName: regSchoolName.trim() || `SMP Terdaftar (NPSN: ${cleanNpsn})`,
        npsn: cleanNpsn,
        schoolAddress: regSchoolAddress.trim() || 'Alamat Sekolah Terdaftar',
        principalName: 'Kepala Sekolah',
        principalNip: '-',
        governmentName: 'PEMERINTAH KABUPATEN / KOTA',
        departmentName: 'DINAS PENDIDIKAN'
      };

      const existingInSchool = loadSchoolData<any[]>('bk_counselors', [], targetSchoolId);
      const isFirstAccount = existingInSchool.length === 0 && cleanNpsn !== '20320123';
      const cleanUsername = regUsername.trim().toLowerCase();

      const parsedClasses = regClasses.split(',').map(c => c.trim()).filter(Boolean);

      const newAccount: Counselor & { username?: string; password?: string } = {
        id: `c-${Date.now()}`,
        name: regName.trim(),
        nip: regNip.trim() || '-',
        role: regRole.trim() || 'Guru Pembimbing BK',
        email: regEmail.trim() || `${cleanUsername}@guru.smp.belajar.id`,
        avatar: regAvatar,
        allowedClasses: parsedClasses,
        username: cleanUsername,
        password: regPassword.trim() || '123456',
        isBlocked: false,
        approvalStatus: isFirstAccount ? 'approved' : 'pending',
        registeredAt: new Date().toISOString(),
        schoolId: targetSchoolId,
        schoolNpsn: cleanNpsn,
        schoolName: regSchoolName.trim()
      };

      await saveAccountRequestToCloud(newAccount, targetSchoolConfig);

      setLiveSubmissionStatus(newAccount);
      sessionStorage.setItem('bk_tracked_reg_id', newAccount.id);

      const switchedSchool = switchSchoolWorkspace(targetSchoolConfig);
      setCurrentSchool(switchedSchool);

      const updatedSchoolCounselors = [...existingInSchool.filter(c => c.id !== newAccount.id), newAccount];
      saveSchoolData('bk_counselors', updatedSchoolCounselors, targetSchoolId);
      window.dispatchEvent(new Event('storage'));

      if (onCreateNewCounselor) {
        onCreateNewCounselor(newAccount, false);
      }

      setUsername(newAccount.username || '');
      setPassword('');
      setShowRegisterModal(false);

      if (isFirstAccount) {
        setSuccessNotice(`Akun "${newAccount.name}" berhasil didaftarkan sebagai Admin pertama untuk ${targetSchoolConfig.schoolName}. Silakan masukkan kata sandi untuk masuk.`);
      } else {
        setSuccessNotice(`Pendaftaran akun "${newAccount.name}" telah dikirim. Menunggu persetujuan Administrator BK sekolah.`);
      }

      setRegName('');
      setRegNip('');
      setRegUsername('');
      setRegPassword('');
      setRegEmail('');
    } catch (err: any) {
      alert('Gagal mengirim pendaftaran: ' + (err?.message || 'Terjadi kesalahan'));
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const filteredSchools = useMemo(() => {
    if (!schoolSearch.trim()) return registeredSchools;
    const q = schoolSearch.toLowerCase();
    return registeredSchools.filter(
      s => s.schoolName.toLowerCase().includes(q) || (s.npsn && s.npsn.includes(q))
    );
  }, [registeredSchools, schoolSearch]);

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* Top Bar: Identitas Sekolah & Navigasi Bersih */}
      <header className="w-full max-w-xl mx-auto flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <KabupatenLogo size={38} className="shadow-2xs border border-amber-600/10 bg-white" />
            <SchoolLogo size={38} className="shadow-2xs border border-[#00685f]/15" />
          </div>
          <div>
            <h1 className="text-lg font-black text-[#0b1c30] tracking-tight leading-none">
              SIKAP-BK
            </h1>
            <p className="text-[11px] text-[#00685f] font-bold mt-1">
              {currentSchool.schoolName || 'SMP N 2 Susukan'} • NPSN {currentSchool.npsn || '20320123'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowSchoolModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-[#0b1c30] border border-[#bcc9c6]/60 rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
          title="Ganti database sekolah"
        >
          <Building2 className="w-3.5 h-3.5 text-[#00685f]" />
          <span>Ganti Sekolah</span>
        </button>
      </header>

      {/* Main Container - Bersih, Elegan, Terpusat */}
      <main className="w-full max-w-xl mx-auto my-auto">
        <div className="bg-white p-5 sm:p-7 rounded-2xl border border-[#bcc9c6]/50 shadow-xs space-y-4">
          
          {/* Header Card Guru BK */}
          <div className="text-center space-y-1 pb-1">
            <h2 className="text-xl font-extrabold text-[#0b1c30] tracking-tight">
              Masuk Guru & Petugas BK
            </h2>
            <p className="text-xs text-[#3d4947]">
              Pangkalan data terpadu Bimbingan Konseling SMP N 2 Susukan
            </p>
          </div>

              {/* Notifikasi Otomatis / Status */}
              {autoSwitchedNotice && (
                <div className="p-3 bg-[#e6f4f1] border border-[#00685f]/30 rounded-xl text-xs text-[#00685f] font-semibold flex gap-2 items-center">
                  <Building2 className="w-4 h-4 shrink-0 text-[#00685f]" />
                  <span className="leading-snug">{autoSwitchedNotice}</span>
                </div>
              )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold flex gap-2 items-center">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex gap-2 items-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {liveSubmissionStatus && liveSubmissionStatus.approvalStatus === 'pending' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Pendaftaran Sedang Diproses
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Akun untuk <strong>{liveSubmissionStatus.name}</strong> sedang menunggu verifikasi dari Administrator BK.
              </p>
            </div>
          )}

          {/* Quick Access / Masuk 1-Klik - Super User Friendly */}
          <div className="bg-gradient-to-br from-[#e6f4f1] via-teal-50/70 to-emerald-50/50 border border-[#00685f]/30 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-white px-2.5 py-0.5 rounded-full border border-[#00685f]/20 shadow-2xs">
                Akses Cepat 1-Klik
              </span>
              <span className="text-[10px] text-[#00685f] font-bold">
                SMP N 2 Susukan
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-[#00685f]/40 shrink-0 bg-white shadow-2xs">
                {auliaCounselor.avatar ? (
                  <img
                    src={auliaCounselor.avatar}
                    alt={auliaCounselor.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#00685f] text-white font-bold text-sm">
                    AS
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#0b1c30] truncate">
                  {auliaCounselor.name}
                </h3>
                <p className="text-[11px] text-[#00685f] font-bold truncate">
                  {auliaCounselor.role}
                </p>
                <p className="text-[10px] text-gray-500 font-medium">
                  {auliaCounselor.nip || 'NIP. 19931231 202221 1 002'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleQuickLogin(auliaCounselor)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl font-extrabold text-xs shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <span>Masuk Langsung sebagai Koordinator BK</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-3 text-gray-400 text-[11px] font-semibold">atau masuk akun lain</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          {/* Form Login Manual */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            
            {/* Input Username / NIP / Email */}
            <div className="space-y-1">
              <label htmlFor="login-username" className="block text-xs font-bold text-[#0b1c30]">
                Nama Pengguna / NIP / Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl text-xs text-[#0b1c30] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] transition-all"
                  placeholder="Masukkan username atau NIP"
                />
              </div>
            </div>

            {/* Input Kata Sandi */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label htmlFor="login-password" className="block text-xs font-bold text-[#0b1c30]">
                  Kata Sandi
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] text-[#00685f] hover:underline font-semibold cursor-pointer"
                >
                  Lupa sandi?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl text-xs text-[#0b1c30] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] transition-all"
                  placeholder="Masukkan kata sandi"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Tombol Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-xs text-xs font-bold text-white bg-[#00685f] hover:bg-[#005049] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00685f] transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Masuk</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Opsi Tambahan Bersih */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-[#3d4947]">
            <span className="text-gray-500 text-[11px]">Belum memiliki akun?</span>
            <button
              type="button"
              onClick={() => setShowRegisterModal(true)}
              className="inline-flex items-center gap-1 font-bold text-[#00685f] hover:underline cursor-pointer text-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Daftar Guru BK</span>
            </button>
          </div>

          {/* Badge Keamanan Ringkas */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-center gap-1.5 text-[10px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00685f]" />
            <span>Kerahasiaan Data Terisolasi Khusus {currentSchool.schoolName}</span>
          </div>

        </div>
      </main>

      {/* Footer Bersih */}
      <footer className="w-full text-center text-[11px] text-gray-400 font-medium pt-4">
        SIKAP-BK • Sistem Informasi Konseling & Bimbingan Konseling Sekolah
      </footer>

      {/* Modal Lupa Sandi */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[#bcc9c6]/40 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-teal-50 text-[#00685f] rounded-xl">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#0b1c30]">Lupa Kata Sandi</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#3d4947] leading-relaxed">
              <p>
                Untuk menjaga privasi dan kerahasiaan catatan konseling siswa, pengaturan ulang kata sandi dilakukan secara aman melalui Koordinator BK / Administrator Sekolah.
              </p>
              <div className="p-3 bg-[#e6f4f1] rounded-xl border border-[#00685f]/20 space-y-1 text-xs">
                <p className="font-bold text-[#0b1c30]">Administrator Sekolah:</p>
                <p className="font-semibold text-[#00685f]">Bapak Aulia Aji Sasongko, S.Pd.</p>
                <p className="text-[11px] text-gray-600">
                  Reset kata sandi dapat diatur pada menu <em>Pengaturan &gt; Hak Akses</em>.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Switch / Daftarkan Sekolah */}
      {showSchoolModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#bcc9c6]/40 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-teal-50 text-[#00685f] rounded-xl">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#0b1c30]">Pilih Sekolah</h3>
                  <p className="text-[10px] text-gray-400">Database siswa dan layanan tersimpan terpisah</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSchoolModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isRegisteringSchool ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Pangkalan Data Terdaftar</span>
                  <button
                    type="button"
                    onClick={() => setIsRegisteringSchool(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#00685f] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Sekolah Baru</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari nama sekolah atau NPSN..."
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-gray-100">
                  {filteredSchools.map((s) => {
                    const isCurrent = (s.schoolId || s.npsn) === (currentSchool.schoolId || currentSchool.npsn);
                    return (
                      <div
                        key={s.schoolId || s.npsn || s.schoolName}
                        className={`pt-2 first:pt-0 p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isCurrent ? 'bg-[#e6f4f1] border-[#00685f]/30' : 'hover:bg-gray-50 border-gray-100'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0b1c30] truncate">{s.schoolName}</p>
                          <p className="text-[10px] text-gray-500 truncate">
                            NPSN: {s.npsn || '-'}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectSchool(s)}
                          disabled={isCurrent}
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                            isCurrent
                              ? 'bg-teal-100 text-[#00685f] cursor-default'
                              : 'bg-[#00685f] hover:bg-[#005049] text-white cursor-pointer shadow-2xs'
                          }`}
                        >
                          {isCurrent ? 'Aktif' : 'Pilih'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveNewSchool} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 block">
                    Nama Sekolah <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    placeholder="Contoh: SMP Negeri 1 Bawang"
                    className="w-full text-xs p-2.5 bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 block">
                    NPSN (Nomor Pokok Sekolah Nasional) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newSchoolNpsn}
                    onChange={(e) => setNewSchoolNpsn(e.target.value)}
                    placeholder="Contoh: 20320456"
                    className="w-full text-xs p-2.5 bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 block">
                    Alamat Sekolah
                  </label>
                  <input
                    type="text"
                    value={newSchoolAddress}
                    onChange={(e) => setNewSchoolAddress(e.target.value)}
                    placeholder="Jl. Raya Utama No. 12"
                    className="w-full text-xs p-2.5 bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700 block">
                      Nama Kepala Sekolah
                    </label>
                    <input
                      type="text"
                      value={newPrincipalName}
                      onChange={(e) => setNewPrincipalName(e.target.value)}
                      placeholder="Drs. H. Ahmad, M.Pd."
                      className="w-full text-xs p-2.5 bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700 block">
                      NIP Kepala Sekolah
                    </label>
                    <input
                      type="text"
                      value={newPrincipalNip}
                      onChange={(e) => setNewPrincipalNip(e.target.value)}
                      placeholder="19700101 199503 1 002"
                      className="w-full text-xs p-2.5 bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsRegisteringSchool(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Simpan Sekolah Baru
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Registrasi Akun Guru Baru */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#bcc9c6]/40 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-teal-50 text-[#00685f] rounded-xl">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#0b1c30]">Daftar Akun Guru BK Baru</h3>
                  <p className="text-[10px] text-gray-400">
                    Sekolah: <span className="font-bold text-[#00685f]">{currentSchool.schoolName}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewAccount} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 block">
                  Nama Lengkap & Gelar <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Contoh: Dra. Siti Rahayu, M.Pd."
                  className="w-full text-xs p-2.5 bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 block">
                    NPSN Sekolah <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regSchoolNpsn}
                    onChange={(e) => handleNpsnChange(e.target.value)}
                    placeholder="20320123"
                    className="w-full text-xs p-2.5 bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] font-mono font-bold text-[#00685f]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 block">
                    NIP (Opsional)
                  </label>
                  <input
                    type="text"
                    value={regNip}
                    onChange={(e) => setRegNip(e.target.value)}
                    placeholder="19850101 201001 2 001"
                    className="w-full text-xs p-2.5 bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 block">
                  Jabatan / Peran
                </label>
                <input
                  type="text"
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  placeholder="Guru Pembimbing BK"
                  className="w-full text-xs p-2.5 bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 block">
                    Username Login <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="username"
                    className="w-full text-xs p-2.5 bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] font-mono font-bold text-[#00685f]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 block">
                    Kata Sandi <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full text-xs p-2.5 pr-8 bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 block">
                  Kelas Bimbingan
                </label>
                <input
                  type="text"
                  value={regClasses}
                  onChange={(e) => setRegClasses(e.target.value)}
                  placeholder="Contoh: 8A, 8B, 8C, 8D"
                  className="w-full text-xs p-2.5 bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  disabled={isSubmittingReg}
                  className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReg}
                  className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] disabled:bg-gray-400 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingReg ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Ajukan Akun</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
