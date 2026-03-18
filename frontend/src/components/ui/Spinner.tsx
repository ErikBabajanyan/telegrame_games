import './ui.css';

interface SpinnerProps {
  size?: number;
}

export function Spinner({ size = 24 }: SpinnerProps) {
  return (
    <div
      className="spinner"
      style={{ width: size, height: size }}
    />
  );
}
