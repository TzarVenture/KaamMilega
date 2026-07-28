package chat

import (
	"log"
	"sync"

	"github.com/gofiber/contrib/websocket"
)

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	// Registered clients configured by UserID String
	clients map[string]*websocket.Conn
	mu      sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[string]*websocket.Conn),
	}
}

func (h *Hub) Register(userID string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[userID] = conn
}

func (h *Hub) Unregister(userID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, userID)
}

func (h *Hub) Send(userID string, message interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if conn, ok := h.clients[userID]; ok {
		if err := conn.WriteJSON(message); err != nil {
			log.Println("websocket write error:", err)
		}
	}
}
