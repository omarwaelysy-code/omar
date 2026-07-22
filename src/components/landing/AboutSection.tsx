import React from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle, Award } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const AboutSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section id="about-us" className="w-full bg-white py-20 lg:py-28 font-sans scroll-mt-24">
      <div className="w-full max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <motion.div 
            initial={{ opacity: 0, x: -25 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="lg:col-span-6"
          >
            <span className="text-[#1B853A] font-bold text-sm lg:text-base uppercase tracking-wider block mb-3">
              {t('landing.about.tag')}
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0B0F19] tracking-tight leading-tight">
              {t('landing.about.title')}
            </h2>
            <p className="mt-6 text-[#4B5563] text-base sm:text-lg leading-relaxed font-normal">
              {t('landing.about.description')}
            </p>

            <div className="mt-8 grid grid-cols-2 gap-6 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1B853A]/10 flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6 text-[#1B853A]" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-[#0B0F19]">{t('landing.about.stat_1_title')}</h4>
                  <p className="text-sm text-[#4B5563]">{t('landing.about.stat_1_desc')}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#006CFF]/10 flex items-center justify-center shrink-0">
                  <Award className="w-6 h-6 text-[#006CFF]" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-[#0B0F19]">{t('landing.about.stat_2_title')}</h4>
                  <p className="text-sm text-[#4B5563]">{t('landing.about.stat_2_desc')}</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 25 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="lg:col-span-6"
          >
            <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-4">{t('landing.about.card_title')}</h3>
                <p className="text-slate-300 leading-relaxed text-base mb-8">
                  {t('landing.about.card_desc')}
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                    <span className="text-slate-300 text-sm font-medium">{t('landing.about.sec_1_title')}</span>
                    <span className="text-[#2DD4BF] font-bold text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> {t('landing.about.sec_1_val')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                    <span className="text-slate-300 text-sm font-medium">{t('landing.about.sec_2_title')}</span>
                    <span className="text-[#2DD4BF] font-bold text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> {t('landing.about.sec_2_val')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-[#1B853A]/20 rounded-full blur-3xl pointer-events-none" />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
