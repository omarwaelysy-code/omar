import React from 'react';
import { User, ArrowRight } from 'lucide-react';
import { LandingHeader } from '../components/landing/LandingHeader';
import { DottedGrid } from '../components/landing/DottedGrid';
import { motion } from 'framer-motion';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased overflow-x-hidden" dir="ltr">
      {/* Navbar Header */}
      <LandingHeader onGetStarted={onGetStarted} />

      {/* Main Hero Container */}
      <main className="w-full max-w-[1340px] mx-auto px-6 sm:px-10 lg:px-14 pt-4 lg:pt-8 pb-16 min-h-[calc(100vh-100px)] flex flex-col justify-center relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-4 items-center relative">
          
          {/* Left Column - Content */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-6 xl:col-span-6 relative z-10 pr-0 lg:pr-2"
          >
            {/* Top-Left Green Dotted Pattern (4 cols x 3 rows) */}
            <div className="mb-10 pl-1">
              <DottedGrid cols={4} rows={3} color="#2DD4BF" />
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold text-[#0B0F19] tracking-tight leading-[1.14]">
              Smart Management<br />
              Better Performance<br />
              Stronger <span className="text-[#1B853A]">Business</span>
            </h1>

            {/* Subtitle / Description */}
            <p className="mt-8 text-[#4B5563] text-base sm:text-lg max-w-[490px] leading-relaxed font-normal">
              Obrain ERP helps you manage your entire business in one integrated system. Simplify operations, improve productivity, and drive growth.
            </p>

            {/* Action Buttons */}
            <div className="mt-10 flex flex-wrap items-center gap-5">
              {/* Log In Button */}
              <button
                type="button"
                onClick={onLogin}
                className="bg-[#1B853A] hover:bg-[#167431] active:scale-[0.98] text-white px-8 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-3.5 transition-all duration-200 shadow-md cursor-pointer group"
              >
                <span>Log In</span>
                <div className="w-6 h-6 rounded-full border-[1.5px] border-white/90 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-white stroke-[2.2]" />
                </div>
              </button>

              {/* Request Demo Button */}
              <button
                type="button"
                onClick={onLogin}
                className="bg-[#0D36A8] hover:bg-[#0B2E90] active:scale-[0.98] text-white px-8 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-3.5 transition-all duration-200 shadow-md cursor-pointer group"
              >
                <span>Request Demo</span>
                <ArrowRight className="w-4 h-4 text-white stroke-[2.2] transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </div>
          </motion.div>

          {/* Decorative Center Dotted Grid (3 cols x 6 rows) */}
          <div className="hidden lg:block absolute left-[47%] top-[10%] -translate-x-1/2 z-0">
            <DottedGrid cols={3} rows={6} color="#2DD4BF" />
          </div>

          {/* Right Column - Hero Visual Graphic */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-6 xl:col-span-6 relative flex justify-center lg:justify-end z-10"
          >
            <div className="relative w-full max-w-[550px] flex justify-end">
              <img
                src="/hero-image.png"
                alt="Obrain ERP Platform Illustration"
                className="w-full h-auto object-contain select-none pointer-events-none max-h-[620px]"
                onError={(e) => {
                  // In case hero-image.png fails to load, fallback gracefully
                  console.error('Hero image load error');
                }}
              />
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
};
