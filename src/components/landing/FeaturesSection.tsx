import React from 'react';
import { motion } from 'framer-motion';

export const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="w-full bg-white pt-2 lg:pt-6 pb-20 lg:pb-28 font-sans scroll-mt-24">
      <div className="w-full max-w-[1340px] mx-auto px-6 sm:px-10 lg:px-14">
        
        {/* Top Header Row (Left text + Right graph illustration) */}
        <motion.div 
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
        >
          {/* Left Text Header */}
          <div className="lg:col-span-6 xl:col-span-6">
            <span className="text-[#1B853A] font-bold text-base uppercase tracking-wider block mb-4">
              FEATURES
            </span>

            <h2 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold text-[#0B0F19] tracking-tight leading-[1.14]">
              Everything you need<br />
              in one integrated system
            </h2>

            <p className="mt-6 text-[#4B5563] text-lg sm:text-xl max-w-[520px] leading-relaxed font-normal">
              Obrain ERP comes with a wide range of powerful features to support every department in your business.
            </p>
          </div>

          {/* Right Graph Illustration (Full scale matching visual spec) */}
          <div className="lg:col-span-6 xl:col-span-6 flex justify-center lg:justify-end mt-4 lg:mt-0">
            <div className="w-full max-w-[580px] lg:max-w-[620px] flex justify-end">
              <img
                src="/features-graph.png"
                alt="Obrain ERP Features Analytics Illustration"
                className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-xs"
              />
            </div>
          </div>
        </motion.div>

        {/* 3 Feature Cards (Full container width & proportion) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 mt-12 lg:mt-16">
          
          {/* Card 1: Finance Management */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
            className="bg-white border border-slate-200/80 rounded-[32px] p-8 sm:p-10 lg:p-12 shadow-xs hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-3xl bg-[#1B853A] flex items-center justify-center mb-8 shadow-xs">
                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <circle cx="12" cy="15" r="3" fill="#1B853A" stroke="white" strokeWidth="2"></circle>
                  <text x="12" y="17.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">$</text>
                </svg>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0B0F19] mb-4 tracking-tight">
                Finance Management
              </h3>

              <p className="text-[#4B5563] text-base sm:text-lg leading-relaxed font-normal">
                Track expenses, manage budgets, and generate financial reports with ease.
              </p>
            </div>
          </motion.div>

          {/* Card 2: Inventory Management */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: 0.2, ease: "easeOut" }}
            className="bg-white border border-slate-200/80 rounded-[32px] p-8 sm:p-10 lg:p-12 shadow-xs hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-3xl bg-[#1B853A] flex items-center justify-center mb-8 shadow-xs">
                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0B0F19] mb-4 tracking-tight">
                Inventory Management
              </h3>

              <p className="text-[#4B5563] text-base sm:text-lg leading-relaxed font-normal">
                Monitor stock levels and optimize inventory operations in real time.
              </p>
            </div>
          </motion.div>

          {/* Card 3: Sales & CRM */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: 0.3, ease: "easeOut" }}
            className="bg-white border border-slate-200/80 rounded-[32px] p-8 sm:p-10 lg:p-12 shadow-xs hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-3xl bg-[#006CFF] flex items-center justify-center mb-8 shadow-xs">
                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0B0F19] mb-4 tracking-tight">
                Sales & CRM
              </h3>

              <p className="text-[#4B5563] text-base sm:text-lg leading-relaxed font-normal">
                Strengthen customer relationships and boost sales performance.
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
