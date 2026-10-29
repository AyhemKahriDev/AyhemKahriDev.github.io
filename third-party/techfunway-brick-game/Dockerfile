ARG VERSION=dev
ARG BUILD_TIME=unknown
ARG GIT_COMMIT=unknown

FROM golang:1.26-alpine AS builder
ARG VERSION
ARG BUILD_TIME
ARG GIT_COMMIT
WORKDIR /src
COPY server/go.mod ./
RUN go mod download
COPY server/ ./
RUN CGO_ENABLED=0 GOOS=linux go build \
	  -ldflags "-X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME} -X main.GitCommit=${GIT_COMMIT} -X main.AppName=brick-game" \
	  -o brick-game .

FROM alpine:3.21
RUN apk add --no-cache tzdata ca-certificates
RUN adduser -D -u 1000 appuser
WORKDIR /app
COPY --from=builder /src/brick-game .
COPY web/ ./web
USER appuser
EXPOSE 8908
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:8908/api/health || exit 1
ENTRYPOINT ["./brick-game"]
CMD ["-port", "8908", "-web-dir", "./web"]
