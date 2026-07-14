import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import DataSiswaView from './components/DataSiswaView';
import CatatPelanggaranForm from './components/CatatPelanggaranForm';
import TambahLayananForm from './components/TambahLayananForm';
import PengaturanView from './components/PengaturanView';
import AbsensiView from './components/AbsensiView';
import GoogleIntegrationView from './components/GoogleIntegrationView';
import { downloadServicePDF } from './utils/pdfGenerator';

import {
  initialStudents,
  initialViolations,
  initialServices,
  initialLogs,
  counselors
} from './data/mockData';
import { Student, ViolationRecord, CounselingService, ActivityLog, Counselor } from './types';
import { HeartHandshake, Calendar, Clock, Plus, UserCheck, Download } from 'lucide-react';
import { filterStudents, filterViolations, filterServices, filterLogs } from './utils/accessControl';

export default function App() {
  // Navigation Routing States
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [preSelectedStudentId, setPreSelectedStudentId] = useState<string | undefined>(undefined);

  // Active user counselor session state
  const [activeCounselor, setActiveCounselor] = useState(counselors[0]);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile navigation drawer toggle
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Core database states synchronized with localStorage
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('bk_students');
    return saved ? JSON.parse(saved) : initialStudents;
  });

  const [violations, setViolations] = useState<ViolationRecord[]>(() => {
    const saved = localStorage.getItem('bk_violations');
    return saved ? JSON.parse(saved) : initialViolations;
  });

  const [services, setServices] = useState<CounselingService[]>(() => {
    const saved = localStorage.getItem('bk_services');
    return saved ? JSON.parse(saved) : initialServices;
  });

  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem('bk_logs');
    return saved ? JSON.parse(saved) : initialLogs;
  });

  // Persists states on edits
  useEffect(() => {
    localStorage.setItem('bk_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('bk_violations', JSON.stringify(violations));
  }, [violations]);

  useEffect(() => {
    localStorage.setItem('bk_services', JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    localStorage.setItem('bk_logs', JSON.stringify(logs));
  }, [logs]);

  // Global search navigation trigger
  const handleNavigateToStudentTab = () => {
    setCurrentView('data-siswa');
  };

  // Safe navigation form trigger with contextual student parameter binding
  const handleNavigateToForm = (form: string, selectStudentId?: string) => {
    setPreSelectedStudentId(selectStudentId);
    setCurrentView(form);
  };

  // State trigger: Add standard student
  const handleAddStudent = (newStudent: Omit<Student, 'id' | 'initials'>) => {
    const nameWords = newStudent.name.trim().split(' ');
    const initials = nameWords.map((w) => w[0]).join('').substring(0, 2).toUpperCase();

    const added: Student = {
      ...newStudent,
      id: `s-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      initials,
    };

    setStudents((prev) => [added, ...prev]);
  };

  // State trigger: Delete student
  const handleDeleteStudent = (id: string) => {
    setStudents(students.filter((s) => s.id !== id));
  };

  // State trigger: Clear all students and start with a clean slate
  const handleClearAllStudents = () => {
    setStudents([]);
    setViolations([]);
    setServices([]);
    setLogs([]);
  };

  // State trigger: Record violation and update scores & activity feeds
  const handleSaveViolation = (newViolation: Omit<ViolationRecord, 'id' | 'ticketId'>) => {
    const randomTicketNum = Math.floor(100 + Math.random() * 900);
    const generatedTicketId = `PLG-${new Date().getFullYear()}-${randomTicketNum}`;

    const added: ViolationRecord = {
      ...newViolation,
      id: `v-${Date.now()}`,
      ticketId: generatedTicketId,
    };

    // Update violations list
    setViolations([added, ...violations]);

    // Update associated student points
    setStudents(
      students.map((student) => {
        if (student.id === newViolation.studentId) {
          return {
            ...student,
            violationPoints: student.violationPoints + newViolation.pointsAdded,
          };
        }
        return student;
      })
    );

    // Create live activity feed log
    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;

    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      timeLabel,
      type: 'violation',
      title: `Pelanggaran: ${newViolation.category}`,
      description: `${newViolation.studentName} (${newViolation.studentClass}) dilaporkan di ${newViolation.location}.`,
      studentName: newViolation.studentName,
      studentClass: newViolation.studentClass,
      timestamp: new Date(),
    };

    setLogs([newLog, ...logs]);

    // Reset pre-selection and route back
    setPreSelectedStudentId(undefined);
    setCurrentView('dashboard');
  };

  // State trigger: Record counseling session, update services count and activity logs
  const handleSaveService = (newService: Omit<CounselingService, 'id'>) => {
    const added: CounselingService = {
      ...newService,
      id: `srv-${Date.now()}`,
    };

    // Update counseling list
    setServices([added, ...services]);

    // Update bkServicesCount for all participants
    const participantIds = newService.students.map((s) => s.id);
    setStudents(
      students.map((student) => {
        if (participantIds.includes(student.id)) {
          return {
            ...student,
            bkServicesCount: student.bkServicesCount + 1,
          };
        }
        return student;
      })
    );

    // Generate recent activity log item
    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;

    const primaryStudentName = newService.students[0]?.name || 'Siswa';
    const primaryStudentClass = newService.students[0]?.class || '';

    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      timeLabel,
      type: newService.serviceType === 'Home Visit' ? 'homevisit' : 'counseling',
      title: newService.serviceType,
      description: `Sesi ${newService.status} dengan ${primaryStudentName} ${
        newService.students.length > 1 ? `dan ${newService.students.length - 1} lainnya` : ''
      }. Masalah: ${newService.problem}.`,
      studentName: primaryStudentName,
      studentClass: primaryStudentClass,
      timestamp: new Date(),
    };

    setLogs([newLog, ...logs]);

    // Reset parameters and navigate back
    setPreSelectedStudentId(undefined);
    setCurrentView('dashboard');
  };

  const handleAddAttendanceActivityLog = (
    title: string,
    description: string,
    studentName: string,
    studentClass: string,
    type: 'attendance'
  ) => {
    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;

    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      timeLabel,
      type,
      title,
      description,
      studentName,
      studentClass,
      timestamp: new Date(),
    };

    setLogs((prev) => [newLog, ...prev]);
  };

  // State trigger: Handle imported Google database sync
  const handleGoogleDataImported = (data: {
    students?: Student[];
    violations?: ViolationRecord[];
    services?: CounselingService[];
    attendance?: any[];
  }) => {
    if (data.students) setStudents(data.students);
    if (data.violations) setViolations(data.violations);
    if (data.services) setServices(data.services);
    if (data.attendance) {
      localStorage.setItem('bk_attendance_history', JSON.stringify(data.attendance));
    }

    // Insert sync event into activity feed
    const today = new Date();
    const formattedHour = `${String(today.getHours()).padStart(2, '0')}:${String(
      today.getMinutes()
    ).padStart(2, '0')}`;
    const timeLabel = `HARI INI, ${formattedHour}`;

    const syncLog: ActivityLog = {
      id: `log-sync-${Date.now()}`,
      timeLabel,
      type: 'attendance',
      title: 'Sinkronisasi Google Sheets',
      description: 'Seluruh database disinkronkan dengan data awan Google Sheets Anda.',
      studentName: 'Sistem',
      studentClass: 'Semua',
      timestamp: new Date(),
    };

    setLogs((prev) => [syncLog, ...prev]);
  };

  // Render individual view layout switch
  const renderMainView = () => {
    const filteredStudents = filterStudents(students, activeCounselor);
    const filteredViolations = filterViolations(violations, activeCounselor);
    const filteredServices = filterServices(services, activeCounselor);
    const filteredLogs = filterLogs(logs, activeCounselor);

    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView
            students={filteredStudents}
            violations={filteredViolations}
            services={filteredServices}
            logs={filteredLogs}
            onNavigateToTab={onNavigateToTab}
            onNavigateToForm={handleNavigateToForm}
          />
        );
      case 'absensi':
        return (
          <AbsensiView
            students={filteredStudents}
            activeCounselor={activeCounselor}
            onAddActivityLog={handleAddAttendanceActivityLog}
          />
        );
      case 'data-siswa':
        return (
          <DataSiswaView
            students={filteredStudents}
            violations={filteredViolations}
            services={filteredServices}
            activeCounselor={activeCounselor}
            onAddStudent={handleAddStudent}
            onDeleteStudent={handleDeleteStudent}
            onClearAllStudents={handleClearAllStudents}
            onNavigateToForm={handleNavigateToForm}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        );
      case 'pelanggaran':
        return (
          <CatatPelanggaranForm
            students={filteredStudents}
            violations={filteredViolations}
            activeCounselor={activeCounselor}
            preSelectedStudentId={preSelectedStudentId}
            onSaveViolation={handleSaveViolation}
            onCancel={() => {
              setPreSelectedStudentId(undefined);
              setCurrentView('dashboard');
            }}
          />
        );
      case 'layanan-bk':
        // Layanan BK List View listing current sessions and allowing scheduling additions
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-extrabold text-[#0b1c30]">Daftar Layanan BK</h2>
                <p className="text-sm text-[#3d4947]/70 font-semibold mt-0.5">
                  Arsip pencatatan sesi bimbingan, konseling kelompok, dan home visit murid.
                </p>
              </div>
              <button
                onClick={() => handleNavigateToForm('tambah-layanan')}
                className="flex items-center gap-2 px-5 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-sm font-bold transition-all shadow-md cursor-pointer active:scale-97"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Rekam Layanan</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map((srv) => {
                let badgeColor = 'bg-[#00685f]/10 text-[#00685f]';
                if (srv.status === 'Selesai') badgeColor = 'bg-[#6b38d4]/10 text-[#6b38d4]';
                else if (srv.status === 'Dibatalkan') badgeColor = 'bg-[#ba1a1a]/10 text-[#ba1a1a]';

                return (
                  <div
                    key={srv.id}
                    className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs bg-[#eff4ff] text-[#00685f] font-extrabold px-2.5 py-1 rounded-lg">
                          {srv.serviceType}
                        </span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${badgeColor}`}>
                          {srv.status}
                        </span>
                      </div>

                      <h4 className="font-bold text-[#0b1c30] text-sm line-clamp-1">
                        {srv.problem}
                      </h4>
                      <p className="text-xs text-[#3d4947]/80 line-clamp-2 mt-1 leading-relaxed">
                        {srv.description}
                      </p>

                      <div className="mt-4 pt-4 border-t border-[#bcc9c6]/10 space-y-1.5">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                          Peserta Murid:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {srv.students.map((st) => (
                            <span
                               key={st.id}
                               className="text-[10px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                            >
                              {st.name} ({st.class})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[#bcc9c6]/10 flex justify-between items-center text-[10px] font-bold text-gray-500">
                      <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#00685f]" />
                          <span>{srv.date}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#00685f]" />
                          <span>
                            {srv.startTime} - {srv.endTime}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => downloadServicePDF(srv)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00685f]/10 text-[#00685f] hover:bg-[#00685f] hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                        title="Unduh Bukti Layanan BK (PDF)"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'tambah-layanan':
        return (
          <TambahLayananForm
            students={filteredStudents}
            preSelectedStudentId={preSelectedStudentId}
            onSaveService={handleSaveService}
            onCancel={() => {
              setPreSelectedStudentId(undefined);
              setCurrentView('dashboard');
            }}
          />
        );
      case 'pengaturan':
        return <PengaturanView />;
      case 'google-sync':
        return <GoogleIntegrationView onDataImported={handleGoogleDataImported} />;
      default:
        return null;
    }
  };

  // Helper function to allow view change from dashboard links
  const onNavigateToTab = (tab: string, query?: string) => {
    if (query) {
      setSearchQuery(query);
    }
    setCurrentView(tab);
  };

  return (
    <div className="min-h-screen bg-[#f8fafa] text-[#0b1c30]">
      {/* Sidebar Controller */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          setIsMobileSidebarOpen(false); // Auto close sidebar on mobile navigation
        }}
        activeCounselor={activeCounselor}
        allCounselors={counselors}
        onChangeCounselor={setActiveCounselor}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Column Wrapper */}
      <div className="lg:pl-64 min-h-screen flex flex-col transition-all duration-300">
        {/* Top Header bar with search input */}
        <Header
          activeCounselor={activeCounselor}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNavigateToStudent={handleNavigateToStudentTab}
          onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        {/* Central Workspace view */}
        <main className="mt-16 p-4 sm:p-6 lg:p-8 flex-1">
          <div className="max-w-7xl mx-auto">{renderMainView()}</div>
        </main>
      </div>
    </div>
  );
}
