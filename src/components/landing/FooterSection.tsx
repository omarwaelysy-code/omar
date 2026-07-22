import React from 'react';
import { Logo } from '../Logo';

interface FooterSectionProps {
  onNavigateToSection: (sectionId: string) => void;
}

export const FooterSection: React.FC<FooterSectionProps> = ({ onNavigateToSection }) => {
  return (
    <footer className="w-full bg-slate-900 text-white py-16 font-sans border-t border-slate-800">
      <div className="w-full max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-slate-800">
          
          <div className="md:col-span-5">
            <Logo size="md" color="white" className="mb-4" />
            <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
              Obrain ERP is the unified enterprise management system for finance, inventory, sales, and operations.
            </p>
          </div>

          <div className="md:col-span-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Quick Links</h4>
            <ul className="space-y-2.5">
              {[
                { id: 'home', label: 'Home' },
                { id: 'features', label: 'Features' },
                { id: 'solutions', label: 'Solutions' },
                { id: 'about-us', label: 'About Us' },
                { id: 'contact', label: 'Contact' },
              ].map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigateToSection(item.id);
                    }}
                    className="text-slate-400 text-sm hover:text-white transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Compliance & Security</h4>
            <p className="text-slate-400 text-xs leading-relaxed mb-4">
              Enterprise-grade AES-256 encryption, strict audit logs, and cloud automated backups.
            </p>
            <span className="inline-block bg-slate-800 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full">
              System Status: All Systems Operational
            </span>
          </div>

        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-medium">
          <p>&copy; 2026 Obrain System. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#privacy" onClick={(e) => e.preventDefault()} className="hover:text-slate-400">Privacy Policy</a>
            <a href="#terms" onClick={(e) => e.preventDefault()} className="hover:text-slate-400">Terms of Service</a>
            <a href="#security" onClick={(e) => e.preventDefault()} className="hover:text-slate-400">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
