import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { 
  Home, 
  Plus, 
  Search, 
  Calendar, 
  MapPin, 
  Users, 
  FileText, 
  Camera, 
  Upload, 
  Download, 
  Trash2, 
  ChevronRight, 
  X, 
  Check, 
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { Student, Counselor, HomeVisitRecord } from '../types';
import { drawLetterhead, getSchoolConfig } from '../utils/pdfGenerator';

interface SignaturePadProps {
  label: string;
  onChange: (base64: string | undefined) => void;
}

function SignaturePad({ label, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: any) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setIsEmpty(false);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onChange(canvas.toDataURL('image/png'));
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange(undefined);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0b1c30'; // Dark Slate
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  return (
    <div className="space-y-1.5 p-3.5 bg-gray-50 border border-gray-300 rounded-xl w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-bold text-[#0b1c30] uppercase tracking-wide block">
          {label}
        </span>
        {!isEmpty && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] font-extrabold text-red-600 hover:underline uppercase cursor-pointer"
          >
            Reset TTD
          </button>
        )}
      </div>

      <div className="relative bg-white border border-dashed border-gray-300 rounded-lg overflow-hidden h-28 flex items-center justify-center">
        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              Sentuh / Seret Layar HP
            </span>
            <span className="text-[9px] text-gray-400 mt-0.5">
              Tulis Tanda Tangan di Sini
            </span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={400}
          height={140}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        />
      </div>
    </div>
  );
}

interface HomeVisitViewProps {
  students: Student[];
  activeCounselor: Counselor;
}

export default function HomeVisitView({ students, activeCounselor }: HomeVisitViewProps) {
  // Core states
  const [visits, setVisits] = useState<HomeVisitRecord[]>(() => {
    const saved = localStorage.getItem('bk_home_visits');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Navigation / Modal States
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<HomeVisitRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [parentNameMet, setParentNameMet] = useState('');
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [address, setAddress] = useState('');
  const [purpose, setPurpose] = useState('');
  const [result, setResult] = useState('');
  const [agreement, setAgreement] = useState('');
  
  // Photo capture & upload states
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [photoName, setPhotoName] = useState<string | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);

  // Digital Signature states
  const [parentSignature, setParentSignature] = useState<string | undefined>(undefined);
  const [counselorSignature, setCounselorSignature] = useState<string | undefined>(undefined);
  
  // Live Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('bk_home_visits', JSON.stringify(visits));
  }, [visits]);

  // Handle student selection from autocomplete
  const handleSelectStudent = (student: Student) => {
    setSelectedStudentId(student.id);
    setSelectedStudent(student);
    setStudentSearch(student.name);
    setShowStudentDropdown(false);
    
    // Auto populate common fields
    setParentNameMet(`Bapak / Ibu Wali dari ${student.name}`);
  };

  // Filter student suggestions
  const studentSuggestions = React.useMemo(() => {
    const query = studentSearch.toLowerCase().trim();
    if (!query) return [];
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.nis.includes(query) ||
        s.class.toLowerCase().includes(query)
    );
  }, [studentSearch, students]);

  // Handle local file selection / drop
  const processFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Hanya diperbolehkan melampirkan berkas gambar/foto.');
      return;
    }
    
    // Convert to Base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPhotoUrl(base64);
      setPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Camera Capture implementation
  const startCamera = async () => {
    setCameraError(null);
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        'Gagal mengakses kamera. Pastikan izin kamera telah diberikan dan kamera tidak sedang digunakan oleh aplikasi lain.'
      );
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPhotoUrl(dataUrl);
        setPhotoName(`kamera_capture_${Date.now()}.jpg`);
        stopCamera();
      }
    }
  };

  // Submit form handler
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert('Silakan pilih siswa target terlebih dahulu.');
      return;
    }

    const year = new Date(visitDate).getFullYear();
    const randomNumber = Math.floor(100 + Math.random() * 900);
    const reportNumber = `HV-${year}-${randomNumber}`;

    const newRecord: HomeVisitRecord = {
      id: `hv-${Date.now()}`,
      reportNumber,
      date: visitDate,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      studentClass: selectedStudent.class,
      studentNis: selectedStudent.nis,
      parentNameMet,
      address,
      purpose,
      result,
      agreement,
      photoUrl,
      photoName,
      parentSignature,
      counselorSignature,
      counselorName: activeCounselor.name,
      counselorId: activeCounselor.id,
      createdAt: new Date().toISOString()
    };

    setVisits((prev) => [newRecord, ...prev]);
    
    // Add activity log to local store for dashboard
    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;
    
    const savedLogs = localStorage.getItem('bk_logs');
    const existingLogs = savedLogs ? JSON.parse(savedLogs) : [];
    const newLog = {
      id: `log-hv-${Date.now()}`,
      timeLabel,
      type: 'homevisit',
      title: `Home Visit: ${selectedStudent.name}`,
      description: `Kunjungan rumah ke tempat tinggal ${selectedStudent.name} (${selectedStudent.class}) ditemui ${parentNameMet}.`,
      studentName: selectedStudent.name,
      studentClass: selectedStudent.class,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('bk_logs', JSON.stringify([newLog, ...existingLogs]));

    // Close form and reset fields
    setShowAddForm(false);
    resetFormFields();
  };

  const resetFormFields = () => {
    setSelectedStudentId('');
    setSelectedStudent(null);
    setStudentSearch('');
    setParentNameMet('');
    setVisitDate(new Date().toISOString().split('T')[0]);
    setAddress('');
    setPurpose('');
    setResult('');
    setAgreement('');
    setPhotoUrl(undefined);
    setPhotoName(undefined);
    setParentSignature(undefined);
    setCounselorSignature(undefined);
    stopCamera();
  };

  const handleDeleteVisit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Apakah Anda yakin ingin menghapus arsip bukti Home Visit ini?')) {
      setVisits(visits.filter((v) => v.id !== id));
      if (selectedVisit?.id === id) {
        setSelectedVisit(null);
      }
    }
  };

  // Filtered visits for main listing
  const filteredVisits = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return visits;
    return visits.filter(
      (v) =>
        v.studentName.toLowerCase().includes(q) ||
        v.studentNis.includes(q) ||
        v.studentClass.toLowerCase().includes(q) ||
        v.reportNumber.toLowerCase().includes(q) ||
        v.purpose.toLowerCase().includes(q)
    );
  }, [searchQuery, visits]);

  // PDF Generator for Home Visit Record
  const handleDownloadPDF = (record: HomeVisitRecord) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [0, 104, 95]; // #00685f (Teal)
    const darkColor = [11, 28, 48]; // #0b1c30 (Dark Slate)
    const grayColor = [61, 73, 71]; // #3d4947 (Charcoal)
    const lightGrayColor = [240, 244, 244]; // Light background

    // 1. Draw Letterhead
    drawLetterhead(doc, primaryColor);

    // 2. Document Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('LAPORAN BUKTI KUNJUNGAN RUMAH (HOME VISIT)', 105, 45, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`Nomor Dokumen: ${record.reportNumber}`, 105, 51, { align: 'center' });

    // 3. I. IDENTITAS SISWA & WALI
    doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
    doc.rect(15, 58, 180, 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text('I. DATA DIRI SISWA & ORANG TUA/WALI', 20, 63.5);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    
    doc.text('Nama Siswa', 20, 72);
    doc.text(':', 55, 72);
    doc.setFont('Helvetica', 'bold');
    doc.text(record.studentName, 60, 72);

    doc.setFont('Helvetica', 'normal');
    doc.text('NISN', 20, 77);
    doc.text(':', 55, 77);
    doc.text(record.studentNis, 60, 77);

    doc.text('Kelas', 20, 82);
    doc.text(':', 55, 82);
    doc.text(record.studentClass, 60, 82);

    doc.text('Wali yang Ditemui', 20, 87);
    doc.text(':', 55, 87);
    doc.setFont('Helvetica', 'bold');
    doc.text(record.parentNameMet, 60, 87);

    doc.setFont('Helvetica', 'normal');
    doc.text('Alamat Kunjungan', 20, 92);
    doc.text(':', 55, 92);
    const splitAddress = doc.splitTextToSize(record.address, 130);
    doc.text(splitAddress, 60, 92);

    const afterAddressY = 92 + (splitAddress.length * 4.5) + 3;

    // 4. II. DETAIL KUNJUNGAN & TEMUAN
    doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
    doc.rect(15, afterAddressY, 180, 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.text('II. MAKSUD, TEMUAN & SOLUSI KUNJUNGAN RUMAH', 20, afterAddressY + 5);

    let contentY = afterAddressY + 14;
    doc.setFont('Helvetica', 'bold');
    doc.text('Tanggal Kunjungan:', 20, contentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(new Date(record.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), 55, contentY);

    contentY += 6;
    doc.setFont('Helvetica', 'bold');
    doc.text('Tujuan / Masalah:', 20, contentY);
    doc.setFont('Helvetica', 'normal');
    const splitPurpose = doc.splitTextToSize(record.purpose, 170);
    doc.text(splitPurpose, 20, contentY + 5);

    contentY += (splitPurpose.length * 4.5) + 8;
    doc.setFont('Helvetica', 'bold');
    doc.text('Hasil Kunjungan (Temuan):', 20, contentY);
    doc.setFont('Helvetica', 'normal');
    const splitResult = doc.splitTextToSize(record.result, 170);
    doc.text(splitResult, 20, contentY + 5);

    contentY += (splitResult.length * 4.5) + 8;
    doc.setFont('Helvetica', 'bold');
    doc.text('Kesepakatan / Tindak Lanjut:', 20, contentY);
    doc.setFont('Helvetica', 'normal');
    const splitAgreement = doc.splitTextToSize(record.agreement, 170);
    doc.text(splitAgreement, 20, contentY + 5);

    contentY += (splitAgreement.length * 4.5) + 8;

    // Check if there is a photo to add
    let imageAdded = false;
    let photoBlockHeight = 0;
    
    if (record.photoUrl) {
      photoBlockHeight = 55; // Approximate space needed for the photo block
    }

    // Determine signatures placement
    const signaturesHeight = 45;
    const totalSpaceNeeded = photoBlockHeight + signaturesHeight + 10;

    // Check if we need to wrap to a new page
    if (contentY + totalSpaceNeeded > 275) {
      doc.addPage();
      
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.8);
      doc.line(15, 15, 195, 15);

      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 130);
      doc.text(`Bukti Home Visit: ${record.studentName} (${record.reportNumber}) - Halaman 2`, 15, 12);
      
      contentY = 22;
    }

    // 5. DRAW PHOTO ATTACHMENT IF AVAILABLE
    if (record.photoUrl) {
      try {
        // Draw documentation label
        doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
        doc.rect(15, contentY, 180, 7, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.text('III. DOKUMENTASI KEGIATAN (FOTO BUKTI KUNJUNGAN)', 20, contentY + 4.5);
        
        contentY += 10;
        
        // Draw image (scaled to safe fitting bounding box on PDF)
        const format = record.photoUrl.toLowerCase().includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(record.photoUrl, format, 15, contentY, 65, 40);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        doc.text(`Lampiran Berkas: ${record.photoName || 'foto_visit.jpg'}`, 85, contentY + 15);
        doc.text('Keterangan: Foto diambil di lokasi kunjungan sebagai bukti sah fisik', 85, contentY + 20);
        doc.text('pelaksanaan layanan bimbingan konseling Guru BK SMP N 2 Susukan.', 85, contentY + 24);

        contentY += 46;
      } catch (err) {
        console.error('Error rendering image in PDF:', err);
        // Fallback error label
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(180, 50, 50);
        doc.text('([Gagal menyematkan foto ke dalam PDF. Format gambar tidak didukung/korup])', 20, contentY + 5);
        contentY += 10;
      }
    }

    // 6. IV. SIGNATURES
    contentY = Math.max(contentY, 210); // push signatures to clean area
    
    const schoolConfig = getSchoolConfig();
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

    doc.text('Mengetahui,', 20, contentY);
    doc.text('Orang Tua / Wali Murid,', 20, contentY + 5);

    if (record.parentSignature) {
      try {
        doc.addImage(record.parentSignature, 'PNG', 24, contentY + 7, 36, 18);
      } catch (err) {
        console.error('Error rendering parent signature on PDF:', err);
      }
    }

    doc.line(20, contentY + 28, 70, contentY + 28);
    doc.setFont('Helvetica', 'bold');
    doc.text(record.parentNameMet.replace('Bapak / Ibu Wali dari ', ''), 20, contentY + 27);

    doc.setFont('Helvetica', 'normal');
    doc.text('Kabupaten Semarang, ' + new Date(record.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), 125, contentY);
    doc.text('Guru Pembimbing / Konselor BK,', 125, contentY + 5);

    if (record.counselorSignature) {
      try {
        doc.addImage(record.counselorSignature, 'PNG', 128, contentY + 7, 36, 18);
      } catch (err) {
        console.error('Error rendering counselor signature on PDF:', err);
      }
    }

    doc.line(125, contentY + 28, 180, contentY + 28);
    doc.setFont('Helvetica', 'bold');
    doc.text(record.counselorName, 125, contentY + 27);
    doc.setFont('Helvetica', 'normal');
    doc.text('NIP. 19931231 202221 1 002', 125, contentY + 32);

    // Page footer layout
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 130);
    doc.text(`Dicetak otomatis melalui Portal BK ${schoolConfig.schoolName} pada ${new Date().toLocaleDateString('id-ID')} | Sifat: Dokumen Rahasia BK`, 15, 282);

    doc.save(`Laporan_Home_Visit_${record.reportNumber}_${record.studentName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b1c30]">Dokumentasi Home Visit</h2>
          <p className="text-xs text-[#3d4947]/70 font-semibold mt-0.5">
            Manajemen laporan dan pencatatan kunjungan rumah (Home Visit) siswa untuk investigasi preventif bimbingan konseling.
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-97 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Bukti Home Visit</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {showAddForm ? (
        /* Form Bukti Home Visit Card */
        <div className="bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-md p-6 max-w-3xl mx-auto animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#eff4ff] rounded-xl text-[#00685f]">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#0b1c30] text-lg">Formulir Bukti Home Visit</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                  SMP N 2 Susukan • Kabupaten Semarang
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowAddForm(false);
                resetFormFields();
              }}
              className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
              title="Batal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-5">
            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Autocomplete Student Search */}
              <div className="space-y-1.5 md:col-span-2 relative">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Cari &amp; Pilih Siswa Target <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      setSelectedStudentId('');
                      setSelectedStudent(null);
                      setShowStudentDropdown(true);
                    }}
                    onFocus={() => setShowStudentDropdown(true)}
                    placeholder="Masukkan nama, NISN, atau kelas murid..."
                    className="w-full pl-3.5 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                    required
                  />
                  <Search className="w-4.5 h-4.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>

                {showStudentDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowStudentDropdown(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#bcc9c6]/40 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto custom-scrollbar">
                      {studentSuggestions.length > 0 ? (
                        studentSuggestions.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => handleSelectStudent(s)}
                            className="p-3 hover:bg-[#eff4ff]/60 cursor-pointer flex items-center justify-between border-b border-[#bcc9c6]/10 last:border-b-0 relative z-30"
                          >
                            <div>
                              <p className="text-xs font-bold text-[#0b1c30]">{s.name}</p>
                              <p className="text-[10px] text-gray-500 font-semibold">
                                NISN: {s.nis} | Kelas: {s.class}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold text-[#00685f] bg-[#e6fcf5] px-2 py-0.5 rounded">
                              Pilih
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-[#3d4947] opacity-60">
                          {studentSearch.trim() ? 'Siswa tidak ditemukan...' : 'Ketik nama siswa untuk mencari...'}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Selected student detail summary card inside form */}
                {selectedStudent && (
                  <div className="mt-2 p-3 bg-[#e6fcf5] border border-[#00685f]/20 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#00685f]">Siswa Terpilih:</p>
                      <p className="text-xs font-black text-[#0b1c30] mt-0.5">
                        {selectedStudent.name} ({selectedStudent.class})
                      </p>
                      <p className="text-[10px] text-gray-500 font-semibold">
                        NISN: {selectedStudent.nis} | Akumulasi Pelanggaran: {selectedStudent.violationPoints} Poin
                      </p>
                    </div>
                    <span className="bg-[#00685f]/10 text-[#00685f] p-1.5 rounded-lg">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </span>
                  </div>
                )}
              </div>

              {/* Date of Visit */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Tanggal Kunjungan <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Parent Name Met */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Nama Orang Tua / Wali yang Ditemui <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={parentNameMet}
                  onChange={(e) => setParentNameMet(e.target.value)}
                  placeholder="Contoh: Ibu Siti Aminah (Ibu Kandung)"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  required
                />
              </div>

              {/* Visit Address */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Alamat Lengkap Kunjungan Rumah <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Masukkan alamat lengkap rumah yang dikunjungi..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f] resize-none"
                  required
                />
              </div>

              {/* Purpose / Objective */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Maksud &amp; Tujuan Kunjungan <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Contoh: Konfirmasi ketidakhadiran siswa tanpa keterangan (Alpa) selama 4 hari berturut-turut serta mencari solusi..."
                  rows={2.5}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f] resize-none"
                  required
                />
              </div>

              {/* Findings / Results */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Hasil Kunjungan (Temuan Masalah / Kondisi Lapangan) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  placeholder="Contoh: Orang tua terkejut mengetahui siswa membolos, ternyata siswa pergi dari rumah namun tidak sampai ke sekolah karena masalah pergaulan..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f] resize-none"
                  required
                />
              </div>

              {/* Solusi / Agreement reached */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Kesepakatan / Tindak Lanjut Solusi <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={agreement}
                  onChange={(e) => setAgreement(e.target.value)}
                  placeholder="Contoh: Orang tua setuju mengantar langsung siswa sampai pintu gerbang sekolah, siswa bersedia dibina harian oleh Guru BK..."
                  rows={2.5}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f] resize-none"
                  required
                />
              </div>

              {/* ATTACHMENT PHOTO SECTION */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Dokumentasi Foto Bukti (Opsional)
                </label>
                
                {/* Image selection and capture buttons */}
                <div className="flex flex-wrap gap-2 mb-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer text-[11px] font-bold text-gray-700 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-[#00685f]" />
                    <span>Pilih Berkas Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer text-[11px] font-bold text-gray-700 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#00685f]" />
                    <span>Ambil dari Kamera</span>
                  </button>
                </div>

                {/* Direct Camera View Stream */}
                {showCamera && (
                  <div className="p-4 bg-gray-900 rounded-xl border border-gray-700 space-y-3">
                    <div className="flex justify-between items-center text-white text-[11px] font-bold">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                        Kamera Aktif (Live Preview)
                      </span>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="text-gray-400 hover:text-white text-xs font-black uppercase"
                      >
                        Batal
                      </button>
                    </div>

                    {cameraError ? (
                      <div className="p-3 bg-red-950 border border-red-800 text-red-200 rounded-lg text-xs flex gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{cameraError}</span>
                      </div>
                    ) : (
                      <div className="relative aspect-video max-w-md mx-auto bg-black rounded-lg overflow-hidden">
                        <video
                          ref={videoRef}
                          className="w-full h-full object-cover transform -scale-x-100"
                          playsInline
                          muted
                        />
                      </div>
                    )}

                    {!cameraError && (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-md hover:scale-105"
                        >
                          Tangkap Foto (Capture)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Drag and Drop Box Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                    isDragging ? 'border-[#00685f] bg-[#e6fcf5]' : 'border-gray-300 bg-gray-50/50'
                  }`}
                >
                  {photoUrl ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative w-36 h-24 rounded-lg overflow-hidden border border-[#bcc9c6]/40 shadow-sm">
                        <img
                          src={photoUrl}
                          alt="Documentation"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoUrl(undefined);
                            setPhotoName(undefined);
                          }}
                          className="absolute top-1 right-1 p-1 bg-black/60 rounded-full hover:bg-black/80 text-white transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-500 font-bold truncate max-w-[200px]">
                        {photoName || 'visit_photo.jpg'}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-2 text-gray-400">
                      <ImageIcon className="w-8 h-8 mb-1.5 opacity-60" />
                      <p className="text-[11px] font-bold text-gray-500">
                        Seret &amp; letakkan foto di sini untuk melampirkan secara instan
                      </p>
                      <p className="text-[9px] text-gray-400 mt-0.5">
                        Format file: PNG, JPG, JPEG (Max 5MB)
                      </p>
                    </div>
                  )}
                </div>

              </div>

              {/* DIGITAL SIGNATURES SECTION */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-[#0b1c30] uppercase tracking-wide block">
                  Tanda Tangan Elektronik (Touchscreen HP / Mouse)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SignaturePad
                    label="Tanda Tangan Orang Tua / Wali"
                    onChange={setParentSignature}
                  />
                  <SignaturePad
                    label="Tanda Tangan Guru BK / Konselor"
                    onChange={setCounselorSignature}
                  />
                </div>
              </div>

            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  resetFormFields();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-[#3d4947] transition-colors cursor-pointer"
              >
                Batal / Kembali
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Simpan &amp; Terbitkan Laporan
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Main Visits Listing Dashboard View */
        <div className="space-y-6">
          
          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#bcc9c6]/30 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari arsip Home Visit berdasarkan nama siswa, kelas, NISN atau nomor laporan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl text-xs font-semibold text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Records Display Grid */}
          {filteredVisits.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVisits.map((v) => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVisit(v)}
                  className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] bg-teal-50 text-[#00685f] font-extrabold px-2.5 py-1 rounded-lg border border-[#00685f]/10">
                        {v.reportNumber}
                      </span>
                      <span className="text-[9px] text-gray-400 font-bold">
                        {v.date}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-[#0b1c30] text-sm truncate">
                        {v.studentName}
                      </h4>
                      <p className="text-[11px] text-gray-500 font-semibold">
                        Kelas: {v.studentClass} | NISN: {v.studentNis}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2.5 rounded-xl border border-[#bcc9c6]/10 space-y-1">
                      <p className="text-[10px] text-[#3d4947] font-bold uppercase tracking-wider">
                        Masalah/Tujuan:
                      </p>
                      <p className="text-xs text-[#3d4947]/90 font-medium line-clamp-2">
                        {v.purpose}
                      </p>
                    </div>

                    {v.photoUrl && (
                      <div className="flex items-center gap-1.5 text-[#00685f] text-[10px] font-bold">
                        <Camera className="w-3.5 h-3.5" />
                        <span>Ada Lampiran Foto</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#bcc9c6]/10 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-bold">
                      Oleh: {v.counselorName}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPDF(v);
                        }}
                        className="p-1.5 bg-[#eff4ff] text-[#00685f] hover:bg-[#00685f] hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Unduh PDF Laporan Resmi"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteVisit(v.id, e)}
                        className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Hapus Laporan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="bg-white rounded-2xl p-16 text-center border border-[#bcc9c6]/30 shadow-sm max-w-md mx-auto">
              <div className="p-4 bg-teal-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Home className="w-8 h-8 text-[#00685f]" />
              </div>
              <h3 className="font-extrabold text-[#0b1c30] text-base">Arsip Home Visit Kosong</h3>
              <p className="text-xs text-gray-500 font-semibold mt-1">
                {searchQuery.trim() 
                  ? 'Tidak ada arsip Home Visit yang cocok dengan kata pencarian Anda.' 
                  : 'Belum ada arsip pelaksanaan Home Visit yang dilaporkan untuk saat ini.'}
              </p>
              {searchQuery.trim() && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-4 px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Setel Ulang Pencarian
                </button>
              )}
            </div>
          )}

        </div>
      )}

      {/* Detail Laporan Modal overlay */}
      {selectedVisit && (
        <div className="fixed inset-0 bg-[#0b1c30]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl border border-gray-100 relative animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] custom-scrollbar">
            
            <button
              onClick={() => setSelectedVisit(null)}
              className="absolute top-5 right-5 p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
              <div className="p-2 bg-teal-50 rounded-xl text-[#00685f]">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-[#0b1c30] text-base">Bukti Hasil Kunjungan Rumah</h4>
                <p className="text-[10px] text-[#00685f] font-black uppercase tracking-wider mt-0.5">
                  No Dokumen: {selectedVisit.reportNumber}
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-xs">
              
              {/* Student Metadata Card */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 border border-[#bcc9c6]/25 rounded-2xl">
                <div>
                  <span className="block text-[10px] text-gray-400 font-extrabold uppercase tracking-wide">Nama Siswa:</span>
                  <span className="font-extrabold text-[#0b1c30] text-sm block mt-0.5">{selectedVisit.studentName}</span>
                  <span className="text-[10px] text-gray-500 font-semibold block">NISN: {selectedVisit.studentNis} | Kelas {selectedVisit.studentClass}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-extrabold uppercase tracking-wide">Wali yang Ditemui:</span>
                  <span className="font-extrabold text-[#0b1c30] text-sm block mt-0.5">{selectedVisit.parentNameMet}</span>
                  <span className="text-[10px] text-gray-500 font-semibold block">Kabupaten Semarang</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[10px] text-gray-400 font-extrabold uppercase tracking-wide">Alamat Kunjungan:</span>
                  <span className="font-semibold text-gray-700 block mt-0.5 leading-relaxed">{selectedVisit.address}</span>
                </div>
              </div>

              {/* Home Visit Details */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 border-b border-gray-100 pb-3">
                  <div>
                    <span className="text-gray-400 font-extrabold block uppercase text-[9px] tracking-wide">Tanggal Kunjungan:</span>
                    <span className="font-bold text-gray-800 block mt-1">{selectedVisit.date}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-extrabold block uppercase text-[9px] tracking-wide">Petugas Pelaksana BK:</span>
                    <span className="font-bold text-gray-800 block mt-1">{selectedVisit.counselorName}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[#0b1c30] font-black block uppercase text-[9px] tracking-wider">Maksud / Permasalahan:</span>
                  <p className="bg-gray-50/70 p-3 rounded-xl border border-gray-200/50 leading-relaxed text-gray-700 font-medium whitespace-pre-line">
                    {selectedVisit.purpose}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[#0b1c30] font-black block uppercase text-[9px] tracking-wider">Hasil Temuan Masalah:</span>
                  <p className="bg-gray-50/70 p-3 rounded-xl border border-gray-200/50 leading-relaxed text-gray-700 font-medium whitespace-pre-line">
                    {selectedVisit.result}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[#0b1c30] font-black block uppercase text-[9px] tracking-wider">Kesepakatan / Solusi Tindak Lanjut:</span>
                  <p className="bg-gray-50/70 p-3 rounded-xl border border-gray-200/50 leading-relaxed text-gray-700 font-medium whitespace-pre-line">
                    {selectedVisit.agreement}
                  </p>
                </div>

                {/* Photo Documentation attached display */}
                {selectedVisit.photoUrl && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[#0b1c30] font-black block uppercase text-[9px] tracking-wider flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-[#00685f]" />
                      Lampiran Foto Bukti Lapangan:
                    </span>
                    <div className="relative aspect-video max-w-sm rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                      <img
                        src={selectedVisit.photoUrl}
                        alt="Bukti Home Visit"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                )}

                {/* Signatures display */}
                {(selectedVisit.parentSignature || selectedVisit.counselorSignature) && (
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                    {selectedVisit.parentSignature && (
                      <div className="space-y-1">
                        <span className="text-gray-400 font-extrabold block uppercase text-[9px] tracking-wide">
                          TTD Orang Tua / Wali:
                        </span>
                        <div className="border border-gray-200 rounded-xl bg-white p-2 flex justify-center h-20">
                          <img
                            src={selectedVisit.parentSignature}
                            alt="Tanda Tangan Wali"
                            className="h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    )}
                    {selectedVisit.counselorSignature && (
                      <div className="space-y-1">
                        <span className="text-gray-400 font-extrabold block uppercase text-[9px] tracking-wide">
                          TTD Guru BK / Konselor:
                        </span>
                        <div className="border border-gray-200 rounded-xl bg-white p-2 flex justify-center h-20">
                          <img
                            src={selectedVisit.counselorSignature}
                            alt="Tanda Tangan Guru"
                            className="h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action trigger button inside detail */}
              <div className="flex gap-2.5 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setSelectedVisit(null)}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-[#3d4947] hover:bg-gray-50 font-bold text-xs cursor-pointer"
                >
                  Tutup Rincian
                </button>
                <button
                  onClick={() => handleDownloadPDF(selectedVisit)}
                  className="flex-1 py-2 bg-[#00685f] text-white hover:bg-[#005049] rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Rapor Bukti (PDF)</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
