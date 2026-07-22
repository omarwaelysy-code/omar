import React, { useState, useEffect } from 'react';
import { Logo } from '../Logo';
import { motion } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';

interface LandingHeaderProps {
  activeSection: string;
  onGetStarted: () => void;
  onNavigateToSection: (sectionId: string) => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({ 
  activeSection, 
  onGetStarted,
  onNavigateToSection 
}) => {
  const [scrolled, setScrolled] = useState(false);
  const { t } = useLanguage();

  const navItems = [
    { id: 'home', labelKey: 'landing.nav.home' },
    { id: 'features', labelKey: 'landing.nav.features' },
    { id: 'how-it-works', labelKey: 'landing.nav.how_it_works' },
    { id: 'solutions', labelKey: 'landing.nav.solutions' },
    { id: 'about-us', labelKey: 'landing.nav.about_us' },
    { id: 'contact', labelKey: 'landing.nav.contact' },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${
      scrolled 
        ? 'bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-xs py-3.5' 
        : 'bg-white py-5'
    }`}>
      <div className="w-full max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-12 flex items-center justify-between font-sans">
        
        {/* Unified Obrain Logo */}
        <Logo 
          size="md" 
          onClick={() => onNavigateToSection('home')} 
        />

        {/* Center Nav Links with active indicator */}
        <nav className="hidden md:flex items-center gap-7 lg:gap-9">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateToSection(item.id);
                }}
                className={`relative py-1 font-semibold text-base transition-colors duration-200 ${
                  isActive ? 'text-[#1B853A]' : 'text-[#27272A] hover:text-[#1B853A]'
                }`}
              >
                {t(item.labelKey)}
                
                {/* Active Indicator Underline */}
                {isActive && (
                  <motion.div 
                    layoutId="navbar-active-indicator"
                    className="absolute -bottom-1 left-0 right-0 h-[3px] bg-[#1B853A] rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Right Section: Language Switcher + Get Started Button */}
        <div className="flex items-center gap-3 sm:gap-4">
          <LanguageSwitcher />

          <button
            type="button"
            onClick={onGetStarted}
            className="bg-[#1B853A] hover:bg-[#167431] active:scale-[0.98] text-white px-6 sm:px-7 py-2.5 rounded-xl font-semibold text-base transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer shrink-0"
          >
            {t('landing.nav.get_started')}
          </button>
        </div>
      </div>
    </header>
  );
};
