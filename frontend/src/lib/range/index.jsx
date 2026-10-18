import './range.scss';

const Range = ({ min = 0, max = 100_000_000, valueMin, valueMax, onChange, step = 50_000_000 }) => {
  const safeMin = Number.isFinite(Number(min)) ? Number(min) : 0;
  const safeMax = Number.isFinite(Number(max)) && Number(max) > safeMin ? Number(max) : safeMin + step;
  const safeStep = Math.min(step, safeMax - safeMin);
  const lowerValue = Number.isFinite(Number(valueMin))
    ? Math.min(Math.max(Number(valueMin), safeMin), safeMax - safeStep)
    : safeMin;
  const upperValue = Number.isFinite(Number(valueMax))
    ? Math.min(Math.max(Number(valueMax), lowerValue + safeStep), safeMax)
    : safeMax;
  const range = safeMax - safeMin;
  const lowerPosition = ((lowerValue - safeMin) / range) * 100;
  const upperPosition = ((upperValue - safeMin) / range) * 100;

  const updateMin = (event) => {
    onChange(Math.min(Number(event.target.value), upperValue - safeStep), upperValue);
  };

  const updateMax = (event) => {
    onChange(lowerValue, Math.max(Number(event.target.value), lowerValue + safeStep));
  };

  return (
    <div className="range-container" style={{ '--range-start': `${lowerPosition}%`, '--range-end': `${upperPosition}%` }}>
      <div className="range-track" aria-hidden="true" />
      <div className="range-selected-track" aria-hidden="true" />
      <input
        className="range-input range-input-min"
        type="range"
        min={safeMin}
        max={safeMax}
        step={safeStep}
        value={lowerValue}
        aria-label="Minimum price"
        onChange={updateMin}
      />
      <input
        className="range-input range-input-max"
        type="range"
        min={safeMin}
        max={safeMax}
        step={safeStep}
        value={upperValue}
        aria-label="Maximum price"
        onChange={updateMax}
      />
    </div>
  );
};

export default Range;
