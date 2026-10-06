# AgriMesh

Agriculture demo: **store-and-forward** field readings over **Bluetooth mesh** until they reach a phone at the **farm office edge**, then **one clean upload** to a mock farm system when connectivity returns.

Built on `@offline-app-examples/mesh` (nearby rooms, mesh relay) and `@offline-app-examples/ui`.

## Roles

| Role | Device | Behavior |
| --- | --- | --- |
| **Office edge** | C | Hosts authoritative reading ledger; mock farm sync with `readingId` dedupe |
| **Field collector** | A | Logs seeded plot readings; proposes batches over mesh |
| **Relay worker** | B | Mesh relay only — extends range between field and office |

**Phones:** 3 minimum (office + field + relay). Works with 2 in direct BLE range (skip relay).

## Demo script (~5 min)

1. **C:** Office edge → “North office edge” → **Start** (hosts ledger).
2. **B:** Relay worker → **Start** (between A and C if needed).
3. **A:** Field collector → “Plot walker A” → **Start** (joins office).
4. **A:** Tap **North ridge moisture** (and other templates).
5. **C:** Readings appear on ledger → **Sync to farm system (mock)**.
6. **C:** Sync again → **dupes dropped** increments (presenter strip).

## Run

```sh
pnpm install
cd apps/agrimesh
bundle install
cd ios && bundle exec pod install && cd ../..
pnpm --filter @offline-app-examples/agrimesh dev
```

Second terminal: `pnpm --filter @offline-app-examples/agrimesh ios -- --device` (or Android).

Use **physical phones** with Bluetooth on. Debug builds need Metro.

**If `pod install` fails with `path name contains null byte`:** see retry loop in [Event Floor README](../eventfloor/README.md#run) (same pnpm + CocoaPods flake).

## Reset

Clear app data or reinstall. Seeded plots and reading templates are fixed in `src/domain/plots.ts`.

## Catalogue GIF

Add `demo.gif` in this folder after recording on devices (root README embed when ready).

## Tests

```sh
pnpm --filter @offline-app-examples/agrimesh test
```

## Licensing

Example app code: [MIT-0](../../LICENSE). `@offline-protocol/mesh-sdk` is [AGPL-3.0-only or commercial](https://www.offlineprotocol.com/docs/operations/licensing).
