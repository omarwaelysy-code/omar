import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'icon';
  color?: 'green' | 'white' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({ 
  className = "h-8", 
  variant = 'full',
  color = 'green'
}) => {
  const getGreenColor = () => {
    if (color === 'white') return "#FFFFFF";
    if (color === 'dark') return "#18181b";
    return "#10b981"; // Primary Green
  };

  const getTextColor = () => {
    if (color === 'white') return "#FFFFFF";
    if (color === 'green') return "#18181b";
    return "#18181b";
  };

  const green = getGreenColor();
  const text = getTextColor();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg 
        viewBox="0 0 100 100" 
        className={`${variant === 'icon' ? 'w-full h-full' : 'h-full w-auto'}`}
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle 
          cx="50" 
          cy="50" 
          r="40" 
          stroke={green} 
          strokeWidth="10" 
          strokeLinecap="round"
          strokeDasharray="180 60"
          className="animate-dash"
        />
        <circle 
          cx="50" 
          cy="50" 
          r="15" 
          fill={green}
        />
      </svg>
      {variant === 'full' && (
        <span 
          className="font-black text-2xl tracking-tighter"
          style={{ color: text }}
        >
          OBrain
        </span>
      )}
    </div>
  );
};
