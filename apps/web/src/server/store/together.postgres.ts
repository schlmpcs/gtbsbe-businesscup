// Server-only: together plans in Postgres (table `together_plans`, migration 009).
import type { TogetherPlan } from '@lifeguessr/types';
import type { Db } from './postgres';
import { decodePlan, isPlanId, newPlan, type TogetherStore } from './together';

type Row = { plan_id: string; partner1: unknown; partner2: unknown; goal: unknown; created_at: Date; expires_at: Date };

const COLUMNS = 'plan_id, partner1, partner2, goal, created_at, expires_at';

const fromRow = (row: Row | undefined): TogetherPlan | null =>
  row
    ? decodePlan({
        id: row.plan_id,
        partner1: row.partner1,
        partner2: row.partner2,
        goal: row.goal,
        createdAt: row.created_at.toISOString(),
        expiresAt: row.expires_at.toISOString(),
      })
    : null;

export function createPostgresTogetherStore(db: Db): TogetherStore {
  return {
    async create(partner1, goal, now) {
      const plan = newPlan(partner1, goal, now);
      return db.transaction(async (tx) => {
        // Expired plans go on every create, so the table never keeps a plan past its expiry for long.
        await tx.query('DELETE FROM together_plans WHERE expires_at <= $1::timestamptz', [now.toISOString()]);
        const { rows } = await tx.query<Row>(
          `INSERT INTO together_plans (plan_id, partner1, goal, created_at, expires_at)
           VALUES ($1, $2::jsonb, $3::jsonb, $4::timestamptz, $5::timestamptz) RETURNING ${COLUMNS}`,
          // jsonb parameters go as JSON text (node-postgres would turn an array into a Postgres array).
          [plan.id, JSON.stringify(plan.partner1), plan.goal ? JSON.stringify(plan.goal) : null, plan.createdAt, plan.expiresAt],
        );
        return fromRow(rows[0]) ?? plan;
      });
    },

    async get(id, now) {
      if (!isPlanId(id)) return null;
      const { rows } = await db.query<Row>(
        `SELECT ${COLUMNS} FROM together_plans WHERE plan_id = $1 AND expires_at > $2::timestamptz`,
        [id, now.toISOString()],
      );
      return fromRow(rows[0]);
    },

    async setPartner2(id, partner2, goal, now) {
      if (!isPlanId(id)) return null;
      const keepGoal = goal === undefined;
      const { rows } = await db.query<Row>(
        `UPDATE together_plans
            SET partner2 = $2::jsonb,
                goal = CASE WHEN $3::boolean THEN goal ELSE $4::jsonb END,
                updated_at = now()
          WHERE plan_id = $1 AND expires_at > $5::timestamptz
          RETURNING ${COLUMNS}`,
        [id, JSON.stringify(partner2), keepGoal, goal ? JSON.stringify(goal) : null, now.toISOString()],
      );
      return fromRow(rows[0]);
    },
  };
}
