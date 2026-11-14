import "../src/ui-kit/global.css";
import type { ReactNode } from "react";
export const metadata = {
  title: "LifeGuessr — Forecast your decisions",
  description:
    "Explore a life, understand your budget, and model your next financial decision.",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
