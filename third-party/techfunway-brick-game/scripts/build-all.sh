#!/bin/bash
# 全平台编译打包——产物格式对齐 bill 项目 release/<VERSION>/：
#   techfunway-brick-game-<VERSION>-{linux,darwin}-{amd64,arm64}.tar.gz
#   techfunway-brick-game-<VERSION>-windows-amd64.zip
#   docker-compose.yml / docker-compose.latest.yml（镜像 tag 替换为当前版本）
# 压缩包内为 <包名>/ 目录：brick-game 二进制 + web 静态资源（默认 -web-dir=./web 即解压即用）。
# brick-game 服务端零 CGO 依赖，直接 CGO_ENABLED=0 交叉编译即可。
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="brick-game"
PACKAGE_PREFIX="techfunway-brick-game"
VERSION=$(cat VERSION | tr -d '\n')
BUILD_TIME=$(date +%Y-%m-%dT%H:%M:%S)
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
LDFLAGS="-X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME} -X main.GitCommit=${GIT_COMMIT} -X main.AppName=${APP_NAME}"

BUILD_DIR="release/${VERSION}"
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

PLATFORMS=(
  "linux/amd64"
  "linux/arm64"
  "darwin/amd64"
  "darwin/arm64"
  "windows/amd64"
)

for PLATFORM in "${PLATFORMS[@]}"; do
  IFS="/" read -r GOOS GOARCH <<< "$PLATFORM"
  OUTPUT_NAME="${PACKAGE_PREFIX}-${VERSION}-${GOOS}-${GOARCH}"

  echo "Building ${OUTPUT_NAME}..."

  cd server
  if [ "$GOOS" = "windows" ]; then
    CGO_ENABLED=0 GOOS=$GOOS GOARCH=$GOARCH go build -ldflags "${LDFLAGS}" -o "${APP_NAME}.exe" .
  else
    CGO_ENABLED=0 GOOS=$GOOS GOARCH=$GOARCH go build -ldflags "${LDFLAGS}" -o "${APP_NAME}" .
  fi
  cd "$ROOT_DIR"

  mkdir -p "${BUILD_DIR}/${OUTPUT_NAME}"

  if [ "$GOOS" = "windows" ]; then
    cp "server/${APP_NAME}.exe" "${BUILD_DIR}/${OUTPUT_NAME}/${APP_NAME}.exe"
    rm "server/${APP_NAME}.exe"
  else
    cp "server/${APP_NAME}" "${BUILD_DIR}/${OUTPUT_NAME}/${APP_NAME}"
    rm "server/${APP_NAME}"
  fi

  # 游戏静态资源随包分发
  cp -r web "${BUILD_DIR}/${OUTPUT_NAME}/web"
  find "${BUILD_DIR}/${OUTPUT_NAME}" -name '.DS_Store' -delete

  cd "${ROOT_DIR}/${BUILD_DIR}"
  if [ "$GOOS" = "windows" ]; then
    zip -qr "${OUTPUT_NAME}.zip" "${OUTPUT_NAME}"
  else
    tar czf "${OUTPUT_NAME}.tar.gz" "${OUTPUT_NAME}"
  fi
  cd "$ROOT_DIR"

  rm -rf "${BUILD_DIR}/${OUTPUT_NAME}"

  echo "Built ${OUTPUT_NAME}"
done

# 截图与更新日志随发行目录分发，版本目录自包含
if [ -d docs/screenshots ]; then
  mkdir -p "${BUILD_DIR}/screenshots"
  cp docs/screenshots/*.png "${BUILD_DIR}/screenshots/"
  (cd "${BUILD_DIR}" && zip -qr "screenshots-${VERSION}.zip" screenshots)
  echo "Copied screenshots and screenshots-${VERSION}.zip"
fi
[ -f CHANGELOG.md ] && cp CHANGELOG.md "${BUILD_DIR}/CHANGELOG.md"

# 部署 compose 文件随发行产物分发；版本文件中的镜像 tag 替换为当前版本，
# 拷贝到目标主机后 docker compose up -d 即可运行；latest 文件原样分发。
sed "s|techfunways/${APP_NAME}:latest|techfunways/${APP_NAME}:${VERSION}|" deploy/docker-compose.yml > "${BUILD_DIR}/docker-compose.yml"
cp deploy/docker-compose.latest.yml "${BUILD_DIR}/docker-compose.latest.yml"
echo "Copied docker-compose.yml and docker-compose.latest.yml"

echo "All builds completed in ${BUILD_DIR}/"
