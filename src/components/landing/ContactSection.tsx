import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, MapPin, Send, CheckCircle2, MessageSquare } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const ContactSection: React.FC = () => {
  const { t } = useLanguage();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setFormData({ name: '', email: '', message: '' });
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <section id="contact" className="w-full bg-white py-20 lg:py-28 font-sans scroll-mt-24">
      <div className="w-full max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-12">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Column: Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -25 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="lg:col-span-5"
          >
            <span className="text-[#1B853A] font-bold text-sm lg:text-base uppercase tracking-wider block mb-3">
              {t('landing.contact.tag')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B0F19] tracking-tight">
              {t('landing.contact.title')}
            </h2>
            <p className="mt-4 text-[#4B5563] text-base leading-relaxed font-normal">
              {t('landing.contact.description')}
            </p>

            <div className="mt-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1B853A]/10 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-[#1B853A]" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#4B5563]">{t('landing.contact.phone_label')}</h4>
                  <a href="tel:+201010010156" className="font-bold text-[#0B0F19] hover:text-[#1B853A] transition-colors dir-ltr block text-right">
                    +022 01010010156
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1B853A]/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-[#1B853A]" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#4B5563]">{t('landing.contact.whatsapp_label')}</h4>
                  <a href="https://wa.me/201010010156" target="_blank" rel="noopener noreferrer" className="font-bold text-[#0B0F19] hover:text-[#1B853A] transition-colors dir-ltr block text-right">
                    +022 01010010156
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1B853A]/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-[#1B853A]" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#4B5563]">{t('landing.contact.hq_label')}</h4>
                  <p className="font-bold text-[#0B0F19]">{t('landing.contact.hq_val')}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 25 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="lg:col-span-7 bg-slate-50 border border-slate-200/80 rounded-3xl p-8 sm:p-10 shadow-xs"
          >
            {submitted && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-[#1B853A] text-sm font-medium flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{t('landing.contact.success')}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-[#0B0F19] mb-2">
                  {t('landing.contact.form_name')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('landing.contact.form_name_placeholder')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#1B853A] text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0B0F19] mb-2">
                  {t('landing.contact.form_email')}
                </label>
                <input
                  type="email"
                  required
                  placeholder={t('landing.contact.form_email_placeholder')}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#1B853A] text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0B0F19] mb-2">
                  {t('landing.contact.form_message')}
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder={t('landing.contact.form_message_placeholder')}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#1B853A] text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#1B853A] hover:bg-[#167431] text-white py-3.5 px-6 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <span>{t('landing.contact.send')}</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
