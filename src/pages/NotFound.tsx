import React from 'react';
import { motion } from 'framer-motion';
import { Logo } from '../components/Logo';
import { Home, ArrowLeft } from 'lucide-react';

interface NotFoundProps {
  onGoHome?: () => void;
}

export const NotFound: React.FC<NotFoundProps> = ({ onGoHome }) => {
  const handleHomeClick = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white border border-slate-200 shadow-xl rounded-3xl p-10 max-w-lg w-full flex flex-col items-center"
      >
        <Logo size="xl" animateStartup={true} animatePulse={true} className="mb-6" />
        
        <div className="inline-block bg-[#1B853A]/10 text-[#1B853A] font-extrabold text-sm px-4 py-1.5 rounded-full mb-4">
          Error 404
        </div>
        
        <h1 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
          Page Not Found
        </h1>
        
        <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-md">
          The page you are looking for doesn't exist or has been moved. Return back to safety on the main system.
        </p>

        <button
          onClick={handleHomeClick}
          className="bg-[#1B853A] hover:bg-[#167431] text-white px-7 py-3 rounded-xl font-semibold text-base flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Home size={18} />
          <span>Return Home</span>
        </button>
      </motion.div>
    </div>
  );
};
