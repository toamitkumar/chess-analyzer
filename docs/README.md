# ChessPulse Documentation

This directory contains Architecture Decision Records (ADRs), design documents, and technical specifications for the ChessPulse chess analysis platform.

---

## Architecture Decision Records (ADRs)

ADRs document significant architectural and design decisions made during development. Each ADR follows a structured format explaining the context, decision drivers, alternatives considered, and consequences.

### Format

Each ADR includes:
- **Status**: Proposed, Accepted, Implemented, Deprecated, Superseded
- **Context**: Problem statement and background
- **Decision Drivers**: Requirements and constraints
- **Considered Options**: Alternatives evaluated
- **Decision Outcome**: Chosen solution and rationale
- **Consequences**: Positive, negative, and neutral impacts
- **Implementation Details**: Technical specifics
- **Future Improvements**: Planned enhancements

### Active ADRs

- [ADR-001: Automatic Puzzle Linking Architecture](./ADR-001-Auto-Puzzle-Linking.md) - Queue-based puzzle linking system for blunder practice recommendations
- [ADR-002: Puzzle Storage Architecture](./ADR-002-Puzzle-Storage-Architecture.md) - API-first hybrid approach for storing 3M+ puzzles with minimal storage footprint
- [ADR-003: Database Strategy](./ADR-003-Database-Strategy.md) - Dual-mode SQLite/PostgreSQL for development and production

### `/summaries`
Implementation summaries and progress reports:
- [Phase 3 Implementation Summary](./Phase-3-Implementation-Summary.md) - Puzzle recommendation and progress tracking API (Issue #78)

---

## Document Categories

### `/guides`
Operational guides and how-to documentation:
- [Database Configuration](./guides/database-configuration.md) - Development vs test database setup
- [Deployment Guide](./guides/deployment.md) - Production deployment on Railway

### `/plans`
Implementation plans and project documentation:
- [Issue #78 Implementation Plan](./plans/issue-78-implementation-plan.md) - Lichess puzzle integration detailed plan

### Future Categories

#### `/api` (Planned)
API documentation:
- Endpoint specifications
- Request/response formats
- Authentication & authorization
- Rate limiting & caching

#### `/architecture` (Planned)
System architecture documentation:
- High-level system overview
- Component diagrams
- Data flow diagrams
- Technology stack decisions

---

## Contributing to Documentation

### When to Create an ADR

Create an ADR when making decisions about:
- Architectural patterns (e.g., queue-based vs synchronous processing)
- Technology choices (e.g., SQLite vs PostgreSQL)
- API design approaches
- Data modeling strategies
- Performance optimization techniques
- Security implementations

### ADR Naming Convention

```
ADR-XXX-Short-Description.md
```

Examples:
- `ADR-001-Auto-Puzzle-Linking.md`
- `ADR-002-Database-Migration-Strategy.md`
- `ADR-003-Authentication-System.md`

### ADR Template

```markdown
# ADR-XXX: [Title]

**Status**: [Proposed/Accepted/Implemented/Deprecated/Superseded]
**Date**: YYYY-MM-DD
**Author**: [Name]
**Related Issue**: #XXX

## Context and Problem Statement
[Describe the problem and context]

## Decision Drivers
[List requirements and constraints]

## Considered Options
1. Option A
2. Option B
3. Option C

## Decision Outcome
[Chosen option and rationale]

## Consequences
### Positive
### Negative
### Neutral

## Implementation Details
[Technical specifics]

## Future Improvements
[Planned enhancements]
```

---

## Cross-References

### Main Project Documentation
- [CLAUDE.md](../CLAUDE.md) - Development guidelines and project overview
- [README.md](../README.md) - Project README (if exists)
- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) - Production deployment guide

### Implementation Guides
- [DATABASE.md](../DATABASE.md) - Database schema and migration guide
- [ANGULAR-CONVERSION.md](../newfrontend/ANGULAR-CONVERSION.md) - Frontend architecture

---

## Documentation Standards

### Writing Style
- **Clear and concise**: Use simple language
- **Structured**: Follow established templates
- **Technical but accessible**: Explain jargon and acronyms
- **Visual aids**: Include diagrams where helpful
- **Examples**: Provide code snippets and examples

### Maintenance
- **Keep current**: Update docs when code changes
- **Version control**: Track changes in revision history
- **Review process**: ADRs should be reviewed before implementation
- **Archive obsolete**: Mark superseded ADRs clearly

---

## Tools and Resources

### Diagram Tools
- [Mermaid](https://mermaid.js.org/) - For inline diagrams in markdown
- [Draw.io](https://draw.io/) - For complex architecture diagrams
- ASCII diagrams for simple flow charts

### Markdown Editors
- VS Code with Markdown Preview
- [StackEdit](https://stackedit.io/) - Online markdown editor
- [Typora](https://typora.io/) - WYSIWYG markdown editor

### ADR Tools
- [adr-tools](https://github.com/npryce/adr-tools) - Command-line tool for managing ADRs
- [ADR GitHub Action](https://github.com/marketplace/actions/adr-tools) - Automate ADR management

---

## Questions?

For questions about documentation:
1. Check existing ADRs for similar decisions
2. Review related GitHub issues
3. Ask in development discussions
4. Create a documentation issue

---

**Last Updated**: 2024-12-14
**Maintainers**: Development Team
