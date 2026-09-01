---
name: lilac/nvchecker-config
description: 在 lilac.yaml 的 update_on 部分中配置 nvchecker 源、为不同上游源选择版本检查器或解决版本检测问题时
---

# Lilac nvchecker 配置

## 概述

nvchecker（新版本检查器）监控上游软件源并在新版本发布时检测。在 lilac 中，它通过 `lilac.yaml` 中的 `update_on` 字段配置。`update_on` 中的每个条目指定一个源类型（GitHub、PyPI、AUR 等）及其参数。

**关键原则：** 第一个 `update_on` 条目检查版本更新。额外的条目在依赖项更改时触发重建。

## 何时使用

在以下情况使用本技能：
- 配置 lilac 如何检测上游更新
- 为软件包选择正确的源类型
- 版本检测失败或返回错误版本
- 需要过滤或转换版本字符串
- 为依赖项更改设置重建触发器

**前置要求：** 有效的 PKGBUILD 和 lilac.yaml。在配置版本源之前，使用 `archlinux-pkgbuild` 创建和验证 PKGBUILD。

## 快速参考

### 常见源类型

| 源 | 用于 | 关键选项 |
|------|---------|------------|
| `github` | GitHub 仓库 | `github: owner/repo` |
| `aur` | AUR 软件包 | `aur: pkgname` |
| `pypi` | Python 软件包 | `pypi: pkgname` |
| `archpkg` | Arch 官方软件包 | `archpkg: pkgname` |
| `regex` | 网页抓取 | `url` + `regex` |
| `manual` | 手动版本控制 | `manual: version` |
| `cmd` | 自定义命令 | `cmd: command` |

### 版本选择策略

| 策略 | 选项 | 何时使用 |
|----------|--------|-------------|
| 最新标签 | `use_max_tag: true` | 软件使用 git 标签发布 |
| 最新发布版 | `use_latest_release: true` | 带说明的 GitHub 发布版 |
| 最新提交 | （默认，无选项） | VCS 软件包（基于日期） |
| 特定分支 | `branch: main` | 跟踪非默认分支 |

## 配置格式

### 基本 GitHub 标签

```yaml
update_on:
  - source: github
    github: neovim/neovim
    use_max_tag: true
```

### GitHub 发布版（非标签）

```yaml
update_on:
  - source: github
    github: microsoft/vscode
    use_latest_release: true
```

### AUR 软件包

```yaml
update_on:
  - source: aur
    aur: firefox-nightly  # 如果省略则默认为软件包名称
```

### PyPI 软件包

```yaml
update_on:
  - source: pypi
    pypi: requests
```

### 网页（正则表达式）

```yaml
update_on:
  - source: regex
    url: https://example.com/download.html
    regex: 'version ([\d.]+)'
```

### Arch Linux 官方软件包

```yaml
update_on:
  - source: archpkg
    archpkg: python
    strip_release: true  # 获取 3.11.0 而不是 3.11.0-1
```

### 多源（更新 + 重建）

```yaml
update_on:
  # 主要：检查上游新版本
  - source: github
    github: myapp/myapp
    use_max_tag: true
  
  # 次要：依赖项更新时重建
  - source: archpkg
    archpkg: python
```

## 源类型详解

### GitHub

```yaml
update_on:
  - source: github
    github: owner/repo
    # 版本策略（选择一个）：
    use_max_tag: true           # 最新 git 标签
    use_latest_release: true    # 最新 GitHub 发布版
    use_max_release: true       # 最高版本发布版
    use_latest_tag: true        # 最新标签（需要 token）
    # 选项：
    branch: master              # 跟踪特定分支（基于日期）
    path: src/version.h         # 仅接触此文件的提交
    host: github.mycompany.com  # GitHub Enterprise
    include_prereleases: true   # 包含 alpha/beta/rc
    # 认证：
    token: ghp_xxx              # 或使用密钥文件 ~/.lilac/nvchecker_keyfile.toml
```

**GitHub token 的密钥文件：**
```toml
# ~/.lilac/nvchecker_keyfile.toml
[keys]
github = "ghp_your_token_here"
```

### GitLab / Gitea / BitBucket

与 GitHub 选项相同，只需更改 `source`：

```yaml
update_on:
  - source: gitlab
    gitlab: group/project
    use_max_tag: true
    host: gitlab.mycompany.com
  
  - source: gitea
    gitea: owner/repo
    host: codeberg.org  # 用于 Codeberg/Forgejo
```

### AUR

```yaml
update_on:
  - source: aur
    aur: pkgname  # 如果省略则默认为软件包名称
    strip_release: true      # 移除 -1, -2 后缀
    use_last_modified: true  # 追加修改时间
```

### PyPI

```yaml
update_on:
  - source: pypi
    pypi: package-name
    use_pre_release: false   # 设置为 true 以获取 alpha/beta
```

### Arch Linux 软件包

```yaml
update_on:
  - source: archpkg
    archpkg: python
    strip_release: true
    provided: libpython       # 检查 provides 而不是 pkgver
  
  - source: alpm              # 本地 pacman 数据库
    alpm: python
    repos: [core, extra]
```

### 正则表达式（网页抓取）

```yaml
update_on:
  - source: regex
    url: https://www.kernel.org/
    regex: 'latest stable version: <strong>([\d.]+)</strong>'
    encoding: utf-8
    # 用于 POST 请求：
    post_data: "param=value"
    post_data_type: "application/x-www-form-urlencoded"
```

### JSON (jq)

```yaml
update_on:
  - source: jq
    url: https://api.example.com/versions
    filter: '.latest.version'
```

### 命令

```yaml
update_on:
  - source: cmd
    cmd: curl -s https://api.github.com/repos/owner/repo/releases/latest | jq -r .tag_name
```

### 手动

```yaml
update_on:
  - source: manual
    manual: 2.5.1  # 仅在你更改此值时更新
```

### 容器注册表

```yaml
update_on:
  - source: container
    container: library/python  # Docker Hub 官方镜像
    registry: docker.io        # 或 quay.io, ghcr.io 等
    # 检查特定标签的更新时间：
    container: library/python:3.11
```

### 其他软件包注册表

```yaml
update_on:
  # npm/JavaScript
  - source: npm
    npm: lodash
  
  # Ruby Gems
  - source: gems
    gems: rails
  
  # Rust crates.io
  - source: cratesio
    cratesio: tokio
  
  # Go 模块
  - source: go
    go: github.com/caddyserver/caddy/v2
  
  # Maven
  - source: maven
    group: org.apache.maven
    artifact: maven-core
```

## 版本过滤

### 包含/排除模式

```yaml
update_on:
  - source: github
    github: kubernetes/kubernetes
    use_max_tag: true
    # 仅考虑匹配此模式的版本
    include_regex: 'v[\d.]+$'      # v1.2.3 但不包括 v1.2.3-rc1
    # 排除特定模式
    exclude_regex: 'v1\.20\..*'    # 跳过 1.20.x 系列
    # 忽略特定版本
    ignored: 'v1.0.0 v1.0.1'        # 空格分隔的列表
```

### 版本转换

```yaml
update_on:
  - source: github
    github: nodejs/node
    use_max_tag: true
    prefix: v              # 去除 'v' 前缀：v18.0.0 -> 18.0.0
    # 或使用正则替换：
    from_pattern: 'v([\d.]+)-(.*)'
    to_pattern: '\1.\2'   # v18.0.0-rc.1 -> 18.0.0.rc.1
```

### 排序方法

```yaml
update_on:
  - source: github
    github: some/repo
    use_max_tag: true
    sort_version_key: vercmp  # 选项：parse_version, vercmp, awesomeversion
```

## 高级选项

### 节流

防止频繁更新的 VCS 软件包过度重建：

```yaml
update_on:
  - source: github
    github: neovim/neovim
    branch: master
    lilac_throttle: 1d    # 每天最多重建一次
    # 或：6h, 12h, 1w 等
```

### 别名（重用配置）

定义通用配置一次，用别名重用：

```yaml
update_on:
  - alias: github-latest
    source: github
    github: owner/repo
    use_max_tag: true

  # 在另一个软件包的 lilac.yaml 中：
  - source: alias
    alias: github-latest
```

### 网络选项

```yaml
update_on:
  - source: github
    github: private/repo
    # 代理
    proxy: http://localhost:8080
    # 失败时重试
    tries: 3
    # 超时
    http_timeout: 30
    # 禁用证书验证（不推荐）
    verify_cert: false
    # 自定义 User Agent
    user_agent: "MyBot/1.0"
    # Bearer token
    httptoken: "Bearer token_here"
```

## 常见模式

### VCS 软件包（每日检查）

```yaml
update_on:
  - source: github
    github: neovim/neovim
    branch: master
    lilac_throttle: 1d
```

### 稳定发布版（标签）

```yaml
update_on:
  - source: github
    github: git/git
    use_max_tag: true
    include_regex: 'v[\d.]+$'  # 排除 -rc 版本
```

### 依赖更新时重建

```yaml
update_on:
  # 检查上游
  - source: github
    github: myapp/myapp
    use_max_tag: true
  # Python 更新时重建
  - source: archpkg
    archpkg: python
```

### 使用 update_on_build

同一仓库中的其他软件包构建时重建：

```yaml
update_on:
  - source: github
    github: owner/app
    use_max_tag: true

update_on_build:
  - pkgbase: libapp  # libapp 构建时重建此软件包

repo_depends:
  - libapp  # 也必须在此处列出
```

### 多 Git 源（组合器）

```yaml
update_on:
  - source: github
    github: project/subproject1
  - source: github
    github: project/subproject2
```

## 故障排除

### 版本未检测到

```bash
# 手动测试 nvchecker
cd ~/.lilac
nvchecker -c nvchecker.toml -n packagename

# 启用详细日志
nvchecker -c nvchecker.toml -l debug

# 检查 nvchecker 看到的内容
cat new_ver.json | jq
```

### 检测到错误版本

1. 检查 `include_regex` / `exclude_regex`
2. 验证 `sort_version_key` 设置
3. 检查 `ignored` 版本
4. 查看 `from_pattern` / `to_pattern` 转换

### GitHub 速率限制

```bash
# 错误：超出 API 速率限制
# 解决方案：在密钥文件中配置 GitHub token
echo '[keys]' > ~/.lilac/nvchecker_keyfile.toml
echo 'github = "ghp_your_token"' >> ~/.lilac/nvchecker_keyfile.toml
```

### 版本格式不匹配

当上游使用非标准版本控制时：

```yaml
update_on:
  - source: github
    github: weird/project
    use_max_tag: true
    # 将 v2023-04-01 转换为 2023.04.01
    from_pattern: 'v(\d{4})-(\d{2})-(\d{2})'
    to_pattern: '\1.\2.\3'
```

## 完整示例

### 桌面应用程序

```yaml
maintainers:
  - github: yourname

build_prefix: extra-x86_64

update_on:
  - source: github
    github: kovidgoyal/kitty
    use_latest_release: true
    include_regex: 'v[\d.]+$'
```

### 多依赖库

```yaml
maintainers:
  - github: yourname

build_prefix: extra-x86_64

update_on:
  - source: github
    github: awesome/libawesome
    use_max_tag: true
  - source: archpkg
    archpkg: glibc
  - source: archpkg
    archpkg: gcc

repo_depends:
  - libdependency
```

### 网页抓取软件包

```yaml
maintainers:
  - github: yourname

build_prefix: extra-x86_64

update_on:
  - source: regex
    url: https://www.oracle.com/java/technologies/downloads/
    regex: 'JDK (\d+\.\d+\.\d+)'
    user_agent: "Mozilla/5.0"
```

## 从旧版 nvchecker 迁移

nvchecker 2.x 使用 TOML 格式（不是 INI）。转换旧配置：

```bash
# 从旧格式转换
nvchecker-ini2toml old_config.ini > new_config.toml
```

关键变更：
- `source = github` 而不是自动检测
- `use_max_tag` 而不是 `include_tags_pattern`
- JSON 版本文件而不是自定义格式
