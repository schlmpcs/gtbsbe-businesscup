package store

import (
	"context"
	"encoding/json"
	"os"
	"sync"
	"testing"
	"time"
)

func TestMemoryAtomicUpdates(t *testing.T) { exerciseAtomic(t, Memory()) }
func TestPostgresAtomicUpdates(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL to a disposable Postgres database")
	}
	s, e := Open(context.Background(), url)
	if e != nil {
		t.Fatal(e)
	}
	defer s.Close()
	exerciseAtomic(t, s)
}
func exerciseAtomic(t *testing.T, s *Store) {
	t.Helper()
	key := "test:" + time.Now().Format("20060102150405.000000000")
	var wg sync.WaitGroup
	for i := 0; i < 32; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			e := s.Update(context.Background(), key, 0, func(raw json.RawMessage) (any, error) {
				var n int
				if e := json.Unmarshal(raw, &n); e != nil {
					return nil, e
				}
				return n + 1, nil
			})
			if e != nil {
				t.Error(e)
			}
		}()
	}
	wg.Wait()
	var n int
	if e := s.Read(context.Background(), key, &n); e != nil || n != 32 {
		t.Fatalf("atomic update: n=%d err=%v", n, e)
	}
}
