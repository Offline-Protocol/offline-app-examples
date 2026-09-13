# Tic Tac Together ✳

A small, colorful rivalry between two nearby phones. React Native app for iOS and Android, built with the actual `@offline-protocol/mesh-sdk` 0.24.1 API.

## Run

From the **monorepo root** (`offline-app-examples/`):

```sh
pnpm install
cd apps/tictactogether/ios && pod install && cd ../../..
pnpm --filter @offline-app-examples/tictactogether dev
```

In another terminal (still from the monorepo root):

```sh
pnpm --filter @offline-app-examples/tictactogether ios -- --device
# or, with an Android phone attached:
pnpm --filter @offline-app-examples/tictactogether android
```

You can also `cd apps/tictactogether` and use `pnpm start`, `pnpm ios`, and `pnpm android` directly.

For iOS, open `ios/Tictactogether.xcworkspace`, select your Apple development team under Signing & Capabilities, and run on each phone. Both phones need the same app build, Bluetooth enabled, and Bluetooth/Nearby Devices permission. Android 11 and earlier also need Location permission and Location services enabled.

Debug builds need Metro available to load the app. For fully offline play, install a Release build with the JS bundle embedded (select Release in Xcode’s scheme, or `npm run android -- --mode release`). Android’s included debug signing configuration is for local testing; use your own signing key for distribution.

BLE discovery requires **two physical phones**. A simulator can display the interface but cannot verify nearby Bluetooth play.

## Play

1. On one phone, tap **Host game** and note the **Host code**. On the other, tap **Join game** and wait for that host to appear in the list (matching code).
2. On the guest phone, tap **Connect**. On the host phone, tap **Accept**.
3. The accepting phone plays X; the inviting phone plays O. X starts the first round. The starting mark alternates each rematch.
4. Play your turn. Wins and draws remain in the score for the connection.
5. Either player may request a rematch; the opponent explicitly accepts or declines.
6. If the link drops, the board stays intact. Keep both apps open and move closer; the app retries the same session. **Find another player** starts fresh (host or join again). Explicitly leaving ends the session.

The interface includes animated scanning rings, arriving player cards, drawing marks, turn highlights, a winning line and confetti, a rainy loss graphic, a draw reaction, native haptics, and support for the system Reduce Motion setting.

## SDK integration

`src/mesh.ts` exclusively owns the SDK instance and lifecycle:

- `OfflineProtocol.start`, `localAddress`, Bluetooth checks, MLS initialization.
- `MeshServices.registerService` and `discoverServices`, with `service_discovered` filtered against direct BLE neighbors.
- `sendConnectionRequest`, `acceptConnectionRequest`, `rejectConnectionRequest` and key package exchange.
- `sendMessage` / `message_received` for versioned game packets.
- `unregisterService`, `stop`, and `destroy` for cleanup.

The app uses BLE only with relay/internet transports disabled. Game traffic uses the starter’s `requireEncryption: false` configuration; it does not claim every game message is end-to-end encrypted. No accounts or cloud credentials are required. App and service IDs are fixed in `src/constants.ts` and must match on both phones.

`src/domain/` contains pure game rules. `src/wire.ts` bounds and validates packets. `src/session.ts` implements host-authoritative state, revision checks, repeated snapshots/proposals, ACKs, heartbeats, rematches, and recovery. Only the **join** side discovers nearby hosts; the host advertises and waits for incoming connection requests. Discovery never exposes raw Bluetooth neighbor IDs as joinable players.

## Checks

```sh
npm run typecheck
npm test -- --watchman=false
npm run format:check
```

The automated tests exercise actual domain/session code with an in-memory two-peer transport, including loss, duplicate delivery, stale state/ACKs, scoring, rematches, and reconnection. They do not substitute for an end-to-end two-phone BLE test.

Physical-device acceptance: test iOS↔iOS and iOS↔Android discovery, simultaneous invitations, win/loss/draw presentation, rematch in either direction, leaving, Bluetooth disabled, permission denial, app backgrounding, and walking out of/back into range. Force-quitting starts a new session; scores are intentionally in-memory.

SDK license: AGPL-3.0-only, with a commercial dual license available from Offline Protocol. See the installed SDK’s license files.
