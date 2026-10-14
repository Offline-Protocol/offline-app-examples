# ChargeCatch

EV-style **charge site demo**: sessions are recorded on charge points when **head office** is offline, collected on a **site hub** over **Bluetooth mesh**, then **reconciled once** to a mock CMS when connectivity returns. Matches the adoption story behind local session cache + upload on reconnect (SDK 0.28).

Built on `@offline-app-examples/mesh` and `@offline-app-examples/ui`.

## What it demonstrates

- **Local-first sessions** on charge points during comms or CMS outage.
- **Site hub** as authoritative ledger for all chargers on the mesh.
- **Field tech** clears a **comms fault** so pending sessions retry upstream.
- **Mock CMS ingest** with visible **duplicate drop** on re-upload (same `sessionId`).
- Honest copy: charging can continue offline; **head office reconciliation** is the demo payoff.

## Roles

| Role | Phones | Behavior |
| --- | --- | --- |
| Site hub | 1 | Hosts mesh ledger; toggle head office link; upload to CMS (mock) |
| Charge point | 1–2 | Start/stop seeded RFID sessions; queue when fault or hub unreachable |
| Field tech | 1 | Clears charger comms faults after “repair” |

**Recommended:** 4 phones (hub + CP-A + CP-B + tech). Minimum 3 (hub + one charger + tech).

## Demo script (~5 min)

1. **Hub:** Start site hub. Leave **head office link** off.
2. **Chargers:** CP-A and CP-B join hub. Run 2–3 sessions each (tap card → stop charge).
3. **Hub:** Sessions appear; **awaiting CMS** &gt; 0. CMS rows still 0 until upload.
4. **Hub:** Toggle **comms fault** on CP-B (or charger shows fault). Record a session on B — queues locally.
5. **Tech:** Join, **Mark comms repaired** on CP-B. Pending sessions reach hub.
6. **Hub:** Turn **head office link** on → **Upload to CMS (mock)**. Presenter strip: cms rows, dupes dropped.
7. Tap upload again — **dupes dropped** increments, row count stable.

## Run

```sh
pnpm install
cd apps/chargecatch
bundle install
cd ios && bundle exec pod install && cd ../..
pnpm --filter @offline-app-examples/chargecatch dev
```

Second terminal: `cd apps/chargecatch && npx react-native run-ios --interactive` (or Android).

Use **physical phones** with Bluetooth on. Debug builds need Metro.

## Reset

Clear app storage or reinstall. Seeded cards and charger ids are fixed in `src/domain/cards.ts`.

## Tests

```sh
pnpm --filter @offline-app-examples/chargecatch test
```

## Licensing

Example app code: [MIT-0](../../LICENSE). `@offline-protocol/mesh-sdk` is [AGPL-3.0-only or commercial](https://www.offlineprotocol.com/docs/operations/licensing).
