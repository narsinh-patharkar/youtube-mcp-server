# Contributing Guide

Thank you for contributing to YouTube MCP Server!

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

## Development Setup

```bash
# Fork and clone
git clone https://github.com/your-username/youtube-mcp-server.git
cd youtube-mcp-server

# Install dependencies
pnpm install

# Install git hooks
pnpm prepare

# Create feature branch
git checkout -b feat/your-feature-name
```

## Coding Standards

### TypeScript
- Strict mode enabled
- No `any` types (use `unknown` or generics)
- Explicit return types for public APIs
- Use `const` over `let`, avoid `var`
- Prefer functional style over classes where appropriate

### Error Handling
- Use `Result<T, E>` for fallible operations
- Throw `AppError` subclasses for domain errors
- Never swallow errors silently
- Log errors with context at appropriate level

### Testing
- Unit tests for all domain logic
- Integration tests for adapters
- E2E tests for critical paths
- Mock external dependencies
- Aim for >80% coverage

### Git Workflow
1. Create feature branch from `main`
2. Make small, focused commits
3. Write tests for new functionality
4. Ensure all checks pass (`pnpm check`)
5. Open PR with clear description

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

Examples:
```
feat(transcript): add yt-dlp fallback adapter
fix(cache): handle SQLite connection timeout
docs(api): update MCP tool documentation
test(summary): add chunking integration tests
```

## Pull Request Process

1. **Title**: Use conventional commit format
2. **Description**: Explain what, why, and how
3. **Tests**: Include test coverage for changes
4. **Docs**: Update relevant documentation
5. **Review**: Address reviewer feedback
6. **Merge**: Squash and merge after approval

## Adding New Features

### New Transcript Source
1. Implement `TranscriptPort` in `infrastructure/transcript/`
2. Add adapter class with `fetch()` and `getAvailableLanguages()`
3. Register in DI container
4. Add tests with mock and real YouTube URLs

### New LLM Provider
1. Implement `LLMPort` in `infrastructure/llm/`
2. Add adapter with `summarize()`, `countTokens()`, `getModel()`, `getProvider()`
3. Register in `LLMRouter` with config
4. Add provider-specific tests

### New Summary Style
1. Add style to `SummaryStyleSchema` in config
2. Add prompt template in `domain/summary/prompts.ts`
3. Update `SummaryService` to handle new style
4. Add tests for new style

### New Cache Backend
1. Implement `CachePort` in `infrastructure/cache/`
2. Add `get()`, `set()`, `delete()`, `clear()`, `size()`, `keys()`
3. Register based on `CACHE_TYPE` config
5. Add integration tests

## Code Review Checklist

- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] Coverage maintained
- [ ] No console.log in production code
- [ ] Errors properly typed and handled
- [ ] Logging at appropriate levels
- [ ] Config validated with Zod
- [ ] Documentation updated
- [ ] No breaking changes without major version bump

## Release Process

Releases are automated via GitHub Actions:

```bash
# Trigger release manually
gh workflow run release.yml -f version=patch
gh workflow run release.yml -f version=minor
gh workflow run release.yml -f version=major
```

Versioning follows [SemVer](https://semver.org/):
- `patch`: Bug fixes
- `minor`: New features (backward compatible)
- `major`: Breaking changes

## Getting Help

- Check existing [Issues](https://github.com/narsinh-patharkar/youtube-mcp-server/issues)
- Join [Discussions](https://github.com/narsinh-patharkar/youtube-mcp-server/discussions)
- Read [Architecture ADRs](../architecture/adr/)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.