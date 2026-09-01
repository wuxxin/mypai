---
name: lilac/yaml-config
description: Use when configuring lilac.yaml files, understanding package-specific build settings, managing maintainers and dependencies, or setting up build triggers and rebuild logic
---

# Lilac.yaml Configuration Reference

## Overview

`lilac.yaml` is the per-package configuration file that defines how lilac should build and maintain a package. It specifies maintainers, update sources, dependencies, build settings, and custom scripts.

**File Location:** `pkgbase/lilac.yaml` (alongside `PKGBUILD`)

## When to Use

Use this skill when:
- Creating or modifying lilac.yaml for a package
- Configuring who receives build notifications
- Setting up build dependencies (repo_depends)
- Defining update sources (update_on)
- Configuring custom pre/post build scripts
- Setting build architecture and timeouts

**Prerequisite:** A valid PKGBUILD file. Use `archlinux-pkgbuild` skill to create and validate PKGBUILDs with `namcap` before configuring lilac automation.

## Complete Schema

```yaml
# Required Fields
maintainers:                    # List of maintainers for notifications
  - github: username           # GitHub username (reads public email)
  - github: username
    email: Name <email@addr>   # Or specify email explicitly

build_prefix: extra-x86_64     # Build environment (see below)

update_on:                     # Version check sources (at least one)
  - source: github
    github: owner/repo

# Optional Fields
pre_build: pre_build_func      # Function name in lilac.py
post_build: post_build_func    # Function name in lilac.py
post_build_always: cleanup_func # Function name in lilac.py

pre_build_script: |            # Inline pre_build script
  # Python code here

post_build_script: |           # Inline post_build script
  # Python code here

post_build_always_script: |    # Inline post_build_always script
  # Python code here

time_limit_hours: 2            # Build timeout (default: 1)

repo_depends:                  # Dependencies within same repository
  - otherpkg
  - libdep: library-name       # Map pkgbase to specific pkgname

repo_makedepends:              # Build-time deps within same repo
  - build-tool

update_on_build:               # Rebuild when other packages build
  - pkgbase: otherpkg
    from_pattern: '(\d+)\..*'
    to_pattern: '\1'

staging: false                 # Stage packages in staging/ subdirectory

managed: true                  # Whether lilac manages this package

allowed_workers:               # Limit which workers can build
  - worker1
  - worker2
```

## Required Fields

### maintainers

List of people who receive build notifications.

```yaml
# Simple: GitHub username only (uses public email)
maintainers:
  - github: lilydjwg

# With explicit email
maintainers:
  - github: lilydjwg
    email: lilydjwg@gmail.com

# Full format
maintainers:
  - github: lilydjwg
    email: Felix Yan <felixonmars@archlinux.org>

# Multiple maintainers
maintainers:
  - github: user1
  - github: user2
    email: User2 <user2@example.com>
  - github: user3
```

**Note:** Requires GitHub API token in `~/.lilac/config.toml` to fetch public emails.

### build_prefix

The devtools command prefix for the build environment.

```yaml
# Standard architectures
build_prefix: extra-x86_64      # 64-bit packages
build_prefix: extra-aarch64     # ARM64 packages
build_prefix: multilib          # 32-bit libs on x86_64

# Repository-specific
build_prefix: archlinuxcn-x86_64
```

**Available prefixes depend on installed devtools packages.**

### update_on

Array of nvchecker sources that trigger rebuilds. **First entry checks for version updates; subsequent entries trigger rebuilds when dependencies change.**

```yaml
# Simple: Track GitHub releases
update_on:
  - source: github
    github: neovim/neovim
    use_max_tag: true

# Multiple sources: update + rebuild triggers
update_on:
  # Primary: Check upstream for new version
  - source: github
    github: myapp/myapp
    use_max_tag: true
  
  # Secondary: Rebuild when Python updates
  - source: archpkg
    archpkg: python
  
  # Tertiary: Rebuild when OpenSSL updates
  - source: archpkg
    archpkg: openssl
```

See `lilac/nvchecker-config` skill for complete source documentation.

## Optional Fields

### Build Hooks

Three ways to define build hooks:

#### 1. Reference lilac.py Functions

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

#### 2. Inline Scripts

```yaml
# Inline pre_build
pre_build_script: |
  vcs_update()
  add_depends(['extra-lib'])

# Inline post_build
post_build_script: |
  git_pkgbuild_commit()
  update_aur_repo()

# Inline cleanup
post_build_always_script: |
  clean_directory()
```

**Inline scripts have access to all `lilac2.api` functions.**

#### 3. Combination

```yaml
# Use both for complex workflows
pre_build: complex_setup       # Defined in lilac.py
post_build_script: |
  git_pkgbuild_commit()
  update_aur_repo()
```

### time_limit_hours

Maximum time allowed for build (in hours).

```yaml
# Long-running builds
time_limit_hours: 4

# Very long builds (e.g., browsers)
time_limit_hours: 12
```

**Default:** 1 hour

### repo_depends

Packages in the same repository that are runtime dependencies.

```yaml
# Simple: pkgbase name
repo_depends:
  - mylib
  - otherpackage

# Map pkgbase to specific pkgname
repo_depends:
  - python-numpy: python-numpy-openblas

# Mixed
repo_depends:
  - library-abc
  - python-lib: python-lib-git
```

**Purpose:**
- Ensures dependencies are built first (build order)
- Triggers rebuild when dependencies update (if in `update_on`)
- Makes packages available in build chroot

### repo_makedepends

Packages in the same repository that are build-time dependencies.

```yaml
repo_makedepends:
  - custom-build-tool
  - internal-header-only-lib
```

**Difference from repo_depends:**
- Only needed at build time, not runtime
- Build order only, no automatic rebuild trigger

### update_on_build

Rebuild this package when specified packages are built in the same batch.

```yaml
update_on_build:
  - pkgbase: libapp
  - pkgbase: libcore
    from_pattern: '(\d+)\.(\d+).*'
    to_pattern: '\1.\2'
```

**Requirements:**
- Package must also be in `repo_depends`
- Database support required for pattern matching (set `dburl` in config.toml)

### staging

Place built packages in `staging/` subdirectory for manual review.

```yaml
staging: true
```

**Use for:**
- Potentially breaking changes
- Large updates needing testing
- Packages requiring manual intervention

### managed

Whether lilac should manage this package.

```yaml
# Exclude from automatic builds
managed: false
```

**Default:** `true`

**Use cases:**
- Manually maintained packages
- Temporarily disable automatic builds
- Packages only for documentation

### allowed_workers

Restrict which build workers can process this package.

```yaml
allowed_workers:
  - builder1
  - powerful-builder
```

**Use for:**
- Resource-intensive packages requiring powerful builders
- Architecture-specific packages
- Testing new workers gradually

## Complete Examples

### Simple Package (GitHub Releases)

```yaml
maintainers:
  - github: felixonmars

build_prefix: extra-x86_64

update_on:
  - source: github
    github: shadowsocks/shadowsocks-libev
    use_max_tag: true
```

### VCS Package with Dependencies

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

### PyPI Package

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

### Package with Multiple Rebuild Triggers

```yaml
maintainers:
  - github: farseerfc

build_prefix: extra-x86_64

update_on:
  # Check upstream for new versions
  - source: github
    github: qbittorrent/qBittorrent
    use_max_tag: true
    include_regex: 'release-[\d.]+'
  
  # Rebuild when Qt updates
  - source: archpkg
    archpkg: qt6-base
  
  # Rebuild when OpenSSL updates
  - source: archpkg
    archpkg: openssl

repo_depends:
  - libtorrent-rasterbar
```

### AUR Package with Modifications

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
    # Modify after download
    for line in edit_file('PKGBUILD'):
        if line.startswith('depends='):
            line = line.replace(')', " 'extra-dep')")
        print(line)

def aur_post():
    aur_post_build()
    update_aur_repo()
```

### Complex with Inline Scripts

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
  # Download and extract
  vcs_update()
  
  # Add our custom patches
  add_makedepends(['python2'])

post_build_script: |
  git_pkgbuild_commit()
  
  # Move to staging
  import shutil
  import os
  pkgbase = os.path.basename(os.getcwd())
  os.makedirs('../../staging', exist_ok=True)
  for f in os.listdir('.'):
    if f.endswith('.pkg.tar.zst'):
      shutil.move(f, f'../../staging/{f}')
```

## Common Patterns

### VCS Package Pattern

```yaml
# For -git, -svn, -hg packages
maintainers:
  - github: yourname

build_prefix: extra-x86_64

update_on:
  - source: github
    github: owner/repo
    branch: master           # Track main branch
    lilac_throttle: 1d       # Don't rebuild too often

repo_depends:
  - some-dependency

pre_build: vcs_update
post_build: git_pkgbuild_commit
```

### Library with Reverse Dependencies

```yaml
# Library package
maintainers:
  - github: yourname

build_prefix: extra-x86_64

update_on:
  - source: github
    github: libfoo/libfoo
    use_max_tag: true

# Other packages that depend on this will have:
# repo_depends:
#   - libfoo
# update_on:
#   - source: archpkg  # or whatever their primary source is
#   - source: archpkg
#     archpkg: libfoo  # Rebuild when libfoo updates
```

### Python Application from PyPI

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

### Desktop Application from GitHub

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

## Validation

### Schema Validation

Lilac validates `lilac.yaml` against a JSON schema. Common errors:

```yaml
# ERROR: Missing required field
maintainers: []  # Cannot be empty

# ERROR: Invalid build_prefix
build_prefix: invalid-prefix

# ERROR: Malformed update_on
update_on:
  github: owner/repo  # Missing "source: github"

# ERROR: Invalid YAML syntax
maintainers:
- github user  # Missing colon
```

### Check Schema Online

Schema documentation: https://archlinuxcn.github.io/lilac/

## Best Practices

1. **Always specify maintainers** - At least one person must receive notifications
2. **Use `lilac_throttle` for VCS packages** - Prevent excessive rebuilds
3. **Keep repo_depends accurate** - Missing deps cause build failures
4. **Use `staging: true` for risky updates** - Allow testing before release
5. **Prefer `use_max_tag` over `use_latest_release`** - Tags are more reliable
6. **Add `strip_release: true` for archpkg sources** - Get clean version numbers
7. **Test build locally** with `extra-x86_64-build` before pushing

## Migration Notes

### From Old Lilac Versions

- `lilac.ini` → `lilac.yaml` (YAML format)
- `update_on` is now required (was optional)
- `maintainers` replaces individual email fields
- `build_prefix` replaces `chroot`

### Field Changes

| Old | New |
|-----|-----|
| `chroot = extra-x86_64` | `build_prefix: extra-x86_64` |
| `upstream = github:user/repo` | `update_on: [{source: github, github: user/repo}]` |
| `email = user@example.com` | `maintainers: [{github: user}]` |
