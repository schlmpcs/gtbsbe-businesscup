import type { ReactNode } from "react";
export function Panel({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <section className="panel">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Money({ value }: { value: number | undefined }) {
  return (
    <>
      {value === undefined
        ? "—"
        : new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(value)}
    </>
  );
}
export function Field({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
export function ForecastChart({
  points,
}: {
  points: { month: number; mid: number; low: number; high: number }[];
}) {
  if (!points.length) return null;
  const min = Math.min(...points.map((p) => p.low)),
    max = Math.max(...points.map((p) => p.high)),
    scale = max - min || 1;
  const xy = (p: { month: number }, value: number) =>
    `${(p.month / points[points.length - 1].month) * 600},${170 - ((value - min) / scale) * 150}`;
  return (
    <svg
      viewBox="0 0 600 190"
      role="img"
      aria-label="Ten-year net worth forecast with estimated input range"
    >
      <polygon
        points={[
          ...points.map((p) => xy(p, p.high)),
          ...points
            .slice()
            .reverse()
            .map((p) => xy(p, p.low)),
        ].join(" ")}
        fill="var(--chart-band)"
      />
      <polyline
        points={points.map((p) => xy(p, p.mid)).join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3"
      />
      <text x="0" y="187">
        Today
      </text>
      <text x="535" y="187">
        10 years
      </text>
    </svg>
  );
}
export { HouseScene } from "./HouseScene";
