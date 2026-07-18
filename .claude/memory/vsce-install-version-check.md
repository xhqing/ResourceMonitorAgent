---
name: vsce-install-version-check
description: 安装项目 VSCE 最新版前，先核对 GitHub Release 版本号与本地 package.json 版本号是否一致
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 863d056f-0d81-4d20-a635-c6bb84ab19c7
  modified: 2026-07-18T12:12:28.679Z
---

用户让我帮忙安装某项目的 VSCE（VSCode 扩展）最新版时，**安装前必须先核对 GitHub Release 上的最新版版本号与项目本地目录记录的最新版本号是否一致**：

- **一致** → 直接从 GitHub Release 下载最新版 vsix 安装。
- **不一致** → 不直接安装，先排查原因（常见：忘了发版、发版失败、本地 `package.json` 版本号没跟上、或 Release 与本地代码不同步等）。

**Why:** 避免在「本地代码已是新版本但 Release 还停留在旧版」或「Release 发了但本地版本号没更新」这类不同步的情况下，盲目装到错误版本（旧版或与代码不符的版本）。先核对再装，保证装的就是项目当前真正对外发布的最新版。

**How to apply:** 两边取版本号比对——本地读项目根 `package.json` 的 `version` 字段；GitHub Release 用 `gh release view --json tagName -q .tagName`（或 `gh release list`）取最新 Release 的 tag（注意 tag 前缀若有 `v` 要一并比较或都去掉）。两边相等才算一致，才从 Release 装。相关流程见 [[commit-three-steps-one-command]]。
