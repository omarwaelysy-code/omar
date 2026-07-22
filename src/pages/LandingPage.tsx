import React, { useState, useEffect } from 'react';
import { LandingHeader } from '../components/landing/LandingHeader';
import { HeroSection } from '../components/landing/HeroSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { SolutionsSection } from '../components/landing/SolutionsSection';
import { AboutSection } from '../components/landing/AboutSection';
import { ContactSection } from '../components/landing/ContactSection';
import { FooterSection } from '../components/landing/FooterSection';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const sectionIds = ['home', 'features', 'how-it-works', 'solutions', 'about-us', 'contact'];
    
    const handleObserver = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '-20% 0px -50% 0px',
      threshold: 0.1
    });

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleNavigateToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(sectionId);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-[#1B853A]/20" dir="ltr">
      {/* Sticky Glassmorphism Header with Active Link Indicator */}
      <LandingHeader 
        activeSection={activeSection}
        onGetStarted={onGetStarted}
        onNavigateToSection={handleNavigateToSection}
      />

      {/* Single-Page Scroll Sections */}
      <main className="w-full flex flex-col">
        {/* 1. Hero Section */}
        <HeroSection onLogin={onLogin} />

        {/* 2. Features Section */}
        <FeaturesSection />

        {/* 3. How It Works Section */}
        <HowItWorksSection />

        {/* 4. Solutions Section */}
        <SolutionsSection />

        {/* 5. About Us Section */}
        <AboutSection />

        {/* 6. Contact Section */}
        <ContactSection />
      </main>

      {/* Footer Section */}
      <FooterSection onNavigateToSection={handleNavigateToSection} />
    </div>
  );
};
