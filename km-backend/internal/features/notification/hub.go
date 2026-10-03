package notification

import (
	"log"
	"sync"

	"github.com/gofiber/contrib/websocket"
)

// NotificationHub maintains active WebSocket connections for users and broadcasts events.
type NotificationHub struct {
	// Maps userID -> map of active *websocket.Conn
	clients map[string]map[*websocket.Conn]bool
	mu      sync.RWMutex
}

// NewNotificationHub creates a new thread-safe notification hub instance.
func NewNotificationHub() *NotificationHub {
	return &NotificationHub{
		clients: make(map[string]map[*websocket.Conn]bool),
	}
}

// Register adds a connection for a user.
func (h *NotificationHub) Register(userID string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.clients[userID] == nil {
		h.clients[userID] = make(map[*websocket.Conn]bool)
	}
	h.clients[userID][conn] = true
}

// Unregister removes a connection for a user and cleans up the map if empty.
func (h *NotificationHub) Unregister(userID string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if conns, ok := h.clients[userID]; ok {
		delete(conns, conn)
		if len(conns) == 0 {
			delete(h.clients, userID)
		}
	}
}

// Send dispatches a JSON message to all active connections for a given user.
func (h *NotificationHub) Send(userID string, message interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if conns, ok := h.clients[userID]; ok {
		for conn := range conns {
			if err := conn.WriteJSON(message); err != nil {
				log.Println("[NotificationHub] WriteJSON error:", err)
			}
		}
	}
}

// Broadcast dispatches a JSON message to all connected clients across all users.
func (h *NotificationHub) Broadcast(message interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, conns := range h.clients {
		for conn := range conns {
			if err := conn.WriteJSON(message); err != nil {
				log.Println("[NotificationHub] Broadcast WriteJSON error:", err)
			}
		}
	}
}
