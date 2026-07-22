import React, { useState, useEffect } from 'react';
import { Logo } from '../Logo';

interface LandingHeaderProps {
  onGetStarted: () => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({ onGetStarted }) => {
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
        ? 'bg-white/85 backdrop-blur-md border-b border-slate-100/80 shadow-xs py-4' 
        : 'bg-white py-6'
    }`}>
      <div className="w-full max-w-[1340px] mx-auto px-6 sm:px-10 lg:px-14 flex items-center justify-between font-sans">
        
        {/* Unified Obrain Logo */}
        <Logo 
          size="md" 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
        />

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-8 lg:gap-10">
          {['Home', 'Features', 'Solutions', 'About Us', 'Pricing', 'Contact'].map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={(e) => {
                e.preventDefault();
                if (link === 'Home') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="text-[#27272A] font-semibold text-base hover:text-[#1B853A] transition-colors duration-200"
            >
              {link}
            </a>
          ))}
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
