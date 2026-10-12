# DockHand

Driver to dock office handoffs with no signal, synced to **MyGeotab** when a phone is back online. A **driver** checks in with load details over **Bluetooth**; the **dock office** assigns a dock; both phones sign, so the handoff is a receipt neither side can change afterwards. When either phone reaches the internet, the handoff is written to MyGeotab as Add-In data, next to the GPS fix the vehicle's GO device logged at check-in. No GO hardware changes.

Built on `@offline-app-examples/mesh` and `@offline-app-examples/ui`, Mesh SDK 0.28.

## What it demonstrates

- **Offline handoff.** Check-in and dock assignment travel phone to phone over Bluetooth only. Check-ins are resent until the dock office acknowledges them, and every record has a stable `handoffId`, so resends never duplicate.
- **Signed receipts.** The driver signs the load details with the phone's mesh identity key (Ed25519). The dock office stores a check-in only if the signature verifies *and* the key belongs to the phone that sent it. It then countersigns the driver's exact check-in plus the dock. The driver checks that countersignature against its own copy of what it sent.
- **Sync when online.** Signed in to MyGeotab, a phone retries every 15 s while it has completed handoffs to sync, so taking a phone out of airplane mode is all it takes. Each record is checked by `handoffId` before it is added, so a retry, or both phones syncing, never makes a second record.
- **GO corroboration.** For a MyGeotab vehicle, the synced record carries the GO device's `LogRecord` nearest to check-in time: independent evidence that the truck was at the yard.
- **Verification inside MyGeotab.** The `mygeotab-addin/` page lists the handoffs and checks both signatures in the browser, from the signed texts themselves. What it shows is what was signed.
- **Works without a database.** Not signed in, **Mock** sync runs the same duplicate check on the phone.

## Demo script (~5 min, two phones and a laptop)

Before the demo: sign both phones in to a MyGeotab **test** database (bottom bar, then **Sign in**), and install the Add-In page (below) on the laptop.

1. Put **both phones in airplane mode, then turn Bluetooth back on.** No signal from here on. Do this before anyone joins: in one device run, cutting Wi-Fi seconds after the join left dock assignments not reaching the driver until it left and rejoined.
2. **Phone A:** **Open dock office**, named e.g. "North Yard".
3. **Phone B:** **Check in as driver**, e.g. "Ada", and join North Yard.
4. **B:** pick the vehicle (your MyGeotab devices), keep or edit the load, **Sign and check in**.
5. **A:** the check-in appears. Tap **Dock 3**.
6. **B:** shows **Dock 3 · Driver + yard signed**. The bottom bar says **1 to sync**.
7. **B:** leave the yard, then turn airplane mode off. Within 15 s the bar shows **1 added**.
8. **Laptop:** open **Yard Handoffs** in MyGeotab. The handoff is there with both signatures valid and the GO fix at check-in.
9. **A:** turn airplane mode off and tap **Sync**. It reports **1 duplicate dropped**: the yard's copy of the same handoff was not added twice.

Without a database, skip the sign-in and use **Mock** in step 7; tap it again to see the duplicate check.

## MyGeotab setup

**Use a test database.** MyGeotab API writes take effect immediately.

1. **Sign in on each phone:** bottom bar, then server (`my.geotab.com`), database, user, password. The password is sent once to `Authenticate` and never stored. Only the session is kept, on the phone, until **Sign out** or until it expires (the app then asks again).
2. **Install the page:** host `mygeotab-addin/yardHandoffs.html` and `yardHandoffs.js` together on any HTTPS host. Put that URL in `mygeotab-addin/config.json`, then in MyGeotab open **Administration > System > System Settings > Add-Ins**, turn on **Allow unverified Add-Ins**, add a new Add-In and paste the config. **Yard Handoffs** appears under Activity.

Records are `AddInData` under the add-in id `ADD_IN_ID` (`src/services/mygeotab.ts`, mirrored in `yardHandoffs.js`; a test keeps the two equal). Generate your own id for a real integration.

## Files

| File | What it does |
| --- | --- |
| `src/domain/handoff.ts` | Records, the exact texts each side signs, ledger rules, message validation |
| `src/domain/sync.ts` | What a MyGeotab record contains, which handoffs to sync, mock ingest |
| `src/services/mygeotab.ts` | MyGeotab JSON-RPC: sign in, vehicles, GO GPS records, idempotent AddInData write |
| `src/services/persist.ts` | AsyncStorage: handoffs, sync state, session |
| `App.tsx` | Room roles, signing and verifying, resend and auto-sync loops |
| `mygeotab-addin/` | The MyGeotab page and its Add-In config |

## Limits

- Bluetooth only, as in every app here. iPhone to Android works; keep phones within a few metres for the first join.
- The duplicate check is check-then-add. Two phones syncing the same handoff in the same second can both add it; the MyGeotab page shows it once. A server-side sync service would make it one transaction, and is what a production integration should use, with a service account instead of a driver's session on the phone.
- The page checks that both signatures are valid. It does not re-derive each phone's `off1…` address from its key; the phones did that when the records were made.
- Signature checks in the page need a browser with Ed25519 in WebCrypto (current Chrome, Edge, Safari and Firefox). Older browsers show "cannot check".
- The page and the MyGeotab client are tested against recorded API shapes, not a live database. Run the demo once against your test database before showing it.

## Run

From the monorepo root:

```sh
pnpm install
cd apps/dockhand/ios && bundle exec pod install && cd ../../..
pnpm --filter @offline-app-examples/dockhand dev
```

Second terminal:

```sh
pnpm --filter @offline-app-examples/dockhand ios -- --device
# or
pnpm --filter @offline-app-examples/dockhand android
```

Use **two physical phones** with Bluetooth on. Debug builds need Metro, which needs the network; for the airplane-mode demo install a **Release** build.

## Reset demo

Clear app data or reinstall. Records already written to MyGeotab stay there; remove them through the API (`Remove` on `AddInData`) or use a fresh test database.

## Tests

```sh
pnpm --filter @offline-app-examples/dockhand test
```

Covers the signed texts, ledger dedupe and single assignment, message validation, the record size limit, GO fix selection, mock ingest, the MyGeotab client against a fake server (sign-in redirect, duplicate check, expired session), and the MyGeotab page verifying real Ed25519 signatures and rejecting edits.

## Licensing

Example app code: [MIT-0](../../LICENSE). `@offline-protocol/mesh-sdk` is [AGPL-3.0-only or commercial](https://www.offlineprotocol.com/docs/operations/licensing). Geotab, MyGeotab and GO are trademarks of Geotab Inc.; this example is not affiliated with or endorsed by Geotab.
