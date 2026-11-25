# Vercel deployment and backups

This is the operating runbook for SQLFlashCards on Vercel with a private Neon PostgreSQL database. The user selected **free plans only** and **new online accounts** on November 25, 2026. Existing local SQLite accounts and their PIN pepper stay on the development computer. Do not copy them into GitHub or the online database. Actual provisioning, publication, backup runs, and restore evidence belong in [Project status](status.md); configuration in the repository alone does not establish that the website is online.

## Service responsibilities

| Service | Responsibility |
| --- | --- |
| Public `RamMarthi9/SQLFlashCards` repository | Source code, reviewed SQL lesson content, tests, project artifacts, and pull requests. Private account records are not Git files. |
| Vercel | Build and serve the Vite website over HTTPS; execute its same-origin Node account API. |
| Neon | Persist private accounts, hashed sessions, topic progress, and authentication counters independently of Vercel deployments. |
| Private `RamMarthi9/SQLFlashCards-backups` repository | Run the scheduled backup caller and retain encrypted database exports as private Actions artifacts for 30 days, separate from Git history and public source. |

The production function must never write an account database or generate a PIN pepper on its temporary filesystem. The browser never receives the database URL or server secrets. Using PostgreSQL for account storage does not change the general SQL learning syllabus. Vercel supports Node functions under `api/`, including a standalone frontend alongside them. See [Vercel's Node runtime documentation](https://vercel.com/docs/functions/runtimes/node-js).

## Provisioning and settings

1. Connect the intended Vercel and Neon accounts, confirm their free plans, and create a dedicated Neon **PostgreSQL 17** database. Match the database region to the Vercel function region where available. Do not purchase services or upgrade a plan without a new budget instruction.
2. Create the Vercel project from `RamMarthi9/SQLFlashCards`. Use the repository's `vercel.json`, **Node 24** for the Vercel runtime, build command `npm run build`, and output directory `dist`. Development and CI also support Node 22 through `.nvmrc`; do not select an unsupported runtime merely because a newer local version exists. The function entry is `api/[...path].js`, backed by the built server handler and bundled catalogue. Publish reviewed source only; record the commit, deployment URL, and outcome in status.
3. Set the following values in **Vercel Production** environment settings, never as `VITE_*` variables or checked-in files. The adapter requires Vercel production execution and rejects API requests in Preview deployments. Do not give previews the production database connection or PIN pepper.

| Vercel setting | Required value |
| --- | --- |
| `DATABASE_URL` | Neon pooled PostgreSQL connection URL with verified TLS, for this application's database only. |
| `APP_ORIGIN` | Exact canonical `https://` website origin, without path or trailing slash. Mutation requests must match it. |
| `SQLFLASHCARDS_PIN_PEPPER` | Stable, privately generated random secret of at least 32 characters; retain a separate recoverable copy. |
| `NODEJS_HELPERS` | `0` at build time and runtime, so the shared request handler receives the Node request stream. Vercel's Production environment setting supplies both. |

`VERCEL` and `VERCEL_ENV` are platform-provided execution settings, not values to imitate on another host. The API uses Vercel's overwritten `x-vercel-forwarded-for` header for the client IP, requiring one valid address; arbitrary forwarding headers are not trusted. Local development and the standalone Node server retain their separate socket-peer proxy configuration.

The PostgreSQL store initializes its `sqlflashcards` schema transactionally, validates the schema version and PIN-pepper marker, and refuses incompatible state. Its bounded pool uses at most two connections per function instance. Account authorization, shared attempt limits, and progress version checks still run in the database. Once accounts exist, changing the pepper without a migration makes their PIN verifiers unusable; restore the original secret instead.

4. Deploy and confirm the canonical HTTPS address. If its origin changes, update `APP_ORIGIN` and redeploy. The production adapter does not infer a trusted mutation origin from a visitor-supplied host header.
5. Complete the release checks below. Enable the backup workflow only after configuring its secrets and running a successful backup/restore drill.

## Free-plan operating limits

Neon's Free restore history is limited to **six hours or 1 GB of changes**, whichever is reached first. This is useful for recent mistakes but does not replace a retained export. Confirm the actual project setting rather than assuming it was activated. Longer restore history and scheduled provider snapshots may require a paid plan, which is not authorized. See [Neon's history-window documentation](https://neon.com/docs/postgres/backup-restore/history-window).

Monitor Vercel, Neon, and private GitHub Actions usage against their free allowances. Quotas can pause service or backup execution; persistent storage means data survives function restarts and redeployments, not unlimited capacity or guaranteed availability. Keep paid spending disabled and report quota problems before considering an upgrade. Recheck provider limits when provisioning rather than relying on this document as a pricing guarantee.

## Daily encrypted backup

The public source repository exposes the reusable `Database backup` workflow in [backup.yml](../../.github/workflows/backup.yml); it has no public schedule or manual backup trigger. A separate caller in the private `RamMarthi9/SQLFlashCards-backups` repository schedules **03:17 UTC / 08:47 India time** daily and supports manual dispatch. Both the reusable-workflow reference and its checked-out `source_ref` must use the same reviewed, full 40-character commit SHA from the public source repository. Do not use a moving branch reference for secret-bearing backup execution.

The private [SQLFlashCards-backups repository](https://github.com/RamMarthi9/SQLFlashCards-backups) has been created and its private visibility verified. Its caller belongs at `.github/workflows/backup.yml`. Keep `BACKUPS_ENABLED` unset or `false` until its secrets and restore drill are ready. The caller requires `BACKUPS_ENABLED=true` before executing either scheduled or manual backups. Its schedule becomes available only on the private repository's default branch. GitHub scheduling can be delayed or dropped; this is a daily target, not a guaranteed recovery-point SLA. Check the latest successful run and artifact age. See [GitHub's scheduled-workflow guidance](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Configure these **GitHub Actions secrets only in the private `SQLFlashCards-backups` repository**. Do not add database access or backup keys to the public source repository:

| Secret | Purpose |
| --- | --- |
| `BACKUP_DATABASE_URL` | Direct, unpooled TLS connection for a dedicated read-only backup role in the production database. |
| `BACKUP_ENCRYPTION_KEY` | A separate cryptographically random 32-byte key encoded in base64; retain a private recovery copy outside GitHub. |

Grant the backup role connection access, `USAGE` on schema `sqlflashcards`, and `SELECT` on all its tables. Configure default table privileges for the role that owns future migrations so new tables remain readable by backups. Do not grant the backup role permission to alter or delete application records. Create its password privately; never put credentials in SQL examples, Git, CLI arguments, logs, or pull requests.

The workflow uses PostgreSQL 17 tools and Node 22. [backup-database.mjs](../../scripts/backup-database.mjs) streams a consistent custom-format `pg_dump` of the `sqlflashcards` schema directly into AES-256-GCM encryption; the archive includes accounts and PIN verifiers, progress, counters, and schema metadata. It retains the sessions table definition but excludes its rows, so restoration requires everyone to sign in again and does not revive revoked sessions. The archive contains no raw PINs, raw session cookies, encryption key, or PIN pepper. `pg_dump` provides a consistent snapshot while writes continue; see the [PostgreSQL backup-tool documentation](https://www.postgresql.org/docs/17/app-pgdump.html).

Only the encrypted file is uploaded as `sqlflashcards-backup-<run-id>-<run-attempt>`, with 30-day retention in the private caller repository. Reusable backup execution requires the private caller boundary; no backup artifact belongs in the public source repository. Artifacts expire and consume the backup repository's storage allowance. Download a recovery copy before expiry when a longer retention period is required; such a change must stay within the user's budget and use private storage. Do not commit archives, decrypted files, private keys, or database records.

With secrets supplied privately in the process environment, a manual backup is:

```text
node scripts/backup-database.mjs --output <private-output-path>
```

The command must succeed and produce an encrypted archive before the backup is counted as completed. A workflow file, a skipped job, or an upload without a usable archive is not backup evidence. Retain the original PIN pepper separately from both the database archive and backup key; restoring the database without the pepper does not restore usable sign-in.

## Restore drill and recovery

1. Download a successful encrypted artifact privately. Keep the production website pointed at its current database during the drill.
2. Create an **empty, isolated PostgreSQL 17 database** for restoration. It must not be the live database or contain unrelated tables. Supply its direct TLS URL through `RESTORE_DATABASE_URL`, its exact database name through `RESTORE_DATABASE_NAME`, and the matching `BACKUP_ENCRYPTION_KEY` through private environment settings.
3. Run the guarded restore script. It requires the explicit empty-target flag, refuses a populated target, authenticates the encrypted archive, and restores transactionally without `--clean`:

```text
node scripts/backup-restore.mjs <encrypted-archive> --confirm-empty-target
```

For private inspection only, the separate decrypt command writes to a new file and removes partial output on authentication failure:

```text
node scripts/backup-crypto.mjs decrypt <encrypted-archive> <new-private-dump-file>
```

4. Confirm the restored sessions table is empty. Point an isolated application instance at the restored database with the **original PIN pepper**. Verify schema/pepper acceptance, fresh account sign-in, expected completion/incompletion values, and separation between two accounts. Test a new write and fresh sign-in. Record the archive/run ID, time, target identity without credentials, counts or expected test results, and outcome in status.
5. For an actual recovery, compare the restored data against the recovery objective before switching the production `DATABASE_URL`; redeploy and repeat the HTTPS checks. Preserve the previous database until recovery is verified. Do not overwrite production merely to test restoration.

An export restores the database snapshot time; later changes are absent. Consider Neon point-in-time recovery for incidents within its retained history, while keeping the encrypted export path for an older or independent restore. Provider restore operations and destination changes must be explicit and verified.

## Release verification

Record actual results, not inferred success, in [status](status.md):

- Repository checks and real PostgreSQL integration tests pass for the published commit; deployment reports success for that source.
- The public HTTPS URL loads the app; API responses are JSON with `no-store`, and session cookies are Secure, HttpOnly, and SameSite=Strict.
- Create two test accounts; completion in one does not appear in the other. Sign out/in, refresh/reopen, and use another browser to verify saved progress.
- Redeploy the same source or exercise a new function instance; saved records remain in Neon. Verify invalid origins, forged account IDs, and excessive attempts are rejected.
- Complete an encrypted backup and isolated restore drill, including restored sign-in with the retained pepper. Confirm the private caller is on its default branch, pins the reviewed source SHA in both places, has its private secrets configured, and is enabled; verify the latest artifact is usable and private.
- Check narrow layout, keyboard navigation, and sign-out. Confirm production secrets are absent from browser assets and logs, and preview API execution cannot access production records.

Hosting, backup activation, and the restore drill are currently separate verification items; use the latest status entry for their completion state.
