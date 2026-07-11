import { useEffect, useState } from 'react';

type NumberInputProps = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
};

export const parseDecimalInput = (value: string) => {
  const normalized = value.trim().replace(/,/g, '.');
  if (!normalized || normalized === '-' || normalized === '+') return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const formatNumberInput = (value: number) => {
  if (!Number.isFinite(value)) return '';

  const rounded = Number(value.toFixed(5));
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

const clampNumber = (value: number, min?: number, max?: number) => {
  let next = value;
  if (typeof min === 'number') next = Math.max(min, next);
  if (typeof max === 'number') next = Math.min(max, next);
  return next;
};

const applyStep = (value: number, step?: number) => {
  if (!step || step <= 0) return value;
  return Math.round(value / step) * step;
};

export function NumberInput({
  value,
  onChange,
  className,
  min,
  max,
  step,
  ariaLabel = 'Number input'
}: NumberInputProps) {
  const [inputValue, setInputValue] = useState(formatNumberInput(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setInputValue(formatNumberInput(value));
    }
  }, [isFocused, value]);

  const commitInput = () => {
    setIsFocused(false);

    const parsed = parseDecimalInput(inputValue);
    if (parsed === null) {
      setInputValue(formatNumberInput(value));
      return;
    }

    const nextValue = Number(formatNumberInput(clampNumber(applyStep(parsed, step), min, max)));
    setInputValue(formatNumberInput(nextValue));
    onChange(nextValue);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={inputValue}
      onFocus={() => setIsFocused(true)}
      onChange={(event) => setInputValue(event.target.value.replace(/,/g, '.'))}
      onBlur={commitInput}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commitInput();
        } else if (event.key === 'Escape') {
          setIsFocused(false);
          setInputValue(formatNumberInput(value));
        }
      }}
      className={className}
    />
  );
}
