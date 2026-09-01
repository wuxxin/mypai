---
name: lilac/yaml-config
description: 配置 lilac.yaml 文件、理解特定软件包的构建设置、管理维护者和依赖关系或设置构建触发器和重建逻辑时
---

# Lilac.yaml 配置参考

## 概述

`lilac.yaml` 是定义 lilac 应如何构建和维护软件包的每软件包配置文件。它指定维护者、更新源、依赖项、构建设置和自定义脚本。

**文件位置：** `pkgbase/lilac.yaml`（与 `PKGBUILD` 同级）

## 何时使用

在以下情况使用本技能：
- 为软件包创建或修改 lilac.yaml
- 配置谁接收构建通知
- 设置构建依赖项（repo_depends）
- 定义更新源（update_on）
- 配置自定义构建前/后脚本
- 设置构建架构和超时

**前置要求：** 有效的 PKGBUILD 文件。在配置 lilac 自动化之前，使用 `archlinux-pkgbuild` 技能创建和验证 PKGBUILD。

## 完整架构

```yaml
# 必需字段
maintainers:                    # 通知的维护者列表
  - github: username           # GitHub 用户名（读取公共邮箱）
  - github: username
    email: Name <email@addr>   # 或显式指定邮箱

build_prefix: extra-x86_64     # 构建环境（见下文）

update_on:                     # 版本检查源（至少一个）
  - source: github
    github: owner/repo

# 可选字段
pre_build: pre_build_func      # lilac.py 中的函数名
post_build: post_build_func    # lilac.py 中的函数名
post_build_always: cleanup_func # lilac.py 中的函数名

pre_build_script: |            # 内联 pre_build 脚本
  # Python 代码在这里

post_build_script: |           # 内联 post_build 脚本
  # Python 代码在这里

post_build_always_script: |    # 内联 post_build_always 脚本
  # Python 代码在这里

time_limit_hours: 2            # 构建超时（默认：1）

repo_depends:                  # 同一仓库内的依赖项
  - otherpkg
  - libdep: library-name       # 将 pkgbase 映射到特定 pkgname

repo_makedepends:              # 同一仓库内的构建时依赖
  - build-tool

update_on_build:               # 其他软件包构建时重建
  - pkgbase: otherpkg
    from_pattern: '(\d+)\..*'
    to_pattern: '\1'

staging: false                 # 在 staging/ 子目录中暂存软件包

managed: true                  # lilac 是否管理此软件包

allowed_workers:               # 限制哪些工作器可以构建
  - worker1
  - worker2
```

## 必需字段

### maintainers

接收构建通知的人员列表。

```yaml
# 简单：仅 GitHub 用户名（使用公共邮箱）
maintainers:
  - github: lilydjwg

# 带显式邮箱
maintainers:
  - github: lilydjwg
    email: lilydjwg@gmail.com

# 完整格式
maintainers:
  - github: lilydjwg
    email: Felix Yan <felixonmars@archlinux.org>

# 多维护者
maintainers:
  - github: user1
  - github: user2
    email: User2 <user2@example.com>
  - github: user3
```

**注意：** 需要在 `~/.lilac/config.toml` 中配置 GitHub API token 以获取公共邮箱。

### build_prefix

devtools 命令前缀用于构建环境。

```yaml
# 标准架构
build_prefix: extra-x86_64      # 64 位软件包
build_prefix: extra-aarch64     # ARM64 软件包
build_prefix: multilib          # x86_64 上的 32 位库

# 仓库特定
build_prefix: archlinuxcn-x86_64
```

**可用前缀取决于已安装的 devtools 软件包。**

### update_on

tNvchecker 源数组，触发重建。**第一个条目检查版本更新；后续条目在依赖项更改时触发重建。**

```yaml
# 简单：跟踪 GitHub 发布版
update_on:
  - source: github
    github: neovim/neovim
    use_max_tag: true

# 多源：更新 + 重建触发器
update_on:
  # 主要：检查上游新版本
  - source: github
    github: myapp/myapp
    use_max_tag: true
  
  # 次要：Python 更新时重建
  - source: archpkg
    archpkg: python
  
  # 第三：OpenSSL 更新时重建
  - source: archpkg
    archpkg: openssl
```

有关完整源文档，请参阅 `lilac/nvchecker-config` 技能。

## 可选字段

### 构建钩子

定义构建钩子的三种方式：

#### 1. 引用 lilac.py 函数

```yaml
# lilac.yaml
pre_build: my_pre_build
post_build: my_post_build
post_build_always: cleanup
```

```python
# lilac.py
from lilac2.api import *

def my_pre_build():
    vcs_update()

def my_post_build():
    git_pkgbuild_commit()

def cleanup():
    clean_directory()
```

#### 2. 内联脚本

```yaml
# 内联 pre_build
pre_build_script: |
  vcs_update()
  add_depends(['extra-lib'])

# 内联 post_build
post_build_script: |
  git_pkgbuild_commit()
  update_aur_repo()

# 内联清理
post_build_always_script: |
  clean_directory()
```

**内联脚本可以访问所有 `lilac2.api` 函数。**

#### 3. 组合

```yaml
# 对复杂工作流使用两者
pre_build: complex_setup       # 在 lilac.py 中定义
post_build_script: |
  git_pkgbuild_commit()
  update_aur_repo()
```

### time_limit_hours

允许构建的最长时间（以小时为单位）。

```yaml
# 长时间运行的构建
time_limit_hours: 4

# 非常长的构建（例如浏览器）
time_limit_hours: 12
```

**默认：** 1 小时

### repo_depends

同一仓库中是运行时依赖的软件包。

```yaml
# 简单：pkgbase 名称
repo_depends:
  - mylib
  - otherpackage

# 将 pkgbase 映射到特定 pkgname
repo_depends:
  - python-numpy: python-numpy-openblas

# 混合
repo_depends:
  - library-abc
  - python-lib: python-lib-git
```

**用途：**
- 确保依赖项先构建（构建顺序）
- 依赖项更新时触发重建（如果在 `update_on` 中）
- 使软件包在构建环境中可用

### repo_makedepends

同一仓库中是构建时依赖的软件包。

```yaml
repo_makedepends:
  - custom-build-tool
  - internal-header-only-lib
```

**与 repo_depends 的区别：**
- 仅在构建时需要，不是运行时
- 仅构建顺序，不自动触发重建

### update_on_build

同一批次中指定软件包构建时重建此软件包。

```yaml
update_on_build:
  - pkgbase: libapp
  - pkgbase: libcore
    from_pattern: '(\d+)\.(\d+).*'
    to_pattern: '\1.\2'
```

**要求：**
- 软件包也必须在 `repo_depends` 中
- 模式匹配需要数据库支持（在 config.toml 中设置 `dburl`）

### staging

将构建的软件包放在 `staging/` 子目录中供手动审查。

```yaml
staging: true
```

**用于：**
- 潜在的破坏性更改
- 需要测试的大型更新
- 需要手动干预的软件包

### managed

lilac 是否应管理此软件包。

```yaml
# 从自动构建中排除
managed: false
```

**默认：** `true`

**用例：**
- 手动维护的软件包
- 暂时禁用自动构建
- 仅用于文档的软件包

### allowed_workers

限制哪些构建工作器可以处理此软件包。

```yaml
allowed_workers:
  - builder1
  - powerful-builder
```

**用于：**
- 需要强大构建器的资源密集型软件包
- 架构特定的软件包
- 逐步测试新工作器

## 完整示例

### 简单软件包（GitHub 发布版）

```yaml
maintainers:
  - github: felixonmars

build_prefix: extra-x86_64

update_on:
  - source: github
    github: shadowsocks/shadowsocks-libev
    use_max_tag: true
```

### 带依赖项的 VCS 软件包

```yaml
maintainers:
  - github: yan12125
    email: Yen Chi Hsuan <yan12125@gmail.com>

build_prefix: extra-x86_64

update_on:
  - source: github
    github: neovim/neovim
    branch: master
    lilac_throttle: 1d

repo_depends:
  - tree-sitter-git
  - libutf8proc-git

pre_build: vcs_update
post_build: git_pkgbuild_commit
```

```python
# lilac.py
from lilac2.api import *

def vcs_update():
    vcs_update()

def git_pkgbuild_commit():
    git_pkgbuild_commit()
```

### PyPI 软件包

```yaml
maintainers:
  - github: felixonmars

build_prefix: extra-x86_64

update_on:
  - source: pypi
    pypi: black

pre_build: pypi_build
post_build: pypi_post
```

```python
# lilac.py
from lilac2.api import *

def pypi_build():
    pypi_pre_build(pypi_name='black', depends=['python-click'])

def pypi_post():
    pypi_post_build()
```

### 带多重建触发器的软件包

```yaml
maintainers:
  - github: farseerfc

build_prefix: extra-x86_64

update_on:
  # 检查上游新版本
  - source: github
    github: qbittorrent/qBittorrent
    use_max_tag: true
    include_regex: 'release-[\d.]+'
  
  # Qt 更新时重建
  - source: archpkg
    archpkg: qt6-base
  
  # OpenSSL 更新时重建
  - source: archpkg
    archpkg: openssl

repo_depends:
  - libtorrent-rasterbar
```

### 带修改的 AUR 软件包

```yaml
maintainers:
  - github: petronny

build_prefix: extra-x86_64

update_on:
  - source: aur

repo_depends:
  - dependency-from-repo

pre_build: aur_build
post_build: aur_post
```

```python
# lilac.py
from lilac2.api import *

def aur_build():
    aur_pre_build(do_vcs_update=True)
    # 下载后修改
    for line in edit_file('PKGBUILD'):
        if line.startswith('depends='):
            line = line.replace(')', " 'extra-dep')")
        print(line)

def aur_post():
    aur_post_build()
    update_aur_repo()
```

### 带内联脚本的复杂示例

```yaml
maintainers:
  - github: lilydjwg

build_prefix: extra-x86_64

time_limit_hours: 2

update_on:
  - source: github
    github: chromium/chromium
    use_max_tag: true

repo_depends:
  - custom-icu

staging: true

pre_build_script: |
  # 下载并解压
  vcs_update()
  
  # 添加我们的自定义补丁
  add_makedepends(['python2'])

post_build_script: |
  git_pkgbuild_commit()
  
  # 移到暂存区
  import shutil
  import os
  pkgbase = os.path.basename(os.getcwd())
  os.makedirs('../../staging', exist_ok=True)
  for f in os.listdir('.'):
    if f.endswith('.pkg.tar.zst'):
      shutil.move(f, f'../../staging/{f}')
```

## 常见模式

### VCS 软件包模式

```yaml
# 用于 -git, -svn, -hg 软件包
maintainers:
  - github: yourname

build_prefix: extra-x86_64

update_on:
  - source: github
    github: owner/repo
    branch: master           # 跟踪主分支
    lilac_throttle: 1d       # 不要太频繁重建

repo_depends:
  - some-dependency

pre_build: vcs_update
post_build: git_pkgbuild_commit
```

### 带反向依赖的库

```yaml
# 库软件包
maintainers:
  - github: yourname

build_prefix: extra-x86_64

update_on:
  - source: github
    github: libfoo/libfoo
    use_max_tag: true

# 依赖于此的其他软件包将有：
# repo_depends:
#   - libfoo
# update_on:
#   - source: archpkg  # 或它们的主要源
#   - source: archpkg
#     archpkg: libfoo  # libfoo 更新时重建
```

### 来自 PyPI 的 Python 应用程序

```yaml
maintainers:
  - github: yourname

build_prefix: extra-x86_64

update_on:
  - source: pypi
    pypi: package-name

pre_build: pypi_pre
post_build: pypi_post
```

```python
# lilac.py
from lilac2.api import *

def pypi_pre():
    pypi_pre_build(
        pypi_name='package-name',
        depends=['python-requests'],
    )

def pypi_post():
    pypi_post_build()
```

### 来自 GitHub 的桌面应用程序

```yaml
maintainers:
  - github: yourname

build_prefix: extra-x86_64

update_on:
  - source: github
    github: org/app
    use_latest_release: true
    include_regex: 'v[\d.]+$'

repo_depends:
  - internal-lib

repo_makedepends:
  - internal-build-tool
```

## 验证

### 架构验证

Lilac 根据 JSON 架构验证 `lilac.yaml`。常见错误：

```yaml
# 错误：缺少必需字段
maintainers: []  # 不能为空

# 错误：无效的 build_prefix
build_prefix: invalid-prefix

# 错误：update_on 格式错误
update_on:
  github: owner/repo  # 缺少 "source: github"

# 错误：YAML 语法无效
maintainers:
- github user  # 缺少冒号
```

### 在线检查架构

架构文档：https://archlinuxcn.github.io/lilac/

## 最佳实践

1. **始终指定维护者** - 至少有一个人必须接收通知
2. **对 VCS 软件包使用 `lilac_throttle`** - 防止过度重建
3. **保持 repo_depends 准确** - 缺少的依赖项导致构建失败
4. **对有风险的使用 `staging: true`** - 允许发布前测试
5. **优先使用 `use_max_tag` 而不是 `use_latest_release`** - 标签更可靠
6. **对 archpkg 源添加 `strip_release: true`** - 获取干净的版本号
7. **在推送前使用 `extra-x86_64-build` 本地测试构建**

## 迁移说明

### 从旧版 Lilac 迁移

- `lilac.ini` → `lilac.yaml`（YAML 格式）
- `update_on` 现在是必需的（以前是可选的）
- `maintainers` 替换单独的邮箱字段
- `build_prefix` 替换 `chroot`

### 字段变更

| 旧版 | 新版 |
|-----|-----|
| `chroot = extra-x86_64` | `build_prefix: extra-x86_64` |
| `upstream = github:user/repo` | `update_on: [{source: github, github: user/repo}]` |
| `email = user@example.com` | `maintainers: [{github: user}]` |
