# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the YouTube MCP Server project.

## ADR Index

| ADR                                           | Title                                       | Status   | Phase |
| --------------------------------------------- | ------------------------------------------- | -------- | ----- |
| [0001](0001-project-structure.md)             | Project Structure: Clean Architecture + DDD | Accepted | 1     |
| [0002](0002-phase-1-foundation.md)            | Phase 1: Foundation & Config                | Accepted | 1     |
| [0003](0003-phase-2-transcript-extraction.md) | Phase 2: Domain & Transcript Extraction     | Accepted | 2     |
| [0004](0004-phase-3-summarization.md)         | Phase 3: Summarization & LLM Integration    | Accepted | 3     |
| [0005](0005-phase-4-mcp-server.md)            | Phase 4: MCP Server & Tools                 | Accepted | 4     |
| [0006](0006-phase-5-http-production.md)       | Phase 5: HTTP/SSE & Production Hardening    | Accepted | 5     |
| [0007](0007-phase-6-release.md)               | Phase 6: Polish, Docs & Release             | Accepted | 6     |

## ADR Format

Each ADR follows this structure:

```markdown
# ADR XXX: Title

## Status

Accepted | Proposed | Rejected | Superseded

## Phase

Phase X - Description

## Context

What is the issue that we're seeing that is motivating this decision?

## Decision

What is the change that we're proposing or have agreed to implement?

## Deliverables

Specific files, components, and test coverage

## Consequences

### Positive

Benefits of this decision

### Negative

Drawbacks or trade-offs

## Related

Links to other ADRs
```

## Phase Overview

```
Phase 1 (Week 1) ✅ → Phase 2 (Week 2) → Phase 3 (Week 3)
     │                    │                   │
     ▼                    ▼                   ▼
Foundation          Transcript            Summarization
& Config            Extraction            & LLM

Phase 4 (Week 4) → Phase 5 (Week 5) → Phase 6 (Week 6)
     │                    │                   │
     ▼                    ▼                   ▼
MCP Server          HTTP/SSE &            Polish,
& Tools             Production            Docs & Release
```

## How to Add a New ADR

1. Create new file: `NNNN-title.md` (next sequential number)
2. Follow the format above
3. Add entry to this README
4. Reference from related ADRs
5. Commit with message: `docs: add ADR NNNN - Title`
