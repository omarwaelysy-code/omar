import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, CheckCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const AboutSection: React.FC = () => {
  const { t } = useLanguage();

  const sellingPoints = [
    t('landing.about.point_1'),
    t('landing.about.point_2'),
    t('landing.about.point_3'),
    t('landing.about.point_4')
  ];

  return (
    <section id="about-us" className="w-full bg-white py-20 lg:py-28 font-sans scroll-mt-24">
      <div className="w-full max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Updated Content & Green Check Points */}
          <motion.div 
            initial={{ opacity: 0, x: -25 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="lg:col-span-6"
          >
            <span className="text-[#1B853A] font-bold text-sm lg:text-base uppercase tracking-wider block mb-3.5">
              {t('landing.about.tag')}
            </span>

            <div className="mt-6 space-y-4 text-[#4B5563] text-base lg:text-lg leading-relaxed font-normal">
              <p>{t('landing.about.description_1')}</p>
              <p>{t('landing.about.description_2')}</p>
            </div>

            {/* Four Selling Points with Green Check Icons */}
            <div className="mt-8 space-y-4">
              {sellingPoints.map((point, index) => (
                <div key={index} className="flex items-center gap-3.5">
                  <div className="w-6 h-6 rounded-full bg-[#1B853A]/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-[#1B853A]" />
                  </div>
                  <span className="font-bold text-base text-[#0B0F19]">
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right Column: Information Card */}
          <motion.div 
            initial={{ opacity: 0, x: 25 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="lg:col-span-6"
          >
            <div 
              className="text-white rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
            >
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-4 text-white">{t('landing.about.card_title')}</h3>
                <p className="text-blue-100 leading-relaxed text-base mb-8">
                  {t('landing.about.card_desc')}
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm">
                    <span className="text-white text-sm font-medium">{t('landing.about.sec_1_title')}</span>
                    <span className="text-[#2DD4BF] font-bold text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> {t('landing.about.sec_1_val')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm">
                    <span className="text-white text-sm font-medium">{t('landing.about.sec_2_title')}</span>
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
