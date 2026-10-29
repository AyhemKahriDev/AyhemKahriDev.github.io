#!/usr/bin/env bash
# 把当前代码以「单条发版提交」的快照形式发布到 GitHub 开源仓库。
#
# 用法（Gitea 仓库根目录执行）：
#   export GH_TOKEN=<GitHub Personal access token>
#   bash scripts/publish-github.sh --release             # 备注正文自动取 release/<版本>/CHANGELOG.md
#   bash scripts/publish-github.sh --release "附加说明"   # 在自动正文后追加一段话
#
# 约定见 AGENTS.md「GitHub 开源发版流程」：
#   - GitHub（TechFunWay/brick-game）是对外发布镜像，与内部仓库无任何 git 关联；
#   - GitHub 仓库历史只有发版提交，每次发版落一条「发版：v<版本>」快照并打同号 tag；
#   - 备注只写应用本身的更新信息，不写工程过程。

set -euo pipefail

ROOT_DIR="$(pwd)"
GITHUB_DIR="${GITHUB_DIR:-$HOME/develop/github/TechFunWay/brick-game}"
: "${GH_TOKEN:?请先 export GH_TOKEN=<GitHub Personal access token>}"

DO_RELEASE=false
EXTRA_NOTE=""
if [[ "${1:-}" == "--release" ]]; then
  DO_RELEASE=true
  EXTRA_NOTE="${2:-}"
else
  echo "用法：bash scripts/publish-github.sh --release [附加说明]" >&2
  exit 1
fi

VERSION="$(tr -d ' \n' < "$ROOT_DIR/VERSION")"
RELEASE_DIR="$ROOT_DIR/release/$VERSION"
GH_REPO="TechFunWay/brick-game"

echo "==> 版本：$VERSION"
echo "==> 内部仓库：$ROOT_DIR"
echo "==> GitHub 镜像：$GITHUB_DIR"

[[ -d "$GITHUB_DIR/.git" ]] || { echo "错误：GitHub 镜像目录不存在：$GITHUB_DIR" >&2; exit 1; }
[[ -d "$RELEASE_DIR" ]] || { echo "错误：缺少产物目录 $RELEASE_DIR，先执行 make build-all && make fnpack" >&2; exit 1; }

# ── 1) 组装发版备注（只写应用更新信息）──────────────────────────────
NOTES_FILE="$(mktemp)"
if [[ -f "$RELEASE_DIR/CHANGELOG.md" ]]; then
  # 去掉 CHANGELOG 的主标题行（# 更新日志 · …），保留版本条目正文
  tail -n +2 "$RELEASE_DIR/CHANGELOG.md" | sed '/./,$!d' > "$NOTES_FILE"
else
  printf '方块游戏机 %s 发行版。\n' "$VERSION" > "$NOTES_FILE"
fi
if [[ -n "$EXTRA_NOTE" ]]; then
  printf '\n%s\n' "$EXTRA_NOTE" >> "$NOTES_FILE"
fi

COMMIT_MSG="$(mktemp)"
{
  printf '发版：%s\n\n' "$VERSION"
  cat "$NOTES_FILE"
} > "$COMMIT_MSG"

# ── 2) 在镜像目录生成单条发版快照提交 ─────────────────────────────
# 镜像目录当前 HEAD 之上的工作区完全由内部仓库当前内容覆盖后提交一次；
# 历史（上一条发版提交）原样保留，与内部仓库无 git 关联。
cd "$GITHUB_DIR"
git fetch origin --force
git checkout -q main
git reset -q --hard origin/main 2>/dev/null || true

echo "==> 用内部仓库内容覆盖镜像工作区（剔除镜像专属/对外不发布内容）"
# 镜像目录专属文件（GitHub Actions 等对外设施）不被内部仓库内容清掉
MIRROR_KEEP=(".github")
# 对外不发布：发版产物（仅经 Release 附件分发）与 AI 助手相关文件
INTERNAL_ONLY=("release" "AGENTS.md" ".workbuddy")
rsync -a --delete \
  $(for f in "${MIRROR_KEEP[@]}"; do printf -- "--exclude=%s/ " "$f"; done) \
  $(for f in "${INTERNAL_ONLY[@]}"; do printf -- "--exclude=%s/ " "$f"; done) \
  --exclude=.git/ "$ROOT_DIR/" ./
rm -f .DS_Store AGENTS.md
find release -name .DS_Store -delete 2>/dev/null || true
rm -rf release .workbuddy

# 镜像仓库忽略清单：发版产物与 AI 相关文件永不入库（产物经 Release 附件分发）
cat > .gitignore <<'EOF'
# 构建产物
brick-game
release/
server/brick-game

# AI 助手
AGENTS.md
.workbuddy/

# 杂项
.idea/
.DS_Store
node_modules/
*.log
EOF

git add -A
LAST_MSG="$(git log -1 --format=%s 2>/dev/null || true)"
if git diff --cached --quiet HEAD 2>/dev/null; then
  echo "==> 内容无变化，跳过新提交（沿用上一条发版提交）"
  AMENDED=false
elif [[ "$LAST_MSG" == "发版：$VERSION"* ]]; then
  # 同一版本重复发布：修订上一条发版提交，保证一个版本只占一条历史。
  # 快照模式下 HEAD 总是根提交，amend 即重写唯一提交，推送必须 --force
  git commit -q --amend -F "$COMMIT_MSG"
  AMENDED=true
  echo "==> 已修订同版本发版提交：$(git log --oneline -1)"
else
  git commit -q -F "$COMMIT_MSG"
  AMENDED=false
  echo "==> 已创建发版提交：$(git log --oneline -1)"
fi

# ── 3) 推送 main + tag ────────────────────────────────────────────
PUSH_FORCE=()
[[ "${AMENDED:-false}" == true ]] && PUSH_FORCE=(--force)
git push "${PUSH_FORCE[@]}" -q origin main
if git rev-parse -q --verify "refs/tags/$VERSION" >/dev/null; then
  git tag -f "$VERSION" -m "方块游戏机 $VERSION" && git push -q --force origin "refs/tags/$VERSION"
else
  git tag "$VERSION" -m "方块游戏机 $VERSION" && git push -q origin "refs/tags/$VERSION"
fi
echo "==> 已推送 main 与 tag $VERSION"

# ── 4) 创建 / 更新 GitHub Release 并上传产物 ──────────────────────
echo "==> 创建 GitHub Release $VERSION"
gh release create "$VERSION" --repo "$GH_REPO" \
  --title "方块游戏机 $VERSION" \
  --notes-file "$NOTES_FILE" 2>/dev/null \
|| gh release edit "$VERSION" --repo "$GH_REPO" --notes-file "$NOTES_FILE"

find "$RELEASE_DIR" -name .DS_Store -delete 2>/dev/null || true
gh release upload "$VERSION" --repo "$GH_REPO" --clobber \
  "$RELEASE_DIR"/*.tar.gz "$RELEASE_DIR"/*.zip "$RELEASE_DIR"/*.fpk \
  "$RELEASE_DIR"/docker-compose*.yml "$RELEASE_DIR"/screenshots-*.zip 2>/dev/null || true

rm -f "$NOTES_FILE" "$COMMIT_MSG"
echo "==> 完成：https://github.com/$GH_REPO/releases/tag/$VERSION"
