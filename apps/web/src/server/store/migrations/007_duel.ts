import type { Migration } from './types';
export const m007Duel: Migration = { version: 7, name: 'duel', sql: `
CREATE TABLE duel_days (result_id text PRIMARY KEY CHECK (result_id ~ '^[0-9a-f]{32}$'), play_date date NOT NULL, anon_key text NOT NULL CHECK (anon_key ~ '^[0-9a-f]{64}$'), created_at timestamptz NOT NULL DEFAULT clock_timestamp(), CONSTRAINT duel_days_one_per_day UNIQUE (play_date, anon_key));
CREATE TABLE duel_hints (play_date date NOT NULL, anon_key text NOT NULL CHECK (anon_key ~ '^[0-9a-f]{64}$'), round smallint NOT NULL CHECK (round BETWEEN 1 AND 5), opened_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY (play_date, anon_key, round));
CREATE TABLE duel_picks (play_date date NOT NULL, anon_key text NOT NULL CHECK (anon_key ~ '^[0-9a-f]{64}$'), round smallint NOT NULL CHECK (round BETWEEN 1 AND 5), result_id text NOT NULL REFERENCES duel_days (result_id), choice text NOT NULL CHECK (choice IN ('A', 'B')), correct boolean NOT NULL, points integer NOT NULL CHECK (points >= 0), hints smallint NOT NULL CHECK (hints >= 0), scored jsonb NOT NULL CHECK (jsonb_typeof(scored) = 'object'), created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY (play_date, anon_key, round));
CREATE INDEX duel_picks_crowd ON duel_picks (play_date, round, choice);
CREATE INDEX duel_picks_result ON duel_picks (result_id);
` };
