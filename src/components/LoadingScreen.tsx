import React from 'react';
import { motion } from 'framer-motion';

export const LoadingScreen: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-white font-sans overflow-hidden select-none"
    >
      <div className="flex items-center gap-4">
        {/* SVG Icon Drawing & Filling */}
        <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
          <svg 
            viewBox="0 0 100 100" 
            className="w-full h-full object-contain"
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Step 1 & 2: Path draws itself then fills with green */}
            <motion.path 
              d="M50 10C27.9086 10 10 27.9086 10 50C10 72.0914 27.9086 90 50 90C60.5 90 70 85.8 77 78.8L86 87.8C87.6 89.4 90.3 88.3 90.3 86.1V73C90.3 73 90 50 90 50C90 27.9086 72.0914 10 50 10ZM50 68C40.0589 68 32 59.9411 32 50C32 40.0589 40.0589 32 50 32C59.9411 32 68 40.0589 68 50C68 59.9411 59.9411 68 50 68Z" 
              stroke="#1B853A"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ strokeDasharray: 380, strokeDashoffset: 380, fill: "#1B853A", fillOpacity: 0 }}
              animate={{ 
                strokeDashoffset: 0,
                fillOpacity: [0, 0, 1]
              }}
              transition={{ 
                strokeDashoffset: { duration: 0.6, ease: "easeInOut" },
                fillOpacity: { duration: 0.8, times: [0, 0.65, 1], ease: "easeOut" }
              }}
            />
          </svg>
        </div>

        {/* Step 3: Word Obrain Fades In */}
        <motion.span 
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4, ease: "easeOut" }}
          className="font-semibold text-4xl text-[#0B0F19] tracking-[0.02em] leading-none flex items-center"
          style={{ fontFamily: '"Plus Jakarta Sans", "Manrope", sans-serif' }}
        >
          Obrain
        </motion.span>
      </div>

      {/* Subtle Progress Bar below */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.3 }}
        className="mt-12 w-44 h-1 bg-slate-100 rounded-full overflow-hidden"
      >
        <motion.div 
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.8, ease: "easeInOut" }}
          className="h-full bg-[#1B853A]"
        />
      </motion.div>
    </motion.div>
  );
};
