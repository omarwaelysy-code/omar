import React, { useState, useEffect } from 'react';

interface FormattedNumberInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  dir?: 'rtl' | 'ltr';
  id?: string;
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
  required = false,
  placeholder = '',
  dir,
  id
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const formatValue = (num: number) => {
    if (num === undefined || num === null || isNaN(num)) return '';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  useEffect(() => {
    if (!isFocused) {
      setInputValue(value === 0 ? '' : String(value));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setInputValue(value === 0 ? '' : String(value));
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseFloat(inputValue.replace(/,/g, '')) || 0;
    onChange(parsed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    let clean = val.replace(/[^0-9.-]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = parts[0] + '.' + parts.slice(1).join('');
    }
    setInputValue(clean);
    
    const parsed = parseFloat(clean) || 0;
    onChange(parsed);
  };

  const displayValue = isFocused ? inputValue : formatValue(value);

  return (
    <input
      id={id}
      type="text"
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      value={displayValue}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      dir={dir}
    />
  );
};
