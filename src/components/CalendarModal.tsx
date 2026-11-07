import React, { useState } from 'react';
import { CounselingService, ViolationRecord, Student } from '../types';
import { addToGoogleCalendar, exportSingleServiceToIcs, exportServicesToIcs } from '../utils/calendarSync';
import {
  X,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  HeartHandshake,
  Home,
  AlertTriangle,
  Plus,
  Edit2,
  CheckCircle2,
  UserCheck,
  Sparkles,
  Download,
  Share2
} from 'lucide-react';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: CounselingService[];
  violations?: ViolationRecord[];
  homeVisits?: any[];
  onEditService?: (service: CounselingService) => void;
  onAddServiceOnDate?: (dateStr: string) => void;
  onNavigateToTab?: (tab: string, query?: string) => void;
}

export default function CalendarModal({
  isOpen,
  onClose,
  services = [],
  violations = [],
  homeVisits = [],
  onEditService,
  onAddServiceOnDate,
  onNavigateToTab,
}: CalendarModalProps) {
  if (!isOpen) return null;

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [showExportMenu, setShowExportMenu] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Month Names in Indonesian
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Days in month calculation
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
  // Convert to Monday start: 0 = Mon, 6 = Sun
  const startOffset = (firstDayOfWeek + 6) % 7;

  // Prev / Next month handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateStr(now.toISOString().split('T')[0]);
  };

  // Helper to format YYYY-MM-DD
  const formatDateString = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  // Build grid dates
  const calendarCells = [];
  // Empty offset cells
  for (let i = 0; i < startOffset; i++) {
    calendarCells.push(null);
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(formatDateString(year, month, d));
  }

  // Get events on selected date
  const servicesOnSelectedDate = services.filter((s) => s.date === selectedDateStr);
  const homeVisitsOnSelectedDate = homeVisits.filter((h) => h.date === selectedDateStr);
  const violationsOnSelectedDate = violations.filter((v) => v.date === selectedDateStr);

  // Helper to check if a date has events
  const getEventCountsOnDate = (dateStr: string) => {
    const sCount = services.filter((s) => s.date === dateStr).length;
    const hCount = homeVisits.filter((h) => h.date === dateStr).length;
    const vCount = violations.filter((v) => v.date === dateStr).length;
    return { sCount, hCount, vCount, total: sCount + hCount + vCount };
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden border border-[#bcc9c6]/30 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#bcc9c6]/20 bg-[#f8fafa] flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00685f]/10 text-[#00685f] rounded-2xl">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-[#0b1c30] text-lg leading-tight flex items-center gap-2">
                <span>Kalender & Agenda BK</span>
                <span className="text-[10px] bg-[#00685f]/10 text-[#00685f] px-2 py-0.5 rounded-full font-bold">
                  Interaktif
                </span>
              </h3>
              <p className="text-xs text-[#3d4947]/70 font-semibold mt-0.5">
                Jadwal konseling, kunjungan rumah (home visit), dan agenda pembinaan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export .ics Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00685f]/10 hover:bg-[#00685f] text-[#00685f] hover:text-white rounded-xl text-xs font-bold transition-all border border-[#00685f]/30 cursor-pointer shadow-2xs"
                title="Ekspor jadwal layanan BK ke file kalender .ics (Google Calendar, Outlook, Apple Calendar)"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ekspor .ics</span>
                <span className="sm:hidden">.ics</span>
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 p-2 space-y-1 text-left animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2.5 py-1 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                    Format File Kalender (.ics)
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
                      const monthServices = services.filter((s) => s.date && s.date.startsWith(monthKey));
                      exportServicesToIcs(
                        monthServices.length > 0 ? monthServices : services,
                        `Jadwal-BK-${monthNames[month]}-${year}.ics`,
                        `Jadwal Layanan BK ${monthNames[month]} ${year}`
                      );
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-[#0b1c30] hover:bg-[#00685f]/10 hover:text-[#00685f] rounded-xl transition cursor-pointer"
                  >
                    <span>Jadwal Bulan {monthNames[month]}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                      {services.filter((s) => s.date && s.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length} sesi
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      exportServicesToIcs(
                        services,
                        `Semua-Jadwal-Layanan-BK-${year}.ics`,
                        'Semua Jadwal Layanan BK - SMPN 2 Susukan'
                      );
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-[#0b1c30] hover:bg-[#00685f]/10 hover:text-[#00685f] rounded-xl transition cursor-pointer border-t border-gray-100"
                  >
                    <span>Semua Jadwal Layanan BK</span>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                      {services.length} sesi
                    </span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200/60 rounded-full transition-colors cursor-pointer text-gray-500"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split 2 columns on medium screens */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto flex-1">
          {/* LEFT COLUMN: Calendar Grid (7 cols) */}
          <div className="md:col-span-7 space-y-4">
            {/* Month & Year Navigation Bar */}
            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-2xl border border-gray-200/80">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-white rounded-xl transition-colors cursor-pointer text-gray-600 shadow-xs"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="text-center">
                <span className="font-extrabold text-[#0b1c30] text-base">
                  {monthNames[month]} {year}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleToday}
                  className="px-2.5 py-1 bg-[#00685f]/10 hover:bg-[#00685f] text-[#00685f] hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Hari Ini
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-white rounded-xl transition-colors cursor-pointer text-gray-600 shadow-xs"
                  title="Bulan Berikutnya"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Calendar Grid Table */}
            <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden p-2">
              {/* Day Name Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 pb-1.5">
                <span>Sen</span>
                <span>Sel</span>
                <span>Rab</span>
                <span>Kam</span>
                <span>Jum</span>
                <span>Sab</span>
                <span className="text-red-400">Min</span>
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {calendarCells.map((dateStr, idx) => {
                  if (!dateStr) {
                    return <div key={`empty-${idx}`} className="h-10 sm:h-12" />;
                  }

                  const dayNum = parseInt(dateStr.split('-')[2], 10);
                  const isSelected = dateStr === selectedDateStr;
                  const isToday = dateStr === todayStr;
                  const { sCount, hCount, vCount } = getEventCountsOnDate(dateStr);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDateStr(dateStr)}
                      className={`h-11 sm:h-13 p-1 rounded-xl flex flex-col items-center justify-between transition-all cursor-pointer relative border ${
                        isSelected
                          ? 'bg-[#00685f] text-white border-[#005049] shadow-md scale-102 font-extrabold z-10'
                          : isToday
                          ? 'bg-amber-50 text-amber-900 border-amber-300 font-extrabold'
                          : 'bg-gray-50/60 hover:bg-gray-100 text-gray-700 border-transparent font-bold'
                      }`}
                    >
                      <span className="text-xs">{dayNum}</span>

                      {/* Event Dot Indicators */}
                      <div className="flex gap-0.5 justify-center items-center mb-0.5">
                        {sCount > 0 && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-white' : 'bg-[#00685f]'
                            }`}
                            title={`${sCount} Layanan BK`}
                          />
                        )}
                        {hCount > 0 && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-amber-200' : 'bg-amber-500'
                            }`}
                            title={`${hCount} Home Visit`}
                          />
                        )}
                        {vCount > 0 && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-red-200' : 'bg-red-500'
                            }`}
                            title={`${vCount} Kasus Pembinaan`}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend Bar */}
            <div className="flex flex-wrap items-center justify-between text-[10px] font-bold text-gray-500 px-1 pt-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#00685f]"></span> Layanan BK
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Home Visit
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span> Pembinaan
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Agenda List for Selected Date (5 cols) */}
          <div className="md:col-span-5 bg-gray-50 border border-gray-200/80 rounded-2xl p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              {/* Selected Date Title */}
              <div className="flex justify-between items-center border-b border-gray-200 pb-2.5">
                <div>
                  <h4 className="font-extrabold text-[#0b1c30] text-sm">
                    Agenda: {selectedDateStr}
                  </h4>
                  <p className="text-[10px] text-gray-500 font-semibold">
                    {selectedDateStr === todayStr ? 'Hari Ini' : 'Detail Kegiatan'}
                  </p>
                </div>
                {onAddServiceOnDate && (
                  <button
                    onClick={() => {
                      onAddServiceOnDate(selectedDateStr);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-[10px] font-extrabold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Layanan</span>
                  </button>
                )}
              </div>

              {/* Agenda List */}
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {servicesOnSelectedDate.length === 0 &&
                homeVisitsOnSelectedDate.length === 0 &&
                violationsOnSelectedDate.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <CalendarIcon className="w-8 h-8 text-gray-300 mx-auto" />
                    <p className="text-xs text-gray-500 font-bold">
                      Tidak ada agenda terdaftar pada tanggal ini.
                    </p>
                    {onAddServiceOnDate && (
                      <button
                        onClick={() => {
                          onAddServiceOnDate(selectedDateStr);
                          onClose();
                        }}
                        className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-[#00685f]/10 text-[#00685f] hover:bg-[#00685f] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Jadwalkan Konseling Tanggal Ini</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Services Agenda */}
                    {servicesOnSelectedDate.map((srv) => (
                      <div
                        key={srv.id}
                        className="bg-white p-3 rounded-2xl border border-gray-200/80 shadow-2xs space-y-2"
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] bg-[#00685f]/10 text-[#00685f] font-extrabold px-2 py-0.5 rounded-lg">
                            {srv.serviceType}
                          </span>
                          <span
                            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                              srv.status === 'Selesai'
                                ? 'bg-purple-100 text-purple-700'
                                : srv.status === 'Dibatalkan'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {srv.status}
                          </span>
                        </div>

                        <div>
                          <h5 className="font-extrabold text-[#0b1c30] text-xs line-clamp-1">
                            {srv.problem}
                          </h5>
                          <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-[#00685f]" />
                            <span>
                              {srv.startTime} - {srv.endTime} WIB
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-gray-100 gap-2">
                          <div className="text-[10px] text-gray-600 font-semibold line-clamp-1 max-w-[150px]">
                            👥 {srv.students.map((st) => st.name).join(', ')}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => addToGoogleCalendar(srv)}
                              className="text-[10px] font-extrabold px-2 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                              title="Buka langsung di Google Calendar Web"
                            >
                              <CalendarIcon className="w-3 h-3 text-teal-600" />
                              <span>+ Kalender</span>
                            </button>

                            <button
                              onClick={() => exportSingleServiceToIcs(srv)}
                              className="text-[10px] font-extrabold px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                              title="Unduh berkas .ics sesi ini untuk diimpor ke Google Calendar atau Kalender HP"
                            >
                              <Download className="w-3 h-3 text-emerald-600" />
                              <span>.ics</span>
                            </button>

                            {onEditService && (
                              <button
                                onClick={() => {
                                  onEditService(srv);
                                  onClose();
                                }}
                                className="text-[10px] font-extrabold text-[#00685f] hover:underline flex items-center gap-1 cursor-pointer ml-1"
                              >
                                <Edit2 className="w-3 h-3" /> Edit
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Home Visits Agenda */}
                    {homeVisitsOnSelectedDate.map((hv: any) => (
                      <div
                        key={hv.id}
                        className="bg-white p-3 rounded-2xl border border-amber-200 shadow-2xs space-y-1.5"
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <Home className="w-2.5 h-2.5" /> Home Visit
                          </span>
                        </div>
                        <h5 className="font-extrabold text-[#0b1c30] text-xs">
                          {hv.studentName} ({hv.studentClass})
                        </h5>
                        <p className="text-[10px] text-gray-600">
                          Tujuan: {hv.purpose || 'Kunjungan Rumah'}
                        </p>
                      </div>
                    ))}

                    {/* Violations Agenda */}
                    {violationsOnSelectedDate.map((v) => (
                      <div
                        key={v.id}
                        className="bg-white p-3 rounded-2xl border border-red-200 shadow-2xs space-y-1.5"
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] bg-red-100 text-red-800 font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Laporan Pelanggaran
                          </span>
                          <span className="text-[9px] font-extrabold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            +{v.pointsAdded} Poin
                          </span>
                        </div>
                        <h5 className="font-extrabold text-[#0b1c30] text-xs">
                          {v.studentName} ({v.studentClass}) - {v.category}
                        </h5>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Calendar Footer Tip */}
            <div className="pt-2 border-t border-gray-200/80 text-[10px] text-gray-500 flex items-center gap-1.5 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#00685f] shrink-0" />
              <span>Klik tanggal mana saja di kalender untuk melihat seluruh agenda BK.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
