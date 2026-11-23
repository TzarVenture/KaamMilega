package main

import (
	"testing"

	"go.uber.org/fx"
)

// TestWiring catches a missing or circular dependency between the server's parts. fx.ValidateApp
// builds the graph without calling any constructor, so nothing connects to a database or opens a port.
func TestWiring(t *testing.T) {
	if err := fx.ValidateApp(appOptions()); err != nil {
		t.Fatal(err)
	}
}
