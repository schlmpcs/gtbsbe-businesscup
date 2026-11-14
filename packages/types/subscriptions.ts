import { z } from 'zod';
import { SourceSchema } from './schemas';
export const CadenceSchema=z.enum(['monthly','quarterly','yearly']);
export type Cadence=z.infer<typeof CadenceSchema>;
export const ServiceCategorySchema=z.enum(['video','music','software','cloud','fitness','news','gaming','learning','food','other']);
export type ServiceCategory=z.infer<typeof ServiceCategorySchema>;
export const ServicePlanSchema=z.object({id:z.string().min(1).max(100),name:z.string().min(1).max(200),price:z.number().finite().nonnegative(),cadence:CadenceSchema});
export type ServicePlan=z.infer<typeof ServicePlanSchema>;
export const KnownServiceSchema=z.object({id:z.string().regex(/^[a-z][a-z0-9-]*$/).max(100),name:z.string().min(1).max(200),category:ServiceCategorySchema,
  matchers:z.array(z.string().regex(/^[A-Z]+(?: [A-Z]+)*$/)).min(1),ambiguous:z.boolean().optional(),plans:z.array(ServicePlanSchema).min(1),
  priceYear:z.number().int().min(2000).max(2200),source:SourceSchema,isEstimate:z.boolean()});
export type KnownService=z.infer<typeof KnownServiceSchema>;
