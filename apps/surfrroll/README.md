# SurfrRoll

**MitKat DataSurfr “last mile” demo** for [MitKat Advisory](https://mitkatadvisory.com/): signed incident alerts and employee roll call reach staff over **Bluetooth mesh** when cell and internet fail, then reconcile to a mock **DataSurfr / SOC** ingest when the cloud link returns. Mesh SDK **0.30**.

Built on `@offline-app-examples/mesh` and `@offline-app-examples/ui`.

## What it demonstrates

- **Signed alerts** — demo DataSurfr signature so spoof / rumour traffic is rejected on handsets.
- **SOC console** — pull a mock flood alert when cloud link is on; fan out via mesh snapshots.
- **Staff handsets** — **I'm safe / Need help / SOS** with idempotent `checkInId` proposals.
- **Mesh relay** — extend range when only one phone has internet (airplane-mode peers still get the alert).
- **Mock upstream sync** with visible **duplicate drop** on re-upload (same `checkInId`).

Honest copy: this is not the production DataSurfr product; it shows how Offline Protocol could carry alerts and status when networks fail.

## Roles

| Role | Phones | Behavior |
| --- | --- | --- |
| SOC console | 1 | Hosts mesh ledger; cloud link toggle; receive alert; upload roll call (mock) |
| Staff handset | 2–4 | Demo employee + PIN; verify alert; check in over mesh |
| Mesh relay | 0–1 | Optional hop between SOC and distant staff |

**Recommended:** 4 phones (SOC + 3 staff) or 5 with a relay.

## Demo script (~5 min)

1. **SOC:** Start console. Leave **cloud link** off — mesh works; no new alert from “DataSurfr”.
2. **Staff:** Join mesh (airplane mode + Bluetooth is fine after first snapshot). Waiting for alert.
3. **SOC:** Turn **cloud link** on → **Receive flood alert (mock DataSurfr)**. Staff see verified critical alert.
4. **Staff:** Tap **I'm safe**, **Need help**, or **SOS** on different phones. SOC roll call fills in.
5. **SOC:** **Upload roll call to DataSurfr (mock)**. Presenter strip: rows, awaiting upload, dupes dropped.
6. Tap upload again — **dupes dropped** increments, row count stable.
7. *(Optional)* **Relay** between SOC and a distant handset; repeat check-in.

### Side stories (not built in this app)

- Offline incident sitrep co-edit (investigations).
- Office evacuation muster with floor wardens.

## Run

```sh
pnpm install
cd apps/surfrroll
bundle install
cd ios && bundle exec pod install && cd ../..
pnpm --filter @offline-app-examples/surfrroll dev
```

Second terminal: `cd apps/surfrroll && npx react-native run-ios --interactive` (or Android).

Use **physical phones** with Bluetooth on. Debug builds need Metro.

## Reset

Clear app storage or reinstall. Demo roster PINs are in `src/domain/roster.ts`.

## Tests

```sh
pnpm --filter @offline-app-examples/surfrroll test
```

## Licensing

MIT-0 — see repository root.
