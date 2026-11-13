package chat

import (
	"testing"

	"github.com/gofiber/contrib/websocket"
)

func TestHubViewing(t *testing.T) {
	h := NewHub()
	phone, laptop := &websocket.Conn{}, &websocket.Conn{}
	h.Register("u1", phone)
	h.Register("u1", laptop)

	if h.IsViewing("u1", "c1") {
		t.Fatal("viewing before any screen said so")
	}
	h.SetViewing("u1", laptop, "c1")
	if !h.IsViewing("u1", "c1") || h.IsViewing("u1", "c2") || h.IsViewing("u2", "c1") {
		t.Fatal("viewing state wrong after laptop opened c1")
	}
	h.SetViewing("u1", laptop, "") // tab went to the background
	if h.IsViewing("u1", "c1") {
		t.Fatal("still viewing after leaving")
	}
	h.SetViewing("u1", phone, "c1")
	h.Unregister("u1", phone)
	if h.IsViewing("u1", "c1") {
		t.Fatal("closed connection still counts as viewing")
	}
	if h.IsViewing("u1", "") {
		t.Fatal("empty conversation matched")
	}
}
