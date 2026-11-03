# Stock Sync

Count stock together, even with no signal.

One phone opens a store and the others nearby join it over Bluetooth. Everyone sees the
same small supermarket inventory (milk, bread, apples, eggs, bananas, cheese, cereal,
tomatoes), and tapping − or + on any phone updates the count on every phone. No internet,
accounts or servers. Built on `@offline-app-examples/mesh` (a thin room layer over
`@offline-protocol/mesh-sdk` 0.28, see `packages/mesh/README.md`) and
`@offline-app-examples/ui`.

## What it demonstrates

- Hosting and joining a nearby room with the shared `NearbyLobby` screen and `useNearbyRoom`.
- Host-authoritative sync done by hand: plain React state and small JSON messages, no CRDT.
- Validating everything that arrives from another device before using it.
- Handling a flaky link: members keep working while the host is out of range, and get the
  full inventory again when it comes back.
- Optional barcode scanning on Zebra Android devices through DataWedge, using the same op as a
  tap (see [Zebra devices](#zebra-devices)).

## How sync works

The host owns the inventory. When a member taps − or +, it changes its own count right away
(so the tap feels instant) and sends the host a tiny `adjust` op. The host applies it (never
below 0), bumps a revision number and broadcasts the whole inventory as a `snapshot`. Members
replace their state with any snapshot at least as new as the one they have, which confirms or
corrects their early change, and ignore older ones that arrive late. The host also sends a
snapshot whenever a member joins or comes back into range. A card flashes teal when a change
from another phone lands, or when you scan its barcode.

```
member                         host                          other members
  | tap +  (count shown now)     |                                  |
  |-- {type:'adjust',            |                                  |
  |    productId:'milk',delta:1}>| applies, rev 7 -> 8              |
  |<- {type:'snapshot', rev:8, stock:{milk:13, ...}} -------------->|
```

All of this lives in `src/domain/stock.ts` (a pure reducer plus message validation) and about
thirty lines of `App.tsx`.

| File | What it does |
| --- | --- |
| `App.tsx` | Room wiring: who sends what, lobby vs. inventory |
| `src/domain/stock.ts` | Products and their barcodes, reducer, wire messages and their validation (tested) |
| `src/scanner.ts` | `useScanner`: barcode scans from the native DataWedge module, if there is one |
| `src/ui/inventory.tsx` | Inventory screen: header, reconnecting banner, scan notice, product cards |
| `src/ui/illustrations.tsx` | Flat SVG product illustrations |
| `android/.../DataWedgeModule.kt` | Android only: receives DataWedge scan broadcasts, sets up the DataWedge profile |
| `zebra/` | Scan simulator and the Zebra deployment kit (see [Zebra devices](#zebra-devices)) |

## Run

From the **monorepo root**:

```sh
pnpm install
cd apps/stocksync/ios && pod install && cd ../../..
pnpm --filter @offline-app-examples/stocksync dev
```

In another terminal:

```sh
pnpm --filter @offline-app-examples/stocksync ios -- --device
# or, with an Android phone attached:
pnpm --filter @offline-app-examples/stocksync android
```

For iOS you can also open `ios/StockSync.xcworkspace`, pick your development team under
Signing & Capabilities and run on each phone. Every phone needs Bluetooth on and the
Bluetooth / Nearby Devices permission.

Debug builds load JavaScript from Metro. To use the app fully offline, install a Release build
(select Release in Xcode's scheme, or `pnpm android -- --mode release`).

Nearby discovery needs **two or more physical phones**. Simulators show the interface but never
find each other.

## Try it

1. On one phone, type a store name and tap **Open a store**. The inventory opens right away.
2. On the others, type your name, tap **Join a store** and pick the store from the list.
3. Tap − and + on any phone and watch the counts change everywhere. Cards show **Low** at 2 or
   fewer and **Out** at 0.
4. Walk a member out of range: it shows "Reconnecting to store…" and catches up when it is back.
   **Close store** on the host ends the session for everyone.

## Zebra devices

On Zebra Android devices, scanning an item's barcode adds one to it on every phone, exactly
like tapping +. Taps still work everywhere, and on phones without a Zebra scanner (and on iOS)
the app works as before.

| Item | Barcode (EAN-13) |
| --- | --- |
| Milk | 2000000000015 |
| Bread | 2000000000022 |
| Apples | 2000000000039 |
| Eggs | 2000000000046 |
| Bananas | 2000000000053 |
| Cheese | 2000000000060 |
| Cereal | 2000000000077 |
| Tomatoes | 2000000000084 |

The codes use the GS1 in-store prefix 20, so they never match a real product. Print them with
any EAN-13 label generator. A barcode that isn't in the table shows a short "Unknown barcode"
message and changes nothing.

**Scanner setup.** Nothing to do by hand. When the app starts on a device with
[DataWedge](https://techdocs.zebra.com/datawedge/latest/guide/about/), it creates or updates a
DataWedge profile named `StockSync` through the
[SET_CONFIG](https://techdocs.zebra.com/datawedge/latest/guide/api/setconfig/) intent API:
barcode input on, intent output on with action `com.offlineappexamples.stocksync.SCAN`
delivered as a broadcast, keystroke output off, associated with the app. The inventory header
then shows "Scanner ready". Several plugins in one SET_CONFIG call needs DataWedge 6.5 or later.

**Without a Zebra device.** The app listens for that broadcast on any Android phone, so you can
send the same intent DataWedge sends
([intent output extras](https://techdocs.zebra.com/datawedge/latest/guide/output/intent/))
with adb. Open a store first, then:

```sh
apps/stocksync/zebra/simulate-scan.sh 2000000000015
# which runs:
adb shell am broadcast -a com.offlineappexamples.stocksync.SCAN \
  --es com.symbol.datawedge.data_string 2000000000015 \
  --es com.symbol.datawedge.label_type LABEL-TYPE-EAN13 \
  --es com.symbol.datawedge.source scanner
```

Milk goes up by one on every phone in the store. The "Scanner ready" line only appears where
DataWedge is installed.

**Deployment kit.** [`zebra/`](zebra/) has an MX XML profile for StageNow or an EMM that turns
off battery optimisation for the app, pre-grants its Bluetooth, nearby Wi-Fi and location
permissions, and turns Bluetooth, Location and Wi-Fi on, plus an optional allowlist profile.
[`zebra/IT-GUIDE.md`](zebra/IT-GUIDE.md) explains what each setting is for and how to apply it.
Each setting cites its Zebra TechDocs page, and the few that the docs don't settle are marked
UNVERIFIED.

The scanning code and the kit follow Zebra's published docs. They haven't been run on Zebra
hardware yet, and this is not a Zebra-validated app.

## Checks

```sh
pnpm --filter @offline-app-examples/stocksync typecheck
pnpm --filter @offline-app-examples/stocksync test
pnpm --filter @offline-app-examples/stocksync lint
```

The tests cover the reducer, message validation and barcode-to-item mapping, not the Bluetooth
link or the native scanner module.

## Licensing

This example's code is licensed under MIT-0 (see the repository's
[LICENSE](../../LICENSE)). It depends on `@offline-protocol/mesh-sdk`, which is
licensed under AGPL-3.0-only or a commercial license from Offline Protocol, Inc.
An app that embeds the SDK, including one built from this example, is subject to
the AGPL-3.0-only unless you hold a commercial license. See
[Licensing](https://www.offlineprotocol.com/docs/operations/licensing).
