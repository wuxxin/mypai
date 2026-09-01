---
name: lilac/nvchecker-config
description: Use when configuring nvchecker sources in lilac.yaml update_on sections, selecting version checkers for different upstream sources, or troubleshooting version detection issues
---

# Lilac nvchecker Configuration

## Overview

nvchecker (new version checker) monitors upstream software sources and detects when new versions are released. In lilac, it's configured via the `update_on` field in `lilac.yaml`. Each entry in `update_on` specifies a source type (GitHub, PyPI, AUR, etc.) and its parameters.

**Key Principle:** The first `update_on` entry checks for version updates. Additional entries trigger rebuilds when dependencies change.

## When to Use

Use this skill when:
- Configuring how lilac detects upstream updates
- Choosing the right source type for a package
- Version detection is failing or returning wrong versions
- Need to filter or transform version strings
- Setting up rebuild triggers for dependency changes

**Prerequisite:** A valid PKGBUILD and lilac.yaml. Use `archlinux-pkgbuild` for PKGBUILD creation and validation before configuring version sources.

## Quick Reference

### Common Source Types

| Source | Use For | Key Option |
|--------|---------|------------|
| `github` | GitHub repos | `github: owner/repo` |
| `aur` | AUR packages | `aur: pkgname` |
| `pypi` | Python packages | `pypi: pkgname` |
| `archpkg` | Arch official packages | `archpkg: pkgname` |
| `regex` | Web page scraping | `url` + `regex` |
| `manual` | Manual version control | `manual: version` |
| `cmd` | Custom commands | `cmd: command` |

### Version Selection Strategies

| Strategy | Option | When to Use |
|----------|--------|-------------|
| Latest tag | `use_max_tag: true` | Software uses git tags for releases |
| Latest release | `use_latest_release: true` | GitHub releases with notes |
| Latest commit | (default, no option) | VCS packages (date-based) |
| Specific branch | `branch: main` | Tracking non-default branch |

## Configuration Format

### Basic GitHub Tag

```yaml
update_on:
  - source: github
    github: neovim/neovim
    use_max_tag: true
```

### GitHub Release (Not Tag)

```yaml
update_on:
  - source: github
    github: microsoft/vscode
    use_latest_release: true
```

### AUR Package

```yaml
update_on:
  - source: aur
    aur: firefox-nightly  # defaults to package name if omitted
```

### PyPI Package

```yaml
update_on:
  - source: pypi
    pypi: requests
```

### Web Page (Regex)

```yaml
update_on:
  - source: regex
    url: https://example.com/download.html
    regex: 'version ([\d.]+)'
```

### Arch Linux Official Package

```yaml
update_on:
  - source: archpkg
    archpkg: python
    strip_release: true  # Get 3.11.0 instead of 3.11.0-1
```

### Multiple Sources (Update + Rebuild)

```yaml
update_on:
  # Primary: Check upstream for new versions
  - source: github
    github: myapp/myapp
    use_max_tag: true
  
  # Secondary: Rebuild when dependency updates
  - source: archpkg
    archpkg: python
```

## Source Types Detailed

### GitHub

```yaml
update_on:
  - source: github
    github: owner/repo
    # Version strategies (pick ONE):
    use_max_tag: true           # Latest git tag
    use_latest_release: true    # Latest GitHub release
    use_max_release: true       # Highest versioned release
    use_latest_tag: true        # Most recent tag (needs token)
    # Options:
    branch: master              # Track specific branch (date-based)
    path: src/version.h         # Only commits touching this file
    host: github.mycompany.com  # GitHub Enterprise
    include_prereleases: true   # Include alpha/beta/rc
    # Authentication:
    token: ghp_xxx              # Or use keyfile ~/.lilac/nvchecker_keyfile.toml
```

**Keyfile for GitHub token:**
```toml
# ~/.lilac/nvchecker_keyfile.toml
[keys]
github = "ghp_your_token_here"
```

### GitLab / Gitea / BitBucket

Same options as GitHub, just change `source`:

```yaml
update_on:
  - source: gitlab
    gitlab: group/project
    use_max_tag: true
    host: gitlab.mycompany.com
  
  - source: gitea
    gitea: owner/repo
    host: codeberg.org  # For Codeberg/Forgejo
```

### AUR

```yaml
update_on:
  - source: aur
    aur: pkgname  # Defaults to package name if omitted
    strip_release: true      # Remove -1, -2 suffix
    use_last_modified: true  # Append modification time
```

### PyPI

```yaml
update_on:
  - source: pypi
    pypi: package-name
    use_pre_release: false   # Set true for alpha/beta
```

### Arch Linux Packages

```yaml
update_on:
  - source: archpkg
    archpkg: python
    strip_release: true
    provided: libpython       # Check provides instead of pkgver
  
  - source: alpm              # Local pacman database
    alpm: python
    repos: [core, extra]
```

### Regex (Web Scraping)

```yaml
update_on:
  - source: regex
    url: https://www.kernel.org/
    regex: 'latest stable version: <strong>([\d.]+)</strong>'
    encoding: utf-8
    # For POST requests:
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

### Command

```yaml
update_on:
  - source: cmd
    cmd: curl -s https://api.github.com/repos/owner/repo/releases/latest | jq -r .tag_name
```

### Manual

```yaml
update_on:
  - source: manual
    manual: 2.5.1  # Only updates when you change this
```

### Container Registry

```yaml
update_on:
  - source: container
    container: library/python  # Docker Hub official image
    registry: docker.io        # Or quay.io, ghcr.io, etc.
    # Check specific tag's update time:
    container: library/python:3.11
```

### Other Package Registries

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
  
  # Go modules
  - source: go
    go: github.com/caddyserver/caddy/v2
  
  # Maven
  - source: maven
    group: org.apache.maven
    artifact: maven-core
```

## Version Filtering

### Include/Exclude Patterns

```yaml
update_on:
  - source: github
    github: kubernetes/kubernetes
    use_max_tag: true
    # Only consider versions matching this pattern
    include_regex: 'v[\d.]+$'      # v1.2.3 but not v1.2.3-rc1
    # Exclude specific patterns
    exclude_regex: 'v1\.20\..*'    # Skip 1.20.x series
    # Ignore specific versions
    ignored: 'v1.0.0 v1.0.1'        # Space-separated list
```

### Version Transformation

```yaml
update_on:
  - source: github
    github: nodejs/node
    use_max_tag: true
    prefix: v              # Strip 'v' prefix: v18.0.0 -> 18.0.0
    # Or use regex substitution:
    from_pattern: 'v([\d.]+)-(.*)'
    to_pattern: '\1.\2'   # v18.0.0-rc.1 -> 18.0.0.rc.1
```

### Sorting Methods

```yaml
update_on:
  - source: github
    github: some/repo
    use_max_tag: true
    sort_version_key: vercmp  # Options: parse_version, vercmp, awesomeversion
```

## Advanced Options

### Throttling

Prevent excessive rebuilds for frequently updating VCS packages:

```yaml
update_on:
  - source: github
    github: neovim/neovim
    branch: master
    lilac_throttle: 1d    # Rebuild at most once per day
    # Or: 6h, 12h, 1w, etc.
```

### Aliases (Reuse Config)

Define common configs once, reuse with alias:

```yaml
update_on:
  - alias: github-latest
    source: github
    github: owner/repo
    use_max_tag: true

  # In another package's lilac.yaml:
  - source: alias
    alias: github-latest
```

### Network Options

```yaml
update_on:
  - source: github
    github: private/repo
    # Proxy
    proxy: http://localhost:8080
    # Retry on failure
    tries: 3
    # Timeout
    http_timeout: 30
    # Disable cert verification (not recommended)
    verify_cert: false
    # Custom user agent
    user_agent: "MyBot/1.0"
    # Bearer token
    httptoken: "Bearer token_here"
```

## Common Patterns

### VCS Package (Daily Check)

```yaml
update_on:
  - source: github
    github: neovim/neovim
    branch: master
    lilac_throttle: 1d
```

### Stable Release (Tags)

```yaml
update_on:
  - source: github
    github: git/git
    use_max_tag: true
    include_regex: 'v[\d.]+$'  # Exclude -rc versions
```

### Rebuild When Dependency Updates

```yaml
update_on:
  # Check upstream
  - source: github
    github: myapp/myapp
    use_max_tag: true
  # Rebuild when Python updates
  - source: archpkg
    archpkg: python
```

### Using update_on_build

Rebuild when another package in the same repo is built:

```yaml
update_on:
  - source: github
    github: owner/app
    use_max_tag: true

update_on_build:
  - pkgbase: libapp  # When libapp is built, rebuild this

repo_depends:
  - libapp  # Must also be listed here
```

### Multiple Git Sources (Combiner)

```yaml
update_on:
  - source: github
    github: project/subproject1
  - source: github
    github: project/subproject2
```

## Troubleshooting

### Version Not Detected

```bash
# Test nvchecker manually
cd ~/.lilac
nvchecker -c nvchecker.toml -n packagename

# Enable verbose logging
nvchecker -c nvchecker.toml -l debug

# Check what nvchecker sees
cat new_ver.json | jq
```

### Wrong Version Detected

1. Check `include_regex` / `exclude_regex`
2. Verify `sort_version_key` setting
3. Check for `ignored` versions
4. Review `from_pattern` / `to_pattern` transformations

### GitHub Rate Limit

```bash
# Error: API rate limit exceeded
# Solution: Configure GitHub token in keyfile
echo '[keys]' > ~/.lilac/nvchecker_keyfile.toml
echo 'github = "ghp_your_token"' >> ~/.lilac/nvchecker_keyfile.toml
```

### Version Format Mismatch

When upstream uses non-standard versioning:

```yaml
update_on:
  - source: github
    github: weird/project
    use_max_tag: true
    # Transform v2023-04-01 to 2023.04.01
    from_pattern: 'v(\d{4})-(\d{2})-(\d{2})'
    to_pattern: '\1.\2.\3'
```

## Complete Examples

### Desktop Application

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

### Library with Multiple Dependencies

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

### Web-Scraped Package

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

## Migration from Old nvchecker

nvchecker 2.x uses TOML format (not INI). Convert old configs:

```bash
# Convert from old format
nvchecker-ini2toml old_config.ini > new_config.toml
```

Key changes:
- `source = github` instead of auto-detection
- `use_max_tag` instead of `include_tags_pattern`
- JSON version files instead of custom format
