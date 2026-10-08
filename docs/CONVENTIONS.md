# Project conventions

Showbound is a modular Next.js monolith. Keep this structure unless a verified requirement needs a change; do not introduce another frontend, service layer or ORM just to match a generic template.

- `src/domain`: types, validation, sample data, normalization and recommendation rules. Keep business calculations testable without database or network access. Server-only normalization may use Node crypto; do not import it into client components.
- `src/server`: database access, authentication, environment validation, jobs and API orchestration. Use parameterized SQL. Keep secrets and raw provider payloads here.
- `src/server/providers`: official provider adapters and timeout/error handling. Preserve canonical identities, provenance, unknown prices and rate limits. Never manufacture provider availability.
- `src/components`: client screens, app state and shared controls. Reuse an existing component when its behavior genuinely matches. Show useful loading, empty and failure states.
- `src/app`: framework routes, layout and styling. Keep route handlers thin; validate inputs server-side and authorize mutations.
- `src/instrumentation.ts`: Node-only startup integration. It must not run external work during builds.
- `tests`: deterministic domain/security/job tests; `tests/e2e` exercises browser/API flows with disposable accounts and an isolated test database.
- `config/environments`: placeholder-only environment templates. Private values belong in ignored files or hosting secrets.

Use strict TypeScript, existing formatting and familiar naming. Domain types are shared contracts; provider-specific responses belong in their adapter. Read installed Next.js documentation as instructed by AGENTS.md before changing framework integration. Add migrations to the versioned list rather than rewriting applied migrations; production migration coordination is a separate deployment requirement.

For each Linear issue, inspect acceptance criteria and dependencies, identify existing behavior, write the smallest delta, run `npm run check` and relevant browser/build checks, then review the diff and staged files. CI is the same toolchain as local verification. Use the issue-generated branch name when available; otherwise use `codex/con-<number>-<description>`. No force pushes or database resets. Keep commits tied to verified outcomes and leave incomplete or credential-blocked work explicit. Do not mark an issue Done before verification or begin its blocked successors.

No production login recovery, monitoring vendor, billing, travel booking or schema redesign is introduced by CON-6. Those belong to their own unblocked roadmap issues.
