// Package store provides transactional JSON documents backed by Postgres.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"sync"
	"time"
)

type Store struct {
	pool *pgxpool.Pool
	mu   sync.Mutex
	docs map[string]json.RawMessage
}

func Memory() *Store { return &Store{docs: map[string]json.RawMessage{}} }
func Open(ctx context.Context, url string) (*Store, error) {
	p, e := pgxpool.New(ctx, url)
	if e != nil {
		return nil, e
	}
	if e = p.Ping(ctx); e != nil {
		p.Close()
		return nil, e
	}
	_, e = p.Exec(ctx, `CREATE TABLE IF NOT EXISTS lifeguessr_documents (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()); ALTER TABLE lifeguessr_documents ENABLE ROW LEVEL SECURITY`)
	if e != nil {
		p.Close()
		return nil, e
	}
	return &Store{pool: p}, nil
}
func (s *Store) Close() {
	if s.pool != nil {
		s.pool.Close()
	}
}

// Update serializes read-modify-write operations for a document across API instances.
func (s *Store) Update(ctx context.Context, key string, initial any, fn func(json.RawMessage) (any, error)) error {
	seed, e := json.Marshal(initial)
	if e != nil {
		return e
	}
	if s.pool == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		raw := s.docs[key]
		if raw == nil {
			raw = seed
		}
		next, e := fn(raw)
		if e != nil {
			return e
		}
		b, e := json.Marshal(next)
		if e == nil {
			s.docs[key] = b
		}
		return e
	}
	tx, e := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	_, e = tx.Exec(ctx, `INSERT INTO lifeguessr_documents(key,value) VALUES($1,$2::jsonb) ON CONFLICT DO NOTHING`, key, string(seed))
	if e != nil {
		return e
	}
	var raw []byte
	e = tx.QueryRow(ctx, `SELECT value FROM lifeguessr_documents WHERE key=$1 FOR UPDATE`, key).Scan(&raw)
	if e != nil {
		return e
	}
	next, e := fn(raw)
	if e != nil {
		return e
	}
	b, e := json.Marshal(next)
	if e != nil {
		return e
	}
	_, e = tx.Exec(ctx, `UPDATE lifeguessr_documents SET value=$2::jsonb,updated_at=now() WHERE key=$1`, key, string(b))
	if e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func (s *Store) Read(ctx context.Context, key string, out any) error {
	if s.pool == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		raw, ok := s.docs[key]
		if !ok {
			return pgx.ErrNoRows
		}
		return json.Unmarshal(raw, out)
	}
	var b []byte
	e := s.pool.QueryRow(ctx, `SELECT value FROM lifeguessr_documents WHERE key=$1`, key).Scan(&b)
	if e != nil {
		return e
	}
	return json.Unmarshal(b, out)
}

var ErrRateLimited = errors.New("rate limit exceeded")

func (s *Store) Limit(ctx context.Context, key string, max int, window time.Duration, now time.Time) error {
	return s.Update(ctx, "limit:"+key, struct {
		Start int64 `json:"start"`
		Count int   `json:"count"`
	}{}, func(raw json.RawMessage) (any, error) {
		var v struct {
			Start int64 `json:"start"`
			Count int   `json:"count"`
		}
		if e := json.Unmarshal(raw, &v); e != nil {
			return nil, e
		}
		if now.Unix()-v.Start >= int64(window.Seconds()) {
			v.Start = now.Unix()
			v.Count = 0
		}
		if v.Count >= max {
			return nil, ErrRateLimited
		}
		v.Count++
		return v, nil
	})
}

func (s *Store) Ping(ctx context.Context) error {
	if s.pool != nil {
		return s.pool.Ping(ctx)
	}
	return nil
}
