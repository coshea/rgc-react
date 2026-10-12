Write the commit message for the staged changes using Conventional Commits.

## Format

```
<type>(<scope>): <subject>

<optional body>
```

## Subject line

- Types: `feat`, `fix`, `refactor`, `chore`, `test`, plus `docs`, `style`, `ci`, `perf` when they fit.
- Scope is optional. Use the feature or area, in lowercase kebab-case, e.g. `profile`, `tournament-editor`, `api`, `functions`, `rules`, `ci`, `deps`.
- Imperative mood and lowercase after the colon: "add", "fix", "remove", not "added" or "adds".
- 72 characters or fewer, no trailing period.
- Say what changed and why it matters, not which files changed. Avoid filler like "update code" or "various fixes".

## Body

- Skip the body for small, self-explanatory changes.
- Otherwise add a blank line, then explain *why* in wrapped lines of 72 characters or fewer. Use short `-` bullets for several distinct changes.
- Mention behavior changes that reviewers can't see from the diff: new Firestore indexes or rules, new env vars, migrations, new dependencies.
- Add `BREAKING CHANGE: <description>` as a footer when an API, data shape or route changes incompatibly.

## Choosing the type

- `feat`: new user-visible behavior.
- `fix`: a bug fix.
- `refactor`: restructuring with no behavior change.
- `test`: only tests added or changed.
- `chore`: tooling, dependencies, config, version bumps.
- `ci`: GitHub Actions and deploy workflows.
- If the diff mixes unrelated changes, use the type of the most important one and cover the rest in the body.

## Don't

- Don't write a multi-type run-on subject, and don't paste bullet lists of every file touched.
- Don't mention AI, Copilot or Claude.
- Don't invent issue numbers or reference things that aren't in the diff.
- Don't wrap the message in quotes or code fences.

## Examples

```
feat(profile): add settings list with per-field edit sheets
```

```
fix(api): query registrations by tournament id to avoid missing index

The previous query needed a composite index that was never deployed,
so the upcoming-registrations list came back empty in production.
```

```
chore(deps): bump firebase-functions to 6.x
```
