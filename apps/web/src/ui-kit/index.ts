// UI kit barrel (docs/ARCHITECTURE.md → Layers). Presentational only: props in, events out; no fetching,
// no engine imports, no business math. Styled only via tokens (tokens.css). See every piece at /kit.
// features/*/ui may import only @/ui-kit/**, @/copy and ../model/types, so anything a screen needs for
// display (formatters included) is exported from here.

export { BarBreakdown, type BarBreakdownItem, type BarBreakdownProps } from './BarBreakdown';
export { Button, buttonClassName, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button';
export { Card, type CardProps } from './Card';
export { Choice, type ChoiceOption, type ChoiceProps } from './Choice';
export { cx } from './cx';
export { EstimateTag } from './EstimateTag';
export { Field, useFieldControl, type FieldProps } from './Field';
export {
  ForecastChart,
  type ForecastChartPoint,
  type ForecastChartProps,
  type ForecastChartSeries,
} from './ForecastChart';
export { formatMoney, formatRate, type FormatMoneyOptions } from './format';
export { Gauge, gaugeZone, type GaugeProps, type GaugeThresholds, type GaugeZone } from './Gauge';
export { Row, Stack, type Gap, type LayoutProps, type RowProps } from './Layout';
export { LockNotice, type LockNoticeProps } from './LockNotice';
export { Money, Percent, type MoneyProps, type PercentProps } from './Money';
export { NumberInput, type NumberInputProps } from './NumberInput';
export { Sheet, type SheetProps } from './Sheet';
export { LOG_SLIDER_POSITIONS, Slider, sliderScale, type SliderProps } from './Slider';
export { SourceNote, type SourceNoteProps } from './SourceNote';
export { Stat, type StatProps, type StatTone } from './Stat';
export { Tabs, type TabItem, type TabsProps } from './Tabs';

/** Where a number comes from ({ name, year, url? }); re-exported so ui/ files can type props. */
export type { Source } from '@lifeguessr/types';
