// The dashboard's motion, CSS only and scoped to its own class names: cards fade up one after another,
// lines are revealed left to right, bars grow, rings and the gauge fill. Under prefers-reduced-motion
// nothing moves and the final state shows at once. Animations never block input.
const CSS = `
@keyframes dash-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes dash-reveal { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes dash-grow { from { transform: scaleX(0); } }
@keyframes dash-ring { from { stroke-dashoffset: 100; } }
.dash-card { animation: dash-rise 420ms cubic-bezier(.2,.7,.2,1) both; animation-delay: calc(var(--dash-i, 0) * 60ms); }
.dash-reveal { animation: dash-reveal 900ms cubic-bezier(.4,0,.2,1) 150ms both; }
.dash-grow { transform-origin: left center; animation: dash-grow 700ms cubic-bezier(.2,.7,.2,1) both; }
.dash-ring { animation: dash-ring 900ms cubic-bezier(.2,.7,.2,1) 150ms both; }
@media (prefers-reduced-motion: reduce) {
  .dash-card, .dash-reveal, .dash-grow, .dash-ring { animation: none !important; }
}
`;

export function DashboardMotion() {
  return <style>{CSS}</style>;
}
