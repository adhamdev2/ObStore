# OB Launcher publishing and updates

Release publishing and application updates use the OB API. GitHub releases and Git tags are not part of the update flow.

## Configure publishing

Set these values in `electron/.env`:

```env
API_TOKEN=your_update_api_token
API_BASE=https://api.ob1.store
```

The API server must use the matching `UPDATE_API_TOKEN` value.

## Allow large release uploads through Nginx

The publish request sends the standalone installer and its Squirrel package together, so it can be over 250 MiB even when the installer is about 132 MiB. Include [`api/deploy/nginx-update-upload.conf`](../api/deploy/nginx-update-upload.conf) inside the HTTPS server block for `api.ob1.store`. If that exact upload location already exists, add these size and timeout settings to it instead of defining a duplicate location. Then run `nginx -t` and reload Nginx.

## Enable update WebSocket through Nginx

The API update WebSocket listens on port `3005`. The Electron app connects securely through `wss://api.ob1.store/ws/updates`, so the Nginx HTTPS server must proxy that path to port `3005` with the WebSocket upgrade headers. Add [`api/deploy/nginx-update-websocket.conf`](../api/deploy/nginx-update-websocket.conf) inside the `server` block for `api.ob1.store`, then run `nginx -t` and reload Nginx. Without this route, Nginx returns `404` and already-open clients cannot receive update notifications.

## Publish a release

Run one of these commands from `electron/`:

```bash
npm run publish
npm run publish:patch
npm run publish:minor
npm run publish:major
npm run publish:local
node publish.js --retry-upload
```

Use `node publish.js --retry-upload` after a failed upload to resend the already-built version without bumping its version or rebuilding it.

Each command bumps the version, builds the Windows Squirrel installer, copies the installer to `api/data/app.exe`, and uploads the installer with its Squirrel `RELEASES` and `.nupkg` files to `POST /api/update/data/app.exe`. The API stores the release and broadcasts its version over the update WebSocket. `publish:local` also uploads to the configured `API_BASE`; it is an alias for a patch publish.

The `--skip-upload` argument is only for creating a local build. Builds made with that argument do not notify running applications or become available to clients.

## Client update flow

The Electron app authenticates to the API WebSocket with its installed version. The API reports the latest version on connection and broadcasts new releases after upload. The title bar displays the update icon for older versions.

When the user selects the icon, Electron checks the Squirrel feed at `/api/update/win32/<installed-version>/RELEASES` and downloads the update package from the same API. Selecting the icon again after the package downloads restarts the app and installs the update.

The API serves `RELEASES` and the referenced `.nupkg` from the release uploaded by the publish script. `GET /api/update/data/app.exe` remains available for downloading the standalone installer.
