# tictactogether — custom P2P app guide

Offline-first React Native app with a **four-layer custom wire protocol** scaffolded by the `offline` CLI / MCP server (workflow `custom-p2p-app`).

## Architecture (do not break this layout)

| Layer | Path | Rules |
|-------|------|-------|
| Domain | `src/domain/` | Pure app logic. **No** `@offline-protocol/mesh-sdk` imports. |
| Wire | `src/wire.ts` | Versioned JSON messages + `decode()` validation |
| Session | `src/session.ts` | Sync state machine — pick archetype from skill `p2p-sync-patterns` |
| Mesh | `src/mesh.ts` | **Only** file that imports mesh-sdk |
| Debug | `src/debug.ts` | Console logs — filter on `LOG_TAG` in constants |

UI binds to `session.view` via `App.tsx` and `src/ui/PeerDiscovery.tsx` — never handle raw protocol events in screens.

## Discovery (do not break)

1. Host registers MeshServices with `lobby` + display name.
2. Guest discovers via `service_discovered` — **only join listed hosts**.
3. Never add “connect to raw neighbor” buttons.
4. Host must tap **Accept** after guest requests join.
5. Filter device logs with `LOG_TAG` (Xcode console / `adb logcat | grep …`).

## Build order

1. Read skills: `p2p-app-architecture`, `p2p-discovery-patterns`, `p2p-sync-patterns`.
2. Implement domain logic in `src/domain/`.
3. Extend message types in `src/wire.ts`.
4. Adapt `src/session.ts` for your sync archetype (default: host-authority skeleton).
5. Build session UI in `App.tsx` (replace sample buttons).

## Config

- `src/constants.ts` — `APP_ID` (must match on all devices), `SERVICE_NAME`, transport/discovery profile
- Discovery mode: `mesh-services`
- Transport: `nearby-only`

## Hard rules

1. **One `OfflineProtocol` instance** — owned by `MeshSession` in `src/mesh.ts`.
2. **Permissions before `start()`** — see `src/permissions.ts`.
3. **BLE requires physical devices** — simulators will not discover peers.
4. **Same `APP_ID` on every device** or peers cannot connect.
5. For chat/group apps, use workflow `nearby-chat` instead — this template is for custom protocols.

## Reference

- TicTacMesh: `test/TicTacMesh` in the OfflineProtocol monorepo
- MCP: `get_skill` before writing SDK code

```bash
npm run android
npm run ios
offline doctor
```

## Licensing

`@offline-protocol/mesh-sdk` is AGPL-3.0-only (commercial dual license available).
