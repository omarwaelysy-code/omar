import React from 'react';
import { User, ArrowRight } from 'lucide-react';
import { DottedGrid } from './DottedGrid';
import { motion } from 'framer-motion';

interface HeroSectionProps {
  onLogin: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onLogin }) => {
  return (
    <section id="home" className="w-full bg-white font-sans scroll-mt-24 pt-8 lg:pt-12 pb-16 lg:pb-24 border-b border-slate-100/60 overflow-hidden">
      <div className="w-full max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-12 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center relative">
          
          {/* Left Column - Content */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="lg:col-span-6 xl:col-span-6 relative z-10 pr-0 lg:pr-2"
          >
            {/* Top-Left Green Dotted Pattern */}
            <div className="mb-8 pl-1">
              <DottedGrid cols={4} rows={3} color="#2DD4BF" />
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold text-[#0B0F19] tracking-tight leading-[1.14]">
              Smart Management<br />
              Better Performance<br />
              Stronger <span className="text-[#1B853A]">Business</span>
            </h1>

            {/* Subtitle / Description */}
            <p className="mt-8 text-[#4B5563] text-base sm:text-lg max-w-[500px] leading-relaxed font-normal">
              Obrain ERP helps you manage your entire business in one integrated system. Simplify operations, improve productivity, and drive growth.
            </p>

            {/* Action Buttons */}
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={onLogin}
                className="bg-[#1B853A] hover:bg-[#167431] active:scale-[0.98] text-white px-8 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-3.5 transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer group"
              >
                <span>Log In</span>
                <div className="w-6 h-6 rounded-full border-[1.5px] border-white/90 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-white stroke-[2.2]" />
                </div>
              </button>

              <button
                type="button"
                onClick={onLogin}
                className="bg-[#0D36A8] hover:bg-[#0B2E90] active:scale-[0.98] text-white px-8 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-3.5 transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer group"
              >
                <span>Request Demo</span>
                <ArrowRight className="w-4 h-4 text-white stroke-[2.2] transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </div>
          </motion.div>

          {/* Decorative Center Dotted Grid */}
          <div className="hidden lg:block absolute left-[47%] top-[8%] -translate-x-1/2 z-0">
            <DottedGrid cols={3} rows={6} color="#2DD4BF" />
          </div>

          {/* Right Column - Hero Visual Graphic (Self-contained, non-overlapping) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="lg:col-span-6 xl:col-span-6 relative flex justify-center lg:justify-end z-10"
          >
            <div className="relative w-full max-w-[580px] lg:max-w-[620px] flex justify-end">
              <img
                src="/hero-image.png"
                alt="Obrain ERP Platform Illustration"
                className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-xl"
              />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
