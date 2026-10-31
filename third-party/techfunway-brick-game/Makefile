APP_NAME := brick-game
VERSION := $(shell cat VERSION | tr -d '\n')
BUILD_TIME := $(shell date +%Y-%m-%dT%H:%M:%S)
GIT_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
LDFLAGS := -X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME) -X main.GitCommit=$(GIT_COMMIT) -X main.AppName=$(APP_NAME)
PORT := 8908

.PHONY: help dev start build build-linux build-all build-docker fnpack clean

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  dev             本地启动（http://localhost:$(PORT)）"
	@echo "  start           直接 go run 启动"
	@echo "  build           编译当前平台二进制"
	@echo "  build-linux     交叉编译 linux/amd64 + arm64"
	@echo "  build-all       全平台编译打包（darwin/linux/windows 压缩包到 release/<版本>/）"
	@echo "  build-docker    构建多架构 Docker 镜像（amd64+arm64 合并单 tag）并推送 Docker Hub"
	@echo "  fnpack          构建飞牛 fnOS 安装包（双架构 .fpk 到 release/）"
	@echo "  clean           清理构建产物"

dev:
	go run -ldflags "$(LDFLAGS)" ./server -port $(PORT) -web-dir ./web -logmode debug

start:
	go run -ldflags "$(LDFLAGS)" ./server -port $(PORT) -web-dir ./web

build:
	cd server && CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o ../$(APP_NAME) .

build-linux:
	mkdir -p release
	cd server && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o ../release/$(APP_NAME)-linux-amd64 .
	cd server && CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o ../release/$(APP_NAME)-linux-arm64 .

build-all:
	bash scripts/build-all.sh

build-docker:
	bash scripts/build-docker.sh

fnpack:
	bash scripts/build-fnpack.sh

clean:
	rm -f $(APP_NAME)
	rm -rf release/
	rm -rf server/brick-game
