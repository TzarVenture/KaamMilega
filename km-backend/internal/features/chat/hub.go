package chat

import (
	"log"
	"sync"

	"github.com/gofiber/contrib/websocket"
)

// Hub maintains the set of active clients, supports multi-tab/device connections per user,
// and broadcasts messages, read receipts, and typing indicators concurrently and safely.
type Hub struct {
	// Registered clients: map of UserID -> set of active *websocket.Conn
	clients map[string]map[*websocket.Conn]bool
	mu      sync.RWMutex
	// Connection write mutex to avoid concurrent websocket write panics
	writeMu sync.Mutex
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[string]map[*websocket.Conn]bool),
	}
}

// Register adds a new connection for a user (supporting multiple tabs/devices)
func (h *Hub) Register(userID string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, exists := h.clients[userID]; !exists {
		h.clients[userID] = make(map[*websocket.Conn]bool)
	}
	h.clients[userID][conn] = true
}

// Unregister removes a specific connection for a user
func (h *Hub) Unregister(userID string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if userConns, exists := h.clients[userID]; exists {
		delete(userConns, conn)
		if len(userConns) == 0 {
			delete(h.clients, userID)
		}
	}
}

// IsOnline checks whether a user has at least one active connection
func (h *Hub) IsOnline(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	userConns, exists := h.clients[userID]
	return exists && len(userConns) > 0
}

// Send broadcasts a message payload to all active connections belonging to a user
func (h *Hub) Send(userID string, message interface{}) {
	h.mu.RLock()
	userConns, exists := h.clients[userID]
	if !exists || len(userConns) == 0 {
		h.mu.RUnlock()
		return
	}

	// Make a shallow copy of connection pointers to avoid holding read lock during I/O writes
	conns := make([]*websocket.Conn, 0, len(userConns))
	for conn := range userConns {
		conns = append(conns, conn)
	}
	h.mu.RUnlock()

	h.writeMu.Lock()
	defer h.writeMu.Unlock()

	for _, conn := range conns {
		if err := conn.WriteJSON(message); err != nil {
			log.Println("[ChatWS] WebSocket write error:", err)
			// Connection is likely dead, unregister it
			go h.Unregister(userID, conn)
		}
	}
}
