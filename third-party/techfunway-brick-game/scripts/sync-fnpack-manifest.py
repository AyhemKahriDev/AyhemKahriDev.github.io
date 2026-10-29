#!/usr/bin/env python3
"""把 VERSION 与 CHANGELOG.md 同步进飞牛包模板 fnpack/manifest。

manifest 里 version 与 changelog 是「随版本发布变化」的字段，靠手工维护必然
漂移（曾经停在 v0.4.5，打出的 .fpk 更新日志也跟着过期）。这里统一以 VERSION
文件与 CHANGELOG.md 为唯一来源重写这两个字段：

- version 取自 VERSION 文件（去掉 v 前缀）；
- changelog 只保留当前版本那一节，版本号后不带日期，不累积历史版本条目；
  CHANGELOG.md 里还没有当前版本时留空（首次发版）。

其余字段（desc/端口/维护者等）仍由人工维护。

用法：
    python3 scripts/sync-fnpack-manifest.py          # 就地同步
    python3 scripts/sync-fnpack-manifest.py --check  # 只校验，落后则非 0 退出
"""

import argparse
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT_DIR / "VERSION"
CHANGELOG_FILE = ROOT_DIR / "CHANGELOG.md"
MANIFEST_FILE = ROOT_DIR / "fnpack" / "manifest"

# changelog 字段既可能是三引号多行块，也可能是单行或空值，两种写法都要能替换
CHANGELOG_VALUE = re.compile(r'^(changelog\s*)=[ \t]*""".*?^"""', re.M | re.S)
CHANGELOG_LINE = re.compile(r"^(changelog\s*)=.*$", re.M)


def bare_version(text):
    return text[1:] if text.startswith("v") else text


def heading_version(heading):
    """从 `## v0.5.2（2026-09-13）` 取出版本号 `v0.5.2`。"""
    return heading.split("（")[0].split()[0].strip()


def changelog_body(changelog_md, version):
    """取 CHANGELOG.md 里当前版本那一节，转成 manifest 的 changelog 正文。

    只保留当前版本：`## v0.1.0（2026-09-13）` → `v0.1.0：`，不带日期，
    不带其它历史版本条目；CHANGELOG.md 里没有当前版本时返回空串。
    """
    matched = None
    items = []
    for raw in changelog_md.splitlines():
        line = raw.rstrip()
        if line.startswith("## "):
            if matched is not None:
                break
            candidate = heading_version(line[3:].strip())
            if bare_version(candidate) == bare_version(version):
                matched = candidate
            continue
        if matched is not None and line.strip():
            items.append(line)
    if matched is None:
        return ""
    body = "\n".join([f"{matched}："] + items)
    if '"""' in body:
        raise SystemExit('CHANGELOG 正文包含 """，无法写入 manifest 的三引号字段')
    return body


def rewrite(manifest, pkg_version, body):
    """替换 manifest 的 version 与 changelog 字段，保留原字段对齐与其余内容。"""
    text, count = re.subn(
        r"^(version\s*)=.*$",
        lambda m: f"{m.group(1)}= {pkg_version}",
        manifest,
        count=1,
        flags=re.M,
    )
    if count != 1:
        raise SystemExit("fnpack/manifest 里没有找到 version 字段")

    value = f'"""\n{body}\n"""' if body else '""'
    text, count = CHANGELOG_VALUE.subn(lambda m: f"{m.group(1)}= {value}", text, count=1)
    if count != 1:
        text, count = CHANGELOG_LINE.subn(lambda m: f"{m.group(1)}= {value}", text, count=1)
    if count != 1:
        raise SystemExit("fnpack/manifest 里没有找到 changelog 字段")

    return text


def main():
    parser = argparse.ArgumentParser(description="同步 fnpack/manifest 的版本号与更新日志")
    parser.add_argument("--check", action="store_true", help="只校验是否已同步，不写入")
    args = parser.parse_args()

    version = VERSION_FILE.read_text(encoding="utf-8").strip()
    if not version:
        raise SystemExit("VERSION 文件为空")
    pkg_version = version[1:] if version.startswith("v") else version

    manifest = MANIFEST_FILE.read_text(encoding="utf-8")
    body = changelog_body(CHANGELOG_FILE.read_text(encoding="utf-8"), version)
    updated = rewrite(manifest, pkg_version, body)

    if updated == manifest:
        print(f"fnpack/manifest 已是最新（version={pkg_version}，changelog={'留空' if not body else '仅当前版本'}）")
        return 0

    if args.check:
        print(
            f"fnpack/manifest 落后于 VERSION/CHANGELOG.md（应为 version={pkg_version}），"
            f"请运行 python3 scripts/sync-fnpack-manifest.py",
            file=sys.stderr,
        )
        return 1

    MANIFEST_FILE.write_text(updated, encoding="utf-8")
    if body:
        print(f"已同步 fnpack/manifest（version={pkg_version}，changelog 只取当前版本 {version}）")
    else:
        print(f"已同步 fnpack/manifest（version={pkg_version}，CHANGELOG.md 里没有 {version} 一节，changelog 留空）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
