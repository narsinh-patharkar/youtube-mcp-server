# =============================================================================
# Makefile - Common development commands
# =============================================================================

.PHONY: help install dev build start test lint format typecheck clean docker

# Default target
help:
	@echo "YouTube MCP Server - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install       Install dependencies"
	@echo "  make prepare       Install git hooks"
	@echo ""
	@echo "Development:"
	@echo "  make dev           Start dev server with hot reload"
	@echo "  make build         Build for production"
	@echo "  make start         Start production server"
	@echo ""
	@echo "Testing:"
	@echo "  make test          Run unit tests"
	@echo "  make test:watch    Run tests in watch mode"
	@echo "  make test:coverage Run tests with coverage"
	@echo "  make test:e2e      Run E2E tests"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint          Run ESLint"
	@echo "  make lint:fix      Run ESLint with auto-fix"
	@echo "  make format        Format with Prettier"
	@echo "  make format:check  Check Prettier formatting"
	@echo "  make typecheck     Run TypeScript type checking"
	@echo ""
	@echo "Docker:"
	@echo "  make docker:build  Build Docker image"
	@echo "  make docker:dev    Start development container"
	@echo "  make docker:prod   Start production container"
	@echo "  make docker:down   Stop containers"
	@echo ""
	@echo "Database:"
	@echo "  make db:migrate    Run database migrations"
	@echo "  make db:seed       Seed database"
	@echo ""
	@echo "Release:"
	@echo "  make release:patch Bump patch version"
	@echo "  make release:minor Bump minor version"
	@echo "  make release:major Bump major version"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean         Clean build artifacts"
	@echo "  make clean:all     Clean everything including node_modules"

# Setup
install:
	pnpm install --frozen-lockfile

prepare:
	pnpm prepare

# Development
dev:
	pnpm dev

build:
	pnpm build

start:
	pnpm start

start:prod:
	pnpm start:prod

# Testing
test:
	pnpm test

test:watch:
	pnpm test:watch

test:coverage:
	pnpm test:coverage

test:e2e:
	pnpm test:e2e

# Code Quality
lint:
	pnpm lint

lint:fix:
	pnpm lint:fix

format:
	pnpm format

format:check:
	pnpm format:check

typecheck:
	pnpm typecheck

# Docker
docker:build:
	pnpm build:docker

docker:dev:
	docker compose -f docker/docker-compose.yml up youtube-mcp-dev

docker:prod:
	docker compose -f docker/docker-compose.yml up -d youtube-mcp-server redis

docker:down:
	docker compose -f docker/docker-compose.yml down

docker:logs:
	docker compose -f docker/docker-compose.yml logs -f

# Database
db:migrate:
	pnpm db:migrate

db:seed:
	pnpm db:seed

# Release
release:patch:
	npm version patch --no-git-tag-version

release:minor:
	npm version minor --no-git-tag-version

release:major:
	npm version major --no-git-tag-version

# Maintenance
clean:
	rm -rf dist coverage .tsbuildinfo

clean:all: clean
	rm -rf node_modules
	rm -f pnpm-lock.yaml

# Quick checks
check: lint typecheck test

# CI simulation
ci: check build