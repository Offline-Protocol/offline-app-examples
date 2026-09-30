# @offline-app-examples/mesh

Nearby "rooms" over Bluetooth, on top of [`@offline-protocol/mesh-sdk`](https://www.npmjs.com/package/@offline-protocol/mesh-sdk).
This is the only package that starts the SDK. Apps get a small state object and a
few actions; they never handle raw Bluetooth or encryption events.

```tsx
const room = useNearbyRoom({
  appId: 'stocksync',
  onMessage: (from, data) => { /* validate `data`, then apply it */ },
  onPeerJoined: peer => { /* host: send the newcomer a snapshot */ },
});

room.host('Corner Shop');          // one phone
room.discover();                   // the others: room.hosts fills in
room.join(room.hosts[0].id, 'Ada');
room.broadcast({ type: 'snapshot', items });
```

## The flow

1. **Start.** `host()` or `discover()` asks for Bluetooth permission (Android), starts
   one `OfflineProtocol` with only Bluetooth enabled (no internet, Nostr, Reticulum or
   relay server), makes sure the MLS encryption identity exists and waits for Bluetooth.
2. **Advertise.** The host registers a MeshServices service `<appId>-room` whose
   capabilities carry the room name, and re-registers every few seconds.
3. **Discover.** Members query that service. Answers only count when they come from a
   *direct* Bluetooth neighbor (discovery gossips across hops, and a host you cannot
   reach directly is not joinable). Queries are throttled because each one floods the
   radio. Hosts that stop answering drop off the list after 20 s.
4. **Join.** `join()` waits ~2 s after the Bluetooth link first appears (a fresh link
   loses early packets), then sends an SDK connection request, and repeats it every 8 s
   until the host answers or 90 s pass.
5. **Auto-accept.** The host accepts every request, retries included, and the joiner
   becomes a peer (`onPeerJoined`). Behind the scenes the SDK exchanges key packages and
   sets up an encrypted 1:1 MLS session; messages sent before it is ready are queued.
6. **Messages.** `send(peerId, data)` and `broadcast(data)` carry any JSON value inside a
   small envelope (`{ t: 'app', d }`). Rooms are a star: members talk to the host, the
   host talks to everyone. `broadcast` goes to every connected peer, so on a member it
   reaches the host. Apps validate what they receive.
7. **Leaving.** `leave()` tells peers goodbye, then stops and destroys the protocol. A
   peer whose Bluetooth link drops is removed after 20 s, and added back (with another
   `onPeerJoined`) as soon as it is heard from again. That is why host-authoritative
   apps should answer `onPeerJoined` with a full snapshot.

## Group mode (`{ group: true }`)

For the SDK's replicated documents (`DataStore`), which live in an MLS group.

- **Host:** `host(name)` creates an MLS group (or reuses one with
  `host(name, { groupId })` if this device still has it), so `groupId` is set by the
  time status is `'hosting'`. For each joiner it waits until the SDK holds a fresh key
  package for them (the SDK sends one right after the 1:1 session forms), calls
  `meshInviteToGroup`, then also tells the member the group id in a room message.
- **Member:** learns the group id from `group_member_added` (the host's Welcome was
  processed) or from that room message, confirms the group exists locally, and only then
  switches from `'joining'` to `'connected'`. So `groupId` is set whenever a member is
  `'connected'`.
- Group mode lets devices forward traffic for each other (3 hops), because group
  messages go member to member and two members may not be in range of each other.

```ts
import { DataStore } from '@offline-app-examples/mesh';

const store = new DataStore();                   // only while the room is running
await store.textInsert(room.groupId!, 'doc', 'body', 0, 'Hello');
// re-read on room events: onProtocolEvent: e => e.type === 'data_changed' && ...
```

## Limits and caveats

- One message is at most 16 KiB of JSON by default (`maxMessageBytes`); `send` throws
  above it. Bluetooth moves roughly 180–500 bytes per fragment, so keep messages small.
- iOS keeps at most about 4 Bluetooth connections per device, so plan for small rooms.
- Wi-Fi Direct is off: in SDK 0.27 the phone Wi-Fi Direct transport carries no traffic.
- Discovery needs physical phones. Simulators run the UI but never find peers.

## Files

| File | What it does |
| --- | --- |
| `src/room.ts` | `NearbyRoom`: SDK lifecycle, discovery, joining, peers, messages, groups |
| `src/useNearbyRoom.ts` | React hook around one `NearbyRoom` |
| `src/hosts.ts` | Pure host-list logic (tested) |
| `src/envelope.ts` | Message envelope encode/decode with the size bound (tested) |
| `src/permissions.ts` | Android Bluetooth permissions |
