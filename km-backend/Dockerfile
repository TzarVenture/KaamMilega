# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install git (needed for some go modules)
RUN apk --no-cache add git

# Copy dependency files first for layer caching
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy all source code
COPY . .

# Build the binary
RUN go build -o main ./cmd/main.go

# Run stage — minimal image
FROM alpine:latest

# Add CA certs (needed for HTTPS/TLS calls like MongoDB Atlas, AWS SES)
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/main .

# Expose port
EXPOSE 8000

# Run the server
CMD ["./main"]
