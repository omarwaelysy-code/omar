import React from 'react';
import { motion } from 'framer-motion';
import { Logo } from './Logo';

export const LoadingScreen: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-white"
    >
      <div className="relative">
        <motion.div
          animate={{ 
            scale: [1, 1.15, 1],
            opacity: [0.3, 0.7, 0.3]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -inset-4 bg-[#1B853A]/15 blur-2xl rounded-full"
        />
        <Logo size="xl" animateStartup={true} animatePulse={true} className="relative z-10" />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-10 flex flex-col items-center"
      >
        <span className="text-slate-400 font-bold tracking-widest uppercase text-xs">
          Loading Obrain ERP...
        </span>
        <div className="mt-4 w-52 h-1 bg-slate-100 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            className="h-full bg-[#1B853A] shadow-glow"
          />
        </div>
      </motion.div>
    </motion.div>
  );
};
