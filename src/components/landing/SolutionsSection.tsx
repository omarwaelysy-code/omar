import React from 'react';
import { motion } from 'framer-motion';
import { Layers, ShieldCheck, Zap } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const SolutionsSection: React.FC = () => {
  const { t } = useLanguage();

  const solutions = [
    {
      icon: <Zap className="w-8 h-8 text-[#1B853A]" />,
      title: t('landing.solutions.sol_1_title'),
      description: t('landing.solutions.sol_1_desc')
    },
    {
      icon: <Layers className="w-8 h-8 text-[#1B853A]" />,
      title: t('landing.solutions.sol_2_title'),
      description: t('landing.solutions.sol_2_desc')
    },
    {
      icon: <ShieldCheck className="w-8 h-8 text-[#1B853A]" />,
      title: t('landing.solutions.sol_3_title'),
      description: t('landing.solutions.sol_3_desc')
    }
  ];

  return (
    <section id="solutions" className="w-full bg-slate-50/70 py-20 lg:py-28 font-sans scroll-mt-24">
      <div className="w-full max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-12">
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto mb-16 lg:mb-20"
        >
          <span className="text-[#1B853A] font-bold text-sm lg:text-base uppercase tracking-wider block mb-3">
            {t('landing.solutions.tag')}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0B0F19] tracking-tight">
            {t('landing.solutions.title')}
          </h2>
          <p className="mt-4 text-[#4B5563] text-base sm:text-lg leading-relaxed font-normal">
            {t('landing.solutions.description')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {solutions.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: idx * 0.15, ease: "easeOut" }}
              className="bg-white border border-slate-200/70 rounded-2xl p-8 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="w-14 h-14 rounded-xl bg-[#1B853A]/10 flex items-center justify-center mb-6">
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-[#0B0F19] mb-3">
                  {item.title}
                </h3>
                <p className="text-[#4B5563] text-base leading-relaxed font-normal">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
