import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Award, Users, Globe } from 'lucide-react';

export const AboutSection: React.FC = () => {
  return (
    <section id="about-us" className="w-full bg-white py-20 lg:py-28 font-sans scroll-mt-24">
      <div className="w-full max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="lg:col-span-6"
          >
            <span className="text-[#1B853A] font-bold text-sm lg:text-base uppercase tracking-wider block mb-3">
              ABOUT US
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-[46px] font-extrabold text-[#0B0F19] tracking-tight leading-[1.15]">
              Empowering Businesses Through Smart Technology
            </h2>
            <p className="mt-6 text-[#4B5563] text-base lg:text-lg leading-relaxed">
              Obrain ERP was engineered from the ground up to solve complex business operations with intuitive design and cloud precision. Our mission is to streamline finance, inventory, and management into a single trusted solution.
            </p>

            <div className="grid grid-cols-2 gap-6 mt-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1B853A]/10 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-[#1B853A]" />
                </div>
                <div>
                  <h4 className="font-bold text-[#0B0F19] text-base">99.9% Uptime</h4>
                  <p className="text-xs text-slate-500">Enterprise Cloud</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1B853A]/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-[#1B853A]" />
                </div>
                <div>
                  <h4 className="font-bold text-[#0B0F19] text-base">10,000+</h4>
                  <p className="text-xs text-slate-500">Active Users</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="lg:col-span-6"
          >
            <div className="relative bg-slate-900 rounded-3xl p-8 sm:p-12 text-white overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#1B853A]/20 blur-3xl rounded-full pointer-events-none" />
              
              <h3 className="text-2xl sm:text-3xl font-extrabold mb-4">
                Designed for Reliability & Precision
              </h3>
              <p className="text-slate-300 text-base leading-relaxed mb-8">
                From real-time stock balances to automated ledger entries, Obrain handles your data with maximum security and compliance standards.
              </p>

              <div className="border-t border-slate-800 pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Security</p>
                  <p className="text-sm font-bold text-white mt-1">AES-256 Encrypted</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Compliance</p>
                  <p className="text-sm font-bold text-white mt-1">IFRS Standard</p>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
