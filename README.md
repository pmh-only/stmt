# stmt

Editable statement/Q&A page with public read-only viewing and OIDC-protected editing.

## Features

- Public users can view published questions and answers.
- Logged-in users can edit site text, questions, answers, and pill definitions.
- Answers support inline pill tokens. Type `[yes]`, `[changed]`, or another pill slug/name to insert a pill.
- Pill behavior is configurable:
  - strike this answer
  - strike question when included
  - strike previous answers
- Pills can use any Lucide icon.
- Data is stored in SQLite.
- Authentication uses external OIDC SSO.

## Requirements

- Node.js 26 or newer
- pnpm 10.13.1

Node 26 is used because the app uses built-in `node:sqlite`.

## Configuration

Copy the example environment file:

```sh
cp .env.example .env
```

Variables:

| Name | Description |
| --- | --- |
| `OIDC_DISCOVERY_URL` | OpenID Provider Configuration URL, usually `https://issuer.example/.well-known/openid-configuration`. Do not set this to the JWKS URL. |
| `OIDC_CLIENT_ID` | OIDC client ID. |
| `OIDC_CLIENT_SECRET` | Optional OIDC client secret. Leave empty for public/PKCE clients. |
| `OIDC_REDIRECT_URI` | Callback URL registered with the provider. Defaults to the current origin plus `/auth/callback` if omitted. |
| `DATABASE_URL` | SQLite database path. Defaults to `stmt.db`. |

The OIDC discovery URL and issuer are allowed to differ. Token validation uses the `issuer` from the discovery document.

## Development

Install dependencies:

```sh
pnpm install
```

Run the dev server:

```sh
pnpm dev
```

Check types and Svelte diagnostics:

```sh
pnpm check
```

Build for production:

```sh
pnpm build
```

Preview the production build:

```sh
pnpm preview
```

## Docker

Build locally:

```sh
docker build -t stmt .
```

Run locally:

```sh
docker run --rm -p 3000:3000 \
  --env-file .env \
  -v stmt-data:/data \
  stmt
```

The container defaults `DATABASE_URL` to `/data/stmt.db`, so mount `/data` for persistence.

## Published Image

GitHub Actions builds and pushes a multi-arch image to GHCR on every push:

```text
ghcr.io/pmh-only/stmt:latest
ghcr.io/pmh-only/stmt:<git-sha>
```

The workflow builds natively on both architectures:

- `linux/amd64` on `ubuntu-latest`
- `linux/arm64` on `ubuntu-arm64-latest`

The architecture-specific images are pushed first, then merged into a multi-arch manifest.

## Data Model

The app initializes its SQLite schema automatically on startup. Existing databases are migrated in-place for additive fields used by pill behavior and icons.

Main entities:

- `site`: site title and description
- `questions`: ordered question text
- `answers`: ordered answers with optional nesting
- `pills`: labels, colors, icons, and behavior flags
- `answer_pills`: pill assignments parsed from answer text tokens
- `sessions`: local login sessions
- `oauth_states`: short-lived OIDC login state

## Notes

- Editing, append/delete controls, and pill management require login.
- Public viewer mode disables text selection.
- Full Lucide icon selection increases bundle size; this is expected with the current admin icon picker.
