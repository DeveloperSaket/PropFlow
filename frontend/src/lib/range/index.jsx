import './range.scss';

const Range = ({ values, valueMin, valueMax, onChange }) => {
  const validValues = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  const foundMinIndex = validValues.indexOf(Number(valueMin));
  const foundMaxIndex = validValues.indexOf(Number(valueMax));
  const lowerIndex = foundMinIndex >= 0 ? foundMinIndex : 0;
  const upperIndex = foundMaxIndex > lowerIndex ? foundMaxIndex : validValues.length - 1;
  const lowerPosition = (lowerIndex / (validValues.length - 1)) * 100;
  const upperPosition = (upperIndex / (validValues.length - 1)) * 100;

  const updateMin = (event) => {
    const index = Math.min(Number(event.target.value), upperIndex - 1);
    onChange(validValues[index], validValues[upperIndex]);
  };

  const updateMax = (event) => {
    const index = Math.max(Number(event.target.value), lowerIndex + 1);
    onChange(validValues[lowerIndex], validValues[index]);
  };

  return (
    <div className="range-container" style={{ '--range-start': `${lowerPosition}%`, '--range-end': `${upperPosition}%` }}>
      <div className="range-track" aria-hidden="true" />
      <div className="range-selected-track" aria-hidden="true" />
      <input
        className="range-input range-input-min"
        type="range"
        min={0}
        max={validValues.length - 1}
        step={1}
        value={lowerIndex}
        aria-label="Minimum price"
        onChange={updateMin}
      />
      <input
        className="range-input range-input-max"
        type="range"
        min={0}
        max={validValues.length - 1}
        step={1}
        value={upperIndex}
        aria-label="Maximum price"
        onChange={updateMax}
      />
    </div>
  );
};

export default Range;
