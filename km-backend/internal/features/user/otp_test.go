package user

import (
	"testing"

	"km-backend/internal/config"
)

func TestOTPHash(t *testing.T) {
	a := &UserServiceImpl{config: &config.Config{JWTSecret: "secret-a"}}
	b := &UserServiceImpl{config: &config.Config{JWTSecret: "secret-b"}}

	if a.hashOTP("1234") == "1234" {
		t.Fatal("the code itself must not be stored")
	}
	if a.hashOTP("1234") != a.hashOTP(" 1234 ") {
		t.Fatal("the same code (with stray spaces) must hash the same")
	}
	if a.hashOTP("1234") == a.hashOTP("1235") {
		t.Fatal("different codes must not collide")
	}
	if a.hashOTP("1234") == b.hashOTP("1234") {
		t.Fatal("the hash must depend on the server secret")
	}
}
