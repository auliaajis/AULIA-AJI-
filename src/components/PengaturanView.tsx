import React, { useState, useEffect } from 'react';
import SchoolLogo from './SchoolLogo';
import KabupatenLogo from './KabupatenLogo';
import { 
  Save, 
  RotateCcw, 
  Building, 
  MapPin, 
  User, 
  ShieldAlert, 
  Upload, 
  Trash2, 
  Image as ImageIcon, 
  Sparkles,
  CheckCircle2,
  Mail,
  Plus,
  Search,
  Users,
  Settings,
  Check,
  X,
  Info,
  Pencil
} from 'lucide-react';

export interface WaliKelasConfig {
  class: string;
  name: string;
  email: string;
}

interface SchoolConfig {
  schoolName: string;
  schoolAddress: string;
  principalName: string;
  principalNip: string;
  governmentName: string;
  departmentName: string;
}

export default function PengaturanView() {
  const [config, setConfig] = useState<SchoolConfig>({
    schoolName: 'SMP N 2 Susukan',
    schoolAddress: 'Desa Koripan, Kec. Susukan, Kab. Semarang, Jawa Tengah 50777',
    principalName: 'Agus Setiawan, S.Pd. Fis',
    principalNip: '19680831 199103 1 007',
    governmentName: 'PEMERINTAH KABUPATEN SEMARANG',
    departmentName: 'DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA',
  });

  const [activeTab, setActiveTab] = useState<'identitas' | 'walikelas'>('identitas');
  const [threshold, setThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('bk_email_threshold');
    return saved ? parseInt(saved) || 20 : 20;
  });

  const defaultWaliKelasList: WaliKelasConfig[] = [
    { class: 'Kelas 7A', name: 'Ibu Nona Marlina, S.Pd.', email: 'wali.kelas.7a@smpn2susukan.sch.id' },
    { class: 'Kelas 7B', name: 'Bapak Budi Santoso, S.Pd.', email: 'wali.kelas.7b@smpn2susukan.sch.id' },
    { class: 'Kelas 7C', name: 'Ibu Citra Lestari, S.Pd.', email: 'wali.kelas.7c@smpn2susukan.sch.id' },
    { class: 'Kelas 7D', name: 'Ibu Dewi Setyowati, S.Pd.', email: 'wali.kelas.7d@smpn2susukan.sch.id' },
    { class: 'Kelas 7E', name: 'Bapak Eko Prasetyo, S.Pd.', email: 'wali.kelas.7e@smpn2susukan.sch.id' },
    { class: 'Kelas 7F', name: 'Ibu Farida Asri, S.Pd.', email: 'wali.kelas.7f@smpn2susukan.sch.id' },
    { class: 'Kelas 8A', name: 'Ibu Aulia Aji Sasongko, S.Pd.', email: 'wali.kelas.8a@smpn2susukan.sch.id' },
    { class: 'Kelas 8B', name: 'Bapak Heri Wibowo, S.Pd.', email: 'wali.kelas.8b@smpn2susukan.sch.id' },
    { class: 'Kelas 8C', name: 'Ibu Indah Permata, S.Pd.', email: 'wali.kelas.8c@smpn2susukan.sch.id' },
    { class: 'Kelas 8D', name: 'Ibu Joko Susilo, S.Pd.', email: 'wali.kelas.8d@smpn2susukan.sch.id' },
    { class: 'Kelas 8E', name: 'Bapak Kusuma Wijaya, S.Pd.', email: 'wali.kelas.8e@smpn2susukan.sch.id' },
    { class: 'Kelas 8F', name: 'Ibu Lilis Handayani, S.Pd.', email: 'wali.kelas.8f@smpn2susukan.sch.id' },
    { class: 'Kelas 8G', name: 'Bapak Mujiyono, S.Pd.', email: 'wali.kelas.8g@smpn2susukan.sch.id' },
    { class: 'Kelas 9A', name: 'Ibu Tri Handayani, S.Pd.', email: 'wali.kelas.9a@smpn2susukan.sch.id' },
    { class: 'Kelas 9B', name: 'Bapak Nurdin, S.Pd.', email: 'wali.kelas.9b@smpn2susukan.sch.id' },
    { class: 'Kelas 9C', name: 'Ibu Oki Rahmawati, S.Pd.', email: 'wali.kelas.9c@smpn2susukan.sch.id' },
    { class: 'Kelas 9D', name: 'Bapak Purwanto, S.Pd.', email: 'wali.kelas.9d@smpn2susukan.sch.id' },
    { class: 'Kelas 9E', name: 'Ibu Qori Lestari, S.Pd.', email: 'wali.kelas.9e@smpn2susukan.sch.id' },
    { class: 'Kelas 9F', name: 'Bapak Roni Wijaya, S.Pd.', email: 'wali.kelas.9f@smpn2susukan.sch.id' },
    { class: 'Kelas 9G', name: 'Ibu Siti Aminah, S.Pd.', email: 'wali.kelas.9g@smpn2susukan.sch.id' },
  ];

  const [waliKelasList, setWaliKelasList] = useState<WaliKelasConfig[]>(() => {
    const saved = localStorage.getItem('bk_walikelas_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return defaultWaliKelasList;
      }
    }
    return defaultWaliKelasList;
  });

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editClass, setEditClass] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const [isAdding, setIsAdding] = useState(false);
  const [newClass, setNewClass] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  const handleSaveThreshold = (newVal: number) => {
    setThreshold(newVal);
    localStorage.setItem('bk_email_threshold', newVal.toString());
  };

  const handleSaveWaliKelasList = (newList: WaliKelasConfig[]) => {
    setWaliKelasList(newList);
    localStorage.setItem('bk_walikelas_config', JSON.stringify(newList));
    window.dispatchEvent(new Event('storage'));
  };

  const handleEdit = (index: number) => {
    const item = waliKelasList[index];
    setEditingIndex(index);
    setEditClass(item.class);
    setEditName(item.name);
    setEditEmail(item.email);
  };

  const handleSaveEdit = (index: number) => {
    if (!editClass.trim() || !editName.trim() || !editEmail.trim()) {
      alert('Semua data wajib diisi!');
      return;
    }
    const updated = [...waliKelasList];
    updated[index] = {
      class: editClass.trim(),
      name: editName.trim(),
      email: editEmail.trim()
    };
    handleSaveWaliKelasList(updated);
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data wali kelas untuk ${waliKelasList[index].class}?`)) {
      const updated = waliKelasList.filter((_, i) => i !== index);
      handleSaveWaliKelasList(updated);
    }
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.trim() || !newName.trim() || !newEmail.trim()) {
      alert('Semua data wajib diisi!');
      return;
    }
    const exists = waliKelasList.some(item => item.class.toLowerCase() === newClass.trim().toLowerCase());
    if (exists) {
      alert(`Wali kelas untuk ${newClass} sudah terdaftar!`);
      return;
    }
    const updated = [
      ...waliKelasList,
      {
        class: newClass.trim(),
        name: newName.trim(),
        email: newEmail.trim()
      }
    ].sort((a, b) => a.class.localeCompare(b.class));

    handleSaveWaliKelasList(updated);
    setIsAdding(false);
    setNewClass('');
    setNewName('');
    setNewEmail('');
  };

  const handleResetWaliKelas = () => {
    if (confirm('Apakah Anda yakin ingin menyetel ulang seluruh data Wali Kelas dan email ke pengaturan bawaan SMP N 2 Susukan?')) {
      handleSaveWaliKelasList(defaultWaliKelasList);
      handleSaveThreshold(20);
    }
  };

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [hasCustomSchoolLogo, setHasCustomSchoolLogo] = useState(false);
  const [hasCustomKabupatenLogo, setHasCustomKabupatenLogo] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  // Load existing config
  useEffect(() => {
    const saved = localStorage.getItem('bk_school_config');
    const defaults = {
      schoolName: 'SMP N 2 Susukan',
      schoolAddress: 'Jl. Kyai Hasan Anwar No. 16, Susukan, Kec. Susukan, Kab. Semarang, Jawa Tengah 50777',
      principalName: 'Drs. H. Suhardi, M.Pd.',
      principalNip: '19680320 199403 1 005',
      governmentName: 'PEMERINTAH KABUPATEN SEMARANG',
      departmentName: 'DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA'
    };
    if (saved) {
      try {
        setConfig({
          ...defaults,
          ...JSON.parse(saved)
        });
      } catch (e) {
        // error parsing, keep defaults
      }
    } else {
      setConfig(defaults);
    }

    const checkCustomLogos = () => {
      setHasCustomSchoolLogo(!!localStorage.getItem('bk_custom_school_logo'));
      setHasCustomKabupatenLogo(!!localStorage.getItem('bk_custom_kabupaten_logo'));
    };

    checkCustomLogos();
    window.addEventListener('logo-update', checkCustomLogos);
    return () => {
      window.removeEventListener('logo-update', checkCustomLogos);
    };
  }, []);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    key: 'bk_custom_school_logo' | 'bk_custom_kabupaten_logo',
    label: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match('image/jpeg') && !file.type.match('image/png') && !file.type.match('image/jpg')) {
      alert('Format file tidak didukung. Silakan unggah file gambar berformat JPG, JPEG, atau PNG.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Optimize logo sizes to max 250px to protect localStorage quota & guarantee PDF compilation speed
        const maxDim = 250;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          localStorage.setItem(key, base64);
          
          // Dispatch notifications for other components
          window.dispatchEvent(new Event('logo-update'));
          window.dispatchEvent(new Event('storage'));

          setUploadFeedback(`Berhasil mengunggah ${label}!`);
          setTimeout(() => setUploadFeedback(null), 3000);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleClearLogo = (key: 'bk_custom_school_logo' | 'bk_custom_kabupaten_logo', label: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus custom ${label} dan kembali menggunakan logo default?`)) {
      localStorage.removeItem(key);
      window.dispatchEvent(new Event('logo-update'));
      window.dispatchEvent(new Event('storage'));
      
      setUploadFeedback(`${label} dikembalikan ke bawaan sistem.`);
      setTimeout(() => setUploadFeedback(null), 3000);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('bk_school_config', JSON.stringify(config));
    
    // Dispatch a storage event so other components (or window) know the config updated
    window.dispatchEvent(new Event('storage'));
    
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 3000);
  };

  const handleReset = () => {
    if (confirm('Apakah Anda yakin ingin mengembalikan pengaturan ke default sekolah SMP N 2 Susukan?')) {
      const defaultConfig = {
        schoolName: 'SMP N 2 Susukan',
        schoolAddress: 'Jl. Kyai Hasan Anwar No. 16, Susukan, Kec. Susukan, Kab. Semarang, Jawa Tengah 50777',
        principalName: 'Drs. H. Suhardi, M.Pd.',
        principalNip: '19680320 199403 1 005',
        governmentName: 'PEMERINTAH KABUPATEN SEMARANG',
        departmentName: 'DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA'
      };
      setConfig(defaultConfig);
      localStorage.setItem('bk_school_config', JSON.stringify(defaultConfig));
      
      // Also clear custom uploaded logos to return to pure original state
      localStorage.removeItem('bk_custom_school_logo');
      localStorage.removeItem('bk_custom_kabupaten_logo');
      
      window.dispatchEvent(new Event('logo-update'));
      window.dispatchEvent(new Event('storage'));
      
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
      }, 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300" id="pengaturan-view-container">
      <div>
        <h2 className="text-2xl font-extrabold text-[#0b1c30]">Pengaturan Sistem &amp; Wali Kelas</h2>
        <p className="text-sm text-[#3d4947]/70 font-semibold mt-0.5">
          Atur identitas sekolah, unggah logo kop surat, serta kelola nama dan alamat email Wali Kelas untuk otomatisasi notifikasi pelanggaran.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200 gap-2" id="tabs-container">
        <button
          type="button"
          onClick={() => setActiveTab('identitas')}
          className={`pb-3 px-5 text-sm font-extrabold transition-all border-b-2 cursor-pointer ${
            activeTab === 'identitas'
              ? 'border-[#00685f] text-[#00685f]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Identitas &amp; Logo Sekolah
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('walikelas')}
          className={`pb-3 px-5 text-sm font-extrabold transition-all border-b-2 cursor-pointer ${
            activeTab === 'walikelas'
              ? 'border-[#00685f] text-[#00685f]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Wali Kelas &amp; Email Notifikasi ({waliKelasList.length})
        </button>
      </div>

      {activeTab === 'identitas' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          {/* Left Side: Logo Preview & Upload Section (4 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-6">
              <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2 pb-2 border-b border-gray-100">
                <ImageIcon className="w-4.5 h-4.5 text-[#00685f]" />
                <span>Daftar Logo Kop Surat</span>
              </h3>

              {/* Notification Feedback */}
              {uploadFeedback && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{uploadFeedback}</span>
                </div>
              )}

              {/* Logo 1: Logo Kabupaten */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/60 space-y-3.5">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-xs text-gray-700">1. Logo Kabupaten (Kop Kiri)</h4>
                    <p className="text-[10px] text-gray-500 font-medium">Format JPG/PNG • Maks 5MB (Kompres otomatis)</p>
                  </div>
                  {hasCustomKabupatenLogo ? (
                    <span className="text-[9px] font-extrabold bg-[#00685f]/10 text-[#00685f] px-2 py-0.5 rounded-full uppercase">Kustom</span>
                  ) : (
                    <span className="text-[9px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full uppercase">Bawaan</span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <KabupatenLogo size={70} className="shrink-0 border shadow-sm bg-white" />
                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-97">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah JPG</span>
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/jpg" 
                        onChange={(e) => handleImageUpload(e, 'bk_custom_kabupaten_logo', 'Logo Kabupaten')} 
                        className="hidden" 
                      />
                    </label>
                    
                    {hasCustomKabupatenLogo && (
                      <button
                        type="button"
                        onClick={() => handleClearLogo('bk_custom_kabupaten_logo', 'Logo Kabupaten')}
                        className="ml-2 inline-flex items-center gap-1 px-2.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-colors"
                        title="Kembalikan ke Default"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Logo 2: Logo Sekolah */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/60 space-y-3.5">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-xs text-gray-700">2. Logo Sekolah (Kop Kanan)</h4>
                    <p className="text-[10px] text-gray-500 font-medium">Format JPG/PNG • Maks 5MB (Kompres otomatis)</p>
                  </div>
                  {hasCustomSchoolLogo ? (
                    <span className="text-[9px] font-extrabold bg-[#00685f]/10 text-[#00685f] px-2 py-0.5 rounded-full uppercase">Kustom</span>
                  ) : (
                    <span className="text-[9px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full uppercase">Bawaan</span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <SchoolLogo size={70} className="shrink-0 border shadow-sm" />
                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-97">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah JPG</span>
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/jpg" 
                        onChange={(e) => handleImageUpload(e, 'bk_custom_school_logo', 'Logo Sekolah')} 
                        className="hidden" 
                      />
                    </label>

                    {hasCustomSchoolLogo && (
                      <button
                        type="button"
                        onClick={() => handleClearLogo('bk_custom_school_logo', 'Logo Sekolah')}
                        className="ml-2 inline-flex items-center gap-1 px-2.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-colors"
                        title="Kembalikan ke Default"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Note alert */}
              <div className="pt-2 text-[11px] leading-relaxed text-amber-800 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/40 font-semibold space-y-1">
                <div className="flex gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Catatan Desain:</strong> Logo yang Anda unggah akan secara otomatis disinkronkan di sidebar, header, serta disematkan pada kop surat berkas PDF (Siswa, Layanan, Absensi) demi dokumen yang seragam dan profesional.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Identity Form Card (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm">
            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-4">
                {/* Government Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    Instansi Pemerintah / Pemerintah Daerah (Kop Baris 1)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <Building className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={config.governmentName}
                      onChange={(e) => setConfig({ ...config, governmentName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all font-semibold"
                      placeholder="Contoh: PEMERINTAH KABUPATEN SEMARANG"
                    />
                  </div>
                </div>

                {/* Department Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    Dinas Terkait (Kop Baris 2)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <Building className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={config.departmentName}
                      onChange={(e) => setConfig({ ...config, departmentName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all font-semibold"
                      placeholder="Contoh: DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA"
                    />
                  </div>
                </div>

                {/* School Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    Nama Sekolah (Kop Baris 3)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <Building className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={config.schoolName}
                      onChange={(e) => setConfig({ ...config, schoolName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all font-bold"
                      placeholder="Contoh: SMP N 2 Susukan"
                    />
                  </div>
                </div>

                {/* School Address Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    Alamat Lengkap Sekolah
                  </label>
                  <div className="relative">
                    <span className="absolute top-3 left-0 pl-3 flex items-start text-gray-400">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <textarea
                      required
                      rows={3}
                      value={config.schoolAddress}
                      onChange={(e) => setConfig({ ...config, schoolAddress: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all"
                      placeholder="Tuliskan jalan, kecamatan, kabupaten, dan kode pos"
                    />
                  </div>
                </div>

                {/* Principal Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    Nama Kepala Sekolah
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={config.principalName}
                      onChange={(e) => setConfig({ ...config, principalName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all"
                      placeholder="Contoh: Drs. H. Suhardi, M.Pd."
                    />
                  </div>
                </div>

                {/* Principal NIP Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    NIP Kepala Sekolah
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={config.principalNip}
                      onChange={(e) => setConfig({ ...config, principalNip: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all"
                      placeholder="Contoh: 19680320 199403 1 005"
                    />
                  </div>
                </div>
              </div>

              {savedSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold animate-in fade-in slide-in-from-top-1">
                  Berhasil menyimpan pengaturan identitas sekolah! Data cetak PDF kini diperbarui secara real-time.
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-sm font-bold transition-all shadow-md cursor-pointer active:scale-97"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
                
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold transition-all cursor-pointer"
                  title="Reset ke Default"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">Reset Default</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-200" id="walikelas-tab-container">
          {/* Email Notification Settings Banner/Card */}
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-8 space-y-2">
              <h3 className="font-extrabold text-[#0b1c30] flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#00685f]" />
                <span>Atur Ambang Batas Notifikasi Pelanggaran</span>
              </h3>
              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                Tentukan jumlah akumulasi poin pelanggaran minimal yang akan memicu pengiriman email notifikasi otomatis ke Wali Kelas yang bersangkutan.
              </p>
            </div>
            <div className="md:col-span-4 flex items-center gap-3 justify-end">
              <label className="text-xs font-bold text-gray-700 uppercase shrink-0">Minimal Poin:</label>
              <input
                type="number"
                min={1}
                max={250}
                value={threshold}
                onChange={(e) => handleSaveThreshold(parseInt(e.target.value) || 20)}
                className="w-24 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-center font-bold text-sm text-[#00685f] focus:outline-none focus:ring-2 focus:ring-[#00685f]"
              />
              <span className="text-xs text-gray-500 font-semibold">Poin</span>
            </div>
          </div>

          {/* Wali Kelas Management Section */}
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2">
                  <Users className="w-4.5 h-4.5 text-[#00685f]" />
                  <span>Daftar Wali Kelas SMP N 2 Susukan</span>
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">Hubungkan nama kelas dengan nama wali kelas serta alamat email aktif.</p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleResetWaliKelas}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  title="Kembalikan semua wali kelas ke default SMP N 2 Susukan"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Bawaan</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setIsAdding(!isAdding)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  {isAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{isAdding ? 'Batal' : 'Tambah Wali Kelas'}</span>
                </button>
              </div>
            </div>

            {/* Add New Wali Kelas Form Panel */}
            {isAdding && (
              <form onSubmit={handleAddNew} className="bg-gray-50 rounded-xl p-5 border border-gray-200/80 grid grid-cols-1 md:grid-cols-12 gap-4 animate-in slide-in-from-top-2 duration-200">
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-700 block uppercase tracking-wider">Nama Kelas</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kelas 7A"
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00685f] font-semibold"
                  />
                </div>
                <div className="md:col-span-4 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-700 block uppercase tracking-wider">Nama Wali Kelas &amp; Gelar</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ibu Nona Marlina, S.Pd."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-700 block uppercase tracking-wider">Alamat Email Wali Kelas</label>
                  <input
                    type="email"
                    required
                    placeholder="Contoh: wali.kelas.7a@smpn2susukan.sch.id"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Simpan Baru
                  </button>
                </div>
              </form>
            )}

            {/* Filter Search Bar */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Cari kelas, nama wali kelas atau email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#00685f] font-semibold"
              />
            </div>

            {/* Table of Wali Kelas */}
            <div className="overflow-x-auto rounded-xl border border-gray-200/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 font-extrabold uppercase border-b border-gray-200 tracking-wider">
                    <th className="px-4 py-3 w-1/4">Kelas</th>
                    <th className="px-4 py-3 w-1/3">Wali Kelas</th>
                    <th className="px-4 py-3 w-1/3">Email Notifikasi</th>
                    <th className="px-4 py-3 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {waliKelasList
                    .filter(item => 
                      item.class.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      item.email.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((item, index) => {
                      const isEditing = editingIndex === index;
                      return (
                        <tr key={index} className={`hover:bg-gray-50/50 transition-colors ${isEditing ? 'bg-amber-50/20' : ''}`}>
                          {isEditing ? (
                            <>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={editClass}
                                  onChange={(e) => setEditClass(e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white font-bold"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="email"
                                  value={editEmail}
                                  onChange={(e) => setEditEmail(e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(index)}
                                    className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded"
                                    title="Simpan"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingIndex(null)}
                                    className="p-1 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded"
                                    title="Batal"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-bold text-gray-900">{item.class}</td>
                              <td className="px-4 py-3 text-gray-800">{item.name}</td>
                              <td className="px-4 py-3 font-mono text-[11px] text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  <span>{item.email}</span>
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(index)}
                                    className="p-1 hover:bg-gray-100 text-gray-500 hover:text-gray-800 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(index)}
                                    className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition-colors"
                                    title="Hapus"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  {waliKelasList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400 font-semibold">
                        Belum ada wali kelas terdaftar. Tekan tombol &quot;Reset Bawaan&quot; atau &quot;Tambah Wali Kelas&quot; untuk memulai.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Alert Banner */}
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/40 flex gap-3 text-xs text-emerald-800 font-semibold">
              <Info className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Alur Kerja Sistem Otomatis:</strong> Setiap kali pelanggaran baru dicatat untuk siswa yang membuat total akumulasi poinnya menyentuh atau melebihi batas <strong>{threshold} poin</strong>, sistem akan secara otomatis memicu draf surat elektronik bimbingan konseling yang siap dikirimkan secara instan ke email Wali Kelas di atas.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
