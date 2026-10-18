import './range.scss';

const Range = ({ min, max, valueMin, valueMax, onChange, step = 50000 }) => {
  const range = max - min;
  const lowerPosition = ((valueMin - min) / range) * 100;
  const upperPosition = ((valueMax - min) / range) * 100;

  const updateMin = (event) => {
    onChange(Math.min(Number(event.target.value), valueMax - step), valueMax);
  };

  const updateMax = (event) => {
    onChange(valueMin, Math.max(Number(event.target.value), valueMin + step));
  };

  return (
    <div className="range-container" style={{ '--range-start': `${lowerPosition}%`, '--range-end': `${upperPosition}%` }}>
      <div className="range-track" aria-hidden="true" />
      <div className="range-selected-track" aria-hidden="true" />
      <input
        className="range-input range-input-min"
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMin}
        aria-label="Minimum price"
        onChange={updateMin}
      />
      <input
        className="range-input range-input-max"
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMax}
        aria-label="Maximum price"
        onChange={updateMax}
      />
    </div>
  );
};

export default Range;
