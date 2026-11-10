# EnvGate Lite — GitHub Action

Fail a GitHub Actions job when a key listed in `.env.example` isn't set.

Missing environment variables are an easy way to break a deploy: someone adds `STRIPE_WEBHOOK_SECRET` to the code and to `.env.example`, but nobody adds it to the CI secrets or the production env file. This action reads the key names from your `.env.example` and checks that each one is set, either in an env file you point it at or in the job's environment variables (which is where GitHub Actions secrets usually end up).

- **Zero dependencies.** Plain Node.js, nothing to install, nothing in `node_modules`.
- **Never prints values.** Logs, annotations, outputs, and the job summary contain key names only.
- **Free and MIT-licensed.**

## Usage

### Check secrets passed as environment variables

```yaml
name: CI
on: [push, pull_request]

jobs:
  env-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - name: Check required env vars
        uses: ESS2292/envgate-action@v1
        with:
          example: .env.example
          fail-on-empty: "true"
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          API_KEY: ${{ secrets.API_KEY }}
          APP_NAME: ${{ vars.APP_NAME }}
```

Note: when a repository secret doesn't exist, `${{ secrets.NAME }}` expands to an empty string, so the variable is *set but empty*. Turn on `fail-on-empty: "true"` to catch that case.

### Check a generated env file

```yaml
      - name: Write .env for deploy
        run: |
          echo "DATABASE_URL=${{ secrets.DATABASE_URL }}" >> .env.production
          echo "API_KEY=${{ secrets.API_KEY }}" >> .env.production

      - name: Check .env.production against .env.example
        uses: ESS2292/envgate-action@v1
        with:
          env-file: .env.production
          fail-on-empty: "true"
```

A key counts as present if it is in the `env-file` **or** in the job's environment variables.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `example` | `.env.example` | Template file listing the required keys. Values in it are ignored. |
| `env-file` | *(none)* | Optional env file to check, in addition to the job's environment variables. |
| `fail-on-empty` | `false` | When `true`, keys that are set but empty (or whitespace) in every source also fail. |

## Outputs

| Output | Description |
| --- | --- |
| `ok` | `true` if the check passed, otherwise `false`. |
| `missing` | Comma-separated missing key names. |
| `empty` | Comma-separated empty key names (only when `fail-on-empty` is `true`). |

The job fails (exit code 1) when any key is missing, any key is empty with `fail-on-empty` on, or a file can't be read. Each problem key gets an error annotation and a row in the job summary.

## What this action does *not* do

EnvGate Lite answers one question: *is every required key set?* It deliberately leaves out:

- placeholder detection (`TODO`, `CHANGEME`, `your_api_key_here`, …)
- extra-key checks (keys in `.env` that aren't in `.env.example`), including a strict mode that fails on them
- detection of high-confidence secret shapes (GitHub tokens, AWS access key IDs, Stripe live keys, Slack tokens, private key blocks)
- a machine-readable JSON report
- a local CLI you can run before you push

Those are in the full **[EnvGate CLI](https://ess2292.github.io/envgate/)**, a zero-dependency Node.js 18+ tool ($19 one-time, MIT source included) that runs on your machine, in pre-commit hooks, and in any CI system.

## .env parsing

Supported: `KEY=VALUE`, optional `export ` prefix, blank lines, `#` comments, inline comments after unquoted values, simple single- or double-quoted values. Not supported: multiline values, variable expansion (`${VAR}`), escape sequences.

## Development

```bash
node --test            # unit + entrypoint tests (Node 18+)
./scripts/simulate.sh  # runs the action the way the runner does, with pass and fail cases
```

`.github/workflows/test.yml` runs the tests and self-tests the action with `uses: ./`, including fail cases that are expected to fail.

The action runs on the `node24` runtime, which GitHub-hosted runners require for JavaScript actions since Node 20 was removed in September 2026.

## License

MIT — see [LICENSE](LICENSE).
