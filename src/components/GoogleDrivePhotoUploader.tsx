import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Trash2, 
  ExternalLink, 
  Cloud, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Image as ImageIcon,
  FolderOpen,
  Sparkles,
  Zap,
  Info
} from 'lucide-react';
import { uploadImageToGoogleDrive, DriveUploadResult } from '../utils/googleDriveUpload';
import { getAccessToken, googleSignIn } from '../utils/firebaseAuth';
import { showToast } from '../utils/toast';

interface GoogleDrivePhotoUploaderProps {
  photoUrl?: string;
  photoName?: string;
  driveFileId?: string;
  driveViewUrl?: string;
  category: 'sesi' | 'home_visit' | 'pelanggaran' | 'umum';
  studentName?: string;
  date?: string;
  label?: string;
  description?: string;
  required?: boolean;
  onPhotoChange: (data: {
    photoUrl?: string;
    photoName?: string;
    driveFileId?: string;
    driveViewUrl?: string;
    isDrive: boolean;
  }) => void;
}

export default function GoogleDrivePhotoUploader({
  photoUrl,
  photoName,
  driveFileId,
  driveViewUrl,
  category,
  studentName,
  date,
  label = 'Foto Dokumentasi Bukti Kegiatan',
  description = 'Unggah langsung ke Google Drive agar tidak membebani memori lokal aplikasi.',
  required = false,
  onPhotoChange,
}: GoogleDrivePhotoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDriveConnected, setIsDriveConnected] = useState<boolean | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check drive authentication status
  useEffect(() => {
    let isMounted = true;
    getAccessToken().then((token) => {
      if (isMounted) {
        setIsDriveConnected(Boolean(token));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Handle Camera
  const startCamera = async (facing: 'environment' | 'user' = cameraFacing) => {
    setCameraError(null);
    setShowCamera(true);
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setCameraStream(stream);
      setCameraFacing(facing);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Gagal mengakses kamera. Pastikan izin kamera telah diberikan di browser.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const switchCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    startCamera(nextFacing);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      stopCamera();
      await processAndUpload(dataUrl, `foto_kamera_${Date.now()}.jpg`);
    }
  };

  // Upload or Store Handler
  const processAndUpload = async (source: File | string, fileName?: string) => {
    setIsUploading(true);
    setUploadProgress(20);

    const token = await getAccessToken();

    if (token) {
      // Direct upload to Google Drive
      setUploadProgress(45);
      try {
        const result: DriveUploadResult = await uploadImageToGoogleDrive(source, fileName, {
          category,
          studentName,
          date,
        });

        setUploadProgress(90);

        if (result.success && result.directUrl) {
          setIsDriveConnected(true);
          onPhotoChange({
            photoUrl: result.directUrl,
            photoName: result.fileName,
            driveFileId: result.fileId,
            driveViewUrl: result.webViewLink,
            isDrive: true,
          });
          showToast(`Foto berhasil diunggah ke Google Drive (${result.folderName})`, 'success');
        } else {
          // Fallback to local data URL if Drive upload had an issue
          console.warn('Drive upload failed, falling back to local state:', result.error);
          handleLocalFallback(source, fileName, result.error);
        }
      } catch (err: any) {
        console.error('Upload to Drive error:', err);
        handleLocalFallback(source, fileName, err?.message);
      } finally {
        setIsUploading(false);
        setUploadProgress(100);
      }
    } else {
      // Not yet connected to Google Drive
      handleLocalFallback(source, fileName);
      setIsUploading(false);
    }
  };

  const handleLocalFallback = (source: File | string, fileName?: string, errorMessage?: string) => {
    if (typeof source === 'string') {
      onPhotoChange({
        photoUrl: source,
        photoName: fileName || 'foto_dokumentasi.jpg',
        isDrive: false,
      });
      if (errorMessage) {
        showToast(`Tersimpan lokal (${errorMessage})`, 'info');
      } else {
        showToast('Foto tersimpan di penyimpanan lokal', 'info');
      }
    } else if (source instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onPhotoChange({
          photoUrl: base64,
          photoName: source.name,
          isDrive: false,
        });
        showToast('Foto tersimpan di penyimpanan lokal', 'info');
      };
      reader.readAsDataURL(source);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Hanya berkas gambar/foto (JPG, PNG, WebP) yang didukung.', 'error');
        return;
      }
      processAndUpload(file, file.name);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Hanya berkas gambar/foto yang didukung.', 'error');
        return;
      }
      processAndUpload(file, file.name);
    }
  };

  const handleConnectAndUpload = async () => {
    try {
      setIsUploading(true);
      const authRes = await googleSignIn();
      if (authRes && authRes.accessToken) {
        setIsDriveConnected(true);
        showToast('Berhasil terhubung ke Akun Google!', 'success');
        if (photoUrl && !driveFileId) {
          // Re-upload existing local photo to Google Drive
          await processAndUpload(photoUrl, photoName);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menghubungkan Google Drive', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    onPhotoChange({
      photoUrl: undefined,
      photoName: undefined,
      driveFileId: undefined,
      driveViewUrl: undefined,
      isDrive: false,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showToast('Foto dokumentasi dihapus', 'info');
  };

  const isStoredInDrive = Boolean(driveFileId || (photoUrl && photoUrl.includes('googleusercontent.com')));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-[#00685f]" />
          {label} {required && <span className="text-red-500">*</span>}
        </label>

        {/* Google Drive Status Indicator */}
        <div className="flex items-center gap-1.5">
          {isStoredInDrive ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              Google Drive Aktif
            </span>
          ) : isDriveConnected ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200">
              <Cloud className="w-3 h-3 text-[#00685f]" />
              Drive Siap Simpan
            </span>
          ) : (
            <button
              type="button"
              onClick={handleConnectAndUpload}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
            >
              <Cloud className="w-3 h-3 text-blue-600" />
              Hubungkan Google Drive
            </button>
          )}
        </div>
      </div>

      {description && (
        <p className="text-[11px] text-[#3d4947] flex items-center gap-1">
          <Info className="w-3 h-3 text-gray-400 shrink-0" />
          {description}
        </p>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Main Container */}
      {!photoUrl && !showCamera && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`p-4 bg-white border-2 border-dashed rounded-xl transition-all ${
            isDragging
              ? 'border-[#00685f] bg-teal-50/40'
              : 'border-gray-200 hover:border-teal-400 bg-gray-50/50'
          }`}
        >
          {isUploading ? (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
              <RefreshCw className="w-8 h-8 text-[#00685f] animate-spin" />
              <p className="text-xs font-bold text-[#0b1c30]">
                Sedang mengunggah foto ke folder Google Drive...
              </p>
              <p className="text-[11px] text-gray-500">Menyiapkan direktori & izin akses aman</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {/* Ambil Kamera Button */}
              <button
                type="button"
                onClick={() => startCamera()}
                className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Ambil Foto Kamera Langsung
              </button>

              {/* Upload File Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-gray-100 text-[#0b1c30] border border-gray-300 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-gray-600" />
                Pilih File / Galeri Foto
              </button>
            </div>
          )}
        </div>
      )}

      {/* Live Camera Modal / Viewfinder */}
      {showCamera && (
        <div className="p-3 bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden space-y-3">
          <div className="relative aspect-4/3 max-h-72 w-full bg-black rounded-xl overflow-hidden flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {cameraError && (
              <div className="absolute inset-0 p-4 bg-black/80 flex flex-col items-center justify-center text-center text-white space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-400" />
                <p className="text-xs">{cameraError}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={switchCameraFacing}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Ganti Kamera
            </button>

            <button
              type="button"
              onClick={capturePhoto}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              Jepret Foto
            </button>

            <button
              type="button"
              onClick={stopCamera}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Display Photo Preview & Drive Links */}
      {photoUrl && !showCamera && (
        <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-2xs space-y-2.5">
          <div className="flex items-start gap-3">
            {/* Image Preview Box */}
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 shrink-0 group">
              <img
                src={photoUrl}
                alt="Dokumentasi Bukti"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <a
                href={driveViewUrl || photoUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity"
              >
                Lihat Penuh ↗
              </a>
            </div>

            {/* Info & Action Buttons */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#0b1c30] truncate" title={photoName || 'Foto Bukti'}>
                  {photoName || 'Foto Dokumentasi Kegiatan'}
                </p>

                {isStoredInDrive ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Tersimpan di Google Drive
                    </span>
                    {driveViewUrl && (
                      <a
                        href={driveViewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00685f] hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Buka di Drive
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      Tersimpan Lokal
                    </span>
                    <button
                      type="button"
                      onClick={handleConnectAndUpload}
                      disabled={isUploading}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00685f] hover:bg-teal-50 px-2 py-0.5 rounded border border-teal-300 transition-colors cursor-pointer"
                    >
                      {isUploading ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Cloud className="w-3 h-3" />
                      )}
                      Pindahkan ke Google Drive
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-bold text-gray-700 hover:text-[#00685f] transition-colors cursor-pointer"
                >
                  Ganti Foto
                </button>
                <span className="text-gray-300">•</span>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
