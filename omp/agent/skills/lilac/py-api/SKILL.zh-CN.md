---
name: lilac/py-api
description: 编写用于自定义 pre_build、post_build 或 post_build_always 钩子的 lilac.py 脚本、以编程方式修改 PKGBUILD 或使用 lilac2 API 函数时
---

# Lilac.py API 参考

## 概述

`lilac.py` 是每个软件包目录中的可选 Python 脚本，定义自定义构建钩子。它使用 `lilac2.api` 模块与 PKGBUILD、git 和构建环境交互。所有钩子都是可选的——如果未定义，lilac 使用默认行为。

**可用钩子：**
- `pre_build()` - 构建前运行，修改 PKGBUILD
- `post_build()` - 构建成功后运行
- `post_build_always()` - 无论成功/失败，构建后都运行

## 何时使用

在以下情况使用本技能：
- 构建前自动修改 PKGBUILD 变量
- 实现自定义版本更新逻辑
- 动态生成 PKGBUILD（PyPI、AUR 下载）
- 根据条件添加/删除依赖项
- 实现复杂构建工作流
- 更新 AUR 或其他外部仓库

**前置要求：** 有效的 PKGBUILD。在编写自定义自动化脚本之前，使用 `archlinux-pkgbuild` 创建和验证 PKGBUILD。

## 快速参考

### 钩子执行顺序

```
pre_build() → [devtools 构建] → post_build() → post_build_always()
```

### 常见模式

| 任务 | 函数 |
|------|----------|
| 更新 VCS 版本 | `vcs_update()` |
| 从 AUR 下载 | `aur_pre_build()` |
| 从 PyPI 生成 | `pypi_pre_build()` |
| 编辑 PKGBUILD | `edit_file('PKGBUILD')` |
| 修改数组 | `add_depends()`, `add_makedepends()` |
| Git 提交 | `git_pkgbuild_commit()` |
| 更新 AUR | `update_aur_repo()` |

## 钩子函数

### pre_build()

在软件包构建前调用。用于修改 PKGBUILD、更新版本或下载源。

```python
from lilac2.api import *

def pre_build():
    # 示例：更新 VCS 软件包版本
    vcs_update()
    
    # 示例：动态添加依赖项
    add_depends(['new-dependency'])
```

### post_build()

构建成功后调用。用于提交更改、推送到 AUR 或清理。

```python
def post_build():
    # 提交 PKGBUILD 更改
    git_pkgbuild_commit()
    
    # 如果已配置则推送到 AUR
    update_aur_repo()
```

### post_build_always()

每次构建尝试后调用（无论成功或失败）。用于清理。

```python
def post_build_always():
    # 清理临时文件
    clean_directory()
```

## VCS 函数

### vcs_update()

从最新 git 提交更新 VCS 软件包的 pkgver。

```python
def pre_build():
    vcs_update()
```

**PKGBUILD 要求：**
- 必须使用 `pkgver()` 函数
- 源应使用 `git+https://...` 格式

```bash
# VCS 软件包的 PKGBUILD
pkgver() {
  cd "$pkgname"
  git describe --long --tags | sed 's/^v//;s/\([^-]*-g\)/r\1/;s/-/./g'
}
```

## AUR 函数

### aur_pre_build()

从 AUR 下载 PKGBUILD 和源，可选择更新到最新 VCS 版本。

```python
def pre_build():
    # 从 AUR 下载同名软件包
    aur_pre_build()
    
    # 或指定不同的 AUR 名称
    aur_pre_build(name='different-pkgname')
    
    # 下载并更新 VCS
    aur_pre_build(do_vcs_update=True)
```

### aur_post_build()

基于 AUR 的构建后清理。

```python
def post_build():
    aur_post_build()
```

**完整 AUR 示例：**

```python
from lilac2.api import *

def pre_build():
    aur_pre_build(do_vcs_update=True)

def post_build():
    aur_post_build()
    update_aur_repo()  # 推回 AUR
```

## PyPI 函数

### pypi_pre_build()

自动从 PyPI 软件包元数据生成 PKGBUILD。

```python
def pre_build():
    pypi_pre_build(
        pypi_name='requests',           # PyPI 软件包名称
        pkgname='python-requests',      # 可选：覆盖软件包名称
        depends=['python-urllib3'],     # 运行时依赖项
        makedepends=['python-setuptools', 'python-wheel'],
        optdepends=[                    # 带描述的依赖项
            'python-pysocks: SOCKS 代理支持',
            'python-chardet: 字符编码检测',
        ],
        checkdepends=['python-pytest'],
        check='pytest tests/',          # 测试命令
        license='Apache-2.0',
        arch=['any'],
        python2=False,                  # Python 2 兼容性
        depends_setuptools=True,        # 向 depends 添加 setuptools
        pep517=True,                    # 使用 PEP 517 构建
        provides=['python-requests'],   # Provides
        conflicts=['python-requests-git'],
    )
```

### pypi_post_build()

PyPI 构建后清理。

```python
def post_build():
    pypi_post_build()
```

## PKGBUILD 修改

### edit_file()

在循环中逐行编辑文件。

```python
def pre_build():
    # 修改 PKGBUILD
    for line in edit_file('PKGBUILD'):
        if line.startswith('pkgname='):
            line = 'pkgname=my-custom-name'
        elif line.startswith('_version='):
            line = '_version=2.0.0'
        print(line)
```

### add_into_array()

向任何 PKGBUILD 数组添加元素。

```python
add_into_array('depends', ['new-dep1', 'new-dep2'])
add_into_array('makedepends', ['extra-tool'])
add_into_array('arch', ['aarch64'])
```

### 数组辅助函数

```python
# 添加到特定数组
add_depends(['dep1', 'dep2'])
add_makedepends(['build-tool'])
add_checkdepends(['test-runner'])
add_optdepends(['optional: 用于额外功能'])
add_conflicts(['conflicting-pkg'])
add_provides(['provided-pkg'])
add_replaces(['replaced-pkg'])
add_groups(['package-group'])
add_arch(['x86_64'])
```

### obtain_array()

从 PKGBUILD 数组读取值。

```python
def pre_build():
    current_deps = obtain_array('depends')
    current_makedeps = obtain_makedepends()
    current_optdeps = obtain_optdepends(parse_dict=True)  # 返回字典
```

### 版本函数

```python
# 获取当前 pkgver 和 pkgrel
pkgver, pkgrel = get_pkgver_and_pkgrel()

# 仅更新 pkgrel
update_pkgrel(2)  # 设置为特定值
update_pkgrel()   # 增加 1

# 同时更新 pkgver 和 pkgrel
update_pkgver_and_pkgrel('2.0.0', updpkgsums=True)  # 同时更新校验和
```

### 下载官方 PKGBUILD

```python
def pre_build():
    # 从 Arch 官方仓库下载
    files = download_official_pkgbuild('firefox')
    # 返回下载的文件列表
```

## Git 操作

### git_pkgbuild_commit()

使用标准消息提交 PKGBUILD 更改。

```python
def post_build():
    git_pkgbuild_commit()
```

**生成的提交消息示例：**
- `pkgver bump: 1.0.0-1 -> 1.1.0-1`
- `pkgrel bump: 1.0.0-1 -> 1.0.0-2`

### git_add_files()

暂存文件以提交。

```python
git_add_files('PKGBUILD')
git_add_files(['PKGBUILD', 'package.install', 'ChangeLog'])
git_add_files('*.patch', force=True)  # 强制添加被忽略的文件
```

### git_rm_files()

从 git 中删除文件。

```python
git_rm_files(['old-file.patch', 'deprecated.conf'])
```

### git_commit()

使用自定义消息提交。

```python
git_commit(
    '-m', '更新到版本 2.0.0',
    '-m', '同时修复问题 #123'
)
```

### git_pull() / git_push()

```python
# 拉取并处理错误
success = git_pull()
if not success:
    print("拉取失败")

# 推送更改
git_push()
```

## AUR 发布

### update_aur_repo()

推送软件包到 AUR（需要 lilac 作为共同维护者）。

```python
def post_build():
    git_pkgbuild_commit()
    update_aur_repo()
```

**要求：**
- 已配置对 AUR 的 SSH 访问
- Lilac 用户已添加为 AUR 共同维护者
- 对于 VCS 软件包：仅当更改超过版本时才推送

## 实用函数

### run_cmd()

执行 shell 命令并返回输出。

```python
# 简单命令
output = run_cmd(['echo', 'hello'])

# 带环境变量
output = run_cmd(['make'], cwd='/build/dir', env={'CC': 'gcc'})

# 捕获输出
output = run_cmd(['git', 'rev-parse', 'HEAD'])
```

### run_protected()

在沙盒环境中运行命令（安全地获取 PKGBUILD）。

```python
output = run_protected(['bash', '-c', 'echo $pkgver'])
```

### clean_directory()

移除所有 PKGBUILD 相关文件（保留 lilac.yaml 和 lilac.py）。

```python
def post_build_always():
    removed = clean_directory()
    print(f"已清理：{removed}")
```

### get_srcinfo()

解析 .SRCINFO 数据。

```python
srcinfo = get_srcinfo()
# 返回 makepkg --printsrcinfo 输出的字节
```

### at_dir()

用于更改目录的上下文管理器。

```python
from pathlib import Path

with at_dir(Path('/tmp/build')):
    run_cmd(['make'])
# 返回原始目录
```

### file_lock()

用于同步的基于文件的锁定。

```python
with file_lock('/var/lock/mylock'):
    # 临界区
    pass
```

### suppress

用于抑制异常的上下文管理器。

```python
from lilac2.api import suppress

with suppress(FileNotFoundError):
    os.remove('可能缺失的文件')
```

## HTTP 客户端

### s (httpx.Client)

用于发出请求的共享 HTTP 客户端。

```python
def pre_build():
    # 从 API 获取版本
    response = s.get('https://api.github.com/repos/owner/repo/releases/latest')
    data = response.json()
    version = data['tag_name'].lstrip('v')
    
    # 更新 PKGBUILD
    for line in edit_file('PKGBUILD'):
        if line.startswith('pkgver='):
            line = f'pkgver={version}'
        print(line)
```

### parse_document_from_httpx()

从 HTTP 响应解析 HTML。

```python
from lilac2.api import parse_document_from_httpx

response = s.get('https://example.com/download')
doc = parse_document_from_httpx(response)
version = doc.xpath('//span[@class="version"]/text()')[0]
```

## 完整示例

### 带自定义版本的 VCS 软件包

```python
from lilac2.api import *

def pre_build():
    vcs_update()
    
    # 在构建时添加检测到的运行时依赖项
    add_depends(['python-lxml'])

def post_build():
    git_pkgbuild_commit()
```

### 带修改的 AUR 软件包

```python
from lilac2.api import *

def pre_build():
    aur_pre_build(do_vcs_update=True)
    
    # 修改下载的 PKGBUILD
    for line in edit_file('PKGBUILD'):
        # 更改依赖项
        if 'libx11' in line:
            line = line.replace('libx11', 'libx11-git')
        print(line)
    
    # 添加额外依赖项
    add_makedepends(['extra-tool'])

def post_build():
    aur_post_build()
    update_aur_repo()
```

### 带测试的 PyPI 软件包

```python
from lilac2.api import *

def pre_build():
    pypi_pre_build(
        pypi_name='pytest',
        depends=['python-py', 'python-pluggy'],
        check='python -m pytest testing/',
        checkdepends=['python-argcomplete', 'python-hypothesis'],
    )
    
    # 生成后添加可选依赖项
    add_optdepends([
        'python-argcomplete: 用于 bash 补全',
        'python-hypothesis: 用于基于属性的测试',
    ])

def post_build():
    pypi_post_build()
```

### 来自 Web API 的自定义版本

```python
from lilac2.api import *

def pre_build():
    # 从自定义 API 获取最新版本
    response = s.get('https://api.example.com/version')
    version = response.json()['latest']
    
    # 更新 PKGBUILD
    for line in edit_file('PKGBUILD'):
        if line.startswith('pkgver='):
            line = f'pkgver={version}'
        print(line)
    
    # 更新校验和
    update_pkgver_and_pkgrel(version, updpkgsums=True)

def post_build():
    git_pkgbuild_commit()
```

### 条件依赖项添加

```python
from lilac2.api import *
import platform

def pre_build():
    # 添加架构特定的依赖项
    if platform.machine() == 'x86_64':
        add_makedepends(['yasm'])  # 用于 ASM 优化
    
    # 检查可选功能是否可用
    try:
        run_cmd(['pkg-config', '--exists', 'cuda'])
        add_makedepends(['cuda'])
        add_optdepends(['cuda: 用于 GPU 加速'])
    except:
        pass
```

## 错误处理

### 自定义异常

```python
from lilac2.api import AurDownloadError

def pre_build():
    try:
        aur_pre_build()
    except AurDownloadError as e:
        print(f"从 AUR 下载失败：{e.pkgname}")
        raise
```

### 优雅降级

```python
def pre_build():
    # 尝试从多个源获取版本
    version = None
    
    try:
        response = s.get('https://api.github.com/...')
        version = response.json()['tag_name']
    except:
        pass
    
    if not version:
        # 回退到手动版本
        version = '1.0.0'
    
    update_pkgver_and_pkgrel(version.lstrip('v'))
```

## 最佳实践

1. **总是在 `post_build()` 中使用 `git_pkgbuild_commit()`** 进行版本升级
2. **对 VCS 软件包使用 `vcs_update()`** 而不是手动版本检测
3. **保持 `pre_build()` 幂等** - 运行两次不应破坏
4. **优雅地处理错误** - 不要让异常使仓库处于不良状态
5. **使用 `edit_file()` 进行复杂修改** 而不是 sed/awk
6. **提交前使用 `extra-x86_64-build` 手动测试**
