package account

import (
	"context"
	"log"
	"time"

	"go.uber.org/fx"
)

// deletionInterval is how often the worker looks for accounts whose grace period ended
const deletionInterval = time.Hour

// RegisterDeletionWorker runs final account deletions in the background for the app's lifetime.
// Running it on several instances is safe: each anonymisation only applies while the account
// is still pending_deletion.
func RegisterDeletionWorker(lc fx.Lifecycle, svc *Service) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})

	run := func() {
		runCtx, stop := context.WithTimeout(ctx, 10*time.Minute)
		defer stop()
		n, err := svc.ProcessDueDeletions(runCtx)
		if err != nil {
			log.Printf("[account] deletion worker: %v", err)
		} else if n > 0 {
			log.Printf("[account] deletion worker: %d account(s) deleted", n)
		}
	}

	lc.Append(fx.Hook{
		OnStart: func(context.Context) error {
			go func() {
				defer close(done)
				// First pass shortly after start, then every interval
				timer := time.NewTimer(time.Minute)
				defer timer.Stop()
				for {
					select {
					case <-ctx.Done():
						return
					case <-timer.C:
						run()
						timer.Reset(deletionInterval)
					}
				}
			}()
			return nil
		},
		OnStop: func(stopCtx context.Context) error {
			cancel()
			select {
			case <-done:
			case <-stopCtx.Done():
			}
			return nil
		},
	})
}
