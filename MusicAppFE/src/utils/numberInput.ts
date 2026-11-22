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
