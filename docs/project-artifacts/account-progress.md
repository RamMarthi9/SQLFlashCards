# Accounts and saved progress

The user requested that each learner's completion belong to an account on the website, with sign-up requiring only a name and a four-digit PIN. This replaces browser-only progress as the authoritative design. See the [HLD](hld.md), [LLD](lld.md), and [status](status.md) for surrounding scope and actual verification.

## Account experience

Sign up with a unique name and a PIN containing exactly four digits. The PIN is handled as a string, so values with leading zeroes remain valid. Sign-in uses the same two fields. Names contain 2–40 characters from letters, numbers, spaces, periods, underscores, and hyphens; normalization trims and collapses whitespace, applies Unicode normalization, and compares names without case distinctions. Another account cannot reuse the normalized name.

This is a PIN, not a WebAuthn/device passkey. Four digits provide only 10,000 possible values. Slow hashing, a separate server secret, and attempt limits reduce guessing risk but do not make this a strong credential or a design for sensitive personal records. No email address is collected, and forgotten-PIN recovery is not implemented; the app must state this limitation without adding more sign-up fields.

After sign-in, the learner sees the account's own completed/incomplete topics and can sign out. Switching accounts replaces the learning instance and clears the previous account's displayed records. A session check runs when the app starts and returns to the foreground. Authentication errors show a sign-in/retry state; the app never silently saves account progress to anonymous browser storage.

## Data ownership

The Node API stores hosted account data in private Neon PostgreSQL. Local development retains the persistent SQLite file, normally `user-data/accounts.sqlite`. Both adapters preserve the same account/progress contract; neither database engine changes the app's general SQL syllabus. GitHub contains code and lesson content, not private account records. The user chose new online accounts, so local test accounts are not migrated or removed.

| Logical record | Ownership and purpose |
| --- | --- |
| Account | Stable random ID, unique normalized name, display name, salted PIN verifier, and creation time. |
| Session | Hash of an opaque random session token, owning account ID, and expiry. The raw token is held in an HttpOnly cookie. |
| Topic progress | Composite account/topic identity, completion flag, completion/change timestamps, and optimistic-concurrency version. |
| Attempt limit | Persistent account/IP counters and windows for authentication and account creation. Restarting the process does not reset them. |

Every progress request is authorized by the current session. The expected-account header is only an additional stale-request guard: it cannot authenticate a caller or select another account's data. A write reads and compares the existing version inside the same transaction that updates the row. A missing row has version 0; a stale write returns the current record without changing it. PostgreSQL also serializes concurrent first writes before the row exists, while shared database attempt counters apply across Vercel instances. The server supplies timestamps and validates active topic identity and availability before allowing new completion.

Clearing browser site data removes the session cookie and any old local records, but does not delete the account or server progress. Signing in again restores server progress. Another browser can see the same records only by signing in to the same server with the same account. The website/API must be running; there is no offline queue or automatic browser fallback.

## HTTP API

The client uses same-origin requests with cookies. Account and progress responses are not publicly cached. Mutations require JSON, an allowed `Origin`, and `X-SQLFlashCards-Request: 1`; the server does not enable cross-origin access. Progress requests also carry `X-Account-ID` matching the authenticated account.

| Method and path | Request | Response and responsibility |
| --- | --- | --- |
| `GET /api/session` | Session cookie if present | `{ account: { id, name } }` or `{ account: null }`. |
| `POST /api/signup` | `{ name, pin }` | Create an account, issue a new session, and return its public account identity. Reject duplicate normalized names. |
| `POST /api/login` | `{ name, pin }` | Verify credentials, issue a new session, and return the account identity. Invalid credentials use a generic error. |
| `POST /api/logout` | Empty JSON object and expected-account header while signed in | Revoke the current session and expire its cookie; reject a stale account's sign-out attempt. |
| `GET /api/progress` | Expected-account header | `{ accountId, progress }` for the authenticated account only. |
| `PUT /api/progress/:topicId` | `{ covered, expectedVersion }` | `{ kind: 'saved', progress }` after commit, or `{ kind: 'stale', current }` without overwriting. |

Errors use `{ error: { code, message } }`. The client distinguishes unavailable service, invalid input, invalid/expired session, changed account, duplicate name, and throttled attempts. Requests have a 15-second client timeout and are cancelled when their account workspace closes. It reports failure without claiming that progress was saved. It never uses an account ID, PIN, or session token in URLs.

## Authentication and session protections

- PIN verifiers use salted, deliberately slow `scrypt` hashing with a secret pepper kept outside the database. Raw PINs are neither stored nor logged. Comparison uses a constant-time check.
- Sessions use random 256-bit tokens and store only their hashes on the server. Cookies are HttpOnly, SameSite=Strict, scoped to the site, and Secure in production; sessions expire after 30 days. Sign-out revokes the token server-side.
- Failed sign-in attempts are limited per normalized account and per connecting IP; account limits also apply across different IPs. Account creation is separately limited. Counters survive restarts and are shared by function instances. The Vercel adapter accepts only the platform-overwritten `x-vercel-forwarded-for` single-IP value; the standalone server trusts forwarding headers only from its one configured socket peer.
- The selected policy permits at most 5 failed attempts per account in 15 minutes and 10 per day, with an IP limit of 20 in 15 minutes; sign-up is limited to 5 per IP per hour. A blocked attempt returns a retry delay instead of testing additional PINs. These are application limits, not a claim of strong PIN security.
- Mutation origin/header checks protect browser session actions; authorization and expected versions protect ownership and concurrent updates. A bounded body size and authentication work limits constrain avoidable server load.

Production HTTPS is required to protect credentials and cookies in transit. Do not publish databases, generated secret files, credentials, or learner records in Git. The design uses the general principles in the [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [password-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), and [session-management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html); choosing a short PIN does not meet their recommendations for a strong standalone password.

## Existing browser progress

Legacy progress in IndexedDB is not automatically assigned to an account, because a browser may be shared. A signed-in learner can explicitly import their own saved browser progress. Import preserves the original IndexedDB records, skips retired/unavailable new completion as appropriate, and never overwrites a topic record already present in the account. Each new record uses expected version 0 so a concurrent account update also wins. A partial failure can be retried safely; account changes stop the operation from writing into another account.

## Running and operating the service

`npm run dev` builds the server and starts the API plus Vite from one command. The development frontend is `http://127.0.0.1:5173`; the API normally listens on port 3001 through Vite's `/api` proxy. Restart development after changing server code; client edits use Vite's normal refresh behavior.

`npm run build` creates the client and compiled server. `npm run preview` serves the built website and API locally, normally on port 4173. `npm start` starts the production server; it requires a production HTTPS origin and a private PIN pepper. The root [README](../../readme.md) is the canonical command reference.

Run standalone commands from the repository root. A standalone release retains `dist/`, `dist-server/`, `package.json` (ES module mode), and `src/content/catalog.json`; the server reads that catalogue to validate topic changes. The Vercel configuration serves `dist/` and bundles the Node API with its catalogue. Deploying only browser assets is insufficient for accounts.

Cookies are scoped by host/path rather than port: development and preview on `127.0.0.1` may reuse a session cookie. Legacy IndexedDB is scoped to the full origin, including port, so importing old browser records must be done from the origin where they were stored. The account database selected by `DATA_DIR` determines the server records independently of either browser storage context.

| Setting | Purpose |
| --- | --- |
| `HOST` | Server bind address; local use defaults to loopback. Choose explicitly for the production network boundary. |
| `PORT` | Server listen port. |
| `APP_ORIGIN` | Exact website origin accepted for mutation requests; production requires HTTPS. |
| `DATA_DIR` | SQLite data directory for standalone/local operation; defaults to ignored `user-data/`. Not a Vercel persistence mechanism. |
| `DATABASE_URL` | Private Neon pooled TLS connection for the Vercel PostgreSQL store. Never exposed as a browser build variable. |
| `SQLFLASHCARDS_PIN_PEPPER` | Private secret of at least 32 characters. Production requires an explicit value. Development generates and retains `user-data/pin-pepper` if no value is supplied. |
| `API_PORT` | Development launcher override for the API port; does not change the frontend's origin. |
| `TRUSTED_PROXY_IP` | Optional exact socket-peer IP for one trusted reverse proxy. Only that peer may supply the rightmost `X-Forwarded-For` client address. |
| `NODEJS_HELPERS` | Set to `0` at build time and runtime through Vercel Production settings to preserve the Node request stream for the shared handler. |

Keep the database and PIN pepper across restarts and deployments. Losing the pepper makes existing PIN verifiers unusable; initialization rejects a pepper that does not match the database. For local SQLite, retain the data directory and use a consistent backup compatible with WAL/journal mode. Vercel uses Neon instead of a function-local SQLite file. The [deployment runbook](deployment.md) defines encrypted PostgreSQL exports, secret recovery, retention, and restoration into an isolated database.

A standalone production operator must configure TLS, persistent storage, process management, request-size/rate controls, and a trusted network/proxy boundary. Behind one HTTPS reverse proxy, set `TRUSTED_PROXY_IP` to its actual direct peer and configure that proxy to append or overwrite `X-Forwarded-For` using the real connecting client. Only the rightmost valid address is used; client-supplied forwarding headers from other peers are ignored. Without this setting, proxied users share the proxy's IP attempt budget. Multi-proxy chains need an explicit deployment design rather than broad header trust.

The Vercel path has a dedicated deployment adapter: it requires `VERCEL=1`, `VERCEL_ENV=production`, an explicit HTTPS origin, a private PostgreSQL connection, and a stable pepper. Preview API execution is disabled; production secrets belong only to Production scope. Missing configuration fails closed rather than creating a database or pepper in temporary storage. Vercel terminates HTTPS, and account data persists in Neon across deployments. The store creates and validates the `sqlflashcards` schema transactionally and keeps a bounded connection pool. The user authorized free plans only; service provisioning and successful live checks must be recorded in [status](status.md), separately from source preparation.

## Verification and follow-up

The automated checks should cover separate accounts, unauthorized/forged-account requests, restart durability, leading-zero PINs, PIN verification, session expiry/revocation, throttling across restarts, origin checks, malformed input, stale writes, and old-account response isolation. Client tests cover sign-up/sign-in errors, account switching, import, loading/retry states, and absence of browser-only fallback. Record only executed evidence in [status](status.md).

Manual checks must confirm that a topic remains saved after refresh and browser restart, after signing out/in, and from a separate profile connected to the same server. A second account must begin independently. Clearing data in an isolated test profile should require sign-in again and restore its saved server progress. Test keyboard operation, narrow layouts, expired-session recovery, and service outages before release.

This hosting release includes Vercel/Neon deployment and encrypted backup/restore tooling; live deployment and restore evidence remain separate release requirements in status. Account recovery, stronger authentication, review history, scheduling/proficiency rules, and Android packaging remain follow-up work.
