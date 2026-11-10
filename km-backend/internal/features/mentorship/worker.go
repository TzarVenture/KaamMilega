package mentorship

import (
	"context"
	"log"
	"time"

	"go.uber.org/fx"
)

const releaseInterval = 15 * time.Minute

// RegisterReleaseWorker pays mentors automatically once the mentee's 24 hours have passed.
func RegisterReleaseWorker(lc fx.Lifecycle, svc MentorshipService) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})

	run := func() {
		runCtx, stop := context.WithTimeout(ctx, 10*time.Minute)
		defer stop()
		n, err := svc.ReleaseDueSessions(runCtx)
		if err != nil {
			log.Printf("[mentorship] release worker: %v", err)
		} else if n > 0 {
			log.Printf("[mentorship] release worker: paid out %d session(s)", n)
		}
	}

	lc.Append(fx.Hook{
		OnStart: func(context.Context) error {
			go func() {
				defer close(done)
				timer := time.NewTimer(2 * time.Minute)
				defer timer.Stop()
				for {
					select {
					case <-ctx.Done():
						return
					case <-timer.C:
						run()
						timer.Reset(releaseInterval)
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
