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
  CheckCircle2
} from 'lucide-react';

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
        <h2 className="text-2xl font-extrabold text-[#0b1c30]">Pengaturan Identitas &amp; Logo Sekolah</h2>
        <p className="text-sm text-[#3d4947]/70 font-semibold mt-0.5">
          Sesuaikan nama sekolah, alamat, kepala sekolah, serta unggah Logo Sekolah &amp; Logo Kabupaten secara dinamis untuk kop surat laporan BK.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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
    </div>
  );
}
