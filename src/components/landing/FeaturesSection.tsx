import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';

export const FeaturesSection: React.FC = () => {
  const { t } = useLanguage();

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
              {t('landing.features.tag')}
            </span>

            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#0F172A] tracking-tight leading-[1.18]">
              {t('landing.features.title_1')}<br />
              {t('landing.features.title_2')}
            </h2>

            <p className="mt-5 text-[#4B5563] text-base lg:text-lg max-w-[480px] leading-relaxed font-normal">
              {t('landing.features.description')}
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
                {t('landing.features.card_1_title')}
              </h3>

              <p className="text-[#4B5563] text-base leading-relaxed font-normal">
                {t('landing.features.card_1_desc')}
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
                {t('landing.features.card_2_title')}
              </h3>

              <p className="text-[#4B5563] text-base leading-relaxed font-normal">
                {t('landing.features.card_2_desc')}
              </p>
            </div>
          </motion.div>

          {/* Card 3: Sales & Purchasing */}
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
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-[#0F172A] mb-3 tracking-tight">
                {t('landing.features.card_3_title')}
              </h3>

              <p className="text-[#4B5563] text-base leading-relaxed font-normal">
                {t('landing.features.card_3_desc')}
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
