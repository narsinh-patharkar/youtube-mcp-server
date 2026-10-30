# ADR 0002: Phase 1 - Foundation & Config

## Status

Accepted

## Phase

**Phase 1** (Week 1) - Foundation & Config

## Context

Establish production-grade project foundation before implementing business logic.

## Decision

Implement core infrastructure: TypeScript config, configuration management, logging, DI container, error handling, testing infrastructure, Docker, CI/CD.

## Deliverables

### Configuration

- [x] TypeScript config with path aliases (`@core/*`, `@domain/*`, `@application/*`, `@infrastructure/*`, `@config/*`)
- [x] Zod-validated configuration with multi-source loading (`.env`, env vars, defaults)
- [x] `.env.example` with all configuration options

### Logging

- [x] Structured logging with Pino
- [x] PII redaction (API keys, tokens, cookies)
- [x] Child loggers for request/context scoping
- [x] Pretty printing for development

### Dependency Injection

- [x] Typed tsyringe container with singleton/transient/scoped lifecycles
- [x] Injection tokens for type-safe resolution
- [x] Lifecycle hooks (startup/shutdown/health checks)

### Error Handling

- [x] Domain error hierarchy (`AppError` + specific errors)
- [x] Error codes with categories (client/retryable/server/fatal)
- [x] MCP protocol error mapping (JSON-RPC codes)
- [x] `Result<T,E>` pattern for functional error handling

### Utilities

- [x] Retry logic with exponential backoff + jitter
- [x] Circuit breaker pattern
- [x] Zod validation helpers with common schemas
- [x] Crypto utilities (ULID, HMAC, API keys, constant-time compare)

### Testing Infrastructure

- [x] Vitest configuration (unit + e2e)
- [x] Mock factories (LLM, transcript, cache)
- [x] Test data builders (fluent API)
- [x] Custom matchers (`toBeOk`, `toBeErr`)

### DevOps

- [x] Multi-stage Dockerfile (dev + prod)
- [x] Docker Compose (with optional Redis)
- [x] GitHub Actions CI/CD (lint, typecheck, test, build, docker, release)
- [x] Makefile with common commands

### Documentation

- [x] ADR 0001: Project Structure (Clean Architecture + DDD)
- [x] Getting started guide
- [x] Contributing guide

## Consequences

### Positive

- Solid foundation for all subsequent phases
- Type-safe, testable, maintainable codebase
- Production-ready from day one

### Negative

- Upfront investment before business logic
- More files/boilerplate initially

---

## Related

- ADR 0001: Project Structure
- ADR 0003: Phase 2 - Transcript Extraction (next)
