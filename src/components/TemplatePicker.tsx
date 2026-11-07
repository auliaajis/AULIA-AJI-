import React, { useState } from 'react';
import { Bookmark, Plus, Trash2, Check, Sparkles, X, ChevronDown, BookOpen } from 'lucide-react';
import { LayananTemplateItem } from '../utils/layananTemplates';

interface TemplatePickerProps {
  label: string;
  defaultTemplates: LayananTemplateItem[];
  customTemplates: LayananTemplateItem[];
  currentValue: string;
  onSelect: (text: string) => void;
  onSaveCustom: (name: string, text: string) => void;
  onDeleteCustom: (id: string) => void;
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({
  label,
  defaultTemplates,
  customTemplates,
  currentValue,
  onSelect,
  onSaveCustom,
  onDeleteCustom,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allTemplates = [...customTemplates, ...defaultTemplates];

  const handleSelectTemplate = (item: LayananTemplateItem) => {
    setSelectedId(item.id);
    onSelect(item.text);
    setIsOpen(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim() || !currentValue.trim()) return;
    onSaveCustom(customTitle.trim(), currentValue.trim());
    setCustomTitle('');
    setIsSavingCustom(false);
  };

  return (
    <div className="space-y-1.5 mb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-[#00685f] font-bold">
          <Bookmark className="w-3.5 h-3.5 text-[#00685f]" />
          <span>Template Cepat {label}:</span>
        </div>

        <div className="flex items-center gap-2">
          {currentValue.trim().length > 5 && (
            <button
              type="button"
              onClick={() => setIsSavingCustom(!isSavingCustom)}
              className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#00685f] bg-[#e6f4f1] hover:bg-[#d0ece6] px-2 py-0.5 rounded-lg border border-[#00685f]/20 transition-all cursor-pointer"
              title="Simpan tulisan saat ini sebagai template baru Anda"
            >
              <Plus className="w-3 h-3" />
              <span>Simpan Jadi Template</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-600 hover:text-[#00685f] cursor-pointer"
          >
            <span>{isOpen ? 'Tutup Pilihan' : 'Pilih Template Lengkap'}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Form Simpan Template Kustom */}
      {isSavingCustom && (
        <form onSubmit={handleSave} className="p-2.5 bg-teal-50/70 border border-[#00685f]/30 rounded-xl space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs font-bold text-[#00685f]">
            <span>Simpan Teks Ini sebagai Template Baru</span>
            <button type="button" onClick={() => setIsSavingCustom(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Beri judul template (misal: Malas Belajar, Bolos Sholat, dll)"
              required
              className="flex-1 px-3 py-1.5 bg-white border border-[#00685f]/30 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00685f]"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              Simpan
            </button>
          </div>
        </form>
      )}

      {/* Horizontal Quick Chips (Paling Sering Digunakan) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {allTemplates.slice(0, 5).map((tpl) => {
          const isSelected = selectedId === tpl.id || currentValue === tpl.text;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleSelectTemplate(tpl)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 select-none ${
                isSelected
                  ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                  : 'bg-[#f8faf9] hover:bg-teal-50 text-[#3d4947] hover:text-[#00685f] border-gray-200'
              }`}
              title={tpl.text}
            >
              {tpl.isCustom && <span className="text-[9px] bg-amber-400 text-amber-950 px-1 rounded-sm font-black">Saya</span>}
              <span>{tpl.label}</span>
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </button>
          );
        })}

        {allTemplates.length > 5 && !isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="px-2 py-1 rounded-lg text-[10px] font-extrabold text-[#00685f] bg-[#e6f4f1] hover:bg-teal-100 border border-[#00685f]/20 cursor-pointer whitespace-nowrap"
          >
            +{allTemplates.length - 5} lainnya...
          </button>
        )}
      </div>

      {/* Dropdown Card untuk Seluruh Template */}
      {isOpen && (
        <div className="p-3 bg-white border border-[#bcc9c6]/40 rounded-2xl shadow-md space-y-2.5 animate-in fade-in zoom-in-98 duration-150">
          <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
            <span className="text-xs font-extrabold text-[#0b1c30]">
              Daftar Seluruh Template {label}:
            </span>
            <span className="text-[10px] text-gray-500 font-medium">Klik untuk langsung mengisi</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
            {allTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="group p-2.5 rounded-xl border border-gray-200 hover:border-[#00685f]/40 bg-[#f8faf9] hover:bg-teal-50/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-extrabold text-[#0b1c30] group-hover:text-[#00685f] transition-colors">
                      {tpl.label}
                    </span>
                    {tpl.isCustom ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCustom(tpl.id);
                        }}
                        className="text-gray-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                        title="Hapus template kustom ini"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.2 rounded">
                        {tpl.category}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed">
                    {tpl.text}
                  </p>
                </div>

                <div className="mt-2 pt-1.5 border-t border-gray-200/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    className="text-[10px] font-bold text-[#00685f] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Gunakan Template Ini</span>
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatePicker;
