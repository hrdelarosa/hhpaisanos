# Heroínas y Héroes Paisanos

## Project

Operational management system for the Heroínas y Héroes Paisanos program, initially scoped to Guerrero.

The project uses a lightweight PNPM monorepo with:

- NestJS and TypeScript for the API.
- React, TypeScript, and **Vite+** for the unified web application.
- MySQL and Drizzle ORM for persistence.
- Screaming Architecture as the primary code organization approach.

The Telegram channel will be added in a later stage.

## Source of truth

- `docs/REQUIREMENTS.md` defines functional requirements and business rules.
- `docs/DATABASE_MODEL.md` defines the proposed data model.
- `README.md` contains current setup and development commands.
- Official formats are reference material for relevant functionality.

Read only the documents relevant to the task.

Do not invent or silently change functional requirements. Report material inconsistencies between documents and implementation.

## Architecture

- Organize code by business feature.
- Group related code by responsibility inside each feature.
- Follow existing NestJS and React conventions.
- Apply separation of concerns and dependency inversion where useful.
- Do not create mandatory Clean Architecture layers, empty folders, or speculative abstractions.
- Keep business rules and authorization on the API.
- Do not access MySQL directly from the web application.
- Introduce shared workspace packages only when actual reuse justifies them.

## Development

- Follow the confirmed functional requirements.
- Prefer readable and explicit TypeScript.
- Reuse existing code before creating new abstractions.
- Keep changes focused on the requested functionality.
- Make reasonable implementation decisions without unnecessary delegation.
- Validate affected behavior using relevant project commands.
- Do not implement future features prematurely.

## Data and security

- Use synthetic data for development and testing.
- Do not commit secrets or real credentials.
- Use explicit, versioned database migrations.
- Do not run migrations against an existing database without authorization.
- Preserve operational history and auditability.
- Do not enable external capture or deploy services without authorization.

## Git

Follow the repository's documented branching strategy and the global OpenCode Git safety instructions.

Do not push, create pull requests, merge, or deploy without explicit user authorization.

## Project-specific tools

- Use Vite+ for the web development toolchain.
- Use PNPM for workspace dependency management.
- Do not install project skills or tools without a concrete need and authorization.
- Do not load unrelated documentation or perform unnecessary repository-wide analysis.
