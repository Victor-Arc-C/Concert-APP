# CON-6 — Set up application architecture and environments

Issue: https://linear.app/concert-app67/issue/CON-6/set-up-application-architecture-and-environments
Repository: https://github.com/Victor-Arc-C/Concert-APP

The founder supplied the authoritative acceptance criteria after the issue description failed to render. The empty GitHub repository does not supersede the existing application: the local implementation is preserved as the initial project history.

## Acceptance evidence

| Requirement | Implementation and verification |
| --- | --- |
| Separate local/dev/prod environments | Explicit APP_ENV profiles, placeholder templates, separate default local/development/test datasets, production HTTPS/PostgreSQL requirements, test provider/scheduler isolation; environment tests pass. |
| Never commit secrets | Private environment files, databases, build output, dependency directories, test output, logs and local handoff notes ignored. Staged source checked against actual private credential values and common credential/file patterns; no matches. |
| Lint, type checking and tests in CI | Node 22 lockfile installation, route type generation, lint, tests, build and disposable browser/API test database in GitHub Actions. All checks passed locally; remote workflow result is recorded separately. |
| Clear project/module conventions | Existing modular monolith preserved; docs/CONVENTIONS.md defines module responsibilities, issue workflow, validation and secret handling. |
| Setup/run README | README covers installation, environment precedence, local/dev/test/production configuration, verification, database recovery, scheduler and deployment boundaries. |

## Recovery

1,115 existing project/configuration/database files recovered from macOS cloud offloading and verified readable. A protected backup outside cloud synchronization retains matching SHA-256 hashes. The complete database was copied and byte-verified before opening the runtime copy. The original database and backup remain preserved. The runtime copy opens and retains 7 users, 55 events, saved preferences and activity. Machine-specific storage paths and credentials remain in ignored local configuration.

No database reset, replacement application, destructive migration or force push was used. The checkout is kept downloaded; active database storage is outside cloud synchronization.

## Verification

- Production build: passed.
- Lint and TypeScript: passed; route types generated automatically.
- Unit/integration tests: 36 passed.
- Browser/API tests: 3 passed against an isolated disposable database, including signup/onboarding/saving/persistence/alerts/deletion, authorization/CSRF/account isolation, and desktop/mobile layout.
- Existing scheduler: verified startup execution against the recovered runtime copy. A pre-existing temporary account gained exactly two Paris alerts without a feed visit. A repeat authenticated job evaluated six accounts with zero failures and did not duplicate those alerts. Automatic-check status and successful artist-check timestamp were verified through the API.
- Final staged whitespace and private-credential/runtime-file checks passed.

The scheduler predates CON-6 and is preserved and verified, not treated as a new roadmap expansion. Original user data was not deleted. Temporary verification accounts may remain in the private runtime dataset; no account data is part of Git.

## Boundaries and next issue

Production hosting, managed PostgreSQL integration/backup restore, external scheduling, Spotify approval, email recovery and production monitoring are not provisioned by this issue. The local scheduler runs only while the server/computer is awake. Public-launch gates remain documented in README.

CON-6 blocks CON-7, CON-8 and CON-9. None was started. Recommended next issue after CON-6 completion: CON-7 — Implement authentication and user profile, beginning with a delta review of the existing authentication implementation.
