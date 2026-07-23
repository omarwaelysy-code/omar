import React from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Layers, 
  ShieldCheck, 
  Wallet, 
  Package, 
  ShoppingCart, 
  Truck, 
  UserCheck, 
  Building2, 
  BarChart3
} from 'lucide-react';
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

  const modules = [
    { id: 'accounting', titleKey: 'landing.solutions.mod_accounting', icon: <Wallet className="w-7 h-7" /> },
    { id: 'inventory', titleKey: 'landing.solutions.mod_inventory', icon: <Package className="w-7 h-7" /> },
    { id: 'sales', titleKey: 'landing.solutions.mod_sales', icon: <ShoppingCart className="w-7 h-7" /> },
    { id: 'purchases', titleKey: 'landing.solutions.mod_purchases', icon: <Truck className="w-7 h-7" /> },
    { id: 'customers', titleKey: 'landing.solutions.mod_customers', icon: <UserCheck className="w-7 h-7" /> },
    { id: 'suppliers', titleKey: 'landing.solutions.mod_suppliers', icon: <Building2 className="w-7 h-7" /> },
    { id: 'reports', titleKey: 'landing.solutions.mod_reports', icon: <BarChart3 className="w-7 h-7" /> },
    { id: 'operations', titleKey: 'landing.solutions.mod_operations', icon: <Layers className="w-7 h-7" /> }
  ];

  return (
    <section id="solutions" className="w-full bg-white py-20 lg:py-28 font-sans scroll-mt-24 relative overflow-hidden">
      
      {/* Decorative Right Dotted Arcs */}
      <div className="absolute top-8 right-0 z-0 pointer-events-none opacity-40">
        <svg viewBox="0 0 350 350" className="w-[350px] h-[350px] text-[#2DD4BF]" fill="none">
          <circle cx="350" cy="150" r="100" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="350" cy="150" r="150" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="350" cy="150" r="200" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="350" cy="150" r="250" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
        </svg>
      </div>

      <div className="w-full max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-12 relative z-10">
        
        {/* Main Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-3xl mb-14 lg:mb-16"
        >
          <span className="text-[#1B853A] font-bold text-sm lg:text-base uppercase tracking-wider block mb-3">
            {t('landing.solutions.tag')}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#0B0F19] tracking-tight leading-[1.15]">
            {t('landing.solutions.title')}
          </h2>
          <p className="mt-4 text-[#4B5563] text-base lg:text-lg leading-relaxed font-normal">
            {t('landing.solutions.description')}
          </p>
        </motion.div>

        {/* Existing 3 Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-16 lg:mb-20">
          {solutions.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: idx * 0.15, ease: "easeOut" }}
              className="bg-white border border-slate-200/80 rounded-[24px] p-7 sm:p-8 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="w-14 h-14 rounded-2xl bg-[#1B853A]/10 flex items-center justify-center mb-6">
                  {item.icon}
                </div>
                <h3 className="text-2xl font-bold text-[#0F172A] mb-3 tracking-tight">
                  {item.title}
                </h3>
                <p className="text-[#4B5563] text-base leading-relaxed font-normal">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Modules Subsection Extension */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="pt-8 border-t border-slate-100"
        >
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0B0F19] tracking-tight">
              {t('landing.solutions.modules_title')}
            </h3>
            <p className="mt-2 text-[#4B5563] text-base font-normal">
              {t('landing.solutions.modules_subtitle')}
            </p>
          </div>

          {/* 8 Modules Icon Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-5">
            {modules.map((mod, idx) => (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.35, delay: idx * 0.05, ease: "easeOut" }}
                whileHover={{ y: -6, scale: 1.03 }}
                className="bg-white border border-slate-200/80 rounded-[20px] p-5 shadow-xs hover:shadow-xl hover:border-[#1B853A]/40 transition-all duration-300 flex flex-col items-center text-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#1B853A]/10 group-hover:bg-[#1B853A] text-[#1B853A] group-hover:text-white flex items-center justify-center mb-3.5 transition-all duration-300 shadow-xs">
                  {mod.icon}
                </div>
                <span className="font-bold text-base text-[#0B0F19] group-hover:text-[#1B853A] transition-colors duration-200 leading-tight">
                  {t(mod.titleKey)}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
};
