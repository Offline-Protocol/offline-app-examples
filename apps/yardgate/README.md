# YardGate

Logistics yard check-in when there is no cellular: a **driver** discovers a **gate check-in service** over **Bluetooth mesh**, submits a seeded load / trailer ID, and the **gate officer** approves or denies on their phone. An optional **yard relay** phone carries traffic when the driver is not in direct range of the gate.

Mesh SDK **0.28** — `MeshServices` discover + invoke only (no Proof of Location; invoke bodies are signed plaintext — no secrets). Service responses use SDK status strings **`ok`**, **`error`**, or **`not_found`** (not HTTP codes like `200`).

![YardGate demo: Android and iOS yard check-in over Bluetooth mesh](./demo.gif)

## What it demonstrates

- **`yardgate-gate` service** — register on the gate device, discover from the driver (multi-hop when relay is in the middle).
- **Human approver** — pending queue on the gate officer UI; driver sees approve/deny result.
- **Idempotent check-ins** — stable `checkInId`; duplicate mesh deliveries increment **idempotent replays** on the gate strip.
- Aligns with [nearby service](https://www.offlineprotocol.com/docs/guides/nearby-service) patterns.

## Demo script (~5 min, three phones)

1. **Phone C (gate):** Role **Gate officer**, name e.g. “North Gate”.
2. **Phone B (relay):** Role **Yard relay**, name e.g. “Mid yard” — place between driver and gate if needed.
3. **Phone A (driver):** Role **Driver**, name e.g. “Unit 7”. Turn off Wi‑Fi/cellular to stress offline (mesh is Bluetooth-only).
4. **A:** Pick a seeded load, select the discovered gate (note hop count with relay), **Submit check-in**.
5. **C:** Tap **Approve** or **Deny** — **A** shows the decision without walking to the office.
6. Optional: resubmit the same flow after approve — gate **idempotent replays** increments if the SDK redelivers the same `checkInId`.

## Run

From the monorepo root:

```sh
pnpm install
cd apps/yardgate
bundle install          # once — pins CocoaPods (same as other apps in this repo)
cd ios && bundle exec pod install && cd ../..
pnpm --filter @offline-app-examples/yardgate dev
```

`ios/Pods/` is gitignored; **`pod install` is required** before the first iOS build (otherwise Xcode errors about missing `Pods-YardGate.debug.xcconfig`).

Second terminal:

```sh
cd apps/yardgate && npx react-native run-ios --interactive
# or
pnpm --filter @offline-app-examples/yardgate android
```

Use **physical phones** with Bluetooth on. Debug builds need Metro; use a Release build for demos away from your computer.

## Reset demo

Clear app data or reinstall. Seeded loads are fixed in code (`LD-1042`, etc.).

## Tests

```sh
pnpm --filter @offline-app-examples/yardgate test
```

## Licensing

Example app code: [MIT-0](../../LICENSE). `@offline-protocol/mesh-sdk` is [AGPL-3.0-only or commercial](https://www.offlineprotocol.com/docs/operations/licensing).
