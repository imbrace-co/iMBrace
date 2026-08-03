# Contributing to IMbrace

Thanks for your interest in improving IMbrace! This guide applies across all IMbrace
open-source repositories (see the [README](README.md#repositories) for the full list).

## Before you start

- Be kind — this project follows a [Code of Conduct](CODE_OF_CONDUCT.md).
- Search existing issues/PRs first to avoid duplicates.
- For anything non-trivial, **open an issue to discuss it before writing code**, so we can
  agree on the approach.

## License boundary — important

IMbrace is **dual-licensed** by file path (see the [README](README.md#license--please-read-first)):

- Files whose path does **not** contain `.ee.` → [Sustainable Use License v1.0](LICENSE.md).
- Files whose path **does** contain `.ee.` (e.g. `x.ee.ts`, `packages/ee/…`) →
  [Enterprise License](LICENSE_EE.md).

What this means for you:

- **Contribute only to non-`.ee.` files.** Community contributions to Enterprise (`.ee.`)
  code are generally **not accepted** — those are commercial features governed by a
  separate license.
- By submitting a contribution, you agree that your contribution to the non-`.ee.` code is
  provided under the **Sustainable Use License v1.0**, and that you have the right to
  submit it.
- Never commit secrets, credentials, customer data, or internal infrastructure details.
  (See each repo's `REMOVED.md` for the kinds of things that were scrubbed when preparing
  the open-source releases.)

## Development workflow

1. **Fork** the relevant repository and clone your fork.
2. Create a branch from the repo's default branch:
   `feat/<short-description>` or `fix/<short-description>`.
3. Follow the setup steps in that repository's own `README.md`.
4. Make your change. Keep the diff focused; match the surrounding code style.
5. Run the repo's linters/tests locally before pushing.

## Commit & PR guidelines

- Use clear, present-tense commit messages. [Conventional Commits](https://www.conventionalcommits.org)
  (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`) are encouraged.
- Keep PRs small and scoped to one concern.
- In the PR description, explain **what** changed and **why**, and link any related issue.
- Ensure CI passes. A maintainer will review; please respond to feedback.

## Reporting bugs & requesting features

- **Bugs:** open an issue with steps to reproduce, expected vs. actual behavior, and
  environment details.
- **Features:** open an issue describing the problem you're solving before proposing a
  solution.
- **Security vulnerabilities:** do **not** open a public issue — see [SECURITY.md](SECURITY.md).

## Questions

Open a discussion or issue in the relevant repository. Thank you for contributing! 🙌
