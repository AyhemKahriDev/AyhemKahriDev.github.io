#!/bin/bash
# 多架构 Docker 镜像构建并推送：linux/amd64 + linux/arm64 合并为单一 tag 的
# OCI manifest list，docker pull 时按目标机器架构自动选择，无需区分平台后缀。
#
# 首选路径：docker-container 构建器一次构建双平台 --push（镜像仓库只有版本 tag 本身）；
# 首选路径不可用（弱网拉不动 BuildKit、或 buildkit 的 oauth 请求不走代理被墙）时，
# 自动回退为完全离线的确定性管线：
#   宿主机交叉编译 → Dockerfile.local 离线构建（本地 alpine 基础镜像）
#   → docker push（dockerd 通道）→ imagetools create 合并；
#   imagetools 也被墙时走容器内 manifest-merge.go（经 OrbStack 内置代理访问 registry API）。
# 回退路径会在 Docker Hub 留下 <VERSION>-amd64 / <VERSION>-arm64 两个架构 tag
# （合并后的清单按 digest 引用，这两个 tag 可在 Hub 上手动删除，不影响拉取）。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE="techfunways/brick-game"
VERSION="$(cat VERSION | tr -d '\n')"
BUILD_TIME=$(date +%Y-%m-%dT%H:%M:%S)
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
PLATFORMS="linux/amd64,linux/arm64"
BUILDER="multiarch"

ARGS=(--build-arg "VERSION=$VERSION" --build-arg "BUILD_TIME=$BUILD_TIME" --build-arg "GIT_COMMIT=$GIT_COMMIT")

echo "构建多架构镜像 ${IMAGE}:${VERSION} (${PLATFORMS})..."

# ── 首选：container 构建器一次构建双平台并推送 ──
if ! docker buildx inspect "$BUILDER" >/dev/null 2>&1; then
  docker buildx create --name "$BUILDER" --driver docker-container >/dev/null
fi
if BUILDX_BUILDER="$BUILDER" docker buildx inspect "$BUILDER" --bootstrap >/dev/null 2>&1; then
  if BUILDX_BUILDER="$BUILDER" docker buildx build --platform "$PLATFORMS" "${ARGS[@]}" \
      -t "$IMAGE:$VERSION" -t "$IMAGE:latest" --push .; then
    echo "完成（单 tag 多架构）：$IMAGE:$VERSION 与 $IMAGE:latest"
    exit 0
  fi
fi

# ── 回退：宿主机交叉编译 + 离线镜像构建 + daemon push + 容器内合并 ──
# 完全绕开 buildkit（其 oauth token 请求不走代理，弱网必挂）：
#   1. 宿主机 Go 交叉编译 linux 二进制（不依赖容器网络）
#   2. Dockerfile.local 离线构建（本地 alpine:3.21 基础镜像 + --pull=false --network=none）
#   3. docker push 走 dockerd 通道（OrbStack 下有内置代理兜底）
#   4. manifest 合并优先 imagetools，被墙时走容器内 manifest-merge.go（OrbStack 代理）
echo "回退：宿主机交叉编译 + 离线构建（不依赖 buildkit/registry 网络）..."
if ! docker image inspect alpine:3.21 >/dev/null 2>&1; then
  echo "错误：本地缺少 alpine:3.21 基础镜像，请先 docker pull alpine:3.21（或换可用网络）" >&2
  exit 1
fi
if [ ! -f /etc/ssl/cert.pem ]; then
  echo "错误：缺少宿主机 CA 证书 /etc/ssl/cert.pem" >&2
  exit 1
fi

for ARCH in amd64 arm64; do
  echo "交叉编译 linux/$ARCH 并离线构建镜像..."
  CTX=".docker-build-$ARCH"
  rm -rf "$CTX"
  mkdir -p "$CTX"
  (cd server && CGO_ENABLED=0 GOOS=linux GOARCH=$ARCH go build \
    -ldflags "-X main.Version=$VERSION -X main.BuildTime=$BUILD_TIME -X main.GitCommit=$GIT_COMMIT -X main.AppName=brick-game" \
    -o "../$CTX/brick-game-bin" .)
  chmod +x "$CTX/brick-game-bin"
  cp -r web "$CTX/web"
  cp /etc/ssl/cert.pem "$CTX/ca-certificates.crt"
  find "$CTX" -name '.DS_Store' -delete
  DOCKER_BUILDKIT=0 docker build --pull=false --network=none \
    -f Dockerfile.local -t "$IMAGE:$VERSION-$ARCH" "$CTX"
  rm -rf "$CTX"

  # 传统构建器按构建机架构（arm64）给镜像 config 盖章，交叉编译的 amd64 镜像
  # 需要把 config 里的 architecture 修正为目标架构（save → 编辑 → load）
  if [ "$ARCH" != "$(docker version --format '{{.Server.Arch}}' | sed 's|x86_64|amd64|;s|aarch64|arm64|')" ]; then
    echo "修正镜像 config architecture → $ARCH ..."
    FIX_DIR="$(mktemp -d)"
    mkdir "$FIX_DIR/x"
    docker save "$IMAGE:$VERSION-$ARCH" -o "$FIX_DIR/img.tar"
    tar -xf "$FIX_DIR/img.tar" -C "$FIX_DIR/x"
    CFG_FILE=$(python3 -c "import json;print(json.load(open('$FIX_DIR/x/manifest.json'))[0]['Config'])")
    python3 - "$FIX_DIR/x/$CFG_FILE" "$ARCH" <<'PY'
import json, os, sys
path, arch = sys.argv[1], sys.argv[2]
os.chmod(path, 0o644)  # docker save 导出的 config 文件是只读的
d = json.load(open(path))
d["architecture"] = arch
d["os"] = "linux"
json.dump(d, open(path, "w"))
PY
    tar -cf "$FIX_DIR/img-fixed.tar" -C "$FIX_DIR/x" .
    docker load -i "$FIX_DIR/img-fixed.tar"
    rm -rf "$FIX_DIR"
  fi

  for i in 1 2 3 4 5; do
    if docker push "$IMAGE:$VERSION-$ARCH"; then break; fi
    echo "  推送失败，重试 $i/5 ..."; sleep 10
  done
done

MERGE_OK=0
for i in 1 2 3 4 5; do
  if docker buildx imagetools create -t "$IMAGE:$VERSION" -t "$IMAGE:latest" \
      "$IMAGE:$VERSION-amd64" "$IMAGE:$VERSION-arm64"; then MERGE_OK=1; break; fi
  echo "  合并失败，重试 $i/5 ..."; sleep 15
done

# imagetools 走不通时（本机到 registry 的 DNS/链路被污染，如国内网络直连 docker.io），
# 改走容器内合并工具 scripts/manifest-merge.go：
#   - 凭据从 macOS 钥匙串（docker-credential-osxkeychain）读取，也可用 DH_USER/DH_PASS 环境变量；
#   - 若环境里能解析 proxy.orb.internal（OrbStack 内置代理，dockerd 同款通道），自动经代理访问 registry API。
if [ "$MERGE_OK" != "1" ]; then
  echo "回退：容器内 manifest 合并（经 OrbStack 内置代理）..."
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  ENV_FILE="$(mktemp)"
  chmod 600 "$ENV_FILE"
  if [ -n "${DH_USER:-}" ] && [ -n "${DH_PASS:-}" ]; then
    printf 'DH_USER=%s\nDH_PASS=%s\n' "$DH_USER" "$DH_PASS" > "$ENV_FILE"
  elif command -v docker-credential-osxkeychain >/dev/null 2>&1; then
    printf 'https://index.docker.io/v1/' | docker-credential-osxkeychain get > "${ENV_FILE}.json"
    python3 -c "
import json
d = json.load(open('${ENV_FILE}.json'))
open('${ENV_FILE}', 'w').write(f'DH_USER={d[\"Username\"]}\nDH_PASS={d[\"Secret\"]}\n')
"
    rm -f "${ENV_FILE}.json"
  else
    echo "错误：无法获取 Docker Hub 凭据（需要 docker-credential-osxkeychain 或 DH_USER/DH_PASS）" >&2
    exit 1
  fi
  MERGE_TOOL_OK=0
  for i in 1 2 3; do
    if docker run --rm -v "$SCRIPT_DIR":/tools -w /tools --env-file "$ENV_FILE" \
        -e REPO="$IMAGE" -e VERSION="$VERSION" \
        -e https_proxy=http://proxy.orb.internal:8305 -e HTTPS_PROXY=http://proxy.orb.internal:8305 \
        golang:1.26-alpine go run manifest-merge.go; then
      MERGE_TOOL_OK=1
      break
    fi
    echo "  容器内合并失败，重试 $i/3 ..."; sleep 10
  done
  if [ "$MERGE_TOOL_OK" = "1" ]; then
    MERGE_OK=1
  fi
  rm -f "$ENV_FILE"
fi

if [ "$MERGE_OK" != "1" ]; then
  echo "错误：manifest 合并失败（网络不通）。两个架构镜像已推送，可稍后手动合并：" >&2
  echo "  docker buildx imagetools create -t $IMAGE:$VERSION -t $IMAGE:latest $IMAGE:$VERSION-amd64 $IMAGE:$VERSION-arm64" >&2
  exit 1
fi

echo "完成（回退路径）：$IMAGE:$VERSION 与 $IMAGE:latest（另有 $VERSION-amd64/-arm64 架构 tag 可在 Hub 删除）"
