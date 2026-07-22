import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, CheckCircle } from 'lucide-react';

export const ContactSection: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
    setFormData({ name: '', email: '', message: '' });
  };

  return (
    <section id="contact" className="w-full bg-white py-20 lg:py-28 font-sans scroll-mt-24">
      <div className="w-full max-w-[1340px] mx-auto px-6 sm:px-10 lg:px-14">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="lg:col-span-5"
          >
            <span className="text-[#1B853A] font-bold text-sm lg:text-base uppercase tracking-wider block mb-3">
              CONTACT US
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-[46px] font-extrabold text-[#0B0F19] tracking-tight leading-[1.15]">
              Get in Touch with Our Team
            </h2>
            <p className="mt-6 text-[#4B5563] text-base lg:text-lg leading-relaxed">
              Have questions about Obrain ERP or need a tailored demo for your company? Contact our team and we'll respond within 24 hours.
            </p>

            <div className="space-y-6 mt-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1B853A]/10 text-[#1B853A] flex items-center justify-center shrink-0">
                  <Mail size={20} />
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold">Email</h4>
                  <p className="text-base font-semibold text-[#0B0F19]">contact@obrainsystem.com</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1B853A]/10 text-[#1B853A] flex items-center justify-center shrink-0">
                  <Phone size={20} />
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold">Phone</h4>
                  <p className="text-base font-semibold text-[#0B0F19]">+1 (800) 555-OBRAIN</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1B853A]/10 text-[#1B853A] flex items-center justify-center shrink-0">
                  <MapPin size={20} />
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold">HQ Location</h4>
                  <p className="text-base font-semibold text-[#0B0F19]">Innovation Tower, Financial District</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="lg:col-span-7"
          >
            <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-8 sm:p-10 shadow-xs">
              <form onSubmit={handleSubmit} className="space-y-6">
                {submitted && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-bold flex items-center gap-3">
                    <CheckCircle className="text-[#1B853A]" size={20} />
                    Thank you! Your message has been sent successfully.
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Your Name</label>
                  <input
                    required
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1B853A]/20 focus:border-[#1B853A] outline-none text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Work Email</label>
                  <input
                    required
                    type="email"
                    placeholder="john@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1B853A]/20 focus:border-[#1B853A] outline-none text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Message</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Tell us about your team size and operational needs..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1B853A]/20 focus:border-[#1B853A] outline-none text-slate-900 font-medium resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#1B853A] hover:bg-[#167431] text-white py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.98] cursor-pointer"
                >
                  <Send size={18} />
                  <span>Send Message</span>
                </button>
              </form>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
