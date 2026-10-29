#!/bin/bash
# 构建飞牛 fnOS 安装包（双架构）—— brick-game 为纯静态应用，无需 CGO/Docker 交叉编译
# 产物：release/<version>/techfunway-brick-game_<version>_<arch>.fpk
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME=$(python3 -c "import json; print(json.load(open('app.json'))['appname'])")
FNOS_PKG_NAME=$(awk -F'=' '/^appname/ {gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2}' fnpack/manifest)
VERSION=$(cat VERSION | tr -d '\n')
BUILD_TIME=$(date +%Y-%m-%dT%H:%M:%S)
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
LDFLAGS="-X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME} -X main.GitCommit=${GIT_COMMIT} -X main.AppName=${APP_NAME}"

# manifest 的 version 与 changelog 以 VERSION / CHANGELOG.md 为唯一来源，打包前同步进模板
python3 scripts/sync-fnpack-manifest.py

# fnpack CLI
if ! command -v fnpack &>/dev/null; then
  for c in "$HOME/tmp/fnpack" "/tmp/fnpack" "/usr/local/bin/fnpack"; do
    [ -x "$c" ] && FNPACK="$c" && break
  done
  if [ -z "$FNPACK" ]; then
    ARCH=$(uname -m); OS=$(uname -s)
    case "$OS-$ARCH" in
      Darwin-arm64) DL=fnpack-1.2.3-darwin-arm64 ;;
      Darwin-x86_64) DL=fnpack-1.2.3-darwin-amd64 ;;
      Linux-x86_64) DL=fnpack-1.2.3-linux-amd64 ;;
      Linux-aarch64) DL=fnpack-1.2.3-linux-arm64 ;;
      *) echo "不支持的平台：$OS $ARCH"; exit 1 ;;
    esac
    FNPACK="/tmp/fnpack"
    curl -sSL -o "$FNPACK" "https://static2.fnnas.com/fnpack/$DL" && chmod +x "$FNPACK"
  fi
else
  FNPACK="fnpack"
fi

echo "编译 Go 服务端（amd64 + arm64）..."
mkdir -p release
(cd server && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "$LDFLAGS" -o ../release/brick-game-linux-amd64 .)
(cd server && CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags "$LDFLAGS" -o ../release/brick-game-linux-arm64 .)

BUILD_DIR="release/${VERSION}"
mkdir -p "${BUILD_DIR}"

# 截图与更新日志随发行目录分发（与 build-all.sh 保持一致，独立执行 fnpack 时也补齐）
if [ -d docs/screenshots ]; then
  mkdir -p "${BUILD_DIR}/screenshots"
  cp docs/screenshots/*.png "${BUILD_DIR}/screenshots/"
  (cd "${BUILD_DIR}" && zip -qr "screenshots-${VERSION}.zip" screenshots)
fi
[ -f CHANGELOG.md ] && cp CHANGELOG.md "${BUILD_DIR}/CHANGELOG.md"

for ARCH in amd64 arm64; do
  echo "=== 打包 ${ARCH} ==="
  BUILD_PACK="${BUILD_DIR}/pack_${ARCH}"
  rm -rf "${BUILD_PACK}"
  mkdir -p "${BUILD_PACK}/app/ui/images"

  # fpk 模板
  cp fnpack/manifest "${BUILD_PACK}/"
  cp -r fnpack/cmd "${BUILD_PACK}/"
  cp -r fnpack/config "${BUILD_PACK}/"
  cp -r fnpack/wizard "${BUILD_PACK}/"
  cp -r fnpack/app/ui/config "${BUILD_PACK}/app/ui/"
  cp fnpack/app/ui/images/* "${BUILD_PACK}/app/ui/images/"
  cp fnpack/ICON.PNG fnpack/ICON_256.PNG "${BUILD_PACK}/"

  # 二进制 + 静态资源（游戏本体放入 app/ui，运行时由 -web-dir 指向）
  cp "release/brick-game-linux-${ARCH}" "${BUILD_PACK}/app/brick-game"
  chmod +x "${BUILD_PACK}/app/brick-game"
  cp web/index.html web/manifest.json "${BUILD_PACK}/app/ui/"
  cp -r web/css web/js web/icons web/images "${BUILD_PACK}/app/ui/"

  # 版本号与更新日志已在打包前写入 fnpack/manifest，这里只按架构改 platform
  if [ "$ARCH" = "amd64" ]; then FNOS_PLATFORM="x86"; else FNOS_PLATFORM="arm"; fi
  sed "s/^platform.*/platform                   = ${FNOS_PLATFORM}/" fnpack/manifest > "${BUILD_PACK}/manifest.tmp"
  mv -f "${BUILD_PACK}/manifest.tmp" "${BUILD_PACK}/manifest"

  find "${BUILD_PACK}" -name '.DS_Store' -delete

  (cd "${BUILD_PACK}" && "$FNPACK" build)

  if [ -f "${BUILD_PACK}/${FNOS_PKG_NAME}.fpk" ]; then
    mv "${BUILD_PACK}/${FNOS_PKG_NAME}.fpk" "${BUILD_DIR}/${FNOS_PKG_NAME}_${VERSION}_${ARCH}.fpk"
  fi
  rm -rf "${BUILD_PACK}"
  echo "    → ${BUILD_DIR}/${FNOS_PKG_NAME}_${VERSION}_${ARCH}.fpk"
done
rm -f release/brick-game-linux-amd64 release/brick-game-linux-arm64

echo "完成：${BUILD_DIR}/"
