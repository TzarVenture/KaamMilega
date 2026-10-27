package notification

import "sync/atomic"

// PushSender delivers a notification to the user's browsers and phones (Firebase Cloud
// Messaging). It is implemented by the push package and installed at startup with
// SetPushSender; without one, notifications are in-app (WebSocket) and email only.
type PushSender interface {
	// Push must not block: implementations send in the background
	Push(n *Notification)
}

var pushSender atomic.Value // holds PushSender

// SetPushSender installs the push sender (called once from main through fx).
func SetPushSender(p PushSender) {
	if p != nil {
		pushSender.Store(p)
	}
}

func dispatchPush(n *Notification) {
	if n == nil {
		return
	}
	if p, ok := pushSender.Load().(PushSender); ok {
		p.Push(n)
	}
}
