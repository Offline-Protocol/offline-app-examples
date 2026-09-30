# Order Up

A tiny restaurant point of sale that works with no Wi-Fi and no internet. Waiters
take orders on their phones and send them to a kitchen display over Bluetooth; the
kitchen moves each ticket from New to Cooking to Ready, and every waiter sees the
status change live.

It shows how to build a **host-authoritative** app on
[`@offline-protocol/mesh-sdk`](https://www.npmjs.com/package/@offline-protocol/mesh-sdk)
0.27 with plain JSON messages and a small pure reducer, with no CRDTs and no server. The
Bluetooth side (discovery, joining, encryption) lives in `packages/mesh`
(`useNearbyRoom`). UI components come from `packages/ui`.

## Run

From the **monorepo root** (`offline-app-examples/`):

```sh
pnpm install
cd apps/orderup/ios && pod install && cd ../../..
pnpm --filter @offline-app-examples/orderup dev
```

In another terminal (still from the monorepo root):

```sh
pnpm --filter @offline-app-examples/orderup ios -- --device
# or, with an Android device attached:
pnpm --filter @offline-app-examples/orderup android
```

For iOS, open `ios/OrderUp.xcworkspace`, pick your Apple development team under
Signing & Capabilities, and run on each device. Debug builds load JavaScript from
Metro; for a truly offline demo install a Release build (JS bundle embedded).

You need **two or more physical phones or tablets** with Bluetooth on and Bluetooth
permission granted. Simulators render the screens but never discover each other.
iOS keeps about 4 Bluetooth links per device, so plan on one kitchen and up to ~4
waiters.

## Use

1. **Kitchen** (a tablet works best): type the kitchen's name, tap **Open the kitchen**.
2. **Waiters**: type your name, tap **Join a kitchen**, then tap the kitchen when it
   appears in the list.
3. A waiter picks a table, taps dishes to add them, adds an optional note and taps
   **Send to kitchen**. The order shows under **My orders** as *Sending…* until the
   kitchen confirms it.
4. The kitchen taps **Start cooking**, **Mark ready**, then **Clear** once served.
   Waiters see New, Cooking, Ready and Served.
5. If a waiter walks out of range, a *Reconnecting to kitchen…* banner shows. Orders
   placed meanwhile are sent as soon as the kitchen is back. **Leave** ends the session.

## How sync works

The kitchen owns the truth. A waiter sends a `place` message with an order whose id it
made up itself. The kitchen adds the order only if that id is new (so resending is
harmless) and broadcasts a `snapshot` of all open orders plus the ids of recently
served ones, tagged with a revision number. Waiters ignore snapshots older than the one
they have, and show each of their orders' status from the latest snapshot. Any order no
snapshot has mentioned yet is resent: when a snapshot arrives without it, when the
kitchen reconnects, and every 10 s as a safety net. The kitchen also sends a full
snapshot to every device that (re)joins, and answers a duplicate `place` with one.
Every incoming message is validated before use.

```
waiter                                   kitchen
  | -- place {id, table, items, note} -->  |  new id? add as "new", rev++
  | <-- snapshot {rev, orders, served} --  |  (to everyone)
  |                                        |  tap: new -> cooking -> ready -> cleared
  | <-- snapshot {rev+1, ...} -----------  |
  | (resends any order not yet seen)  -->  |  known id: ignored, snapshot sent back
```

Messages are small (menu item ids and quantities, not names). A snapshot carries at
most 30 open orders and 30 served ids, which a test checks stays under the room's
16 KiB limit.

## Files

| File | What it does |
| --- | --- |
| `App.tsx` | Picks the screen and wires the room's messages to the reducers |
| `src/domain/orders.ts` | Order types, kitchen and waiter reducers, message validation (pure, tested) |
| `src/domain/menu.ts` | The menu and table count |
| `src/ui/KitchenScreen.tsx` | Kitchen display: tickets by status (columns on tablets, tabs on phones) |
| `src/ui/OrderScreen.tsx` | Waiter: table, menu, cart, my orders |
| `src/ui/common.tsx` | Top bar, status colors, "3 min ago" |
| `src/ui/illustrations.tsx` | Hand-drawn SVG food art and the lobby bell |

## Checks

```sh
pnpm --filter @offline-app-examples/orderup typecheck
pnpm --filter @offline-app-examples/orderup test
pnpm --filter @offline-app-examples/orderup lint
```

The test covers idempotent placing, status changes, stale snapshots, resending of
missing orders and the snapshot size bound. It does not replace a test on real devices.

## Licensing

This example's code is licensed under MIT-0 (see the repository's
[LICENSE](../../LICENSE)). It depends on `@offline-protocol/mesh-sdk`, which is
licensed under AGPL-3.0-only or a commercial license from Offline Protocol, Inc.
An app that embeds the SDK, including one built from this example, is subject to
the AGPL-3.0-only unless you hold a commercial license. See
[Licensing](https://www.offlineprotocol.com/docs/operations/licensing).
