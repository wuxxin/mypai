---
name: archlinux-pkgbuild/vcs-packages
description: 用于创建从开发源获取代码的 VCS PKGBUILD 文件（Git, SVN, CVS, Mercurial, Bazaar, Darcs） - 适用于以 -git, -svn, -cvs, -hg, -bzr, -darcs 结尾的包或需要 pkgver() 函数的情况
---

# Arch Linux VCS 软件包创建

## 概述

**VCS (版本控制系统) 软件包直接从源代码仓库获取开发版本。** 这些软件包会自动跟踪上游开发，并使用 pkgver() 函数生成版本字符串。

**核心原则：** VCS 软件包绝不应仅仅为了提升版本号而更新，只有在构建逻辑发生变化时才更新。pkgver() 函数会自动处理版本号。

## 何时使用

**在以下情况使用此子技能：**
- 创建跟踪开发版本的软件包
- 软件包名称以：-git, -svn, -cvs, -hg, -bzr, -darcs 结尾
- 源代码来自版本控制系统
- 需要实现 pkgver() 函数

**前提条件：** 先加载主技能 **archlinux-pkgbuild** 以获取核心工作流和验证功能。

## VCS 软件包通用规则

| 规则 | 描述 |
|------|-------------|
| **软件包命名** | 添加 VCS 后缀：-git, -svn, -cvs, -hg, -bzr, -darcs |
| **初始 pkgver** | 使用占位符（例如 r0.0.0） - pkgver() 会更新它 |
| **pkgver() 函数** | 必须实现 - 从 VCS 状态自动生成版本号 |
| **校验和** | VCS 源始终使用 `sha256sums=('SKIP')` |
| **makedepends** | 包含 VCS 工具（git, subversion, cvs, mercurial, bzr） |
| **provides/conflicts** | 通常为 provides=('pkgname') conflicts=('pkgname') |
| **更新频率** | 绝不因版本号提升而提交 - 仅在构建逻辑变更时提交 |

## Git 软件包

### Git 关键规则

| 规则 | 描述 |
|------|-------------|
| **后缀** | `-git` |
| **源格式** | `git+https://github.com/user/repo.git` 或 `git+https://...#branch=name` |
| **pkgver 格式** | `r123.abc1234`（提交数 + 短哈希）或来自标签的版本 |
| **makedepends** | `git` |
| **片段** | `#branch=name`, `#tag=tagname`, `#commit=hash` |

### Git 模板（基础）

```bash
pkgname=example-git
pkgver=r123.abc1234
pkgrel=1
pkgdesc="示例开发版本"
arch=('x86_64')
url="https://github.com/user/example"
license=('MIT')
depends=('glibc')
makedepends=('git')
provides=("example=${pkgver}")
conflicts=('example')
source=("git+https://github.com/user/example.git")
sha256sums=('SKIP')

pkgver() {
    cd "$srcdir/example"
    # 方法 1：提交数 + 短哈希（最常用）
    printf "r%s.%s" "$(git rev-list --count HEAD)" "$(git rev-parse --short HEAD)"
}

build() {
    cd "$srcdir/example"
    ./configure --prefix=/usr
    make
}

package() {
    cd "$srcdir/example"
    make DESTDIR="$pkgdir" install
    install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
}
```

### Git 模板（带标签）

```bash
pkgname=example-git
pkgver=2.1.0.r5.gabc1234
pkgrel=1
pkgdesc="来自带标签 Git 仓库的示例"
arch=('x86_64')
url="https://github.com/user/example"
license=('GPL')
depends=('lib1')
makedepends=('git')
provides=("example=${pkgver}")
conflicts=('example')
source=("example::git+https://github.com/user/example.git#branch=develop")
sha256sums=('SKIP')

pkgver() {
    cd "$srcdir/example"
    # 方法 2：git describe（用于带标签的仓库）
    git describe --long --tags | sed 's/^v//;s/\([^-]*-g\)/r\1/;s/-/./g'
    # 输出格式：2.1.0.r5.gabc1234 (tag.r<commits-since-tag>.g<hash>)
}

prepare() {
    cd "$srcdir/example"
    # 如有需要，应用补丁
    # patch -p1 < "$srcdir/fix.patch"
}

build() {
    cd "$srcdir/example"
    make
}

package() {
    cd "$srcdir/example"
    make DESTDIR="$pkgdir" install
}
```

### Git pkgver() 模式

**模式 1：提交数 + 短哈希（简单，无标签）：**
```bash
pkgver() {
    cd "$srcdir/reponame"
    printf "r%s.%s" "$(git rev-list --count HEAD)" "$(git rev-parse --short HEAD)"
}
# 输出：r456.abc1234
```

**模式 2：git describe（用于带版本标签的仓库）：**
```bash
pkgver() {
    cd "$srcdir/reponame"
    git describe --long --tags | sed 's/^v//;s/\([^-]*-g\)/r\1/;s/-/./g'
}
# 输出：2.1.0.r5.gabc1234
# 格式：<tag>.r<commits-since-tag>.g<hash>
```

**模式 3：带回退的 git describe（处理无标签仓库）：**
```bash
pkgver() {
    cd "$srcdir/reponame"
    git describe --long --tags 2>/dev/null | sed 's/^v//;s/\([^-]*-g\)/r\1/;s/-/./g' ||
        printf "r%s.%s" "$(git rev-list --count HEAD)" "$(git rev-parse --short HEAD)"
}
```

**模式 4：来自 git describe 的显式版本：**
```bash
pkgver() {
    cd "$srcdir/reponame"
    git describe --tags --abbrev=0 | sed 's/^v//'
}
# 输出：1.2.3（仅最新标签，无提交信息）
```

### Git 源 URL 片段

**支持的片段：**

| 片段 | 用途 | 示例 |
|----------|---------|---------|
| `#branch=name` | 检出特定分支 | `git+https://...#branch=develop` |
| `#tag=tagname` | 检出特定标签 | `git+https://...#tag=v1.0.0` |
| `#commit=hash` | 检出特定提交 | `git+https://...#commit=abc123` |

**示例：**
```bash
# 跟踪 develop 分支
source=("git+https://github.com/user/repo.git#branch=develop")

# 特定标签（用于稳定的开发快照）
source=("git+https://github.com/user/repo.git#tag=v2.0.0-beta")

# 特定提交（罕见，通常用于修复损坏的 HEAD）
source=("git+https://github.com/user/repo.git#commit=abc1234567")

# 多个 Git 源，使用不同分支
source=("example::git+https://github.com/user/example.git#branch=main"
        "plugin::git+https://github.com/user/plugin.git#branch=dev")
```

### Git 子模块

**对于带有子模块的仓库：**

```bash
pkgname=example-git
source=("git+https://github.com/user/example.git")
sha256sums=('SKIP')

prepare() {
    cd "$srcdir/example"
    # 初始化并更新子模块
    git submodule update --init --recursive
}
```

**或者使用特殊的 Git 语法：**
```bash
source=("git+https://github.com/user/example.git#submodules=1")
```

## CVS 软件包

**CVS (Concurrent Versions System) 是一种老旧的 VCS，仍被一些项目使用。**

### CVS 关键规则

| 规则 | 描述 |
|------|-------------|
| **后缀** | `-cvs` |
| **源格式** | `cvs+:pserver:anonymous:@host:/path#module=name` |
| **pkgver 格式** | `r123.20260214`（条目数 + 日期）或仅日期 |
| **makedepends** | `cvs` |
| **身份验证** | 使用 `anonymous:@` 而不是 `anonymous@` 以避免密码提示 |

### CVS 模板（匿名访问）

```bash
pkgname=example-cvs
pkgver=r123.20260214
pkgrel=1
pkgdesc="示例 CVS 软件包"
arch=('x86_64')
url="https://example.com"
license=('GPL')
depends=('glibc')
makedepends=('cvs')
provides=("example=${pkgver}")
conflicts=('example')
source=("example::cvs+:pserver:anonymous:@cvs.example.com:/cvsroot#module=example")
sha256sums=('SKIP')

pkgver() {
    cd "$srcdir/example"
    # 条目数 + 日期（最精确）
    local entries=$(find . -name Entries -exec cat {} + | grep -c '^/')
    local date=$(date +%Y%m%d)
    printf "r%s.%s" "$entries" "$date"
}

build() {
    cd "$srcdir/example"
    ./configure --prefix=/usr
    make
}

package() {
    cd "$srcdir/example"
    make DESTDIR="$pkgdir" install
    install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
}
```

### CVS 模板（带特定标签）

```bash
pkgname=example-cvs
pkgver=r456.20260214
pkgrel=1
pkgdesc="来自特定标签的示例 CVS 软件包"
arch=('x86_64')
url="https://example.com"
license=('MIT')
makedepends=('cvs')
source=("example::cvs+:pserver:anonymous:@cvs.example.com:/cvsroot#module=example&tag=RELEASE_1_0")
sha256sums=('SKIP')

pkgver() {
    cd "$srcdir/example"
    # 对带标签的检出使用标签 + 日期
    printf "r%s.%s" "$(find . -name Entries | wc -l)" "$(date +%Y%m%d)"
}

build() {
    cd "$srcdir/example"
    make
}

package() {
    cd "$srcdir/example"
    make DESTDIR="$pkgdir" install
}
```

### CVS CVSROOT 格式

**常见 CVSROOT 格式：**

| 访问方法 | CVSROOT 格式 | 示例 |
|---------------|----------------|---------|
| **pserver (匿名)** | `:pserver:anonymous:@host:/path` | `:pserver:anonymous:@cvs.gnu.org:/cvsroot` |
| **pserver (密码)** | `:pserver:user:pass@host:/path` | `:pserver:user:password@cvs.example.com:/repo` |
| **SSH** | `:ext:user@host:/path` | `:ext:user@cvs.example.com:/cvsroot` |
| **本地** | `/local/path` | `/var/cvs/repository` |

**在 PKGBUILD 源数组中：**
```bash
# 匿名 pserver（推荐）
source=("cvs+:pserver:anonymous:@cvs.gnu.org:/cvsroot#module=project")

# 带密码（尽可能避免，改用 SSH）
source=("cvs+:pserver:user:password@host:/repo#module=project")

# SSH（需要身份验证设置）
source=("cvs+:ext:user@cvs.example.com:/cvsroot#module=project")
```

### CVS pkgver() 模式

**模式 1：基于日期（最简单）：**
```bash
pkgver() {
    cd "$srcdir/modulename"
    date +%Y%m%d
}
# 输出：20260214
```

**模式 2：条目数 + 日期（推荐）：**
```bash
pkgver() {
    cd "$srcdir/modulename"
    local entries=$(find . -name Entries -exec cat {} + | grep -c '^/')
    local date=$(date +%Y%m%d)
    printf "r%s.%s" "$entries" "$date"
}
# 输出：r456.20260214
```

**模式 3：最后修改时间：**
```bash
pkgver() {
    cd "$srcdir/modulename"
    local mtime=$(find . -name Entries -printf '%T@\n' | sort -n | tail -1 | cut -d. -f1)
    printf "r%s" "$mtime"
}
# 输出：r1739577600
```

**模式 4：使用 CVS 日志（较慢但准确）：**
```bash
pkgver() {
    cd "$srcdir/modulename"
    local commits=$(cvs log 2>/dev/null | grep -c '^date:')
    local date=$(date +%Y%m%d)
    printf "r%s.%s" "$commits" "$date"
}
# 输出：r234.20260214
```

### CVS 源片段

**支持的 CVS 片段：**

| 片段 | 用途 | 示例 |
|----------|---------|---------|
| `#module=name` | 指定 CVS 模块（必需） | `#module=project` |
| `#tag=tagname` | 检出特定标签 | `#tag=RELEASE_1_0` |
| `#branch=name` | 检出特定分支 | `#branch=experimental` |
| `#revision=rev` | 检出特定修订版 | `#revision=1.45` |

**示例：**
```bash
# 主干
source=("cvs+:pserver:anonymous:@cvs.example.com:/repo#module=project")

# 特定标签
source=("cvs+:pserver:anonymous:@cvs.example.com:/repo#module=project&tag=v1_0")

# 特定分支
source=("cvs+:pserver:anonymous:@cvs.example.com:/repo#module=project&branch=dev")
```

### CVS 身份验证

**对于匿名访问（推荐）：**
```bash
# 在 @ 前使用冒号以避免密码提示
source=("cvs+:pserver:anonymous:@cvs.example.com:/cvsroot#module=project")
```

**对于 SSH 访问：**
```bash
makedepends=('cvs' 'openssh')
source=("cvs+:ext:username@cvs.example.com:/cvsroot#module=project")
```

**设置 SSH 的 CVS_RSH：**
```bash
build() {
    export CVS_RSH=ssh
    cd "$srcdir/project"
    ./configure --prefix=/usr
    make
}
```

### CVS 常见问题

| 问题 | 原因 | 解决方法 |
|-------|-------|-----|
| 构建期间出现密码提示 | 使用了 `anonymous@` 而非 `anonymous:@` | 在 CVSROOT 中使用 `anonymous:@` |
| 找不到模块 | 片段中的模块名称错误 | 检查 `cvs ls` 或上游文档 |
| 连接超时 | 服务器不可达或 CVSROOT 错误 | 使用 `cvs -d ... login` 验证 CVSROOT |
| 源文件陈旧 | makepkg 未更新 CVS 检出 | 删除 `$SRCDEST` 中的源并重新构建 |
| 缺少 CVS 命令 | `cvs` 不在 makedepends 中 | 将 `cvs` 添加到 makedepends |
| SSH 身份验证失败 | 无 SSH 密钥或用户名错误 | 设置 SSH 密钥，验证用户名 |
| pkgver 为空 | pkgver() 访问了错误的目录 | 确保 `cd` 到正确的源目录 |

### CVS 测试连接

```bash
# 测试匿名 pserver 连接
cvs -d :pserver:anonymous:@cvs.example.com:/cvsroot login
cvs -d :pserver:anonymous:@cvs.example.com:/cvsroot co module

# 列出可用模块
cvs -d :pserver:anonymous:@cvs.example.com:/cvsroot co -c
```

## SVN (Subversion) 软件包

### SVN 关键规则

| 规则 | 描述 |
|------|-------------|
| **后缀** | `-svn` |
| **源格式** | `svn+https://svn.example.com/repo/trunk` |
| **pkgver 格式** | `r12345`（修订号） |
| **makedepends** | `subversion` |
| **片段** | `#revision=1234` 用于特定修订版 |

### SVN 模板

```bash
pkgname=example-svn
pkgver=r12345
pkgrel=1
pkgdesc="示例 Subversion 软件包"
arch=('x86_64')
url="https://example.com"
license=('GPL')
depends=('glibc')
makedepends=('subversion')
provides=("example=${pkgver}")
conflicts=('example')
source=("example::svn+https://svn.example.com/example/trunk")
sha256sums=('SKIP')

pkgver() {
    cd "$srcdir/example"
    local ver="$(svnversion)"
    printf "r%s" "${ver//[[:alpha:]]}"
}

build() {
    cd "$srcdir/example"
    ./configure --prefix=/usr
    make
}

package() {
    cd "$srcdir/example"
    make DESTDIR="$pkgdir" install
    install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
}
```

### SVN pkgver() 函数

```bash
pkgver() {
    cd "$srcdir/reponame"
    local ver="$(svnversion)"
    printf "r%s" "${ver//[[:alpha:]]}"
}
# 输出：r12345
```

### SVN 源 URL 片段

```bash
# 主干（开发）
source=("svn+https://svn.example.com/repo/trunk")

# 特定分支
source=("svn+https://svn.example.com/repo/branches/stable")

# 特定标签
source=("svn+https://svn.example.com/repo/tags/v1.0")

# 特定修订版
source=("svn+https://svn.example.com/repo/trunk#revision=1234")
```

## Mercurial (Hg) 软件包

### Mercurial 关键规则

| 规则 | 描述 |
|------|-------------|
| **后缀** | `-hg` |
| **源格式** | `hg+https://hg.example.com/repo` |
| **pkgver 格式** | `r123.abc1234`（修订号 + 哈希） |
| **makedepends** | `mercurial` |

### Mercurial 模板

```bash
pkgname=example-hg
pkgver=r123.abc1234
pkgrel=1
pkgdesc="示例 Mercurial 软件包"
arch=('x86_64')
url="https://example.com"
license=('MIT')
depends=('glibc')
makedepends=('mercurial')
provides=("example=${pkgver}")
conflicts=('example')
source=("hg+https://hg.example.com/example")
sha256sums=('SKIP')

pkgver() {
    cd "$srcdir/example"
    printf "r%s.%s" "$(hg identify -n)" "$(hg identify -i)"
}

build() {
    cd "$srcdir/example"
    ./configure --prefix=/usr
    make
}

package() {
    cd "$srcdir/example"
    make DESTDIR="$pkgdir" install
}
```

### Mercurial pkgver() 函数

```bash
pkgver() {
    cd "$srcdir/reponame"
    printf "r%s.%s" "$(hg identify -n)" "$(hg identify -i)"
}
# 输出：r123.abc1234
```

## Bazaar (Bzr) 软件包

### Bazaar 关键规则

| 规则 | 描述 |
|------|-------------|
| **后缀** | `-bzr` |
| **源格式** | `bzr+lp:project` 或 `bzr+https://...` |
| **pkgver 格式** | `r123`（修订号） |
| **makedepends** | `bzr` |

### Bazaar 模板

```bash
pkgname=example-bzr
pkgver=r123
pkgrel=1
pkgdesc="示例 Bazaar 软件包"
arch=('x86_64')
url="https://launchpad.net/example"
license=('GPL')
depends=('glibc')
makedepends=('bzr')
provides=("example=${pkgver}")
conflicts=('example')
source=("bzr+lp:example")
sha256sums=('SKIP')

pkgver() {
    cd "$srcdir/example"
    printf "r%s" "$(bzr revno)"
}

build() {
    cd "$srcdir/example"
    ./configure --prefix=/usr
    make
}

package() {
    cd "$srcdir/example"
    make DESTDIR="$pkgdir" install
}
```

### Bazaar pkgver() 函数

```bash
pkgver() {
    cd "$srcdir/reponame"
    printf "r%s" "$(bzr revno)"
}
# 输出：r123
```

## VCS 软件包测试

**在创建 VCS PKGBUILD 之前：**

```bash
# 测试仓库是否可访问
git clone https://github.com/user/repo.git
svn checkout https://svn.example.com/repo/trunk
cvs -d :pserver:anonymous:@cvs.example.com:/cvsroot co module
hg clone https://hg.example.com/repo
bzr branch lp:project

# 检查构建依赖
cd repo
# 阅读 BUILD.md, INSTALL.md, README.md
```

**在构建前测试 pkgver() 函数：**

```bash
# 在 PKGBUILD 目录中
source PKGBUILD
cd src/reponame
pkgver
# 应输出有效的版本字符串
```

## VCS 软件包常见问题

| 问题 | 原因 | 解决方法 |
|-------|-------|-----|
| pkgver() 失败 | 目录错误 | 确保 `cd` 到正确的源目录 |
| 源文件陈旧 | makepkg 缓存了旧检出 | 从 `$SRCDEST` 中删除或使用 `makepkg -C` |
| VCS 工具错误 | 缺少 makedepends | 将 VCS 工具添加到 makedepends |
| 网络错误 | 仓库不可达 | 验证 URL，检查网络/防火墙 |
| 版本格式无效 | pkgver() 输出错误 | 手动测试 pkgver() 函数 |
| 子模块未获取 | Git 子模块未初始化 | 将 `git submodule update --init` 添加到 prepare() |

## VCS 软件包验证

**与常规软件包相同的验证：**

```bash
# 1. 检查 PKGBUILD
namcap PKGBUILD

# 2. 构建软件包
makepkg -f

# 3. 检查软件包
namcap *.pkg.tar.zst

# 4. 测试安装
sudo pacman -U *.pkg.tar.zst
```

## VCS 更新策略

**关键：VCS 软件包不应仅仅为了提升版本号而更新。**

| 更新原因 | 操作 |
|---------------|--------|
| 仅版本号变更 | 什么都不做 - pkgver() 会处理 |
| 构建脚本变更 | 更新 PKGBUILD，增加 pkgrel |
| 依赖变更 | 更新 depends，增加 pkgrel |
| 需要新补丁 | 添加补丁，增加 pkgrel |
| 新构建标志 | 更新 build()，增加 pkgrel |
| 修复打包错误 | 修复并增加 pkgrel |

**何时提交 VCS PKGBUILD 更新：**
- 构建过程变更
- 依赖变更
- 新的 configure 标志
- 安装路径修复
- 许可证变更
- 打包错误

**何时不提交：**
- 仅仅因为上游有了新提交
- 版本号变更（pkgver() 会处理）
- “更新到最新提交”（对于 VCS 软件包来说没有意义）

## VCS 软件包检查清单

在提交 VCS 软件包之前：

- [ ] 软件包名称具有正确的 VCS 后缀（-git, -svn 等）
- [ ] 已实现并测试 pkgver() 函数
- [ ] pkgver() 输出格式有效（无斜杠、冒号、连字符）
- [ ] makedepends 中包含 VCS 工具
- [ ] VCS 源使用 sha256sums=('SKIP')
- [ ] 如果与稳定版软件包冲突，则提供 provides=('pkgname')
- [ ] 如果提供稳定版软件包名称，则 conflicts=('pkgname')
- [ ] 源 URL 正确且可访问
- [ ] 源 URL 使用 HTTPS（而非 HTTP）
- [ ] namcap 验证通过
- [ ] 软件包构建和安装正确
- [ ] 使用 `makepkg --printsrcinfo` 生成 .SRCINFO

## 资源

- VCS 指南：https://wiki.archlinux.org/title/VCS_package_guidelines
- Git 源：https://wiki.archlinux.org/title/VCS_package_guidelines#Git
- SVN 源：https://wiki.archlinux.org/title/VCS_package_guidelines#Subversion
- CVS 源：https://wiki.archlinux.org/title/VCS_package_guidelines#CVS
- Mercurial 源：https://wiki.archlinux.org/title/VCS_package_guidelines#Mercurial
- Bazaar 源：https://wiki.archlinux.org/title/VCS_package_guidelines#Bazaar
