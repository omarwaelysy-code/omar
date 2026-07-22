import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'icon';
  color?: 'green' | 'white' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animateStartup?: boolean;
  animatePulse?: boolean;
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = "", 
  variant = 'full',
  color = 'green',
  size = 'md',
  animateStartup = false,
  animatePulse = true,
  onClick
}) => {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!animatePulse) return;
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 800);
    }, 4500);
    return () => clearInterval(interval);
  }, [animatePulse]);

  const getGreenColor = () => {
    if (color === 'white') return "#FFFFFF";
    if (color === 'dark') return "#18181b";
    return "#1B853A"; // Obrain Primary Green
  };

  const getTextColor = () => {
    if (color === 'white') return "#FFFFFF";
    return "#0B0F19"; // Dark Charcoal
  };

  const green = getGreenColor();
  const text = getTextColor();

  // Size mapping (increased ~25% for high visibility & readability)
  const sizeMap = {
    sm: { icon: 'w-8 h-8', text: 'text-2xl', gap: 'gap-2.5' },
    md: { icon: 'w-11 h-11', text: 'text-3xl', gap: 'gap-3' },
    lg: { icon: 'w-14 h-14', text: 'text-4xl', gap: 'gap-3.5' },
    xl: { icon: 'w-20 h-20', text: 'text-5xl', gap: 'gap-4' }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <motion.div 
      className={`inline-flex items-center ${currentSize.gap} select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      initial={animateStartup ? { opacity: 0, scale: 0.85 } : { opacity: 1, scale: 1 }}
      animate={{ 
        opacity: 1, 
        scale: pulse ? 1.03 : 1,
      }}
      whileHover={{ scale: 1.05 }}
      transition={{ 
        duration: animateStartup ? 0.5 : 0.2, 
        ease: [0.22, 1, 0.36, 1] 
      }}
    >
      {/* Icon SVG */}
      <motion.div 
        className={`relative ${currentSize.icon} flex items-center justify-center shrink-0`}
        initial={animateStartup ? { rotate: -360, opacity: 0, scale: 0.7 } : { rotate: 0 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ duration: animateStartup ? 0.8 : 0, ease: "easeOut" }}
      >
        <svg 
          viewBox="0 0 100 100" 
          className="w-full h-full object-contain"
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Obrain signature green Q emblem */}
          <path 
            d="M50 10C27.9086 10 10 27.9086 10 50C10 72.0914 27.9086 90 50 90C59.5 90 68.2 86.7 75.1 81.2L85 91.1C87 93.1 90.1 91.7 90.1 88.9V75.1C90.1 75.1 90 50 90 50C90 27.9086 72.0914 10 50 10ZM50 70C38.9543 70 30 61.0457 30 50C30 38.9543 38.9543 30 50 30C61.0457 30 70 38.9543 70 50C70 61.0457 61.0457 70 50 70Z" 
            fill={green} 
          />
        </svg>
      </motion.div>

      {/* Text */}
      {variant === 'full' && (
        <span 
          className={`font-extrabold ${currentSize.text} tracking-tight font-sans`}
          style={{ color: text }}
        >
          Obrain
        </span>
      )}
    </motion.div>
  );
};
