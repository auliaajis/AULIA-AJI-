import React from 'react';
import { motion } from 'motion/react';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = 'h-4 w-full', count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className={`relative overflow-hidden bg-gray-200/80 rounded-xl ${className}`}
        >
          <motion.div
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
            animate={{ translateX: ['-100%', '100%'] }}
            transition={{
              repeat: Infinity,
              duration: 1.2,
              ease: 'linear',
            }}
          />
        </div>
      ))}
    </>
  );
};

export const TableSkeletonRows: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="space-y-3 p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3.5 bg-white border border-gray-100 rounded-2xl gap-4 shadow-2xs"
        >
          <div className="flex items-center gap-3 w-1/3">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-1/5" />
          <Skeleton className="h-3 w-1/6" />
          <Skeleton className="h-8 w-20 rounded-xl shrink-0" />
        </div>
      ))}
    </div>
  );
};

export const CardSkeletonGrid: React.FC<{ cards?: number }> = ({ cards = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="p-4 bg-white border border-gray-100 rounded-2xl space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
          </div>
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-2.5 w-32" />
        </div>
      ))}
    </div>
  );
};

export default Skeleton;
