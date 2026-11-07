import React from 'react';
import { Sparkles, Info } from 'lucide-react';

export interface PageHeaderBannerProps {
  title: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  badge?: string | React.ReactNode;
  actions?: React.ReactNode;
  stats?: {
    label: string;
    value: string | number;
    color?: string;
  }[];
  workflowHint?: string;
}

export const PageHeaderBanner: React.FC<PageHeaderBannerProps> = ({
  title,
  category,
  description,
  icon,
  badge,
  actions,
  stats,
  workflowHint
}) => {
  return (
    <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-2xs overflow-hidden mb-6 transition-all">
      {/* Top Banner Content */}
      <div className="p-4 sm:p-5 lg:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left: Icon, Breadcrumb category, Title & Explicit Purpose Description */}
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/20 flex items-center justify-center shrink-0 shadow-2xs">
            {icon}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-[#00685f]/10 px-2.5 py-0.5 rounded-md border border-[#00685f]/15">
                {category}
              </span>
              {badge && (
                typeof badge === 'string' ? (
                  <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                    {badge}
                  </span>
                ) : (
                  badge
                )
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-[#0b1c30] tracking-tight leading-snug">
              {title}
            </h1>

            <p className="text-xs sm:text-sm text-[#3d4947] font-medium leading-relaxed max-w-3xl">
              {description}
            </p>
          </div>
        </div>

        {/* Right: Primary Action Buttons */}
        {actions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0 self-start lg:self-center pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-100 w-full lg:w-auto">
            {actions}
          </div>
        )}
      </div>

      {/* Optional Stats Bar or Workflow Guidance strip */}
      {(stats || workflowHint) && (
        <div className="bg-[#f8faf9] px-4 sm:px-6 py-2.5 border-t border-[#bcc9c6]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
          {workflowHint ? (
            <div className="flex items-center gap-1.5 text-[#00685f] font-bold text-[11px] min-w-0">
              <Info className="w-3.5 h-3.5 shrink-0 text-[#00685f]" />
              <span className="text-[#3d4947]/70 font-semibold mr-1">Alur Kerja:</span>
              <span className="truncate">{workflowHint}</span>
            </div>
          ) : <div />}

          {stats && stats.length > 0 && (
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap shrink-0 self-end sm:self-auto">
              {stats.map((s, idx) => (
                <div key={idx} className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-gray-500">{s.label}:</span>
                  <span className={`text-xs font-black ${s.color || 'text-[#00685f]'}`}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PageHeaderBanner;
