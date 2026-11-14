import { z } from 'zod';
// Local settings only. Feature PRs extend their own slice; no tool state enters a server session.
const id=z.string().min(1).max(200);
export const SubscriptionToolStateSchema=z.strictObject({
  guess:z.number().finite().nonnegative().optional(), selectedServiceIds:z.array(id).max(200).default([]),
  cancelIds:z.array(id).max(5000).default([]),
});
export const OverpayingToolStateSchema=z.strictObject({
  zip:z.string().regex(/^\d{5}$/).optional(),metro:z.string().max(100).optional(),
  tier:z.enum(['cheap','mid','expensive','suburb']).optional(),
  bedrooms:z.number().int().min(0).max(4).default(2),adults:z.number().int().min(1).max(4).default(1),
  kids:z.array(z.enum(['infant','toddler','preschool','schoolAge'])).max(20).default([]),
  rent:z.number().finite().positive().optional(),carInsurance:z.number().finite().positive().optional(),
  groceries:z.number().finite().positive().optional(),childcare:z.number().finite().positive().optional(),
});
export const PayoffToolStateSchema=z.strictObject({method:z.enum(['avalanche','snowball']).default('avalanche'),extra:z.number().finite().nonnegative().default(0),targetMonths:z.number().int().min(1).max(1200).optional()});
export const ToolsStateSchema=z.strictObject({subscriptions:SubscriptionToolStateSchema.optional(),overpaying:OverpayingToolStateSchema.optional(),payoff:PayoffToolStateSchema.optional()});
export type ToolsState=z.infer<typeof ToolsStateSchema>;
