# ADR 0001: Project Structure - Clean Architecture with Domain-Driven Design

## Status
Accepted

## Context
We need a maintainable, testable, and scalable architecture for the YouTube MCP Server. The project will grow to include multiple transcript sources, LLM providers, caching strategies, and transport protocols.

## Decision
Adopt **Clean Architecture** with **Domain-Driven Design (DDD)** principles:

```
src/
├── config/                 # Configuration (Zod schemas, loaders)
├── core/                   # Cross-cutting concerns (errors, logging, DI, events, utils)
├── domain/                 # Enterprise business rules (entities, value objects, ports)
├── application/            # Application business rules (services, use cases, DTOs)
├── infrastructure/         # Frameworks & drivers (adapters, repositories, MCP, HTTP)
└── presentation/           # Interface adapters (CLI)
```

### Layer Responsibilities

| Layer | Responsibility | Dependencies |
|-------|----------------|--------------|
| **Domain** | Pure business logic, no external deps | None |
| **Application** | Orchestrate domain objects, use cases | Domain |
| **Infrastructure** | Implement ports, external integrations | Domain, Application |
| **Presentation** | Handle user interaction (CLI, MCP) | Application |

### Key Principles

1. **Dependency Rule**: Inner layers never depend on outer layers
2. **Ports & Adapters**: Domain defines interfaces (ports), infrastructure implements them (adapters)
3. **Use Cases**: Single-responsibility classes orchestrating domain logic
4. **Entities/Value Objects**: Rich domain models with behavior

## Consequences

### Positive
- High testability (domain pure, infrastructure swappable)
- Clear separation of concerns
- Easy to add new providers (LLM, cache, transcript)
- Framework-agnostic core

### Negative
- More files/boilerplate initially
- Learning curve for team unfamiliar with Clean Architecture
- Need discipline to maintain boundaries

## Implementation Notes

- Use TypeScript path aliases (`@domain/*`, `@application/*`, etc.)
- Domain: No `import` from `infrastructure` or `application`
- Application: No `import` from `infrastructure` or `presentation`
- Infrastructure: Implements domain ports
- Use DI container (tsyringe) for wiring

## Related ADRs
- ADR 0002: Configuration Management
- ADR 0003: Error Handling Strategy
- ADR 0004: LLM Provider Abstraction