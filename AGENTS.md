# AGENTS.md

Operational guide for agents in this repository (`/extra/IdeaProjects/Auth-Microservice`).

## 1) Project Context

- Authentication/authorization and user management service.
- Main stack: NestJS 11, TypeScript, PostgreSQL (TypeORM), Redis, and RabbitMQ.
- Goal when working here: small, safe, traceable changes aligned with existing patterns.
- Important commands:
  - `npm run start:dev` - start in development mode.
  - `npm run start` - start in production mode.
  - `npm run format` - format code according to the `.prettierrc` configuration.
  - `npm run test` - run unit tests found in each service as well as integration tests.
  - `npm run build` - compile the project.

## 2) Recommended Workflow

1. Understand the task and review the minimum necessary context.
2. If the request involves implementation, create an `.md` file in `.agent/tasks` with a name related to the implementation.
3. Discuss with the user and clearly justify what should be done before coding.
4. Record the detailed plan in the `.agent/tasks` file.
5. Once both parties are satisfied with the plan, always read that file from disk (not from memory) before implementing, as it may have been manually edited.
6. Implement the change in a focused manner, avoiding broad unsolicited refactors.
7. Validate locally with tests/lint/build depending on impact.
8. Deliver the result with:
   - what was changed,
   - why,
   - files affected,
   - verification steps executed.

## 3) Implementation Conventions

- Maintain consistency with the existing NestJS modular architecture.
- Reuse existing utilities, patterns, and names before creating new ones.
- Do not introduce new dependencies without clear technical justification.
- Prioritize minimal changes focused on the requirement.
- Respect project configurations (lint, tests, tsconfig, folder structure).

## 4) Security and Operational Restrictions

- Do not expose secrets in code, logs, tests, or documentation.
- Do not modify the real `.env` to force executions; use `example.env` as a reference.
- Avoid destructive actions (mass deletions, forced resets, irreversible changes) unless explicitly instructed.
- Verify that changes work before delivering them by running tests and performing a build.

## 5) NON-NEGOTIABLE Git Policy

Reason: the user reviews and manually executes all Git actions.

- **NEVER run `git add`**.
- **NEVER create commits** (includes `git commit` and variants).
- **NEVER push** (`git push` or equivalents).
- **NEVER create Pull Requests** (CLI, API, or UI).
- Inspection of status/diffs is allowed only if the task requires it and without altering history.

## 6) Language Policy

- Chat conversations may be in Spanish or any language the user prefers.
- **ALL written artifacts MUST be in English.** This includes:
  - This file (`AGENTS.md`) and any agent configuration files.
  - Task files in `.agent/tasks`.
  - Code comments.
  - Commit messages.
  - PR descriptions.
  - Specs, designs, and any other documentation files.
  - Any persisted text or written artifact produced by an agent.
- If the user writes a request in Spanish, the agent may respond in Spanish in the chat, but any file, comment, or documentation produced must still be written in English.

## 7) Response Preferences

- Be brief, clear, and actionable.
- Explain the result first, then key details.
- Include paths of modified files and verification commands executed.
- If critical information is missing, ask a single concrete question with a default recommendation.
