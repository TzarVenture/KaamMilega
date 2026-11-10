package payment

import (
	"context"
	"log"
	"time"

	"go.uber.org/fx"
)

const reconcileInterval = 5 * time.Minute

// RegisterWorker runs the payment recovery job for as long as the server is up.
func RegisterWorker(lc fx.Lifecycle, svc Service) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})

	run := func() {
		runCtx, stop := context.WithTimeout(ctx, 4*time.Minute)
		defer stop()
		if err := svc.Reconcile(runCtx); err != nil {
			log.Printf("[payment] recovery job: %v", err)
		}
	}

	lc.Append(fx.Hook{
		OnStart: func(context.Context) error {
			go func() {
				defer close(done)
				timer := time.NewTimer(time.Minute)
				defer timer.Stop()
				for {
					select {
					case <-ctx.Done():
						return
					case <-timer.C:
						run()
						timer.Reset(reconcileInterval)
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
