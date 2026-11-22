import { useState } from 'react';
import { formatNumberInput, parseDecimalInput } from '../utils/numberInput';

type NumberInputProps = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
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
      value={isFocused ? inputValue : formatNumberInput(value)}
      onFocus={() => {
        setIsFocused(true);
        setInputValue(formatNumberInput(value));
      }}
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
