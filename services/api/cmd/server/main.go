package main

import (
	"context"
	"github.com/schlmpcs/gtbsbe-businesscup/services/api/internal/catalog"
	"github.com/schlmpcs/gtbsbe-businesscup/services/api/internal/server"
	"github.com/schlmpcs/gtbsbe-businesscup/services/api/internal/store"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata"
)

func main() {
	ctxSetup, cancelSetup := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancelSetup()
	var db *store.Store
	var err error
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		db, err = store.Open(ctxSetup, databaseURL)
	} else if os.Getenv("STORE_MODE") == "memory" && os.Getenv("APP_ENV") != "production" {
		db = store.Memory()
		log.Print("WARNING: explicit development memory storage; data will reset on restart")
	} else {
		log.Fatal("DATABASE_URL required; for local development set STORE_MODE=memory")
	}
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	data, err := catalog.Load()
	if err != nil {
		log.Fatal(err)
	}
	handler, err := server.New(db, data, server.Config{TrustProxy: os.Getenv("TRUST_PROXY") == "true", SecureCookies: os.Getenv("APP_ENV") == "production", PublicOrigin: os.Getenv("PUBLIC_ORIGIN"), AnthropicKey: os.Getenv("ANTHROPIC_API_KEY"), ZDRVerified: os.Getenv("ANTHROPIC_ZDR_VERIFIED") == "true"})
	if err != nil {
		log.Fatal(err)
	}
	addr := os.Getenv("API_ADDR")
	if addr == "" {
		addr = ":8080"
	}
	httpServer := &http.Server{Addr: addr, Handler: handler, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		httpServer.Shutdown(shutdown)
	}()
	log.Printf("API listening on %s", addr)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
