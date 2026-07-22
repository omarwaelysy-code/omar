import React from 'react';
import { motion } from 'framer-motion';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'icon';
  color?: 'green' | 'white' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  disableAnimation?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = "", 
  variant = 'full',
  color = 'green',
  size = 'md',
  onClick,
  disableAnimation = false
}) => {
  const getGreenColor = () => {
    if (color === 'white') return "#FFFFFF";
    if (color === 'dark') return "#18181b";
    return "#1B853A"; // Signature Obrain Green
  };

  const getTextColor = () => {
    if (color === 'white') return "#FFFFFF";
    return "#0B0F19"; // Dark Charcoal
  };

  const green = getGreenColor();
  const text = getTextColor();

  // Size mapping (25% larger, aligned vertical proportion)
  const sizeMap = {
    sm: { icon: 'w-7 h-7', text: 'text-xl', gap: 'gap-2.5' },
    md: { icon: 'w-10 h-10', text: 'text-2xl', gap: 'gap-3' },
    lg: { icon: 'w-12 h-12', text: 'text-3xl', gap: 'gap-3.5' },
    xl: { icon: 'w-16 h-16', text: 'text-4xl', gap: 'gap-4' }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <motion.div 
      className={`inline-flex items-center ${currentSize.gap} select-none transform-gpu ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      animate={disableAnimation ? undefined : {
        scale: [1, 1.02, 1],
        rotate: [0, 1, 0]
      }}
      transition={disableAnimation ? undefined : {
        duration: 7,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      whileHover={{ 
        scale: 1.05,
        rotate: 2,
        transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] }
      }}
    >
      {/* Precision Vector SVG Icon */}
      <div className={`relative ${currentSize.icon} flex items-center justify-center shrink-0`}>
        <svg 
          viewBox="0 0 100 100" 
          className="w-full h-full object-contain"
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M50 10C27.9086 10 10 27.9086 10 50C10 72.0914 27.9086 90 50 90C60.5 90 70 85.8 77 78.8L86 87.8C87.6 89.4 90.3 88.3 90.3 86.1V73C90.3 73 90 50 90 50C90 27.9086 72.0914 10 50 10ZM50 68C40.0589 68 32 59.9411 32 50C32 40.0589 40.0589 32 50 32C59.9411 32 68 40.0589 68 50C68 59.9411 59.9411 68 50 68Z" 
            fill={green} 
          />
        </svg>
      </div>

      {/* Typography: Obrain Wordmark (Font Weight 600, Plus Jakarta Sans/Manrope, tracking-wide) */}
      {variant === 'full' && (
        <span 
          className={`font-semibold ${currentSize.text} tracking-[0.02em] leading-none flex items-center`}
          style={{ 
            color: text, 
            fontFamily: '"Plus Jakarta Sans", "Manrope", sans-serif'
          }}
        >
          Obrain
        </span>
      )}
    </motion.div>
  );
};
