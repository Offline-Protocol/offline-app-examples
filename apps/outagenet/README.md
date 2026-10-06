# OutageNet

Field coordination when towers are down. One phone runs the **command post**; others join as **field units** over **Bluetooth mesh** (no internet, no accounts). Post status updates, **hand off responsibility** with explicit accept, and **sync to a mock HQ** with visible duplicate suppression.

Built on `@offline-app-examples/mesh` and `@offline-app-examples/ui`, Mesh SDK 0.28.

## What it demonstrates

- Host-authoritative ops log with **stable `operationId`** on every record (retries and mesh resends dedupe).
- **Handoff** records stay `pending` until another device sends `accept_handoff`.
- **AsyncStorage** persistence so local history survives an app restart (rejoin the same post to continue).
- **Mock HQ ingest** on the command post: tap **Sync to HQ**; presenter strip shows **dupes dropped** when the same ids are submitted again.
- Aligns with [local handoff](https://www.offlineprotocol.com/docs/guides/local-handoff) and [backend delivery](https://www.offlineprotocol.com/docs/guides/backend-delivery) application patterns.

## Demo script (~5 min, two phones)

1. **Phone A:** Open command post (e.g. name “HQ Alpha”).
2. **Phone B:** Join as field unit (e.g. “Unit 12”). Turn off Wi‑Fi/cellular if you want to stress offline (mesh is Bluetooth-only).
3. **B:** Post status — “Sector 3 cleared”.
4. **B:** Hand off — “You are lead for Sector 2”. **A** or **B** opens pending handoff and taps **Accept** (if B sent it, A sees it on command screen; B accepts from field UI).
5. **A:** **Sync to HQ** — note synced count. Tap again — **dupes dropped** increments.
6. Force-quit **B**, reopen, rejoin — records still on command post; B gets snapshot on join.
7. Optional: **B** also taps sync path via snapshot after A syncs (field strip shows HQ stats from host).

## Run

From the monorepo root:

```sh
pnpm install
cd apps/outagenet/ios && pod install && cd ../../..
pnpm --filter @offline-app-examples/outagenet dev
```

Second terminal:

```sh
pnpm --filter @offline-app-examples/outagenet ios -- --device
# or
pnpm --filter @offline-app-examples/outagenet android
```

Use **two physical phones** with Bluetooth on. Debug builds need Metro; use a Release build for a fully offline demo away from your computer.

## Reset demo

Clear app data (or uninstall), or use two fresh installs. Seeded sectors are fixed in code (`Sector 1`–`3`); edit copy on devices as needed.

## Tests

```sh
pnpm --filter @offline-app-examples/outagenet test
```

Covers idempotent command log, handoff accept, HQ ingest dedupe, and message parsing.

## Licensing

Example app code: [MIT-0](../../LICENSE). `@offline-protocol/mesh-sdk` is [AGPL-3.0-only or commercial](https://www.offlineprotocol.com/docs/operations/licensing).
