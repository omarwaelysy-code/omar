import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface PricingSectionProps {
  onSelectPlan: () => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onSelectPlan }) => {
  const plans = [
    {
      name: 'Starter',
      price: '$29',
      period: '/month',
      description: 'Ideal for small businesses & startups getting started with ERP.',
      features: ['Up to 5 Users', '3 Warehouses', 'Financial Reports', 'Inventory Management', 'Standard Support'],
      highlight: false
    },
    {
      name: 'Professional',
      price: '$79',
      period: '/month',
      description: 'Perfect for growing companies needing complete control.',
      features: ['Up to 25 Users', '10 Warehouses', 'Full Financial & COGS Sync', 'Sales & CRM Integration', 'Advanced Audit Logs', 'Priority Support'],
      highlight: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'Dedicated infrastructure, custom integrations & SLA support.',
      features: ['Unlimited Users', 'Unlimited Warehouses', 'Custom Workflows & API', 'Dedicated Account Manager', '24/7 SLA Support'],
      highlight: false
    }
  ];

  return (
    <section id="pricing" className="w-full bg-slate-50/70 py-20 lg:py-28 font-sans scroll-mt-24">
      <div className="w-full max-w-[1240px] mx-auto px-6 sm:px-10 lg:px-12">
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="text-[#1B853A] font-bold text-sm lg:text-base uppercase tracking-wider block mb-3">
            PRICING
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-[46px] font-extrabold text-[#0B0F19] tracking-tight leading-[1.15]">
            Transparent Plans for Every Stage
          </h2>
          <p className="mt-5 text-[#4B5563] text-base lg:text-lg leading-relaxed">
            Choose the plan that fits your team. Upgrade or adjust anytime as your operations grow.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
              className={`relative rounded-3xl p-8 sm:p-10 flex flex-col justify-between transition-all duration-300 ${
                plan.highlight 
                  ? 'bg-white border-2 border-[#1B853A] shadow-xl scale-102 z-10' 
                  : 'bg-white border border-slate-200/80 shadow-xs hover:shadow-md'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#1B853A] text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full shadow-xs">
                  Most Popular
                </div>
              )}

              <div>
                <h3 className="text-2xl font-bold text-[#0B0F19] mb-2">{plan.name}</h3>
                <p className="text-slate-500 text-sm mb-6 min-h-[40px]">{plan.description}</p>

                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl sm:text-5xl font-extrabold text-[#0B0F19] tracking-tight">{plan.price}</span>
                  <span className="text-slate-500 font-medium text-sm">{plan.period}</span>
                </div>

                <ul className="space-y-3.5 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-3 text-slate-700 text-sm font-medium">
                      <div className="w-5 h-5 rounded-full bg-[#1B853A]/10 text-[#1B853A] flex items-center justify-center shrink-0">
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={onSelectPlan}
                className={`w-full py-3.5 rounded-xl font-semibold text-base transition-all shadow-xs cursor-pointer ${
                  plan.highlight 
                    ? 'bg-[#1B853A] hover:bg-[#167431] text-white' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                }`}
              >
                Get Started
              </button>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
