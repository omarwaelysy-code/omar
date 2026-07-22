import React, { useState, useEffect } from 'react';
import { Logo } from '../Logo';
import { motion } from 'framer-motion';

interface LandingHeaderProps {
  activeSection: string;
  onGetStarted: () => void;
  onNavigateToSection: (sectionId: string) => void;
}

export const navItems = [
  { id: 'home', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'solutions', label: 'Solutions' },
  { id: 'about-us', label: 'About Us' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'contact', label: 'Contact' },
];

export const LandingHeader: React.FC<LandingHeaderProps> = ({ 
  activeSection, 
  onGetStarted,
  onNavigateToSection 
}) => {
  const [scrolled, setScrolled] = useState(false);

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
        <nav className="hidden md:flex items-center gap-8 lg:gap-10">
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
                {item.label}
                
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

        {/* Right Get Started Button */}
        <div>
          <button
            type="button"
            onClick={onGetStarted}
            className="bg-[#1B853A] hover:bg-[#167431] active:scale-[0.98] text-white px-7 py-2.5 rounded-lg font-semibold text-base transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer"
          >
            Get Started
          </button>
        </div>
      </div>
    </header>
  );
};
