# AGENTS.md

## General Instructions

- Agents must store their planning and all other artifacts in the `agents/` directory.
- Main application is an Electron application and not a regular Node.js application.
- Preferred stack: Node.js, TypeScript, Biome, and Vitest.
- `npm run start` to launch the main electron application.
- `npm test` to run all tests.
- `npm run build` to create a production build of the application.
- `npm run format` to format the codebase using Prettier.
- `npm run lint` to check for linting errors using Biome.
- NEVER introduce split conditional logic in application code to fix tests
- NEVER skip tests to fix them, fix the actual test instead or write better ones
