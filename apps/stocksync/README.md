# Stock Sync

Count stock together, even with no signal.

One phone opens a store and the others nearby join it over Bluetooth. Everyone sees the
same small supermarket inventory (milk, bread, apples, eggs, bananas, cheese, cereal,
tomatoes), and tapping − or + on any phone updates the count on every phone. No internet,
accounts or servers. Built on `@offline-app-examples/mesh` (a thin room layer over
`@offline-protocol/mesh-sdk` 0.27, see `packages/mesh/README.md`) and
`@offline-app-examples/ui`.

## What it demonstrates

- Hosting and joining a nearby room with the shared `NearbyLobby` screen and `useNearbyRoom`.
- Host-authoritative sync done by hand: plain React state and small JSON messages, no CRDT.
- Validating everything that arrives from another device before using it.
- Handling a flaky link: members keep working while the host is out of range, and get the
  full inventory again when it comes back.

## How sync works

The host owns the inventory. When a member taps − or +, it changes its own count right away
(so the tap feels instant) and sends the host a tiny `adjust` op. The host applies it (never
below 0), bumps a revision number and broadcasts the whole inventory as a `snapshot`. Members
replace their state with any snapshot at least as new as the one they have, which confirms or
corrects their early change, and ignore older ones that arrive late. The host also sends a
snapshot whenever a member joins or comes back into range. A card flashes teal when a change
from another phone lands.

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
| `src/domain/stock.ts` | Products, reducer, wire messages and their validation (tested) |
| `src/ui/inventory.tsx` | Inventory screen: header, reconnecting banner, product cards |
| `src/ui/illustrations.tsx` | Flat SVG product illustrations |

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

## Checks

```sh
pnpm --filter @offline-app-examples/stocksync typecheck
pnpm --filter @offline-app-examples/stocksync test
pnpm --filter @offline-app-examples/stocksync lint
```

The test covers the reducer and message validation, not the Bluetooth link.

## Licensing

This example's code is licensed under MIT-0 (see the repository's
[LICENSE](../../LICENSE)). It depends on `@offline-protocol/mesh-sdk`, which is
licensed under AGPL-3.0-only or a commercial license from Offline Protocol, Inc.
An app that embeds the SDK, including one built from this example, is subject to
the AGPL-3.0-only unless you hold a commercial license. See
[Licensing](https://www.offlineprotocol.com/docs/operations/licensing).
