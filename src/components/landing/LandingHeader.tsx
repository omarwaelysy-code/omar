import React from 'react';

interface LandingHeaderProps {
  onGetStarted: () => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({ onGetStarted }) => {
  return (
    <header className="w-full max-w-[1340px] mx-auto px-6 sm:px-10 lg:px-14 py-6 flex items-center justify-between font-sans">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <div className="w-10 h-10 flex items-center justify-center">
          <img 
            src="/obrain-icon.png" 
            alt="Obrain Icon" 
            className="w-10 h-10 object-contain"
            onError={(e) => {
              // Fallback SVG if image not loaded
              e.currentTarget.style.display = 'none';
              const svg = e.currentTarget.parentElement?.querySelector('.fallback-svg');
              if (svg) (svg as HTMLElement).style.display = 'block';
            }}
          />
          <svg 
            viewBox="0 0 100 100" 
            className="fallback-svg w-10 h-10 hidden" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              d="M50 10C27.9086 10 10 27.9086 10 50C10 72.0914 27.9086 90 50 90C59.5 90 68.2 86.7 75.1 81.2L85 91.1C87 93.1 90.1 91.7 90.1 88.9V75.1C90.1 75.1 90 50 90 50C90 27.9086 72.0914 10 50 10ZM50 70C38.9543 70 30 61.0457 30 50C30 38.9543 38.9543 30 50 30C61.0457 30 70 38.9543 70 50C70 61.0457 61.0457 70 50 70Z" 
              fill="#1B853A" 
            />
          </svg>
        </div>
        <span className="text-3xl font-extrabold text-[#0B0F19] tracking-tight font-sans">
          Obrain
        </span>
      </div>

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
          className="bg-[#1B853A] hover:bg-[#167431] active:scale-[0.98] text-white px-7 py-2.5 rounded-lg font-semibold text-base transition-all duration-200 shadow-sm cursor-pointer"
        >
          Get Started
        </button>
      </div>
    </header>
  );
};
