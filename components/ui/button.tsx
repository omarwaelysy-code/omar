import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20",
      secondary: "bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-900/20",
      outline: "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 shadow-sm",
      ghost: "text-zinc-600 hover:bg-zinc-100",
      danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20",
    };
    
    const sizes = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-4 py-2.5 text-sm",
      lg: "px-6 py-3.5 text-base",
      icon: "p-2.5",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export interface ToggleButtonProps extends ButtonProps {
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

export const ToggleButton = React.forwardRef<HTMLButtonElement, ToggleButtonProps>(
  ({ className, pressed, onPressedChange, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={pressed ? 'secondary' : 'outline'}
        className={cn(
          pressed && "ring-2 ring-emerald-500 ring-offset-2",
          className
        )}
        onClick={(e) => {
          if (props.onClick) props.onClick(e);
          if (onPressedChange) onPressedChange(!pressed);
        }}
        {...props}
      />
    );
  }
);

ToggleButton.displayName = 'ToggleButton';
