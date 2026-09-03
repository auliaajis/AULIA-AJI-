import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Student } from '../types';
import { Search, Check, ChevronDown, User, AlertTriangle, ShieldAlert, Award, X } from 'lucide-react';

interface StudentComboboxProps {
  students: Student[];
  selectedStudentId?: string;
  onSelectStudent: (student: Student | null) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export const StudentCombobox: React.FC<StudentComboboxProps> = ({
  students,
  selectedStudentId,
  onSelectStudent,
  placeholder = 'Cari berdasarkan Nama, NIS, NISN, atau Kelas...',
  label,
  required = false,
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Selected student object
  const selectedStudent = useMemo(() => {
    if (!Array.isArray(students)) return null;
    return students.find((s) => s?.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter students based on query
  const filteredStudents = useMemo(() => {
    if (!Array.isArray(students)) return [];
    if (!searchQuery.trim()) return students.slice(0, 50); // limit to 50 items for speed
    const query = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      if (!s) return false;
      const matchName = String(s.name || '').toLowerCase().includes(query);
      const matchNis = String(s.nis || '').toLowerCase().includes(query);
      const matchNisn = String(s.nisn || '').toLowerCase().includes(query);
      const matchClass = String(s.class || '').toLowerCase().includes(query);
      return matchName || matchNis || matchNisn || matchClass;
    }).slice(0, 50);
  }, [students, searchQuery]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-[#0b1c30] mb-1.5 flex items-center justify-between">
          <span>
            {label} {required && <span className="text-red-500">*</span>}
          </span>
          {selectedStudent && (
            <span className="text-[10px] font-extrabold text-[#00685f]">
              ID: {selectedStudent.nis || selectedStudent.id}
            </span>
          )}
        </label>
      )}

      {selectedStudent ? (
        // Selected View Card
        <div className="flex items-center justify-between p-2.5 bg-teal-50/70 border border-[#00685f]/30 rounded-xl shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#00685f] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow-2xs">
              {selectedStudent.avatarUrl ? (
                <img
                  src={selectedStudent.avatarUrl}
                  alt={selectedStudent.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{selectedStudent.initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-[#0b1c30] text-xs truncate">
                  {selectedStudent.name}
                </span>
                <span className="px-2 py-0.5 bg-[#00685f] text-white text-[10px] font-bold rounded-md shrink-0">
                  {selectedStudent.class}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-600 mt-0.5">
                <span>NIS: {selectedStudent.nis || '-'}</span>
                <span>•</span>
                <span>Bobot Pembinaan: <strong className={selectedStudent.violationPoints >= 50 ? 'text-red-600 font-black' : selectedStudent.violationPoints >= 20 ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>{selectedStudent.violationPoints || 0}</strong></span>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onSelectStudent(null);
              setSearchQuery('');
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="p-1.5 hover:bg-teal-100 rounded-lg text-teal-800 transition-colors cursor-pointer shrink-0 ml-2"
            title="Ganti / Pilih Siswa Lain"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        // Combobox Input
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              disabled={disabled}
              value={searchQuery}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              placeholder={placeholder}
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-[#bcc9c6]/60 rounded-xl text-xs font-bold text-[#0b1c30] placeholder:text-gray-400 focus:outline-none focus:border-[#00685f] focus:ring-2 focus:ring-[#00685f]/15 shadow-2xs transition-all"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ✕
              </button>
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 pointer-events-none" />
            )}
          </div>

          {/* Dropdown Options List */}
          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-2xl shadow-xl divide-y divide-gray-100 custom-scrollbar animate-in fade-in duration-150">
              <div className="px-3 py-2 bg-gray-50/80 text-[10px] font-black uppercase tracking-wider text-gray-400 flex justify-between items-center sticky top-0 backdrop-blur-xs z-10 border-b border-gray-100">
                <span>Daftar Siswa Terfilter ({filteredStudents.length})</span>
                <span>Ketik untuk memfilter</span>
              </div>

              {filteredStudents.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 font-medium">
                  Siswa tidak ditemukan untuk kata kunci "{searchQuery}"
                </div>
              ) : (
                filteredStudents.map((st) => {
                  const points = st.violationPoints || 0;
                  const isHighRisk = points >= 50;
                  const isWarning = points >= 20 && points < 50;

                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        onSelectStudent(st);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left p-2.5 transition-all flex items-center justify-between cursor-pointer group ${
                        isHighRisk
                          ? 'hover:bg-red-50 bg-red-50/30'
                          : isWarning
                          ? 'hover:bg-amber-50 bg-amber-50/20'
                          : 'hover:bg-teal-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isHighRisk
                              ? 'bg-red-600 text-white'
                              : isWarning
                              ? 'bg-amber-500 text-white'
                              : 'bg-teal-100 text-[#00685f]'
                          }`}
                        >
                          {st.avatarUrl ? (
                            <img
                              src={st.avatarUrl}
                              alt={st.name}
                              className="w-full h-full object-cover rounded-full"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span>{st.initials}</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-xs text-[#0b1c30] group-hover:text-[#00685f] truncate">
                              {st.name}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-gray-100 text-gray-700">
                              {st.class}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-2">
                            <span>NIS: {st.nis || '-'}</span>
                            {st.nisn && <span>NISN: {st.nisn}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {isHighRisk ? (
                          <span className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-md flex items-center gap-1 shadow-2xs">
                            <ShieldAlert className="w-3 h-3" />
                            <span>{points} Bobot (Kritis)</span>
                          </span>
                        ) : isWarning ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-extrabold rounded-md flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>{points} Bobot (Warning)</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold rounded-md">
                            {points} Bobot
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentCombobox;
