# Event Floor

Live-events demo app with **two flows** in one binary: **staff dispatch** when cell is saturated, and **gate admission sync** when scanners cannot reach the cloud. Everything runs over **Bluetooth mesh** (Mesh SDK 0.27) — no Wi‑Fi Direct payload, no accounts.

Built on `@offline-app-examples/mesh` (rooms, MLS group mode, mesh relay) and `@offline-app-examples/ui`.

## Flow A — Staff dispatch

- **Staff sender** hosts an MLS **group** room and broadcasts encrypted staff alerts (demo roster + PIN stand in for OfflineID sign-in).
- **Staff receiver** joins the group and acks alerts.
- **Crowd relay** runs mesh relay only — forwards traffic, UI shows neighbor count, **no staff payload**.

**Phones:** 3 recommended (sender, relay, receiver). Works with 2 in direct BLE range (skip relay).

## Flow B — Gate sync

- **Lead scanner** hosts the admission ledger (host-authoritative snapshots).
- **Gate scanners** propose scans; ledger dedupes **ticket ids** so a second gate shows **already used**.
- **Sync to platform (mock)** ingests by **`scanId`** with visible **dupes dropped** (same pattern as OutageNet HQ).

**Phones:** 2 minimum (lead + scanner); optional third as **gate relay**.

## Demo scripts (~5 min each)

### Staff (Flow A)

1. **A:** Flow A → Staff sender → Security Lead → PIN `1001` → Start.
2. **B:** Crowd relay → Start (between A and C if needed).
3. **C:** Staff receiver → Medical Lead → PIN `2002` → Start (joins sender).
4. **A:** Send “Medic needed — guest assist” for Section B.
5. **C:** Alert appears → **Ack**. Relay strip shows neighbors only.

### Gate (Flow B)

1. **A:** Flow B → Lead scanner → “North gate” → Start.
2. **B:** Gate scanner → “South gate” → Start (joins lead).
3. **A:** Tap **T-1001** → admitted on ledger.
4. **B:** Tap **T-1001** → **already used**.
5. **A:** **Sync to platform** → tap again → **dupes dropped** increments.

## Run

```sh
pnpm install
cd apps/eventfloor
bundle install
cd ios && bundle exec pod install && cd ../..
pnpm --filter @offline-app-examples/eventfloor dev
```

Second terminal: `cd apps/eventfloor && npx react-native run-ios --interactive` (or Android).

Use **physical phones** with Bluetooth on. Debug builds need Metro.

## Reset

Clear app data or reinstall. Seeded tickets and staff PINs are fixed in `src/domain/`.

## Catalogue GIFs

Add `demo-staff.gif` and `demo-gate.gif` in this folder after recording on devices (root README embeds them).

## Tests

```sh
pnpm --filter @offline-app-examples/eventfloor test
```

## Licensing

Example app code: [MIT-0](../../LICENSE). `@offline-protocol/mesh-sdk` is [AGPL-3.0-only or commercial](https://www.offlineprotocol.com/docs/operations/licensing).
