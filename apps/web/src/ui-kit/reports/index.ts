// Report-style building blocks shared by the money screens (Cash flow, Budget, Recurring, Goals,
// Accounts, Transactions). Presentational only: props in, events out; colors from tokens; motion in CSS
// (respecting prefers-reduced-motion). Import from '@/ui-kit/reports'.
export { CategoryChip } from './CategoryChip';
export { CountUp, type CountUpProps } from './CountUp';
export { Donut, type DonutProps, type DonutSegment } from './Donut';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { Initials, initialsOf } from './Initials';
export { KpiStrip, type KpiItem } from './KpiStrip';
export { Meter, type MeterProps } from './Meter';
export { Panel, type PanelProps } from './Panel';
export { PlanImpactPanel, type PlanImpactPanelProps } from './PlanImpactPanel';
export { Ring, type RingProps } from './Ring';
export { useWidth } from './useWidth';
export { Segmented, type SegmentedOption, type SegmentedProps } from './Segmented';
export { CLASS_TONE, CYCLE, GROUP_TONE, MOTION, TONE_BG, TONE_FILL, TONE_STROKE, TONE_TEXT, type ChartTone } from './tones';
