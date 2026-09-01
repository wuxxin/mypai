---
name: lilac/py-api
description: Use when writing lilac.py scripts for custom pre_build, post_build, or post_build_always hooks, modifying PKGBUILDs programmatically, or using lilac2 API functions
---

# Lilac.py API Reference

## Overview

`lilac.py` is an optional Python script in each package directory that defines custom build hooks. It uses the `lilac2.api` module to interact with PKGBUILDs, git, and the build environment. All hooks are optional - if not defined, lilac uses default behavior.

**Available Hooks:**
- `pre_build()` - Run before building, modify PKGBUILD
- `post_build()` - Run after successful build
- `post_build_always()` - Run after build regardless of success/failure

## When to Use

Use this skill when:
- Automatically modifying PKGBUILD variables before build
- Implementing custom version update logic
- Generating PKGBUILDs dynamically (PyPI, AUR downloads)
- Adding/removing dependencies based on conditions
- Implementing complex build workflows
- Updating AUR or other external repositories

**Prerequisite:** A valid PKGBUILD. Use `archlinux-pkgbuild` for PKGBUILD creation and validation before writing custom automation scripts.

## Quick Reference

### Hook Execution Order

```
pre_build() → [devtools build] → post_build() → post_build_always()
```

### Common Patterns

| Task | Function |
|------|----------|
| Update VCS version | `vcs_update()` |
| Download from AUR | `aur_pre_build()` |
| Generate from PyPI | `pypi_pre_build()` |
| Edit PKGBUILD | `edit_file('PKGBUILD')` |
| Modify arrays | `add_depends()`, `add_makedepends()` |
| Git commit | `git_pkgbuild_commit()` |
| Update AUR | `update_aur_repo()` |

## Hook Functions

### pre_build()

Called before the package is built. Use to modify PKGBUILD, update versions, or download sources.

```python
from lilac2.api import *

def pre_build():
    # Example: Update VCS package version
    vcs_update()
    
    # Example: Add dependency dynamically
    add_depends(['new-dependency'])
```

### post_build()

Called after successful build. Use to commit changes, push to AUR, or cleanup.

```python
def post_build():
    # Commit PKGBUILD changes
    git_pkgbuild_commit()
    
    # Push to AUR if configured
    update_aur_repo()
```

### post_build_always()

Called after every build attempt (success or failure). Use for cleanup.

```python
def post_build_always():
    # Cleanup temporary files
    clean_directory()
```

## VCS Functions

### vcs_update()

Update pkgver for VCS packages from the latest git commit.

```python
def pre_build():
    vcs_update()
```

**PKGBUILD Requirements:**
- Must use `pkgver()` function
- Source should use `git+https://...` format

```bash
# PKGBUILD for VCS package
pkgver() {
  cd "$pkgname"
  git describe --long --tags | sed 's/^v//;s/\([^-]*-g\)/r\1/;s/-/./g'
}
```

## AUR Functions

### aur_pre_build()

Download PKGBUILD and sources from AUR, optionally update to latest VCS version.

```python
def pre_build():
    # Download from AUR with same name
    aur_pre_build()
    
    # Or specify different AUR name
    aur_pre_build(name='different-pkgname')
    
    # Download and update VCS
    aur_pre_build(do_vcs_update=True)
```

### aur_post_build()

Cleanup after AUR-based build.

```python
def post_build():
    aur_post_build()
```

**Full AUR Example:**

```python
from lilac2.api import *

def pre_build():
    aur_pre_build(do_vcs_update=True)

def post_build():
    aur_post_build()
    update_aur_repo()  # Push back to AUR
```

## PyPI Functions

### pypi_pre_build()

Automatically generate PKGBUILD from PyPI package metadata.

```python
def pre_build():
    pypi_pre_build(
        pypi_name='requests',           # PyPI package name
        pkgname='python-requests',      # Optional: override package name
        depends=['python-urllib3'],     # Runtime dependencies
        makedepends=['python-setuptools', 'python-wheel'],
        optdepends=[                    # Optional dependencies with descriptions
            'python-pysocks: SOCKS proxy support',
            'python-chardet: Character encoding detection',
        ],
        checkdepends=['python-pytest'],
        check='pytest tests/',          # Test command
        license='Apache-2.0',
        arch=['any'],
        python2=False,                  # Python 2 compatibility
        depends_setuptools=True,        # Add setuptools to depends
        pep517=True,                    # Use PEP 517 build
        provides=['python-requests'],   # Provides
        conflicts=['python-requests-git'],
    )
```

### pypi_post_build()

Cleanup after PyPI build.

```python
def post_build():
    pypi_post_build()
```

## PKGBUILD Modification

### edit_file()

Edit a file line by line in a loop.

```python
def pre_build():
    # Modify PKGBUILD
    for line in edit_file('PKGBUILD'):
        if line.startswith('pkgname='):
            line = 'pkgname=my-custom-name'
        elif line.startswith('_version='):
            line = '_version=2.0.0'
        print(line)
```

### add_into_array()

Add elements to any PKGBUILD array.

```python
add_into_array('depends', ['new-dep1', 'new-dep2'])
add_into_array('makedepends', ['extra-tool'])
add_into_array('arch', ['aarch64'])
```

### Array Helper Functions

```python
# Add to specific arrays
add_depends(['dep1', 'dep2'])
add_makedepends(['build-tool'])
add_checkdepends(['test-runner'])
add_optdepends(['optional: for extra feature'])
add_conflicts(['conflicting-pkg'])
add_provides(['provided-pkg'])
add_replaces(['replaced-pkg'])
add_groups(['package-group'])
add_arch(['x86_64'])
```

### obtain_array()

Read values from PKGBUILD arrays.

```python
def pre_build():
    current_deps = obtain_array('depends')
    current_makedeps = obtain_makedepends()
    current_optdeps = obtain_optdepends(parse_dict=True)  # Returns dict
```

### Version Functions

```python
# Get current pkgver and pkgrel
pkgver, pkgrel = get_pkgver_and_pkgrel()

# Update pkgrel only
update_pkgrel(2)  # Set to specific value
update_pkgrel()   # Increment by 1

# Update both pkgver and pkgrel
update_pkgver_and_pkgrel('2.0.0', updpkgsums=True)  # Also update checksums
```

### Download Official PKGBUILD

```python
def pre_build():
    # Download from Arch official repos
    files = download_official_pkgbuild('firefox')
    # Returns list of downloaded files
```

## Git Operations

### git_pkgbuild_commit()

Commit PKGBUILD changes with standard message.

```python
def post_build():
    git_pkgbuild_commit()
```

**Generates commit messages like:**
- `pkgver bump: 1.0.0-1 -> 1.1.0-1`
- `pkgrel bump: 1.0.0-1 -> 1.0.0-2`

### git_add_files()

Stage files for commit.

```python
git_add_files('PKGBUILD')
git_add_files(['PKGBUILD', 'package.install', 'ChangeLog'])
git_add_files('*.patch', force=True)  # Force add ignored files
```

### git_rm_files()

Remove files from git.

```python
git_rm_files(['old-file.patch', 'deprecated.conf'])
```

### git_commit()

Commit with custom message.

```python
git_commit(
    '-m', 'Update to version 2.0.0',
    '-m', 'Also fixes issue #123'
)
```

### git_pull() / git_push()

```python
# Pull with error handling
success = git_pull()
if not success:
    print("Failed to pull")

# Push changes
git_push()
```

## AUR Publishing

### update_aur_repo()

Push package to AUR (requires lilac to be co-maintainer).

```python
def post_build():
    git_pkgbuild_commit()
    update_aur_repo()
```

**Requirements:**
- SSH access to AUR configured
- Lilac user added as co-maintainer on AUR
- For VCS packages: only pushes if more than version changed

## Utility Functions

### run_cmd()

Execute shell command and return output.

```python
# Simple command
output = run_cmd(['echo', 'hello'])

# With environment
output = run_cmd(['make'], cwd='/build/dir', env={'CC': 'gcc'})

# Capture output
output = run_cmd(['git', 'rev-parse', 'HEAD'])
```

### run_protected()

Run command in sandboxed environment (sources PKGBUILD safely).

```python
output = run_protected(['bash', '-c', 'echo $pkgver'])
```

### clean_directory()

Remove all PKGBUILD-related files (keeps lilac.yaml and lilac.py).

```python
def post_build_always():
    removed = clean_directory()
    print(f"Cleaned up: {removed}")
```

### get_srcinfo()

Parse .SRCINFO data.

```python
srcinfo = get_srcinfo()
# Returns bytes of makepkg --printsrcinfo output
```

### at_dir()

Context manager for changing directory.

```python
from pathlib import Path

with at_dir(Path('/tmp/build')):
    run_cmd(['make'])
# Back to original directory
```

### file_lock()

File-based locking for synchronization.

```python
with file_lock('/var/lock/mylock'):
    # Critical section
    pass
```

### suppress

Context manager to suppress exceptions.

```python
from lilac2.api import suppress

with suppress(FileNotFoundError):
    os.remove('maybe-missing-file')
```

## HTTP Client

### s (httpx.Client)

Shared HTTP client for making requests.

```python
def pre_build():
    # Fetch version from API
    response = s.get('https://api.github.com/repos/owner/repo/releases/latest')
    data = response.json()
    version = data['tag_name'].lstrip('v')
    
    # Update PKGBUILD
    for line in edit_file('PKGBUILD'):
        if line.startswith('pkgver='):
            line = f'pkgver={version}'
        print(line)
```

### parse_document_from_httpx()

Parse HTML from HTTP response.

```python
from lilac2.api import parse_document_from_httpx

response = s.get('https://example.com/download')
doc = parse_document_from_httpx(response)
version = doc.xpath('//span[@class="version"]/text()')[0]
```

## Complete Examples

### VCS Package with Custom Version

```python
from lilac2.api import *

def pre_build():
    vcs_update()
    
    # Add runtime dependency detected at build time
    add_depends(['python-lxml'])

def post_build():
    git_pkgbuild_commit()
```

### AUR Package with Modifications

```python
from lilac2.api import *

def pre_build():
    aur_pre_build(do_vcs_update=True)
    
    # Modify downloaded PKGBUILD
    for line in edit_file('PKGBUILD'):
        # Change dependency
        if 'libx11' in line:
            line = line.replace('libx11', 'libx11-git')
        print(line)
    
    # Add extra dependency
    add_makedepends(['extra-tool'])

def post_build():
    aur_post_build()
    update_aur_repo()
```

### PyPI Package with Tests

```python
from lilac2.api import *

def pre_build():
    pypi_pre_build(
        pypi_name='pytest',
        depends=['python-py', 'python-pluggy'],
        check='python -m pytest testing/',
        checkdepends=['python-argcomplete', 'python-hypothesis'],
    )
    
    # Add optdepends after generation
    add_optdepends([
        'python-argcomplete: for bash completion',
        'python-hypothesis: for property-based testing',
    ])

def post_build():
    pypi_post_build()
```

### Custom Version from Web API

```python
from lilac2.api import *

def pre_build():
    # Get latest version from custom API
    response = s.get('https://api.example.com/version')
    version = response.json()['latest']
    
    # Update PKGBUILD
    for line in edit_file('PKGBUILD'):
        if line.startswith('pkgver='):
            line = f'pkgver={version}'
        print(line)
    
    # Update checksums
    update_pkgver_and_pkgrel(version, updpkgsums=True)

def post_build():
    git_pkgbuild_commit()
```

### Conditional Dependency Addition

```python
from lilac2.api import *
import platform

def pre_build():
    # Add architecture-specific dependencies
    if platform.machine() == 'x86_64':
        add_makedepends(['yasm'])  # For ASM optimizations
    
    # Check if optional feature available
    try:
        run_cmd(['pkg-config', '--exists', 'cuda'])
        add_makedepends(['cuda'])
        add_optdepends(['cuda: for GPU acceleration'])
    except:
        pass
```

## Error Handling

### Custom Exceptions

```python
from lilac2.api import AurDownloadError

def pre_build():
    try:
        aur_pre_build()
    except AurDownloadError as e:
        print(f"Failed to download from AUR: {e.pkgname}")
        raise
```

### Graceful Degradation

```python
def pre_build():
    # Try to get version from multiple sources
    version = None
    
    try:
        response = s.get('https://api.github.com/...')
        version = response.json()['tag_name']
    except:
        pass
    
    if not version:
        # Fallback to manual version
        version = '1.0.0'
    
    update_pkgver_and_pkgrel(version.lstrip('v'))
```

## Best Practices

1. **Always use `git_pkgbuild_commit()` in `post_build()`** for version bumps
2. **Use `vcs_update()` for VCS packages** instead of manual version detection
3. **Keep `pre_build()` idempotent** - running twice shouldn't break
4. **Handle errors gracefully** - don't let exceptions leave repo in bad state
5. **Use `edit_file()` for complex modifications** rather than sed/awk
6. **Test manually** with `extra-x86_64-build` before committing
