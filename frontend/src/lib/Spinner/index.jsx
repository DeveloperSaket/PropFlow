import './spinner.scss';

export default function Spinner({ color, label = 'Loading', className = '' }) {
  const style = color ? { '--spinner-color': color } : undefined;

  return (
    <div
      className={`spinner-container${className ? ` ${className}` : ''}`}
      role="status"
      aria-label={label}
      style={style}
    >
      <span className="spinner" aria-hidden="true" />
    </div>
  );
}
