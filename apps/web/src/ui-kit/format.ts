// Display formatting for kit users. features/*/ui may import only @/ui-kit/**, so the formatters
// in src/lib/format.ts are re-exported here. Rounding happens only at display time.
export { formatMoney, formatRate, type FormatMoneyOptions } from '@/lib/format';
