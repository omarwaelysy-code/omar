import React from 'react';
import { motion } from 'framer-motion';

export const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="w-full bg-white pt-16 lg:pt-24 pb-20 lg:pb-28 font-sans scroll-mt-24 overflow-hidden">
      <div className="w-full max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-12">
        
        {/* Top Header Row (Left Text + Right Graph Illustration) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
        >
          {/* Left Text Header */}
          <div className="lg:col-span-6">
            <span className="text-[#1B853A] font-bold text-sm lg:text-base uppercase tracking-wider block mb-3.5">
              FEATURES
            </span>

            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#0F172A] tracking-tight leading-[1.15]">
              Everything you need<br />
              in one integrated system
            </h2>

            <p className="mt-5 text-[#4B5563] text-base lg:text-lg max-w-[480px] leading-relaxed font-normal">
              Obrain ERP comes with a wide range of powerful features to support every department in your business.
            </p>
          </div>

          {/* Right Graph Illustration */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-[480px] lg:max-w-[520px]">
              <img
                src="/features-graph.png"
                alt="Obrain ERP Analytics Illustration"
                className="w-full h-auto object-contain select-none pointer-events-none"
              />
            </div>
          </div>
        </motion.div>

        {/* 3 Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mt-12 lg:mt-16">
          
          {/* Card 1: Finance Management */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            className="bg-white border border-slate-200/80 rounded-[24px] p-7 sm:p-8 lg:p-9 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="w-[72px] h-[72px] rounded-[20px] bg-[#1B853A] flex items-center justify-center mb-7 shadow-xs">
                <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <circle cx="12" cy="15" r="3.5" fill="#1B853A" stroke="white" strokeWidth="2"></circle>
                  <text x="12" y="17.8" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">$</text>
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-[#0F172A] mb-3 tracking-tight">
                Finance Management
              </h3>

              <p className="text-[#4B5563] text-base leading-relaxed font-normal">
                Track expenses, manage budgets, and generate financial reports with ease.
              </p>
            </div>
          </motion.div>

          {/* Card 2: Inventory Management */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
            className="bg-white border border-slate-200/80 rounded-[24px] p-7 sm:p-8 lg:p-9 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="w-[72px] h-[72px] rounded-[20px] bg-[#1B853A] flex items-center justify-center mb-7 shadow-xs">
                <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-[#0F172A] mb-3 tracking-tight">
                Inventory Management
              </h3>

              <p className="text-[#4B5563] text-base leading-relaxed font-normal">
                Monitor stock levels and optimize inventory operations in real time.
              </p>
            </div>
          </motion.div>

          {/* Card 3: Sales & CRM */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
            className="bg-white border border-slate-200/80 rounded-[24px] p-7 sm:p-8 lg:p-9 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="w-[72px] h-[72px] rounded-[20px] bg-[#0066FF] flex items-center justify-center mb-7 shadow-xs">
                <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-[#0F172A] mb-3 tracking-tight">
                Sales & CRM
              </h3>

              <p className="text-[#4B5563] text-base leading-relaxed font-normal">
                Strengthen customer relationships and boost sales performance.
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
