import React from 'react';
import { motion } from 'framer-motion';
import { User, Settings, TrendingUp, CheckCircle2, ArrowRight } from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      number: 'Step 1',
      title: 'Sign Up',
      description: 'Create your account in just a few minutes.',
      icon: <User className="w-10 h-10 text-[#1B853A]" />
    },
    {
      number: 'Step 2',
      title: 'Setup',
      description: 'Configure your business and modules.',
      icon: <Settings className="w-10 h-10 text-[#1B853A]" />
    },
    {
      number: 'Step 3',
      title: 'Manage',
      description: 'Manage your operations in one integrated system.',
      icon: <TrendingUp className="w-10 h-10 text-[#1B853A]" />
    },
    {
      number: 'Step 4',
      title: 'Grow',
      description: 'Make smarter decisions and grow your business.',
      icon: <CheckCircle2 className="w-10 h-10 text-[#1B853A]" />
    }
  ];

  return (
    <section id="how-it-works" className="w-full bg-white py-20 lg:py-28 font-sans relative overflow-hidden scroll-mt-24">
      {/* Decorative Top-Right Concentric Dotted Arcs */}
      <div className="absolute top-0 right-0 z-0 pointer-events-none opacity-40">
        <svg viewBox="0 0 350 350" className="w-[350px] h-[350px] text-[#2DD4BF]" fill="none">
          <circle cx="350" cy="0" r="100" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="350" cy="0" r="150" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="350" cy="0" r="200" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="350" cy="0" r="250" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="350" cy="0" r="300" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
        </svg>
      </div>

      {/* Decorative Bottom-Left Concentric Dotted Arcs */}
      <div className="absolute bottom-0 left-0 z-0 pointer-events-none opacity-40">
        <svg viewBox="0 0 350 350" className="w-[350px] h-[350px] text-[#2DD4BF]" fill="none">
          <circle cx="0" cy="350" r="100" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="0" cy="350" r="150" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="0" cy="350" r="200" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="0" cy="350" r="250" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="0" cy="350" r="300" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
        </svg>
      </div>

      <div className="w-full max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-12 relative z-10">
        
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-16 lg:mb-20 max-w-2xl"
        >
          <span className="text-[#1B853A] font-bold text-sm lg:text-base uppercase tracking-wider block mb-3.5">
            HOW IT WORKS
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold text-[#0B0F19] tracking-tight leading-[1.14]">
            Simple steps to streamline<br />
            your business
          </h2>
          <p className="mt-5 text-[#4B5563] text-base lg:text-lg leading-relaxed font-normal">
            Getting started with Obrain ERP is easy and fast.
          </p>
        </motion.div>

        {/* 4 Process Steps Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-6 relative">
          
          {steps.map((step, index) => (
            <div key={step.number} className="flex flex-col items-center text-center relative group">
              
              {/* Step Circle & Connector Container */}
              <div className="w-full flex items-center justify-center relative mb-8">
                
                {/* Circular Icon Container */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.45, delay: index * 0.15, ease: "easeOut" }}
                  whileHover={{ scale: 1.06 }}
                  className="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-white border border-slate-200/80 shadow-md shadow-slate-200/50 flex items-center justify-center relative z-10 transition-shadow duration-300 group-hover:shadow-xl cursor-pointer"
                >
                  {step.icon}
                </motion.div>

                {/* Animated Dotted Connection Line (Hidden on last item & small screens) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:flex items-center absolute left-[65%] right-[-35%] top-1/2 -translate-y-1/2 z-0 pointer-events-none px-2">
                    <motion.div 
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.3 + index * 0.15, ease: "easeInOut" }}
                      className="w-full border-t-2 border-dotted border-[#1B853A] origin-left flex-1"
                    />
                    <ArrowRight className="w-4 h-4 text-[#1B853A] shrink-0 -ml-1" strokeWidth={2.5} />
                  </div>
                )}
              </div>

              {/* Step Text Info */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: 0.2 + index * 0.15, ease: "easeOut" }}
                className="flex flex-col items-center"
              >
                <span className="text-[#1B853A] font-bold text-base mb-2">
                  {step.number}
                </span>

                <h3 className="text-2xl font-bold text-[#0B0F19] mb-3 tracking-tight">
                  {step.title}
                </h3>

                <p className="text-[#4B5563] text-base leading-relaxed max-w-[210px] text-center font-normal">
                  {step.description}
                </p>
              </motion.div>

            </div>
          ))}

        </div>

      </div>
    </section>
  );
};
