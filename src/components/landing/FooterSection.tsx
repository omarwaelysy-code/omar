import React from 'react';
import { Logo } from '../Logo';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface FooterSectionProps {
  onNavigateToSection: (sectionId: string) => void;
}

export const FooterSection: React.FC<FooterSectionProps> = ({ onNavigateToSection }) => {
  const { t } = useLanguage();

  const quickLinks = [
    { id: 'home', labelKey: 'landing.nav.home' },
    { id: 'features', labelKey: 'landing.nav.features' },
    { id: 'how-it-works', labelKey: 'landing.nav.how_it_works' },
    { id: 'solutions', labelKey: 'landing.nav.solutions' },
    { id: 'about-us', labelKey: 'landing.nav.about_us' },
    { id: 'contact', labelKey: 'landing.nav.contact' },
  ];

  return (
    <footer className="w-full bg-[#2563EB] text-white py-16 font-sans border-t border-blue-500/30">
      <div className="w-full max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-blue-500/30">
          
          <div className="md:col-span-5">
            <Logo size="md" color="white" className="mb-4" />
            <p className="text-blue-100 text-sm max-w-sm leading-relaxed">
              {t('landing.footer.description')}
            </p>
          </div>

          <div className="md:col-span-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
              {t('landing.footer.quick_links')}
            </h4>
            <ul className="space-y-2.5">
              {quickLinks.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigateToSection(item.id);
                    }}
                    className="text-blue-100 hover:text-white text-sm transition-colors"
                  >
                    {t(item.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
              {t('landing.footer.security_title')}
            </h4>
            <p className="text-blue-100 text-sm leading-relaxed mb-4">
              {t('landing.footer.security_desc')}
            </p>
            <div className="flex items-center gap-2 text-xs text-[#2DD4BF] bg-white/10 px-3.5 py-2 rounded-lg border border-white/20 w-fit backdrop-blur-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{t('landing.footer.system_status')}</span>
            </div>
          </div>

        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-blue-100 gap-4">
          <p>{t('landing.footer.copyright')}</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white transition-colors">{t('landing.footer.privacy')}</a>
            <a href="#" className="hover:text-white transition-colors">{t('landing.footer.terms')}</a>
            <a href="#" className="hover:text-white transition-colors flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t('landing.footer.security')}</span>
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};
