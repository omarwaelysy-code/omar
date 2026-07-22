import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ShieldCheck, Zap, BarChart2 } from 'lucide-react';

export const SolutionsSection: React.FC = () => {
  const solutions = [
    {
      icon: <Zap className="w-6 h-6 text-[#1B853A]" />,
      title: "Real-time Operations Sync",
      desc: "Connect sales, procurement, and warehouse operations in real time without data silos or delays."
    },
    {
      icon: <BarChart2 className="w-6 h-6 text-[#1B853A]" />,
      title: "Automated Financial Accounting",
      desc: "Generate double-entry journal entries, balance sheets, and tax-ready reports automatically."
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-[#1B853A]" />,
      title: "Enterprise Audit & Compliance",
      desc: "Granular permissions, strict data audit logs, and automatic data integrity checks."
    }
  ];

  return (
    <section id="solutions" className="w-full bg-slate-50/70 py-20 lg:py-28 font-sans scroll-mt-24">
      <div className="w-full max-w-[1340px] mx-auto px-6 sm:px-10 lg:px-14">
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="text-[#1B853A] font-bold text-sm lg:text-base uppercase tracking-wider block mb-3">
            SOLUTIONS
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-[46px] font-extrabold text-[#0B0F19] tracking-tight leading-[1.15]">
            Built for Growing Enterprises & SMEs
          </h2>
          <p className="mt-5 text-[#4B5563] text-base lg:text-lg leading-relaxed">
            Eliminate operational friction with tailor-made ERP workflows designed for efficiency and compliance.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {solutions.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
              className="bg-white border border-slate-200/70 rounded-3xl p-8 shadow-xs hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-[#1B853A]/10 flex items-center justify-center mb-6">
                {item.icon}
              </div>
              <h3 className="text-xl font-bold text-[#0B0F19] mb-3">
                {item.title}
              </h3>
              <p className="text-[#4B5563] text-base leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
