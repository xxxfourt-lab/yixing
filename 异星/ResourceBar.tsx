import React from 'react';
import { motion } from 'motion/react';

export const ResourceBar = ({ 
  icon: Icon, 
  label, 
  value, 
  color, 
  max = 100 
}: { 
  icon: any, 
  label: string, 
  value: number, 
  color: string, 
  max?: number 
}) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
      <div className="flex items-center gap-1.5 opacity-60">
        <Icon size={12} />
        <span>{label}</span>
      </div>
      <span className="font-mono">{Math.round(value)}/{max}</span>
    </div>
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${(Math.max(0, Math.min(max, value)) / max) * 100}%` }}
        className={`h-full ${color} transition-all duration-500 shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
      />
    </div>
  </div>
);
