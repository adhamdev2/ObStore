# FiveM remote authorization

This repository now exposes a minimal remote execution boundary:

- `POST /api/fivem/auth` accepts a license key and client-provided HWID, then returns a 15-minute JWT.
- `POST /api/fivem/action` accepts only allow-listed actions and returns a short-lived instruction envelope.
- `api/middleware/fivemSecurity.ts` enforces JWT issuer, timestamp, nonce uniqueness, and an HMAC request signature.
- `fivem-resource/client/RemoteStub.cs` performs HTTP asynchronously and contains no formulas, license tables, or executable business logic.

## Important trust boundary

A FiveM client is user-controlled. An HWID, client binary, client HMAC key, and any value shipped to the client can be extracted or altered. The sample therefore derives the per-request HMAC key from the bearer token: this binds the signature to the authenticated token, but is not a secret against a determined client operator. Use HTTPS and keep all real authorization and game-state mutation on a trusted game server or API.

For stronger protection, put a FiveM **server** resource between game clients and this API. Keep `FIVEM_HMAC_SECRET` only in that server resource and the API. The client sends an opaque request ID to the server resource; the server resource signs the canonical request and validates the response signature before emitting a constrained event to clients. Never put `FIVEM_HMAC_SECRET` in a client resource.

## Local setup

1. Generate unrelated high-entropy values for `JWT_SECRET` and `FIVEM_HMAC_SECRET`.
2. Configure the API environment:

```env
NODE_ENV=production
JWT_SECRET=<at-least-32-byte-random-value>
FIVEM_HMAC_SECRET=<at-least-32-byte-random-value>
FIVEM_CLOCK_SKEW_SECONDS=30
FIVEM_LICENSES_JSON={"license-example":{"userId":"discord-user-id","features":["inventory"]}}
```

3. Build and run the API from `api/`:

```powershell
npm ci
npm run build
npm start
```

4. Set `fivem_api_url` in the resource manifest to the HTTPS API origin. Do not hard-code a production token or secret in the resource.

## Production requirements

- Replace the in-memory `usedNonces` map with Redis (atomic `SET key value NX EX`) before running more than one API instance or restarting the process.
- Store license records in a transactional database. Do not use a JSON environment variable for a large or mutable license catalog.
- Put the API behind a TLS-terminating reverse proxy, restrict inbound traffic, and set `trust proxy` only to known proxy hops.
- Use a short JWT lifetime, rotate signing keys with a `kid`, and support revocation by session ID in Redis.
- Record security events without logging tokens, HWIDs, request bodies containing secrets, or full signatures. Alert on nonce failures, invalid-license bursts, and unusual IP/session changes.
- Apply authorization to every action server-side. The client must never be trusted to report economy, inventory, permissions, or feature state.
- Treat “obfuscation” as a speed bump only. Do not place formulas, datasets, signing secrets, or permanent privileged client functions in a downloadable resource.
- For WebSockets, perform the same JWT/session validation during upgrade and require a fresh nonce/timestamp/signature per message; never authenticate only the initial connection.

## Request signing format

The signature is lowercase hex HMAC-SHA256 over:

```text
METHOD\nPATH\nUNIX_TIMESTAMP\nNONCE\nCANONICAL_JSON_BODY
```

The nonce is single-use within the configured clock window. A repeated nonce or stale timestamp returns the same ambiguous `401 Request rejected` response as other authentication failures.
