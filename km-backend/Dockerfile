# Start from the latest golang base image
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Copy go mod and sum files if present in root or subfolder
COPY go.mo[d] go.su[m] ./
COPY km-backend/go.mo[d] km-backend/go.su[m] ./

# Download dependencies
RUN go mod download

# Copy source files
COPY . ./

# Ensure km-backend Go packages and swagger docs take precedence over root non-code docs
RUN if [ -d "./km-backend" ]; then \
        cp -rf ./km-backend/* /app/; \
    fi

# Build the Go app
RUN go build -o main ./cmd/main.go

# Start a new stage from scratch
FROM alpine:latest  

WORKDIR /root/

# Copy the Pre-built binary file from the previous stage
COPY --from=builder /app/main .

# Expose port 8000 to the outside world
EXPOSE 8000

# Command to run the executable
CMD ["./main"]
