import React from 'react';

interface DottedGridProps {
  cols: number;
  rows: number;
  color?: string;
  className?: string;
}

export const DottedGrid: React.FC<DottedGridProps> = ({
  cols,
  rows,
  color = "#2DD4BF",
  className = ""
}) => {
  return (
    <div 
      className={`inline-grid gap-[18px] ${className}`}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
      }}
    >
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div
          key={i}
          className="w-[4px] h-[4px] rounded-full transition-opacity"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
};
