# Modern Makefile for Next-Generation MyPAI

SHELL := /usr/bin/env bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help

# Virtual environment configuration
VENV ?= .venv
VENV_BIN = $(VENV)/bin
PYTHON = $(if $(wildcard $(VENV_BIN)/python),$(VENV_BIN)/python,python3)
PYTEST = $(if $(wildcard $(VENV_BIN)/pytest),$(VENV_BIN)/pytest,pytest)
RUFF = $(if $(wildcard $(VENV_BIN)/ruff),$(VENV_BIN)/ruff,ruff)
MYPY = $(if $(wildcard $(VENV_BIN)/mypy),$(VENV_BIN)/mypy,mypy)

.PHONY: help buildenv test test-unit test-e2e coverage lint format typecheck clean cleanenv all

## Help & Target Reconstruction
help: ## Show this help message and reconstruct all primary targets
	@echo "========================================================================"
	@echo "                   Next-Generation MyPAI Build & Test Matrix            "
	@echo "========================================================================"
	@echo "Usage: make [target]"
	@echo ""
	@echo "Primary Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Active Runtime Configuration:"
	@echo "  Virtualenv:       $(VENV)"
	@echo "  Python Binary:    $(PYTHON)"
	@echo "  Pytest Binary:    $(PYTEST)"
	@echo "========================================================================"

## Environment Provisioning
buildenv: ## Provision local virtual environment with uv and install test dependencies
	@echo "==> Creating virtual environment in $(VENV)..."
	@if [ ! -d "$(VENV)" ]; then uv venv $(VENV); fi
	@echo "==> Installing mypai_eval_runtime in editable mode with test dependencies..."
	@uv pip install --python $(VENV_BIN)/python -e ".[test]"
	@echo "==> Environment ready: $(VENV_BIN)/python"

## Testing Targets
test: ## Run complete test suite (unit + e2e)
	@echo "==> Running complete test suite..."
	@PYTHONPATH="src:.:$${PYTHONPATH:-}" $(PYTEST) tests -v

test-unit: ## Run fast unit tests only
	@echo "==> Running unit tests..."
	@PYTHONPATH="src:.:$${PYTHONPATH:-}" $(PYTEST) tests/unit -v

test-e2e: ## Run end-to-end multi-session and protocol integration tests
	@echo "==> Running end-to-end integration tests..."
	@PYTHONPATH="src:.:$${PYTHONPATH:-}" $(PYTEST) tests/e2e -v

coverage: ## Run test suite with line-level code coverage report
	@echo "==> Running test suite with coverage..."
	@PYTHONPATH="src:.:$${PYTHONPATH:-}" $(PYTEST) tests --cov=mypai_eval_runtime --cov-report=term-missing --cov-report=xml

## Linting & Formatting Targets
lint: ## Run ruff linter and format checking across codebase
	@echo "==> Running ruff code quality checks..."
	@$(RUFF) check src/ tests/ bin/
	@echo "==> Running ruff format verification..."
	@$(RUFF) format --check src/ tests/ bin/

format: ## Automatically fix and format all Python code
	@echo "==> Auto-fixing linter findings with ruff..."
	@$(RUFF) check --fix src/ tests/ bin/
	@echo "==> Formatting code with ruff..."
	@$(RUFF) format src/ tests/ bin/

typecheck: ## Run static type analysis with mypy
	@echo "==> Running mypy static type analysis..."
	@PYTHONPATH="src:$${PYTHONPATH:-}" $(MYPY) src/

## Pipeline Target
all: format lint typecheck test coverage ## Run complete CI pipeline (format, lint, typecheck, test, coverage)
	@echo "==> All CI checks and tests passed successfully!"

## Cleanup Targets
clean: ## Remove temporary caches, coverage reports, and Python bytecode
	@echo "==> Cleaning temporary build artifacts, caches, and bytecode..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@find . -type f -name "*.pyo" -delete 2>/dev/null || true
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "build" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
	@rm -f .coverage coverage.xml
	@echo "==> Clean complete."

cleanenv: clean ## Remove virtual environment and all caches
	@echo "==> Removing virtual environment $(VENV)..."
	@rm -rf $(VENV)
	@echo "==> Environment removed."
