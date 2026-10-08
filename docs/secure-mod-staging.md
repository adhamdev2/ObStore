# Secure mod staging

```mermaid
sequenceDiagram
    participant UI as Launcher UI
    participant API as Express API
    participant Main as Electron main process
    participant Temp as Windows %TEMP%
    participant Mods as FiveM.app\mods
    participant Game as FiveM.exe

    UI->>API: POST /mods/:id/license-stub
    API-->>UI: mod_id, license_key, version
    UI->>Main: Save mod_config.json under Electron userData
    Note over Main: Stub only; mod assets are not downloaded here
    UI->>Main: Read stub + calculate SHA-256 HWID
    UI->>API: POST /mods/:id/stage-session {license_key, hwid}
    API->>API: Check current entitlement, expiry, mod and HWID binding
    API-->>UI: sessionId + AES-256-GCM encrypted file envelopes + key (HTTPS)
    UI->>Main: launchSecureFiveM(envelopes, key, sessionId)
    Main->>Main: Authenticate/decrypt each envelope in memory
    Main->>Temp: Write plaintext into isolated ob1_staging_<sessionId> folder
    Main->>Mods: Create temp_<sessionId> directory junction to staging folder
    Main->>Game: Launch FiveM.exe
    Game-->>Main: Process exits
    Main->>Mods: Remove junction
    Main->>Temp: Close handles and recursively remove staging folder
    Main->>API: POST stage-session/:sessionId/terminate
```

## Security boundary

The stub is saved at `%APPDATA%/<app>/mod-stubs/<mod_id>/mod_config.json`. The staging directory is created under the Windows temporary directory, and the junction is placed under the configured `FiveM.app\mods` directory. Asset bytes are not written by the download action.

The existing launcher and API use HTTPS for the staging response. The AES key is transported in the same authenticated TLS response as the encrypted file envelopes; AES-GCM protects the envelope and detects tampering, while TLS protects key delivery in transit. A desktop client that can decrypt the content cannot prevent its owner from extracting it at runtime.

Cleanup removes directory entries and junctions on normal process exit, Electron `before-quit`, and the existing process signal handlers. This is best-effort cleanup, not guaranteed secure erasure: SSD wear leveling, filesystem journals, paging, crash dumps, backups, abrupt power loss, or process termination can preserve data. Avoid paging/hibernation and crash dumps on machines requiring stronger at-rest guarantees; true no-disk persistence requires keeping assets entirely in memory and a FiveM loading interface that accepts memory-backed assets.
