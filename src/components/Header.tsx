import { useState } from 'react';
import { Search, Bell, Calendar as CalendarIcon, Check, Menu } from 'lucide-react';
import { Counselor } from '../types';

interface HeaderProps {
  activeCounselor: Counselor;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNavigateToStudent: () => void;
  onToggleSidebar?: () => void;
}

export default function Header({
  activeCounselor,
  searchQuery,
  onSearchChange,
  onNavigateToStudent,
  onToggleSidebar,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);

  const notifications = [
    {
      id: 'n1',
      title: 'Pelanggaran Baru Dilaporkan',
      body: 'Bagas Saputra (8A) dilaporkan membolos jam pelajaran ke-3.',
      time: 'Hari Ini, 08:30',
      unread: true,
    },
    {
      id: 'n2',
      title: 'Konseling Selesai',
      body: 'Rangga Wijaya (9B) menyelesaikan konseling motivasi belajar.',
      time: 'Hari Ini, 09:45',
      unread: true,
    },
    {
      id: 'n3',
      title: 'Jadwal Home Visit Besok',
      body: 'Kunjungan ke rumah wali murid Lina Marlina (7A).',
      time: 'Kemarin',
      unread: false,
    },
  ];

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    if (unreadCount > 0) {
      setUnreadCount(0);
    }
  };

  return (
    <header className="fixed top-0 right-0 w-full lg:w-[calc(100%-16rem)] z-40 bg-white/90 backdrop-blur-md border-b border-[#bcc9c6]/30 h-16 px-4 sm:px-6 flex justify-between items-center transition-all duration-300">
      <div className="flex items-center flex-1 mr-4 min-w-0">
        {/* Toggle Sidebar Button on Mobile */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-[#3d4947] hover:bg-gray-100 rounded-xl transition-colors mr-2 cursor-pointer flex-shrink-0"
          title="Buka Menu"
        >
          <Menu className="w-5.5 h-5.5" />
        </button>

        {/* Global Student Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onNavigateToStudent();
          }}
          className="flex items-center bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-full px-4 py-1.5 w-full max-w-[150px] sm:max-w-xs md:max-w-md transition-all focus-within:border-[#00685f] focus-within:ring-2 focus-within:ring-[#00685f]/10 shadow-sm"
        >
          <Search className="text-[#3d4947] opacity-60 w-5 h-5 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari NISN..."
            className="bg-transparent border-none focus:outline-none focus:ring-0 text-xs sm:text-sm w-full placeholder:text-[#3d4947]/40 ml-1.5 text-[#0b1c30]"
          />
          {searchQuery && (
            <button
              type="submit"
              className="text-xs font-semibold text-[#00685f] hover:underline"
            >
              Filter
            </button>
          )}
        </form>
      </div>

      {/* Action Items */}
      <div className="flex items-center gap-4">
        {/* Notifications Icon with Popup */}
        <div className="relative">
          <button
            onClick={handleNotificationClick}
            className="relative p-2 text-[#3d4947] hover:bg-[#eff4ff] rounded-full transition-colors cursor-pointer active:scale-95"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#ba1a1a] rounded-full animate-pulse"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-[#bcc9c6]/40 rounded-xl shadow-xl z-50 p-2 text-left">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#bcc9c6]/20 mb-1.5">
                <span className="text-xs font-bold text-[#0b1c30]">Notifikasi BK</span>
                <span className="text-[10px] font-semibold text-[#00685f] bg-[#f4fffc] px-1.5 py-0.5 rounded">
                  Terbaru
                </span>
              </div>
              <div className="space-y-1">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-lg text-xs transition-colors hover:bg-[#eff4ff]/60 ${
                      n.unread ? 'bg-[#f4fffc] border-l-2 border-[#00685f]' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-[#0b1c30]">{n.title}</span>
                      {n.unread && <span className="w-1.5 h-1.5 bg-[#00685f] rounded-full mt-1"></span>}
                    </div>
                    <p className="text-gray-600 mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-[10px] text-[#3d4947] opacity-65 mt-1 font-semibold">
                      {n.time}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Calendar Today Button */}
        <button
          onClick={() => {
            const today = new Date();
            const formattedDate = today.toLocaleDateString('id-ID', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
            alert(`Hari Ini: ${formattedDate}`);
          }}
          className="p-2 text-[#3d4947] hover:bg-[#eff4ff] rounded-full transition-colors cursor-pointer active:scale-95"
        >
          <CalendarIcon className="w-5 h-5" />
        </button>

        <div className="h-8 w-[1px] bg-[#bcc9c6]/30 mx-1"></div>

        {/* User Card */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="font-semibold text-xs text-[#0b1c30] leading-tight">
              {activeCounselor.name}
            </p>
            <p className="text-[9px] uppercase tracking-wider text-[#3d4947]/70 font-bold">
              {activeCounselor.role}
            </p>
          </div>
          <img
            src={activeCounselor.avatar}
            alt={activeCounselor.name}
            className="w-10 h-10 rounded-full border-2 border-[#89f5e7] object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </header>
  );
}
